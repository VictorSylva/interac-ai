"""
InteracAI Module Registry Service.
Handles dynamic registration, discovery, and organization entitlements for Industry Modules.
"""

from typing import Dict, List, Optional
import logging
from modules.base import BaseIndustryModule, IndustryModuleManifest


logger = logging.getLogger(__name__)


class ModuleRegistryService:
    def __init__(self):
        self._registered_modules: Dict[str, BaseIndustryModule] = {}
        # Memory fallback for tenant active modules if database table is initializing
        self._org_active_modules: Dict[str, List[str]] = {}

    def register_module(self, module: BaseIndustryModule) -> None:
        """Register an Industry Module into the platform registry."""
        manifest = module.manifest
        if manifest.id in self._registered_modules:
            logger.warning(f"Overwriting already registered module: {manifest.id}")
        self._registered_modules[manifest.id] = module
        logger.info(f"Successfully registered Industry Module: {manifest.name} ({manifest.id})")

    def list_available_modules(self) -> List[IndustryModuleManifest]:
        """Returns manifests of all available Industry Modules in the system."""
        return [mod.manifest for mod in self._registered_modules.values()]

    def get_module(self, module_id: str) -> Optional[BaseIndustryModule]:
        """Retrieves a registered module by its unique identifier."""
        return self._registered_modules.get(module_id)

    def get_installed_modules_for_org(self, org_id: str) -> List[IndustryModuleManifest]:
        """Returns manifests of modules installed/active for a specific organization."""
        active_ids = self._org_active_modules.get(org_id, [])
        manifests = []
        for mod_id in active_ids:
            mod = self.get_module(mod_id)
            if mod:
                manifests.append(mod.manifest)
        return manifests

    async def install_module_for_org(self, org_id: str, module_id: str, db_session=None) -> bool:
        """Installs/Enables an Industry Module for an organization."""
        module = self.get_module(module_id)
        if not module:
            raise ValueError(f"Module '{module_id}' not found in platform registry.")

        if org_id not in self._org_active_modules:
            self._org_active_modules[org_id] = []

        if module_id not in self._org_active_modules[org_id]:
            success = await module.on_install(org_id, db_session)
            if success:
                self._org_active_modules[org_id].append(module_id)
                logger.info(f"Module '{module_id}' installed for Organization '{org_id}'")
                return True
        return False

    async def uninstall_module_for_org(self, org_id: str, module_id: str, db_session=None) -> bool:
        """Uninstalls/Disables an Industry Module for an organization."""
        module = self.get_module(module_id)
        if not module:
            return False

        if org_id in self._org_active_modules and module_id in self._org_active_modules[org_id]:
            success = await module.on_uninstall(org_id, db_session)
            if success:
                self._org_active_modules[org_id].remove(module_id)
                logger.info(f"Module '{module_id}' uninstalled for Organization '{org_id}'")
                return True
        return False


# Singleton Instance
module_registry = ModuleRegistryService()
