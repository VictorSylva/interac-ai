import logging
from typing import Any, Dict, List
import cv2
import numpy as np
from ultralytics import YOLO

logger = logging.getLogger("app.ai_engine.inference")

class InferenceEngine:
    """Wraps YOLOv11 for real-time inference, object tracking, and class filtering."""

    def __init__(self, model_name: str = "yolo11n.pt") -> None:
        logger.info(f"Initializing YOLO model: {model_name}...")
        # Ultralytics will automatically choose CUDA/GPU if available, or fallback to CPU
        self.model = YOLO(model_name)
        
        # Target classes (COCO dataset): 0: person, 1: bicycle, 2: car, 3: motorcycle, 5: bus, 7: truck
        self.target_classes = {0, 1, 2, 3, 5, 7}
        self.confidence_threshold = 0.25
        logger.info("YOLO model loaded and configured successfully.")

    def process_frame(self, frame: np.ndarray, persist: bool = True) -> List[Dict[str, Any]]:
        """Runs object detection and tracking on a frame. Filters by target classes and confidence."""
        if frame is None or frame.size == 0:
            return []

        predictions = []
        try:
            # Using model.track() provides tracking persistence and stable object IDs out-of-the-box!
            # We set stream=True for low-latency memory usage, and persist=True to maintain tracker states
            results = self.model.track(
                source=frame,
                persist=persist,
                conf=self.confidence_threshold,
                classes=list(self.target_classes),
                imgsz=320,
                verbose=False
            )

            if not results or len(results) == 0:
                return []

            result = results[0]
            boxes = result.boxes

            # Extract bounding boxes, labels, and tracking IDs
            for i in range(len(boxes)):
                box = boxes[i]
                
                # Check if it has a tracking ID assigned
                track_id = int(box.id[0].item()) if box.id is not None else None
                class_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                
                # Box coordinates: [x1, y1, x2, y2]
                xyxy = box.xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = map(int, xyxy)

                predictions.append({
                    "track_id": track_id,
                    "class_id": class_id,
                    "class_name": self.model.names[class_id],
                    "confidence": confidence,
                    "box": [x1, y1, x2, y2]
                })

        except Exception as e:
            logger.error(f"Error during YOLO model inference tracking: {e}")

        return predictions
