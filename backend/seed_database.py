import os
import pandas as pd
import psycopg

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:ahmed123@localhost:5432/customer_support"
)

DATA_PATH = "data/dataset.csv"


def main():

    df = pd.read_csv(DATA_PATH)

    df = df.dropna(subset=["text", "category"])

    df["text"] = df["text"].astype(str).str.strip()
    df["category"] = df["category"].astype(str).str.strip()

    df = df.drop_duplicates(
        subset=["text", "category"]
    )

    with psycopg.connect(DATABASE_URL) as conn:

        with conn.cursor() as cur:

            for category in sorted(
                df["category"].unique()
            ):

                cur.execute(
                    """
                    INSERT INTO departments (name)
                    VALUES (%s)
                    ON CONFLICT (name) DO NOTHING
                    """,
                    (category,)
                )

            for _, row in df.iterrows():

                cur.execute(
                    """
                    SELECT id
                    FROM departments
                    WHERE name = %s
                    """,
                    (row["category"],)
                )

                department_id = cur.fetchone()[0]

                cur.execute(
                    """
                    INSERT INTO training_examples
                    (
                        text,
                        department_id,
                        source
                    )
                    VALUES (%s, %s, 'manual')
                    ON CONFLICT (text, department_id)
                    DO NOTHING
                    """,
                    (
                        row["text"],
                        department_id
                    )
                )

        conn.commit()

    print(
        f"Imported {len(df)} unique training examples."
    )


if __name__ == "__main__":
    main()