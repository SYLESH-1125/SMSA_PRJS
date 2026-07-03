LLM Fable-5 (scaffold)

This repository is a minimal open-source scaffold to build and run a small LLM-style service inspired by "fable 5".

Quickstart (dev):
1. python -m venv .venv
2. .\.venv\Scripts\Activate.ps1
3. pip install -r requirements.txt
4. uvicorn server.app:app --host 0.0.0.0 --port 8000
5. Open http://localhost:8000

Notes:
- Default model: gpt2 (small) for quick runs. Set MODEL_NAME env var to use a different Hugging Face model or path to a fine-tuned checkpoint.
- train.py shows a minimal Hugging Face Trainer example for causal LM fine-tuning.
- This scaffold is intended for local experimentation and downstream open-source release.
