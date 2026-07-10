import asyncio
import datetime
import logging
import os
import queue
import threading
from typing import Any, Dict, List, Optional
import cv2
import httpx
import numpy as np

from app.core.config import settings

logger = logging.getLogger("app.event_hooks")

class EventHookManager:
    """Handles alert events: saves snapshots, records MP4 clips, and notifies Backend APIs."""

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._token_lock = threading.Lock()
        self._http_client = httpx.AsyncClient(timeout=10.0)

    async def get_token(self) -> str:
        """Retrieves and caches JWT token using admin credentials."""
        with self._token_lock:
            if self._token:
                return self._token

        logger.info("Authenticating with FastAPI backend...")
        try:
            url = f"{settings.BACKEND_API_URL}/auth/login"
            login_data = {
                "username": settings.ADMIN_EMAIL,
                "password": settings.ADMIN_PASSWORD
            }
            response = await self._http_client.post(url, data=login_data)
            if response.status_code == 200:
                data = response.json()
                with self._token_lock:
                    self._token = data["access_token"]
                logger.info("JWT authentication token successfully retrieved and cached.")
                return self._token
            else:
                logger.error(f"Failed to authenticate with backend: {response.text}")
                raise Exception("Authentication failure")
        except Exception as e:
            logger.error(f"Error during backend authentication request: {e}")
            raise

    async def trigger_event(
        self,
        camera_id: int,
        event_type: str,
        severity: str,
        current_frame: np.ndarray,
        pre_roll_frames: List[np.ndarray],
        fps: float,
        post_roll_queue: queue.Queue,
        ai_metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Triggers the pipeline: writes snapshot, notifies API, and records MP4 clip in background."""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        
        # Define storage files
        snap_filename = f"snap_{camera_id}_{timestamp}.jpg"
        clip_filename = f"clip_{camera_id}_{timestamp}.webm"
        
        snap_path = os.path.join(settings.STORAGE_DIR, "snapshots", snap_filename)
        clip_path = os.path.join(settings.STORAGE_DIR, "clips", clip_filename)
        
        # 1. Save Snapshot immediately (synchronously as it is fast)
        try:
            cv2.imwrite(snap_path, current_frame)
            logger.info(f"Snapshot written to {snap_path}")
        except Exception as e:
            logger.error(f"Failed to write snapshot JPEG to disk: {e}")
            return

        # 2. Notify backend REST API immediately (so dashboard displays alert instantly)
        event_id = None
        try:
            token = await self.get_token()
            headers = {"Authorization": f"Bearer {token}"}
            
            # Use docker volume mount path style for the database fields
            db_snap_path = f"/var/lib/surveillance/snapshots/{snap_filename}"
            db_clip_path = f"/var/lib/surveillance/clips/{clip_filename}"
            
            event_payload = {
                "camera_id": camera_id,
                "event_type": event_type,
                "severity": severity,
                "snapshot_path": db_snap_path,
                "video_clip_path": db_clip_path,
                "ai_metadata": ai_metadata or {}
            }
            
            url = f"{settings.BACKEND_API_URL}/events/"
            response = await self._http_client.post(url, json=event_payload, headers=headers)
            if response.status_code == 201:
                event_data = response.json()
                event_id = event_data.get("id")
                logger.info(f"Event successfully logged in backend DB. Event ID: {event_id}")
            else:
                logger.warning(f"Backend rejected event logging (HTTP {response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"Failed to notify backend API of security event: {e}")

        # 3. Spawn background thread to write the MP4 clip without blocking main thread
        h, w = current_frame.shape[:2]
        writer_thread = threading.Thread(
            target=self._write_clip_worker,
            args=(clip_path, pre_roll_frames, post_roll_queue, fps, w, h),
            daemon=True
        )
        writer_thread.start()

    def _write_clip_worker(
        self,
        clip_path: str,
        pre_roll_frames: List[np.ndarray],
        post_roll_queue: queue.Queue,
        fps: float,
        width: int,
        height: int
    ) -> None:
        """Background thread worker to compile and save video clip."""
        logger.info(f"Background clip recorder started for {clip_path}")
        
        # Use CPU-friendly VP80 codec for web compatibility (.webm)
        fourcc = cv2.VideoWriter_fourcc(*"VP80")
        writer = cv2.VideoWriter(clip_path, fourcc, fps, (width, height))
        
        if not writer.isOpened():
            logger.error(f"Failed to open cv2.VideoWriter for clip: {clip_path}")
            return
            
        try:
            # Write all pre-event frames from the memory deque
            logger.info(f"Writing {len(pre_roll_frames)} pre-event buffer frames...")
            for frame in pre_roll_frames:
                writer.write(frame)
                
            # Loop and write post-event frames from the queue
            logger.info("Writing incoming post-event frames...")
            expected_post_frames = int(settings.POST_EVENT_DURATION_SECONDS * fps)
            written_post_frames = 0
            
            # Read until we hit our duration limit or receive a sentinel None
            while written_post_frames < expected_post_frames:
                try:
                    # Bounded wait to prevent thread locking indefinitely
                    frame = post_roll_queue.get(timeout=2.0)
                    if frame is None:
                        # Sentinel representing end of stream or worker termination
                        break
                    writer.write(frame)
                    written_post_frames += 1
                except queue.Empty:
                    logger.warning("Timeout waiting for post-event frame in clip worker.")
                    break
                    
            logger.info(f"Clip complete! Wrote {len(pre_roll_frames) + written_post_frames} total frames to {clip_path}")
        except Exception as e:
            logger.error(f"Error compiling video clip: {e}")
        finally:
            writer.release()

event_hook_manager = EventHookManager()
