import os
import logging
import httpx
from email.message import EmailMessage
from aiosmtplib import send
from dotenv import load_dotenv

# Use development env by default if not set
env_file = ".env.dev" if os.getenv("ENV") == "dev" else ".env"
load_dotenv(env_file)

logger = logging.getLogger(__name__)

class EmailService:
    # Global/Platform fallbacks
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    RESEND_API_KEY = os.getenv("RESEND_API_KEY")

    @classmethod
    async def send_email(cls, to: str, subject: str, html_content: str, business_id: str = None, bypass_active: bool = False):
        """Sends an HTML email using tenant-specific or platform credentials. Returns (success, error_message)."""
        
        # 1. Try to get tenant configuration
        config = None
        if business_id:
            from .db_service import get_email_config
            config = await get_email_config(business_id)
        
        # 2. Routing based on config
        if config:
            is_active = config.get("is_active") or bypass_active
            if is_active:
                provider = config.get("provider", "resend").lower()
                logger.info(f"[EmailService] Using tenant config for {business_id} | Provider: {provider}")
                
                if provider == "resend" and config.get("api_key"):
                    return await cls._send_with_resend(
                        to, subject, html_content, 
                        api_key=config["api_key"], 
                        from_email=config.get("from_email"), 
                        from_name=config.get("from_name")
                    )
                elif provider == "smtp" and config.get("smtp_user") and config.get("smtp_password"):
                    return await cls._send_with_smtp(
                        to, subject, html_content, 
                        host=config.get("smtp_host"), 
                        port=config.get("smtp_port"), 
                        user=config["smtp_user"], 
                        password=config["smtp_password"]
                    )
                else:
                    return False, "Tenant config is incomplete. Missing API keys or SMTP credentials."
            else:
                logger.info(f"[EmailService] Tenant config for {business_id} found but is NOT ACTIVE. Falling back to platform defaults.")
        
        # 3. Fallback to Platform settings (Global SMTP or Resend)
        if cls.RESEND_API_KEY:
            return await cls._send_with_resend(to, subject, html_content, api_key=cls.RESEND_API_KEY)
        
        return await cls._send_with_smtp(
            to, subject, html_content, 
            host=cls.SMTP_HOST, 
            port=cls.SMTP_PORT, 
            user=cls.SMTP_USER, 
            password=cls.SMTP_PASSWORD
        )

    @classmethod
    async def _send_with_resend(cls, to: str, subject: str, html_content: str, api_key: str, from_email: str = None, from_name: str = None):
        """Sends email via Resend API. Returns (success, message)."""
        url = "https://api.resend.com/emails"
        default_from = os.getenv("DEFAULT_FROM_EMAIL", "notifications@interacai.com")
        # Ensure we use the verified platform domain if no from_email is provided or if it's not a verified address
        # Resend requires the 'from' email to be from a verified domain.
        sender = f"{from_name} <{default_from}>" if from_name else default_from
        
        # If the business provided their own email, we use it ONLY if they have their own Resend API key
        if from_email and from_email.strip() and api_key != os.getenv("RESEND_API_KEY"):
            sender = f"{from_name} <{from_email}>" if from_name else from_email

        payload = {"from": sender, "to": to, "subject": subject, "html": html_content}
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
 
        logger.info(f"[EmailService] Attempting Resend send to {to} from {sender}")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers, timeout=10.0)
                if response.status_code in [200, 201]:
                    logger.info(f"[EmailService] Resend Success: {response.text}")
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
    async def _send_with_smtp(cls, to: str, subject: str, html_content: str, host: str, port: int, user: str, password: str):
        """Sends email via SMTP. Returns (success, message)."""
        if not user or not password:
            return False, "SMTP Credentials Missing"

        message = EmailMessage()
        message["From"] = user
        message["To"] = to
        message["Subject"] = subject
        message.set_content(html_content, subtype="html")

        smtp_host = host or cls.SMTP_HOST
        smtp_port = int(port or cls.SMTP_PORT)
        use_tls = True if smtp_port == 465 else False
        start_tls = True if smtp_port == 587 else False

        try:
            await send(
                message,
                hostname=smtp_host,
                port=smtp_port,
                username=user,
                password=password,
                use_tls=use_tls,
                start_tls=start_tls,
                timeout=15.0
            )
            return True, "Email sent successfully"
        except ConnectionRefusedError:
            return False, f"Connection Refused: Render might be blocking Port {smtp_port}."
        except TimeoutError:
            return False, f"Connection Timed Out: Port {smtp_port} is likely blocked."
        except Exception as e:
            msg = f"{type(e).__name__}: {str(e)}"
            if "authentication" in str(e).lower():
                msg += " (Google might be blocking the login from this data center. Confirm your App Password.)"
            return False, msg

    @classmethod
    async def send_reset_email(cls, to: str, reset_link: str):
        """Sends a stylized password reset email using platform defaults."""
        subject = "Reset Your InterractAI Password"
        html_content = f"..." # Content omitted for brevity
        success, msg = await cls.send_email(to, subject, html_content)
        return success

email_service = EmailService()
