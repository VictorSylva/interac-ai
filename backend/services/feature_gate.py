import logging
from services.entitlement_service import entitlement_service

logger = logging.getLogger(__name__)

class FeatureGate:
    @staticmethod
    async def get_business_plan(business_id: str):
        """Deprecated: Returns commercial entitlement profile bundle."""
        return await entitlement_service.get_business_entitlement_bundle(business_id)

    @staticmethod
    async def check_feature(business_id: str, feature_key: str) -> bool:
        """
        Validates if a business has access to a specific feature based on their custom entitlements.
        """
        return await entitlement_service.is_entitled(business_id, feature_key)

    @staticmethod
    async def check_limit(business_id: str, limit_key: str, current_count: int) -> bool:
        """
        Validates if a business is within their custom resource limits.
        """
        limit = await entitlement_service.get_limit(business_id, limit_key)
        if limit is None or limit == -1:
            return True
        return current_count < limit

feature_gate = FeatureGate()
