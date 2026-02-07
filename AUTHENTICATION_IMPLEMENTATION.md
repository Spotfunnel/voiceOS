# Authentication System Implementation

## Overview
Complete authentication system for SpotFunnel with user invitations, password reset, and customer dashboard access.

## Status: ✅ 80% Complete

### ✅ Completed Components

#### 1. Database Schema (`voice-ai-os/infrastructure/database/migrations/002_add_user_authentication.sql`)
- **Tables Created**:
  - `users`: Customer accounts (1:1 with tenants)
  - `invitations`: Invitation tracking
  - `password_reset_tokens`: Password reset management
  - `auth_audit_log`: Authentication event logging
- **Views Created**:
  - `agent_user_status`: Combined view for Operations tab
- **Functions Created**:
  - `validate_invitation_token()`: Token validation
  - `validate_reset_token()`: Reset token validation
  - `cleanup_expired_tokens()`: Maintenance function

#### 2. Backend API (`voice-core/src/api/auth.py`)
- **Authentication Endpoints**:
  - `POST /api/auth/login`: Customer login
  - `POST /api/auth/accept-invitation`: Accept invitation & set password
  - `POST /api/auth/forgot-password`: Request password reset
  - `POST /api/auth/reset-password`: Reset password with token
  - `GET /api/auth/validate-token`: Validate tokens
- **Admin Endpoints**:
  - `POST /api/admin/invite-user`: Send invitation
  - `POST /api/admin/resend-invitation/{tenant_id}`: Resend invitation
  - `GET /api/admin/user-status/{tenant_id}`: Get user status

#### 3. Email Service (`voice-core/src/api/email_service.py`)
- Resend API integration
- HTML email templates:
  - Invitation email (with custom message support)
  - Password reset email
- Configuration:
  - From: `noreply@getspotfunnel.com`
  - Reply-to: `inquiry@getspotfunnel.com`
  - Domain: `getspotfunnel.com` (verified)

#### 4. Admin Operations Tab UI (`apps/web/src/admin_control_panel/operations/`)
- **Enhanced OverviewPage.tsx**:
  - User Status column with badges:
    - 🔴 Not Invited
    - 🟡 Pending
    - 🟢 Active
    - ⏰ Expired
  - Invite User button
  - Resend Invitation button
  - Last login display
- **InviteUserModal.tsx**:
  - Email (required)
  - First/Last Name (optional)
  - Custom message (optional)
  - Real-time validation
  - Success/error feedback

#### 5. Customer Auth Pages (`apps/web/src/app/auth/`)
- **login/page.tsx**: Customer login with email/password
- **accept-invitation/page.tsx**: Set password from invitation
  - Token validation
  - Password strength requirements
  - Real-time validation feedback
- **forgot-password/page.tsx**: Request password reset
- **reset-password/page.tsx**: Reset password with token
  - Token validation
  - Password strength requirements

#### 6. Next.js API Routes
- **`/api/admin/invite-user/route.ts`**: Proxy to FastAPI

### 🚧 In Progress

#### 7. Additional Next.js API Routes (Needed)
- `/api/auth/login/route.ts`
- `/api/auth/accept-invitation/route.ts`
- `/api/auth/forgot-password/route.ts`
- `/api/auth/reset-password/route.ts`
- `/api/auth/validate-token/route.ts`

#### 8. Session Management Update
- Update `apps/web/src/server/session.ts` to include `user_id`
- Link sessions to authenticated users
- Add authentication middleware

#### 9. Dashboard Welcome Tour
- Create `WelcomeTour.tsx` component
- 3-page tour: Overview → Action Required → Call Logs
- Skip/Next navigation
- No tracking (stateless)

#### 10. Security Enhancements
- Rate limiting middleware
- CSRF protection
- Session token management
- Password policy enforcement

## Architecture

### Data Flow

```
Admin Panel (Operations Tab)
  ↓
  Clicks "Invite User"
  ↓
Next.js API Route (/api/admin/invite-user)
  ↓
FastAPI Backend (/api/admin/invite-user)
  ↓
1. Create invitation record in DB
2. Generate secure token
3. Send email via Resend
  ↓
Customer receives email
  ↓
Clicks invitation link
  ↓
Next.js Auth Page (/auth/accept-invitation?token=...)
  ↓
1. Validate token (GET /api/auth/validate-token)
2. Set password (POST /api/auth/accept-invitation)
3. Create user account
4. Redirect to login
  ↓
Customer Dashboard
```

### Security Features

1. **Password Security**:
   - bcrypt hashing (12 rounds)
   - Strength requirements:
     - Min 8 characters
     - 1 uppercase, 1 lowercase, 1 number

2. **Token Security**:
   - SHA-256 hashed in database
   - Plain token sent via email (one-time use)
   - Expiration:
     - Invitations: 7 days
     - Password reset: 1 hour
   - Single-use enforcement

3. **Audit Logging**:
   - All auth events logged
   - IP address tracking (for password resets)
   - Failed login attempts

## Configuration

### Environment Variables

**`voice-core/.env`**:
```env
# Resend API
RESEND_API_KEY=re_g6j8wGjD_Fh3tj9KP51FQSaqxRnmFSqRF
RESEND_FROM_EMAIL=noreply@getspotfunnel.com
RESEND_REPLY_TO=inquiry@getspotfunnel.com

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

**`apps/web/.env.local`**:
```env
# Voice Core Backend
VOICE_CORE_URL=http://localhost:8000

# Resend API (same as voice-core)
RESEND_API_KEY=re_g6j8wGjD_Fh3tj9KP51FQSaqxRnmFSqRF
```

### Dependencies

**Python (`voice-core/requirements.txt`)**:
```
bcrypt>=4.0.1
asyncpg>=0.29.0
httpx>=0.28.1
```

## Deployment Steps

### 1. Database Migration
```bash
cd voice-ai-os/infrastructure
psql -U spotfunnel -d spotfunnel -f database/migrations/002_add_user_authentication.sql
```

### 2. Install Python Dependencies
```bash
cd voice-core
pip install -r requirements.txt
```

### 3. Configure Environment Variables
- Set `RESEND_API_KEY` in both `voice-core/.env` and `apps/web/.env.local`
- Set `VOICE_CORE_URL` in `apps/web/.env.local`

### 4. Restart Services
```bash
# FastAPI backend
cd voice-core
python -m uvicorn src.bot_runner:app --reload --port 8000

# Next.js frontend
cd apps/web
npm run dev
```

### 5. Test Flow
1. Navigate to Admin Operations tab: `http://localhost:3001/admin/operations`
2. Click "Invite User" on any agent
3. Fill in email and send invitation
4. Check email inbox
5. Click invitation link
6. Set password
7. Login to customer dashboard

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Admin can send invitation
- [ ] Invitation email is received
- [ ] Token validation works
- [ ] Customer can set password
- [ ] User account is created
- [ ] Customer can login
- [ ] Password reset flow works
- [ ] Expired tokens are rejected
- [ ] Used tokens cannot be reused
- [ ] User status displays correctly in Operations tab
- [ ] Audit logs are created

## Next Steps

1. Complete remaining Next.js API routes
2. Update session management with user authentication
3. Create dashboard welcome tour component
4. Add rate limiting middleware
5. Integration testing
6. Production deployment

## Notes

- User accounts are 1:1 with tenants (agents)
- Only admin roles can invite users
- Invitations expire after 7 days
- Password reset tokens expire after 1 hour
- All auth events are logged for audit trail
- Domain `getspotfunnel.com` is verified in Resend
