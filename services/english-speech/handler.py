import runpod
from worker import dispatch

runpod.serverless.start({"handler": dispatch})
