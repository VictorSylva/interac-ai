import sys
import os
sys.path.append(os.path.join(os.getcwd()))

import asyncio
from database.session import AsyncSessionLocal
from database.models.workflow import WorkflowNode
from sqlalchemy import select

async def print_nodes():
    async with AsyncSessionLocal() as session:
        stmt = select(WorkflowNode)
        res = await session.execute(stmt)
        nodes = res.scalars().all()
        print(f"Found {len(nodes)} nodes:")
        for n in nodes:
            print(f"Node ID: {n.id} | Type: {n.type} | Label: {n.label} | Config: {n.config}")

if __name__ == "__main__":
    asyncio.run(print_nodes())
