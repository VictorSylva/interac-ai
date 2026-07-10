import asyncio
import httpx

async def fix_dev():
    # Since it's local, I'll hit the local API directly
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("Resetting local passwords...")
        # Reset interacai.int@gmail.com
        res1 = await client.post('http://localhost:8000/api/admin/maintenance', json={
            'admin_key': 'interact_secret_2026',
            'action': 'reset_user_password',
            'email': 'interacai.int@gmail.com',
            'password': 'Interac@2026' # Temporary password
        })
        print(f"Main Account: {res1.text}")

        # Reset mbasitisylva@gmail.com
        res2 = await client.post('http://localhost:8000/api/admin/maintenance', json={
            'admin_key': 'interact_secret_2026',
            'action': 'reset_user_password',
            'email': 'mbasitisylva@gmail.com',
            'password': 'Interac@2026'
        })
        print(f"Super Admin: {res2.text}")

if __name__ == "__main__":
    asyncio.run(fix_dev())
