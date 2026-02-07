# 🚨 DEPLOYMENT REMINDER - NGROK WEBHOOK

**Date Created:** 2026-02-07  
**Status:** ⚠️ CRITICAL - ACTION REQUIRED BEFORE PRODUCTION

---

## Current Setup (Development)

We are currently using **ngrok** for local development:

- **Ngrok URL:** `https://antrorse-fluently-beulah.ngrok-free.dev`
- **Webhook URL:** `https://antrorse-fluently-beulah.ngrok-free.dev/api/telnyx/webhook`
- **Environment:** `.env` → `NGROK_URL=https://antrorse-fluently-beulah.ngrok-free.dev`

---

## ⚠️ BEFORE PRODUCTION DEPLOYMENT

### 1. Update Telnyx Webhook URL

**Current (Development):**
```
https://antrorse-fluently-beulah.ngrok-free.dev/api/telnyx/webhook
```

**Production (MUST CHANGE TO):**
```
https://yourdomain.com/api/telnyx/webhook
```

**Where to Update:**
1. **Telnyx Portal:**
   - Go to https://portal.telnyx.com
   - Navigate to "Call Control" → "Applications"
   - Find your application
   - Update "Webhook URL" field
   - Save changes

2. **Environment File:**
   - File: `.env.production`
   - Change: `NGROK_URL=https://yourdomain.com` (replace with your actual domain)

---

### 2. Why This Is Critical

❌ **If you deploy with ngrok webhook:**
- Incoming calls will fail
- Telnyx will try to reach ngrok URL (which won't exist in production)
- No calls will be answered
- 100% failure rate

✅ **With production domain webhook:**
- Incoming calls route correctly
- Telnyx reaches your production server
- Calls work as expected

---

### 3. Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] **DNS configured** - Your domain points to production server
- [ ] **SSL certificate** - HTTPS enabled (Telnyx requires HTTPS)
- [ ] **Telnyx webhook updated** - Points to `https://yourdomain.com/api/telnyx/webhook`
- [ ] **Environment file updated** - `NGROK_URL` replaced with production domain
- [ ] **Test webhook** - Use Telnyx portal to test webhook connectivity
- [ ] **Test call** - Make a test call to verify end-to-end flow

---

### 4. How to Test Webhook Before Going Live

1. **Deploy to production server**
2. **Update Telnyx webhook URL** to production domain
3. **Use Telnyx webhook tester:**
   - In Telnyx portal, go to your Call Control Application
   - Use "Test Webhook" feature
   - Verify it returns 200 OK
4. **Make a test call** to your Telnyx number
5. **Monitor logs** to verify call flow

---

### 5. Rollback Plan

If production deployment fails:

1. **Revert Telnyx webhook** back to ngrok URL (if still running locally)
2. **Check logs** for errors
3. **Verify DNS and SSL** are configured correctly
4. **Test webhook connectivity** using curl:
   ```bash
   curl -X POST https://yourdomain.com/api/telnyx/webhook \
     -H "Content-Type: application/json" \
     -d '{"data":{"event_type":"call.initiated"}}'
   ```

---

## Quick Reference

| Environment | Webhook URL |
|-------------|-------------|
| **Development (Current)** | `https://antrorse-fluently-beulah.ngrok-free.dev/api/telnyx/webhook` |
| **Production (Required)** | `https://yourdomain.com/api/telnyx/webhook` |

---

## Related Files

- `TELNYX_MIGRATION_COMPLETE.md` - Full migration documentation
- `.env` - Current development environment (uses ngrok)
- `.env.production.example` - Production template (update NGROK_URL)
- `voice-core/src/api/telnyx_webhook.py` - Webhook handler code

---

**DO NOT FORGET TO UPDATE THE WEBHOOK URL BEFORE PRODUCTION DEPLOYMENT!** 🚨
