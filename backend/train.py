import json
import os
import shutil
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import psycopg
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support
)

from datasets import Dataset

from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer
)


MODEL_NAME = "distilbert-base-uncased"

MODEL_ROOT = "./model"

ACTIVE_FILE = os.path.join(
    MODEL_ROOT,
    "active.json"
)

GRAPH_PATH = "./loss_curve.png"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:ahmed123@localhost:5432/customer_support"
)

REPLAY_SIZE = 20

INCREMENTAL_EPOCHS = 1

FULL_EPOCHS = 3

BATCH_SIZE = 4

FULL_LEARNING_RATE = 2e-5

INCREMENTAL_LEARNING_RATE = 5e-6


def utc_now():

    return datetime.now(
        timezone.utc
    ).isoformat()


def get_active_model_info():

    if not os.path.exists(
        ACTIVE_FILE
    ):

        return None

    with open(
        ACTIVE_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


def get_next_version():

    info = get_active_model_info()

    if not info:

        return 1

    return int(
        info["version"]
    ) + 1


def get_all_training_data():

    with psycopg.connect(
        DATABASE_URL
    ) as conn:

        query = """
            SELECT
                te.id,
                te.text,
                d.name AS category,
                te.trained_at
            FROM training_examples te
            JOIN departments d
                ON d.id = te.department_id
            ORDER BY te.id
        """

        return pd.read_sql(
            query,
            conn
        )


def get_training_examples_by_ids(
    ids
):

    if not ids:

        return pd.DataFrame(
            columns=[
                "id",
                "text",
                "category",
                "trained_at"
            ]
        )

    with psycopg.connect(
        DATABASE_URL
    ) as conn:

        query = """
            SELECT
                te.id,
                te.text,
                d.name AS category,
                te.trained_at
            FROM training_examples te
            JOIN departments d
                ON d.id = te.department_id
            WHERE te.id = ANY(%s)
            ORDER BY te.id
        """

        return pd.read_sql(
            query,
            conn,
            params=(ids,)
        )


def get_untrained_examples():

    with psycopg.connect(
        DATABASE_URL
    ) as conn:

        query = """
            SELECT
                te.id,
                te.text,
                d.name AS category,
                te.trained_at
            FROM training_examples te
            JOIN departments d
                ON d.id = te.department_id
            WHERE te.trained_at IS NULL
            ORDER BY te.id
        """

        return pd.read_sql(
            query,
            conn
        )


def get_model_categories():

    info = get_active_model_info()

    if not info:

        return []

    return info.get(
        "categories",
        []
    )


def get_database_categories():

    with psycopg.connect(
        DATABASE_URL
    ) as conn:

        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT name
                FROM departments
                ORDER BY name
                """
            )

            rows = cur.fetchall()

    return [
        row[0]
        for row in rows
    ]


def mark_examples_trained(
    example_ids,
    version
):

    if not example_ids:

        return

    with psycopg.connect(
        DATABASE_URL
    ) as conn:

        with conn.cursor() as cur:

            cur.execute(
                """
                UPDATE training_examples
                SET trained_at = NOW()
                WHERE id = ANY(%s)
                  AND trained_at IS NULL
                """,
                (
                    example_ids,
                )
            )

        conn.commit()

    print(
        f"[AI] Marked {len(example_ids)} "
        f"examples as trained for v{version}."
    )


def compute_metrics(
    eval_prediction
):

    logits = eval_prediction.predictions

    labels = eval_prediction.label_ids

    predictions = np.argmax(
        logits,
        axis=-1
    )

    precision, recall, f1, _ = (
        precision_recall_fscore_support(
            labels,
            predictions,
            average="weighted",
            zero_division=0
        )
    )

    accuracy = accuracy_score(
        labels,
        predictions
    )

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1
    }


def make_datasets(
    df,
    categories,
    tokenizer
):

    df = df.copy()

    label2id = {
        label: index
        for index, label
        in enumerate(categories)
    }

    df["label"] = (
        df["category"].map(
            label2id
        )
    )

    df = df.dropna(
        subset=["label"]
    )

    df["label"] = (
        df["label"].astype(int)
    )

    if len(df) < 2:

        raise RuntimeError(
            "Not enough training examples."
        )

    category_counts = (
        df["category"]
        .value_counts()
    )

    can_stratify = (
        len(category_counts) > 1
        and category_counts.min() >= 2
    )

    if can_stratify:

        train_df, test_df = (
            train_test_split(
                df,
                test_size=0.2,
                random_state=42,
                stratify=df["category"]
            )
        )

    else:

        train_df, test_df = (
            train_test_split(
                df,
                test_size=0.2,
                random_state=42
            )
        )

    if len(test_df) == 0:

        test_df = train_df.copy()

    train_dataset = Dataset.from_pandas(
        train_df[
            ["text", "label"]
        ],
        preserve_index=False
    )

    test_dataset = Dataset.from_pandas(
        test_df[
            ["text", "label"]
        ],
        preserve_index=False
    )

    def tokenize(batch):

        return tokenizer(
            batch["text"],
            padding="max_length",
            truncation=True,
            max_length=128
        )

    train_dataset = train_dataset.map(
        tokenize,
        batched=True
    )

    test_dataset = test_dataset.map(
        tokenize,
        batched=True
    )

    train_dataset = (
        train_dataset.remove_columns(
            ["text"]
        )
    )

    test_dataset = (
        test_dataset.remove_columns(
            ["text"]
        )
    )

    train_dataset.set_format(
        "torch"
    )

    test_dataset.set_format(
        "torch"
    )

    return (
        train_dataset,
        test_dataset
    )


def save_model_record(
    version,
    accuracy,
    f1,
    training_count,
    status
):

    with psycopg.connect(
        DATABASE_URL
    ) as conn:

        with conn.cursor() as cur:

            if status == "active":

                cur.execute(
                    """
                    UPDATE model_versions
                    SET status = 'archived'
                    WHERE status = 'active'
                    """
                )

            cur.execute(
                """
                INSERT INTO model_versions
                (
                    version,
                    model_path,
                    accuracy,
                    f1,
                    training_examples_count,
                    status
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    f"v{version}",
                    f"./model/v{version}",
                    accuracy,
                    f1,
                    training_count,
                    status
                )
            )

        conn.commit()


