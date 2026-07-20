"""
InteracAI Base Industry Module Interface & Manifest Specification
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class EntityTypeSpec(BaseModel):
    code: str = Field(..., description="Unique entity type code e.g. 'vehicle', 'translation_project'")
    label: str = Field(..., description="Human-readable label e.g. 'Translation Project'")
    icon: Optional[str] = Field("Extension", description="Icon name for frontend display")
    description: Optional[str] = None
    default_attributes: Dict[str, Any] = Field(default_factory=dict)


class UIRouteSpec(BaseModel):
    path: str = Field(..., description="Relative React route path e.g. '/translation/projects'")
    component: str = Field(..., description="Name of the React component to render")
    title: str = Field(..., description="Sidebar/Navigation label")
    icon: Optional[str] = "Extension"


class UIExtensionsSpec(BaseModel):
    routes: List[UIRouteSpec] = Field(default_factory=list)
    dashboard_widgets: List[str] = Field(default_factory=list)


class IndustryModuleManifest(BaseModel):
    id: str = Field(..., description="Unique module identifier e.g. 'module_bible_translation'")
    name: str = Field(..., description="Display name e.g. 'Bible Translation & Language Impact'")
    version: str = Field("1.0.0", description="Semantic version string")
    description: str = Field(..., description="Detailed description of the module capabilities")
    category: str = Field("General", description="Module domain category")
    author: Optional[str] = "InteracAI Platform Team"
    icon: Optional[str] = "Boxes"
    entity_types: List[EntityTypeSpec] = Field(default_factory=list)
    default_workflows: List[str] = Field(default_factory=list)
    knowledge_packs: List[str] = Field(default_factory=list)
    copilot_skills: List[str] = Field(default_factory=list)
    ui_extensions: UIExtensionsSpec = Field(default_factory=UIExtensionsSpec)


class BaseIndustryModule(ABC):
    """
    Abstract Base Class for all InteracAI Industry Modules.
    Modules inherit from this class and register custom logic.
    """

    @property
    @abstractmethod
    def manifest(self) -> IndustryModuleManifest:
        """Returns the module manifest specification."""
        pass

    @abstractmethod
    async def on_install(self, org_id: str, db_session) -> bool:
        """Lifecycle hook executed when an organization installs/enables this module."""
        pass

    @abstractmethod
    async def on_uninstall(self, org_id: str, db_session) -> bool:
        """Lifecycle hook executed when an organization uninstalls this module."""
        pass

    @abstractmethod
    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        """Returns module-specific AI skills to be registered in the Copilot Skill Registry."""
        pass

    @abstractmethod
    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        """Returns industry-specific threat and risk rules for ARGUS OS."""
        pass
