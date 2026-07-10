import logging
from sqlalchemy import select
from database.session import AsyncSessionLocal
from database.models.billing import BusinessSubscription, SubscriptionPlan
from database.models.general import Business

logger = logging.getLogger(__name__)

class FeatureGate:
    @staticmethod
    async def get_business_plan(business_id: str):
        """Fetches the active subscription and associated plan details."""
        async with AsyncSessionLocal() as session:
            try:
                # Resolve the plan through Business -> BusinessSubscription -> SubscriptionPlan
                stmt = select(SubscriptionPlan).join(
                    BusinessSubscription, BusinessSubscription.plan_id == SubscriptionPlan.id
                ).where(BusinessSubscription.business_id == business_id, BusinessSubscription.status == 'active')
                
                result = await session.execute(stmt)
                return result.scalar_one_or_none()
            except Exception as e:
                logger.error(f"Error fetching plan for {business_id}: {e}")
                return None

    @staticmethod
    async def check_feature(business_id: str, feature_key: str) -> bool:
        """
        Validates if a business has access to a specific feature based on their plan.
        Feature keys: 'whatsapp_bot', 'web_chat', 'advanced_workflows', 'analytics_full', 'scheduling', 'api_access'
        """
        # Feature restrictions removed: All businesses can use all features if they have tokens.
        return True

    @staticmethod
    async def check_limit(business_id: str, limit_key: str, current_count: int) -> bool:
        """
        Validates if a business is within their plan's resource limits.
        Limit keys: 'max_workflows', 'max_ai_messages'
        """
        # Workflow limits removed: All businesses can create unlimited workflows.
        if limit_key == "max_workflows":
            return True

        plan = await FeatureGate.get_business_plan(business_id)
        
        # Fallback defaults for missing plans or keys
        defaults = {
            'max_workflows': 100, # Increased default
            'max_ai_messages': 10000 # Increased default
        }

        if not plan:
            return current_count < defaults.get(limit_key, 0)

        limits = plan.limits or {}
        max_val = limits.get(limit_key)
        
        if max_val is None:
            return True # Default to unlimited if not specified

        if max_val == -1: # -1 indicates unlimited
            return True
            
        return current_count < max_val

feature_gate = FeatureGate()
