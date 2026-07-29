import asyncio
from sqlalchemy import text
from database.session import engine

async def main():
    async with engine.begin() as conn:
        # Update specific conversations for testing
        updates = [
            ("0bbd48c4-b066-435a-be3d-c095b55897c6:web_user_jrn4hir4i", "support"),
            ("0bbd48c4-b066-435a-be3d-c095b55897c6:web_user_668m7x0x6", "sales"),
            ("0bbd48c4-b066-435a-be3d-c095b55897c6:web_user_0l9qiugy1", "support"),
            ("0bbd48c4-b066-435a-be3d-c095b55897c6:final-test-user", "sales"),
        ]
        
        for convo_id, dept in updates:
            res = await conn.execute(
                text("UPDATE conversations SET department = :dept WHERE id = :convo_id"),
                {"dept": dept, "convo_id": convo_id}
            )
            print(f"Updated conversation {convo_id} to department '{dept}' (affected: {res.rowcount})")
            
        # For any remaining conversations with None department, set them to 'general'
        res = await conn.execute(
            text("UPDATE conversations SET department = 'general' WHERE department IS NULL")
        )
        print(f"Updated {res.rowcount} remaining unassigned conversations to 'general'")

if __name__ == '__main__':
    asyncio.run(main())
