#!/usr/bin/env bash
# One-time voice setup for a fresh session. Rebuilds the Kokoro model from the repo parts,
# checks it, and makes a Python venv with the voice packages (all from PyPI).
# Usage: bash engine/setup-voice.sh [venv dir]      then:  export CLOCKED_TTS_MODELS=engine/models
set -euo pipefail
cd "$(dirname "$0")/models"
if [ ! -f kokoro-v1.0.onnx ]; then cat kokoro-v1.0.onnx.part* > kokoro-v1.0.onnx; fi
sha256sum -c SHA256SUMS
VENV="${1:-$(cd ..; pwd)/.ttsenv}"
python3 -m venv "$VENV"
"$VENV/bin/pip" install -q -r ../requirements-voice.txt
echo "voice ready: python=$VENV/bin/python  models=$(pwd)"
