import runpod
from worker import dispatch, validate_cuda_runtime


def handler(job):
    payload = job.get("input") or {}
    try:
        return dispatch(payload)
    except Exception as exc:
        import traceback

        traceback.print_exc()
        return {"error": str(exc), "detail": traceback.format_exc()}


if __name__ == "__main__":
    print("Starting RunPod Somali speech serverless worker...")
    validate_cuda_runtime()
    runpod.serverless.start({"handler": handler})
