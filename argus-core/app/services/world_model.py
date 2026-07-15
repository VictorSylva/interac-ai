import json
import logging
from typing import Optional
from datetime import datetime, timezone
from app.models.observation import Observation
from app.core.redis import redis_client

logger = logging.getLogger("app.services.world_model")

class WorldModel:
    """Real-time cached operational model of reality."""

    async def update_state(self, obs: Observation) -> None:
        """Updates the cached operational state based on a new observation."""
        try:
            entity_key = f"{obs.entity_type}:{obs.entity_id}"
            
            # 1. Update last known location and facility occupancy tracking
            if obs.location:
                # Get previous location for the entity to manage occupancy transitions
                prev_loc = await redis_client.hget("world_model:entity_locations", entity_key)
                
                # Update location hash
                await redis_client.hset("world_model:entity_locations", entity_key, obs.location)
                
                # If tracking a physical moving entity, adjust occupants
                if obs.entity_type in ["person", "vehicle", "customer", "employee"]:
                    # Remove from old facility set if transitioned
                    if prev_loc and prev_loc != obs.location:
                        old_loc_key = f"world_model:facility_occupancy:{prev_loc.lower().replace(' ', '_')}"
                        await redis_client.srem(old_loc_key, entity_key)
                        
                    # Add to new facility set
                    new_loc_key = f"world_model:facility_occupancy:{obs.location.lower().replace(' ', '_')}"
                    await redis_client.sadd(new_loc_key, entity_key)
                    # Set occupancy expiry (e.g. 12 hours) in case entities loiter permanently
                    await redis_client.expire(new_loc_key, 43200)

            # 2. Track Active Incidents (High/Critical Severity alerts)
            if obs.severity in ["high", "critical"]:
                incident_payload = {
                    "id": obs.id,
                    "timestamp": obs.timestamp.isoformat(),
                    "source": obs.source_system,
                    "entity": entity_key,
                    "location": obs.location or "Unknown",
                    "context": obs.context or f"Severity alert on {entity_key}"
                }
                await redis_client.hset("world_model:active_incidents", obs.id, json.dumps(incident_payload))
                logger.info(f"[WorldModel] Registered active incident: {obs.id}")

            # 3. Track Camera Status
            if obs.entity_type == "camera":
                status = obs.metadata_json.get("status", "online") if obs.metadata_json else "online"
                await redis_client.hset("world_model:camera_status", obs.entity_id, status)

            # 4. Track Entity Last Observation Summary
            summary = {
                "timestamp": obs.timestamp.isoformat(),
                "location": obs.location,
                "confidence": obs.confidence,
                "severity": obs.severity
            }
            await redis_client.hset("world_model:entity_last_observation", entity_key, json.dumps(summary))

        except Exception as e:
            logger.error(f"Failed to update World Model state: {e}", exc_info=True)

    async def get_entity_location(self, entity_type: str, entity_id: str) -> Optional[str]:
        """Get the last known location of an entity."""
        return await redis_client.hget("world_model:entity_locations", f"{entity_type}:{entity_id}")

    async def get_facility_occupants(self, location: str) -> list:
        """Get all entities currently registered at a location."""
        loc_key = f"world_model:facility_occupancy:{location.lower().replace(' ', '_')}"
        members = await redis_client.smembers(loc_key)
        return list(members)

    async def get_active_incidents(self) -> list:
        """Retrieve all active operational incidents."""
        incidents_raw = await redis_client.hgetall("world_model:active_incidents")
        return [json.loads(v) for v in incidents_raw.values()]

    async def resolve_active_incident(self, incident_id: str) -> bool:
        """Resolve/remove an incident from the active state."""
        res = await redis_client.hdel("world_model:active_incidents", incident_id)
        return res > 0

    async def get_world_summary(self) -> dict:
        """Returns a compiled representation of the current world operational state."""
        locations = await redis_client.hgetall("world_model:entity_locations")
        cameras = await redis_client.hgetall("world_model:camera_status")
        incidents = await self.get_active_incidents()
        
        return {
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "tracked_locations": locations,
            "camera_status": cameras,
            "active_incidents": incidents
        }

world_model = WorldModel()
