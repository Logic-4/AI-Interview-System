# Gemma interview worker for RunPod Serverless (24 GB GPU recommended)
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --upgrade -r requirements.txt

COPY worker.py handler.py ./

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/runpod-volume/huggingface

CMD ["python", "-u", "handler.py"]
