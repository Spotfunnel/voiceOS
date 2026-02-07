"""
Authentication API Endpoints

Handles user authentication, invitations, and password management.

Endpoints:
- POST /api/auth/login: Customer login
- POST /api/auth/logout: Logout
- POST /api/auth/accept-invitation: Accept invitation and set password
- POST /api/auth/forgot-password: Request password reset
- POST /api/auth/reset-password: Reset password with token
- GET /api/auth/validate-token: Validate invitation/reset token
- POST /api/admin/invite-user: Send user invitation (admin only)
- POST /api/admin/resend-invitation: Resend invitation (admin only)
- GET /api/admin/user-status/{tenant_id}: Get user status for tenant (admin only)
"""

import os
import hashlib
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import bcrypt

from fastapi import APIRouter, HTTPException, Depends, Header, Response, Cookie, Request
from pydantic import BaseModel, EmailStr, Field, validator
import psycopg2.extras

from ..database.db_service import get_db_service
from ..middleware.auth import require_admin, require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])
admin_router = APIRouter(prefix="/api/admin", tags=["admin-auth"])

# =============================================================================
# CONFIGURATION
# =============================================================================

INVITATION_EXPIRY_DAYS = 7
PASSWORD_RESET_EXPIRY_HOURS = 1
BCRYPT_ROUNDS = 12
SESSION_EXPIRY_DAYS = 7

# Email service configuration (will be imported from email service)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "noreply@getspotfunnel.com")
REPLY_TO_EMAIL = os.getenv("RESEND_REPLY_TO", "inquiry@getspotfunnel.com")
APP_URL = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3001")

# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class LoginRequest(BaseModel):
    """Customer login request"""
    email: EmailStr
    password: str = Field(..., min_length=8)

class LoginResponse(BaseModel):
    """Login response with session info"""
    success: bool
    user_id: str
    tenant_id: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    session_token: str
    role: Optional[str] = None

class AcceptInvitationRequest(BaseModel):
    """Accept invitation and set password"""
    token: str = Field(..., min_length=32)
    password: str = Field(..., min_length=8)
    
    @validator('password')
    def validate_password(cls, v):
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        return v

class ForgotPasswordRequest(BaseModel):
    """Request password reset"""
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    """Reset password with token"""
    token: str = Field(..., min_length=32)
    password: str = Field(..., min_length=8)
    
    @validator('password')
    def validate_password(cls, v):
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        return v

class InviteUserRequest(BaseModel):
    """Admin invitation request"""
    tenant_id: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    custom_message: Optional[str] = None

class ValidateTokenResponse(BaseModel):
    """Token validation response"""
    valid: bool
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    error_message: Optional[str] = None

class UserStatusResponse(BaseModel):
    """User status for Operations tab"""
    tenant_id: str
    business_name: str
    user_status: str  # 'not_invited', 'invited', 'active', 'invitation_expired'
    user_email: Optional[str] = None
    user_id: Optional[str] = None
    last_login: Optional[datetime] = None
    invitation_sent_at: Optional[datetime] = None
    invitation_expires_at: Optional[datetime] = None

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def generate_token() -> tuple[str, str]:
    """
    Generate secure token and its hash.
    Returns: (plain_token, token_hash)
    """
    plain_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plain_token.encode()).hexdigest()
    return plain_token, token_hash

def generate_session_token() -> str:
    """Generate session token"""
    return secrets.token_urlsafe(32)


def hash_session_token(session_token: str) -> str:
    """Hash session token for storage."""
    return hashlib.sha256(session_token.encode()).hexdigest()

