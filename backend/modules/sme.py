"""
InteracAI General SME & Entrepreneurship Module.
Configures dynamic entities, capability-driven UI routes, 16 database-backed ARGUS intelligence skills,
and threat/risk rules for Small and Medium Enterprises.
"""

from typing import Dict, Any, List
import logging
from modules.base import (
    BaseIndustryModule,
    IndustryModuleManifest,
    EntityTypeSpec,
    UIRouteSpec,
    UIExtensionsSpec,
    PermissionSpec,
    WidgetSpec
)
from services.copilot_skill_registry import copilot_skill_registry

logger = logging.getLogger(__name__)


class SMEModule(BaseIndustryModule):
    @property
    def manifest(self) -> IndustryModuleManifest:
        return IndustryModuleManifest(
            id="module_sme",
            name="SME & Business Operations",
            version="1.0.0",
            description="Universal operating layer for entrepreneurs, startups, and growing small-to-medium businesses across product, service, and hybrid models.",
            category="General SME & Entrepreneurship",
            author="InteracAI Platform Team",
            icon="Briefcase",
            entity_types=[
                EntityTypeSpec(code="sme_customer", label="Customer Dossier", icon="Users", description="Customer directory, interaction records, and spending history"),
                EntityTypeSpec(code="sme_lead", label="Sales Lead", icon="Target", description="Prospective leads in sales acquisition funnel"),
                EntityTypeSpec(code="sme_opportunity", label="Deal / Opportunity", icon="TrendingUp", description="Open sales deals with estimated values and stages"),
                EntityTypeSpec(code="sme_product", label="Product Catalogue", icon="Package", description="Physical products, SKU inventory, cost, and reorder levels"),
                EntityTypeSpec(code="sme_service", label="Service Catalogue", icon="Wrench", description="Service offerings with durations, pricing, and assigned staff"),
                EntityTypeSpec(code="sme_order", label="Sales Order", icon="ShoppingBag", description="Customer purchases across products and services with fulfillment status"),
                EntityTypeSpec(code="sme_appointment", label="Appointment / Booking", icon="Calendar", description="Scheduled service bookings, customer slots, and staff assignments"),
                EntityTypeSpec(code="sme_inventory_movement", label="Stock Movement", icon="Layers", description="Audit trail of inventory additions, deductions, damages, and returns"),
                EntityTypeSpec(code="sme_supplier", label="Supplier Profile", icon="Truck", description="Vendor directory, lead times, and contact details"),
                EntityTypeSpec(code="sme_purchase_order", label="Purchase Order", icon="FileText", description="Procurement orders sent to suppliers"),
                EntityTypeSpec(code="sme_quote", label="Quotation / Estimate", icon="FileSpreadsheet", description="Customer price proposals and quotation states"),
                EntityTypeSpec(code="sme_invoice", label="Operational Invoice", icon="Receipt", description="Receivable billing records and payment settlement"),
                EntityTypeSpec(code="sme_expense", label="Operational Expense", icon="DollarSign", description="Expense logs categorized by rent, utilities, inventory, payroll"),
                EntityTypeSpec(code="sme_project", label="Client Project", icon="FolderKanban", description="Client deliverables with milestones, deadlines, and budgets"),
                EntityTypeSpec(code="sme_project_task", label="Project Task", icon="CheckSquare", description="Work breakdown tasks with assignees and priority"),
                EntityTypeSpec(code="sme_project_milestone", label="Project Milestone", icon="Flag", description="Key deliverable milestones and target dates")
            ],
            copilot_skills=[
                "module_sme:daily_business_brief",
                "module_sme:sales_pipeline_analyzer",
                "module_sme:unanswered_enquiry_detector",
                "module_sme:lead_followup_analyzer",
                "module_sme:customer_activity_analyzer",
                "module_sme:customer_churn_signal_detector",
                "module_sme:revenue_trend_analyzer",
                "module_sme:outstanding_payment_analyzer",
                "module_sme:inventory_risk_analyzer",
                "module_sme:supplier_performance_analyzer",
                "module_sme:appointment_no_show_analyzer",
                "module_sme:staff_workload_analyzer",
                "module_sme:project_delay_analyzer",
                "module_sme:business_bottleneck_detector",
                "module_sme:business_signal_summary",
                "module_sme:owner_attention_prioritizer"
            ],
            ui_extensions=UIExtensionsSpec(
                routes=[
                    UIRouteSpec(path="/sme/overview", component="SMEOverviewPage", title="SME Command Center", icon="LayoutDashboard"),
                    UIRouteSpec(path="/sme/crm", component="SMECRMPage", title="Customers & Pipeline", icon="Users"),
                    UIRouteSpec(path="/sme/orders", component="SMEOrdersPage", title="Sales & Orders", icon="ShoppingBag"),
                    UIRouteSpec(path="/sme/products", component="SMEProductsPage", title="Products & Inventory", icon="Package"),
                    UIRouteSpec(path="/sme/services", component="SMEServicesPage", title="Services & Bookings", icon="Calendar"),
                    UIRouteSpec(path="/sme/finance", component="SMEFinancePage", title="Finance & Invoicing", icon="Receipt"),
                    UIRouteSpec(path="/sme/projects", component="SMEProjectsPage", title="Projects & Tasks", icon="Briefcase"),
                    UIRouteSpec(path="/sme/intelligence", component="SMEIntelligencePage", title="Signal Intelligence", icon="Zap"),
                    UIRouteSpec(path="/sme/settings", component="SMESettingsPage", title="SME Configuration", icon="Sliders")
                ],
                dashboard_widgets=[
                    WidgetSpec(id="sme_kpis", type="metric", title="Core Business Metrics", icon="TrendingUp", config={}),
                    WidgetSpec(id="sme_attention", type="table", title="Owner Attention Feed", icon="AlertCircle", config={}),
                    WidgetSpec(id="sme_signals", type="stream", title="Recent Business Signals", icon="Activity", config={}),
                    WidgetSpec(id="sme_cashflow", type="chart", title="Cash Flow & Receivables", icon="DollarSign", config={})
                ]
            ),
            permissions=[
                PermissionSpec(department="sales", role_tier="staff", allow_write=True),
                PermissionSpec(department="operations", role_tier="staff", allow_write=True),
                PermissionSpec(department="inventory", role_tier="staff", allow_write=True),
                PermissionSpec(department="finance", role_tier="staff", allow_write=True),
                PermissionSpec(department="customer_service", role_tier="staff", allow_write=True),
                PermissionSpec(department="general", role_tier="staff", allow_write=True)
            ]
        )

    def __init__(self):
        super().__init__()
        # Auto-register all 16 SME ARGUS Copilot skills into the platform registry immediately
        self.register_all_skills()

    @staticmethod
    def register_all_skills():
        """Registers all 16 database-backed ARGUS intelligence skills and their aliases into CopilotSkillRegistry."""
        from services.sme_service import sme_service
        skills_definitions = [
            ("daily_business_brief", "Synthesizes today's sales, revenue, open tasks, risks, and attention items into an executive brief.", sme_service.skill_daily_business_brief),
            ("sales_pipeline_analyzer", "Analyzes conversion rates, bottleneck stages, and deal velocity in the sales pipeline.", sme_service.skill_sales_pipeline_analyzer),
            ("unanswered_enquiry_detector", "Detects inbound enquiries pending customer-service response for longer than threshold.", sme_service.skill_unanswered_enquiry_detector),
            ("lead_followup_analyzer", "Identifies hot or neglected leads overdue for sales team follow-up.", sme_service.skill_lead_followup_analyzer),
            ("customer_activity_analyzer", "Segments customers by purchase recency, order frequency, and monetary contribution.", sme_service.skill_customer_activity_analyzer),
            ("customer_churn_signal_detector", "Detects at-risk customers based on dropped interaction frequency and complaints.", sme_service.skill_customer_churn_signal_detector),
            ("revenue_trend_analyzer", "Evaluates rolling revenue, completed order values, and outstanding invoice balances.", sme_service.skill_revenue_trend_analyzer),
            ("outstanding_payment_analyzer", "Audits unpaid receivables, overdue aging buckets, and customer debt exposure.", sme_service.skill_outstanding_payment_analyzer),
            ("inventory_risk_analyzer", "Calculates depletion velocity, low-stock threshold breaches, and stockout projections.", sme_service.skill_inventory_risk_analyzer),
            ("supplier_performance_analyzer", "Measures supplier fulfillment timeliness, purchase order history, and reliability.", sme_service.skill_supplier_performance_analyzer),
            ("appointment_no_show_analyzer", "Audits appointment no-show rates by service, customer segment, and day of week.", sme_service.skill_appointment_no_show_analyzer),
            ("staff_workload_analyzer", "Evaluates open task allocation, pending appointments, and workload distribution across team members.", sme_service.skill_staff_workload_analyzer),
            ("project_delay_analyzer", "Flags projects with overdue tasks, upcoming milestone deadlines, and stalled progress.", sme_service.skill_project_delay_analyzer),
            ("business_bottleneck_detector", "Pinpoints operational friction points across orders, approvals, inventory, and support.", sme_service.skill_business_bottleneck_detector),
            ("business_signal_summary", "Aggregates recent canonical observations into an organized signal intelligence timeline.", sme_service.skill_business_signal_summary),
            ("owner_attention_prioritizer", "Ranks operational risks and opportunities by business impact, financial severity, and urgency.", sme_service.skill_owner_attention_prioritizer),
            # Capability aliases used by UI components
            ("clv_estimator", "Estimates Customer Lifetime Value and purchase frequency tiers.", sme_service.skill_customer_activity_analyzer),
            ("churn_risk_detector", "Identifies dormant and high churn-risk client profiles.", sme_service.skill_customer_churn_signal_detector),
            ("top_customer_identifier", "Ranks VIP and top 10% revenue contributing customer accounts.", sme_service.skill_customer_activity_analyzer),
            ("inactive_customer_reengagement", "Generates targeted win-back campaign prompts for inactive accounts.", sme_service.skill_customer_churn_signal_detector),
            ("expense_anomaly_detector", "Audits expenditures for unusual spikes and budget deviations.", sme_service.skill_revenue_trend_analyzer),
            ("fast_slow_moving_inventory", "Classifies inventory turnover velocity and dead stock risk.", sme_service.skill_inventory_risk_analyzer),
            ("service_utilization_rate", "Evaluates booked service capacity utilization vs idle staff time.", sme_service.skill_appointment_no_show_analyzer),
            ("operational_bottleneck_detector", "Pinpoints overdue tasks, pending deliveries, and delayed work orders.", sme_service.skill_business_bottleneck_detector),
            ("supplier_lead_time_performance", "Analyzes supplier delivery lead time and fulfillment accuracy.", sme_service.skill_supplier_performance_analyzer),
            ("quote_to_order_conversion", "Measures sales proposal win rates and sales velocity.", sme_service.skill_sales_pipeline_analyzer)
        ]

        for skill_name, description, handler in skills_definitions:
            copilot_skill_registry.register_skill(
                module_id="module_sme",
                name=skill_name,
                description=description,
                handler=handler
            )

    async def on_install(self, org_id: str, db_session) -> bool:
        """Installs the SME module, seeds standard entity types and initializes 16 real database-backed skills."""
        from services.sme_service import sme_service

        # Initialize default entity types for the organization
        try:
            await sme_service.initialize_entity_types_for_org(org_id, db_session)
        except Exception as e:
            logger.warning(f"Error auto-initializing entity types for {org_id}: {e}")

        # Ensure all skills are registered
        self.register_all_skills()

        logger.info(f"SME Module successfully installed and configured for organization '{org_id}'")
        return True

    async def on_uninstall(self, org_id: str, db_session) -> bool:
        logger.info(f"SME Module uninstalled for organization '{org_id}'")
        return True

    async def get_copilot_skills(self) -> List[Dict[str, Any]]:
        return copilot_skill_registry.get_skills_for_org(["module_sme"])

    async def get_risk_rules(self) -> List[Dict[str, Any]]:
        return [
            {"rule": "sme_stockout_risk", "threshold": 0, "severity": "CRITICAL", "description": "Critical loss of sales when product inventory hits zero"},
            {"rule": "sme_unanswered_enquiry_sla", "threshold_mins": 30, "severity": "WARNING", "description": "Enquiry without reply exceeds 30 minutes"},
            {"rule": "sme_overdue_invoice_aging", "threshold_days": 14, "severity": "WARNING", "description": "Uncollected receivables overdue by more than 14 days"},
            {"rule": "sme_appointment_no_show_spike", "threshold_pct": 25.0, "severity": "MEDIUM", "description": "Service no-shows exceed 25% of booked appointments"},
            {"rule": "sme_project_deadline_breach", "threshold_hours": 48, "severity": "HIGH", "description": "Project milestone due in less than 48h with incomplete tasks"}
        ]
