# Model integration guide: Somali ASR, Aya chat, Somali TTS

This document is a technical audit of the three Hugging Face models used in this workspace and a practical guide to running them together (speech in → text → reply text → speech out).

| Model | Hub ID | Role | Typical size |
|--------|--------|------|----------------|
| ASR | [`skydheere/wav2vec2-large-mms-1b-somalia`](https://huggingface.co/skydheere/wav2vec2-large-mms-1b-somalia) | Audio → Somali text | ~3.9 GB |
| LLM | [`CohereLabs/aya-expanse-8b`](https://huggingface.co/CohereLabs/aya-expanse-8b) (or **32B**) | Text → text (chat) | ~16 GB (8B fp16) / ~64+ GB (32B) |
| TTS | [`facebook/mms-tts-som`](https://huggingface.co/facebook/mms-tts-som) | Somali text → waveform | ~145–291 MB |

All three ship under **CC-BY-NC-4.0** (non-commercial). The **Aya Expanse 32B** checkpoint is additionally **gated** on Hugging Face (accept terms + authenticated download).

---

## Part 1 — Deep audit: model 1 — Somali ASR

### Purpose

Convert **spoken Somali** (mono PCM) into **written text**. This is **automatic speech recognition (ASR)**, not translation unless you explicitly translate elsewhere.

### Architecture

- **Backbone:** Wav2Vec2 **Large**, initialized from Meta’s multilingual speech pretraining ([`facebook/mms-1b-all`](https://huggingface.co/facebook/mms-1b-all) lineage): a **Transformer encoder** over raw audio frames learns speech representations without text in pretraining.
- **Fine-tuning:** Supervised **CTC** (Connectionist Temporal Classification) so frame-level hidden states align to a **vocabulary of tokens** (characters or subword units depending on tokenizer config). Transformers exposes this as `AutoModelForCTC`.
- **Decoding in this project:** **Greedy** argmax over time (`torch.argmax` on logits). No language model rescoring in `Skydheere/transcribe.py`; beam search or external LM would be future improvements.

### Data and quality expectations

The Hub card reports fine-tuning on **XTREME-S / FLEURS** Somali and a **WER ≈ 0.43** on a held-out split. That means **roughly one character/word in two may differ** from a human transcript on that benchmark — real-world telephony, noise, or dialect can be harder. Always treat ASR output as **best-effort text** for downstream LLM use.

### Inputs and preprocessing (critical)

| Requirement | Detail |
|-------------|--------|
| Sample rate | **16 kHz** mono (your code resamples with `scipy.signal.resample_poly` if needed) |
| Channels | Mono (stereo is averaged) |
| Format | WAV is safest; other formats depend on `soundfile` codecs |

Long audio: `transcribe_long.py` splits into chunks (default **20 s**), runs ASR per chunk, concatenates text — boundaries can cause **word splits** at chunk edges.

### Local loading note

`transcribe.py` uses `local_files_only=True`. The snapshot must exist under the Hugging Face cache (or a local folder passed via `from_pretrained(..., local_files=...)` if you change the code). First-time download should use `local_files_only=False` once, or `huggingface-cli download skydheere/wav2vec2-large-mms-1b-somalia`.

### Compute

- **GPU:** Strongly recommended; ~1B parameters plus activations.
- **CPU:** Possible but slow for long audio.

---

## Part 2 — Deep audit: model 2 — Aya Expanse (8B / 32B)

### Purpose

**Multilingual text generation** in a **chat** setting: given system + user messages, produce an assistant reply. It does **not** process audio; it only sees **text** (e.g. ASR output).

### Architecture

- **Causal decoder-only Transformer** (`AutoModelForCausalLM`), trained for broad multilingual coverage (Aya / Cohere Expanse family).
- **Chat formatting:** Tokenizer **`apply_chat_template`** wraps `system` / `user` / assistant roles into the model’s expected special-token layout before `generate()`.

### 8B vs 32B

| | **8B** | **32B** |
|---|--------|--------|
| **VRAM (rough, fp16)** | One mid-range GPU often suffices | Multiple GPUs or aggressive quantization |
| **Quality** | Strong for many tasks | Often better reasoning / instruction following |
| **Hub access** | Check license + any gating on the card | **Gated** — login, accept terms, use `HF_TOKEN` |
| **This repo default** | `CohereLabs/aya-expanse-8b` in `chatbot-service/app.py` | Mentioned as optional upgrade |

### Generation settings (current code)

`chatbot-service/app.py` uses sampling (`temperature=0.7`, `top_p=0.9`, `max_new_tokens=150`). Tuning these trades fluency vs. determinism.

### Somali caveat

Aya is multilingual, but **Somali may be lower-resource** in pretraining vs. English. Validate replies for your domain; consider Somali-specific system prompts or few-shot examples if quality is weak.

### Compute

- **8B fp16:** Often **~16 GB** VRAM for weights alone; more with KV cache during generation.
- **32B:** Plan for **multi-GPU**, **quantization** (bitsandbytes, GGUF via other stacks), or cloud inference.

---

## Part 3 — Deep audit: model 3 — Somali MMS TTS

### Purpose

Convert **written Somali text** into a **speech waveform** (one voice/style per checkpoint). **Not** open-domain dialogue — it only speaks the string you pass in.

### Architecture

- **VITS** (Variational Inference with adversarial learning for end-to-end TTS): end-to-end text → acoustic features → waveform, implemented in Transformers as `VitsModel`.
- **MMS:** One checkpoint per language from Meta’s MMS TTS release; this one is **ISO 639-3 `som`** (Somali).

### Inputs and outputs

- **Input:** Somali text string → `AutoTokenizer` → tensor ids.
- **Output:** `outputs.waveform` at **`model.config.sampling_rate`** (written to WAV in `tts-service/service.py`).

### Stochasticity

VITS can be **non-deterministic** (duration / sampling). For repeatable demos, set **PyTorch** and **NumPy** seeds if you need identical waveforms.

### Compute

- Much smaller than ASR/LLM; **CPU** is often acceptable for short phrases.

---

## Part 4 — System architecture (how the three connect)

```
┌─────────────┐    ┌──────────────────────┐    ┌─────────────────┐    ┌─────────────┐
│ User audio  │───▶│ Wav2Vec2 CTC (ASR)   │───▶│ Aya Expanse     │───▶│ VITS TTS    │───▶ WAV
│ (e.g. WAV)  │    │ Somali text          │    │ (text reply)    │    │ Somali      │
└─────────────┘    └──────────────────────┘    └─────────────────┘    └─────────────┘
     :8001                  │                          :8000                 :8002
```

- **Language consistency:** ASR and TTS are tuned for **Somali**. The LLM should receive **Somali text** and ideally reply in **Somali** if you want natural TTS (set the system prompt accordingly).
- **Failure modes:** ASR errors propagate to the LLM; the LLM may answer in the wrong language; TTS will speak whatever characters it gets.

---

## Part 5 — Prerequisites

### Software

- **Python 3.10+** recommended.
- **PyTorch** with CUDA if you use a GPU (install from [pytorch.org](https://pytorch.org/) to match your CUDA version).
- **Transformers** version that supports `VitsModel`, `Wav2Vec2ForCTC`, and Cohere’s model class (pin versions in production).

### Hugging Face authentication

- **Public weights:** MMS TTS and the Skydheere ASR repo are downloadable without special agreement (subject to license).
- **Gated models (e.g. Aya 32B):** Create a token at [Hugging Face settings](https://huggingface.co/settings/tokens), accept the model card terms, then:

  ```bash
  export HF_TOKEN=hf_...
  huggingface-cli login
  ```

### Disk space (order of magnitude)

- ASR: ~4 GB  
- Aya 8B: ~16 GB (fp16)  
- Aya 32B: tens of GB sharded  
- TTS: &lt;1 GB  

---

## Part 6 — Downloading and caching models

### Option A — Automatic on first `from_pretrained`

Running each service once with network access will populate `~/.cache/huggingface/hub/`.

### Option B — CLI prefetch

```bash
huggingface-cli download facebook/mms-tts-som
huggingface-cli download skydheere/wav2vec2-large-mms-1b-somalia
huggingface-cli download CohereLabs/aya-expanse-8b
```

### ASR and `local_files_only=True`

Your `Skydheere/transcribe.py` requires an **offline** snapshot. After the first successful download, keep the cache or set `local_files_only=False` during development.

---

## Part 7 — Python environments

Three folders each have a `requirements.txt`. For a **single venv** integrating everything, merge at minimum:

- From `tts-service`: `torch`, `transformers`, `accelerate`, `scipy`, `soundfile`, `fastapi`, `uvicorn`
- From `Skydheere`: `soundfile`, `scipy`, `numpy`, `transformers`, `accelerate`, `huggingface_hub`, `safetensors` (optional: `librosa`, `jiwer`, `datasets`)
- From `chatbot-service`: `torch`, `transformers`, `accelerate`, `sentencepiece`, `fastapi`, `uvicorn`

Install **one** PyTorch build (CUDA vs CPU) for all services.

---

## Part 8 — Running the three HTTP services (recommended ports)

Avoid port clashes: **chat 8000**, **ASR 8001**, **TTS 8002**.

### Terminal 1 — ASR (project root)

Runs `stt_service.py`, which adds `Skydheere/` to `sys.path` and reuses `transcribe.py`.

```bash
cd /path/to/Models
python -m uvicorn stt_service:app --host 127.0.0.1 --port 8001
```

### Terminal 2 — Chat (Aya)

```bash
cd /path/to/Models/chatbot-service
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

To use **32B**, change `model_name` in `AyaChatbot` and ensure GPU memory / quantization strategy matches your hardware.

### Terminal 3 — TTS

```bash
cd /path/to/Models/tts-service
python -m uvicorn main:app --host 127.0.0.1 --port 8002
```

Or: `python main.py` (binds **8002** via `uvicorn` in `main.py`).

### Health checks

```bash
curl -s http://127.0.0.1:8001/health
curl -s http://127.0.0.1:8000/docs
curl -s http://127.0.0.1:8002/health
```

---

## Part 9 — End-to-end pipeline script

`chatbot-service/pipeline.py` calls:

1. `POST http://127.0.0.1:8001/transcribe` — multipart file → `{ "transcription": "..." }`
2. `POST http://127.0.0.1:8000/generate_reply` — JSON body → `{ "reply": "..." }`
3. `POST http://127.0.0.1:8002/synthesize` — JSON `{ "text", "output_filename" }` then `GET .../audio/<filename>` to fetch the WAV bytes

Example:

```bash
cd /path/to/Models/chatbot-service
pip install requests
python pipeline.py ../Skydheere/audio/sample.wav ./out_reply.wav
```

---

## Part 10 — API reference (this repo)

### ASR (`stt_service.py`)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/health` | — | `{ "status", "model" }` |
| POST | `/transcribe` | `multipart/form-data` file field `file` | `{ "transcription", "model", "device" }` |

### Chat (`chatbot-service/app.py`)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/generate_reply` | `{ "user_text", "system_prompt"? }` | `{ "reply" }` |

### TTS (`tts-service/main.py`)

| Method | Path | Body / params | Response |
|--------|------|-----------------|----------|
| GET | `/health` | — | status + model + device |
| POST | `/synthesize` | `{ "text", "output_filename" }` | JSON with `output_path`, `sample_rate`, `device` |
| GET | `/audio/{filename}` | Safe `.wav` name under `outputs/` | WAV file |

---

## Part 11 — Troubleshooting

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| ASR: cannot find model | `local_files_only=True` without cache | Download once with network; or set `local_files_only=False` in `transcribe.py` for dev |
| ASR: garbage text | Wrong sample rate / language | Ensure 16 kHz mono; confirm audio is Somali |
| LLM: OOM | Model too large for VRAM | Use 8B, shorter `max_new_tokens`, 4/8-bit load, or CPU (slow) |
| LLM: 401 / gated | No token or not accepted | `huggingface-cli login` and accept model card |
| TTS: empty / bad audio | Empty string or wrong tokenizer | Non-empty Somali text; check tokenizer warnings |
| Pipeline: connection refused | Service not started or wrong port | Match ports 8000 / 8001 / 8002 |
| Chunked ASR: duplicated words | Chunk boundaries | Reduce chunk length overlap or add future overlap-merge logic |

---

## Part 12 — Security and production notes

- **Do not expose** these services to the public internet without authentication, rate limits, and payload size limits on `/transcribe`.
- **Non-commercial license** applies to model *weights*; comply with CC-BY-NC-4.0 for your use case.
- **Pickle warnings** on some Hub repos refer to legacy `pytorch_model.bin`; prefer **`safetensors`** when available.

---

## Revision history (repository)

- `tts-service/main.py`: `GET /audio/{filename}` for pipeline-friendly WAV fetch; `python main.py` listens on **8002**.
- `stt_service.py` (project root): FastAPI ASR that wraps `Skydheere/transcribe.py`.
- `chatbot-service/pipeline.py`: Aligns with the three services and fetches TTS audio over HTTP.

For questions specific to upstream training details, see each model’s **Model card** and papers (MMS: [arXiv:2305.13516](https://arxiv.org/abs/2305.13516)).
