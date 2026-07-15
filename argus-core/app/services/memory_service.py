import logging
from typing import Any, Dict, List
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.investigation import Investigation

logger = logging.getLogger("app.services.memory_service")

class MemoryService:
    """Organizational Memory manager. Connects current queries to past case resolutions."""

    async def search_past_cases(self, db: AsyncSession, query_text: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Searches closed investigations for keyword matches in titles or descriptions
        to retrieve historical resolution outcomes.
        """
        logger.info(f"Searching organizational memory for context matching: '{query_text}'")
        
        # Tokenize query for multi-keyword match
        words = [w.strip().lower() for w in query_text.split() if len(w.strip()) > 2]
        if not words:
            # Fallback to general list of resolved cases if query is short
            stmt = select(Investigation).where(Investigation.status == "closed").order_by(desc(Investigation.updated_at)).limit(limit)
            res = await db.execute(stmt)
            return [self._format_memory(c) for c in res.scalars().all()]

        # Build dynamic SQL query checking closed cases matching any of the tokens
        filters = []
        for word in words:
            like_pattern = f"%{word}%"
            filters.append(Investigation.title.ilike(like_pattern))
            filters.append(Investigation.description.ilike(like_pattern))

        stmt = (
            select(Investigation)
            .where(
                and_(
                    Investigation.status == "closed",
                    or_(*filters)
                )
            )
            .order_by(desc(Investigation.updated_at))
            .limit(limit)
        )
        
        res = await db.execute(stmt)
        cases = res.scalars().all()
        
        # Fallback to recent closed cases if no direct keyword matches found
        if not cases:
            stmt_fallback = select(Investigation).where(Investigation.status == "closed").order_by(desc(Investigation.updated_at)).limit(limit)
            res_fallback = await db.execute(stmt_fallback)
            cases = res_fallback.scalars().all()

        return [self._format_memory(c) for c in cases]

    async def get_reasoning_reference(self, db: AsyncSession, query_text: str) -> str:
        """Compiles matching past cases into a markdown prompt segment for the Copilot."""
        past_cases = await self.search_past_cases(db, query_text)
        
        if not past_cases:
            return "No prior closed investigations or historical memory found for this query context."

        md = []
        md.append("### 🧠 HISTORICAL ORGANIZATIONAL MEMORY (Prior Case Resolutions)")
        md.append("These past cases match the current query profile and may guide your reasoning:\n")
        
        for case in past_cases:
            md.append(f"#### Case: {case['title']} (Severity: {case['severity'].upper()})")
            md.append(f"*   **Description:** {case['description']}")
            md.append(f"*   **Resolved Date:** {case['resolved_at']}")
            
            # Extract resolution note if present
            notes = case.get("notes", [])
            resolution_text = "Closed by analyst without explicit summary."
            if notes:
                # Find last system or analyst note
                for n in reversed(notes):
                    if "closed" in n.get("text", "").lower() or "resolution" in n.get("text", "").lower() or n.get("author") != "System":
                        resolution_text = n.get("text")
                        break
            md.append(f"*   **Resolution Action:** {resolution_text}\n")

        return "\n".join(md)

    def _format_memory(self, case: Investigation) -> Dict[str, Any]:
        """Format an investigation database row into a memory dictionary."""
        return {
            "case_id": case.id,
            "title": case.title,
            "description": case.description or "No description provided.",
            "severity": case.severity,
            "resolved_at": case.updated_at.strftime("%Y-%m-%d") if case.updated_at else case.created_at.strftime("%Y-%m-%d"),
            "notes": case.notes
        }

memory_service = MemoryService()
