# Commercial & Subscription Setup

This document outlines the readiness and specs of InteracAI's billing, subscription engine (integrated with Paystack), and the included Website Development benefit package.

## 1. Current Implementation Status
Based on the workspace configuration, the platform supports:
- **Paystack Initialization & Verification**: Secure backend calls using HMAC SHA512 webhook verification.
- **Multiple Environments**: Dynamic switching between Test and Live Paystack keys based on the `.env` configuration.
- **Subscription Plans**: Managed via `seed_plans.py` (database models exist for Subscription/Billing logic).
- **Website Development Inclusion**:
  - **Starter Plan**: AI Receptionist and automation tools only. No website included.
  - **Growth Plan**: Includes Everything in Starter plus a Professional Business Website (up to 6 pages, responsive, WhatsApp integration, contact forms, and maps). *External hosting required.*
  - **Pro Plan**: Includes Everything in Growth plus a Premium Business Website (up to 12 pages, custom UI/UX, blog, portfolio, booking engine, API integration, CRM sync, managed hosting, and SSL).

## 2. Admin-Managed Website Deployments
For qualifying plans (Growth and Pro), the deployment of client websites is managed by platform administrators.
1. **Onboarding**: Upon subscribing, the client fills out their Business Profile (populating the AI receptionist and website templates).
2. **Review & Customization**: Designers customize the UI/UX (Pro) or apply standard layouts (Growth).
3. **Domain Routing & Provisioning (Pro Only)**: Admins assist Pro clients in pointing custom domain names (CNAME/A records) to our managed hosting servers and automatically generate SSL certificates (Let's Encrypt / Cloudflare). Growth clients are provided the code export/deployment setup for external hosting.
4. **Updates**: Clients manage text, images, and other contents through their dashboard, and changes are synced directly.

## 3. Setting Up Paystack for Production
1. **Live Keys**: Obtain your `PAYSTACK_SECRET_KEY` (`sk_live_...`) and `PAYSTACK_PUBLIC_KEY` (`pk_live_...`) from the Paystack Dashboard.
2. **Webhooks**: Configure the Webhook URL in Paystack to point to your live backend endpoint (e.g., `https://api.interacai.com/api/subscriptions/webhook`).
3. **Webhook Events**: Ensure your backend handles the following Paystack events:
   - `charge.success` (To provision tokens/activate accounts).
   - `subscription.create`, `subscription.disable`.
   - `invoice.create`, `invoice.payment_failed`.

## 4. Recommended Upgrades Before Scaling
1. **Prorated Upgrades/Downgrades**: Logic to handle users switching plans mid-billing cycle.
2. **Usage-Based Billing Expansion**: Celery tasks that warn users when they are nearing their token limits.
3. **Failed Payment Recovery**: Automated email sequences when `invoice.payment_failed` is received.

## 5. WhatsApp Business API Readiness
1. Ensure your WhatsApp Meta App is fully verified and has advanced tier access.
2. Handle Meta Webhooks for message status (`sent`, `delivered`, `read`) to provide analytics to paying businesses.
3. Implement strict Rate Limiting to prevent a single organization from exhausting your total Meta API limits.
