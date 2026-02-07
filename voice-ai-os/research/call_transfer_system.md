# Call Transfer System with Fallback

## Overview

The call transfer system allows AI agents to escalate calls to human contacts when they can't resolve an issue. The AI reassures the caller upfront that they can leave a voicemail if needed, then transfers the call. The call stays with the transfer target (or their voicemail system) and never routes back to the AI.

## Configuration

### Step 1: Configure Transfer Contact (Onboarding Step 5)

During agent setup in the onboarding wizard, configure the transfer contact:

- **Contact Name**: e.g., "John Smith"
- **Title/Role**: e.g., "Service Manager"
- **Phone Number**: e.g., "+1 555 010 4444"

These fields are stored in the `tenant_onboarding_settings` table under the `telephony` JSONB field:

```json
{
  "phone_number": "+1 555 010 2233",
  "twilio_account_sid": "ACxxxx",
  "twilio_auth_token": "xxx",
  "transfer_contact_name": "John Smith",
  "transfer_contact_title": "Service Manager",
  "transfer_contact_phone": "+1 555 010 4444"
}
```

### Step 2: Add Transfer Node to Objective Graph

In your agent's objective graph configuration, add a `transfer` terminal node:

```json
{
  "id": "transfer_to_human",
  "type": "transfer",
  "transfer_message": "Let me connect you to our service manager who can help with that.",
  "on_failure": null,
  "on_success": null
}
```

The agent can transition to this node when it determines escalation is needed.

## Transfer Flow

### Successful Transfer

1. Agent reaches `transfer` node
2. System generates TwiML with `<Dial>` verb
3. Caller hears: "Please hold while I connect you to {contact_name}."
4. Call bridges to transfer contact
5. Conversation continues with human

### Failed Transfer (No Answer / Busy / Failed)

1. Agent reaches `transfer` node
2. System generates TwiML with `<Dial>` verb
3. Caller hears: "Please hold while I connect you to {contact_name}."
4. Transfer contact doesn't answer (timeout: 20 seconds)
5. Twilio callback hits `/api/call-transfer/callback/{call_sid}`
6. System detects `DialCallStatus != "completed"`
7. AI agent provides reassurance message
8. Caller hears: "It looks like {contact_name}'s line is busy right now. Don't worry - if you leave a voicemail at {phone_number}, they'll get your message and call you back as soon as possible. Thank you for calling, and have a great day!"
9. Call ends - caller can then call the number directly to leave voicemail

## API Endpoints

### POST `/api/call-transfer/initiate/{call_sid}`

Initiates a transfer for a specific call.

**Query Parameters:**
- `tenant_id` (required): Tenant/agent ID

**Response:** TwiML with reassurance message and `<Dial>` verb

**Example:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Nicole">Let me connect you to John Smith. If the line is busy, don't worry - you can leave a voicemail and they'll make sure to get your message and call you back.</Say>
    <Dial timeout="30" callerId="+15550102233">
        <Number>+15550104444</Number>
    </Dial>
    <Say voice="Polly.Nicole">I'm sorry, I wasn't able to connect that call. Please try calling back later. Thank you.</Say>
    <Hangup/>
</Response>
```

**Note:** No action callback is used. The call stays with the transfer target (or their voicemail). The fallback `<Say>` only plays if the dial completely fails (invalid number, network error).

## Database Schema

### tenant_onboarding_settings.telephony (JSONB)

```sql
{
  "phone_number": "string",
  "twilio_account_sid": "string",
  "twilio_auth_token": "string",
  "twilio_phone_number": "string",
  "voice_webhook_url": "string",
  "status_callback_url": "string",
  "transfer_contact_name": "string",
  "transfer_contact_title": "string",
  "transfer_contact_phone": "string"
}
```

No additional tables needed - voicemails are left directly at the transfer contact's number using their existing voicemail system.

## Objective Graph Node Types

### transfer (New)

A terminal node type that triggers call transfer.

**Fields:**
- `type`: "transfer"
- `transfer_message`: Message to say before transferring (optional)

**Example:**
```json
{
  "id": "escalate",
  "type": "transfer",
  "transfer_message": "I understand this needs urgent attention. Let me connect you to our manager."
}
```

## Admin UI

Transfer contact can be configured in two places:

1. **Onboarding Wizard (Step 5: Telephony)**
   - Appears as a section "Transfer contact (for escalations)"
   - Three input fields: Contact name, Title/Role, Phone number

2. **Operations Page → Configure → Telephony Setup Tab**
   - Editable fields for transfer contact
   - Shows behavior explanation: "If AI can't help, it will connect to [name]. AI reassures caller upfront that they can leave a voicemail if the line is busy."
   - Save button persists changes to database

## Testing the System

### Test Successful Transfer

1. Configure transfer contact with a real phone number you control
2. Start a call with the agent
3. Trigger escalation (e.g., ask for something beyond agent's scope)
4. Agent should say transfer message and dial your phone
5. Answer the call - you should be connected to the original caller

### Test Transfer to Voicemail

1. Configure transfer contact with a phone number that won't answer (or set your phone to DND)
2. Start a call with the agent
3. Trigger escalation
4. Agent should say: "Let me connect you to [name]. If the line is busy, don't worry - you can leave a voicemail and they'll make sure to get your message..."
5. Wait 30 seconds (dial timeout)
6. Call should go to the transfer contact's voicemail
7. Leave a test voicemail
8. Verify voicemail appears in the transfer contact's normal voicemail system

## Future Enhancements

- [ ] Support multiple transfer contacts (escalation chain)
- [ ] Time-based routing (different contacts for different hours)
- [ ] Try transfer again with a secondary number if primary fails
- [ ] SMS notification to transfer contact when transfer is attempted
- [ ] Dashboard widget showing transfer attempt history
