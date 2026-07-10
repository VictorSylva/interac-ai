import asyncio
from sync_to_production import export_local_data

async def check():
    _, _, _, _, _, _, users = await export_local_data()
    print("EXPORTED USERS:")
    for u in users:
        print(f" - {u['email']}")

if __name__ == "__main__":
    asyncio.run(check())
