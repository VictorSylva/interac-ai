"""
InteracAI Industry Modules Bootstrap & Auto-Loader.
Discovers and registers built-in industry modules into the platform ModuleRegistry and CopilotSkillRegistry.
"""

import logging
from services.module_registry import module_registry
from modules.retail import RetailModule
from modules.bible_translation import BibleTranslationModule
from modules.estate import EstateModule
from modules.hospital import HospitalModule
from modules.hotels import HotelsModule
from modules.nigeria_irs import NigeriaIRSModule
from modules.church import ChurchModule
from modules.government import GovernmentModule
from modules.manufacturing import ManufacturingModule
from modules.education import EducationModule
from modules.agriculture import AgricultureModule


logger = logging.getLogger(__name__)


async def load_all_industry_modules(default_org_id: str = "default_business") -> None:
    """Instantiates and registers all platform Industry Modules."""
    modules = [
        RetailModule(),
        BibleTranslationModule(),
        EstateModule(),
        HospitalModule(),
        HotelsModule(),
        NigeriaIRSModule(),
        ChurchModule(),
        GovernmentModule(),
        ManufacturingModule(),
        EducationModule(),
        AgricultureModule()
    ]

    for mod in modules:
        module_registry.register_module(mod)

    logger.info(f"Loaded and registered {len(modules)} Industry Starter Modules in platform registry.")
