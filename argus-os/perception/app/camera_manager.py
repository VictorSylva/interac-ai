import asyncio
import logging
from typing import Dict, Optional
import httpx

from app.core.config import settings
from app.stream_worker import StreamWorker
from app.event_hooks import event_hook_manager

logger = logging.getLogger("app.camera_manager")

class CameraManager:
    """Orchestrates the lifecycle and synchronization of active camera stream threads."""

    def __init__(self) -> None:
        self.workers: Dict[int, StreamWorker] = {}
        self.is_running = False
        self._sync_task: Optional[asyncio.Task] = None
        self._http_client = httpx.AsyncClient(timeout=10.0)

    async def start(self) -> None:
        """Starts the manager and triggers the background syncer loop."""
        if self.is_running:
            return
        self.is_running = True
        # Spawn syncer loop
        self._sync_task = asyncio.create_task(self._sync_loop())
        logger.info("Camera manager successfully initialized.")

    async def shutdown(self) -> None:
        """Shuts down all active stream workers and stops loops."""
        self.is_running = False
        if self._sync_task:
            self._sync_task.cancel()
            try:
                await self._sync_task
            except asyncio.CancelledError:
                pass
                
        # Stop all workers in parallel
        logger.info("Stopping all active stream workers...")
        for camera_id, worker in list(self.workers.items()):
            worker.stop()
            del self.workers[camera_id]
        logger.info("Camera manager completely stopped.")

    def get_worker(self, camera_id: int) -> Optional[StreamWorker]:
        """Fetch worker instance by camera ID."""
        return self.workers.get(camera_id)

    async def start_camera(self, camera_id: int, name: str, rtsp_url: str, zone_polygons: Optional[list] = None) -> None:
        """Spawns and starts a stream worker for a single camera."""
        if camera_id in self.workers:
            # Check if details changed (including zone polygons configuration)
            worker = self.workers[camera_id]
            if worker.rtsp_url == rtsp_url and worker.zone_polygons == zone_polygons and worker.is_running:
                return
            # Details changed or stopped, recreate
            logger.info(f"RTSP stream or zone configurations changed for camera {camera_id}. Restarting worker.")
            worker.stop()
            
        worker = StreamWorker(camera_id, name, rtsp_url, zone_polygons)
        self.workers[camera_id] = worker
        worker.start()

    async def stop_camera(self, camera_id: int) -> None:
        """Stops and deregisters a stream worker."""
        if camera_id in self.workers:
            self.workers[camera_id].stop()
            del self.workers[camera_id]
            logger.info(f"Deregistered camera worker [{camera_id}].")

    async def sync_cameras(self) -> None:
        """Queries the backend to align local workers with registered active cameras."""
        logger.info("Syncing camera streams with database registry...")
        try:
            token = await event_hook_manager.get_token()
            headers = {"Authorization": f"Bearer {token}"}
            url = f"{settings.BACKEND_API_URL}/cameras/"
            
            response = await self._http_client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"Failed to fetch camera list from backend: HTTP {response.status_code}")
                return
                
            db_cameras = response.json()
            active_ids = set()
            
            for camera in db_cameras:
                if not camera.get("is_active"):
                    continue
                    
                camera_id = camera["id"]
                name = camera["name"]
                rtsp_url = camera["rtsp_url"]
                zone_polygons = camera.get("zone_polygons")
                active_ids.add(camera_id)
                
                # Start or update
                await self.start_camera(camera_id, name, rtsp_url, zone_polygons)
                
            # Clean up/stop workers for removed cameras
            for camera_id in list(self.workers.keys()):
                if camera_id not in active_ids:
                    logger.info(f"Camera {camera_id} no longer active or registered. Stopping worker.")
                    await self.stop_camera(camera_id)
                    
        except Exception as e:
            logger.error(f"Failed to sync cameras with backend database: {e}")

    async def _sync_loop(self) -> None:
        """Periodic loop execution wrapper for synchronization."""
        # Initial wait for backend container db migration to finalize safely
        await asyncio.sleep(5.0)
        
        while self.is_running:
            await self.sync_cameras()
            try:
                await asyncio.sleep(30.0)
            except asyncio.CancelledError:
                break

manager = CameraManager()
