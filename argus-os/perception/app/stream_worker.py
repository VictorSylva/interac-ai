import asyncio
import collections
import datetime
import logging
import queue
import time
import threading
from typing import Any, Dict, List, Optional, Tuple
import cv2
import httpx
import numpy as np

from app.core.config import settings
from app.event_hooks import event_hook_manager

logger = logging.getLogger("app.stream_worker")

class MockVideoCapture:
    """Simulates an RTSP camera stream by generating synthetic frames with motion."""
    def __init__(self, url: str) -> None:
        self.url = url
        self.fps = 10.0
        self.width = 640
        self.height = 480
        self.frame_count = 0
        self.opened = True
        # Box coordinates for motion simulation
        self.box_x = 50
        self.box_y = 100
        self.box_dx = 8
        self.box_dy = 5

    def isOpened(self) -> bool:
        return self.opened

    def read(self) -> tuple[bool, np.ndarray]:
        if not self.opened:
            return False, np.empty((0,))
        
        # Create a blank dark gray canvas
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        frame[:, :] = [30, 30, 30] # Dark background

        # Draw grid patterns
        for i in range(0, self.width, 40):
            cv2.line(frame, (i, 0), (i, self.height), (45, 45, 45), 1)
        for i in range(0, self.height, 40):
            cv2.line(frame, (0, i), (self.width, i), (45, 45, 45), 1)

        # Update moving box coordinates (simulates object motion)
        self.box_x += self.box_dx
        self.box_y += self.box_dy
        # Bounce off edges
        if self.box_x < 10 or self.box_x > self.width - 90:
            self.box_dx = -self.box_dx
        if self.box_y < 10 or self.box_y > self.height - 90:
            self.box_dy = -self.box_dy

        # Draw a moving "intruder" box to trigger motion detection
        cv2.rectangle(frame, (self.box_x, self.box_y), (self.box_x + 80, self.box_y + 80), (0, 0, 220), -1)
        cv2.putText(frame, "INTRUDER", (self.box_x + 5, self.box_y + 45), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        # Draw crosshair in center
        cx, cy = self.width // 2, self.height // 2
        cv2.drawMarker(frame, (cx, cy), (100, 100, 100), cv2.MARKER_CROSS, 20, 1)

        # Draw camera name and simulated timestamp
        cv2.putText(frame, f"FEED: MOCK STREAM ({self.url.split('/')[-1]})", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        cv2.putText(frame, timestamp_str, (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # Increment frame count
        self.frame_count += 1
        return True, frame

    def get(self, propId: int) -> float:
        if propId == cv2.CAP_PROP_FPS:
            return self.fps
        elif propId == cv2.CAP_PROP_FRAME_WIDTH:
            return float(self.width)
        elif propId == cv2.CAP_PROP_FRAME_HEIGHT:
            return float(self.height)
        return 0.0

    def set(self, propId: int, value: float) -> bool:
        return True

    def release(self) -> None:
        self.opened = False

class StreamWorker:
    """Thread worker responsible for consuming one camera stream, buffering, and detecting motion."""

    def __init__(self, camera_id: int, name: str, rtsp_url: str, zone_polygons: Optional[List[List[float]]] = None) -> None:
        self.camera_id = camera_id
        self.name = name
        self.rtsp_url = rtsp_url
        self.zone_polygons = zone_polygons
        
        self.is_running = False
        self._thread: Optional[threading.Thread] = None
        self._http_client = httpx.Client(timeout=5.0)

        # Sliding window buffer (deque) for pre-event recording
        # Initially set default FPS to 15. The buffer will adjust dynamically once the stream starts.
        self.fps = 15.0
        self.buffer_size = int(settings.PRE_EVENT_DURATION_SECONDS * self.fps)
        self.frame_buffer = collections.deque(maxlen=self.buffer_size)

        # Thread-safe queue for post-event clip recorder
        self.post_roll_queue: Optional[queue.Queue] = None
        self.post_roll_frames_remaining = 0
        self._recording_lock = threading.Lock()

        # Track history mapping track_id -> List[Tuple[int, int]]
        self.track_history = collections.defaultdict(list)

        # Cooldown management for events
        self.cooldown_seconds = 5.0  # Alert cooldown
        self.last_alert_time = 0.0
        self.inference_engine = None
        self.current_frame = None

    def start(self) -> None:
        """Starts the background camera ingestion thread."""
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._run_loop, name=f"CamWorker-{self.camera_id}", daemon=True)
        self._thread.start()
        logger.info(f"Stream worker started for camera [{self.camera_id}] '{self.name}'")

    def stop(self) -> None:
        """Stops the worker thread and releases resources."""
        if not self.is_running:
            return
        self.is_running = False
        if self._thread:
            self._thread.join(timeout=3.0)
        logger.info(f"Stream worker stopped for camera [{self.camera_id}] '{self.name}'")

    def trigger_manual_event(self) -> bool:
        """Forces an alert trigger programmatically (e.g. via REST API)."""
        if not self.is_running or len(self.frame_buffer) == 0:
            logger.warning(f"Cannot manual-trigger camera {self.camera_id}: stream not active.")
            return False

        logger.info(f"Manual alert triggered for camera [{self.camera_id}]")
        latest_frame = self.frame_buffer[-1]
        self._initiate_alert(latest_frame, "manual_alert", "high")
        return True

    def _update_backend_status(self, status: str) -> None:
        """Notifies backend of the camera state (online, offline, error)."""
        try:
            # Authenticate to obtain token
            loop = asyncio.new_event_loop()
            token = loop.run_until_complete(event_hook_manager.get_token())
            loop.close()

            headers = {"Authorization": f"Bearer {token}"}
            url = f"{settings.BACKEND_API_URL}/cameras/{self.camera_id}/status"
            params = {"status": status}
            res = self._http_client.put(url, params=params, headers=headers)
            if res.status_code == 200:
                logger.info(f"Updated camera {self.camera_id} status to '{status}' on backend.")
            else:
                logger.warning(f"Failed to update camera {self.camera_id} status on backend: HTTP {res.status_code}")
        except Exception as e:
            logger.error(f"Error communicating status update to backend for camera {self.camera_id}: {e}")

    def _initiate_alert(
        self,
        current_frame: np.ndarray,
        event_type: str,
        severity: str,
        ai_metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Prepares sliding frames and starts background video recording."""
        with self._recording_lock:
            # Check cooldown
            current_time = time.time()
            if current_time - self.last_alert_time < self.cooldown_seconds:
                return

            self.last_alert_time = current_time
            
            # Make a snapshot copy of current pre-event frames in buffer
            pre_roll = list(self.frame_buffer)
            
            # Setup post-event frame writer pipeline
            self.post_roll_queue = queue.Queue()
            self.post_roll_frames_remaining = int(settings.POST_EVENT_DURATION_SECONDS * self.fps)
            
            # Spawn the async trigger handler
            loop = asyncio.new_event_loop()
            threading.Thread(
                target=self._run_async_trigger,
                args=(self.camera_id, event_type, severity, current_frame.copy(), pre_roll, self.fps, self.post_roll_queue, ai_metadata),
                daemon=True
            ).start()

    def _run_async_trigger(self, camera_id, event_type, severity, frame, pre_roll, fps, q, ai_metadata=None):
        """Asynchronous execution bridge inside dedicated thread context."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                event_hook_manager.trigger_event(
                    camera_id=camera_id,
                    event_type=event_type,
                    severity=severity,
                    current_frame=frame,
                    pre_roll_frames=pre_roll,
                    fps=fps,
                    post_roll_queue=q,
                    ai_metadata=ai_metadata
                )
            )
        finally:
            loop.close()

    def _grab_frames_loop(self, cap: Any) -> None:
        """Continuously pulls raw frames from VideoCapture and posts them to a 1-item queue."""
        logger.info(f"Frame grabber thread started for camera [{self.camera_id}]")
        is_mock = self.rtsp_url.startswith("mock://")
        
        while self.is_running and cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                # Put a failed read sentinel in the queue
                self.frame_queue.put((False, None))
                time.sleep(0.1)
                continue
                
            # Discard any older frame currently in queue to guarantee freshest frame delivery
            while not self.frame_queue.empty():
                try:
                    self.frame_queue.get_nowait()
                except queue.Empty:
                    break
            
            self.frame_queue.put((True, frame))
            
            # Throttle mock stream to match target FPS (it is non-blocking)
            if is_mock:
                time.sleep(1.0 / self.fps)
            else:
                time.sleep(0.001)
        logger.info(f"Frame grabber thread stopped for camera [{self.camera_id}]")

    def _run_loop(self) -> None:
        """Primary capture loop containing frame reading, real-time AI inference, tracking, and zone intrusion."""
        from hal.factory import InferenceHALFactory
        from ai_engine.intrusion import IntrusionDetector
        from ai_engine.visualizer import Visualizer

        logger.info(f"Loading HAL Inference Engine for camera {self.camera_id}...")
        self.inference_engine = InferenceHALFactory.get_provider()
        self.inference_engine.initialize(
            model_name="yolo11n.pt",
            target_classes={0, 1, 2, 3, 5, 7},
            confidence_threshold=0.25
        )

        consecutive_failures = 0
        reconnect_delay = 5.0

        while self.is_running:
            logger.info(f"Connecting to stream: {self.rtsp_url}")
            if self.rtsp_url.startswith("mock://"):
                cap = MockVideoCapture(self.rtsp_url)
            else:
                cap = cv2.VideoCapture(self.rtsp_url)
            
            if not cap.isOpened():
                logger.error(f"Failed to open camera [{self.camera_id}] stream. Retrying in {reconnect_delay}s...")
                self._update_backend_status("error")
                cap.release()
                time.sleep(reconnect_delay)
                reconnect_delay = min(30.0, reconnect_delay * 1.5)
                continue

            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            logger.info(f"Stream successfully connected for camera [{self.camera_id}]")
            self._update_backend_status("online")
            
            fps_val = cap.get(cv2.CAP_PROP_FPS)
            if fps_val <= 0 or fps_val > 120:
                self.fps = 10.0  # Match mock feed FPS or default
            else:
                self.fps = float(fps_val)
                
            self.buffer_size = int(settings.PRE_EVENT_DURATION_SECONDS * self.fps)
            self.frame_buffer = collections.deque(maxlen=self.buffer_size)
            
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            logger.info(f"Camera stream specs -> Resolution: {width}x{height}, FPS: {self.fps}")

            # Scale the zone polygon coordinates if configured
            scaled_polygon = None
            if self.zone_polygons and width > 0 and height > 0:
                scaled_polygon = IntrusionDetector.scale_polygon(self.zone_polygons, width, height)
                logger.info(f"Scaled restricted zone polygon for camera {self.camera_id}: {scaled_polygon.tolist()}")

            # Initialize frame grabber queue and thread
            self.frame_queue = queue.Queue(maxsize=1)
            grabber_thread = threading.Thread(
                target=self._grab_frames_loop,
                args=(cap,),
                name=f"Grabber-{self.camera_id}",
                daemon=True
            )
            grabber_thread.start()

            consecutive_failures = 0
            reconnect_delay = 5.0
            frame_counter = 0
            last_predictions = []

            while self.is_running:
                try:
                    # Bounded wait to prevent thread locking indefinitely
                    ret, frame = self.frame_queue.get(timeout=2.0)
                except queue.Empty:
                    logger.warning(f"Timeout waiting for frame from grabber queue on camera {self.camera_id}")
                    break

                if not ret:
                    consecutive_failures += 1
                    logger.warning(f"Failed to read frame from camera {self.camera_id} (failure {consecutive_failures}/5)")
                    if consecutive_failures >= 5:
                        logger.error(f"RTSP stream dropped for camera {self.camera_id}. Reconnecting...")
                        self._update_backend_status("offline")
                        break
                    time.sleep(0.05)
                    continue

                consecutive_failures = 0
                frame_counter += 1
                is_mock_stream = self.rtsp_url.startswith("mock://")
                
                # --- AI Inference & Tracking ---
                if settings.USE_MOCK_INFERENCE and is_mock_stream and isinstance(cap, MockVideoCapture):
                    # Simulate YOLO detection of a person matching the moving red box
                    predictions = [{
                        "track_id": 1,
                        "class_id": 0, # Person
                        "class_name": "person",
                        "confidence": 0.95,
                        "box": [cap.box_x, cap.box_y, cap.box_x + 80, cap.box_y + 80]
                    }]
                else:
                    # Run real YOLO tracking inference with frame skipping for CPU optimization
                    if (frame_counter - 1) % settings.AI_FRAME_SKIP == 0 or not last_predictions:
                        predictions = self.inference_engine.predict(frame, persist=True)
                        last_predictions = predictions
                    else:
                        predictions = [dict(p) for p in last_predictions]

                # --- Restricted Zone Intrusion Logic ---
                zone_intruded = False
                for pred in predictions:
                    if scaled_polygon is not None:
                        box = pred["box"]
                        is_inside = IntrusionDetector.check_intrusion(box, scaled_polygon)
                        pred["intruded"] = is_inside
                        if is_inside:
                            zone_intruded = True
                    else:
                        pred["intruded"] = False

                    # Update tracking trajectory trail history
                    track_id = pred.get("track_id")
                    if track_id is not None:
                        x1, y1, x2, y2 = pred["box"]
                        center = ((x1 + x2) // 2, (y1 + y2) // 2)
                        self.track_history[track_id].append(center)
                        if len(self.track_history[track_id]) > 30:
                            self.track_history[track_id].pop(0)

                # --- Premium Overlay Visualizations ---
                annotated_frame = Visualizer.draw_predictions(
                    frame, predictions, scaled_polygon, self.track_history, zone_intruded
                )

                # Buffer the ANNOTATED frame so snapshots/clips contain overlays
                self.frame_buffer.append(annotated_frame.copy())
                self.current_frame = annotated_frame.copy()

                # Feed active background clip recordings
                with self._recording_lock:
                    if self.post_roll_queue is not None:
                        if self.post_roll_frames_remaining > 0:
                            self.post_roll_queue.put(annotated_frame.copy())
                            self.post_roll_frames_remaining -= 1
                        else:
                            self.post_roll_queue.put(None)
                            self.post_roll_queue = None
                            logger.info(f"Post-event recording complete for camera {self.camera_id}")

                # --- Intrusion Trigger Event ---
                if zone_intruded:
                    logger.info(f"!!! INTRUSION DETECTED on camera {self.camera_id} !!!")
                    ai_meta = {
                        "detections_count": len(predictions),
                        "intruders": [
                            {
                                "class": p["class_name"], 
                                "confidence": p["confidence"], 
                                "box": p["box"],
                                "track_id": p.get("track_id")
                            }
                            for p in predictions if p.get("intruded")
                        ]
                    }
                    self._initiate_alert(annotated_frame, "zone_intrusion_detected", "critical", ai_meta)

                # Safety yield
                time.sleep(0.001)

            cap.release()
            # Wait for grabber thread to finish
            if grabber_thread.is_alive():
                grabber_thread.join(timeout=1.0)
            
        self._update_backend_status("offline")
        with self._recording_lock:
            if self.post_roll_queue is not None:
                self.post_roll_queue.put(None)
                self.post_roll_queue = None
        logger.info(f"Clean worker teardown executed for camera {self.camera_id}")
