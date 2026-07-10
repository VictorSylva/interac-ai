import abc
from typing import List, Dict, Any
import numpy as np

class BaseInferenceProvider(abc.ABC):
    """Abstract base class defining the contract for all InteracAI computer vision inference providers."""

    @abc.abstractmethod
    def initialize(self, model_name: str, target_classes: List[int], confidence_threshold: float = 0.25) -> None:
        """Loads the model and configures target filtering classes and confidence threshold."""
        pass

    @abc.abstractmethod
    def predict(self, frame: np.ndarray, persist: bool = True) -> List[Dict[str, Any]]:
        """Runs object detection/tracking on a frame and returns structured detections.
        
        Returns:
            List[Dict[str, Any]]: Standardized predictions, e.g.:
            [
                {
                    "track_id": int or None,
                    "class_id": int,
                    "class_name": str,
                    "confidence": float,
                    "box": [x1, y1, x2, y2]
                }
            ]
        """
        pass
