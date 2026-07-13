"""
RunPod Serverless entrypoint for Gemma interview inference.

IMPORTANT: Do not load the model before runpod.serverless.start().
RunPod expects the worker to become "ready" within seconds. Model load
happens on the first real inference request (/interview-turn, etc.).
"""

import sys

print("=== interview-gemma worker boot ===", flush=True)

import runpod
from worker import dispatch, validate_cuda_runtime


def handler(event):
    job_input = event.get("input") or {}

    endpoint = job_input.get("endpoint") or job_input.get("path") or "/health"
    if "payload" in job_input and isinstance(job_input["payload"], dict):
        payload = job_input["payload"]
    else:
        payload = {k: v for k, v in job_input.items() if k not in ("endpoint", "path")}

    print(f"[handler] endpoint={endpoint}", flush=True)
    result = dispatch(endpoint, payload)

    if isinstance(result, dict) and result.get("error"):
        return {"error": result["error"], "detail": result.get("detail", result["error"])}

    return result


print("Starting RunPod serverless worker...", flush=True)
validate_cuda_runtime()
runpod.serverless.start({"handler": handler})
