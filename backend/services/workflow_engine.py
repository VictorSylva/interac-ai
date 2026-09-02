from datetime import datetime
import json
import uuid
import logging
import re
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from database.session import AsyncSessionLocal
from database.models.workflow import Workflow, WorkflowNode, WorkflowExecution, ExecutionStep, WorkflowEdge

# from services.ai_service import generate_response # Import for AI nodes

logger = logging.getLogger(__name__)

class WorkflowEngine:
    
    async def trigger_workflow(self, business_id: str, trigger_type: str, trigger_data: dict):
        """
        Finds active workflows matching the trigger and starts execution.
        """
        logger.info(f"[WorkflowEngine] Triggering {trigger_type} for Business {business_id} | Data: {trigger_data.keys()}")

        # 0. Orchestration Check: Active Suspension?
        # If the user is replying to a suspended workflow, RESUME it instead of starting new ones.
        if trigger_type == "message_created":
            resumed_id = await self.check_and_resume_execution(business_id, trigger_data)
            if resumed_id:
                logger.info(f"[WorkflowEngine] Resumed execution {resumed_id} instead of triggering new workflow.")
                return [resumed_id]

        # 0.1 Access Enforcement
        from services.subscription_service import check_access, track_conversation
        access = await check_access(business_id) # Initial trigger check
        if not access["allowed"]:
            logger.warning(f"[WorkflowEngine] Access Denied for {business_id}: {access['reason']}")
            return []
        
        # 0.2 Track Conversation (unique user within 24h)
        user_id = trigger_data.get("from_number") or trigger_data.get("user_id")
        if user_id and user_id != "unknown":
            await track_conversation(business_id, user_id)

        async with AsyncSessionLocal() as session:
            # 1. Resolve all linked IDs (Email, UUID, etc.)
            from services.db_service import get_all_possible_business_ids
            possible_ids = await get_all_possible_business_ids(business_id)
            
            logger.info(f"[WorkflowEngine] Triggering '{trigger_type}' for potential IDs: {possible_ids}")
            
            # Use flexible target mapping
            target_types = {trigger_type}
            if trigger_type == "message_created":
                target_types.update(["keyword", "intent", "keyword_detected", "intent_detected", "ai_sentiment"])
            elif trigger_type == "appointment_booked":
                target_types.add("scheduling_event")
            elif trigger_type == "scheduling_event":
                target_types.add("appointment_booked")
            
            stmt = select(Workflow).options(selectinload(Workflow.nodes)).where(
                Workflow.business_id.in_(possible_ids), 
                Workflow.is_active == True,
                Workflow.trigger_type.in_(list(target_types))
            )
            result = await session.execute(stmt)
            workflows = result.scalars().all()
            
            if workflows:
                # Limit Check removed: All businesses can have unlimited active workflows.
                pass

            logger.info(f"[WorkflowEngine] Found {len(workflows)} active workflows matching triggers {target_types}")
            
            for workflow in workflows:
                # 2. Extract Data & Identify Recipient
                logger.info(f"[WorkflowEngine] Executing workflow: {workflow.name} (ID: {workflow.id})")
            
            executions = []
            for wf in workflows:
                # Check trigger config (e.g. keywords)
                logger.info(f"[WorkflowEngine] Checking WF {wf.id} ({wf.name}). Config: {wf.trigger_config}")
                if not self._check_trigger_match(wf.trigger_config, trigger_data):
                    logger.info(f"[WorkflowEngine] Workflow {wf.id} ({wf.name}) skipped: Trigger config mismatch.")
                    continue
                
                # Follow-Up Control System for Automated Outreach
                if trigger_type in ["cart_abandoned", "re_engagement"]:
                    user_identifier = trigger_data.get("from_number") or trigger_data.get("user_id") or trigger_data.get("customer_phone") or trigger_data.get("customer_email")
                    if user_identifier:
                        from services.db_service import get_lead_by_contact
                        from database.models.crm import Lead
                        lead_id = await get_lead_by_contact(business_id, email=user_identifier if "@" in user_identifier else None, phone=user_identifier if "@" not in user_identifier else None)
                        if lead_id:
                            lead = await session.get(Lead, lead_id)
                            # Max 3 DMs, min 2 hours apart
                            if lead.follow_up_count >= 3:
                                logger.info(f"[WorkflowEngine] Skipping outreach WF {wf.id}: max follow_ups reached (3) for lead {lead_id}")
                                continue
                            if lead.last_followed_up_at:
                                hours_since = (datetime.utcnow() - lead.last_followed_up_at).total_seconds() / 3600
                                if hours_since < 2:
                                    logger.info(f"[WorkflowEngine] Skipping outreach WF {wf.id}: cooldown active for lead {lead_id} ({hours_since:.1f} hours)")
                                    continue
                            # Mark follow-up attempt
                            lead.follow_up_count += 1
                            lead.last_followed_up_at = datetime.utcnow()
                            session.add(lead)
                            # The transaction will be committed below
                
                logger.info(f"[WorkflowEngine] Starting Workflow {wf.id} ({wf.name})")

                # Create Execution
                execution = WorkflowExecution(
                    workflow_id=wf.id,
                    business_id=business_id,
                    trigger_event=trigger_data,
                    context_data={"trigger": trigger_data, "business_id": business_id, "execution_id": None},
                    status="running"
                )
                session.add(execution)
                await session.flush() # Get ID
                execution.context_data = {**execution.context_data, "execution_id": execution.id}
                
                # Find Start Node
                # 1. First try generic 'start' type (The "Start Trigger" node in UI)
                start_node_stmt = select(WorkflowNode).where(
                    WorkflowNode.workflow_id == wf.id,
                    WorkflowNode.type == 'start'
                )
                start_node_res = await session.execute(start_node_stmt)
                start_node = start_node_res.scalar_one_or_none()
                
                # 2. Fallback: Find nodes matching the trigger category (e.g. 'sales_trigger', 'keyword', etc.)
                # This handles cases where users use a specific trigger node as the head of the flow.
                if not start_node:
                    logger.info(f"[WorkflowEngine] No generic 'start' node found. Checking for type-specific nodes in {target_types}")
                    fallback_stmt = select(WorkflowNode).where(
                        WorkflowNode.workflow_id == wf.id,
                        WorkflowNode.type.in_(target_types)
                    )
                    start_node = (await session.execute(fallback_stmt)).scalar_one_or_none()
                
                if start_node:
                    # Dispatch Task
                    logger.info(f"[WorkflowEngine] Dispatching execution {execution.id} starting at node {start_node.id} ({start_node.type})")
                    self.dispatch_node_processing(execution.id, start_node.id)
                    executions.append(execution.id)
                else:
                    logger.warning(f"[WorkflowEngine] Workflow {wf.id} has no start node or matching trigger node.")
                
            # Check if any of the executed workflows takes over the chat/conversation
            # (i.e. has customer-facing interaction nodes)
            takes_over_chat = False
            for wf in workflows:
                for node in wf.nodes:
                    if node.type in ["escalate_to_human", "wait_for_reply"]:
                        takes_over_chat = True
                        break
                    elif node.type == "action":
                        action_type = node.config.get("action_type")
                        if action_type in ["send_message", "route_to_department", "assign_agent", "send_offer_link"]:
                            takes_over_chat = True
                            break
                if takes_over_chat:
                    break

            await session.commit()
            return executions, takes_over_chat

    async def check_and_resume_execution(self, business_id: str, trigger_data: dict):
        """
        Orchestration: Checks if this user has a suspended workflow and resumes it.
        Returns Execution ID if resumed, None otherwise.
        """
        # Support both WhatsApp (from_number) and Web (user_id)
        user_identifier = trigger_data.get("from_number") or trigger_data.get("user_id")
        
        if not user_identifier:
            logger.warning("[WorkflowEngine] Cannot check resume: No user_identifier in trigger data.")
            return None

        async with AsyncSessionLocal() as session:
            # Find suspended execution for this user (simple heuristic: look for from_number in trigger)
            # This relies on JSON containment or extracting the user ID. 
            # For now, let's assume we search where context_data->trigger->from_number matches.
            # This is slow without an index, but acceptable for MVP.
            
            # Using Python-side filtering for JSON safety across DBs,
            # but ideally we use JSON path query: execution.context_data['trigger']['from_number']
            
            # 1. Get all suspended executions for this business
            stmt = select(WorkflowExecution).where(
                WorkflowExecution.business_id == business_id,
                WorkflowExecution.status == 'suspended'
            )
            result = await session.execute(stmt)
            executions = result.scalars().all()
            
            target_execution = None
            for exc in executions:
                # Check if this execution belongs to this user
                # We assume context_data has "trigger"
                ex_trigger = exc.context_data.get("trigger", {})
                ex_user = ex_trigger.get("from_number") or ex_trigger.get("user_id")
                
                if ex_user == user_identifier:
                    target_execution = exc
                    break
            
            if not target_execution:
                return None
                
            # 2. Resume Logic
            logger.info(f"[WorkflowEngine] Resuming execution {target_execution.id} for user {user_identifier}")
            
            # Inject new message into context
            # We add it as "latest_reply" and also append to "history" if we had one
            # NORMALIZE: Ensure we have 'message_body'
            message_body = trigger_data.get("message_body") or trigger_data.get("message")
            
            resume_data = {
                "latest_reply": message_body,
                "latest_trigger": trigger_data
            }
            
            # Merge context
            target_execution.context_data = {**target_execution.context_data, **resume_data}
            target_execution.status = "running"
            
            # Retrieve resume point BEFORE clearing payload
            resume_node_id = None
            if hasattr(target_execution, 'resume_payload') and target_execution.resume_payload:
                 resume_node_id = target_execution.resume_payload.get('node_id')
            
            target_execution.resume_payload = None # Clear suspension
            
            session.add(target_execution)
            await session.commit()
            
            # 3. Trigger Next Step
            if not resume_node_id:
                logger.error(f"[WorkflowEngine] Cannot resume execution {target_execution.id}: missing resume_node_id")
                return None
                
            node = await session.get(WorkflowNode, resume_node_id)
            if node:
                # We pretend the Wait Node just finished and produced this output
                node_output = {"user_reply": message_body}
                
                # Update the STEP that was suspended? 
                # Ideally we mark the suspended step as completed now.
                # But for now, we just proceed to next nodes.
                
                next_nodes = await get_next_nodes(session, node, node_output)
                if not next_nodes:
                     logger.info(f"[WorkflowEngine] Resumed node {node.id} has no outgoing edges.")
                
                for next_node in next_nodes:
                     self.dispatch_node_processing(target_execution.id, next_node.id)
                     logger.info(f"[WorkflowEngine] Dispatched next node {next_node.id}")
            
            return target_execution.id

    async def create_workflow(self, business_id: str, workflow_data: dict):
        """
        Parses a full workflow DAG and saves it to the database.
        Request Body: {
            "name": "...", 
            "trigger_type": "...",
            "trigger_config": {}, 
            "nodes": [...], 
            "edges": [...]
        }
        """
        async with AsyncSessionLocal() as session:
            try:
                # 1. Create Workflow
                wf = Workflow(
                    business_id=business_id,
                    name=workflow_data.get("name", "Untitled Workflow"),
                    description=workflow_data.get("description"),
                    trigger_type=workflow_data.get("trigger_type"),
                    trigger_config=workflow_data.get("trigger_config", {}),
                    definition=workflow_data.get("definition", {}), # Save UI State
                    is_active=True
                )
                session.add(wf)
                await session.flush() # Get ID
                
                # 2. Map Frontend IDs to DB IDs (if needed, or just use provided if UUID)
                # For simplicity, we assume frontend provides UUIDs or we generate them.
                # But to maintain Referential Integrity, we must ensure consistency.
                # Let's assume nodes come with 'id' that we respect if possible, or we might break edges.
                # Simplest: Save nodes with provided IDs (must be unique strings).
                
                node_map = {} # client_id -> db_obj
                
                nodes_data = workflow_data.get("nodes", [])
                for n_data in nodes_data:
                    node = WorkflowNode(
                        id=n_data.get("id", str(uuid.uuid4())),
                        workflow_id=wf.id,
                        type=n_data.get("type"),
                        label=n_data.get("label"),
                        config=n_data.get("config", {}),
                        platform_meta=n_data.get("position") or n_data.get("platform_meta") or {}
                    )
                    session.add(node)
                    node_map[node.id] = node
                
                # 3. Create Edges
                edges_data = workflow_data.get("edges", [])
                for e_data in edges_data:
                    source_id = e_data.get("source") or e_data.get("source_id")
                    target_id = e_data.get("target") or e_data.get("target_id")
                    
                    if source_id not in node_map or target_id not in node_map:
                        logger.warning(f"Edge references missing node: {source_id} -> {target_id}")
                        continue
                        
                    edge = WorkflowEdge(
                        workflow_id=wf.id,
                        source_id=source_id,
                        target_id=target_id,
                        condition_value=e_data.get("condition") or e_data.get("condition_value")
                    )
                    session.add(edge)
                
                await session.commit()
                return {"status": "success", "id": wf.id}
                
            except Exception as e:
                logger.error(f"Error creating workflow: {e}")
                await session.rollback()
                return {"status": "error", "message": str(e)}

    async def get_workflows(self, business_id: str):
        """
        List all workflows for a business.
        """
        async with AsyncSessionLocal() as session:
            stmt = select(Workflow).where(Workflow.business_id == business_id)
            result = await session.execute(stmt)
            workflows = result.scalars().all()
            return workflows

    async def delete_workflow(self, business_id: str, workflow_id: str):
        """
        Delete a workflow by ID.
        """
        async with AsyncSessionLocal() as session:
            try:
                wf = await session.get(Workflow, workflow_id)
                if not wf or wf.business_id != business_id:
                     return False
                
                await session.delete(wf)
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error deleting workflow {workflow_id}: {e}")
                await session.rollback()
                return False

    async def get_executions(self, business_id: str, workflow_id: str = None, limit: int = 50):
        """
        List past executions.
        """
        async with AsyncSessionLocal() as session:
            stmt = select(WorkflowExecution).where(WorkflowExecution.business_id == business_id)
            if workflow_id:
                stmt = stmt.where(WorkflowExecution.workflow_id == workflow_id)
            
            stmt = stmt.order_by(WorkflowExecution.started_at.desc()).limit(limit)
            result = await session.execute(stmt)
            executions = result.scalars().all()
            return executions

    async def trigger_specific_workflow(self, business_id: str, workflow_id: str, trigger_data: dict):
        """
        Manually trigger a specific workflow by ID.
        """
        async with AsyncSessionLocal() as session:
            wf = await session.get(Workflow, workflow_id)
            if not wf or wf.business_id != business_id:
                 return None
            
            execution = WorkflowExecution(
                    workflow_id=wf.id,
                    business_id=business_id,
                    trigger_event=trigger_data,
                    context_data={"trigger": trigger_data, "execution_id": None},
                    status="running"
                )
            session.add(execution)
            await session.flush()
            execution.context_data = {**execution.context_data, "execution_id": execution.id}
            
            # Find Start Node
            start_node_stmt = select(WorkflowNode).where(
                WorkflowNode.workflow_id == wf.id,
                WorkflowNode.type == 'start'
            )
            start_node_res = await session.execute(start_node_stmt)
            start_node = start_node_res.scalar_one_or_none()
            
            if start_node:
                self.dispatch_node_processing(execution.id, start_node.id)
                await session.commit()
                return execution.id
            else:
                await session.rollback()
                return None

    def _check_trigger_match(self, config: dict, data: dict) -> bool:
        """Evaluate if the trigger data matches the config"""
        if not config: return True
        
        # 1. Keyword Match (Single or Array)
        # Supports 'keyword' (legacy) and 'keywords' / 'keyword_detected'
        keywords = config.get("keywords") or ([config.get("keyword")] if "keyword" in config else [])
        if keywords:
            message = str(data.get("message", "") or data.get("message_body", "")).lower()
            # If ANY keyword matches
            match = False
            for kw in keywords:
                if kw and str(kw).lower() in message:
                    match = True
                    break
            if not match: return False
        
        # 2. Intent Match
        # Supports 'intent' (legacy) and 'intent_detected'
        target_intent = (config.get("intent_detected") or config.get("intent") or "").lower()
        if target_intent:
            actual_intent = (data.get("intent") or "").lower()
            if actual_intent != target_intent:
                return False
        
        # 3. AI Sentiment Match
        if "ai_sentiment" in config:
            target_sentiment = (config["ai_sentiment"].get("sentiment") or "negative").lower()
            threshold = config["ai_sentiment"].get("threshold", 0.7)
            
            actual_sentiment = (data.get("sentiment") or "neutral").lower()
            actual_score = data.get("sentiment_score", 0.5)
            
            if actual_sentiment != target_sentiment:
                return False
            if actual_score < threshold:
                return False

        # 4. Lead Status Match (Legacy)
        if "status" in config:
            new_status = data.get("new_status", "").lower()
            target_status = config["status"].lower()
            if new_status != target_status:
                return False
                
        # 5. Intelligence Event Match
        if "event_type" in config and config["event_type"]:
            target_event = config["event_type"].lower().strip()
            actual_event = (data.get("event_type") or "").lower().strip()
            if target_event and target_event != actual_event:
                return False
                
        return True

    def dispatch_node_processing(self, execution_id: str, node_id: str, delay: int = 0):
        """
        Attempts to dispatch a node to Celery. If Redis/Broker is unavailable, 
        it falls back to direct async execution to ensure local dev works.
        """
        try:
            if delay > 0:
                process_node_task.apply_async(args=[execution_id, node_id], countdown=delay)
            else:
                process_node_task.delay(execution_id, node_id)
            logger.info(f"[WorkflowEngine] Task dispatched to Celery for node {node_id}")
        except Exception as e:
            # Fallback for environments without Redis (like local dev)
            import asyncio
            logger.warning(f"[WorkflowEngine] Celery dispatch failed ({e}). Falling back to direct async execution.")
            # We use create_task to run it in the background of the current event loop
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(process_node_async(execution_id, node_id))
            except RuntimeError:
                # No running loop (e.g. script context)
                asyncio.run(process_node_async(execution_id, node_id))

