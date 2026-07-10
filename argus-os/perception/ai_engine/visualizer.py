from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np

class Visualizer:
    """Provides high-tech visual overlays (bounding boxes, class headers, track trails, zones)."""

    @staticmethod
    def draw_predictions(
        frame: np.ndarray,
        predictions: List[Dict[str, Any]],
        scaled_polygon: Optional[np.ndarray] = None,
        track_history: Optional[Dict[int, List[Tuple[int, int]]]] = None,
        zone_intruded: bool = False
    ) -> np.ndarray:
        """Applies highly refined overlays on the frame."""
        if frame is None or frame.size == 0:
            return frame

        canvas = frame.copy()
        h, w = canvas.shape[:2]

        # 1. Draw Restricted Zone Polygon with transparent overlay
        if scaled_polygon is not None and len(scaled_polygon) > 0:
            overlay = canvas.copy()
            # Choose color: red if intruded, cyan if clear
            zone_color = (0, 0, 255) if zone_intruded else (255, 255, 0)
            
            # Draw semi-transparent filled polygon
            cv2.fillPoly(overlay, [scaled_polygon], zone_color)
            cv2.addWeighted(overlay, 0.15, canvas, 0.85, 0, canvas)
            
            # Draw thick solid border
            cv2.polylines(canvas, [scaled_polygon], isClosed=True, color=zone_color, thickness=2)
            
            # Label the zone
            # Put label just above the first vertex of the polygon
            first_pt = scaled_polygon[0][0]
            cv2.putText(
                canvas,
                "RESTRICTED ZONE",
                (first_pt[0], max(20, first_pt[1] - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                zone_color,
                1,
                cv2.LINE_AA
            )

        # 2. Draw Object Movement Track History Trails
        if track_history:
            for track_id, points in track_history.items():
                if len(points) < 2:
                    continue
                # Draw trailing line with fading thickness/color
                for j in range(1, len(points)):
                    pt1 = points[j - 1]
                    pt2 = points[j]
                    
                    # Calculate opacity/thickness factor (newest is thickest/brightest)
                    alpha = float(j) / len(points)
                    thickness = int(1 + alpha * 2)
                    trail_color = (0, 255, 255)  # Bright Yellow/Cyan trail
                    
                    cv2.line(canvas, pt1, pt2, trail_color, thickness, cv2.LINE_AA)

        # 3. Draw Bounding Boxes and Tech-style headers
        for pred in predictions:
            box = pred["box"]
            class_name = pred["class_name"].upper()
            confidence = pred["confidence"]
            track_id = pred.get("track_id")
            intruded = pred.get("intruded", False)

            x1, y1, x2, y2 = box
            
            # Red for intruder, Green for clear/safe
            box_color = (0, 0, 255) if intruded else (0, 255, 0)
            box_thickness = 2 if intruded else 1

            # Draw corner brackets or clean bounding box
            cv2.rectangle(canvas, (x1, y1), (x2, y2), box_color, box_thickness, cv2.LINE_AA)

            # Draw solid header label box above detection box
            label = f"{class_name}"
            if track_id is not None:
                label += f" #{track_id}"
            label += f" {int(confidence * 100)}%"

            # Get text dimensions
            (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
            
            # Header position
            header_y1 = max(0, y1 - text_h - 6)
            header_y2 = y1
            
            # Draw header bar background
            cv2.rectangle(canvas, (x1, header_y1), (x1 + text_w + 10, header_y2), box_color, -1)
            # Draw label text on top of the bar
            cv2.putText(
                canvas,
                label,
                (x1 + 5, y1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                (255, 255, 255) if intruded else (0, 0, 0),
                1,
                cv2.LINE_AA
            )

            # Draw center point
            center_x = (x1 + x2) // 2
            center_y = (y1 + y2) // 2
            cv2.circle(canvas, (center_x, center_y), 4, box_color, -1, cv2.LINE_AA)

        # 4. Draw Warning Intrusion Header Banner
        if zone_intruded:
            # Draw a bright red bar at the top of the canvas
            cv2.rectangle(canvas, (0, 0), (w, 35), (0, 0, 255), -1)
            cv2.putText(
                canvas,
                "!!! INTRUSION DETECTED IN RESTRICTED ZONE !!!",
                (w // 2 - 180, 23),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2,
                cv2.LINE_AA
            )

        return canvas