async def send_invitation_email(
    email: str,
    token: str,
    business_name: str,
    first_name: Optional[str] = None,
    custom_message: Optional[str] = None
) -> None:
    """Send invitation email via Resend"""
    # Import here to avoid circular dependency
    from .email_service import send_email
    
    invitation_url = f"{APP_URL}/auth/accept-invitation?token={token}"
    
    # Log invitation URL for development/testing
    logger.info(f"=== INVITATION LINK ===")
    logger.info(f"Email: {email}")
    logger.info(f"Name: {first_name}")
    logger.info(f"URL: {invitation_url}")
    logger.info(f"======================")
    print(f"\n{'='*60}\nINVITATION LINK FOR {email}:\n{invitation_url}\n{'='*60}\n")
    
    subject = f"You're invited to SpotFunnel - {business_name}"
    
    greeting = f"Hi {first_name}," if first_name else "Hi there,"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <tr>
                            <td style="background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%); padding: 40px; text-align: center;">
                                <div style="width: 60px; height: 60px; background: white; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                                    <svg viewBox="0 0 100 100" width="40" height="40" fill="#000000" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="50" cy="24" r="17" />
                                        <path d="M 12 42 L 27 42 L 48 92 L 33 92 Z" />
                                        <path d="M 88 42 L 73 42 L 52 92 L 67 92 Z" />
                                    </svg>
                                </div>
                                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Welcome to SpotFunnel</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="margin: 0 0 20px 0; color: #0f172a; font-size: 16px; line-height: 1.6;">
                                    {greeting}
                                </p>
                                <p style="margin: 0 0 20px 0; color: #0f172a; font-size: 16px; line-height: 1.6;">
                                    You've been invited to manage your AI voice assistant for <strong>{business_name}</strong> on SpotFunnel.
                                </p>
                                {f'<p style="margin: 0 0 20px 0; color: #64748b; font-size: 15px; line-height: 1.6; font-style: italic; padding: 15px; background-color: #f8fafc; border-left: 3px solid #14B8A6;">{custom_message}</p>' if custom_message else ''}
                                <p style="margin: 0 0 30px 0; color: #0f172a; font-size: 16px; line-height: 1.6;">
                                    Your SpotFunnel dashboard lets you:
                                </p>
                                <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #0f172a; font-size: 15px; line-height: 1.8;">
                                    <li>View and manage customer calls</li>
                                    <li>Track action items and callbacks</li>
                                    <li>Configure your AI assistant settings</li>
                                    <li>Review call transcripts and analytics</li>
                                </ul>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="{invitation_url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Accept Invitation & Set Password</a>
                                </div>
                                <p style="margin: 20px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                                    This invitation expires in {INVITATION_EXPIRY_DAYS} days.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">
                                    Questions? Email us at <a href="mailto:{REPLY_TO_EMAIL}" style="color: #14B8A6; text-decoration: none;">{REPLY_TO_EMAIL}</a>
                                </p>
                                <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
                                    © 2026 SpotFunnel. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    await send_email(
        to_email=email,
        subject=subject,
        html_content=html_content
    )

async def send_password_reset_email(
    email: str,
    token: str,
    first_name: Optional[str] = None
) -> None:
    """Send password reset email via Resend"""
    from .email_service import send_email
    
    reset_url = f"{APP_URL}/auth/reset-password?token={token}"
    
    subject = "Reset your SpotFunnel password"
    
    greeting = f"Hi {first_name}," if first_name else "Hi there,"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <tr>
                            <td style="background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%); padding: 30px; text-align: center;">
                                <div style="width: 60px; height: 60px; background: white; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                                    <svg viewBox="0 0 100 100" width="40" height="40" fill="#000000" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="50" cy="24" r="17" />
                                        <path d="M 12 42 L 27 42 L 48 92 L 33 92 Z" />
                                        <path d="M 88 42 L 73 42 L 52 92 L 67 92 Z" />
                                    </svg>
                                </div>
                                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Password Reset</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="margin: 0 0 20px 0; color: #0f172a; font-size: 16px; line-height: 1.6;">
                                    {greeting}
                                </p>
                                <p style="margin: 0 0 20px 0; color: #0f172a; font-size: 16px; line-height: 1.6;">
                                    We received a request to reset your SpotFunnel password.
                                </p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="{reset_url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Reset Password</a>
                                </div>
                                <p style="margin: 20px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                                    This link expires in {PASSWORD_RESET_EXPIRY_HOURS} hour. If you didn't request this, you can safely ignore this email.
                                </p>
                                <p style="margin: 10px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                                    Your password won't change until you create a new one.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">
                                    Need help? Email <a href="mailto:{REPLY_TO_EMAIL}" style="color: #14B8A6; text-decoration: none;">{REPLY_TO_EMAIL}</a>
                                </p>
                                <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
                                    © 2026 SpotFunnel. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    await send_email(
        to_email=email,
        subject=subject,
        html_content=html_content
    )

