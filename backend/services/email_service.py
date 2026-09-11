import os
import logging
import httpx
from dotenv import load_dotenv

# Use development env by default if not set
env_file = ".env.dev" if os.getenv("ENV") == "dev" else ".env"
load_dotenv(env_file)

logger = logging.getLogger(__name__)

class EmailService:
    # Platform HTTP API Email settings (Resend)
    RESEND_API_KEY = os.getenv("RESEND_API_KEY")
    DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "notifications@interacai.com")

    @classmethod
    async def send_email(cls, to: str, subject: str, html_content: str, business_id: str = None, bypass_active: bool = False):
        """
        Sends an HTML email using tenant-specific or platform credentials via Resend HTTP API.
        Returns (success, error_message).
        """
        # Override: Redirect interacai.int@gmail.com notifications to the verified contact@interacai.com
        if to == "interacai.int@gmail.com":
            to = "contact@interacai.com"
            
        # 1. Try to get tenant configuration
        config = None
        if business_id:
            from .db_service import get_email_config
            config = await get_email_config(business_id)
        
        # 2. Routing based on tenant config
        if config:
            is_active = config.get("is_active") or bypass_active
            if is_active:
                api_key = config.get("api_key")
                if api_key:
                    logger.info(f"[EmailService] Using tenant Resend config for business {business_id}")
                    return await cls._send_with_resend(
                        to, subject, html_content, 
                        api_key=api_key, 
                        from_email=config.get("from_email"), 
                        from_name=config.get("from_name")
                    )
                else:
                    logger.warning(f"[EmailService] Tenant config for {business_id} missing api_key. Falling back to platform default.")
            else:
                logger.info(f"[EmailService] Tenant config for {business_id} found but is NOT ACTIVE. Falling back to platform defaults.")
        
        # 3. Platform Resend sending
        platform_key = cls.RESEND_API_KEY or os.getenv("RESEND_API_KEY")
        if platform_key:
            return await cls._send_with_resend(to, subject, html_content, api_key=platform_key)
        
        # 4. Safe Local / Development Fallback when no Resend Key configured
        logger.warning(f"[EmailService] RESEND_API_KEY not set. Simulated email to: {to} | Subject: '{subject}'")
        return True, "Simulated email delivery (RESEND_API_KEY not configured)"

    @classmethod
    async def _send_with_resend(cls, to: str, subject: str, html_content: str, api_key: str, from_email: str = None, from_name: str = None):
        """Sends email via Resend HTTP API (port 443). Returns (success, message)."""
        url = "https://api.resend.com/emails"
        default_from = cls.DEFAULT_FROM_EMAIL or os.getenv("DEFAULT_FROM_EMAIL", "notifications@interacai.com")
        
        sender = f"{from_name} <{default_from}>" if from_name else default_from
        
        # If business provided their own email, use it if they have their own Resend API key
        if from_email and from_email.strip() and api_key != (cls.RESEND_API_KEY or os.getenv("RESEND_API_KEY")):
            sender = f"{from_name} <{from_email}>" if from_name else from_email

        payload = {"from": sender, "to": to, "subject": subject, "html": html_content}
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        logger.info(f"[EmailService] Attempting Resend API send to {to} from {sender}")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers, timeout=10.0)
                if response.status_code in [200, 201]:
                    logger.info(f"[EmailService] Resend Success for {to}: {response.text}")
                    return True, "Email sent successfully"
                else:
                    err_msg = f"Resend Error ({response.status_code}): {response.text}"
                    logger.error(f"[EmailService] {err_msg}")
                    return False, err_msg
        except Exception as e:
            err_msg = f"Resend Connection Error: {str(e)}"
            logger.error(f"[EmailService] {err_msg}")
            return False, err_msg

    @classmethod
    async def send_reset_email(cls, to: str, reset_link: str):
        """Sends a password reset email using platform defaults."""
        subject = "Reset Your InteracAI Password"
        html_content = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #001F3F;">Password Reset Request</h2>
            <p>We received a request to reset the password for your InteracAI account.</p>
            <p style="margin: 24px 0;">
                <a href="{reset_link}" style="background-color: #001F3F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Reset Password
                </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">InteracAI Platform &bull; https://interacai.com</p>
        </div>
        """
        success, msg = await cls.send_email(to, subject, html_content)
        return success

email_service = EmailService()

