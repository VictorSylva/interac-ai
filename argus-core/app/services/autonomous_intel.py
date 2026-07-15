import logging
from datetime import datetime, timezone
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph import Entity
from app.models.investigation import Investigation
from app.services.investigation_engine import investigation_engine

logger = logging.getLogger("app.services.autonomous_intel")

class AutonomousIntel:
    """Continuous reactive intelligence monitoring. Evaluates risks and initiates actions autonomously."""

    async def evaluate_entity_state(self, db: AsyncSession, entity: Entity) -> None:
        """
        Scans an entity's risk metrics. Autonomously opens investigation cases
        and logs alerts if risk scores cross high safety thresholds.
        """
        try:
            # 1. Trigger threshold: aggregate risk score >= 40.0
            if entity.risk_score >= 40.0:
                logger.info(f"[AutonomousIntel] Elevated risk detected for {entity.entity_type}:{entity.entity_identifier} (Risk: {entity.risk_score})")
                
                # Check if there is already an active case under investigation for this entity
                stmt = select(Investigation).where(
                    and_(
                        Investigation.entity_identifier == entity.entity_identifier,
                        Investigation.status != "closed"
                    )
                )
                res = await db.execute(stmt)
                existing_case = res.scalars().first()

                if existing_case:
                    logger.info(f"[AutonomousIntel] Active case {existing_case.id} already exists for {entity.entity_identifier}. Skipping creation.")
                    
                    # Log an update note inside the active case file
                    now = datetime.now(timezone.utc)
                    vector = entity.metadata_json.get("risk_vector", {})
                    await investigation_engine.add_case_note(
                        db,
                        case_id=existing_case.id,
                        author="Argus Autopilot",
                        text=f"Risk score remains elevated at {entity.risk_score}. Vector details: {vector}"
                    )
                else:
                    # 2. Autonomously open a new investigation case dossier!
                    case_title = f"Autonomous Escalation: High Risk - {entity.entity_type.capitalize()} ({entity.entity_identifier})"
                    vector = entity.metadata_json.get("risk_vector", {})
                    case_desc = (
                        f"This case was autonomously opened by ARGUS OS because the entity's aggregate risk score "
                        f"crossed the safety threshold of 40.0 and reached {entity.risk_score}/100.\n\n"
                        f"Current Risk Vector breakdown:\n"
                        f"- Physical Risk: {vector.get('physical', 0.0)}\n"
                        f"- Operational Risk: {vector.get('operational', 0.0)}\n"
                        f"- Financial Risk: {vector.get('financial', 0.0)}\n"
                        f"- Behavioral Risk: {vector.get('behavioral', 0.0)}\n"
                        f"- Fraud Risk: {vector.get('fraud', 0.0)}\n"
                        f"- Safety Risk: {vector.get('safety', 0.0)}"
                    )
                    
                    case_severity = "critical" if entity.risk_score >= 60.0 else "high"
                    
                    # Create the case autonomously
                    case = await investigation_engine.create_case(
                        db,
                        title=case_title,
                        entity_identifier=entity.entity_identifier,
                        description=case_desc,
                        severity=case_severity,
                        assigned_to="argus_autopilot"
                    )
                    
                    logger.warning(f"[AutonomousIntel] Autonomously created case {case.id} for {entity.entity_identifier}")

                    # 3. Emit a new observation describing this autonomous action
                    from app.crud.observation_crud import observation_crud
                    from app.schemas.observation_schemas import ObservationCreate
                    from app.services.world_model import world_model
                    import json
                    from app.core.redis import redis_client

                    obs_id = f"obs_auto_case_{case.id}"
                    obs_payload = ObservationCreate(
                        id=obs_id,
                        timestamp=datetime.now(timezone.utc),
                        source_system="autonomous_intel",
                        entity_type="incident",
                        entity_id=obs_id,
                        location="World Model Engine",
                        confidence=1.0,
                        metadata={
                            "triggered_by_entity": entity.entity_identifier,
                            "risk_score": entity.risk_score,
                            "case_id": case.id
                        },
                        relationships=[{
                            "target_type": entity.entity_type,
                            "target_id": entity.external_ref_id or entity.entity_identifier,
                            "type": "INVESTIGATED",
                            "confidence": 1.0
                        }],
                        context=f"Autonomously opened case {case.id} due to aggregate risk score {entity.risk_score} on {entity.entity_type}:{entity.entity_identifier}.",
                        severity="high"
                    )

                    fused_obs = await observation_crud.create(db, obj_in=obs_payload.model_dump())
                    await world_model.update_state(fused_obs)
                    
                    # Broadcast case trigger to Redis
                    redis_payload = json.dumps({
                        "event_type": "autonomous_case_created",
                        "case_id": case.id,
                        "entity_identifier": entity.entity_identifier,
                        "risk_score": entity.risk_score
                    })
                    await redis_client.publish("observation_bus", redis_payload)

        except Exception as e:
            logger.error(f"Error evaluating autonomous intelligence triggers: {e}", exc_info=True)

autonomous_intel = AutonomousIntel()
