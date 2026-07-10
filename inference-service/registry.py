import os
import json
import logging
import urllib.request
from typing import Dict, Any

logger = logging.getLogger("app.registry")

class ModelRegistry:
    """Dynamically resolves, downloads, and versions deep learning models from S3/GCS or HTTP endpoints."""

    def __init__(self, cache_dir: str = "models") -> None:
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)
        self.registry_base_url = os.getenv("MODEL_REGISTRY_URL", "")

    def resolve_model(self, model_name: str) -> str:
        """Resolves the system file path for a model. Downloads weights if not present in the local cache."""
        local_path = os.path.join(self.cache_dir, model_name)
        
        if os.path.exists(local_path):
            logger.info(f"Model {model_name} found in local cache at {local_path}.")
            return local_path

        if not self.registry_base_url:
            logger.warning(f"Model {model_name} not found locally, and no MODEL_REGISTRY_URL configured. Falling back to local search.")
            return model_name  # Ultralytics will auto-download standard weights if local file doesn't exist

        remote_url = f"{self.registry_base_url}/{model_name}"
        logger.info(f"Downloading model {model_name} from remote registry: {remote_url}...")
        
        try:
            urllib.request.urlretrieve(remote_url, local_path)
            logger.info(f"Successfully downloaded {model_name} and cached at {local_path}.")
            return local_path
        except Exception as e:
            logger.error(f"Failed to download model {model_name} from registry: {e}. Falling back to default loader.")
            return model_name

    def get_model_config(self, model_name: str) -> Dict[str, Any]:
        """Retrieves config parameters (e.g. resolution size, confidence defaults) for a specific model."""
        config_name = model_name.split('.')[0] + "_config.json"
        local_config_path = os.path.join(self.cache_dir, config_name)
        
        if os.path.exists(local_config_path):
            try:
                with open(local_config_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error reading local model config {config_name}: {e}")

        # Try download from remote registry if available
        if self.registry_base_url:
            remote_config_url = f"{self.registry_base_url}/{config_name}"
            try:
                urllib.request.urlretrieve(remote_config_url, local_config_path)
                with open(local_config_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Could not fetch config from remote registry for {model_name}: {e}")

        # Return reasonable default config
        return {
            "model_name": model_name,
            "imgsz": 320,
            "confidence_threshold": 0.25,
            "classes": {}
        }
