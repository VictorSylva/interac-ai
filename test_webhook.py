import requests
import json

url = "https://interacai-backend-staging.onrender.com/whatsapp/webhook"
payload = {
    "object": "whatsapp_business_account",
    "entry": [{
        "id": "1048107078375556",
        "changes": [{
            "value": {
                "messaging_product": "whatsapp",
                "metadata": {
                    "display_phone_number": "1234567890",
                    "phone_number_id": "1048107078375556"
                },
                "contacts": [{
                    "profile": {
                        "name": "Test User"
                    },
                    "wa_id": "2348000000000"
                }],
                "messages": [{
                    "from": "2348000000000",
                    "id": "wamid.HBgL...",
                    "timestamp": "1603059201",
                    "text": {
                        "body": "Hello! Test message."
                    },
                    "type": "text"
                }]
            },
            "field": "messages"
        }]
    }]
}

response = requests.post(url, json=payload)
print(response.status_code)
print(response.text)
