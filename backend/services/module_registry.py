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
        """Retrieves a registered module by its unique identifier (normalizing module_ prefix)."""
        if not module_id:
            return None
        if module_id in self._registered_modules:
            return self._registered_modules[module_id]
        
        # Check without module_ prefix
        clean_id = module_id.replace("module_", "")
        if clean_id in self._registered_modules:
            return self._registered_modules[clean_id]
            
        # Check with module_ prefix
        prefixed_id = f"module_{clean_id}"
        if prefixed_id in self._registered_modules:
            return self._registered_modules[prefixed_id]
            
        return None

    async def get_installed_modules_for_org(self, org_id: str, db_session=None) -> List[IndustryModuleManifest]:
        """Returns manifests of modules installed/active for a specific organization."""
        if not org_id:
            return []

        local_session = False
        if db_session is None:
            from database.session import AsyncSessionLocal
            db_session = AsyncSessionLocal()
            local_session = True

        active_ids = []
        try:
            from sqlalchemy import select
            from database.models.general import BusinessSettings
            stmt = select(BusinessSettings).where(BusinessSettings.business_id == org_id)
            res = await db_session.execute(stmt)
            settings = res.scalar_one_or_none()
            if settings and settings.installed_modules:
                import json
                if isinstance(settings.installed_modules, str):
                    active_ids = json.loads(settings.installed_modules)
                elif isinstance(settings.installed_modules, list):
                    active_ids = list(settings.installed_modules)
            self._org_active_modules[org_id] = active_ids
        except Exception as e:
            logger.error(f"Error loading installed modules from DB for {org_id}: {e}")
            active_ids = self._org_active_modules.get(org_id, [])
        finally:
            if local_session:
                await db_session.close()

        manifests = []
        for mod_id in active_ids:
            mod = self.get_module(mod_id)
            if mod and mod.manifest not in manifests:
                manifests.append(mod.manifest)
        return manifests

    async def install_module_for_org(self, org_id: str, module_id: str, db_session=None) -> bool:
        """Installs/Enables an Industry Module for an organization."""
        module = self.get_module(module_id)
        if not module:
            raise ValueError(f"Module '{module_id}' not found in platform registry.")

        canon_id = module.manifest.id

        local_session = False
        if db_session is None:
            from database.session import AsyncSessionLocal
            db_session = AsyncSessionLocal()
            local_session = True

        try:
            from sqlalchemy import select
            from database.models.general import BusinessSettings
            stmt = select(BusinessSettings).where(BusinessSettings.business_id == org_id)
            res = await db_session.execute(stmt)
            settings = res.scalar_one_or_none()
            if not settings:
                settings = BusinessSettings(business_id=org_id, installed_modules=[])
                db_session.add(settings)

            current_installed = list(settings.installed_modules or [])
            clean_id = canon_id.replace("module_", "")
            
            # Check if either canonical or short name is already in installed list
            already_installed = any(m in (canon_id, module_id, clean_id, f"module_{clean_id}") for m in current_installed)
            if not already_installed:
                success = await module.on_install(org_id, db_session)
                current_installed.append(canon_id)
                settings.installed_modules = current_installed
                await db_session.commit()
                self._org_active_modules[org_id] = current_installed
                logger.info(f"Module '{canon_id}' installed for Organization '{org_id}'")
                return True
            else:
                self._org_active_modules[org_id] = current_installed
                return True
        except Exception as e:
            logger.error(f"Error installing module {module_id} for {org_id}: {e}")
            await db_session.rollback()
            return False
        finally:
            if local_session:
                await db_session.close()

    async def uninstall_module_for_org(self, org_id: str, module_id: str, db_session=None) -> bool:
        """Uninstalls/Disables an Industry Module for an organization."""
        module = self.get_module(module_id)
        canon_id = module.manifest.id if module else module_id
        clean_id = canon_id.replace("module_", "")

        local_session = False
        if db_session is None:
            from database.session import AsyncSessionLocal
            db_session = AsyncSessionLocal()
            local_session = True

        try:
            from sqlalchemy import select
            from database.models.general import BusinessSettings
            stmt = select(BusinessSettings).where(BusinessSettings.business_id == org_id)
            res = await db_session.execute(stmt)
            settings = res.scalar_one_or_none()
            
            current_installed = list(settings.installed_modules or []) if settings else []
            updated_installed = [
                m for m in current_installed
                if m not in (canon_id, module_id, clean_id, f"module_{clean_id}")
            ]

            if settings:
                settings.installed_modules = updated_installed
                await db_session.commit()

            if module:
                try:
                    await module.on_uninstall(org_id, db_session)
                except Exception as uninst_err:
                    logger.warning(f"Note on module on_uninstall for {module_id}: {uninst_err}")

            self._org_active_modules[org_id] = updated_installed
            logger.info(f"Module '{canon_id}' uninstalled for Organization '{org_id}'")
            return True
        except Exception as e:
            logger.error(f"Error uninstalling module {module_id} for {org_id}: {e}")
            await db_session.rollback()
            return False
        finally:
            if local_session:
                await db_session.close()


# Singleton Instance
module_registry = ModuleRegistryService()
