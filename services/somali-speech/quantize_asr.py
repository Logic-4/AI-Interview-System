"""
One-time script: export Somali ASR model to ONNX and quantize to int8.

Run on any machine with ~6 GB RAM + internet access:
  python quantize_asr.py

Produces:
  wav2vec2-somali-onnx/model.onnx   ← fp32 master copy (~3.9 GB)
  wav2vec2-somali-int8.onnx         ← int8 quantized (~1 GB), use this for CPU
  wav2vec2-somali-uint8.onnx        ← uint8 alternative (test both, pick lower WER)

To use: set env vars in worker before starting:
  USE_ONNX=1
  ONNX_MODEL_PATH=wav2vec2-somali-int8.onnx   (or uint8 variant)
"""

import os
import subprocess
import sys

MODEL_ID  = os.environ.get("ASR_MODEL_ID", "skydheere/wav2vec2-large-mms-1b-somalia")
ONNX_DIR  = "wav2vec2-somali-onnx"
INT8_OUT  = "wav2vec2-somali-int8.onnx"
UINT8_OUT = "wav2vec2-somali-uint8.onnx"

try:
    from onnxruntime.quantization import QuantType, quantize_dynamic
    import optimum  # noqa: F401
except ImportError:
    sys.exit("Install deps: pip install optimum[exporters] onnxruntime")

# Step 1: export fp32 ONNX
print(f"Exporting {MODEL_ID} to ONNX (fp32)…")
subprocess.run(
    [
        sys.executable, "-m", "optimum.exporters.onnx",
        "--model", MODEL_ID,
        "--task", "automatic-speech-recognition",
        ONNX_DIR,
    ],
    check=True,
)
print(f"fp32 ONNX saved to {ONNX_DIR}/model.onnx  ← keep as master copy")

src = os.path.join(ONNX_DIR, "model.onnx")

# Step 2: int8 (signed)
print("\nQuantizing → int8…")
quantize_dynamic(src, INT8_OUT, weight_type=QuantType.QInt8)
print(f"int8 model: {INT8_OUT}")

# Step 3: uint8 (unsigned) — wav2vec2 encoder sometimes prefers this
print("Quantizing → uint8…")
quantize_dynamic(src, UINT8_OUT, weight_type=QuantType.QUInt8)
print(f"uint8 model: {UINT8_OUT}")

print(
    "\nDone. Test both quant variants for WER on Somali audio clips, then set "
    "ONNX_MODEL_PATH to whichever scores better."
)
