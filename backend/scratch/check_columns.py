import sqlite3
import os

db_path = r'c:\Users\user\Desktop\interacai\backend\interacai.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(business_settings)")
    columns = cursor.fetchall()
    if not columns:
        print("No columns found (table might not exist)")
    for col in columns:
        print(col)
    conn.close()
else:
    print(f"File {db_path} not found")
