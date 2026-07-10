import logging
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from database.session import AsyncSessionLocal
from database.models.crm import Lead, LeadActivity
from services.ai_service import generate_response
import json

logger = logging.getLogger(__name__)

class SalesIntelligenceService:
    async def get_ai_insights(self, business_id: str):
        """
        Generates sales intelligence insights: stalled leads and funnel drop-offs.
        """
        async with AsyncSessionLocal() as session:
            try:
                now = datetime.utcnow()
                stalled_threshold = now - timedelta(hours=48)
                start_date = now - timedelta(days=7)
                
                # 1. Identify Stalled Leads
                stmt = select(Lead).where(
                    Lead.business_id == business_id,
                    Lead.status.in_(["contacted", "qualified"]),
                    Lead.last_interaction_at < stalled_threshold
                ).limit(5)
                
                res = await session.execute(stmt)
                stalled_leads = res.scalars().all()
                
                lead_insights = []
                for lead in stalled_leads:
                    recommendation = await self._generate_lead_recommendation(lead, business_id)
                    lead_insights.append({
                        "lead_id": lead.id,
                        "lead_name": lead.name,
                        "status": lead.status,
                        "last_interaction": lead.last_interaction_at.isoformat() if lead.last_interaction_at else None,
                        "recommendation": recommendation
                    })

                # 2. Identify Funnel Drop-offs
                from database.models.behavior_analytics import BASession, BAEvent
                from sqlalchemy import text
                
                journey_stmt = select(BASession.id, BAEvent.path).join(BAEvent).where(
                    BAEvent.business_id == business_id, BAEvent.event_type == "pageview", BAEvent.timestamp >= start_date
                ).order_by(BASession.id, BAEvent.timestamp)
                rows = (await session.execute(journey_stmt)).all()
                
                sessions_map = {}
                for sid, path in rows:
                    if sid not in sessions_map: sessions_map[sid] = []
                    if not sessions_map[sid] or sessions_map[sid][-1] != path:
                        sessions_map[sid].append(path)
                
                dropoffs = {}
                for paths in sessions_map.values():
                    if paths:
                        last_path = paths[-1]
                        dropoffs[last_path] = dropoffs.get(last_path, 0) + 1
                
                top_dropoffs = sorted([{"path": k, "count": v} for k, v in dropoffs.items()], key=lambda x: x["count"], reverse=True)[:3]
                
                funnel_insights = []
                for d in top_dropoffs:
                    rec = await self._generate_funnel_recommendation(d["path"], d["count"], business_id)
                    funnel_insights.append({
                        "path": d["path"],
                        "drop_count": d["count"],
                        "recommendation": rec
                    })
                
                return {
                    "stalled_leads_count": len(stalled_leads),
                    "insights": lead_insights,
                    "funnel_insights": funnel_insights
                }
            except Exception as e:
                logger.error(f"Error generating AI insights: {e}")
                return {"stalled_leads_count": 0, "insights": [], "funnel_insights": []}

    async def _generate_lead_recommendation(self, lead: Lead, business_id: str):
        """
        Uses AI to suggest a specific follow-up based on lead context.
        """
        prompt = f"""
        Analyze this stalled lead and recommend a specific follow-up action.
        NAME: {lead.name}
        STATUS: {lead.status}
        NOTES: {lead.notes or 'No notes available'}
        VALUE: ${lead.value or 'Unknown'}
        
        Keep the recommendation concise (max 2 sentences). Focus on converting them to the next stage.
        """
        
        try:
            target_recommendation = await generate_response(
                prompt, 
                system_instruction="You are a senior sales strategist. Provide actionable, high-conversion follow-up advice.",
                business_id=business_id
            )
            return target_recommendation.strip()
        except:
            return "Re-engage with a personalized message to check if they have any remaining questions."

    async def _generate_funnel_recommendation(self, path: str, count: int, business_id: str):
        """
        Uses AI to suggest improvements for a specific drop-off point.
        """
        prompt = f"""
        Analyze this funnel bottleneck and suggest one specific optimization.
        PATH: {path}
        DROP-OFF COUNT: {count}
        
        Suggest a specific UI or content change to reduce friction at this stage. (Max 2 sentences)
        """
        try:
            rec = await generate_response(
                prompt,
                system_instruction="You are a conversion rate optimization (CRO) expert.",
                business_id=business_id
            )
            return rec.strip()
        except:
            return "Analyze the content for clarity and ensure the call-to-action is prominently displayed."

sales_intelligence_service = SalesIntelligenceService()
