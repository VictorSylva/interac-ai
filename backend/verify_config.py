import os
import sys

# Add backend to path so we can import config
sys.path.append(os.getcwd())

def test_config():
    print("--- Testing Config Selection ---")
    
    # Test Dev
    os.environ["ENV"] = "development"
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@localhost/dev_db"
    
    from config import load_config
    # Force reload if it was already imported as singleton
    config = load_config()
    print(f"ENV: {config.ENV}")
    print(f"DEBUG: {config.DEBUG}")
    print(f"DB URL: {config.DATABASE_URL}")
    assert config.ENV == "development"
    assert config.DEBUG == True
    
    print("\n--- Testing Prod Validations ---")
    # Test Prod Failure (Local DB)
    os.environ["ENV"] = "production"
    os.environ["OPENROUTER_API_KEY"] = "sk-test-key"
    try:
        load_config()
        print("FAILED: Production should not allow localhost DB URL")
    except ValueError as e:
        print(f"SUCCESS: Caught expected error: {e}")
        
    # Test Prod Success
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@prod-db.example.com/live_db"
    try:
        config_prod = load_config()
        print(f"ENV: {config_prod.ENV}")
        print(f"DEBUG: {config_prod.DEBUG}")
        print("SUCCESS: Production config loaded correctly with valid DB URL")
    except Exception as e:
        print(f"FAILED: Prod config failed to load: {e}")

if __name__ == "__main__":
    test_config()
