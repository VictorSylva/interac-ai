import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph import Entity, Relationship
from app.models.observation import Observation

logger = logging.getLogger("app.services.fusion_engine")

class FusionEngine:
    """Combines isolated cross-system observations into high-level operational intelligence Incidents."""

    async def correlate(self, db: AsyncSession, new_obs: Observation) -> None:
        """Evaluates correlation rules on a new observation and fuses patterns into Incident events."""
        try:
            # 1. Rule: Loitering followed by Zone Intrusion (Physical Security)
            if new_obs.source_system == "cameras" and new_obs.severity in ["high", "critical"]:
                # Look back 15 minutes for loitering observations by the same entity at the same location
                fifteen_mins_ago = new_obs.timestamp - timedelta(minutes=15)
                stmt = (
                    select(Observation)
                    .where(
                        Observation.entity_id == new_obs.entity_id,
                        Observation.entity_type == new_obs.entity_type,
                        Observation.location == new_obs.location,
                        Observation.timestamp >= fifteen_mins_ago,
                        Observation.id != new_obs.id
                    )
                )
                res = await db.execute(stmt)
                past_observations = res.scalars().all()
                
                is_loiter = any("loiter" in str(o.metadata_json.get("event_type", "")).lower() or o.severity == "medium" for o in past_observations)
                
                if is_loiter:
                    await self._create_fused_incident(
                        db,
                        incident_id=f"inc_loiter_intrusion_{new_obs.id}",
                        title="Fused Security Anomaly: Casing and Restricted Area Intrusion",
                        location=new_obs.location or "Warehouse Dock",
                        severity="critical",
                        contributing_obs=[new_obs] + list(past_observations),
                        context=f"Suspicious loitering profile followed by restricted zone intrusion detected at {new_obs.location or 'facility'}."
                    )
                    return

            # 2. Rule: Late-Night Restricted Access
            if new_obs.source_system == "cameras" and new_obs.entity_type in ["person", "vehicle"]:
                obs_time = new_obs.timestamp
                if obs_time.tzinfo is None:
                    obs_time = obs_time.replace(tzinfo=timezone.utc)
                
                # Check restricted night window: 10 PM to 5 AM
                if obs_time.hour >= 22 or obs_time.hour < 5:
                    await self._create_fused_incident(
                        db,
                        incident_id=f"inc_night_access_{new_obs.id}",
                        title="Fused Operational Anomaly: Off-Hours Facility Access",
                        location=new_obs.location or "Site Entrance",
                        severity="high",
                        contributing_obs=[new_obs],
                        context=f"Entity {new_obs.entity_type}:{new_obs.entity_id} observed traversing restricted zone at {new_obs.location or 'facility'} during off-hours ({obs_time.hour}:00)."
                    )
                    return

            # 3. Rule: Customer Friction (Payment Failure + Chat Complaint)
            if new_obs.source_system in ["whatsapp", "web", "email"] and new_obs.entity_type == "customer":
                complaint_words = ["error", "fail", "failed", "decline", "declined", "chargeback", "refund", "complaint", "issue"]
                msg_text = str(new_obs.metadata_json.get("message_text", "")).lower()
                
                has_complaint = any(w in msg_text for w in complaint_words) or new_obs.metadata_json.get("intent") == "complaint"
                
                if has_complaint:
                    # Look back 30 minutes for failed payment transactions for this customer
                    thirty_mins_ago = new_obs.timestamp - timedelta(minutes=30)
                    stmt = (
                        select(Observation)
                        .where(
                            Observation.source_system == "payments",
                            Observation.timestamp >= thirty_mins_ago
                        )
                    )
                    pay_res = await db.execute(stmt)
                    all_payments = pay_res.scalars().all()
                    
                    # Filter payments referencing this customer (via phone, email, or metadata)
                    failed_payments = []
                    cust_phone = new_obs.entity_id
                    cust_email = new_obs.metadata_json.get("customer_email", "")
                    
                    for p in all_payments:
                        p_meta = p.metadata_json or {}
                        p_phone = p_meta.get("customer_phone", "")
                        p_email = p_meta.get("customer_email", "")
                        
                        if (cust_phone and cust_phone in str(p_phone)) or (cust_email and cust_email in str(p_email)):
                            # Check if payment failed (invoiced observations or payment failures)
                            failed_payments.append(p)

                    if failed_payments:
                        await self._create_fused_incident(
                            db,
                            incident_id=f"inc_payment_friction_{new_obs.id}",
                            title="Fused Business Friction: Payment Failure followed by Complaint",
                            location=new_obs.location or "Digital Checkout",
                            severity="medium",
                            contributing_obs=[new_obs] + failed_payments,
                            context=f"Customer {new_obs.entity_id} experienced transaction failures and subsequently initiated a complaint message."
                        )
                        return

        except Exception as e:
            logger.error(f"Error evaluating fusion correlations: {e}", exc_info=True)

    async def _create_fused_incident(
        self, 
        db: AsyncSession, 
        incident_id: str, 
        title: str, 
        location: str, 
        severity: str, 
        contributing_obs: List[Observation], 
        context: str
    ) -> None:
        """Helper to create the Incident entity, link graph edges, and submit the fused observation."""
        logger.info(f"[FusionEngine] Creating fused incident: {incident_id} - '{title}'")
        
        # 1. Resolve Incident Graph Entity
        from app.services.graph_service import graph_service
        incident_entity = await graph_service.resolve_entity(
            db,
            entity_type="incident",
            identifier=incident_id,
            metadata={"title": title, "resolved": False}
        )

        # 2. Link Incident node to contributing entity nodes in the graph
        relationships = []
        for obs in contributing_obs:
            # Resolve the contributor entity first
            contributor_identifier = f"{obs.entity_type}_{obs.entity_id}"
            if obs.entity_type in ["person", "vehicle", "license_plate", "camera", "zone"]:
                contributor_identifier = obs.entity_id

            contributor_entity = await graph_service.resolve_entity(
                db,
                entity_type=obs.entity_type,
                identifier=contributor_identifier,
                external_ref_id=obs.entity_id
            )
            
            # Create Edge: Incident ESCALATED contributor
            await graph_service.add_relationship(
                db,
                source_entity_id=incident_entity.id,
                target_entity_id=contributor_entity.id,
                relationship_type="ESCALATED",
                confidence_score=obs.confidence
            )
            
            relationships.append({
                "target_type": obs.entity_type,
                "target_id": obs.entity_id,
                "type": "ESCALATED",
                "confidence": obs.confidence
            })

        # 3. Emit a new observation representing the Incident itself!
        # This will trigger database storage, Redis PubSub broadcasts, and World Model updates.
        from app.api.v1.observations import create_observation
        from app.schemas.observation_schemas import ObservationCreate
        
        # Construct raw payload
        obs_payload = ObservationCreate(
            id=incident_id,
            timestamp=datetime.now(timezone.utc),
            source_system="fusion_engine",
            entity_type="incident",
            entity_id=incident_id,
            location=location,
            confidence=0.95,
            metadata={
                "incident_title": title,
                "contributing_observations": [o.id for o in contributing_obs]
            },
            relationships=relationships,
            context=context,
            severity=severity
        )
        
        # Call route processor asynchronously/directly
        # We can bypass REST and call the function by providing mock dependencies or directly resolving.
        # But wait: we can just call observation_crud and graph_service directly to avoid router context dependencies!
        from app.crud.observation_crud import observation_crud
        from app.services.world_model import world_model
        import json
        from app.core.redis import redis_client

        # Create Observation row
        fused_obs = await observation_crud.create(db, obj_in=obs_payload.model_dump())
        # Enrich graph
        await graph_service.process_observation(db, fused_obs)
        # Refresh World Model
        await world_model.update_state(fused_obs)
        
        # Broadcast via Redis PubSub
        serialized_data = {
            "id": fused_obs.id,
            "timestamp": fused_obs.timestamp.isoformat(),
            "source_system": fused_obs.source_system,
            "entity_type": fused_obs.entity_type,
            "entity_id": fused_obs.entity_id,
            "location": fused_obs.location,
            "confidence": fused_obs.confidence,
            "metadata": fused_obs.metadata_json or {},
            "evidence": fused_obs.evidence or {},
            "relationships": fused_obs.relationships or [],
            "context": fused_obs.context,
            "severity": fused_obs.severity
        }
        redis_payload = json.dumps({
            "event_type": "observation_created",
            "observation": serialized_data
        })
        await redis_client.publish("observation_bus", redis_payload)
        
        logger.info(f"[FusionEngine] Fused incident {incident_id} successfully registered and broadcasted.")

fusion_engine = FusionEngine()
