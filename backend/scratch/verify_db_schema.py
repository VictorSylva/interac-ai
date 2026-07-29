import os
import sys
import sqlite3

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import SQLAlchemy stuff
from database.base import Base
import database.models # This registers the models in Base.metadata

db_path = os.path.join(os.path.dirname(__file__), '..', 'interact_dev.db')
print("Database path:", os.path.abspath(db_path))

if not os.path.exists(db_path):
    print("Error: Database file does not exist!")
    sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get SQLite tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
sqlite_tables = {row[0] for row in cursor.fetchall()}

# Get SQLAlchemy models tables
sqlalchemy_tables = set(Base.metadata.tables.keys())

print("\n=== SCHEMA VERIFICATION REPORT ===")

# Check 1: Extra tables in SQLite (not in current codebase models)
extra_tables = sqlite_tables - sqlalchemy_tables - {'sqlite_sequence'}
if extra_tables:
    print("\n[!] Found extra tables in SQLite not defined in current python models:")
    for t in extra_tables:
        print(f"  - {t}")
else:
    print("\n[+] No extra tables found in SQLite.")

# Check 2: Missing tables in SQLite (defined in models but not in DB)
missing_tables = sqlalchemy_tables - sqlite_tables
if missing_tables:
    print("\n[!] Missing tables in SQLite that are defined in python models:")
    for t in missing_tables:
        print(f"  - {t}")
else:
    print("\n[+] All python model tables exist in SQLite.")

# Check 3: Check columns in matching tables
print("\n--- COLUMN LEVEL CHECKS ---")
matching_tables = sqlite_tables & sqlalchemy_tables
column_mismatches = False

for table_name in sorted(matching_tables):
    # Get columns from SQLite
    cursor.execute(f"PRAGMA table_info({table_name});")
    sqlite_cols = {row[1] for row in cursor.fetchall()}
    
    # Get columns from SQLAlchemy model
    model_table = Base.metadata.tables[table_name]
    model_cols = {c.name for c in model_table.columns}
    
    # Compare
    missing_cols = model_cols - sqlite_cols
    extra_cols = sqlite_cols - model_cols
    
    if missing_cols or extra_cols:
        column_mismatches = True
        print(f"\nMismatch in table '{table_name}':")
        if missing_cols:
            print(f"  [!] Missing columns in SQLite: {', '.join(missing_cols)}")
        if extra_cols:
            print(f"  [!] Extra columns in SQLite (not in models): {', '.join(extra_cols)}")

if not column_mismatches:
    print("[+] All table columns match exactly between python models and SQLite DB!")

# Check 4: Check if there's any stray data in the dynamically loaded database
# For example, checking if the active modules or entities in database have values
# that are not defined in the code or config.
print("\n--- OPERATIONAL DATA INTEGRITY ---")
try:
    cursor.execute("SELECT DISTINCT module_id FROM entity_types;")
    module_ids = {row[0] for row in cursor.fetchall()}
    print(f"Active modules referenced in database entity_types: {', '.join(module_ids)}")
except Exception as e:
    print(f"Could not check entity_types: {e}")

conn.close()
