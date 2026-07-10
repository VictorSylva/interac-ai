# Commercial & Subscription Setup

This document outlines the readiness of InteracAI's billing and subscription engine, integrated with Paystack.

## 1. Current Implementation Status
Based on the workspace audit (`services/payment_service.py` and `database/models/billing.py`), the platform currently supports:
- **Paystack Initialization & Verification**: Secure backend calls using HMAC SHA512 webhook verification.
- **Multiple Environments**: Dynamic switching between Test and Live Paystack keys based on the `.env`.
- **Subscription Plans**: Managed via `seed_plans.py` (database models exist for Subscription/Billing logic).

## 2. Setting Up Paystack for Production
1. **Live Keys**: Obtain your `PAYSTACK_SECRET_KEY` (`sk_live_...`) and `PAYSTACK_PUBLIC_KEY` (`pk_live_...`) from the Paystack Dashboard.
2. **Webhooks**: Configure the Webhook URL in Paystack to point to your live backend endpoint (e.g., `https://api.interacai.com/api/v1/sales/webhook`).
3. **Webhook Events**: Ensure your backend handles the following Paystack events:
   - `charge.success` (To provision tokens/activate accounts).
   - `subscription.create`, `subscription.disable`.
   - `invoice.create`, `invoice.payment_failed`.

## 3. Recommended Upgrades Before Scaling
While the current foundation is solid, consider adding:
1. **Prorated Upgrades/Downgrades**: Logic to handle users switching plans mid-billing cycle.
2. **Usage-Based Billing Expansion**: The `COST_PER_TOKEN` environment variable suggests a usage model. Ensure you have a background job (Celery) that warns users when they are nearing their token limits.
3. **Failed Payment Recovery**: Automated email sequences (via SendGrid/SMTP) when `invoice.payment_failed` is received.

## 4. WhatsApp Business API Readiness
If charging for WhatsApp workflows:
1. Ensure your WhatsApp Meta App is fully verified and has advanced tier access.
2. Ensure you handle Meta Webhooks for message status (`sent`, `delivered`, `read`) to provide analytics to paying businesses.
3. Implement strict Rate Limiting to prevent a single organization from exhausting your total Meta API limits.
