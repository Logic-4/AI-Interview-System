# Somali STT + TTS worker for RunPod Serverless.
# CUDA 12.8 + PyTorch 2.7 supports both existing Ampere/Ada/Hopper GPUs and
# Blackwell GPUs (sm_100/sm_120). The previous cu124/torch 2.4 image could be
# scheduled on a newer GPU whose kernels were not present in that Torch build.
# Use the prebuilt PyTorch runtime so CUDA libraries are not installed twice.
FROM pytorch/pytorch:2.7.0-cuda12.8-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/runpod-volume/huggingface \
    REQUIRE_CUDA=1

# Install ffmpeg for robust audio format decoding/resampling
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN python -c "import torch; assert torch.__version__.startswith('2.7.0'); assert torch.version.cuda == '12.8'; print(torch.__version__, torch.version.cuda)" && \
    python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install --upgrade -r requirements.txt

COPY worker.py handler.py ./

CMD ["python", "-u", "handler.py"]
