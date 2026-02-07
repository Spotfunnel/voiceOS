"""
Telnyx fallback service for emergency error handling.
When pipeline fails, use Telnyx Call Control API to play a message and transfer.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional, Dict, Any

import aiohttp
import psycopg2.extras

from ..database.db_service import get_db_service

logger = logging.getLogger(__name__)


class TelnyxFallbackService:
    """Use Telnyx Call Control API directly for emergency fallback."""

    def __init__(self) -> None:
        self.api_key = os.getenv("TELNYX_API_KEY")

        if not self.api_key:
            logger.warning("Telnyx API key not configured for fallback service")

    async def get_transfer_contact(self, tenant_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        Get transfer contact from tenant settings.
        
        Args:
            tenant_id: Tenant ID to look up
            
        Returns:
            Dict with phone and name, or None if not found
        """
        if not tenant_id:
            return None
        return await asyncio.to_thread(self._get_transfer_contact, tenant_id)

    def _get_transfer_contact(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        db_service = get_db_service()
        conn = db_service.get_connection()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                """
                SELECT telephony
                FROM tenant_onboarding_settings
                WHERE tenant_id = %s::uuid
                """,
                (tenant_id,),
            )
            row = cur.fetchone()
            if not row or not row.get("telephony"):
                return None

            telephony = row["telephony"] or {}
            transfer_phone = telephony.get("transfer_contact_phone")
            if not transfer_phone:
                return None

            return {
                "phone": transfer_phone,
                "name": telephony.get("transfer_contact_name", "a team member"),
            }
        except Exception as exc:
            logger.exception("Failed to load transfer contact: %s", exc)
            return None
        finally:
            cur.close()
            db_service.put_connection(conn)

    async def play_message_and_transfer(
        self,
        *,
        call_control_id: str,
        message: str,
        transfer_phone: Optional[str] = None,
        transfer_name: str = "support",
    ) -> bool:
        """
        Play a message and optionally transfer the call using Telnyx Call Control API.
        
        Args:
            call_control_id: Telnyx call control ID
            message: Message to speak to caller
            transfer_phone: Phone number to transfer to (optional)
            transfer_name: Name of transfer destination (for logging)
            
        Returns:
            True if successful, False otherwise
        """
        if not self.api_key:
            logger.error("Telnyx API key not configured, cannot play fallback")
            return False

        try:
            # First, speak the message
            speak_url = f"https://api.telnyx.com/v2/calls/{call_control_id}/actions/speak"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            speak_payload = {
                "payload": message,
                "voice": "female",  # Telnyx default voice
                "language": "en-US"
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(speak_url, headers=headers, json=speak_payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(
                            f"Failed to speak message for call {call_control_id}: "
                            f"Status {response.status}, Response: {error_text}"
                        )
                        return False

                # Wait a moment for the message to start playing
                await asyncio.sleep(0.5)

                # Then transfer or hangup
                if transfer_phone:
                    transfer_url = f"https://api.telnyx.com/v2/calls/{call_control_id}/actions/transfer"
                    transfer_payload = {
                        "to": transfer_phone
                    }

                    async with session.post(transfer_url, headers=headers, json=transfer_payload) as response:
                        if response.status == 200:
                            logger.info(
                                f"Played fallback message and transferred to {transfer_phone} for call {call_control_id}"
                            )
                            return True
                        else:
                            error_text = await response.text()
                            logger.error(
                                f"Failed to transfer call {call_control_id}: "
                                f"Status {response.status}, Response: {error_text}"
                            )
                            return False
                else:
                    # Hangup the call
                    hangup_url = f"https://api.telnyx.com/v2/calls/{call_control_id}/actions/hangup"

                    async with session.post(hangup_url, headers=headers) as response:
                        if response.status == 200:
                            logger.info(
                                f"Played fallback message and hung up call {call_control_id}"
                            )
                            return True
                        elif response.status == 422:
                            # Call already ended
                            error_data = await response.json()
                            if any(error.get("code") == "90018" for error in error_data.get("errors", [])):
                                logger.debug(f"Telnyx call {call_control_id} was already terminated")
                                return True
                            
                            error_text = await response.text()
                            logger.error(
                                f"Failed to hangup call {call_control_id}: "
                                f"Status {response.status}, Response: {error_text}"
                            )
                            return False
                        else:
                            error_text = await response.text()
                            logger.error(
                                f"Failed to hangup call {call_control_id}: "
                                f"Status {response.status}, Response: {error_text}"
                            )
                            return False

        except Exception as exc:
            logger.exception(f"Failed to play fallback message: {exc}")
            return False
