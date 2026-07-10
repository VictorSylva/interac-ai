from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.crud.camera import camera_crud
from app.schemas.camera import CameraCreate, CameraResponse, CameraUpdate

router = APIRouter()

@router.get("/", response_model=List[CameraResponse])
async def list_cameras(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve all cameras."""
    cameras = await camera_crud.get_multi(db, skip=skip, limit=limit)
    return cameras

@router.post("/", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
async def register_camera(
    *,
    db: AsyncSession = Depends(deps.get_db),
    obj_in: CameraCreate,
    current_user=Depends(deps.get_current_active_superuser),
) -> Any:
    """Register a new camera (Admin only)."""
    camera = await camera_crud.create(db, obj_in=obj_in)
    return camera

@router.get("/{camera_id}", response_model=CameraResponse)
async def read_camera(
    *,
    db: AsyncSession = Depends(deps.get_db),
    camera_id: int,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Get detailed camera specifications by ID."""
    camera = await camera_crud.get(db, id=camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )
    return camera

@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    *,
    db: AsyncSession = Depends(deps.get_db),
    camera_id: int,
    obj_in: CameraUpdate,
    current_user=Depends(deps.get_current_active_superuser),
) -> Any:
    """Update camera details (Admin only)."""
    camera = await camera_crud.get(db, id=camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )
    camera = await camera_crud.update(db, db_obj=camera, obj_in=obj_in)
    return camera

@router.delete("/{camera_id}", response_model=CameraResponse)
async def delete_camera(
    *,
    db: AsyncSession = Depends(deps.get_db),
    camera_id: int,
    current_user=Depends(deps.get_current_active_superuser),
) -> Any:
    """Delete/deregister a camera from tracking network (Admin only)."""
    camera = await camera_crud.get(db, id=camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )
    camera = await camera_crud.remove(db, id=camera_id)
    return camera

@router.put("/{camera_id}/status", response_model=CameraResponse)
async def update_camera_status(
    *,
    db: AsyncSession = Depends(deps.get_db),
    camera_id: int,
    status: str,
    current_user=Depends(deps.get_current_active_user),
) -> Any:
    """Updates camera online/offline connection state."""
    camera = await camera_crud.update_status(db, camera_id=camera_id, status=status)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )
    return camera
