import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '..', 'interact_dev.db')
print("Connecting to DB at:", os.path.abspath(db_path))

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # 1. Drop extra tables
    print("\n--- DROPPING EXTRA TABLES ---")
    for table in ['branches', 'departments']:
        cursor.execute(f"DROP TABLE IF EXISTS {table};")
        print(f"Dropped table: {table}")

    # 2. Re-create users table to match models exactly
    print("\n--- RECONCILING 'users' TABLE ---")
    
    # Check if users table exists and get current data
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
    if cursor.fetchone():
        # Get all column names in existing users table
        cursor.execute("PRAGMA table_info(users);")
        existing_cols = [row[1] for row in cursor.fetchall()]
        print(f"Existing columns in 'users': {existing_cols}")
        
        # Read all data from users
        cursor.execute("SELECT * FROM users;")
        old_rows = cursor.fetchall()
        
        # Map values to their original names
        data_to_migrate = []
        for row in old_rows:
            row_dict = dict(zip(existing_cols, row))
            data_to_migrate.append(row_dict)
            
        print(f"Loaded {len(data_to_migrate)} users for migration.")
        
        # Drop the old users table
        cursor.execute("DROP TABLE users;")
        print("Dropped old users table.")
    else:
        data_to_migrate = []

    # Create new users table matching current SQLAlchemy model exactly
    cursor.execute("""
        CREATE TABLE users (
            id VARCHAR NOT NULL, 
            business_id VARCHAR, 
            email VARCHAR, 
            password_hash VARCHAR, 
            role VARCHAR, 
            reset_token VARCHAR, 
            reset_token_expiry DATETIME, 
            created_at DATETIME, 
            department VARCHAR, 
            PRIMARY KEY (id), 
            FOREIGN KEY(business_id) REFERENCES businesses (id)
        );
    """)
    cursor.execute("CREATE UNIQUE INDEX ix_users_email ON users (email);")
    print("Created clean 'users' table matching SQLAlchemy models.")

    # Migrate data back
    if data_to_migrate:
        for u in data_to_migrate:
            # Fallback created_at if it didn't exist
            created_at = u.get('created_at') or '2026-07-19 12:00:00'
            
            cursor.execute("""
                INSERT INTO users (id, business_id, email, password_hash, role, reset_token, reset_token_expiry, created_at, department)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                u.get('id'),
                u.get('business_id'),
                u.get('email'),
                u.get('password_hash'),
                u.get('role', 'agent'),
                u.get('reset_token'),
                u.get('reset_token_expiry'),
                created_at,
                u.get('department')
            ))
        print(f"Migrated {len(data_to_migrate)} users successfully.")

    conn.commit()
    print("\n[+] Database schema reconciliation complete!")
except Exception as e:
    conn.rollback()
    print(f"\n[!] Error during reconciliation: {e}")
finally:
    conn.close()
