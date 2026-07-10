import logging
import os
import cv2
from typing import List, Dict, Any, Optional
import numpy as np
from hal.base import BaseInferenceProvider

logger = logging.getLogger("app.hal.providers.tensorrt")

class TensorRTProvider(BaseInferenceProvider):
    """HAL provider executing inference using NVIDIA TensorRT engine bindings, optimized for Jetson Edge platforms."""

    def __init__(self) -> None:
        self.model_name = None
        self.target_classes = set()
        self.confidence_threshold = 0.25
        self.engine = None
        self.context = None
        self.stream = None
        self.inputs = []
        self.outputs = []
        self.bindings = []

    def initialize(self, model_name: str, target_classes: List[int], confidence_threshold: float = 0.25) -> None:
        logger.info(f"Initializing NVIDIA Jetson TensorRT engine for model: {model_name}...")
        self.model_name = model_name
        self.target_classes = set(target_classes)
        self.confidence_threshold = confidence_threshold
        
        # Determine the engine filepath (.pt -> .engine)
        engine_file = model_name
        if model_name.endswith(".pt"):
            engine_file = model_name.replace(".pt", ".engine")

        if not os.path.exists(engine_file):
            logger.warning(f"TensorRT engine file '{engine_file}' not found. Make sure weights are exported via YOLO export(format='engine').")
            return

        try:
            import tensorrt as trt
            import pycuda.driver as cuda
            import pycuda.autoinit

            logger.info(f"Deserializing TensorRT CUDA engine from {engine_file}...")
            trt_logger = trt.Logger(trt.Logger.WARNING)
            with open(engine_file, "rb") as f, trt.Runtime(trt_logger) as runtime:
                self.engine = runtime.deserialize_cuda_engine(f.read())
            
            self.context = self.engine.create_execution_context()
            self.stream = cuda.Stream()
            
            # Bindings allocation setup
            for binding in self.engine:
                size = trt.volume(self.engine.get_binding_shape(binding)) * self.engine.max_batch_size
                dtype = trt.nptype(self.engine.get_binding_dtype(binding))
                # Allocate host and device buffers
                host_mem = cuda.pagelocked_empty(size, dtype)
                device_mem = cuda.mem_alloc(host_mem.nbytes)
                self.bindings.append(int(device_mem))
                if self.engine.binding_is_input(binding):
                    self.inputs.append({"host": host_mem, "device": device_mem})
                else:
                    self.outputs.append({"host": host_mem, "device": device_mem})
            
            logger.info("TensorRT Jetson provider successfully initialized and memory bound.")

        except ImportError as e:
            logger.error(f"PyCUDA/TensorRT modules not installed on this device: {e}")
            logger.warning("TensorRTProvider loaded as mock. This is normal in non-Jetson dev environments.")
        except Exception as e:
            logger.error(f"Error during TensorRT deserialization: {e}")

    def predict(self, frame: np.ndarray, persist: bool = True) -> List[Dict[str, Any]]:
        if self.context is None or frame is None or frame.size == 0:
            return []

        predictions = []
        try:
            import pycuda.driver as cuda
            input_shape = self.engine.get_binding_shape(0)
            h, w = input_shape[2], input_shape[3]
            resized = cv2.resize(frame, (w, h))
            img_data = resized.transpose((2, 0, 1)).astype(np.float32) / 255.0
            np.copyto(self.inputs[0]["host"], img_data.ravel())

            cuda.memcpy_htod_async(self.inputs[0]["device"], self.inputs[0]["host"], self.stream)
            self.context.execute_async_v2(bindings=self.bindings, stream_handle=self.stream.handle)
            cuda.memcpy_dtoh_async(self.outputs[0]["host"], self.outputs[0]["device"], self.stream)
            self.stream.synchronize()

            # (Post-processing logic to compile results)
            pass

        except Exception as e:
            logger.error(f"Error during Jetson TensorRT execution: {e}")

        return predictions
