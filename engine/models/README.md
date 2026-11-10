# Kokoro TTS model files

Kokoro-82M v1.0 (ONNX export from the kokoro-onnx project, model-files-v1.0 release), Apache License 2.0.
kokoro-v1.0.onnx is stored as 90 MB parts because GitHub refuses single files over 100 MB.
`bash engine/setup-voice.sh` joins the parts, checks SHA256SUMS and installs the Python packages.
The joined kokoro-v1.0.onnx is git-ignored.
