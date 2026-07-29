import asyncio
from sqlalchemy import text
from database.session import engine

async def main():
    async with engine.begin() as conn:
        # Delete messages associated with unknown
        res1 = await conn.execute(text("DELETE FROM messages WHERE conversation_id LIKE '%unknown%'"))
        print(f"Deleted {res1.rowcount} messages from PostgreSQL")
        
        # Delete conversations associated with unknown
        res2 = await conn.execute(text("DELETE FROM conversations WHERE id LIKE '%unknown%'"))
        print(f"Deleted {res2.rowcount} conversations from PostgreSQL")

if __name__ == '__main__':
    asyncio.run(main())