def activate_model(
    version,
    accuracy,
    f1,
    training_count,
    categories
):

    active_info = {
        "version": version,
        "accuracy": accuracy,
        "f1": f1,
        "training_examples_count": training_count,
        "categories": categories,
        "updated_at": utc_now()
    }

    temp_file = (
        ACTIVE_FILE + ".tmp"
    )

    with open(
        temp_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            active_info,
            file,
            indent=2
        )

    os.replace(
        temp_file,
        ACTIVE_FILE
    )


def save_loss_graph(
    trainer,
    version
):

    history = trainer.state.log_history

    steps = []

    losses = []

    for item in history:

        if (
            "loss" in item
            and "step" in item
        ):

            steps.append(
                item["step"]
            )

            losses.append(
                item["loss"]
            )

    if not losses:

        return

    plt.figure(
        figsize=(8, 5)
    )

    plt.plot(
        steps,
        losses
    )

    plt.xlabel(
        "Training Step"
    )

    plt.ylabel(
        "Loss"
    )

    plt.title(
        f"Training Loss - v{version}"
    )

    plt.grid(True)

    plt.tight_layout()

    plt.savefig(
        GRAPH_PATH,
        dpi=150
    )

    plt.close()


def train_model(
    mode="incremental"
):

    print(
        "\n========================================"
    )

    print(
        f"AI TRAINING MODE: {mode.upper()}"
    )

    print(
        "========================================"
    )

    active_info = (
        get_active_model_info()
    )

    database_categories = (
        sorted(
            get_database_categories()
        )
    )

    previous_categories = (
        get_model_categories()
    )

    categories_changed = (
        database_categories
        != sorted(previous_categories)
    )

    if mode == "incremental":

        if not active_info:

            print(
                "[AI] No active model."
            )

            print(
                "[AI] Switching to full training."
            )

            mode = "full"

        elif categories_changed:

            print(
                "[AI] Department/category set changed."
            )

            print(
                "[AI] Switching to full training."
            )

            mode = "full"

    all_df = get_all_training_data()

    all_df = all_df.drop_duplicates(
        subset=["text", "category"]
    )

    if all_df.empty:

        raise RuntimeError(
            "No training examples found."
        )

    categories = database_categories

    label2id = {
        label: index
        for index, label
        in enumerate(categories)
    }

    id2label = {
        index: label
        for label, index
        in label2id.items()
    }

    print(
        f"[AI] Categories: {categories}"
    )

    print(
        f"[AI] Total examples: "
        f"{len(all_df)}"
    )

    version = get_next_version()

    candidate_path = os.path.join(
        MODEL_ROOT,
        f"v{version}"
    )

    if os.path.exists(
        candidate_path
    ):

        shutil.rmtree(
            candidate_path
        )

    os.makedirs(
        candidate_path,
        exist_ok=True
    )

    examples_to_mark = []

    if mode == "full":

        training_df = all_df.copy()

        examples_to_mark = (
            all_df["id"]
            .drop_duplicates()
            .tolist()
        )

        print(
            "[AI] FULL TRAINING"
        )

        print(
            "[AI] Using all database examples."
        )

        tokenizer = (
            AutoTokenizer.from_pretrained(
                MODEL_NAME
            )
        )

        model = (
            AutoModelForSequenceClassification
            .from_pretrained(
                MODEL_NAME,
                num_labels=len(categories),
                id2label=id2label,
                label2id=label2id
            )
        )

        epochs = FULL_EPOCHS

        learning_rate = (
            FULL_LEARNING_RATE
        )

    else:

        pending_df = (
            get_untrained_examples()
        )

        if pending_df.empty:

            print(
                "[AI] No untrained examples."
            )

            shutil.rmtree(
                candidate_path,
                ignore_errors=True
            )

            return False

        pending_ids = (
            pending_df["id"]
            .tolist()
        )

        examples_to_mark = pending_ids

        replay_pool = all_df[
            ~all_df["id"].isin(
                pending_ids
            )
        ]

        replay_size = min(
            REPLAY_SIZE,
            len(replay_pool)
        )

        if replay_size > 0:

            replay_df = (
                replay_pool.sample(
                    n=replay_size,
                    random_state=42
                )
            )

        else:

            replay_df = (
                replay_pool.head(0)
            )

        training_df = pd.concat(
            [
                replay_df,
                pending_df
            ],
            ignore_index=True
        )

        training_df = (
            training_df.drop_duplicates(
                subset=["text", "category"]
            )
        )

        print(
            "[AI] INCREMENTAL TRAINING"
        )

        print(
            f"[AI] New examples: "
            f"{len(pending_df)}"
        )

        print(
            f"[AI] Replay examples: "
            f"{len(replay_df)}"
        )

        base_model_path = os.path.join(
            MODEL_ROOT,
            f"v{active_info['version']}"
        )

        tokenizer = (
            AutoTokenizer.from_pretrained(
                base_model_path
            )
        )

        model = (
            AutoModelForSequenceClassification
            .from_pretrained(
                base_model_path
            )
        )

        model.config.id2label = id2label

        model.config.label2id = label2id

        epochs = (
            INCREMENTAL_EPOCHS
        )

        learning_rate = (
            INCREMENTAL_LEARNING_RATE
        )

    model.config.id2label = id2label

    model.config.label2id = label2id

    train_dataset, test_dataset = (
        make_datasets(
            training_df,
            categories,
            tokenizer
        )
    )

    training_args = TrainingArguments(
        output_dir="./training_output",

        num_train_epochs=epochs,

        per_device_train_batch_size=BATCH_SIZE,

        per_device_eval_batch_size=BATCH_SIZE,

        learning_rate=learning_rate,

        weight_decay=0.01,

        eval_strategy="epoch",

        save_strategy="no",

        logging_strategy="epoch",

        report_to="none"
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=test_dataset,
        compute_metrics=compute_metrics
    )

    print(
        "[AI] Training started..."
    )

    trainer.train()

    results = trainer.evaluate()

    accuracy = float(
        results["eval_accuracy"]
    )

    f1 = float(
        results["eval_f1"]
    )

    print(
        f"[AI] Candidate accuracy: "
        f"{accuracy * 100:.2f}%"
    )

    print(
        f"[AI] Candidate F1: "
        f"{f1 * 100:.2f}%"
    )

    save_loss_graph(
        trainer,
        version
    )

    trainer.save_model(
        candidate_path
    )

    tokenizer.save_pretrained(
        candidate_path
    )

    previous_accuracy = 0.0

    if active_info:

        previous_accuracy = float(
            active_info.get(
                "accuracy",
                0
            )
        )

    if (
        active_info
        and mode == "incremental"
        and accuracy < previous_accuracy
    ):

        print(
            "\n[AI] Candidate rejected."
        )

        save_model_record(
            version,
            accuracy,
            f1,
            len(training_df),
            "rejected"
        )

        shutil.rmtree(
            candidate_path,
            ignore_errors=True
        )

        return False

    save_model_record(
        version,
        accuracy,
        f1,
        len(all_df),
        "active"
    )

    activate_model(
        version,
        accuracy,
        f1,
        len(all_df),
        categories
    )

    mark_examples_trained(
        examples_to_mark,
        version
    )

    print(
        f"\n[AI] Model v{version} activated."
    )

    print(
        f"[AI] Path: {candidate_path}"
    )

    print(
        f"[AI] Accuracy: "
        f"{accuracy * 100:.2f}%"
    )

    print(
        f"[AI] F1: "
        f"{f1 * 100:.2f}%"
    )

    print(
        "========================================\n"
    )

    return True


if __name__ == "__main__":

    os.makedirs(
        MODEL_ROOT,
        exist_ok=True
    )

    train_model(
        mode="full"
    )