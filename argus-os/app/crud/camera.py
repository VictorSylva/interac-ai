from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.base import CRUDBase
from app.models.camera import Camera
from app.schemas.camera import CameraCreate, CameraUpdate

class CRUDCamera(CRUDBase[Camera, CameraCreate, CameraUpdate]):
    """Repository class managing Camera persistence and device metrics."""

    async def get_active_cameras(self, db: AsyncSession) -> List[Camera]:
        """Fetch all cameras configured as active."""
        query = select(Camera).filter(Camera.is_active == True)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def update_status(
        self, db: AsyncSession, *, camera_id: int, status: str
    ) -> Optional[Camera]:
        """Dynamically update status state (online, offline, error) of a camera."""
        camera = await self.get(db, camera_id)
        if camera:
            camera.status = status
            db.add(camera)
            await db.commit()
            await db.refresh(camera)
        return camera

camera_crud = CRUDCamera(Camera)
