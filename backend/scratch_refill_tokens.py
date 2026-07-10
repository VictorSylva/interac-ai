import asyncio
from database.session import AsyncSessionLocal
from database.models.billing import TokenWallet
from sqlalchemy import select, update

async def run():
    bid = '0bbd48c4-b066-435a-be3d-c095b55897c6'
    async with AsyncSessionLocal() as s:
        res = await s.execute(select(TokenWallet).where(TokenWallet.business_id == bid))
        w = res.scalar()
        if w:
            print(f'Sub: {w.sub_balance}, PAYG: {w.payg_balance}')
            # Refill tokens for testing
            await s.execute(update(TokenWallet).where(TokenWallet.business_id == bid).values(sub_balance=1000))
            await s.commit()
            print('Refilled 1000 sub tokens.')
        else:
            print('Wallet not found.')

if __name__ == "__main__":
    asyncio.run(run())
