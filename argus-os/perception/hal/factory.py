import os
import logging
from hal.base import BaseInferenceProvider

logger = logging.getLogger("app.hal.factory")

class InferenceHALFactory:
    """Factory to resolve and load the configured hardware inference provider dynamically."""
    
    @staticmethod
    def get_provider() -> BaseInferenceProvider:
        # Read the environment variable, default to CPU
        provider_type = os.getenv("INFERENCE_PROVIDER", "CPU").upper()
        logger.info(f"Resolving HAL Inference Provider for type: {provider_type}...")
        
        if provider_type == "CPU":
            from hal.providers.cpu import CPUProvider
            return CPUProvider()
        elif provider_type == "CUDA":
            from hal.providers.cuda import CUDAProvider
            return CUDAProvider()
        elif provider_type == "TENSORRT":
            from hal.providers.tensorrt import TensorRTProvider
            return TensorRTProvider()
        elif provider_type == "CLOUD_GPU":
            from hal.providers.cloud_gpu import CloudGPUProvider
            return CloudGPUProvider()
        else:
            logger.warning(f"Unknown INFERENCE_PROVIDER '{provider_type}'. Falling back to CPUProvider.")
            from hal.providers.cpu import CPUProvider
            return CPUProvider()
