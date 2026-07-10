import asyncio
import httpx

async def check_users():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # I'll add a 'list_users' action to maintenance in my local main.py then push
        # Actually, let's just check if mbasitisylva@gmail.com exists
        res = await client.post('https://interact-backend-pcex.onrender.com/api/admin/maintenance', json={
            'admin_key': 'interact_secret_2026',
            'action': 'fix_admin_role',
            'email': 'mbasitisylva@gmail.com'
        })
        print(res.text)

if __name__ == "__main__":
    asyncio.run(check_users())
