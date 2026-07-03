"""
Minimal fine-tuning example (causal LM) using Hugging Face Trainer.
This is a scaffold - adapt dataset loading, hyperparams, and compute to your environment.
"""
from pathlib import Path
from datasets import load_dataset
from transformers import (
    AutoTokenizer, AutoModelForCausalLM, Trainer, TrainingArguments, DataCollatorForLanguageModeling
)

MODEL_NAME = "gpt2"
OUTPUT_DIR = "checkpoints/fable5-small"


def main():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)

    # Example dataset: tiny wikitext split for demonstration
    ds = load_dataset("wikitext", "wikitext-2-raw-v1", split="train[:1%]")

    def tokenize(ex):
        return tokenizer(ex["text"], truncation=True, max_length=512)

    tokenized = ds.map(tokenize, batched=True, remove_columns=["text"])
    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=2,
        num_train_epochs=1,
        save_steps=500,
        logging_steps=100,
        fp16=False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=data_collator,
    )

    trainer.train()
    trainer.save_model(OUTPUT_DIR)


if __name__ == "__main__":
    main()
