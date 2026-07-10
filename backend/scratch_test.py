import asyncio
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_web_chat():
    payload = {
        "user_id": "test_user_from_script",
        "message": "hello",
        "business_id": "test_business_id"
    }
    print("Sending request to /api/web-chat...")
    response = client.post("/api/web-chat", json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

if __name__ == "__main__":
    test_web_chat()
