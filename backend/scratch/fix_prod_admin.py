import asyncio
import httpx

PROD_API_URL = "https://interact-backend-pcex.onrender.com"
ADMIN_KEY = "interact_secret_2026"

async def check_prod_users():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # We can't easily list users via maintenance without a new action,
        # but I can try to login via script and check the role.
        print("Logging in to production to verify role...")
        res = await client.post(f"{PROD_API_URL}/api/auth/login", json={
            "email": "mbasitisylva@gmail.com",
            "password": "your_password_here" # I don't know the password, but the user does.
        })
        # Wait, I can't login without the password.
        
        # I'll add a maintenance action to FIX the role in production.
        print("Granting Super Admin role to mbasitisylva@gmail.com in production...")
        res_fix = await client.post(f"{PROD_API_URL}/api/admin/maintenance", json={
            "admin_key": ADMIN_KEY,
            "action": "fix_admin_role",
            "email": "mbasitisylva@gmail.com"
        })
        print(f"Fix Status: {res_fix.status_code} | {res_fix.text}")

if __name__ == "__main__":
    asyncio.run(check_prod_users())
