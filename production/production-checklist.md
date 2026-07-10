# Production Readiness Checklist

Run through this checklist before switching DNS records and accepting real transactions.

## 1. Infrastructure & Deployment
- [ ] Render PostgreSQL is provisioned with automated backups enabled.
- [ ] Render Web Service is connected to the `main` branch.
- [ ] Render Background Worker (Celery) is provisioned and running.
- [ ] Frontend is successfully building and pointing to the Production API URL.
- [ ] Custom Domains are configured with SSL/TLS enabled.

## 2. Security Configuration
- [ ] **No Secrets in Code**: Verified `production/environment-reference.md`. All actual secrets are strictly in Render Environment Variables.
- [ ] `DEBUG=False` in production backend.
- [ ] `ALLOWED_ORIGINS` is restricted to your exact frontend domain(s) (no `*` or `localhost`).
- [ ] Paystack Webhook validation uses HMAC SHA512.
- [ ] JWT `SECRET_KEY` is a strong, randomly generated 256-bit key.
- [ ] Firebase Security Rules are locked down for production.

## 3. Third-Party Integrations
- [ ] **Paystack**: Live keys are active, and the live webhook URL is configured.
- [ ] **WhatsApp / Meta**: The app is verified, and the live webhook URL is registered with the correct Verify Token.
- [ ] **OpenRouter / Gemini**: Billing is active, and usage limits/alerts are configured on the provider side.
- [ ] **Email (SMTP)**: Transactional email provider (SendGrid/Mailgun) is out of sandbox mode and authenticated via DKIM/SPF.

## 4. Monitoring & Logs
- [ ] Application logs are accessible (via Render Logs or a third-party like Datadog/Papertrail).
- [ ] Health Check endpoints are active.
- [ ] Unhandled exception reporting (e.g., Sentry) is configured (Recommended).

## 5. Final Tests
- [ ] Perform a full account creation flow in production.
- [ ] Perform a live payment with a real credit card (then refund it).
- [ ] Trigger a WhatsApp webhook manually and verify the response.
- [ ] Wait for a background Celery task to execute successfully.
