import modal
import io
import cv2
import numpy as np

# Initialize Modal App
app = modal.App("interact-ai-inference")

# Define the container build environment with OpenCV libraries and YOLO dependencies
image = (
    modal.Image.debian_slim()
    .apt_install("libglib2.0-0", "libgthread-2.0-0", "libgl1", "curl")
    .pip_install("ultralytics", "opencv-python-headless", "pydantic-settings")
)

@app.cls(image=image, gpu="any", keep_warm=1)
class InferenceService:
    """Serverless GPU-accelerated Computer Vision Inference Service."""

    def __enter__(self) -> None:
        """Runs on container startup to load model weights into VRAM."""
        from ultralytics import YOLO
        logger = modal.loglogger if hasattr(modal, 'loglogger') else None
        # Load YOLO model (Modal will cache this model image step)
        self.model = YOLO("yolo11n.pt")
        self.target_classes = {0, 1, 2, 3, 5, 7} # person, vehicles

    @modal.method()
    def predict(self, frame_bytes: bytes, confidence: float = 0.25) -> list:
        """Processes a frame bytes payload and returns structured bounding boxes and tracking IDs."""
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None or frame.size == 0:
            return []

        results = self.model.track(
            source=frame,
            persist=True,
            conf=confidence,
            classes=list(self.target_classes),
            imgsz=320,
            verbose=False
        )

        if not results or len(results) == 0:
            return []

        predictions = []
        result = results[0]
        boxes = result.boxes

        for i in range(len(boxes)):
            box = boxes[i]
            track_id = int(box.id[0].item()) if box.id is not None else -1
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            xyxy = box.xyxy[0].cpu().numpy()
            x1, y1, x2, y2 = map(int, xyxy)

            predictions.append({
                "track_id": track_id if track_id != -1 else None,
                "class_id": class_id,
                "class_name": self.model.names[class_id],
                "confidence": confidence,
                "box": [x1, y1, x2, y2]
            })

        return predictions

@app.function(image=image)
@modal.web_endpoint(method="POST")
def web_predict(file: modal.UploadedFile, model_name: str = "yolo11n.pt", confidence: float = 0.25):
    """Fallback HTTP endpoint allowing curl/REST clients to upload frame images directly."""
    service = InferenceService()
    frame_bytes = file.read()
    detections = service.predict.local(frame_bytes, confidence)
    return {"detections": detections}
