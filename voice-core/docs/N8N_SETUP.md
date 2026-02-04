# n8n Integration Setup Guide

## Overview

Connect Voice Core to n8n workflows for automation:
- ✅ Send confirmation emails
- ✅ Create calendar events
- ✅ Update CRM (HubSpot, Salesforce, etc.)
- ✅ Send SMS notifications
- ✅ Custom integrations (250+ n8n nodes)

---

## Step 1: Install n8n

### Option A: Docker (Recommended)

```bash
docker run -d --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=your_password \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### Option B: npm

```bash
npm install -g n8n
n8n start
```

Access n8n at: `http://localhost:5678`

---

## Step 2: Create Confirmation Email Workflow

1. Create new workflow in n8n
2. Add Webhook node:
   - Path: `voice-core-confirmation`
   - HTTP Method: `POST`
   - Response Mode: `On Received`
3. Add Set node to extract captured data.
4. Add Gmail node (send operation) using extracted fields.
5. Activate workflow and copy webhook URL.

---

## Step 3: Configure in Voice Core

### During Onboarding

1. In Step 3: Customization, scroll to Automation Workflows (n8n).
2. Paste webhook URL.
3. Continue through the wizard.

### After Onboarding

```bash
curl -X PUT http://localhost:8000/api/tenants/{tenant_id}/config \
  -H "Content-Type: application/json" \
  -d '{
    "n8n_workflows": [
      {
        "name": "appointment_automation",
        "webhook_url": "https://your-n8n.com/webhook/voice-core-confirmation",
        "description": "Sends confirmation email"
      }
    ]
  }'
```

---

## Step 4: Test the Integration

### API Test

```bash
curl -X POST https://your-n8n.com/webhook/voice-core-confirmation \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant",
    "data": {
      "capture_name_au": "John Smith",
      "capture_email_au": "john@example.com",
      "capture_phone_au": "+61412345678",
      "capture_service_au": "Plumbing",
      "capture_datetime_au": "2024-02-05T14:00:00+11:00",
      "capture_address_au": "123 Main St, Sydney NSW 2000"
    }
  }'
```

### Voice Call Test

1. Make a test call.
2. Complete capture flow.
3. Verify email/calendar updates in n8n.

---

## Common Workflows

1. Send SMS reminder via Twilio node.
2. Update Salesforce contact + opportunity.
3. Append row in Google Sheets.
4. Notify Slack channel.

---

## Troubleshooting

- Webhook not triggered: ensure n8n running, webhook URL correct, test with curl.
- Email not sending: verify Gmail/SMTP credentials.
- Calendar event: confirm OAuth and ISO datetime.

---

## Security

1. Use HTTPS for webhook endpoints.
2. Add auth token query param and store in config.
3. Firewall rules to restrict access.
4. Monitor execution logs.
5. Store secrets securely.

---

## Next Steps

- [ ] Set up confirmation email workflow
- [ ] Set up calendar and CRM workflows
- [ ] Test end-to-end
- [ ] Monitor n8n logs
