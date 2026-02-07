"""
Email Service using Resend API

Handles sending transactional emails for authentication and notifications.
"""

import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

# Configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "noreply@getspotfunnel.com")
REPLY_TO_EMAIL = os.getenv("RESEND_REPLY_TO", "inquiry@getspotfunnel.com")

async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    from_email: Optional[str] = None,
    reply_to: Optional[str] = None
) -> bool:
    """
    Send email via Resend API.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML email body
        from_email: Sender email (defaults to FROM_EMAIL)
        reply_to: Reply-to email (defaults to REPLY_TO_EMAIL)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not RESEND_API_KEY:
        logger.error("RESEND_API_KEY not configured")
        return False
    
    from_email = from_email or FROM_EMAIL
    reply_to = reply_to or REPLY_TO_EMAIL
    
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_content,
        "reply_to": reply_to
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            
            if response.status_code == 200:
                logger.info(f"Email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"Failed to send email to {to_email}: {response.status_code} - {response.text}")
                return False
                
    except httpx.TimeoutException:
        logger.error(f"Timeout sending email to {to_email}")
        return False
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {e}")
        return False
