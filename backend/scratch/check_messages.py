import asyncio
import os
import sys
from sqlalchemy import select, desc
from sqlalchemy import text

os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:password@localhost:5435/interact_db"
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as session:
        try:
            res = await session.execute(text(
                "SELECT id, conversation_id, sender, text, timestamp "
                "FROM messages "
                "ORDER BY timestamp DESC LIMIT 10"
            ))
            rows = res.fetchall()
            print(f"Found {len(rows)} messages:")
            for r in rows:
                print(f"[{r[4]}] Convo: {r[1]} | Sender: {r[2]} | Text: {r[3]}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
