"""
InteracAI Local Fallback Routes.
Implements API endpoints for Intelligence Graph, Copilot, Timeline, and Investigations,
enabling the platform to function without external Docker services during local execution.
"""

import uuid
import logging
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from database.session import get_db
from database.models.dynamic_entity import EntityType, EntityV2
from database.models.observation import ObservationV2
from services.ai_service import generate_response

logger = logging.getLogger(__name__)

router = APIRouter()


# --- 1. TOP RISKS (Graph Leaderboard) ---
@router.get("/api/v1/intelligence/top-risks", response_model=List[Dict[str, Any]])
async def get_top_risks(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve top-risk threat entities ranked by risk score."""
    stmt_entities = select(EntityV2).order_by(desc(EntityV2.risk_score)).limit(limit)
    res_entities = await db.execute(stmt_entities)
    entities = res_entities.scalars().all()
    
    stmt_types = select(EntityType)
    res_types = await db.execute(stmt_types)
    types_list = res_types.scalars().all()
    type_map = {t.id: t.code for t in types_list}
    
    result = []
    for ent in entities:
        type_code = type_map.get(ent.entity_type_id, "unknown")
        status_str = "alert" if (ent.risk_score or 0) >= 40 else "flagged" if (ent.risk_score or 0) >= 15 else "active"
        result.append({
            "id": ent.id,
            "entity_type": type_code,
            "entity_identifier": ent.display_label or ent.external_ref_id or ent.id,
            "risk_score": float(ent.risk_score or 0.0),
            "status": status_str,
            "first_seen": ent.created_at or datetime.utcnow(),
            "last_seen": ent.created_at or datetime.utcnow(),
            "created_at": ent.created_at or datetime.utcnow()
        })
    return result


# --- 2. GRAPH TOPOLOGY (ForceGraph2D) ---
@router.get("/api/v1/intelligence/graph-topology", response_model=Dict[str, Any])
async def get_graph_topology(db: AsyncSession = Depends(get_db)):
    """Retrieve node-link topology of the entity network."""
    stmt_entities = select(EntityV2)
    res_entities = await db.execute(stmt_entities)
    entities = res_entities.scalars().all()
    
    stmt_types = select(EntityType)
    res_types = await db.execute(stmt_types)
    types_list = res_types.scalars().all()
    type_map = {t.id: t.code for t in types_list}
    
    nodes = []
    nodes_set = set()
    for ent in entities:
        type_code = type_map.get(ent.entity_type_id, "unknown")
        node_size = max(5.0, min(30.0, float(ent.risk_score or 0.0) / 5.0 + 8.0))
        status_str = "alert" if (ent.risk_score or 0) >= 40 else "flagged" if (ent.risk_score or 0) >= 15 else "active"
        nodes.append({
            "id": ent.id,
            "name": ent.display_label or ent.external_ref_id or ent.id,
            "type": type_code,
            "val": node_size,
            "risk_score": float(ent.risk_score or 0.0),
            "status": status_str
        })
        nodes_set.add(ent.id)
        
    links = []
    seen_links = set()
    
    def add_link(source_id: str, target_id: str, label: str):
        if not source_id or not target_id or source_id == target_id:
            return
        link_key = (source_id, target_id, label)
        if link_key not in seen_links:
            seen_links.add(link_key)
            links.append({
                "source": source_id,
                "target": target_id,
                "label": label,
                "confidence": 1.0
            })

    # Compile linkages based on entity type attributes and linkages
    for ent in entities:
        type_code = type_map.get(ent.entity_type_id, "unknown")
        attrs = ent.attributes or {}
        
        if type_code == "hotel_reservation":
            # Link Guest to Reservation
            guest_id = attrs.get("guest_id")
            if guest_id and guest_id in nodes_set:
                add_link(guest_id, ent.id, "HAS_RESERVATION")
            
            # Link Reservation to Assigned Room
            room_number = attrs.get("room_number")
            if room_number:
                room_entity = next((r for r in entities if r.display_label == room_number or r.external_ref_id == room_number), None)
                if room_entity:
                    add_link(ent.id, room_entity.id, "ASSIGNED_ROOM")
                    
        elif type_code == "keycard_log":
            # Link Keycard Log to Room
            room_number = attrs.get("room_number")
            if room_number:
                room_entity = next((r for r in entities if r.display_label == room_number or r.external_ref_id == room_number), None)
                if room_entity:
                    add_link(ent.id, room_entity.id, "ACCESS_EVENT_AT")
                    
        elif type_code == "restaurant_order":
            # Link Restaurant Order to Invoice Folio
            folio_id = attrs.get("folio_id")
            if folio_id and folio_id in nodes_set:
                add_link(ent.id, folio_id, "CHARGED_TO_FOLIO")
            
            # Link Restaurant Order to Location/Room
            room_number = attrs.get("room_number")
            if room_number:
                room_entity = next((r for r in entities if r.display_label == room_number or r.external_ref_id == room_number), None)
                if room_entity:
                    add_link(ent.id, room_entity.id, "ORDER_PLACED_FROM")

        elif type_code == "sme_order":
            cust_id = attrs.get("customer_id")
            if cust_id and cust_id in nodes_set:
                add_link(cust_id, ent.id, "PLACED_ORDER")
            for item in attrs.get("items", []):
                p_id = item.get("product_id") or item.get("id")
                if p_id and p_id in nodes_set:
                    add_link(ent.id, p_id, "CONTAINS_PRODUCT")

        elif type_code == "sme_appointment":
            cust_id = attrs.get("customer_id")
            if cust_id and cust_id in nodes_set:
                add_link(cust_id, ent.id, "BOOKED_APPOINTMENT")
            svc_id = attrs.get("service_id")
            if svc_id and svc_id in nodes_set:
                add_link(ent.id, svc_id, "FOR_SERVICE")

        elif type_code == "sme_purchase_order":
            sup_id = attrs.get("supplier_id")
            if sup_id and sup_id in nodes_set:
                add_link(sup_id, ent.id, "FULFILLS_PO")

        elif type_code == "sme_project_task":
            prj_id = attrs.get("project_id")
            if prj_id and prj_id in nodes_set:
                add_link(prj_id, ent.id, "HAS_TASK")

        elif type_code == "sme_invoice":
            cust_id = attrs.get("customer_id")
            if cust_id and cust_id in nodes_set:
                add_link(cust_id, ent.id, "BILLED_TO")
                    
    return {"nodes": nodes, "links": links}


# --- 3. TIMELINE (Incident Timeline) ---
@router.get("/api/v2/timeline/{entity_id}", response_model=List[Dict[str, Any]])
async def get_timeline(
    entity_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve chronological timeline for an entity."""
    stmt = select(EntityV2).where(
        (EntityV2.id == entity_id) | 
        (EntityV2.display_label == entity_id) | 
        (EntityV2.external_ref_id == entity_id)
    ).order_by(desc(EntityV2.created_at))
    res = await db.execute(stmt)
    entity = res.scalars().first()
    
    target_ids = [entity_id]
    if entity:
        target_ids.append(entity.id)
        
    stmt_obs = select(ObservationV2).where(
        (ObservationV2.primary_entity_id.in_(target_ids)) |
        (ObservationV2.location_label == entity_id)
    ).order_by(desc(ObservationV2.created_at))
    res_obs = await db.execute(stmt_obs)
    observations = res_obs.scalars().all()
    
    timeline = []
    for obs in observations:
        desc_text = obs.payload.get("description") or obs.payload.get("message")
        if not desc_text:
            desc_text = f"Observation '{obs.observation_type}' recorded from '{obs.source_channel}'"
            
        timeline.append({
            "timestamp": obs.created_at.isoformat() if obs.created_at else datetime.utcnow().isoformat(),
            "observation_id": obs.id,
            "source_system": obs.source_channel,
            "entity_type": obs.observation_type,
            "entity_id": obs.primary_entity_id,
            "relationship_scope": "primary" if obs.primary_entity_id in target_ids else "associated",
            "location": obs.location_label or "Unknown / Virtual",
            "severity": obs.severity,
            "confidence": obs.confidence,
            "description": desc_text,
            "metadata": obs.payload,
            "evidence": {}
        })
    return timeline


# --- 4. CO-PILOT CHAT REASONING ---
@router.post("/api/v2/copilot/query", response_model=Dict[str, Any])
async def query_copilot(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Fallback Copilot Chat leveraging local system entities, logs, and AI Service."""
    query_text = payload.get("query", "")
    case_id = payload.get("case_id")
    
    # 1. Fetch live system entities
    stmt_entities = select(EntityV2)
    res_entities = await db.execute(stmt_entities)
    entities = res_entities.scalars().all()
    
    stmt_types = select(EntityType)
    res_types = await db.execute(stmt_types)
    types_list = res_types.scalars().all()
    type_map = {t.id: t.code for t in types_list}
    
    # 2. Fetch recent logs
    stmt_obs = select(ObservationV2).order_by(desc(ObservationV2.created_at)).limit(30)
    res_obs = await db.execute(stmt_obs)
    observations = res_obs.scalars().all()

    # 2.1 Fetch active chat conversations
    from database.models.chat import Conversation, Message
    stmt_conv = select(Conversation).order_by(desc(Conversation.last_timestamp)).limit(30)
    res_conv = await db.execute(stmt_conv)
    chat_convs = res_conv.scalars().all()
    
    # 2.2 Fetch recent messages
    stmt_msg = select(Message).order_by(desc(Message.timestamp)).limit(50)
    res_msg = await db.execute(stmt_msg)
    chat_msgs = res_msg.scalars().all()

    # 2.3 Fetch behavioral analytics (pageviews, visitor sessions, navigation paths, bounce rates, etc.)
    from database.models.behavior_analytics import BASession, BAEvent
    from sqlalchemy import func

    # Pageview counts grouped by path
    stmt_pageviews = (
        select(BAEvent.path, func.count(BAEvent.id))
        .where(BAEvent.event_type == "pageview")
        .group_by(BAEvent.path)
        .order_by(desc(func.count(BAEvent.id)))
        .limit(15)
    )
    res_pageviews = await db.execute(stmt_pageviews)
    top_pages_list = res_pageviews.all()
    
    # Click counts grouped by element text
    stmt_clicks = (
        select(BAEvent.element_text, func.count(BAEvent.id))
        .where(BAEvent.event_type == "click")
        .group_by(BAEvent.element_text)
        .order_by(desc(func.count(BAEvent.id)))
        .limit(15)
    )
    res_clicks = await db.execute(stmt_clicks)
    top_clicks_list = res_clicks.all()
    
    # Aggregated totals
    stmt_summary_pv = select(func.count(BAEvent.id)).where(BAEvent.event_type == "pageview")
    res_summary_pv = await db.execute(stmt_summary_pv)
    total_pageviews_count = res_summary_pv.scalar() or 0
    
    stmt_summary_sess = select(func.count(BASession.id))
    res_summary_sess = await db.execute(stmt_summary_sess)
    total_sessions_count = res_summary_sess.scalar() or 0

    stmt_unique_visitors = select(func.count(func.distinct(BASession.visitor_id)))
    res_unique_visitors = await db.execute(stmt_unique_visitors)
    unique_visitors_count = res_unique_visitors.scalar() or 0

    # Calculate Bounce Rate
    stmt_bounce_sessions = select(func.count(BASession.id)).where(BASession.is_bounce == True)
    res_bounce_sessions = await db.execute(stmt_bounce_sessions)
    bounce_sessions_count = res_bounce_sessions.scalar() or 0
    bounce_rate = (bounce_sessions_count / total_sessions_count * 100) if total_sessions_count > 0 else 0.0

    # Navigation sequences/paths
    stmt_recent_events = (
        select(BAEvent.session_id, BAEvent.path)
        .where(BAEvent.event_type == "pageview")
        .order_by(BAEvent.session_id, BAEvent.timestamp.asc())
        .limit(200)
    )
    res_recent_events = await db.execute(stmt_recent_events)
    recent_events_rows = res_recent_events.all()
    
    sessions_map = {}
    for sid, path in recent_events_rows:
        if sid not in sessions_map:
            sessions_map[sid] = []
        if not sessions_map[sid] or sessions_map[sid][-1] != path:
            sessions_map[sid].append(path)
            
    sequences = {}
    for sid, paths in sessions_map.items():
        if len(paths) >= 2:
            for i in range(len(paths) - 1):
                seq = f"{paths[i]} -> {paths[i+1]}"
                sequences[seq] = sequences.get(seq, 0) + 1
    top_sequences = sorted(sequences.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # 3. Build live context
    context_lines = [
        "### SYSTEM STATUS & ENVIRONMENT",
        "The following is a list of registered entities in the system database:"
    ]
    for ent in entities:
        t_code = type_map.get(ent.entity_type_id, "unknown")
        attrs_str = json.dumps(ent.attributes or {})
        context_lines.append(f"- ID: `{ent.id}` | Type: `{t_code}` | Label: `{ent.display_label}` | Risk Score: {ent.risk_score} | Attributes: {attrs_str}")
        
    context_lines.append("\nThe following is the chronological log of recent observations/events:")
    for obs in observations:
        t_str = obs.created_at.isoformat() if obs.created_at else "unknown"
        payload_str = json.dumps(obs.payload or {})
        context_lines.append(f"- [{t_str}] Channel: `{obs.source_channel}` | Event Type: `{obs.observation_type}` | Severity: `{obs.severity}` | Target Entity: `{obs.primary_entity_id}` | Details: {payload_str}")

    context_lines.append("\nThe following is a list of active chat conversations in the CRM inbox:")
    for c in chat_convs:
        context_lines.append(f"- Convo ID: `{c.id}` | Guest: `{c.customer_name}` | Platform: `{c.platform}` | Mode: `{c.mode}` | Status: `{c.status}` | Last Message: `{c.last_message}` | Last Intent: `{c.last_intent}` | Sentiment: `{c.last_sentiment}`")
        
    context_lines.append("\nThe following is the chronological log of recent chat messages:")
    for m in chat_msgs:
        t_msg = m.timestamp.isoformat() if m.timestamp else "unknown"
        context_lines.append(f"- [{t_msg}] Convo ID: `{m.conversation_id}` | Sender: `{m.sender}` | Message: \"{m.text}\" | Intent: `{m.intent}` | Sentiment: `{m.sentiment}`")

    # 3.1 Website visitor analytics context injection
    context_lines.append("\n### WEBSITE VISITOR BEHAVIORAL ANALYTICS & PAGE VIEWS")
    context_lines.append(f"These are the web page view counts, visitor metrics, click interactions, bounce rates, and navigation sequences recorded in the SQLite database:")
    context_lines.append(f"- Total Page Views (All Time): {total_pageviews_count}")
    context_lines.append(f"- Total Visitor Sessions (All Time): {total_sessions_count}")
    context_lines.append(f"- Unique Web Visitors (All Time): {unique_visitors_count}")
    context_lines.append(f"- Bounce Rate: {bounce_rate:.1f}% ({bounce_sessions_count} bounce sessions out of {total_sessions_count} total sessions)")
    
    context_lines.append("\nTop Visited Web Pages / Path Counts:")
    for path, count in top_pages_list:
        context_lines.append(f"- Page Path: `{path}` | Total Pageviews: {count}")
        
    context_lines.append("\nTop Clicked Web Page Elements / Buttons:")
    for el_text, count in top_clicks_list:
        if el_text:
            context_lines.append(f"- Button/Link Text: \"{el_text}\" | Click Count: {count}")
            
    context_lines.append("\nTop Web Journey Sequences / Navigation Paths:")
    for seq, count in top_sequences:
        context_lines.append(f"- Transition Flow: `{seq}` | Count: {count}")
        
    prompt = f"""You are the ARGUS OS Copilot, an autonomous AI security and operations analyst.
    
Here is the current live system context from the SQLite database:
{chr(10).join(context_lines)}

User Operational Query: {query_text}

Based on the provided live system context and logs, formulate a comprehensive, detailed, and clear response to the query. 
- If the query asks for counts or status (e.g. number of guests, checkout status, reservation details), compute them exactly using the context lists.
- If there are active anomalies (e.g., keycard access events at unauthorized times, check-out mismatches, high risk scores), synthesize them.
- Format your response beautifully using markdown with clear headings.
"""

    try:
        response_text = await generate_response(
            user_message=prompt,
            user_id="copilot_user",
            system_instruction="You are the ARGUS OS Copilot. Give professional, insightful, and helpful security/operations dossiers."
        )
        
        # Log final response on investigation notes if case_id is provided
        if case_id:
            await db.execute(text("""
                INSERT INTO investigation_notes (case_id, author, text)
                VALUES (:case_id, 'AI Copilot', :text)
            """), {"case_id": case_id, "text": f"Dossier compiled: {response_text[:500]}..."})
            await db.commit()
            
        return {"status": "success", "analysis": response_text}
    except Exception as e:
        logger.error(f"Fallback copilot reasoning failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Copilot reasoning failed: {str(e)}"
        )


# --- 5. INVESTIGATION CASES (Investigations Workspace) ---
@router.post("/api/v2/investigations", status_code=status.HTTP_201_CREATED)
async def create_case(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Open a new local investigation case."""
    case_id = f"case_{uuid.uuid4().hex[:16]}"
    title = payload.get("title", "New Case")
    ent_id = payload.get("entity_identifier", "")
    desc = payload.get("description", "")
    sev = payload.get("severity", "medium")
    assign = payload.get("assigned_to", "unassigned")
    
    try:
        await db.execute(text("""
            INSERT INTO investigations (id, title, entity_identifier, description, severity, status, assigned_to)
            VALUES (:id, :title, :ent, :desc, :sev, 'open', :assign)
        """), {"id": case_id, "title": title, "ent": ent_id, "desc": desc, "sev": sev, "assign": assign})
        await db.commit()
        return {"status": "created", "case_id": case_id}
    except Exception as e:
        logger.error(f"Failed to create local case: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/v2/investigations", response_model=List[Dict[str, Any]])
async def list_cases(db: AsyncSession = Depends(get_db)):
    """List open and closed investigation cases."""
    try:
        res = await db.execute(text("SELECT id, title, entity_identifier, status, severity, assigned_to, created_at FROM investigations ORDER BY created_at DESC"))
        cases = res.fetchall()
        return [
            {
                "case_id": c[0],
                "title": c[1],
                "entity_identifier": c[2],
                "status": c[3],
                "severity": c[4],
                "assigned_to": c[5],
                "created_at": c[6].isoformat() if hasattr(c[6], "isoformat") else str(c[6])
            } for c in cases
        ]
    except Exception as e:
        logger.error(f"Failed to list cases: {e}")
        return []


@router.get("/api/v2/investigations/{case_id}", response_model=Dict[str, Any])
async def get_case_dossier(
    case_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve the full compiled dossier for a case."""
    try:
        res = await db.execute(text("SELECT id, title, entity_identifier, description, severity, status, assigned_to, created_at FROM investigations WHERE id = :id"), {"id": case_id})
        case = res.fetchone()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
            
        res_notes = await db.execute(text("SELECT author, text, created_at FROM investigation_notes WHERE case_id = :id ORDER BY created_at ASC"), {"id": case_id})
        notes = res_notes.fetchall()
        
        timeline = await get_timeline(entity_id=case[2], db=db)
        
        return {
            "case": {
                "id": case[0],
                "title": case[1],
                "entity_identifier": case[2],
                "description": case[3],
                "severity": case[4],
                "status": case[5],
                "assigned_to": case[6],
                "created_at": case[7].isoformat() if hasattr(case[7], "isoformat") else str(case[7])
            },
            "notes": [
                {
                    "author": n[0],
                    "text": n[1],
                    "created_at": n[2].isoformat() if hasattr(n[2], "isoformat") else str(n[2])
                } for n in notes
            ],
            "timeline": timeline,
            "suggestions": [
                "Verify guest check-in / check-out matching timeline",
                "Audit all keycard entries at the time of access",
                "Review camera stream at check-in counter"
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get dossier: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/v2/investigations/{case_id}/note")
async def add_case_note(
    case_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Add note to local investigation case."""
    author = payload.get("author", "Analyst")
    text_content = payload.get("text", "")
    try:
        await db.execute(text("""
            INSERT INTO investigation_notes (case_id, author, text)
            VALUES (:case_id, :author, :text)
        """), {"case_id": case_id, "author": author, "text": text_content})
        await db.commit()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to add note: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/v2/investigations/{case_id}/status")
async def update_case_status(
    case_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Update local investigation case status."""
    status_val = payload.get("status", "open")
    try:
        await db.execute(text("""
            UPDATE investigations SET status = :status WHERE id = :id
        """), {"status": status_val, "id": case_id})
        await db.commit()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to update status: {e}")
        raise HTTPException(status_code=400, detail=str(e))
