import sqlite3
import os

db_path = r'c:\Users\user\Desktop\interacai\backend\interacai.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    for table in tables:
        print(table[0])
    conn.close()
else:
    print(f"File {db_path} not found")
