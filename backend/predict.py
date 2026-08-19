import json
import os
import threading

import psycopg
import torch

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer
)

from train import train_model


MODEL_ROOT = "./model"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:ahmed123@localhost:5432/customer_support"
)

UPDATE_AFTER = 5

device = torch.device(
    "cuda"
    if torch.cuda.is_available()
    else "cpu"
)

app = FastAPI(
    title="Customer Support AI"
)

model_lock = threading.Lock()

training_lock = threading.Lock()

model = None
tokenizer = None

model_version = None
model_accuracy = None

last_trained_count = 0


class PredictionRequest(BaseModel):

    question: str


class FeedbackRequest(BaseModel):

    text: str
    department: str
    ticket_id: int | None = None
    created_by: int | None = None
    source: str = "ticket"


def load_active_model():

    global model
    global tokenizer
    global model_version
    global model_accuracy
    global last_trained_count

    active_file = os.path.join(
        MODEL_ROOT,
        "active.json"
    )

    if not os.path.exists(
        active_file
    ):

        raise RuntimeError(
            "No trained model exists. "
            "Run train.py first."
        )

    with open(
        active_file,
        "r",
        encoding="utf-8"
    ) as f:

        info = json.load(f)

    version = info["version"]

    model_path = os.path.join(
        MODEL_ROOT,
        f"v{version}"
    )

    new_tokenizer = (
        AutoTokenizer.from_pretrained(
            model_path
        )
    )

    new_model = (
        AutoModelForSequenceClassification
        .from_pretrained(
            model_path
        )
    )

    new_model.to(device)
    new_model.eval()

    with model_lock:

        model = new_model
        tokenizer = new_tokenizer

        model_version = version
        model_accuracy = info.get(
            "accuracy"
        )

        last_trained_count = info.get(
            "training_examples_count",
            0
        )

    print(
        f"Loaded model v{version}"
    )


def get_training_count():

    with psycopg.connect(
        DATABASE_URL
    ) as conn:

        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT COUNT(*)
                FROM training_examples
                """
            )

            return cur.fetchone()[0]


def get_department_id(
    department
):

    with psycopg.connect(
        DATABASE_URL
    ) as conn:

        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT id
                FROM departments
                WHERE name = %s
                """,
                (department,)
            )

            row = cur.fetchone()

            if not row:

                return None

            return row[0]


def insert_training_example(
    text,
    department,
    ticket_id,
    created_by,
    source
):

    department_id = get_department_id(
        department
    )

    if department_id is None:

        raise ValueError(
            f"Department '{department}' does not exist."
        )

    with psycopg.connect(
        DATABASE_URL
    ) as conn:

        with conn.cursor() as cur:

            cur.execute(
                """
                INSERT INTO training_examples
                (
                    text,
                    department_id,
                    source,
                    ticket_id,
                    created_by
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                ON CONFLICT (
                    text,
                    department_id
                )
                DO NOTHING
                RETURNING id
                """,
                (
                    text,
                    department_id,
                    source,
                    ticket_id,
                    created_by
                )
            )

            row = cur.fetchone()

        conn.commit()

    return row[0] if row else None


def start_background_training():

    if training_lock.locked():

        print(
            "[AI] Training already running."
        )

        return

    thread = threading.Thread(
        target=background_training,
        daemon=True
    )

    thread.start()


def background_training():

    global last_trained_count

    if not training_lock.acquire(
        blocking=False
    ):

        return

    try:

        print(
            "\n================================"
        )

        print(
            "[AI] BACKGROUND TRAINING STARTED"
        )

        print(
            "================================"
        )

        count_before = (
            get_training_count()
        )

        print(
            f"[AI] Training on "
            f"{count_before} examples."
        )

        success = train_model()

        if success:

            load_active_model()

            last_trained_count = (
                get_training_count()
            )

            print(
                "[AI] New model loaded."
            )

        else:

            print(
                "[AI] Candidate rejected."
            )

    except Exception as e:

        print(
            f"[AI] Training failed: {e}"
        )

    finally:

        training_lock.release()

        current_count = (
            get_training_count()
        )

        if (
            current_count
            - last_trained_count
            >= UPDATE_AFTER
        ):

            print(
                "[AI] More training examples "
                "arrived during training."
            )

            start_background_training()


def predict_question(
    question
):

    with model_lock:

        inputs = tokenizer(
            question,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=128
        )

        inputs = {
            key: value.to(device)
            for key, value in inputs.items()
        }

        with torch.no_grad():

            outputs = model(
                **inputs
            )

        probabilities = torch.softmax(
            outputs.logits,
            dim=-1
        )

        confidence, prediction = (
            torch.max(
                probabilities,
                dim=-1
            )
        )

        category = model.config.id2label[
            prediction.item()
        ]

        return (
            category,
            confidence.item()
        )


@app.on_event("startup")
def startup():

    load_active_model()


@app.get("/health")
def health():

    return {
        "status": "ok",
        "model_version": model_version,
        "accuracy": model_accuracy,
        "device": str(device),
        "training": training_lock.locked()
    }


@app.post("/predict")
def predict(
    request: PredictionRequest
):

    question = request.question.strip()

    if not question:

        raise HTTPException(
            status_code=400,
            detail="Question is required."
        )

    category, confidence = (
        predict_question(
            question
        )
    )

    return {
        "department": category,
        "confidence": confidence,
        "confidence_percent": round(
            confidence * 100,
            2
        ),
        "model_version": model_version
    }


@app.post("/feedback")
def feedback(
    request: FeedbackRequest
):

    text = request.text.strip()

    if not text:

        raise HTTPException(
            status_code=400,
            detail="Text is required."
        )

    if request.source not in [
        "ticket",
        "correction",
        "manual"
    ]:

        raise HTTPException(
            status_code=400,
            detail="Invalid source."
        )

    inserted_id = insert_training_example(
        text=text,
        department=request.department,
        ticket_id=request.ticket_id,
        created_by=request.created_by,
        source=request.source
    )

    if inserted_id is None:

        return {
            "success": True,
            "message": "Training example already exists.",
            "training_started": False
        }

    current_count = (
        get_training_count()
    )

    new_examples = (
        current_count
        - last_trained_count
    )

    training_started = False

    if new_examples >= UPDATE_AFTER:

        start_background_training()

        training_started = True

    return {
        "success": True,
        "training_example_id": inserted_id,
        "new_examples_since_training": new_examples,
        "training_started": training_started
    }


@app.post("/retrain")
def retrain():

    if training_lock.locked():

        return {
            "success": True,
            "message": "Training already running."
        }

    start_background_training()

    return {
        "success": True,
        "message": "Background training started."
    }