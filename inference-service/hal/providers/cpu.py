import logging
from typing import List, Dict, Any, Optional
import numpy as np
from ultralytics import YOLO
from hal.base import BaseInferenceProvider

logger = logging.getLogger("app.hal.providers.cpu")

class CPUProvider(BaseInferenceProvider):
    """HAL provider executing inference on CPU using PyTorch/Ultralytics."""

    def __init__(self) -> None:
        self.model = None
        self.target_classes = set()
        self.confidence_threshold = 0.25

    def initialize(self, model_name: str, target_classes: List[int], confidence_threshold: float = 0.25) -> None:
        logger.info(f"Initializing CPU YOLO model: {model_name}...")
        self.model = YOLO(model_name)
        self.target_classes = set(target_classes)
        self.confidence_threshold = confidence_threshold
        logger.info("CPU Provider loaded and configured successfully.")

    def predict(self, frame: np.ndarray, persist: bool = True) -> List[Dict[str, Any]]:
        if frame is None or frame.size == 0 or self.model is None:
            return []

        predictions = []
        try:
            results = self.model.track(
                source=frame,
                persist=persist,
                conf=self.confidence_threshold,
                classes=list(self.target_classes),
                imgsz=320,
                device="cpu",  # Force CPU device execution
                verbose=False
            )

            if not results or len(results) == 0:
                return []

            result = results[0]
            boxes = result.boxes

            for i in range(len(boxes)):
                box = boxes[i]
                track_id = int(box.id[0].item()) if box.id is not None else None
                class_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
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
            logger.error(f"Error during CPU inference tracking: {e}")

        return predictions
