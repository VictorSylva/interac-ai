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


logger = logging.getLogger(__name__)


async def load_all_industry_modules(default_org_id: str = "default_business") -> None:
    """Instantiates and registers all platform Industry Modules."""
    modules = [
        RetailModule(),
        BibleTranslationModule(),
        EstateModule(),
        HospitalModule(),
        HotelsModule(),
        NigeriaIRSModule()
    ]

    for mod in modules:
        module_registry.register_module(mod)
        # Pre-install on default workspace for immediate operational readiness
        await module_registry.install_module_for_org(default_org_id, mod.manifest.id)

    logger.info(f"Loaded and registered {len(modules)} Industry Starter Modules into InteracAI.")
