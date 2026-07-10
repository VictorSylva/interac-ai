import asyncio
import httpx

async def check():
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post('https://interact-backend-pcex.onrender.com/api/admin/maintenance', json={
            'admin_key': 'interact_secret_2026',
            'action': 'list_businesses'
        })
        print(res.text)

if __name__ == "__main__":
    asyncio.run(check())
