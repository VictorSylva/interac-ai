"""
Migration script to migrate existing multi-tenant businesses to the new SaaS platform model.
Reads active modules, sets the primary industry, syncs installed modules, and preserves all data.
"""

import sys
import os
import asyncio
import json

# Add parent directory to sys.path so we can import database models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import AsyncSessionLocal
from database.models.general import Business, BusinessSettings
from sqlalchemy import select

# Mapping of module ID to primary industry
MODULE_TO_INDUSTRY = {
    "module_hotels": "hotel",
    "module_hospital": "hospital",
    "module_retail": "retail",
    "module_education": "school",
    "module_church": "church",
    "module_manufacturing": "manufacturing",
    "module_government": "government",
    "module_bible_translation": "ngo",
    "module_estate": "estate",
    "module_agriculture": "agriculture",
    "module_nigeria_irs": "irs"
}

async def run_migration():
    print("[MIGRATION] Starting SaaS Tenant Model Migration...")
    
    # Apply column patches first
    from database.session import engine
    from sqlalchemy import text
    try:
        async with engine.begin() as conn:
            for col, col_type in [("industry", "VARCHAR"), ("subscription_plan", "VARCHAR DEFAULT 'starter'"), ("installed_modules", "TEXT DEFAULT '[]'"), ("enabled_features", "TEXT DEFAULT '[]'")]:
                if "postgresql" in str(engine.url):
                    await conn.execute(text(f"ALTER TABLE businesses ADD COLUMN IF NOT EXISTS {col} {col_type}"))
                else:
                    try:
                        await conn.execute(text(f"ALTER TABLE businesses ADD COLUMN {col} {col_type}"))
                    except Exception as sqlite_col_err:
                        if "duplicate column name" not in str(sqlite_col_err).lower():
                            raise sqlite_col_err
    except Exception as patch_err:
        print(f"[MIGRATION] Warning: Optional patch businesses columns error: {patch_err}")
        
    async with AsyncSessionLocal() as session:
        # Get all businesses
        res = await session.execute(select(Business))
        businesses = res.scalars().all()
        
        migrated_count = 0
        for biz in businesses:
            print(f"[MIGRATION] Processing Business: {biz.name} (ID: {biz.id})")
            
            # Fetch settings
            res_settings = await session.execute(
                select(BusinessSettings).where(BusinessSettings.business_id == biz.id)
            )
            settings = res_settings.scalar_one_or_none()
            
            installed_mods = []
            if settings and settings.installed_modules:
                if isinstance(settings.installed_modules, str):
                    installed_mods = json.loads(settings.installed_modules)
                elif isinstance(settings.installed_modules, list):
                    installed_mods = list(settings.installed_modules)
            
            # Find primary industry
            primary_industry = None
            for mod_id in installed_mods:
                if mod_id in MODULE_TO_INDUSTRY:
                    primary_industry = MODULE_TO_INDUSTRY[mod_id]
                    break
            
            # If no installed module matched, check if settings.industry is set
            if not primary_industry and settings and settings.industry:
                primary_industry = settings.industry.lower().strip()
                
            # If still none, check name or default to retail
            if not primary_industry:
                name_lower = biz.name.lower()
                if "hospital" in name_lower:
                    primary_industry = "hospital"
                elif "school" in name_lower or "academy" in name_lower or "education" in name_lower:
                    primary_industry = "school"
                elif "hotel" in name_lower:
                    primary_industry = "hotel"
                elif "church" in name_lower:
                    primary_industry = "church"
                else:
                    primary_industry = "retail"
            
            # Set default module for primary industry if none is installed
            default_mod = None
            for ind, mod in {
                "hotel": "module_hotels",
                "hospital": "module_hospital",
                "retail": "module_retail",
                "school": "module_education",
                "church": "module_church",
                "manufacturing": "module_manufacturing",
                "government": "module_government",
                "ngo": "module_bible_translation",
                "estate": "module_estate",
                "restaurant": "module_hotels",
                "agriculture": "module_agriculture",
                "irs": "module_nigeria_irs"
            }.items():
                if primary_industry == ind:
                    default_mod = mod
                    break
            
            if default_mod and default_mod not in installed_mods:
                installed_mods.append(default_mod)
            
            # Set new columns on Business
            biz.industry = primary_industry
            biz.installed_modules = installed_mods
            biz.subscription_plan = biz.subscription_plan or "starter"
            biz.enabled_features = biz.enabled_features or ["crm", "email", "analytics_basic", "scheduling"]
            
            # Update settings for consistency
            if settings:
                settings.industry = primary_industry
                settings.installed_modules = installed_mods
            
            print(f"[MIGRATION] -> Industry: {primary_industry}, Installed Modules: {installed_mods}")
            migrated_count += 1
            
        await session.commit()
        print(f"[MIGRATION] Migration complete! Successfully processed {migrated_count} businesses.")

if __name__ == "__main__":
    asyncio.run(run_migration())
