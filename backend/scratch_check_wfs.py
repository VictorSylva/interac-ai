import asyncio
from database.session import AsyncSessionLocal
from database.models.workflow import Workflow
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def f():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Workflow).options(selectinload(Workflow.nodes), selectinload(Workflow.edges)))
        for w in res.scalars():
            print(w.id, w.business_id, w.name, w.trigger_type, len(w.nodes), len(w.edges))

asyncio.run(f())
