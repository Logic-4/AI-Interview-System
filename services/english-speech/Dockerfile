FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=180 \
    HF_HOME=/runpod-volume/huggingface \
    REQUIRE_CUDA=1
RUN sed -i 's|http://archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g; s|http://security.ubuntu.com/ubuntu|https://security.ubuntu.com/ubuntu|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true \
    && printf 'Acquire::Retries "5";\nAcquire::http::Timeout "60";\nAcquire::https::Timeout "60";\n' > /etc/apt/apt.conf.d/99network-retries \
    && apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 espeak-ng \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=cache,target=/wheelhouse \
    set -eux; \
    python -m pip install --retries 10 --timeout 180 --upgrade pip; \
    downloaded=0; \
    for attempt in 1 2 3 4 5 6 7 8; do \
        if python -m pip download \
            --retries 10 \
            --resume-retries 10 \
            --timeout 180 \
            --prefer-binary \
            --dest /wheelhouse \
            -r requirements.txt; then \
            downloaded=1; \
            break; \
        fi; \
        echo "Dependency download attempt ${attempt}/8 failed; keeping completed wheels and retrying..."; \
        sleep 10; \
    done; \
    test "$downloaded" = "1"; \
    python -m pip install \
        --no-index \
        --find-links=/wheelhouse \
        -r requirements.txt
COPY worker.py handler.py ./
CMD ["python", "-u", "handler.py"]