# =============================================================================
# AUTHENTICATION ENDPOINTS
# =============================================================================

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, http_request: Request):
    """
    Customer login endpoint.
    Validates email/password and returns session token.
    """
    import psycopg2.extras
    
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Get user by email
        cur.execute(
            """
            SELECT user_id, tenant_id, email, password_hash, first_name, last_name, is_active, role
            FROM users
            WHERE email = %s
            """,
            (request.email,)
        )
        user = cur.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        if not user['is_active']:
            raise HTTPException(status_code=403, detail="Account is inactive")
        
        if not user['password_hash']:
            raise HTTPException(status_code=400, detail="Password not set. Please use invitation link.")
        
        # Verify password
        if not verify_password(request.password, user['password_hash']):
            # Log failed attempt
            cur.execute(
                """
                INSERT INTO auth_audit_log (user_id, tenant_id, event_type, event_status, metadata)
                VALUES (%s::uuid, %s::uuid, 'login', 'failure', %s)
                """,
                (str(user['user_id']), str(user['tenant_id']), psycopg2.extras.Json({'reason': 'invalid_password'}))
            )
            conn.commit()
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Update last login
        cur.execute(
            """
            UPDATE users
            SET last_login = NOW(),
                last_login_at = NOW(),
                login_count = login_count + 1
            WHERE user_id = %s::uuid
            """,
            (str(user['user_id']),)
        )
        conn.commit()

        # Generate session token and store session hash
        session_token = generate_session_token()
        session_hash = hash_session_token(session_token)
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)

        user_agent = http_request.headers.get("User-Agent", "Unknown")
        ip_address = http_request.client.host if http_request.client else "Unknown"

        cur.execute(
            """
            INSERT INTO sessions (user_id, session_hash, expires_at, user_agent, ip_address)
            VALUES (%s::uuid, %s, %s, %s, %s)
            """,
            (str(user['user_id']), session_hash, expires_at, user_agent, ip_address)
        )
        conn.commit()
        
        # Log successful login
        cur.execute(
            """
            INSERT INTO auth_audit_log (user_id, tenant_id, event_type, event_status)
            VALUES (%s::uuid, %s::uuid, 'login', 'success')
            """,
            (str(user['user_id']), str(user['tenant_id']))
        )
        conn.commit()
        
        return LoginResponse(
            success=True,
            user_id=str(user['user_id']),
            tenant_id=str(user['tenant_id']),
            email=user['email'],
            first_name=user['first_name'],
            last_name=user['last_name'],
            session_token=session_token,
            role=user.get('role'),
        )
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Login error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Login failed")
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)


@router.post("/logout")
async def logout(
    response: Response,
    session_token: Optional[str] = Cookie(None),
):
    """
    Logout user and invalidate session token.
    """
    if not session_token:
        return {"success": True}

    db_service = get_db_service()
    conn = None
    try:
        conn = db_service.get_connection()
        cur = conn.cursor()
        session_hash = hash_session_token(session_token)
        cur.execute(
            "DELETE FROM sessions WHERE session_hash = %s",
            (session_hash,),
        )
        conn.commit()
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)

    response.delete_cookie(key="session_token")
    return {"success": True}


@router.post("/refresh-session")
async def refresh_session(
    response: Response,
    session_token: Optional[str] = Cookie(None),
    session: Dict[str, Any] = Depends(require_auth),
):
    """
    Refresh session expiration and update cookie.
    """
    if not session_token:
        raise HTTPException(status_code=400, detail="No session to refresh")

    db_service = get_db_service()
    conn = None
    try:
        conn = db_service.get_connection()
        cur = conn.cursor()
        session_hash = hash_session_token(session_token)
        new_expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
        cur.execute(
            """
            UPDATE sessions
            SET expires_at = %s, last_accessed_at = NOW()
            WHERE session_hash = %s
            RETURNING session_id
            """,
            (new_expires_at, session_hash),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Session not found")
        conn.commit()
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="lax",
    )

    return {"success": True, "expires_at": new_expires_at.isoformat()}


