import runpod
from worker import dispatch


def handler(job):
    payload = job.get("input") or {}
    try:
        return dispatch(payload)
    except Exception as exc:
        import traceback

        traceback.print_exc()
        return {"error": str(exc), "detail": traceback.format_exc()}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