workflow_engine = WorkflowEngine()

from celery import shared_task

# --- Celery Tasks ---

@shared_task(name="process_node")
def process_node_task(execution_id: str, node_id: str):
    """
    Celery task wrapper to run async node processing synchronously
    """
    import asyncio
    asyncio.run(process_node_async(execution_id, node_id))

async def process_node_async(execution_id: str, node_id: str):
    async with AsyncSessionLocal() as session:
        try:
            node = await session.get(WorkflowNode, node_id)
            execution = await session.get(WorkflowExecution, execution_id)
            
            if not node or not execution:
                return
            
            # 1. Create Step Record
            step = ExecutionStep(
                execution_id=execution.id,
                node_id=node.id,
                status="running",
                input_data=execution.context_data # simplified
            )
            session.add(step)
            await session.commit()
            
            # 2. Execute Logic
            from services.subscription_service import check_access
            from services.token_service import token_service, TOKEN_COSTS
            business_id = execution.business_id
            
            # 2.1 Access Enforcement (Strict order: Active -> Limit -> Tokens)
            access = await check_access(business_id, required_tokens=TOKEN_COSTS["workflow_step"])
            if not access["allowed"]:
                logger.warning(f"[WorkflowEngine] Node {node.id} Aborted: {access['reason']}")
                step.status = "failed"
                step.output_data = {"error": access["code"]}
                execution.status = "failed"
                await session.commit()
                return

            output = await execute_node_logic(node, execution.context_data)
            
            # 2.3 Success? Deduct tokens
            await token_service.deduct_tokens(business_id, TOKEN_COSTS["workflow_step"], "workflow_step", 
                                            metadata={"node_id": node.id, "node_type": node.type})
            
            # Orchestration Check: Did the node ask to suspend?
            if isinstance(output, dict) and output.get("orchestration_signal") == "suspend":
                step.status = "suspended"
                step.completed_at = datetime.utcnow()
                
                execution.status = "suspended"
                execution.resume_payload = {
                    "node_id": output.get("resume_node_id"), 
                    "step_id": step.id
                }
                
                logger.info(f"Execution {execution.id} suspended at node {node.id}")
                session.add(execution)
                session.add(step)
                await session.commit()
                return # STOP HERE

            # 3. Update Step & Context
            step.output_data = output
            step.status = "completed"
            step.completed_at = datetime.utcnow()
            
            # 3.1 Deduct Tokens for workflow step
            try:
                from services.token_service import token_service, TOKEN_COSTS
                # Standard cost per node
                await token_service.deduct_tokens(execution.business_id, TOKEN_COSTS["workflow_step"], "workflow_step", 
                                                metadata={"node_id": node_id, "node_type": node.type, "execution_id": execution_id})
            except Exception as token_err:
                logger.error(f"[WorkflowEngine] Token deduction failed for node {node_id}: {token_err}")

            # Update Global Context (Merge)
            if isinstance(output, dict):
                execution.context_data = {**execution.context_data, **output}
                session.add(execution) # Mark for update
            
            await session.commit()
            
            # 4. Determine Next Nodes
            next_nodes = await get_next_nodes(session, node, output)
            
            # Check for delay signal
            delay_seconds = 0
            if isinstance(output, dict) and output.get("orchestration_signal") == "delay":
                delay_seconds = output.get("seconds", 0)
            
            # 5. Dispatch Next
            for next_node in next_nodes:
                workflow_engine.dispatch_node_processing(execution_id, next_node.id, delay=delay_seconds)
                 
            # If no next nodes, checking if end of workflow?
            if not next_nodes:
                # If we delayed, we are technically still "running" until the next one picks up?
                # Actually if next_nodes is empty, delay doesn't matter (nothing to delay).
                
                # Check if all branches done? simplified: just mark completed
                execution.status = "completed"
                execution.completed_at = datetime.utcnow()
                session.add(execution)
                await session.commit()
                
        except Exception as e:
            logger.error(f"Error processing node {node_id}: {e}")
            # Mark step failed
            # step.status = "failed"
            # step.error = str(e)
            # await session.commit()

