import logging
import os
import json
import httpx
import cv2
from typing import List, Dict, Any, Optional
import numpy as np
from hal.base import BaseInferenceProvider

logger = logging.getLogger("app.hal.providers.cloud_gpu")

class CloudGPUProvider(BaseInferenceProvider):
    """HAL provider routing inference requests to a remote Cloud GPU microservice (RunPod/Modal)."""

    def __init__(self) -> None:
        self.endpoint_url = None
        self.grpc_stub = None
        self.model_name = "yolo11n.pt"
        self.target_classes = []
        self.confidence_threshold = 0.25
        self.http_client = httpx.Client(timeout=10.0)
        self.ws_conn = None

    def initialize(self, model_name: str, target_classes: List[int], confidence_threshold: float = 0.25) -> None:
        self.model_name = model_name
        self.target_classes = target_classes
        self.confidence_threshold = confidence_threshold
        
        # Load cloud configuration
        # Default to a mock/localhost gRPC port or container URL
        self.endpoint_url = os.getenv("CLOUD_GPU_ENDPOINT_URL", "grpc://inference-service:50051")
        logger.info(f"Initialized Cloud GPU Provider pointing to: {self.endpoint_url}")

        if self.endpoint_url.startswith("grpc://"):
            try:
                import grpc
                address = self.endpoint_url.replace("grpc://", "")
                channel = grpc.insecure_channel(address)
                # Stub is dynamically bound or loaded when compiled files are available
                self.channel = channel
                logger.info(f"gRPC channel established with remote cloud GPU at {address}")
            except ImportError:
                logger.warning("grpcio library not installed. Falling back to HTTP endpoints.")

    def _get_ws_connection(self) -> Optional[Any]:
        """Establishes and returns a persistent WebSocket connection to the Colab bridge (Mode B)."""
        try:
            import websocket
            if self.ws_conn and self.ws_conn.connected:
                return self.ws_conn
            
            logger.info(f"Connecting WebSocket to Google Colab bridge at {self.endpoint_url}...")
            self.ws_conn = websocket.create_connection(self.endpoint_url, timeout=5.0)
            return self.ws_conn
        except Exception as e:
            logger.error(f"Failed to connect to Google Colab WebSocket: {e}")
            return None

    def predict(self, frame: np.ndarray, persist: bool = True) -> List[Dict[str, Any]]:
        if frame is None or frame.size == 0:
            return []

        # Encode frame as JPEG to reduce network bandwidth usage
        ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if not ret:
            logger.error("Failed to encode frame to JPEG for cloud transit.")
            return []

        frame_bytes = buffer.tobytes()

        # 1. Check if endpoint is WebSocket (Google Colab Mode B bridge)
        if self.endpoint_url.startswith("ws://") or self.endpoint_url.startswith("wss://"):
            ws = self._get_ws_connection()
            if ws:
                try:
                    import base64
                    encoded_frame = base64.b64encode(frame_bytes).decode('utf-8')
                    payload = {
                        "frame": encoded_frame,
                        "model_name": self.model_name,
                        "confidence": self.confidence_threshold,
                        "target_classes": list(self.target_classes)
                    }
                    ws.send(json.dumps(payload))
                    response = ws.recv()
                    data = json.loads(response)
                    return data.get("detections", [])
                except Exception as e:
                    logger.error(f"Error communicating over Colab WebSocket connection: {e}")
                    if self.ws_conn:
                        try:
                            self.ws_conn.close()
                        except:
                            pass
                        self.ws_conn = None

        # 2. Try gRPC transport first if configured
        if self.endpoint_url.startswith("grpc://") and hasattr(self, 'channel'):
            try:
                # Dynamically try importing compiled gRPC bindings if they exist
                # This ensures we don't crash if proto files are compiled in container but not locally.
                try:
                    import sys
                    bindings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "grpc_bindings")
                    if bindings_path not in sys.path:
                        sys.path.append(bindings_path)
                    from hal.providers.grpc_bindings import inference_pb2, inference_pb2_grpc
                    stub = inference_pb2_grpc.InferenceServiceStub(self.channel)
                    request = inference_pb2.InferenceRequest(
                        frame_bytes=frame_bytes,
                        model_name=self.model_name,
                        confidence=self.confidence_threshold,
                        camera_id=0
                    )
                    # Sync call
                    response = stub.ProcessStreamFrame(request)
                    predictions = []
                    for det in response.detections:
                        predictions.append({
                            "track_id": det.track_id if det.track_id != -1 else None,
                            "class_id": det.class_id,
                            "class_name": det.class_name,
                            "confidence": det.confidence,
                            "box": list(det.box)
                        })
                    return predictions
                except ImportError:
                    logger.debug("gRPC compiled bindings not found. Falling back to HTTP POST for remote prediction.")
            except Exception as e:
                logger.error(f"gRPC remote inference failed: {e}. Trying HTTP fallback...")

        # 3. Fallback to HTTP API
        try:
            files = {"file": ("frame.jpg", frame_bytes, "image/jpeg")}
            data = {
                "model_name": self.model_name,
                "confidence": self.confidence_threshold,
                "target_classes": json.dumps(self.target_classes)
            }
            # Reformat endpoint to http if it contains grpc marker
            http_url = self.endpoint_url.replace("grpc://", "http://").replace(":50051", ":8003/v1/inference")
            if not http_url.startswith("http"):
                http_url = "http://" + http_url
                
            response = self.http_client.post(http_url, files=files, data=data)
            
            if response.status_code == 200:
                return response.json().get("detections", [])
            else:
                logger.error(f"Cloud GPU HTTP service returned status {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Failed to transmit frame to Cloud GPU HTTP endpoint: {e}")

        return []
