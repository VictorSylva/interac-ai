import asyncio
import json
from database.session import AsyncSessionLocal
from database.models.workflow import Workflow
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def f():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Workflow).options(selectinload(Workflow.nodes), selectinload(Workflow.edges)).where(Workflow.id == 'e7dc57dd-23be-461c-9cd2-b537db6dc75b'))
        w = res.scalar_one_or_none()
        if w:
            data = {
                "id": w.id,
                "name": w.name,
                "trigger_type": w.trigger_type,
                "trigger_config": w.trigger_config,
                "definition": w.definition,
                "nodes": [{"id": n.id, "type": n.type, "label": n.label, "config": n.config, "platform_meta": n.platform_meta} for n in w.nodes],
                "edges": [{"id": e.id, "source": e.source_id, "target": e.target_id} for e in w.edges]
            }
            with open("scratch_workflow_dump.json", "w") as f:
                json.dump(data, f, indent=2)
            print("Dumped to scratch_workflow_dump.json")

asyncio.run(f())
