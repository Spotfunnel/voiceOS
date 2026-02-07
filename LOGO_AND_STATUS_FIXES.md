# Logo Replacement and Status Update Fixes

## Summary of Changes

This document outlines all changes made to replace the "SF" text placeholder with the actual SpotFunnel logo and fix user status update issues in the admin panel.

---

## 1. Logo Replacement - Auth Pages

### Files Updated:
- `apps/web/src/app/auth/login/page.tsx`
- `apps/web/src/app/auth/forgot-password/page.tsx`
- `apps/web/src/app/auth/reset-password/page.tsx`
- `apps/web/src/app/auth/accept-invitation/page.tsx`

### Changes:
- **Added import**: `import { SpotFunnelLogo } from "@/customer_dashboard/SpotFunnelLogo";`
- **Replaced**: Blue gradient box with "SF" text
- **With**: `<SpotFunnelLogo size={48} color="#000000" />`

### Result:
All authentication pages now display the actual SpotFunnel logo (black, 48x48px) instead of the "SF" text placeholder.

---

## 2. Logo Replacement - Email Templates

### File Updated:
- `voice-core/src/api/auth.py`

### Functions Modified:
1. **`send_invitation_email`** (lines ~200-210)
2. **`send_password_reset_email`** (lines ~290-300)

### Changes:
Added SpotFunnel logo SVG to email headers:

```html
<div style="width: 60px; height: 60px; background: white; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
    <svg viewBox="0 0 100 100" width="40" height="40" fill="#000000" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="24" r="17" />
        <path d="M 12 42 L 27 42 L 48 92 L 33 92 Z" />
        <path d="M 88 42 L 73 42 L 52 92 L 67 92 Z" />
    </svg>
</div>
```

### Result:
All invitation and password reset emails now display the actual SpotFunnel logo (black, on white background) in the teal gradient header.

---

## 3. Admin Panel - Status Update Fixes

### File Updated:
- `voice-core/src/api/admin_agents.py`

### Changes:
1. **Improved database query** (lines 60-90):
   - Changed from `LEFT JOIN agent_user_status` to querying directly `FROM agent_user_status`
   - This ensures the view's computed `user_status` field is always returned correctly
   - Added explicit JOIN with tenants table for additional fields

2. **Added debug logging**:
   - Logs total number of agents fetched
   - Logs each agent's `user_status`, `user_id`, and `user_email` for debugging

### Result:
The backend now correctly returns user status from the `agent_user_status` view, which should properly reflect:
- `'not_invited'` - No user or invitation exists
- `'invited'` - Pending invitation (not expired)
- `'invitation_expired'` - Invitation expired
- `'active'` - User account created and active
- `'inactive'` - User account exists but inactive

---

## 4. Frontend - Status Display and Refresh

### File Updated:
- `apps/web/src/admin_control_panel/operations/OverviewPage.tsx`

### Changes:

1. **Improved `handleResendInvitation`** (lines 104-122):
   - Added better error handling with detailed error messages
   - Added `await fetchAgents()` to refresh the list after successful resend
   - Added success alert message

2. **Enhanced logging** (lines 69-75):
   - Added detailed console logging for each agent's status
   - Helps debug status display issues

### Result:
- After sending/resending an invitation, the UI automatically refreshes
- Better error messages shown to users
- Console logs help diagnose any status mismatch issues

---

## Expected Behavior After Fixes

### Logo Display:
✅ **Auth Pages**: All login, forgot password, reset password, and accept invitation pages show the black SpotFunnel logo
✅ **Emails**: Invitation and password reset emails display the logo in the header

### User Status Flow:
1. **Initial State**: Agent shows "Not Invited" status with "Invite" button
2. **After Invitation Sent**: 
   - Status changes to "Pending" (badge shows "Pending")
   - Button changes to "Resend" with refresh icon
3. **After User Accepts**: 
   - Status changes to "Active" (badge shows "Active")
   - No action button shown (displays "—")

### Status Values Mapping:
| Database Value | Badge Display | Action Button |
|----------------|---------------|---------------|
| `not_invited` | Not Invited (gray) | Invite |
| `invited` | Pending (yellow) | Resend |
| `invitation_expired` | Expired (red) | Resend |
| `active` | Active (green) | — (none) |
| `inactive` | Inactive (gray) | — (none) |

---

## Troubleshooting

### If "User already exists for this tenant" error appears:
**Cause**: A user has already accepted the invitation and created an account.

**Solution**: 
1. Check the browser console logs to see what `userStatus` is being returned
2. Check the FastAPI logs to see what the database query returns
3. The status should be `'active'` and no button should be shown
4. If status is wrong, check the `agent_user_status` view in the database

### If status doesn't update after invitation:
**Cause**: Frontend might not be refreshing or backend query might not be returning updated data.

**Solution**:
1. Check browser console for the debug logs showing each agent's status
2. Check FastAPI logs for the query results
3. Manually refresh the page to see if status updates
4. Check the database directly: `SELECT * FROM agent_user_status WHERE tenant_id = '<tenant_id>';`

---

## Testing Checklist

- [ ] Login page shows SpotFunnel logo (not "SF")
- [ ] Forgot password page shows SpotFunnel logo
- [ ] Reset password page shows SpotFunnel logo
- [ ] Accept invitation page shows SpotFunnel logo
- [ ] Invitation email shows SpotFunnel logo in header
- [ ] Password reset email shows SpotFunnel logo in header
- [ ] Admin panel shows correct status for agents without users ("Not Invited")
- [ ] After sending invitation, status updates to "Pending"
- [ ] "Resend" button appears for pending invitations
- [ ] After accepting invitation, status updates to "Active"
- [ ] No action button shown for active users
- [ ] Resend button successfully sends new invitation

---

## Files Modified

### Frontend (Next.js):
1. `apps/web/src/app/auth/login/page.tsx`
2. `apps/web/src/app/auth/forgot-password/page.tsx`
3. `apps/web/src/app/auth/reset-password/page.tsx`
4. `apps/web/src/app/auth/accept-invitation/page.tsx`
5. `apps/web/src/admin_control_panel/operations/OverviewPage.tsx`

### Backend (FastAPI):
1. `voice-core/src/api/auth.py` (email templates)
2. `voice-core/src/api/admin_agents.py` (query and logging)

---

## Next Steps

1. **Restart Services**:
   ```bash
   # Restart FastAPI
   # Kill existing process on port 8000
   # Start: python voice-core/src/bot_runner.py
   
   # Restart Next.js
   # Kill existing process on port 3001
   # Start: npm run dev (in apps/web)
   ```

2. **Test the Changes**:
   - Navigate to admin panel
   - Check agent statuses
   - Send a test invitation
   - Verify status updates
   - Check email for logo
   - Accept invitation and verify status changes to "Active"

3. **Monitor Logs**:
   - Check FastAPI console for agent status logs
   - Check browser console for frontend status logs
   - Verify status values match expected behavior

---

**Date**: 2026-02-06
**Changes By**: AI Assistant
**Status**: ✅ Complete - Ready for Testing