@router.get("/sessions")
async def list_sessions(session: Dict[str, Any] = Depends(require_auth)):
    """
    List all active sessions for the current user.
    """
    db_service = get_db_service()
    conn = None
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT session_id, created_at, last_accessed_at, expires_at, user_agent, ip_address
            FROM sessions
            WHERE user_id = %s::uuid AND expires_at > NOW()
            ORDER BY last_accessed_at DESC
            """,
            (session["user_id"],),
        )
        sessions = cur.fetchall()
        return {"sessions": [dict(row) for row in sessions]}
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    session: Dict[str, Any] = Depends(require_auth),
):
    """
    Revoke a specific session (logout from device).
    """
    db_service = get_db_service()
    conn = None
    try:
        conn = db_service.get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            DELETE FROM sessions
            WHERE session_id = %s::uuid AND user_id = %s::uuid
            RETURNING session_id
            """,
            (session_id, session["user_id"]),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Session not found or access denied")
        conn.commit()
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)

    return {"success": True}


@router.get("/me")
async def get_current_user(session: Dict[str, Any] = Depends(require_auth)):
    """
    Return current authenticated user info.
    """
    return {
        "user_id": session["user_id"],
        "tenant_id": session["tenant_id"],
        "email": session["email"],
        "role": session["role"],
    }

@router.post("/accept-invitation")
async def accept_invitation(request: AcceptInvitationRequest):
    """
    Accept invitation and set password.
    Creates user account and marks invitation as accepted.
    """
    import psycopg2.extras
    
    db_service = get_db_service()
    token_hash = hashlib.sha256(request.token.encode()).hexdigest()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Validate invitation token
        cur.execute(
            """
            SELECT invitation_id, tenant_id, email, first_name, last_name, accepted, expires_at
            FROM invitations
            WHERE token_hash = %s
            """,
            (token_hash,)
        )
        invitation = cur.fetchone()
        
        if not invitation:
            raise HTTPException(status_code=404, detail="Invalid invitation token")
        
        if invitation['accepted']:
            raise HTTPException(status_code=400, detail="Invitation already accepted")
        
        if invitation['expires_at'] < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invitation expired")
        
        # Check if user already exists
        cur.execute(
            """
            SELECT user_id FROM users WHERE email = %s
            """,
            (invitation['email'],)
        )
        existing_user = cur.fetchone()
        
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Hash password
        password_hash = hash_password(request.password)
        
        # Create user account
        cur.execute(
            """
            INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, email_verified, is_active)
            VALUES (%s, %s, %s, %s, %s, true, true)
            RETURNING user_id
            """,
            (
                invitation['tenant_id'],
                invitation['email'],
                password_hash,
                invitation['first_name'],
                invitation['last_name']
            )
        )
        user_id = cur.fetchone()['user_id']
        
        # Mark invitation as accepted
        cur.execute(
            """
            UPDATE invitations
            SET accepted = true, accepted_at = NOW()
            WHERE invitation_id = %s
            """,
            (invitation['invitation_id'],)
        )
        
        # Log event
        cur.execute(
            """
            INSERT INTO auth_audit_log (user_id, tenant_id, event_type, event_status)
            VALUES (%s, %s, 'invitation_accepted', 'success')
            """,
            (user_id, invitation['tenant_id'])
        )
        
        conn.commit()
        
        return {"success": True, "message": "Account created successfully", "user_id": str(user_id)}
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Accept invitation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to accept invitation")
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request password reset.
    Sends reset email if user exists.
    """
    db_service = get_db_service()
    conn = None

    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            """
            SELECT user_id, email, first_name, is_active
            FROM users
            WHERE email = %s AND role = 'customer'
            """,
            (request.email,),
        )
        user = cur.fetchone()

        # Always return success to prevent email enumeration
        if not user or not user["is_active"]:
            return {"success": True, "message": "If the email exists, a reset link has been sent"}

        plain_token, token_hash = generate_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=PASSWORD_RESET_EXPIRY_HOURS)

        cur.execute(
            """
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
            VALUES (%s, %s, %s)
            """,
            (user["user_id"], token_hash, expires_at),
        )
        conn.commit()

        await send_password_reset_email(
            email=user["email"],
            token=plain_token,
            first_name=user["first_name"],
        )

        cur.execute(
            """
            INSERT INTO auth_audit_log (user_id, event_type, event_status)
            VALUES (%s, 'password_reset_requested', 'success')
            """,
            (user["user_id"],),
        )
        conn.commit()

        return {"success": True, "message": "If the email exists, a reset link has been sent"}

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Forgot password error: {e}", exc_info=True)
        return {"success": True, "message": "If the email exists, a reset link has been sent"}
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password with token.
    """
    db_service = get_db_service()
    token_hash = hashlib.sha256(request.token.encode()).hexdigest()
    conn = None

    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            """
            SELECT token_id, user_id, used, expires_at
            FROM password_reset_tokens
            WHERE token_hash = %s
            """,
            (token_hash,),
        )
        token_record = cur.fetchone()

        if not token_record:
            raise HTTPException(status_code=404, detail="Invalid reset token")

        if token_record["used"]:
            raise HTTPException(status_code=400, detail="Token already used")

        if token_record["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Token expired")

        password_hash = hash_password(request.password)

        cur.execute(
            """
            UPDATE users
            SET password_hash = %s, updated_at = NOW()
            WHERE user_id = %s
            """,
            (password_hash, token_record["user_id"]),
        )

        cur.execute(
            """
            UPDATE password_reset_tokens
            SET used = true, used_at = NOW()
            WHERE token_id = %s
            """,
            (token_record["token_id"],),
        )

        cur.execute(
            """
            INSERT INTO auth_audit_log (user_id, event_type, event_status)
            VALUES (%s, 'password_reset_completed', 'success')
            """,
            (token_record["user_id"],),
        )
        conn.commit()

        return {"success": True, "message": "Password reset successfully"}

    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Reset password error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reset password")
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)

