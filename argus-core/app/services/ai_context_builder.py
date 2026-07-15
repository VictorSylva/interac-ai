import logging
from typing import Any, Dict, List

logger = logging.getLogger("app.services.ai_context_builder")

class AIContextBuilder:
    """Formats raw Graph/Timeline context into clean markdown optimized for LLM prompts."""

    def build_markdown_context(self, entity_context: Dict[str, Any], timeline: List[Dict[str, Any]]) -> str:
        """Converts raw entity dict data and timelines into a markdown dossier."""
        
        ident = entity_context.get("entity_identifier", "Unknown")
        etype = entity_context.get("entity_type", "unknown").upper()
        risk = entity_context.get("risk_score", 0.0)
        status = entity_context.get("status", "active").upper()
        loc = entity_context.get("current_location", "Unknown / Off-site")

        md = []
        md.append(f"# ARGUS OS OPERATIONAL PROFILE: {etype} - {ident}")
        md.append(f"**Current Status:** {status} | **Aggregate Risk Score:** {risk}/100 | **Last Known Location:** {loc}\n")

        # 1. Format Risk Vector
        md.append("## 📊 MULTI-DIMENSIONAL RISK VECTOR")
        vector = {}
        # Try to locate the vector in the context (usually in risk_history or entity_context metadata)
        history = entity_context.get("risk_history", [])
        if history:
            vector = history[0].get("vector", {})
            
        if not vector:
            # Fallback mock/default vector matching the dimensions
            vector = {"physical": 0.0, "operational": 0.0, "financial": 0.0, "behavioral": 0.0, "fraud": 0.0, "compliance": 0.0, "cyber": 0.0, "safety": 0.0}
            # Try to populate from risk score
            vector["physical"] = risk

        md.append("| Risk Dimension | Score |")
        md.append("| :--- | :--- |")
        for k, v in vector.items():
            md.append(f"| {k.capitalize()} Risk | {v:.2f} |")
        md.append("")

        # 2. Format Graph Relationships
        md.append("## 🕸️ GRAPH RELATIONSHIPS (Guilt-by-Association Scope)")
        rels = entity_context.get("known_relationships", [])
        if rels:
            for r in rels:
                if "target_identifier" in r:
                    md.append(f"*   `{ident}` --[{r['relationship']}]--> `{r['target_type']}:{r['target_identifier']}` (Confidence: {r['confidence']:.2f})")
                else:
                    md.append(f"*   `{r['source_type']}:{r['source_identifier']}` --[{r['relationship']}]--> `{ident}` (Confidence: {r['confidence']:.2f})")
        else:
            md.append("*No active relationship edges registered in the knowledge graph.*")
        md.append("")

        # 3. Format Unified Timeline
        md.append("## ⏳ CHRONOLOGICAL TIMELINE (Fused Audit Trail)")
        if timeline:
            md.append("| Timestamp | Source | Scope | Location | Severity | Description |")
            md.append("| :--- | :--- | :--- | :--- | :--- | :--- |")
            for item in timeline[:30]:  # Limit to 30 events in the prompt to prevent context overflow
                time_str = item.get("timestamp", "").split(".")[0].replace("T", " ")
                md.append(
                    f"| {time_str} | {item.get('source_system')} | {item.get('relationship_scope')} | "
                    f"{item.get('location')} | {item.get('severity')} | {item.get('description')} |"
                )
        else:
            md.append("*No chronological telemetry events recorded.*")
        md.append("")

        # 4. Recommended Actions
        md.append("## 🚦 SYSTEM RECOMMENDED ACTIONS")
        actions = entity_context.get("recommended_actions", [])
        if actions:
            for a in actions:
                md.append(f"*   **[RECOMMENDED]** {a}")
        else:
            md.append("*No automated actions proposed. Monitor normal baselines.*")

        return "\n".join(md)

ai_context_builder = AIContextBuilder()
