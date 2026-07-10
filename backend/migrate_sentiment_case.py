import asyncio
import os
import sys
from sqlalchemy import text, select
from database.session import AsyncSessionLocal
from database.models.chat import Message, Conversation

async def migrate_sentiment_case():
    print("--- STARTING SENTIMENT CASE MIGRATION ---")
    async with AsyncSessionLocal() as session:
        try:
            # 1. Update Messages
            print("Updating 'messages' table...")
            # We uppercase the first letter and lowercase the rest, but it's easier to just look for common lowercase ones
            # Or use Postgres INITCAP equivalent if available, but manual update is safer for small set.
            res_msg = await session.execute(text(
                "UPDATE messages SET sentiment = INITCAP(LOWER(sentiment)) WHERE sentiment IS NOT NULL"
            ))
            print(f" - Updated {res_msg.rowcount} messages.")

            # 2. Update Conversations
            print("\nUpdating 'conversations' table...")
            res_convo = await session.execute(text(
                "UPDATE conversations SET last_sentiment = INITCAP(LOWER(last_sentiment)) WHERE last_sentiment IS NOT NULL"
            ))
            print(f" - Updated {res_convo.rowcount} conversations.")

            await session.commit()
            print("\n--- MIGRATION COMPLETE ---")
        except Exception as e:
            print(f"Error during migration: {e}")
            await session.rollback()

if __name__ == "__main__":
    sys.path.append(os.getcwd())
    asyncio.run(migrate_sentiment_case())
