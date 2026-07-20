"""
InteracAI Copilot Skill Registry.
Provides a central registry for registering, discovering, and executing industry-specific AI Copilot skills.
"""

from typing import Dict, Any, List, Callable, Optional
import logging
import asyncio

logger = logging.getLogger(__name__)


class CopilotSkill:
    def __init__(self, module_id: str, name: str, description: str, handler: Callable):
        self.module_id = module_id
        self.name = name
        self.description = description
        self.handler = handler

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": f"{self.module_id}:{self.name}",
            "module_id": self.module_id,
            "name": self.name,
            "description": self.description
        }


class CopilotSkillRegistry:
    def __init__(self):
        self._skills: Dict[str, CopilotSkill] = {}

    def register_skill(self, module_id: str, name: str, description: str, handler: Callable) -> CopilotSkill:
        key = f"{module_id}:{name}"
        skill = CopilotSkill(module_id=module_id, name=name, description=description, handler=handler)
        self._skills[key] = skill
        logger.info(f"Registered Copilot Skill: '{key}'")
        return skill

    def list_all_skills(self) -> List[Dict[str, Any]]:
        return [skill.to_dict() for skill in self._skills.values()]

    def get_skills_for_org(self, active_module_ids: List[str]) -> List[Dict[str, Any]]:
        """Returns skills available for an organization based on its installed modules."""
        allowed_modules = set(["core"] + active_module_ids)
        available = []
        for skill in self._skills.values():
            if skill.module_id in allowed_modules:
                available.append(skill.to_dict())
        return available

    async def execute_skill(self, skill_key: str, kwargs: Dict[str, Any]) -> Any:
        """Executes a registered skill by key."""
        skill = self._skills.get(skill_key)
        if not skill:
            raise ValueError(f"Copilot skill '{skill_key}' is not registered.")

        if asyncio.iscoroutinefunction(skill.handler):
            return await skill.handler(**kwargs)
        else:
            return skill.handler(**kwargs)


# Singleton Instance
copilot_skill_registry = CopilotSkillRegistry()
