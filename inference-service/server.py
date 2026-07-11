import os
import sys
import time
import logging
import cv2
import numpy as np
import grpc
from concurrent import futures

# Add local directories to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "proto"))

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("inference_server")

try:
    from proto import inference_pb2, inference_pb2_grpc
except ImportError:
    logger.error("Protobuf bindings not found. Make sure compile_proto.py has run.")
    raise

from hal.factory import InferenceHALFactory
from registry import ModelRegistry
from metrics import performance_monitor

class InferenceServicer(inference_pb2_grpc.InferenceServiceServicer):
    """gRPC Servicer for real-time computer vision inference."""

    def __init__(self) -> None:
        logger.info("Initializing gRPC Inference Servicer...")
        self.provider = InferenceHALFactory.get_provider()
        self.registry = ModelRegistry()
        self.current_model = None
        self.initialized_classes = None

    def ProcessStreamFrame(self, request, context):
        start_time = time.time()
        
        # 1. Decode JPEG frame bytes
        nparr = np.frombuffer(request.frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None or frame.size == 0:
            logger.error("Received empty or malformed frame.")
            return inference_pb2.InferenceResponse(latency_ms=0)

        # 2. Dynamic Model Re-initialization Check
        target_classes = list(request.target_classes)
        model_name = request.model_name or "yolo11n.pt"
        
        if self.current_model != model_name or self.initialized_classes != target_classes:
            logger.info(f"Resolving model {model_name} from registry...")
            resolved_model_path = self.registry.resolve_model(model_name)
            model_config = self.registry.get_model_config(model_name)
            
            logger.info(f"Loading/Updating model: {model_name} with classes: {target_classes}...")
            self.provider.initialize(
                model_name=resolved_model_path,
                target_classes=target_classes,
                confidence_threshold=request.confidence if request.confidence > 0 else model_config.get("confidence_threshold", 0.25)
            )
            self.current_model = model_name
            self.initialized_classes = target_classes

        # 3. Run Inference via HAL
        detections_raw = self.provider.predict(frame, persist=True)

        # 4. Map to Protobuf response
        detections_pb = []
        for det in detections_raw:
            detections_pb.append(
                inference_pb2.Detection(
                    box=det["box"],
                    class_id=det["class_id"],
                    class_name=det["class_name"],
                    confidence=det["confidence"],
                    track_id=det["track_id"] if det["track_id"] is not None else -1
                )
            )

        latency = int((time.time() - start_time) * 1000)
        performance_monitor.record_frame(latency)
        logger.info(f"Processed frame for camera [{request.camera_id}] | Detections: {len(detections_pb)} | Latency: {latency}ms")
        
        return inference_pb2.InferenceResponse(
            detections=detections_pb,
            latency_ms=latency
        )

    def GetPerformanceMetrics(self, request, context):
        stats = performance_monitor.get_stats()
        return inference_pb2.MetricsResponse(
            uptime_seconds=stats["uptime_seconds"],
            processed_frames=stats["processed_frames"],
            dropped_frames=stats["dropped_frames"],
            average_latency_ms=stats["average_latency_ms"],
            cpu_percent=stats["cpu_percent"],
            ram_usage_bytes=stats["ram_usage_bytes"],
            gpu_percent=stats["gpu_percent"],
            vram_usage_bytes=stats["vram_usage_bytes"]
        )

def serve():
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=8),
        options=[
            ('grpc.max_receive_message_length', 50 * 1024 * 1024),  # 50MB
            ('grpc.max_send_message_length', 50 * 1024 * 1024),
        ]
    )
    inference_pb2_grpc.add_InferenceServiceServicer_to_server(InferenceServicer(), server)
    port = os.getenv("PORT", "50051")
    server.add_insecure_port(f"0.0.0.0:{port}")
    logger.info(f"Starting gRPC Inference Server on port {port}...")
    server.start()
    
    # Keep main thread alive
    try:
        while True:
            time.sleep(86400)
    except KeyboardInterrupt:
        logger.info("Shutting down gRPC Server...")
        server.stop(0)

if __name__ == "__main__":
    serve()
