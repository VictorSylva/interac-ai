import os
import json
import inspect
from typing import List, Dict, Any
import logging

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from app.agents.tools import AVAILABLE_TOOLS

logger = logging.getLogger("app.agents.agent")

SYSTEM_PROMPT = """You are ARGUS, an advanced autonomous AI security agent.
Your primary role is to investigate security events, analyze the security graph, and answer operator queries.
You have access to real-time surveillance data and the security graph.
Always use your tools to gather accurate information before answering. 
If an operator asks about an entity, use get_entity_details. If they ask for a general summary, use get_top_risk_entities.
"""

def get_openai_tools():
    return [
        {
            "type": "function",
            "function": {
                "name": "get_top_risk_entities",
                "description": "Get the current top high-risk entities in the security graph.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Number of entities to return"}
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_entity_details",
                "description": "Get the full profile and relationships of a specific entity by its identifier.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "identifier": {"type": "string", "description": "The unique identifier of the entity"}
                    },
                    "required": ["identifier"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_recent_events",
                "description": "Get the most recent surveillance events/observations from cameras.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Number of events to return"}
                    }
                }
            }
        }
    ]

async def run_security_agent(query: str, chat_history: List[Dict[str, str]] = None) -> str:
    """
    Executes a custom ReAct loop using OpenAI's tool calling (OpenRouter compatible).
    """
    if OpenAI is None:
        logger.error("openai package is not installed or configured.")
        return "Error: AI engine is offline. Please install the `openai` package."

    # Support either variable
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("OPENROUTER_API_KEY not found. Using mock agent response.")
        return f"[MOCK AI RESPONSE] I am the ARGUS AI Agent. You asked: '{query}'. In a production environment, I would query the graph and provide actionable intelligence here."

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    if chat_history:
        for msg in chat_history:
            role = "assistant" if msg["role"] == "model" else msg["role"]
            messages.append({"role": role, "content": msg["content"]})
            
    messages.append({"role": "user", "content": query})

    tools = get_openai_tools()

    MAX_ITERATIONS = 5
    for i in range(MAX_ITERATIONS):
        try:
            response = client.chat.completions.create(
                model="google/gemini-2.5-pro",
                messages=messages,
                tools=tools,
                temperature=0.2,
            )
            
            message = response.choices[0].message
            
            # Need to dump model message back to history before appending tool results
            messages.append(message.model_dump(exclude_none=True))

            # Check for tool calls
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    func_name = tool_call.function.name
                    try:
                        args = json.loads(tool_call.function.arguments)
                    except json.JSONDecodeError:
                        args = {}
                        
                    logger.info(f"Agent invoking tool: {func_name} with args: {args}")
                    
                    if func_name in AVAILABLE_TOOLS:
                        tool_func = AVAILABLE_TOOLS[func_name]
                        if inspect.iscoroutinefunction(tool_func):
                            result = await tool_func(**args)
                        else:
                            result = tool_func(**args)
                            
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": func_name,
                            "content": str(result)
                        })
                    else:
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": func_name,
                            "content": f"Error: Tool {func_name} not found."
                        })
                # Continue loop to let model think about the tool results
                continue
                
            # If no tools were called, the model is done
            if message.content:
                return message.content
                
        except Exception as e:
            logger.error(f"Agent encountered an error: {e}")
            return f"An internal error occurred during reasoning: {e}"
            
    return "I apologize, but I require more information or time to process this complex request."
