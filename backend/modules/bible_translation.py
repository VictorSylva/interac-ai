"""
InteracAI Bible Translation & Language Impact Industry Starter Module.
Streamlines translation projects, field reports, community engagements, and donor impact reporting.
"""

from typing import Dict, Any, List
from modules.base import BaseIndustryModule, IndustryModuleManifest, EntityTypeSpec, UIRouteSpec, UIExtensionsSpec, PermissionSpec, WidgetSpec
from services.copilot_skill_registry import copilot_skill_registry



class BibleTranslationModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_bible_translation",
            name="Bible Translation & Field Impact",
            version="1.0.0",
            description="Manages translation projects, language catalog, field reports, and donor impact analytics.",
            category="Non-Profit & Field Operations",
            icon="Languages",
            entity_types=[
                EntityTypeSpec(code="language", label="Language Profile", icon="Globe"),
                EntityTypeSpec(code="translation_project", label="Translation Project", icon="BookOpen"),
                EntityTypeSpec(code="field_report", label="Field Incident & Report", icon="FileText"),
                EntityTypeSpec(code="volunteer", label="Translator / Volunteer", icon="UserCheck")
            ],
            copilot_skills=["module_bible_translation:analyze_translation_progress", "module_bible_translation:generate_donor_impact_report"],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/translation/projects", component="TranslationProjectsPage", title="Translation Projects", icon="BookOpen"),
                    UIRouteSpec(path="/translation/languages", component="LanguageCatalogPage", title="Language Catalog", icon="Globe")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="translation_progress_bar", type="metric", title="Overall Draft Progress", icon="CheckCircle", config={"value": "72%"}),
                    WidgetSpec(id="translation_languages_count", type="metric", title="Active Languages", icon="Globe", config={"value": "45"})
                ]
            ),
            permissions=[
                PermissionSpec(department="translation", role_tier="staff"),
                PermissionSpec(department="fieldops", role_tier="officer")
            ]
        )

    async def on_install(self, org_id: str, db_session) -> bool:
        copilot_skill_registry.register_skill(
            module_id="module_bible_translation",
            name="analyze_translation_progress",
            description="Analyzes completed chapter reviews and milestones across all active language translation projects.",
            handler=self._skill_analyze_progress
        )
        copilot_skill_registry.register_skill(
            module_id="module_bible_translation",
            name="generate_donor_impact_report",
            description="Synthesizes field stories, literacy milestones, and community progress into a donor briefing.",
            handler=self._skill_donor_report
        )
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_bible_translation"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [{"rule": "project_milestone_delayed_over_30_days", "risk_weight": 0.6}]

    async def _skill_analyze_progress(self, region: str = "all") -> Dict[str, Any]:
        return {
            "region": region,
            "active_languages": 14,
            "completed_chapters_this_month": 128,
            "delayed_projects": ["Kafanchan New Testament (85% completed)"],
            "summary": "Overall translation velocity increased by 14% following new volunteer onboarding."
        }

    async def _skill_donor_report(self, language_code: str = "all") -> Dict[str, Any]:
        return {
            "language": language_code,
            "impact_summary": "Reached 4 local communities across Southern Kaduna with digital audio Scriptures.",
            "literacy_class_participants": 340,
            "key_milestones": ["Gbagyi Genesis audio recording completed", "Fulfulde Gospel of Luke draft approved"]
        }
