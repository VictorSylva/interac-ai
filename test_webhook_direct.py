import asyncio
import os
import sys

# Setup environment
import dotenv
dotenv.load_dotenv(dotenv_path='c:/Users/user/Desktop/interacai/backend/.env')
sys.path.insert(0, 'c:/Users/user/Desktop/interacai/backend')
os.chdir('c:/Users/user/Desktop/interacai/backend')

from database.session import engine

class MockRequest:
    async def json(self):
        return {
            'object': 'whatsapp_business_account',
            'entry': [{
                'id': '1048107078375556',
                'changes': [{
                    'value': {
                        'messaging_product': 'whatsapp',
                        'metadata': {
                            'display_phone_number': '1234567890',
                            'phone_number_id': '1048107078375556'
                        },
                        'contacts': [{
                            'profile': {'name': 'Test User'},
                            'wa_id': '2348000000000'
                        }],
                        'messages': [{
                            'from': '2348000000000',
                            'id': 'wamid.HBgL...',
                            'timestamp': '1603059201',
                            'text': {'body': 'Hello! Test message.'},
                            'type': 'text'
                        }]
                    },
                    'field': 'messages'
                }]
            }]
        }

async def run_test():
    # init db pool
    async with engine.begin() as conn:
        pass
    
    from services.whatsapp_service import receive_message
    request = MockRequest()
    result = await receive_message(request)
    print('RESULT:', result)

asyncio.run(run_test())