def get_context_value(context: dict, key: str):
    """
    Resolves a variable from context. 
    Supports nested keys (e.g. 'trigger.message_body') and flat keys.
    """
    if not key: return None
    
    parts = key.split('.')
    val = context
    for p in parts:
        if isinstance(val, dict):
            val = val.get(p)
        else:
            val = None
            break
            
    # Fallback: if not found by path, check if it exists as a flat key in the root
    if val is None and len(parts) == 1:
        val = context.get(key)
        
    # Extra fallback: check inside 'trigger' if not found at root
    if val is None and len(parts) == 1:
        val = context.get("trigger", {}).get(key)
        
    return val

def hydrate_text(text: str, context: dict):
    """
    Replaces {{variable}} placeholders in text with values from context.
    """
    if not isinstance(text, str): return text
    
    def replace_var(match):
        key = match.group(1).strip()
        val = get_context_value(context, key)
        return str(val) if val is not None else ""
        
    return re.sub(r'\{\{(.*?)\}\}', replace_var, text)

async def resolve_node_phone_number(config: dict, context: dict) -> dict:
    recipient_type = config.get("recipient_type", "fixed")
    business_id = context.get("business_id", "default")
    user_id = context.get("trigger", {}).get("user_id") or context.get("trigger", {}).get("from_number")
    convo_id = f"{business_id}:{user_id}"
    department = context.get("trigger", {}).get("department") or context.get("department") or "general"
    property_id = context.get("trigger", {}).get("property_id") or context.get("property_id")
    
    if recipient_type == "fixed":
        return {"phone": config.get("to_number"), "reason": "Fixed configuration"}
        
    from services.routing_service import DepartmentRoutingService
    resolved = await DepartmentRoutingService.resolve_recipient(
        business_id=business_id,
        department=department,
        conversation_id=convo_id,
        property_id=property_id
    )
    
    if recipient_type == "assigned_agent":
        if resolved.get("recipient_type") == "assigned_agent":
            return {"phone": resolved.get("phone"), "reason": resolved.get("routing_reason")}
        return {"phone": None, "reason": "No assigned agent found"}
        
    elif recipient_type == "dept_primary":
        if resolved.get("recipient_type") == "primary_agent":
            return {"phone": resolved.get("phone"), "reason": resolved.get("routing_reason")}
        return {"phone": None, "reason": "No department primary agent found"}
        
    elif recipient_type == "dept_phone":
        if resolved.get("recipient_type") == "department_phone":
            return {"phone": resolved.get("phone"), "reason": resolved.get("routing_reason")}
        return {"phone": None, "reason": "No department phone number configured"}
        
    elif recipient_type == "business_admin":
        if resolved.get("recipient_type") == "owner":
            return {"phone": resolved.get("phone"), "reason": resolved.get("routing_reason")}
        return {"phone": None, "reason": "No business owner found"}
        
    return {"phone": resolved.get("phone"), "reason": resolved.get("routing_reason")}

