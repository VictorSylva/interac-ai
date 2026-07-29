import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '..', 'interact_dev.db')
print("DB Path:", os.path.abspath(db_path))

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]
print("\n--- TABLES IN DB ---")
for t in tables:
    # Get columns info
    cursor.execute(f"PRAGMA table_info({t});")
    cols = [col[1] for col in cursor.fetchall()]
    print(f"Table: {t} | Columns: {len(cols)} ({', '.join(cols[:5])}...)")
conn.close()
