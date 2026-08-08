"""
One-time script: merge LoRA adapter into base model weights and save as fp16.

Run on any machine with 16 GB RAM + internet access (no GPU needed):
  HF_TOKEN=<token> python merge_lora.py

Output: gemma3-merged-fp16/  ← master copy, derive GGUF from this.

Next steps:
  git clone https://github.com/ggerganov/llama.cpp && cd llama.cpp
  pip install -r requirements.txt
  python convert_hf_to_gguf.py ../gemma4-e2b-merged-fp16 --outfile gemma4-e2b-f16.gguf --outtype f16
  ./llama-quantize gemma4-e2b-f16.gguf gemma4-e2b-q5_k_m.gguf Q5_K_M   # ~1.6 GB, recommended
  ./llama-quantize gemma4-e2b-f16.gguf gemma4-e2b-q4_k_m.gguf Q4_K_M   # ~1.3 GB, smaller
  ./llama-quantize gemma4-e2b-f16.gguf gemma4-e2b-q8_0.gguf   Q8_0     # ~2.1 GB, best quality

Benchmark before choosing a quant level:
  ./llama-bench -m gemma4-e2b-q5_k_m.gguf -p 512 -n 128 -t 8

Serve with Ollama:
  echo 'FROM ./gemma4-e2b-q5_k_m.gguf' > Modelfile
  ollama create gemma3-interviewer -f Modelfile
  ollama serve
"""

import os
import sys

BASE_MODEL = "google/gemma-4-e2b-it"
ADAPTER    = os.environ.get("GEMMA_MODEL_ID", "Mohamud24/gemma-4-tech-interviewer")
OUT_DIR    = os.environ.get("OUT_DIR", "gemma4-e2b-merged-fp16")
HF_TOKEN   = os.environ.get("HF_TOKEN", "").strip() or None

if not HF_TOKEN:
    sys.exit("Error: set HF_TOKEN env var (required for gated Gemma model).")

try:
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer
except ImportError:
    sys.exit("Install deps: pip install torch transformers peft accelerate")

print(f"Loading {BASE_MODEL} on CPU in fp16 (needs ~8 GB RAM)…")
base = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="cpu",
    token=HF_TOKEN,
)

print(f"Loading LoRA adapter {ADAPTER}…")
peft_model = PeftModel.from_pretrained(base, ADAPTER, token=HF_TOKEN)

print("Merging LoRA weights into base model…")
merged = peft_model.merge_and_unload()

print(f"Saving merged model → {OUT_DIR}/")
# Note: QLoRA adapter merged into fp16 base. Minor quality delta vs. 4-bit training
# environment is expected — acceptable for local CPU use.
merged.save_pretrained(OUT_DIR)
AutoTokenizer.from_pretrained(BASE_MODEL, token=HF_TOKEN).save_pretrained(OUT_DIR)

print(f"\nDone. Master copy at {OUT_DIR}/ — never delete this.")
print("Follow the comments at the top of this file for GGUF conversion steps.")
