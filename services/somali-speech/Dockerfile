# Somali STT + TTS worker for RunPod Serverless
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

# Install ffmpeg for robust audio format decoding/resampling
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --upgrade -r requirements.txt

COPY worker.py handler.py ./

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/runpod-volume/huggingface

CMD ["python", "-u", "handler.py"]
