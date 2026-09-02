import logging
import json
import re
import httpx
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.services.context_engine import context_engine
from app.services.timeline_engine import timeline_engine
from app.services.world_model import world_model
from app.services.investigation_engine import investigation_engine

logger = logging.getLogger("app.services.copilot_engine")

class CopilotEngine:
    """ReAct (Reasoning and Action) Loop Planner for autonomous analyst investigations."""

    SYSTEM_PROMPT = """You are the ARGUS OS Copilot, an autonomous AI security and business intelligence analyst.
Your objective is to investigate the user's operational query, analyze the facts, and output a detailed dossier report.

You have access to the following tools. Use them to gather evidence step-by-step:
1. query_graph(entity_identifier: str) -> dict: Retrieves graph relationships, locations, and risk vectors.
2. query_timeline(entity_identifier: str) -> list: Retrieves chronological activity timeline events.
3. query_world_model() -> dict: Retrieves active incidents, occupant locations, and camera statuses.
4. add_investigation_note(case_id: str, note_text: str) -> dict: Writes analyst notes back to the investigation file.
5. update_case_status(case_id: str, status: str) -> dict: Sets status to open, in_progress, under_review, or closed.
6. query_graph_stats() -> dict: Retrieves the total count of all entities and relationships grouped by type in the database.
7. search_entities(entity_type: str) -> list: Searches and lists all graph entities of a specific type (e.g. "customer", "lead", "employee", "invoice").
8. execute_db_query(sql_query: str) -> list: Executes a read-only SQL SELECT statement on the PostgreSQL database to retrieve live metrics, business records, or surveillance configurations. Only SELECT statements are permitted.

Database Schema Guide:
- businesses (id, name, created_at)
- payment_transactions (id, business_id, reference, amount, currency, status, created_at)
- subscriptions (id, business_id, plan_id, status, start_date, end_date)
- conversations (id, business_id, customer_phone, summary, created_at)
- leads (id, business_id, name, phone, email, status, created_at)
- cameras (id, name, rtsp_url, location, status)
- security_alerts (id, camera_id, event_type, severity, timestamp, is_resolved)
- entities (id, entity_type, entity_identifier, risk_score, status)
- relationships (id, source_entity_id, target_entity_id, relationship_type, confidence_score)
- observations (id, source_system, entity_type, entity_id, location, confidence, severity)
- ba_sessions (id, business_id, visitor_id, referrer, utm_source, utm_medium, utm_campaign, device, browser, os, country, start_time, end_time, duration_seconds, is_bounce, page_views_count)
- ba_events (id, business_id, session_id, event_type, path, offer_id, funnel_id, element_id, element_class, element_text, properties, timestamp)
- ba_aggregates (id, business_id, date, metric_name, metric_value, dimension_name, dimension_value, created_at)

Format your responses strictly using this ReAct template:
Thought: Describe your thinking about what to do next.
Action: The action tool to execute, formatted exactly as tool_name("arguments"). Example: query_graph("customer_123")
Observation: (Wait for the system to execute the tool and provide this result)
... (Repeat Thought -> Action -> Observation as many times as necessary)
Thought: I have gathered all sufficient facts.
Final Answer: Write your complete, detailed analysis, timeline synthesis, and mitigation recommendations.

Begin your investigation. User query is: {query}"""

    async def execute_query(self, db: AsyncSession, query: str, case_id: Optional[str] = None) -> str:
        """Runs the ReAct execution loop against the configured OpenRouter LLM gateway."""
        
        # 1. Fallback for Dry-Run/Mock Mode if API key is not configured
        if not settings.OPENROUTER_API_KEY or "dummy" in settings.OPENROUTER_API_KEY:
            logger.warning("[CopilotEngine] API key missing. Running dry-run ReAct simulation.")
            return await self._simulate_dry_run(db, query, case_id)

        # Get historical context memory reference
        from app.services.memory_service import memory_service
        memory_ref = await memory_service.get_reasoning_reference(db, query)
        
        system_content = self.SYSTEM_PROMPT.format(query=query)
        if memory_ref:
            system_content += f"\n\n{memory_ref}"

        messages = [
            {"role": "user", "content": system_content}
        ]

        logger.info(f"Initiating ReAct Loop for query: '{query}'")
        
        max_iterations = 5
        iteration = 0
        
        while iteration < max_iterations:
            iteration += 1
            logger.info(f"[ReAct Loop] Iteration {iteration}/{max_iterations}")
            
            # Request LLM response
            llm_text = await self._call_llm(messages)
            logger.debug(f"[LLM Response]:\n{llm_text}")
            
            messages.append({"role": "assistant", "content": llm_text})
            
            # Check if LLM output has an Action to run
            action_match = re.search(r"Action:\s*(\w+)\((.*?)\)", llm_text, re.MULTILINE)
            
            if action_match:
                tool_name = action_match.group(1)
                tool_args_str = action_match.group(2).strip()
                
                # Normalize arguments (strip quotes)
                tool_args = [a.strip().replace('"', '').replace("'", "") for a in tool_args_str.split(",") if a.strip()]
                
                # Execute tool
                observation_result = await self._execute_tool(db, tool_name, tool_args, case_id)
                logger.info(f"[Tool Executed] {tool_name} -> Length: {len(str(observation_result))}")
                
                messages.append({"role": "user", "content": f"Observation: {json.dumps(observation_result)}"})
            else:
                # If there's no action or a Final Answer is presented, we stop
                if "Final Answer:" in llm_text:
                    final_ans = llm_text.split("Final Answer:")[-1].strip()
                    
                    # Auto-log final response on investigation notes if a case ID is provided
                    if case_id:
                        await investigation_engine.add_case_note(
                            db, case_id=case_id, author="AI Copilot", text=f"Analysis Complete: {final_ans[:1000]}..."
                        )
                    return final_ans
                
                return llm_text
                
        # Safely wrap up if loop limit reached
        final_fallback = "Investigation terminated. Max reasoning cycles reached. Please review timeline/logs manually."
        if case_id:
            await investigation_engine.add_case_note(db, case_id=case_id, author="AI Copilot", text=final_fallback)
        return final_fallback

    async def _call_llm(self, messages: List[dict]) -> str:
        """Call OpenRouter completions API."""
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": settings.OPENROUTER_MODEL,
            "messages": messages,
            "temperature": 0.1
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.error(f"Error calling LLM gateway: {e}")
                return "Thought: I encountered an API error. Final Answer: AI connection timed out."

    async def _execute_tool(self, db: AsyncSession, tool_name: str, args: List[str], case_id: Optional[str]) -> Any:
        """Executes the mapped python helper code based on parsed ReAct Actions."""
        try:
            if tool_name == "query_graph" and args:
                return await context_engine.build_entity_context(db, args[0])
                
            elif tool_name == "query_timeline" and args:
                return await timeline_engine.get_entity_timeline(db, args[0], include_associated=True)
                
            elif tool_name == "query_world_model":
                return await world_model.get_world_summary()
                
            elif tool_name == "add_investigation_note":
                target_case = args[0] if len(args) > 0 else (case_id or "unknown")
                note_text = args[1] if len(args) > 1 else "Empty note"
                res = await investigation_engine.add_case_note(db, case_id=target_case, author="AI Copilot", text=note_text)
                return {"status": "success", "case_id": target_case} if res else {"status": "failed"}
                
            elif tool_name == "update_case_status":
                target_case = args[0] if len(args) > 0 else (case_id or "unknown")
                status_val = args[1] if len(args) > 1 else "in_progress"
                res = await investigation_engine.update_case_status(db, case_id=target_case, status=status_val)
                return {"status": "success", "new_status": status_val} if res else {"status": "failed"}

            elif tool_name == "query_graph_stats":
                from sqlalchemy import func
                entity_query = select(Entity.entity_type, func.count(Entity.id)).group_by(Entity.entity_type)
                entity_res = await db.execute(entity_query)
                entity_counts = {r[0]: r[1] for r in entity_res.all()}

                rel_query = select(Relationship.relationship_type, func.count(Relationship.id)).group_by(Relationship.relationship_type)
                rel_res = await db.execute(rel_query)
                rel_counts = {r[0]: r[1] for r in rel_res.all()}

                return {
                    "entity_counts": entity_counts,
                    "relationship_counts": rel_counts
                }

            elif tool_name == "search_entities" and args:
                ent_type = args[0]
                query = select(Entity).filter(Entity.entity_type == ent_type)
                res = await db.execute(query)
                entities = res.scalars().all()
                return [
                    {
                        "id": e.id,
                        "entity_type": e.entity_type,
                        "entity_identifier": e.entity_identifier,
                        "status": e.status,
                        "risk_score": e.risk_score
                    }
                    for e in entities
                ]

            elif tool_name == "execute_db_query" and args:
                sql = args[0].strip()
                sql_upper = sql.upper()
                forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE"]
                if not sql_upper.startswith("SELECT"):
                    return {"error": "Only SELECT read operations are permitted."}
                for f in forbidden:
                    if f in sql_upper:
                        return {"error": f"Operation '{f}' is forbidden."}
                
                from sqlalchemy import text
                res = await db.execute(text(sql))
                columns = res.keys()
                rows = res.all()
                return [dict(zip(columns, row)) for row in rows][:100]
                
            else:
                return {"error": f"Tool '{tool_name}' is not recognized or arguments missing."}
        except Exception as e:
            logger.error(f"Error executing tool '{tool_name}': {e}")
            return {"error": str(e)}

    async def _simulate_dry_run(self, db: AsyncSession, query: str, case_id: Optional[str]) -> str:
        """Simulates ReAct steps locally without calling OpenRouter APIs, returning compiled dossiers."""
        logger.info("[CopilotEngine] Executing dry-run reasoning simulation...")
        
        # Extract entity pattern from query if possible (e.g. "customer_123" or similar)
        entity_match = re.search(r"(\w+_\w+)", query)
        target_entity = entity_match.group(1) if entity_match else "customer_unknown"
        
        # 1. Fetch graph context & timelines
        ctx = await context_engine.build_entity_context(db, target_entity)
        timeline = await timeline_engine.get_entity_timeline(db, target_entity, include_associated=True)
        
        # Build Markdown Context
        from app.services.ai_context_builder import ai_context_builder
        md_context = ai_context_builder.build_markdown_context(ctx or {}, timeline)
        
        # Append system note log
        if case_id:
            await investigation_engine.add_case_note(
                db, case_id=case_id, author="AI Copilot (Simulator)", text="Dry-run simulation compiled context data successfully."
            )
            
        return f"""### ARGUS AI COPILOT ANALYST DOSSIER (SIMULATED REACT RUN)

I have queried the Graph and Timeline databases to synthesize the footprint of entity: `{target_entity}`.

{md_context}

### 💡 MITIGATION SUGGESTIONS:
*   Flag associated devices.
*   Audit transaction records.
"""

copilot_engine = CopilotEngine()
