import logging
from typing import List, Tuple
import cv2
import numpy as np

logger = logging.getLogger("app.ai_engine.intrusion")

class IntrusionDetector:
    """Handles polygon-based restricted zone intrusion calculations."""

    @staticmethod
    def scale_polygon(normalized_polygon: List[List[float]], width: int, height: int) -> np.ndarray:
        """Converts normalized float coordinates [[x_pct, y_pct], ...] to absolute integer pixel vertices."""
        points = []
        for point in normalized_polygon:
            if len(point) != 2:
                continue
            x_px = int(point[0] * width)
            y_px = int(point[1] * height)
            points.append([x_px, y_px])
        
        # Reshape to (N, 1, 2) as expected by OpenCV polygon test
        return np.array(points, dtype=np.int32).reshape((-1, 1, 2))

    @staticmethod
    def check_intrusion(box: List[int], scaled_polygon: np.ndarray) -> bool:
        """Checks if the bottom-center point (footprint) of a bounding box falls within the polygon."""
        if scaled_polygon is None or len(scaled_polygon) == 0:
            return False

        x1, y1, x2, y2 = box
        
        # Calculate the center point of the bounding box
        center_x = (x1 + x2) // 2
        center_y = (y1 + y2) // 2
        point = (float(center_x), float(center_y))

        # Perform point polygon test
        # cv2.pointPolygonTest returns:
        #   +1: Point is inside the polygon
        #    0: Point is on an edge/vertex
        #   -1: Point is outside the polygon
        result = cv2.pointPolygonTest(scaled_polygon, point, measureDist=False)
        
        return result >= 0