@router.get("/validate-token", response_model=ValidateTokenResponse)
async def validate_token(token: str, token_type: str = "invitation"):
    """
    Validate invitation or reset token.
    Returns token validity and associated email.
    """
    import psycopg2.extras
    
    db_service = get_db_service()
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if token_type == "invitation":
            cur.execute(
                """
                SELECT email, first_name, last_name, accepted, expires_at
                FROM invitations
                WHERE token_hash = %s
                """,
                (token_hash,)
            )
            record = cur.fetchone()
            
            if not record:
                return ValidateTokenResponse(valid=False, error_message="Invalid invitation token")
            
            if record['accepted']:
                return ValidateTokenResponse(valid=False, error_message="Invitation already accepted")
            
            if record['expires_at'] < datetime.now(timezone.utc):
                return ValidateTokenResponse(valid=False, error_message="Invitation expired")
            
            return ValidateTokenResponse(
                valid=True,
                email=record['email'],
                first_name=record['first_name'],
                last_name=record['last_name']
            )
            
        elif token_type == "reset":
            cur.execute(
                """
                SELECT u.email, u.first_name, prt.used, prt.expires_at
                FROM password_reset_tokens prt
                JOIN users u ON prt.user_id = u.user_id
                WHERE prt.token_hash = %s
                """,
                (token_hash,)
            )
            record = cur.fetchone()
            
            if not record:
                return ValidateTokenResponse(valid=False, error_message="Invalid reset token")
            
            if record['used']:
                return ValidateTokenResponse(valid=False, error_message="Token already used")
            
            if record['expires_at'] < datetime.now(timezone.utc):
                return ValidateTokenResponse(valid=False, error_message="Token expired")
            
            return ValidateTokenResponse(
                valid=True,
                email=record['email'],
                first_name=record['first_name']
            )
        
        else:
            raise HTTPException(status_code=400, detail="Invalid token type")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Validate token error: {e}", exc_info=True)
        return ValidateTokenResponse(valid=False, error_message="Validation failed")
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)

# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

