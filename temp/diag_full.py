import psycopg2

DBURL = "postgresql://postgres:mrBKqAIhBLFbHFRQrFefhIdySsxNuzSS@switchyard.proxy.rlwy.net:22270/railway"

conn = psycopg2.connect(DBURL, connect_timeout=10)
cur = conn.cursor()

# Todas as tabelas public
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;")
tables = [r[0] for r in cur.fetchall()]

for tbl in tables:
    if 'version' in tbl or 'question' in tbl:
        cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='{tbl}' ORDER BY ordinal_position;")
        cols = [f"  {r[0]} | datatype={r[1]}" for r in cur.fetchall()]
        print(f"\n=== {tbl} ===")
        for c in cols:
            print(c)

# Exemplo de dados reais
cur.execute("SELECT * FROM questions ORDER BY created_at DESC LIMIT 2;")
rows = cur.fetchall()
print("\n--- Sample questions ---")
for r in rows:
    print(r)

cur.close()
conn.close()