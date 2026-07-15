import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.investigation import Investigation
from app.services.context_engine import context_engine
from app.services.timeline_engine import timeline_engine

logger = logging.getLogger("app.services.investigation_engine")

class InvestigationEngine:
    """Manages structured investigation cases and aggregates Context, Timelines, and Notes."""

    async def create_case(
        self, 
        db: AsyncSession, 
        title: str, 
        entity_identifier: str, 
        description: Optional[str] = None, 
        severity: str = "medium",
        assigned_to: Optional[str] = None
    ) -> Investigation:
        """Creates a new structured investigation case."""
        case_id = f"case_{uuid.uuid4().hex[:12]}"
        
        now = datetime.now(timezone.utc)
        note_log = [{
            "author": "System",
            "text": f"Case created for entity '{entity_identifier}' with severity level '{severity}'.",
            "timestamp": now.isoformat()
        }]

        case = Investigation(
            id=case_id,
            title=title,
            description=description,
            status="open",
            severity=severity,
            entity_identifier=entity_identifier,
            assigned_to=assigned_to,
            notes=note_log,
            created_at=now,
            updated_at=now
        )
        
        db.add(case)
        await db.commit()
        await db.refresh(case)
        logger.info(f"Created investigation case: {case.id} for {entity_identifier}")
        return case

    async def add_case_note(self, db: AsyncSession, case_id: str, author: str, text: str) -> Optional[Investigation]:
        """Appends a new notes log to the investigation case file."""
        case = await db.get(Investigation, case_id)
        if not case:
            return None

        now = datetime.now(timezone.utc)
        current_notes = list(case.notes or [])
        current_notes.append({
            "author": author,
            "text": text,
            "timestamp": now.isoformat()
        })
        
        case.notes = current_notes
        case.updated_at = now
        db.add(case)
        await db.commit()
        await db.refresh(case)
        logger.info(f"Added note to case {case_id} by {author}")
        return case

    async def update_case_status(self, db: AsyncSession, case_id: str, status: str) -> Optional[Investigation]:
        """Updates case resolution status (open, in_progress, under_review, closed)."""
        case = await db.get(Investigation, case_id)
        if not case:
            return None

        now = datetime.now(timezone.utc)
        current_notes = list(case.notes or [])
        current_notes.append({
            "author": "System",
            "text": f"Status updated from '{case.status}' to '{status}'.",
            "timestamp": now.isoformat()
        })

        case.status = status
        case.notes = current_notes
        case.updated_at = now
        db.add(case)
        await db.commit()
        await db.refresh(case)
        logger.info(f"Updated status of case {case_id} to {status}")
        return case

    async def get_case_details(self, db: AsyncSession, case_id: str) -> Optional[Dict[str, Any]]:
        """
        Compiles the complete investigation dossier including case metadata, 
        entity context, full timeline logs, and automated suggestions.
        """
        case = await db.get(Investigation, case_id)
        if not case:
            return None

        # 1. Fetch dense Entity Context
        entity_ctx = await context_engine.build_entity_context(db, case.entity_identifier)

        # 2. Fetch full chronological timeline
        timeline = await timeline_engine.get_entity_timeline(db, case.entity_identifier, include_associated=True)

        # 3. Generate automated analyst suggestions
        suggestions = [
            "Verify the validity of recent physical and digital observations log timestamps.",
            "Cross-reference associated payment history logs for fraud markers."
        ]
        
        if entity_ctx:
            risk = entity_ctx.get("risk_score", 0.0)
            if risk >= 40.0:
                suggestions.append("IMMEDIATE: Restrict all facility and system credentials linked to the target.")
                suggestions.append("IMMEDIATE: Escalate case file directly to Director of Security.")
            elif risk >= 15.0:
                suggestions.append("ACTION REQUIRED: Flag all subsequent digital transactions for manual check.")
                suggestions.append("MONITOR: Set up video alerts for physical transit zones.")

        return {
            "case_id": case.id,
            "title": case.title,
            "description": case.description,
            "status": case.status,
            "severity": case.severity,
            "entity_identifier": case.entity_identifier,
            "assigned_to": case.assigned_to,
            "notes": case.notes,
            "created_at": case.created_at.isoformat(),
            "updated_at": case.updated_at.isoformat() if case.updated_at else None,
            
            # Subsystem engine payloads
            "entity_context": entity_ctx or {},
            "timeline": timeline,
            "automated_suggestions": suggestions
        }

investigation_engine = InvestigationEngine()
