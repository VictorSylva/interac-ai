import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from config import config

async def run():
    engine = create_async_engine(config.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'))
    async with engine.begin() as conn:
        try:
            await conn.execute(text('ALTER TABLE sales_orders ADD COLUMN customer_phone VARCHAR;'))
            print('Done!')
        except Exception as e:
            print("Error or already added:", e)

if __name__ == "__main__":
    asyncio.run(run())
