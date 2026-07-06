# Gemma Interview Worker (RunPod Serverless)

Hosts `Mohamud24/gemma-3-technical-interviewer` on RunPod Serverless so your Node backend no longer depends on Kaggle notebooks.

## What you need

| Item | Where |
|------|--------|
| RunPod account + **$10 credit** | [runpod.io](https://www.runpod.io) |
| **RunPod API key** | Console → Settings → API Keys |
| **HF_TOKEN** | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (read access to your gated Gemma model) |
| **24 GB GPU tier** | L4 / 3090 / 4090 / A5000 (~$0.69/hr on Serverless) (Note: Blackwell GPUs are not supported by the default PyTorch 2.4 image) |

Do **not** put Somali ASR/TTS/Piper on this worker for now — keep those on your PC or a cheap CPU VPS.

---

## Step 1 — Build & push the Docker image

From your machine (Docker Desktop installed, logged into Docker Hub or GHCR):

```bash
cd services/gemma

# Replace YOUR_DOCKERHUB_USER
docker build -t YOUR_DOCKERHUB_USER/ai-interview-gemma:latest .
docker push YOUR_DOCKERHUB_USER/ai-interview-gemma:latest
```

---

## Step 2 — Create a Serverless endpoint on RunPod

1. Open [console.runpod.io/serverless](https://console.runpod.io/serverless)
2. **New Endpoint** → **Import from Docker Registry**
3. Image: `YOUR_DOCKERHUB_USER/ai-interview-gemma:latest`
4. **GPU:** 24 GB tier (L4 / RTX 3090 / RTX 4090 / A5000) - **Do NOT choose Blackwell GPUs (such as RTX PRO 6000 Blackwell)** as they require a newer CUDA 12.8 + PyTorch compilation environment (`sm_120` compute capability).
5. **Container disk:** at least **20 GB** (model weights)
6. **Environment variables:**
   - `HF_TOKEN` = your Hugging Face token
   - `GEMMA_MODEL_ID` = `Mohamud24/gemma-3-technical-interviewer` (optional)
7. **Active workers:** `0` (saves money; first request is slower)
8. **Max workers:** `1` (enough for small traffic)
9. **Idle timeout:** `5–10` seconds (stop billing soon after idle)
10. Create endpoint → copy the **Endpoint ID** (looks like `abc123xyz`)

---

## Step 3 — Configure your backend `.env`

```bash
# RunPod Serverless (replaces Kaggle URL)
KAGGLE_API_URL=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID
RUNPOD_API_KEY=rpa_xxxxxxxxxxxxxxxx

# Optional: app-level key is NOT used for RunPod auth (RunPod uses RUNPOD_API_KEY)
# GEMMA_API_KEY=
```

Or set in Dashboard → Settings → Kaggle API URL:

```
https://api.runpod.ai/v2/YOUR_ENDPOINT_ID
```

Restart the backend after changing `.env`.

---

## Step 4 — Test

```bash
# Health (uses RunPod runsync)
curl -X POST "https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync" \
  -H "Authorization: Bearer YOUR_RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"input\":{\"endpoint\":\"/health\",\"payload\":{}}}"
```

First call after idle can take **1–3 minutes** (worker start + model load). Later calls should be a few seconds.

Then start an interview in the app. Backend logs should show:

```
[kaggleService] POST /interview-turn via RunPod Serverless
```

---

## Cost tips ($10 credit)

| Action | Effect |
|--------|--------|
| Active workers = **0** | No charge when idle |
| Idle timeout **5–10s** | Stops GPU soon after last request |
| Stop testing when done | Don’t leave long interviews running overnight |
| ~$0.69/hr for 24 GB | ~14 hours of active GPU time from $10 |

---

## Endpoints supported

Same as Kaggle FastAPI:

| Endpoint | Purpose |
|----------|---------|
| `/health` | Status |
| `/interview-turn` | Score answer + next line |
| `/generate-question` | One interview question |
| `/parse` | Job description parse |
| `/feedback` | End-of-session feedback |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Unauthorized` from RunPod | Check `RUNPOD_API_KEY` |
| Model download fails | Check `HF_TOKEN` and model access on Hugging Face |
| OOM / worker crash | Use **24 GB** GPU, not 16 GB |
| First request times out | Increase backend timeout or warm with a `/health` call first |
| Backend still hits Kaggle | Clear MongoDB `KAGGLE_API_URL` override in Settings, or set the RunPod URL there |