async def resolve_node_email(config: dict, context: dict) -> dict:
    recipient_type = config.get("recipient_type", "fixed")
    business_id = context.get("business_id", "default")
    user_id = context.get("trigger", {}).get("user_id") or context.get("trigger", {}).get("from_number")
    convo_id = f"{business_id}:{user_id}"
    department = context.get("trigger", {}).get("department") or context.get("department") or "general"
    property_id = context.get("trigger", {}).get("property_id") or context.get("property_id")
    
    if recipient_type == "fixed":
        return {"email": config.get("to"), "reason": "Fixed configuration"}
        
    from services.routing_service import DepartmentRoutingService
    resolved = await DepartmentRoutingService.resolve_recipient(
        business_id=business_id,
        department=department,
        conversation_id=convo_id,
        property_id=property_id
    )
    
    if recipient_type == "assigned_agent":
        if resolved.get("recipient_type") == "assigned_agent":
            return {"email": resolved.get("email"), "reason": resolved.get("routing_reason")}
        return {"email": None, "reason": "No assigned agent found"}
        
    elif recipient_type == "dept_primary":
        if resolved.get("recipient_type") == "primary_agent":
            return {"email": resolved.get("email"), "reason": resolved.get("routing_reason")}
        return {"email": None, "reason": "No department primary agent found"}
        
    elif recipient_type == "dept_phone":
        if resolved.get("recipient_type") in ["department_phone", "department_email"]:
            return {"email": resolved.get("email"), "reason": resolved.get("routing_reason")}
        return {"email": None, "reason": "No department email configured"}
        
    elif recipient_type == "business_admin":
        if resolved.get("recipient_type") == "owner":
            return {"email": resolved.get("email"), "reason": resolved.get("routing_reason")}
        return {"email": None, "reason": "No business owner found"}
        
    return {"email": resolved.get("email"), "reason": resolved.get("routing_reason")}

async def should_notify_agent(business_id: str, user_id: str, workflow_id: str, current_execution_id: str = None, channel: str = "whatsapp") -> bool:
    """
    Checks if we should send a notification to the agent for this message.
    Returns True if no notification has been successfully sent to this user
    for this conversation/channel in the last configured cooldown minutes (default 30).
    """
    if not business_id or not user_id:
        return True # Default to notify if we can't check
        
    from services.db_service import resolve_business_id
    real_business_id = await resolve_business_id(business_id)
    convo_id = f"{real_business_id}:{user_id}"
    
    from database.session import AsyncSessionLocal
    from database.models.general import NotificationEvent, BusinessSettings
    from datetime import datetime, timedelta
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Fetch configured cooldown minutes (fallback to 30)
            settings_stmt = select(BusinessSettings).where(BusinessSettings.business_id == real_business_id)
            settings_res = await session.execute(settings_stmt)
            settings = settings_res.scalar_one_or_none()
            cooldown_mins = 30
            if settings and hasattr(settings, "notification_cooldown_minutes"):
                cooldown_mins = getattr(settings, "notification_cooldown_minutes") or 30
                
            cutoff = datetime.utcnow() - timedelta(minutes=cooldown_mins)
            
            # 2. Check if a notification event exists within the cutoff
            stmt = (
                select(NotificationEvent)
                .where(
                    NotificationEvent.business_id == real_business_id,
                    NotificationEvent.conversation_id == convo_id,
                    NotificationEvent.channel == channel,
                    NotificationEvent.sent_at >= cutoff
                )
            )
            res = await session.execute(stmt)
            existing = res.scalars().first()
            if existing:
                return False # Throttled
                
            return True
        except Exception as e:
            logger.error(f"[WorkflowEngine] Cooldown check error: {e}", exc_info=True)
            return True

