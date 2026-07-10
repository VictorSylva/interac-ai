# InteracAI Inference Service

This directory contains the independent, production-grade **AI Inference Service** for computer vision and object detection. It is designed to be hardware-independent, allowing deployments on local CPUs, local CUDA GPUs, NVIDIA Jetson boards, or cloud GPU platforms (like Modal and RunPod) without requiring code modifications in camera ingestion clients.

---

## 1. Directory Structure

- `proto/`: Contains Protobuf schema contracts (`inference.proto`).
- `hal/`: The Hardware Abstraction Layer containing specific provider engines (CPU, CUDA, TensorRT).
- `registry.py`: Handles model dynamic downloading, versioning, and configurations.
- `metrics.py`: Captures and calculates performance metrics (latency, dropped frames, system utilization).
- `server.py`: The gRPC Server listening on port `50051`.
- `deploy_modal.py`: Deploys the service to **Modal** Serverless GPU.

---

## 2. Configuration Settings

The service is configured using environment variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | gRPC server listener port | `50051` |
| `INFERENCE_PROVIDER` | Execution hardware mode (`CPU`, `CUDA`, `TENSORRT`) | `CPU` |
| `MODEL_REGISTRY_URL` | Optional HTTP/S3 URL to download dynamic model weights | `""` |

---

## 3. Deployment Modes

### A. Local Docker Run
To run the server locally using CPU:
```bash
docker build -t interact-inference-service .
docker run -p 50051:50051 -e INFERENCE_PROVIDER=CPU interact-inference-service
```

### B. Local CUDA GPU Run (Requires Nvidia Docker Toolkit)
```bash
docker run --gpus all -p 50051:50051 -e INFERENCE_PROVIDER=CUDA interact-inference-service
```

### C. Serverless Cloud GPU Deployment (Modal)
Modal offers per-second billing with scale-to-zero capabilities. To deploy:
1. Install modal: `pip install modal`
2. Authenticate: `modal setup`
3. Deploy the application:
```bash
modal deploy deploy_modal.py
```
This registers a GPU-accelerated runner under your Modal account. Capture the generated HTTP/WebSocket URL to configure client environment parameters.

### D. Serverless Cloud GPU Deployment (RunPod)
RunPod supports running arbitrary Docker images on serverless GPU endpoints:
1. Build the docker image and push it to Docker Hub:
   ```bash
   docker build -t yourdockerhub/interact-inference-service:latest .
   docker push yourdockerhub/interact-inference-service:latest
   ```
2. Navigate to the RunPod Console -> Serverless -> **My Templates**.
3. Create a new template using your pushed Docker Image, set the container start command to `python server.py`, and expose port `50051`.
4. Create a serverless endpoint using the template and select a GPU (e.g. RTX 4090).
5. Set `CLOUD_GPU_ENDPOINT_URL` in the Argus OS environment to point to the RunPod API endpoint.
