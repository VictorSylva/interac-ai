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

    target_org_ids = list(set([default_org_id, "0bbd48c4-b066-435a-be3d-c095b55897c6", "INTERAC_HQ"]))
    for mod in modules:
        module_registry.register_module(mod)
        for org_id in target_org_ids:
            try:
                await module_registry.install_module_for_org(org_id, mod.manifest.id)
            except Exception as inst_err:
                logger.debug(f"Note on module pre-install for {org_id}: {inst_err}")

    logger.info(f"Loaded and registered {len(modules)} Industry Starter Modules across platform workspaces.")
