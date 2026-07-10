import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import TokenWallet
from sqlalchemy import select

async def check_wallet():
    async with AsyncSessionLocal() as session:
        # Check all wallets
        stmt = select(TokenWallet)
        res = await session.execute(stmt)
        wallets = res.scalars().all()
        
        for w in wallets:
            print(f"Business: {w.business_id} | Sub: {w.sub_balance} | PAYG: {w.payg_balance}")

if __name__ == "__main__":
    asyncio.run(check_wallet())
