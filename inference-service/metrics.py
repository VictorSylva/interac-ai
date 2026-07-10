import time
import os
import logging
from typing import Dict, Any

logger = logging.getLogger("app.metrics")

class PerformanceMonitor:
    """Calculates and reports real-time system performance metrics (latencies, GPU/CPU loads)."""

    def __init__(self) -> None:
        self.start_time = time.time()
        self.processed_frames = 0
        self.total_latency_ms = 0
        self.dropped_frames = 0

    def record_frame(self, latency_ms: float) -> None:
        self.processed_frames += 1
        self.total_latency_ms += latency_ms

    def record_drop(self) -> None:
        self.dropped_frames += 1

    def get_stats(self) -> Dict[str, Any]:
        uptime = time.time() - self.start_time
        avg_latency = (self.total_latency_ms / self.processed_frames) if self.processed_frames > 0 else 0.0
        
        # System Resource Usage
        cpu_pct = 0.0
        ram_bytes = 0
        try:
            import psutil
            process = psutil.Process(os.getpid())
            ram_bytes = process.memory_info().rss
            cpu_pct = psutil.cpu_percent(interval=None)
        except ImportError:
            logger.debug("psutil dependency not installed. Resource metrics will fallback to default.")
        except Exception as e:
            logger.error(f"Error extracting system process metrics: {e}")

        # GPU Utilization
        gpu_pct = 0.0
        gpu_memory_bytes = 0
        try:
            import pynvml
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            gpu_pct = float(util.gpu)
            gpu_memory_bytes = mem_info.used
        except ImportError:
            # Silence warning if pynvml is not installed on CPU instances
            pass
        except Exception as e:
            # Fallback (e.g. if CUDA is uninitialized)
            pass

        return {
            "uptime_seconds": uptime,
            "processed_frames": self.processed_frames,
            "dropped_frames": self.dropped_frames,
            "average_latency_ms": avg_latency,
            "cpu_percent": cpu_pct,
            "ram_usage_bytes": ram_bytes,
            "gpu_percent": gpu_pct,
            "vram_usage_bytes": gpu_memory_bytes
        }

performance_monitor = PerformanceMonitor()
