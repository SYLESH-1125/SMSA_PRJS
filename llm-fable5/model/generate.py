import os
from typing import Optional

from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM

_MODEL = None
_PIPELINE = None


def _init_model():
    global _MODEL, _PIPELINE
    if _PIPELINE is not None:
        return
    model_name = os.environ.get("MODEL_NAME", "gpt2")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(model_name)
        _PIPELINE = pipeline("text-generation", model=model, tokenizer=tokenizer, device=-1)
    except Exception as e:
        raise RuntimeError(f"Failed to load model {model_name}: {e}")


def generate_text(prompt: str, max_length: int = 128, num_return_sequences: int = 1) -> list:
    """Generate text using the configured model. Returns list of generated strings."""
    _init_model()
    outputs = _PIPELINE(prompt, max_length=max_length, num_return_sequences=num_return_sequences)
    return [o.get("generated_text", "") for o in outputs]
