# AI Interview System

AI-powered mock interview training platform with Somali and English speech support.

## Tech Stack

- **Backend:** Node.js (v20), Express, MongoDB
- **Frontend:** React, Vite, TailwindCSS, Zustand, Radix UI
- **AI Models:** Fine-tuned Gemma 4 (interviewer LLM) + Somali wav2vec2 ASR

---

## Quick Start

```bash
# Install backend deps
npm install

# Install frontend deps
cd frontend && npm install

# Start backend (dev)
npm run dev

# Start frontend (dev)
cd frontend && npm run dev
```

Seed a superadmin account:

```bash
npm run seed:superadmin
```

---

## Environment Variables

Copy `.env` and fill in your values. Key variables:

```env
MONGO_URI=mongodb://localhost:27017/interviewai_pro
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# AI model URLs (see Colab setup below)
GEMMA_API_URL=https://your-ngrok-domain.ngrok-free.app
SOMALI_ASR_URL=https://your-other-ngrok-domain.ngrok-free.app

# Optional: RunPod (production)
RUNPOD_API_KEY=...

# Face verification (Face++)
FACEPP_API_KEY=...
FACEPP_API_SECRET=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email (Resend)
RESEND_API_KEY=...

# Vercel Blob storage
BLOB_READ_WRITE_TOKEN=...

# Gemini (STT fallback)
GEMINI_API_KEY=...
```

---

## Running AI Models on Google Colab (Free)

Both AI models can be served for free using Google Colab + ngrok. Each runs as a FastAPI server exposed via a public ngrok URL that you paste into your `.env`.

### Prerequisites

1. A free [ngrok account](https://dashboard.ngrok.com) — grab an **auth token** and claim a free **static domain** (one per service).
2. A Hugging Face account with access to `google/gemma-4-e2b-it` (gated model — request access at huggingface.co).

---

### Service 1 — Gemma 4 Interviewer LLM

**Notebook:** `services/gemma/Colab_Gemma_LLM_Server.ipynb`

#### Colab Secrets required

Add these in the 🔑 **Secrets** sidebar (left panel in Colab):

| Secret name | Where to get it |
|---|---|
| `HF_TOKEN` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) — needs read access to gated models |
| `NGROK_TOKEN` | [dashboard.ngrok.com/authtokens](https://dashboard.ngrok.com/authtokens) |
| `NGROK_DOMAIN` | [dashboard.ngrok.com/domains](https://dashboard.ngrok.com/domains) — claim a free static domain |

#### Steps

1. Open `services/gemma/Colab_Gemma_LLM_Server.ipynb` in Google Colab.
2. Set runtime: **Runtime → Change runtime type → A100 GPU** (required for 4-bit loading).
3. Add the three secrets above via the 🔑 icon.
4. Run **Cell 1** — installs dependencies.
5. Run **Cell 2** — verifies GPU is available.
6. Run **Cell 3** — loads `google/gemma-4-e2b-it` base + `Mohamud24/gemma-4-tech-interviewer` LoRA adapter.
7. Run **Cell 4** — starts FastAPI on port 8000 and opens the ngrok tunnel.
8. Copy the printed URL and set in your backend `.env`:
   ```env
   GEMMA_API_URL=https://your-static-domain.ngrok-free.app
   ```

---

### Service 2 — Somali ASR (Speech-to-Text)

**Notebook:** `services/somali-speech/Colab_Somali_ASR_Server.ipynb`

#### Colab Secrets required

| Secret name | Where to get it |
|---|---|
| `NGROK_TOKEN` | [dashboard.ngrok.com/authtokens](https://dashboard.ngrok.com/authtokens) |
| `NGROK_DOMAIN` | [dashboard.ngrok.com/domains](https://dashboard.ngrok.com/domains) — use a **different** static domain from the Gemma one |

No HF token needed — the model (`skydheere/wav2vec2-large-mms-1b-somalia`) is public.

#### Steps

1. Open `services/somali-speech/Colab_Somali_ASR_Server.ipynb` in Google Colab.
2. GPU is optional but recommended — CPU works but is slower.
3. Add the two secrets above via the 🔑 icon.
4. Run **Cell 1** — installs dependencies.
5. Run **Cell 2** — checks for GPU.
6. Run **Cell 3** — loads the Somali wav2vec2 ASR model.
7. Run **Cell 4** — starts FastAPI on port 8001 and opens the ngrok tunnel.
8. Copy the printed URL and set in your backend `.env`:
   ```env
   SOMALI_ASR_URL=https://your-other-static-domain.ngrok-free.app
   ```

---

### Notes

- Colab sessions time out after ~12 hours of inactivity (free tier). Re-run all cells to restart.
- You need **two separate ngrok static domains** — one per service.
- For production, swap the Colab URLs for RunPod serverless endpoints and set `RUNPOD_API_KEY`.

---

## Production (RunPod)

To use paid RunPod endpoints instead of Colab, update `.env`:

```env
GEMMA_API_URL=https://api.runpod.ai/v2/<your-gemma-endpoint-id>
SOMALI_ASR_URL=https://api.runpod.ai/v2/<your-asr-endpoint-id>
RUNPOD_API_KEY=<your-runpod-api-key>
```
