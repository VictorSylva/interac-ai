import logging
import httpx
from config import config

logger = logging.getLogger(__name__)

async def emit_observation(
    source_system: str,
    entity_type: str,
    entity_id: str,
    location: str = None,
    confidence: float = 1.0,
    metadata: dict = None,
    evidence: dict = None,
    relationships: list = None,
    context: str = None,
    severity: str = "info"
) -> bool:
    """
    Submits a standardized observation to the central ARGUS Core intelligence service.
    Fails gracefully by logging a warning to ensure business transactions are never blocked.
    """
    url = f"{config.ARGUS_CORE_URL}/api/v1/observations/"
    payload = {
        "source_system": source_system,
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "location": location,
        "confidence": confidence,
        "metadata": metadata or {},
        "evidence": evidence or {},
        "relationships": relationships or [],
        "context": context,
        "severity": severity
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=5.0)
            if response.status_code in [200, 201]:
                logger.info(f"[ArgusCoreClient] Successfully emitted observation for {source_system}:{entity_type}:{entity_id}")
                return True
            else:
                logger.warning(f"[ArgusCoreClient] Failed to emit observation. Status: {response.status_code} | Response: {response.text}")
                return False
    except Exception as e:
        logger.warning(f"[ArgusCoreClient] Error connecting to ARGUS Core at {config.ARGUS_CORE_URL}: {e}")
        return False
