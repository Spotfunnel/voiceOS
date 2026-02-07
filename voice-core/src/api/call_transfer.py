"""
Call transfer API for Twilio with fallback resumption.

Flow:
1. Agent determines escalation needed (reaches "transfer" node in objective graph)
2. POST /initiate/{call_sid} generates TwiML with <Dial> verb
3. AI says: "Let me connect you to [name]. If the line is busy, don't worry - you can 
   leave a voicemail and they'll make sure to get your message and call you back."
4. Twilio attempts to dial the transfer contact
5. If answered: Call bridges to human, conversation continues (AI is out of the picture)
6. If no answer/busy: Call goes to transfer contact's voicemail system
7. Caller leaves voicemail directly in the contact's voicemail
8. If dial completely fails (invalid number, network error): Fallback message plays and call ends

Configuration:
- Transfer contact stored in tenant_onboarding_settings.telephony JSONB
- Fields: transfer_contact_name, transfer_contact_title, transfer_contact_phone
- Configurable in Onboarding Step 5 and Operations > Configure > Telephony tab

Benefits:
- AI reassures caller upfront, so they feel confident leaving a voicemail
- Call never routes back to AI - stays with transfer target or their voicemail
- Natural flow - exactly like calling a business and getting transferred
- No complex callback logic needed
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Form
from fastapi.responses import Response
import psycopg2.extras

from ..database.db_service import get_db_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/call-transfer", tags=["call-transfer"])


@router.post("/initiate/{call_sid}")
async def initiate_transfer(call_sid: str, tenant_id: str):
    """
    Initiate call transfer for a specific call.
    Returns TwiML to dial the transfer contact.
    """
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Get transfer contact from tenant settings
        cur.execute(
            """
            SELECT telephony
            FROM tenant_onboarding_settings
            WHERE tenant_id = %s::uuid
            """,
            (tenant_id,)
        )
        row = cur.fetchone()
        
        if not row or not row.get('telephony'):
            raise HTTPException(status_code=404, detail="Transfer contact not configured")
        
        telephony = row['telephony']
        transfer_phone = telephony.get('transfer_contact_phone')
        transfer_name = telephony.get('transfer_contact_name', 'a team member')
        
        if not transfer_phone:
            raise HTTPException(status_code=400, detail="No transfer number configured")
        
        # Generate TwiML with Dial verb
        # No action callback - call stays with transfer target (or their voicemail)
        
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Nicole">Let me connect you to {transfer_name}. If the line is busy, don't worry - you can leave a voicemail and they'll make sure to get your message and call you back.</Say>
    <Dial timeout="30" callerId="+15550102233">
        <Number>{transfer_phone}</Number>
    </Dial>
    <Say voice="Polly.Nicole">I'm sorry, I wasn't able to connect that call. Please try calling back later. Thank you.</Say>
    <Hangup/>
</Response>"""
        
        logger.info(f"Initiating transfer for call {call_sid} to {transfer_phone}")
        return Response(content=twiml, media_type="application/xml")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transfer initiation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)




