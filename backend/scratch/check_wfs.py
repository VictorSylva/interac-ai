import asyncio
from database.session import AsyncSessionLocal
from database.models.workflow import WorkflowExecution, ExecutionStep, Workflow
from sqlalchemy import select, desc

async def dump_latest():
    async with AsyncSessionLocal() as session:
        stmt = select(WorkflowExecution).order_by(desc(WorkflowExecution.created_at)).limit(5)
        res = await session.execute(stmt)
        excs = res.scalars().all()
        
        for ex in excs:
            print(f"--- Execution {ex.id} ---")
            print(f"Workflow ID: {ex.workflow_id}")
            print(f"Status: {ex.status}")
            print(f"Created At: {ex.created_at}")
            print(f"Trigger Data: {ex.trigger_event}")
            
            steps_stmt = select(ExecutionStep).where(ExecutionStep.execution_id == ex.id).order_by(ExecutionStep.created_at)
            steps_res = await session.execute(steps_stmt)
            steps = steps_res.scalars().all()
            
            for s in steps:
                print(f"  Step: Node {s.node_id} | Status: {s.status}")
                if s.output_data:
                    print(f"  Output: {s.output_data}")

if __name__ == "__main__":
    asyncio.run(dump_latest())