@admin_router.post("/invite-user")
async def invite_user(request: InviteUserRequest, session: Dict[str, Any] = Depends(require_admin)):
    """
    Admin endpoint to invite a customer user.
    Sends invitation email with secure token.
    """
    import psycopg2.extras
    
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Verify tenant exists
        cur.execute(
            """
            SELECT tenant_id, business_name, status
            FROM tenants
            WHERE tenant_id::text = %s
            """,
            (request.tenant_id,)
        )
        tenant = cur.fetchone()
        
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        if tenant['status'] != 'active':
            raise HTTPException(status_code=400, detail="Tenant is not active")
        
        # Check if user already exists for this tenant
        cur.execute(
            """
            SELECT user_id FROM users WHERE tenant_id::text = %s
            """,
            (request.tenant_id,)
        )
        existing_user = cur.fetchone()
        
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists for this tenant")
        
        # Check for existing pending invitation
        cur.execute(
            """
            SELECT invitation_id FROM invitations
            WHERE tenant_id::text = %s AND accepted = false AND expires_at > NOW()
            """,
            (request.tenant_id,)
        )
        existing_invitation = cur.fetchone()
        
        if existing_invitation:
            raise HTTPException(status_code=400, detail="Pending invitation already exists")
        
        # Generate invitation token
        plain_token, token_hash = generate_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=INVITATION_EXPIRY_DAYS)
        
        # Store invitation
        cur.execute(
            """
            INSERT INTO invitations (tenant_id, email, token_hash, first_name, last_name, invited_by, custom_message, expires_at)
            VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                request.tenant_id,
                request.email,
                token_hash,
                request.first_name,
                request.last_name,
                session.get("email", "admin"),
                request.custom_message,
                expires_at
            )
        )
        conn.commit()
        
        # Send invitation email
        await send_invitation_email(
            email=request.email,
            token=plain_token,
            business_name=tenant['business_name'],
            first_name=request.first_name,
            custom_message=request.custom_message
        )
        
        # Log event
        cur.execute(
            """
            INSERT INTO auth_audit_log (tenant_id, event_type, event_status, metadata)
            VALUES (%s::uuid, 'invitation_sent', 'success', %s)
            """,
            (
                request.tenant_id,
                psycopg2.extras.Json({'email': request.email, 'invited_by': session.get("email", "admin")})
            )
        )
        conn.commit()
        
        return {
            "success": True,
            "message": "Invitation sent successfully",
            "expires_at": expires_at.isoformat()
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Invite user error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to send invitation: {str(e)}")
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)

@admin_router.post("/resend-invitation/{tenant_id}")
async def resend_invitation(tenant_id: str, session: Dict[str, Any] = Depends(require_admin)):
    """
    Resend invitation for a tenant.
    Invalidates old invitation and sends new one.
    """
    import psycopg2.extras
    
    db_service = get_db_service()
    conn = None
    
    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Get existing invitation
        cur.execute(
            """
            SELECT i.invitation_id, i.email, i.first_name, i.last_name, i.custom_message, t.business_name
            FROM invitations i
            JOIN tenants t ON i.tenant_id = t.tenant_id
            WHERE i.tenant_id::text = %s AND i.accepted = false
            ORDER BY i.created_at DESC
            LIMIT 1
            """,
            (tenant_id,)
        )
        invitation = cur.fetchone()
        
        if not invitation:
            raise HTTPException(status_code=404, detail="No pending invitation found")
        
        # Generate new token
        plain_token, token_hash = generate_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=INVITATION_EXPIRY_DAYS)
        
        # Update invitation with new token
        cur.execute(
            """
            UPDATE invitations
            SET token_hash = %s, expires_at = %s, created_at = NOW()
            WHERE invitation_id = %s
            """,
            (token_hash, expires_at, invitation['invitation_id'])
        )
        conn.commit()
        
        # Send new invitation email
        await send_invitation_email(
            email=invitation['email'],
            token=plain_token,
            business_name=invitation['business_name'],
            first_name=invitation['first_name'],
            custom_message=invitation['custom_message']
        )
        
        return {
            "success": True,
            "message": "Invitation resent successfully",
            "expires_at": expires_at.isoformat()
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Resend invitation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to resend invitation")
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)

@admin_router.get("/user-status/{tenant_id}", response_model=UserStatusResponse)
async def get_user_status(tenant_id: str, session: Dict[str, Any] = Depends(require_admin)):
    """
    Get user status for a tenant (for Operations tab).
    Returns user status, invitation status, and last login.
    """
    db_service = get_db_service()
    conn = None

    try:
        conn = db_service.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT 
                tenant_id,
                business_name,
                user_status,
                user_email,
                user_id,
                last_login,
                invitation_created_at,
                invitation_expires_at
            FROM agent_user_status
            WHERE tenant_id::text = %s
            """,
            (tenant_id,),
        )
        status = cur.fetchone()

        if not status:
            raise HTTPException(status_code=404, detail="Tenant not found")

        return UserStatusResponse(
            tenant_id=str(status['tenant_id']),
            business_name=status['business_name'],
            user_status=status['user_status'],
            user_email=status['user_email'],
            user_id=str(status['user_id']) if status['user_id'] else None,
            last_login=status['last_login'],
            invitation_sent_at=status['invitation_created_at'],
            invitation_expires_at=status['invitation_expires_at']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user status error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get user status")
    finally:
        if conn:
            cur.close()
            db_service.put_connection(conn)
