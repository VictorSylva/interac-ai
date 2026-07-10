import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status

from app.core.config import settings
from app.core.logging import setup_logging
from app.camera_manager import manager

logger = logging.getLogger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Controls startup and shutdown lifecycle hooks for the camera services."""
    # STARTUP
    setup_logging()
    logger.info("Starting up AI Surveillance Camera Streaming Services...")
    await manager.start()
    
    yield
    
    # SHUTDOWN
    logger.info("Shutting down AI Surveillance Camera Streaming Services...")
    await manager.shutdown()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def health_check():
    """Service health metrics."""
    active_workers = [
        {"id": cid, "name": w.name, "status": "running" if w.is_running else "stopped"}
        for cid, w in manager.workers.items()
    ]
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "active_streams_count": len(manager.workers),
        "streams": active_workers
    }

@app.post("/sync", status_code=status.HTTP_200_OK)
async def force_sync():
    """Forces an immediate synchronization with the backend camera registry."""
    await manager.sync_cameras()
    return {"message": "Camera registry sync initiated successfully."}

@app.post("/cameras/{camera_id}/trigger", status_code=status.HTTP_202_ACCEPTED)
async def manual_trigger_event(camera_id: int):
    """Triggers a simulated/manual intrusion event on a specific active camera stream."""
    worker = manager.get_worker(camera_id)
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera worker [{camera_id}] not found or is currently inactive."
        )
        
    success = worker.trigger_manual_event()
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to trigger event. Ensure stream is online and active."
        )
        
    return {"message": f"Manual threat event successfully triggered on camera {camera_id}."}

@app.post("/cameras/trigger-all", status_code=status.HTTP_202_ACCEPTED)
async def manual_trigger_all():
    """Triggers simulated events on all running active camera streams."""
    if not manager.workers:
        return {"message": "No active camera workers running to trigger."}
        
    triggered_count = 0
    for camera_id, worker in manager.workers.items():
        if worker.trigger_manual_event():
            triggered_count += 1
            
    return {
        "message": f"Simulated events triggered successfully.",
        "triggered_count": triggered_count,
        "active_workers_count": len(manager.workers)
    }
import cv2
import asyncio
from fastapi.responses import StreamingResponse

async def mjpeg_generator(camera_id: int):
    worker = manager.get_worker(camera_id)
    if not worker:
        yield b''
        return
        
    while True:
        if not worker.is_running:
            break
        frame = worker.current_frame
        if frame is not None:
            ret, buffer = cv2.imencode('.jpg', frame)
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        await asyncio.sleep(0.05)

@app.get('/cameras/{camera_id}/stream')
async def stream_camera(camera_id: int):
    worker = manager.get_worker(camera_id)
    if not worker:
        raise HTTPException(status_code=404, detail='Camera not found or inactive')
    return StreamingResponse(mjpeg_generator(camera_id), media_type='multipart/x-mixed-replace; boundary=frame')

@app.get('/cameras/metrics')
async def get_inference_metrics():
    """Queries the AI Inference Service via gRPC to retrieve performance metrics."""
    import os
    import grpc
    
    endpoint_url = os.getenv("CLOUD_GPU_ENDPOINT_URL", "grpc://inference-service:50051")
    address = endpoint_url.replace("grpc://", "")
    
    try:
        from hal.providers.grpc_bindings import inference_pb2, inference_pb2_grpc
        
        # Async query to the gRPC service
        async with grpc.aio.insecure_channel(address) as channel:
            stub = inference_pb2_grpc.InferenceServiceStub(channel)
            response = await stub.GetPerformanceMetrics(
                inference_pb2.MetricsRequest(),
                timeout=2.0
            )
            return {
                "uptime_seconds": response.uptime_seconds,
                "processed_frames": response.processed_frames,
                "dropped_frames": response.dropped_frames,
                "average_latency_ms": response.average_latency_ms,
                "cpu_percent": response.cpu_percent,
                "ram_usage_bytes": response.ram_usage_bytes,
                "gpu_percent": response.gpu_percent,
                "vram_usage_bytes": response.vram_usage_bytes,
                "endpoint": endpoint_url,
                "status": "connected"
            }
    except Exception as e:
        logger.error(f"Failed to query inference metrics: {e}")
        return {
            "status": "disconnected",
            "error": str(e),
            "endpoint": endpoint_url
        }

