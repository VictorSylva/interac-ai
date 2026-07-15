from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from app.services.world_model import world_model

router = APIRouter()

@router.get("/summary", response_model=dict)
async def get_world_summary() -> Any:
    """Retrieve a compiled representation of the current operational reality."""
    try:
        return await world_model.get_world_summary()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load world model: {str(e)}"
        )

@router.get("/incidents", response_model=List[dict])
async def get_active_incidents() -> Any:
    """Retrieve all active operational/threat incidents."""
    try:
        return await world_model.get_active_incidents()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load active incidents: {str(e)}"
        )

@router.post("/incidents/{incident_id}/resolve", response_model=dict)
async def resolve_incident(incident_id: str) -> Any:
    """Mark an active incident as resolved, removing it from the real-time state."""
    resolved = await world_model.resolve_active_incident(incident_id)
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {incident_id} not found or already resolved."
        )
    return {"status": "resolved", "incident_id": incident_id}

@router.get("/occupants/{location_name}", response_model=List[str])
async def get_occupants(location_name: str) -> Any:
    """Get list of entities registered at a specific location."""
    try:
        return await world_model.get_facility_occupants(location_name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve occupants: {str(e)}"
        )
