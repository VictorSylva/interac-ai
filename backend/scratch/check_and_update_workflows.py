import sys
import os
sys.path.append(os.path.join(os.getcwd()))

import asyncio
import json
from database.session import AsyncSessionLocal
from database.models.workflow import WorkflowNode
from sqlalchemy import select

async def update_emails():
    async with AsyncSessionLocal() as session:
        try:
            stmt = select(WorkflowNode).where(WorkflowNode.type == "action")
            result = await session.execute(stmt)
            nodes = result.scalars().all()
            
            updated_count = 0
            for node in nodes:
                config = node.config or {}
                # Check email nodes
                if config.get("action_type") == "send_email":
                    to_email = config.get("to")
                    body = config.get("body", "")
                    subject = config.get("subject", "")
                    
                    modified = False
                    if to_email == "interacai.int@gmail.com":
                        config["to"] = "contact@interacai.com"
                        modified = True
                    if "interacai.int@gmail.com" in body:
                        config["body"] = body.replace("interacai.int@gmail.com", "contact@interacai.com")
                        modified = True
                    if "interacai.int@gmail.com" in subject:
                        config["subject"] = subject.replace("interacai.int@gmail.com", "contact@interacai.com")
                        modified = True
                        
                    if modified:
                        node.config = config
                        session.add(node)
                        updated_count += 1
                        print(f"Updated node {node.id} ({node.label}) config: {config}")
            
            if updated_count > 0:
                await session.commit()
                print(f"Successfully updated {updated_count} workflow nodes in local database.")
            else:
                print("No workflow nodes matching 'interacai.int@gmail.com' found in local database.")
        except Exception as e:
            print("Error updating database:", e)

if __name__ == "__main__":
    asyncio.run(update_emails())
