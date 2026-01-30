import os
import re
import psycopg2
from psycopg2.extras import execute_values
from datasets import load_dataset
from tqdm import tqdm

SYSTEM_USER_ID = os.getenv("SYSTEM_USER_ID", "00000000-0000-0000-0000-000000000001")
EXAM = os.getenv("EXAM", "step1")              # enum exam_type: step1 | step2ck
DIFFICULTY = os.getenv("DIFFICULTY", "medium") # enum difficulty_level: easy|medium|hard
STATUS = os.getenv("STATUS", "published")      # enum question_status: draft|published|archived
LIMIT = int(os.getenv("LIMIT", "1000"))        # quantas questões importar
SPLIT = os.getenv("SPLIT", "train")            # train/validation/test

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("Missing DATABASE_URL env var (Postgres connection string).")

def norm_tag(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s[:120]

def main():
    ds = load_dataset("openlifescienceai/medmcqa", split=SPLIT)  # baixa automaticamente do HF
    # Campos principais (do card): id, question, exp, cop, opa/opb/opc/opd, subject_name, topic_name :contentReference[oaicite:2]{index=2}

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            # Garante usuário system (necessário por created_by ser FK para users_profile)
            cur.execute(
                """
                INSERT INTO users_profile (user_id, display_name)
                VALUES (%s, 'system')
                ON CONFLICT (user_id) DO NOTHING
                """,
                (SYSTEM_USER_ID,),
            )

        inserted = 0
        for row in tqdm(ds):
            if inserted >= LIMIT:
                break

            # Só single-choice com 4 opções (cop ∈ {1..4})
            if row.get("choice_type") != "single":
                continue
            cop = row.get("cop")
            if cop not in (1, 2, 3, 4):
                continue

            qid_external = row.get("id")
            stem = (row.get("question") or "").strip()
            if not stem:
                continue

            opa = (row.get("opa") or "").strip()
            opb = (row.get("opb") or "").strip()
            opc = (row.get("opc") or "").strip()
            opd = (row.get("opd") or "").strip()
            if not (opa and opb and opc and opd):
                continue

            canonical_code = f"medmcqa:{qid_external}"

            subject = norm_tag(row.get("subject_name"))
            topic = norm_tag(row.get("topic_name"))
            explanation = (row.get("exp") or "").strip()

            with conn.cursor() as cur:
                # 1) UPSERT em questions por canonical_code
                cur.execute(
                    """
                    INSERT INTO questions (canonical_code, status, created_by)
                    VALUES (%s, %s::question_status, %s)
                    ON CONFLICT (canonical_code) DO UPDATE
                      SET status = EXCLUDED.status,
                          updated_at = CURRENT_TIMESTAMP
                    RETURNING question_id
                    """,
                    (canonical_code, STATUS, SYSTEM_USER_ID),
                )
                question_id = cur.fetchone()[0]

                # 2) Insere versão (se já existir version=1 para esse question_id, reusa)
                cur.execute(
                    """
                    SELECT question_version_id
                    FROM question_versions
                    WHERE question_id = %s AND version = 1
                    """,
                    (question_id,),
                )
                existing = cur.fetchone()
                if existing:
                    qv_id = existing[0]
                else:
                    cur.execute(
                        """
                        INSERT INTO question_versions
                          (question_id, version, exam, language, difficulty, stem,
                           explanation_short, explanation_long, is_active, created_by)
                        VALUES
                          (%s, 1, %s::exam_type, 'en', %s::difficulty_level, %s,
                           NULL, %s, true, %s)
                        RETURNING question_version_id
                        """,
                        (question_id, EXAM, DIFFICULTY, stem, explanation, SYSTEM_USER_ID),
                    )
                    qv_id = cur.fetchone()[0]

                # 3) Choices: recria (idempotência simples: apaga e reinsere)
                cur.execute("DELETE FROM question_choices WHERE question_version_id = %s", (qv_id,))
                choices = [
                    (qv_id, "A", opa, cop == 1),
                    (qv_id, "B", opb, cop == 2),
                    (qv_id, "C", opc, cop == 3),
                    (qv_id, "D", opd, cop == 4),
                ]
                execute_values(
                    cur,
                    """
                    INSERT INTO question_choices
                      (question_version_id, label, choice_text, is_correct)
                    VALUES %s
                    """,
                    choices,
                )

                # 4) Tags (subject/topic) e junction question_version_tags
                tag_ids = []
                for tag_name, tag_type in [(subject, "discipline"), (topic, "topic")]:
                    if not tag_name:
                        continue
                    cur.execute("SELECT tag_id FROM tags WHERE name = %s AND tag_type = %s::tag_type", (tag_name, tag_type))
                    r = cur.fetchone()
                    if r:
                        tag_id = r[0]
                    else:
                        cur.execute(
                            "INSERT INTO tags (name, tag_type) VALUES (%s, %s::tag_type) RETURNING tag_id",
                            (tag_name, tag_type),
                        )
                        tag_id = cur.fetchone()[0]
                    tag_ids.append(tag_id)

                # limpa e reinsere ligações
                cur.execute("DELETE FROM question_version_tags WHERE question_version_id = %s", (qv_id,))
                if tag_ids:
                    execute_values(
                        cur,
                        """
                        INSERT INTO question_version_tags (question_version_id, tag_id)
                        VALUES %s
                        """,
                        [(qv_id, tid) for tid in tag_ids],
                    )

            conn.commit()
            inserted += 1

        print(f"Imported {inserted} questions into Postgres.")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
