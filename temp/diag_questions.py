import psycopg2

DBURL = "postgresql://postgres:mrBKqAIhBLFbHFRQrFefhIdySsxNuzSS@switchyard.proxy.rlwy.net:22270/railway"

conn = psycopg2.connect(DBURL, connect_timeout=10)
cur = conn.cursor()

# Colunas da tabela questions
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions'
    ORDER BY ordinal_position;
""")

print("=== QUESTIONS columns ===")
for row in cur.fetchall():
    print(f"  {row[0]} | {row[1]} | nullable={row[2]}")

# Tambem ver question_choices
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'question_choices'
    ORDER BY ordinal_position;
""")

print("\n=== QUESTION_CHOICES columns ===")
for row in cur.fetchall():
    print(f"  {row[0]} | {row[1]} | nullable={row[2]}")

cur.close()
conn.close()