async def execute_node_logic(node: WorkflowNode, context: dict):
    """
    Actual business logic for a node
    """
    node_type = node.type
    config = node.config or {}
    
    if node_type == "start":
        return {"status": "started"}
        
    elif node_type == "action":
        action_type = config.get("action_type", "send_message")
        node_label = getattr(node, "label", "").lower()
        
        # Override for sales actions if config is empty but label indicates it
        if "offer" in node_label:
            action_type = "send_offer_link"
        elif "discount" in node_label:
            action_type = "apply_discount"
            
        if action_type == "send_message":
            # Action: Send WhatsApp Message
            from services.whatsapp_service import send_whatsapp_message
            
            target_number = context.get("trigger", {}).get("from_number") or config.get("to_number")
            message_template = config.get("template", "Hello from InteractAI!")
            
            # Simple template substitution
            message_body = hydrate_text(message_template, context)
            
            if target_number:
                await send_whatsapp_message(target_number, message_body)
                return {"action_result": "sent", "message_body": message_body}
            
            # Fallback: Web Chat or Unknown Platform
            elif context.get("trigger", {}).get("user_id"):
                 from services.db_service import store_message
                 user_id = context.get("trigger", {}).get("user_id")
                 business_id = context.get("business_id", "default")
                 
                 await store_message(business_id, user_id, message_body, "agent", platform="web")
                 return {"action_result": "sent_web", "message_body": message_body}

            else:
                return {"action_result": "failed", "error": "No target number or user_id found"}

        elif action_type == "send_offer_link":
            # Action: Send Offer Checkout Link
            from services.whatsapp_service import send_whatsapp_message
            target_number = context.get("trigger", {}).get("from_number")
            business_id = context.get("business_id", "default")
            
            offer_slug = config.get("offer_slug", "premium-package")
            offer_link = f"https://interacai.com/{business_id}/{offer_slug}"
            default_msg = f"Here is your secure checkout link: {offer_link}"
            
            message_body = hydrate_text(config.get("message", default_msg), context)
            
            if target_number:
                await send_whatsapp_message(target_number, message_body)
                return {"action_result": "sent_offer", "message_body": message_body}
            elif context.get("trigger", {}).get("user_id"):
                from services.db_service import store_message
                user_id = context.get("trigger", {}).get("user_id")
                await store_message(business_id, user_id, message_body, "agent", platform="web")
                return {"action_result": "sent_offer_web", "message_body": message_body}
            else:
                return {"action_result": "failed", "error": "No target found"}

        elif action_type == "apply_discount":
            # Action: Apply Discount logically
            discount_code = config.get("discount_code", "SAVE20")
            percentage = config.get("percentage", 20)
            return {"action_result": "discount_applied", "discount_code": discount_code, "discount_pct": percentage}

        elif action_type == "create_ticket":
            # Action: Create Support Ticket / Booking
            from services.db_service import create_ticket
            
            ticket_data = {
                "subject": config.get("subject", "New Workflow Ticket"),
                "description": config.get("description", "Created via Automation"),
                "status": "open",
                "priority": config.get("priority", "medium")
            }
            # Add context info to description
            ticket_data["description"] += f"\nContext: {json.dumps(context.get('trigger', {}), default=str)}"
            
            ticket_id = await create_ticket(context.get("business_id", "default"), ticket_data)
            return {"ticket_id": ticket_id, "action_result": "ticket_created"}

        elif action_type == "assign_agent":
            # Action: Assign to Agent
            from services.db_service import assign_agent
            
            agent_id = config.get("agent_id")
            target_id = context.get("ticket_id") # If we just created one
            
            if target_id and agent_id:
                await assign_agent(context.get("business_id", "default"), target_id, agent_id, "ticket")
                return {"assigned_to": agent_id, "action_result": "assigned"}
            else:
                return {"action_result": "skipped", "reason": "missing_id"}

        elif action_type == "send_email":
            # Action: Send Email via SMTP
            from services.email_service import email_service
            
            # 1. Resolve Recipient
            recipient_res = await resolve_node_email(config, context)
            to_email = recipient_res.get("email")
            routing_reason = recipient_res.get("reason", "")
            
            if not to_email or "@" not in str(to_email):
                 logger.error(f"[WorkflowEngine] Invalid email resolved for send_email: {to_email} (reason: {routing_reason})")
                 return {"action_result": "failed", "error": "Invalid or missing recipient email"}
            
            # Throttling to prevent spamming the agent on every message in the same conversation
            business_id = context.get("business_id", "default")
            user_id = context.get("trigger", {}).get("user_id") or context.get("trigger", {}).get("from_number")
            workflow_id = node.workflow_id
            current_execution_id = context.get("execution_id")
            
            # Determine if this email is an agent alert rather than customer response
            recipient_type = config.get("recipient_type", "fixed")
            is_agent_alert = (recipient_type != "fixed")
            if not is_agent_alert:
                # Fallback check
                cust_email = context.get("trigger", {}).get("customer_email") or context.get("trigger", {}).get("email")
                if to_email and cust_email and to_email.lower().strip() != cust_email.lower().strip():
                    is_agent_alert = True
                    
            if is_agent_alert and not await should_notify_agent(business_id, user_id, workflow_id, current_execution_id, channel="email"):
                logger.info(f"[WorkflowEngine] Skipping agent email alert to {to_email} (throttled)")
                return {"action_result": "skipped", "reason": "notification_throttled"}
            
            # 2. Hydrate Subject & Body
            subject = hydrate_text(config.get("subject", "Notification from InteracAI"), context)
            body = hydrate_text(config.get("body", "Hello! This is an automated message."), context)
            
            # 3. Send
            logger.info(f"[WorkflowEngine] Sending email to {to_email} for business {business_id} (reason: {routing_reason})")
            result = await email_service.send_email(
                to=to_email,
                subject=subject,
                html_content=body,
                business_id=business_id
            )
            
            success = result[0] if isinstance(result, tuple) else result
            
            if success:
                # Log NotificationEvent for agent alert
                if is_agent_alert:
                    try:
                        from database.session import AsyncSessionLocal
                        from database.models.general import NotificationEvent
                        from sqlalchemy import select
                        from services.db_service import resolve_business_id
                        
                        real_business_id = await resolve_business_id(business_id)
                        convo_id = f"{real_business_id}:{user_id}"
                        department = context.get("trigger", {}).get("department") or context.get("department") or "general"
                        
                        async with AsyncSessionLocal() as session:
                            event_stmt = select(NotificationEvent).where(
                                NotificationEvent.business_id == real_business_id,
                                NotificationEvent.conversation_id == convo_id,
                                NotificationEvent.channel == "email"
                            )
                            event_res = await session.execute(event_stmt)
                            event_obj = event_res.scalar_one_or_none()
                            if event_obj:
                                event_obj.recipient = to_email
                                event_obj.sent_at = datetime.utcnow()
                                event_obj.status = "sent"
                                event_obj.escalation_level = 0
                                event_obj.acknowledged_at = None
                                event_obj.acknowledged_by = None
                            else:
                                event_obj = NotificationEvent(
                                    business_id=real_business_id,
                                    conversation_id=convo_id,
                                    department=department,
                                    recipient=to_email,
                                    channel="email",
                                    event_type="email_notification",
                                    status="sent",
                                    deduplication_key=f"{real_business_id}:{convo_id}:email",
                                    escalation_level=0
                                )
                                session.add(event_obj)
                            await session.commit()
                    except Exception as event_err:
                        logger.error(f"[WorkflowEngine] Error logging email notification event: {event_err}", exc_info=True)

                return {"action_result": "email_sent", "to": to_email}
            else:
                error_msg = result[1] if isinstance(result, tuple) else "SMTP delivery failed"
                return {"action_result": "failed", "error": error_msg}

        elif action_type == "notify_agent_whatsapp":
            # Action: Send WhatsApp notification to a specified agent number
            from services.whatsapp_service import send_whatsapp_template
            
            # Throttling to prevent spamming the agent on every message in the same conversation
            business_id = context.get("business_id", "default")
            user_id = context.get("trigger", {}).get("user_id") or context.get("trigger", {}).get("from_number")
            workflow_id = node.workflow_id
            current_execution_id = context.get("execution_id")
            if not await should_notify_agent(business_id, user_id, workflow_id, current_execution_id, channel="whatsapp"):
                logger.info(f"[WorkflowEngine] Skipping agent WhatsApp alert (throttled)")
                return {"action_result": "skipped", "reason": "notification_throttled"}
            
            recipient_res = await resolve_node_phone_number(config, context)
            target_number = recipient_res.get("phone")
            routing_reason = recipient_res.get("reason", "")
            
            if not target_number:
                logger.warning(f"[WorkflowEngine] WhatsApp target number could not be resolved (reason: {routing_reason})")
                return {"action_result": "failed", "error": f"WhatsApp target number could not be resolved (reason: {routing_reason})"}
                
            # 1. Resolve Agent Name (greeting)
            agent_name = "Agent"
            clean_target = target_number.strip().replace("+", "")
            if clean_target.endswith("08131608061") or clean_target.endswith("8131608061"):
                agent_name = "Mbasiti"
            
            # 2. Customer Identity
            customer_phone = context.get("trigger", {}).get("from_number") or context.get("trigger", {}).get("user_id") or "New Customer"
            if customer_phone.startswith("web_user_"):
                customer_phone = f"Web User ({customer_phone.replace('web_user_', '')})"
            else:
                # Format phone numbers nicely if it starts with digit
                if customer_phone.isdigit() and not customer_phone.startswith("+"):
                    customer_phone = f"+{customer_phone}"
            
            # 3. Format Time (e.g. 31 August 2026, 2:30 PM)
            from datetime import datetime
            time_str = datetime.utcnow().strftime("%d %B %Y, %I:%M %p")
            
            # Build parameters according to Meta's requirements for 'interacai_agent_chat_notification'
            components = [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": agent_name},
                        {"type": "text", "text": customer_phone},
                        {"type": "text", "text": time_str}
                    ]
                }
            ]
            
            # Send using the approved template
            logger.info(f"[WorkflowEngine] Sending WhatsApp template 'interacai_agent_chat_notification' to {target_number} (business: {business_id}, reason: {routing_reason})")
            success = await send_whatsapp_template(
                to_number=target_number,
                template_name="interacai_agent_chat_notification",
                language_code="en",
                components=components,
                business_id=business_id
            )
            
            if success:
                # Log NotificationEvent
                try:
                    from database.session import AsyncSessionLocal
                    from database.models.general import NotificationEvent
                    from sqlalchemy import select
                    from services.db_service import resolve_business_id
                    
                    real_business_id = await resolve_business_id(business_id)
                    convo_id = f"{real_business_id}:{user_id}"
                    department = context.get("trigger", {}).get("department") or context.get("department") or "general"
                    
                    async with AsyncSessionLocal() as session:
                        event_stmt = select(NotificationEvent).where(
                            NotificationEvent.business_id == real_business_id,
                            NotificationEvent.conversation_id == convo_id,
                            NotificationEvent.channel == "whatsapp"
                        )
                        event_res = await session.execute(event_stmt)
                        event_obj = event_res.scalar_one_or_none()
                        if event_obj:
                            event_obj.recipient = target_number
                            event_obj.sent_at = datetime.utcnow()
                            event_obj.status = "sent"
                            event_obj.escalation_level = 0
                            event_obj.acknowledged_at = None
                            event_obj.acknowledged_by = None
                        else:
                            event_obj = NotificationEvent(
                                business_id=real_business_id,
                                conversation_id=convo_id,
                                department=department,
                                recipient=target_number,
                                channel="whatsapp",
                                event_type="whatsapp_notification",
                                status="sent",
                                deduplication_key=f"{real_business_id}:{convo_id}:whatsapp",
                                escalation_level=0
                            )
                            session.add(event_obj)
                        await session.commit()
                except Exception as event_err:
                    logger.error(f"[WorkflowEngine] Error logging WhatsApp notification event: {event_err}", exc_info=True)

                return {
                    "action_result": "sent_agent_notification_template",
                    "template": "interacai_agent_chat_notification",
                    "to": target_number
                }
            else:
                logger.warning("[WorkflowEngine] Template send failed. Falling back to free-form text message.")
                from services.whatsapp_service import send_whatsapp_message
                message_template = config.get("template", "New customer chat alert!")
                message_body = hydrate_text(message_template, context)
                
                success_fallback = await send_whatsapp_message(target_number, message_body, business_id=business_id)
                if success_fallback:
                    # Log NotificationEvent on fallback success
                    try:
                        from database.session import AsyncSessionLocal
                        from database.models.general import NotificationEvent
                        from sqlalchemy import select
                        from services.db_service import resolve_business_id
                        
                        real_business_id = await resolve_business_id(business_id)
                        convo_id = f"{real_business_id}:{user_id}"
                        department = context.get("trigger", {}).get("department") or context.get("department") or "general"
                        
                        async with AsyncSessionLocal() as session:
                            event_stmt = select(NotificationEvent).where(
                                NotificationEvent.business_id == real_business_id,
                                NotificationEvent.conversation_id == convo_id,
                                NotificationEvent.channel == "whatsapp"
                            )
                            event_res = await session.execute(event_stmt)
                            event_obj = event_res.scalar_one_or_none()
                            if event_obj:
                                event_obj.recipient = target_number
                                event_obj.sent_at = datetime.utcnow()
                                event_obj.status = "sent"
                                event_obj.escalation_level = 0
                                event_obj.acknowledged_at = None
                                event_obj.acknowledged_by = None
                            else:
                                event_obj = NotificationEvent(
                                    business_id=real_business_id,
                                    conversation_id=convo_id,
                                    department=department,
                                    recipient=target_number,
                                    channel="whatsapp",
                                    event_type="whatsapp_notification",
                                    status="sent",
                                    deduplication_key=f"{real_business_id}:{convo_id}:whatsapp",
                                    escalation_level=0
                                )
                                session.add(event_obj)
                            await session.commit()
                    except Exception as event_err:
                        logger.error(f"[WorkflowEngine] Error logging fallback WhatsApp notification event: {event_err}", exc_info=True)

                    return {"action_result": "sent_agent_notification", "message_body": message_body}
                    
                return {"action_result": "failed", "error": "WhatsApp template and fallback message delivery both failed"}

        elif action_type == "route_to_department":
            # Action: Route to a specific department
            from services.db_service import set_conversation_mode
            
            department = config.get("department", "general")
            user_id = context.get("trigger", {}).get("user_id") or context.get("trigger", {}).get("from_number")
            business_id = context.get("business_id", "default")
            
            if user_id:
                await set_conversation_mode(business_id, user_id, mode="human", status="waiting", department=department)
                return {"action_result": "routed", "department": department}
            else:
                return {"action_result": "failed", "error": "No user identifier found for routing"}
                
        elif action_type == "block_room":
            # Action: Block room automatically on critical maintenance
            room_number = context.get("trigger", {}).get("room_number")
            business_id = context.get("business_id")
            if room_number and business_id:
                async with AsyncSessionLocal() as session:
                    from database.models.dynamic_entity import EntityV2, EntityType
                    res = await session.execute(
                        select(EntityType).where(EntityType.org_id == business_id, EntityType.code == "hotel_room")
                    )
                    et = res.scalar_one_or_none()
                    if et:
                        room_stmt = select(EntityV2).where(
                            EntityV2.org_id == business_id,
                            EntityV2.entity_type_id == et.id,
                            EntityV2.display_label == room_number
                        )
                        room_res = await session.execute(room_stmt)
                        room = room_res.scalar_one_or_none()
                        if room:
                            attrs = dict(room.attributes or {})
                            attrs["status"] = "OUT_OF_SERVICE"
                            room.attributes = attrs
                            await session.commit()
        elif action_type == "record_observation":
            # Action: Record an observation signal to Observation Bus & ARGUS OS
            from services.observation_service import observation_service
            from database.session import AsyncSessionLocal
            
            business_id = context.get("business_id", "default")
            source_channel = config.get("source_channel", "workflow")
            obs_type = config.get("observation_type", "workflow_signal")
            severity = config.get("severity", "INFO")
            
            # Hydrate location label
            location_raw = config.get("location_label") or config.get("location") or ""
            location_label = hydrate_text(location_raw, context) if location_raw else (context.get("trigger", {}).get("room_number") or context.get("trigger", {}).get("location"))
            
            # Hydrate payload
            payload_data = config.get("payload") or {}
            if isinstance(payload_data, str):
                try:
                    payload_data = json.loads(hydrate_text(payload_data, context))
                except Exception:
                    payload_data = {"message": hydrate_text(payload_data, context)}
            elif isinstance(payload_data, dict):
                payload_data = {k: (hydrate_text(v, context) if isinstance(v, str) else v) for k, v in payload_data.items()}
            
            if not payload_data and "trigger" in context:
                payload_data = dict(context.get("trigger", {}))
                
            primary_entity = context.get("primary_entity_id") or context.get("trigger", {}).get("reservation_id") or context.get("trigger", {}).get("guest_id") or context.get("trigger", {}).get("student_id") or context.get("trigger", {}).get("patient_id")
            
            async with AsyncSessionLocal() as session:
                obs = observation_service.record_observation(
                    db=session,
                    org_id=business_id,
                    source_channel=source_channel,
                    observation_type=obs_type,
                    primary_entity_id=primary_entity,
                    location_label=location_label,
                    payload=payload_data,
                    severity=severity
                )
                await session.commit()
                return {"action_result": "observation_recorded", "observation_id": obs.id, "observation_type": obs_type}
        
        return {"action_result": "unknown_type"}

    elif node_type == "ai_inference":
        # AI: Generate Text via Advanced Prompting
        from services.ai_service import generate_response
        from services.prompt_service import prompt_service
        from services.db_service import get_business_profile, get_knowledge_documents
        
        business_id = context.get("business_id", "default")
        
        # 1. Fetch Business Context
        profile = await get_business_profile(business_id)
        knowledge_docs = await get_knowledge_documents(business_id)
        
        # Inject docs into profile for the prompt builder
        if knowledge_docs:
            profile['knowledge_docs'] = knowledge_docs
            
        # 2. Build Base System Persona (Industry, Tone, Rules)
        system_persona = prompt_service.build_system_prompt(profile)
        
        # 3. Add Node-Specific Goal
        node_goal = config.get("prompt_template", "You are a helpful assistant.")
        
        # 4. Add Workflow Execution Context
        # Flatten trigger data for the AI to see
        trigger_context = context.get("trigger", {})
        trigger_summary = f"User Input: {trigger_context.get('message_body', '')}\nFrom: {trigger_context.get('from_number', 'Unknown')}"
        
        # Construct the final "Mega-Prompt"
        full_system_instruction = f"""
{system_persona}

*** WORKFLOW GOAL ***
Your current specific objective in this workflow is:
{node_goal}

*** CONTEXT ***
{trigger_summary}
Current Workflow State: {json.dumps(context, default=str)}

Respond directly to the user to achieve the WORKFLOW GOAL.
"""
        
        user_message = config.get("input_text") or trigger_context.get("message_body") or "Continue"
        
        # Call AI Service
        response_text = await generate_response(
            user_message=user_message,
            system_instruction=full_system_instruction,
            business_id=business_id
        )
        
        # AUTO-SEND: If configured to send directly or if it's the primary response node
        if config.get("auto_send", True):
            from services.whatsapp_service import send_whatsapp_message
            target_number = context.get("trigger", {}).get("from_number")
            
            if target_number:
                await send_whatsapp_message(target_number, response_text)
                logger.info(f"[WorkflowEngine] AI Agent auto-sent response to {target_number}")
            elif context.get("trigger", {}).get("user_id"):
                from services.db_service import store_message
                user_id = context.get("trigger", {}).get("user_id")
                await store_message(business_id, user_id, response_text, "agent", platform="web")
                logger.info(f"[WorkflowEngine] AI Agent auto-stored response for web user {user_id}")
        
        return {"ai_output": response_text}
        
    elif node_type == "ai_extract":
        # Intelligence: Structured Data Extraction
        from services.ai_service import generate_response
        
        target_fields = config.get("fields", []) # e.g. [{"name": "email", "type": "email"}]
        schema_desc = json.dumps(target_fields)
        
        # Context to analyze (usually the latest reply or full history)
        trigger_context = context.get("trigger", {})
        # Try to gather history from context
        history = context.get("history", []) # If we store history in context
        history_text = "\n".join([f"{h.get('role')}: {h.get('content')}" for h in history[-10:]])
        
        text_to_analyze = f"""
        Latest Message: {trigger_context.get('message_body', '') or trigger_context.get('message', '')}
        
        Chat History:
        {history_text}
        
        Previous AI Output: {context.get('ai_output', '')}
        """
        
        # Prepare schema description for prompt
        fields_str = ""
        for f in target_fields:
            fields_str += f"- {f.get('name')}: {f.get('description', 'The ' + f.get('name'))} (Type: {f.get('type','string')})\n"

        system_instruction = f"""
        You are an elite Data Extraction Specialist. 
        Your task is to extract specific attributes from the provided chat snippet and return a RAW JSON object.

        FIELDS TO EXTRACT:
        {fields_str}

        CRITICAL RULES:
        1. return ONLY valid JSON.
        2. No markdown blocks. No conversational text.
        3. If you can't find a value, set it to null.
        4. Be precise. If the user says 'I am from Apple', company is 'Apple'.
        5. For numbers (budget, etc.), return only the numeric value (no $ or commas).

        EXAMPLE RESPONSE:
        {{ "company": "Tesla", "budget": 50000 }}
        """
        
        response_text = await generate_response(
            user_message=text_to_analyze,
            system_instruction=system_instruction,
            business_id=context.get("business_id", "default")
        )
        
        # Parse JSON
        try:
            # Cleanup potential markdown
            cleaned_text = response_text.replace("```json", "").replace("```", "").strip()
            extracted_data = json.loads(cleaned_text)
            
            # Return merged into a key? Or top level?
            # Let's return as top level to allow quick access in conditions
            return extracted_data
        except:
            logger.error(f"Failed to parse AI Extract JSON: {response_text}")
            return {"extraction_error": "failed_to_parse_json"}
    
    elif node_type == "time_delay":
        # Intelligence: Temporal Logic
        # Returns a signal to the dispatcher to delay the NEXT step
        seconds = int(config.get("seconds", 0))
        return {"orchestration_signal": "delay", "seconds": seconds}

    elif node_type == "http_request":
        # Intelligence: External Connectivity
        import httpx
        
        url = config.get("url")
        method = config.get("method", "GET").upper()
        headers = config.get("headers", {})
        body = config.get("body")
        
        # Hydrate variables in URL/Body (simple replacement)
        def hydrate(text):
            if not isinstance(text, str): return text
            def replace_var(match):
                key = match.group(1).strip()
                val = get_context_value(context, key)
                return str(val) if val is not None else match.group(0)
            return re.sub(r'\{\{(.*?)\}\}', replace_var, text)
        
        url = hydrate_text(url, context)
        if isinstance(body, dict):
            body_str = hydrate_text(json.dumps(body), context)
            body = json.loads(body_str)
        elif isinstance(body, str):
            body = hydrate_text(body, context)

        if not url:
            return {"error": "Missing URL"}
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(method, url, headers=headers, json=body, timeout=10.0)
                # We don't raise error immediately, we let the workflow handle the status code
                
                return {
                    "status_code": response.status_code,
                    "response_body": response.json() if response.headers.get("content-type") == "application/json" else response.text
                }
            except Exception as e:
                return {"error": str(e)}

    elif node_type == "lead_capture":
        # CRM: Save Lead
        from services.db_service import save_lead
        
        # Hydrate variables for name/notes
        name_val = hydrate_text(config.get("name", "{{customer_name}}"), context)
        if name_val == "{{customer_name}}": name_val = context.get("customer_name") or "Unknown"
        
        notes_val = hydrate_text(config.get("notes", "Captured via Workflow {{workflow_id}}"), context)
        if "{{workflow_id}}" in notes_val: notes_val = notes_val.replace("{{workflow_id}}", str(node.workflow_id))

        trigger = context.get("trigger", {})
        contact_info = trigger.get("from_number") or trigger.get("user_id")
        
        # Merge AI extracted data if available
        ai_data = {}
        if isinstance(context.get("ai_output"), dict):
            ai_data = context.get("ai_output")
        elif isinstance(context.get("extracted_data"), dict): # Support explicit key if we add it
            ai_data = context.get("extracted_data")

        lead_data = {
            "name": name_val,
            "contact": contact_info,
            "email": ai_data.get("email") or (contact_info if "@" in (contact_info or "") else None),
            "phone": ai_data.get("phone") or (contact_info if "@" not in (contact_info or "") else None),
            "source": "workflow_automation",
            "notes": notes_val,
            "status": config.get("status", "new"),
            "tags": ai_data.get("tags", []),
            "value": ai_data.get("budget") or ai_data.get("value"),
            "custom_fields": ai_data,
            "conversation_id": trigger.get("user_id"),
            "last_interaction_at": datetime.utcnow()
        }
        
        lead_id = await save_lead(context.get("business_id", "default"), lead_data)
        return {"lead_id": lead_id, "lead_status": "captured"}

    elif node_type == "wait_for_reply":
        # Orchestration: Suspend Execution
        return {"orchestration_signal": "suspend", "resume_node_id": node.id}

    elif node_type == "appointment_booking":
        # Scheduling: Native Appointment Flow
        from services.scheduling_service import scheduling_service
        from services.ai_service import generate_response
        
        business_id = context.get("business_id", "default")
        
        # Check if we are RESUMING or STARTING
        latest_reply = context.get("latest_reply")
        pending_slots = context.get("pending_slots")
        
        if latest_reply and pending_slots:
            # --- RESUME LOGIC: Confirm Slot ---
            logger.info(f"[WorkflowEngine] Resuming Appointment Booking for BID {business_id}. Reply: {latest_reply}")
            
            # Use AI to match the reply to one of the slots
            match_prompt = f"""
            Identify which of these slots the user selected. 
            SLOTS: {json.dumps(pending_slots)}
            USER REPLY: "{latest_reply}"
            
            Return ONLY the index (0, 1, 2...) of the slot, or "none" if no match.
            """
            match_idx_str = await generate_response(match_prompt, system_instruction="You are a precise slot matcher. Return ONLY the index or 'none'.", business_id=business_id)
            
            try:
                idx = int(re.sub(r'[^\d]', '', match_idx_str))
                selected_slot = pending_slots[idx]
                
                # Book it!
                lead_id = context.get("lead_id") # If we captured lead before
                conversation_id = context.get("trigger", {}).get("user_id")
                apt_type_id = config.get("appointment_type_id")
                
                res = await scheduling_service.book_appointment(
                    business_id=business_id,
                    appointment_type_id=apt_type_id,
                    start_at=datetime.fromisoformat(selected_slot["start"]),
                    lead_id=lead_id,
                    conversation_id=conversation_id,
                    notes=f"Booked via Workflow: {node.workflow_id}"
                )
                
                if res["success"]:
                    confirmation_msg = f"Confirmed! You are booked for {selected_slot['display']}."
                    # Send confirmation
                    target_number = context.get("trigger", {}).get("from_number")
                    if target_number:
                        from services.whatsapp_service import send_whatsapp_message
                        await send_whatsapp_message(target_number, confirmation_msg)
                    else:
                        from services.db_service import store_message
                        await store_message(business_id, conversation_id, confirmation_msg, "agent", platform="web")
                    
                    return {"booking_result": "success", "appointment_id": res["appointment_id"], "booked_slot": selected_slot}
                else:
                    return {"booking_result": "failed", "error": res.get("error")}
            except:
                # No match? Ask again or fail.
                retry_msg = "I'm sorry, I didn't quite catch that. Which of those times works best for you?"
                return {"orchestration_signal": "suspend", "resume_node_id": node.id, "pending_slots": pending_slots, "ai_output": retry_msg}
        else:
            # --- START LOGIC: Propose Slots ---
            apt_type_id = config.get("appointment_type_id")
            if not apt_type_id:
                # Fallback: get first available type
                from database.models.scheduling import AppointmentType
                async with AsyncSessionLocal() as session:
                    res = await session.execute(select(AppointmentType).where(AppointmentType.business_id == business_id).limit(1))
                    apt_type = res.scalar_one_or_none()
                    apt_type_id = apt_type.id if apt_type else None
            
            if not apt_type_id:
                return {"error": "No appointment types found"}

            # --- DUPLICATE CONTROL ---
            lead_id = context.get("lead_id")
            if lead_id:
                active_apt = await scheduling_service.get_active_booking(business_id, lead_id)
                if active_apt:
                    reschedule_msg = f"I see you already have a booking for {active_apt.start_at.strftime('%A, %b %d at %I:%M %p')}. Would you like to reschedule that one or book an additional session?"
                    # Send message
                    target_number = context.get("trigger", {}).get("from_number")
                    conversation_id = context.get("trigger", {}).get("user_id")
                    if target_number:
                        from services.whatsapp_service import send_whatsapp_message
                        await send_whatsapp_message(target_number, reschedule_msg)
                    else:
                        from services.db_service import store_message
                        await store_message(business_id, conversation_id, reschedule_msg, "agent", platform="web")
                    
                    # We suspend and wait for reply, but we might need a special state to handle "reschedule" vs "additional"
                    return {
                        "orchestration_signal": "suspend",
                        "resume_node_id": node.id,
                        "booking_state": "duplicate_found",
                        "active_appointment_id": active_apt.id,
                        "ai_output": reschedule_msg
                    }

            # Get slots for next 3 days
            all_slots = []
            for i in range(3):
                target_date = (datetime.utcnow() + timedelta(days=i+1)).date()
                slots = await scheduling_service.get_available_slots(business_id, target_date, apt_type_id)
                all_slots.extend(slots)
            
            # Pick top 3
            proposed_slots = []
            for s in all_slots[:3]:
                proposed_slots.append({
                    "start": s.isoformat(),
                    "display": s.strftime("%A, %b %d at %I:%M %p")
                })
            
            if not proposed_slots:
                return {"booking_result": "no_slots", "ai_output": "I'm sorry, we don't have any available slots right now."}

            # Propose via AI
            slots_text = "\n".join([f"- {s['display']}" for s in proposed_slots])
            proposal_prompt = f"Invite the user to book an appointment. Offer these slots and ask them to pick one:\n{slots_text}"
            
            proposal_msg = await generate_response(proposal_prompt, business_id=business_id)
            
            # Send proposal
            target_number = context.get("trigger", {}).get("from_number")
            conversation_id = context.get("trigger", {}).get("user_id")
            if target_number:
                from services.whatsapp_service import send_whatsapp_message
                await send_whatsapp_message(target_number, proposal_msg)
            else:
                from services.db_service import store_message
                await store_message(business_id, conversation_id, proposal_msg, "agent", platform="web")

            return {
                "orchestration_signal": "suspend", 
                "resume_node_id": node.id, 
                "pending_slots": proposed_slots, 
                "ai_output": proposal_msg
            }

    elif node_type == "escalate_to_human":
        # Action: Switch to Human Handover
        from services.db_service import set_conversation_mode
        from services.whatsapp_service import send_whatsapp_message
        from services.db_service import store_message
        
        business_id = context.get("business_id", "default")
        user_id = context.get("trigger", {}).get("from_number") or context.get("trigger", {}).get("user_id")
        platform = context.get("trigger", {}).get("platform", "whatsapp")
        
        agent_id = config.get("agent_id")
        notification_msg = config.get("message", "You are now connected to a human agent. Please wait a moment while I transfer you.")
        
        # 1. Switch Mode in DB
        await set_conversation_mode(business_id, user_id, mode="human", agent_id=agent_id, status="waiting")
        
        # 2. Notify User
        if platform == "whatsapp" and user_id:
            await send_whatsapp_message(user_id, notification_msg, business_id=business_id)
        elif platform == "web" and user_id:
            await store_message(business_id, user_id, notification_msg, "agent", platform="web")
        
        return {"action_result": "escalated", "mode": "human", "agent_id": agent_id}

    elif node_type == "condition":
        # Condition: Evaluate Logic
        # Returns a value that Edges will match against
        variable = config.get("variable") # e.g. "ai_output" or "trigger.message_body"
        operator = config.get("operator", "contains") # equals, contains, greater_than, exists
        target_value = config.get("value")
        
        actual_value = get_context_value(context, variable)
        
        # Simple evaluation logic
        result = "false"
        
        if operator == "exists":
            if actual_value is not None and actual_value != "":
                result = "true"
                
        elif actual_value is None:
             result = "false" # Cannot compare None
             
        elif operator == "equals":
            if str(actual_value).lower() == str(target_value).lower():
                result = "true"
                
        elif operator == "contains":
            if target_value and str(target_value).lower() in str(actual_value).lower():
                result = "true"
                
        elif operator == "greater_than":
            try:
                # Clean numeric strings (remove $, commas, etc)
                def clean_num(v):
                    if isinstance(v, (int, float)): return float(v)
                    cleaned = re.sub(r'[^\d.]', '', str(v))
                    return float(cleaned) if cleaned else 0.0

                if clean_num(actual_value) > clean_num(target_value):
                    result = "true"
            except (ValueError, TypeError):
                # Fallback to string comparison? Or just fail false.
                if str(actual_value) > str(target_value):
                    result = "true"
        
        # Return the evaluated result as "condition_eval"
        return {"condition_eval": result}
        
    return {}

async def get_next_nodes(session, current_node, output):
    """
    Finds outgoing edges and checks conditions
    """
    stmt = select(WorkflowEdge).where(WorkflowEdge.source_id == current_node.id)
    result = await session.execute(stmt)
    edges = result.scalars().all()
    
    next_nodes = []
    
    for edge in edges:
        # Check condition
        if edge.condition_value:
            # If edge has a condition, check against output "condition_eval"
            eval_result = output.get("condition_eval")
            # Simple string match
            if str(eval_result) != edge.condition_value:
                continue
        
        # Load Target Node
        target = await session.get(WorkflowNode, edge.target_id)
        if target:
            next_nodes.append(target)
            
    return next_nodes
