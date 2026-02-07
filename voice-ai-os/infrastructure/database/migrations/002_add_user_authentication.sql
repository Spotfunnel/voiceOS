-- =============================================================================
-- MIGRATION 002: User Authentication System
-- =============================================================================
-- Purpose: Add user authentication, invitations, and password reset functionality
-- Date: 2026-02-03
-- Author: SpotFunnel Team
--
-- Tables Added:
-- - users: Customer accounts (1:1 with tenants)
-- - invitations: Invitation tracking for onboarding
-- - password_reset_tokens: Password reset token management
--
-- Views Added:
-- - agent_user_status: Combined view for Operations tab user status display
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For token hashing

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- Represents customer user accounts
-- Each user is linked 1:1 to a tenant (agent/business)
-- Operators can invite one customer user per tenant

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Authentication
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255), -- bcrypt hash, NULL until password is set
  
  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Role and status
  role VARCHAR(20) DEFAULT 'customer' NOT NULL CHECK (role IN ('customer', 'operator')),
  email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Activity tracking
  last_login TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for user lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

COMMENT ON TABLE users IS 'Customer user accounts with 1:1 relationship to tenants';
COMMENT ON COLUMN users.tenant_id IS 'Links user to their agent/business (1:1 relationship enforced by UNIQUE constraint)';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash of user password, NULL until first password is set';

-- =============================================================================
-- INVITATIONS TABLE
-- =============================================================================
-- Tracks invitation lifecycle for customer onboarding
-- Admins send invitations, customers accept and create accounts

CREATE TABLE IF NOT EXISTS invitations (
  invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Invitation details
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of invitation token
  
  -- Recipient info (optional, provided by admin)
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  custom_message TEXT, -- Optional personalized message from admin
  
  -- Invitation metadata
  invited_by VARCHAR(255) NOT NULL, -- Admin user ID or email who sent invitation
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Status tracking
  accepted BOOLEAN DEFAULT FALSE,
  accepted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraint: One active invitation per tenant
  UNIQUE(tenant_id, email)
);

-- Indexes for invitation queries
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_accepted ON invitations(accepted) WHERE accepted = false;
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_created_at ON invitations(created_at DESC);

COMMENT ON TABLE invitations IS 'Invitation tracking for customer onboarding';
COMMENT ON COLUMN invitations.token_hash IS 'SHA-256 hash of secure invitation token (plain token sent via email)';
COMMENT ON COLUMN invitations.expires_at IS 'Invitation expiration (default 7 days from creation)';

-- =============================================================================
-- PASSWORD RESET TOKENS TABLE
-- =============================================================================
-- Manages password reset token lifecycle
-- Tokens are single-use and expire after 1 hour

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Token details
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of reset token
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Usage tracking
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  ip_address VARCHAR(45), -- IPv4 or IPv6 address for audit trail
  user_agent TEXT, -- Browser/client info for audit trail
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for token validation
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_created_at ON password_reset_tokens(created_at DESC);

COMMENT ON TABLE password_reset_tokens IS 'Password reset token management with single-use enforcement';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'SHA-256 hash of secure reset token (plain token sent via email)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration (default 1 hour from creation)';

-- =============================================================================
-- VIEWS FOR ADMIN OPERATIONS TAB
-- =============================================================================

-- Agent User Status View
-- Combines tenant, user, and invitation data for Operations tab display
CREATE OR REPLACE VIEW agent_user_status AS
SELECT 
  t.tenant_id,
  t.business_name,
  t.phone_number,
  t.status as agent_status,
  
  -- User information
  u.user_id,
  u.email as user_email,
  u.first_name,
  u.last_name,
  u.email_verified,
  u.is_active as user_active,
  u.last_login,
  u.login_count,
  u.created_at as user_created_at,
  
  -- Invitation information
  i.invitation_id,
  i.email as invitation_email,
  i.invited_by,
  i.accepted as invitation_accepted,
  i.expires_at as invitation_expires_at,
  i.created_at as invitation_created_at,
  
  -- Computed user status for UI badges
  CASE 
    WHEN u.user_id IS NULL AND i.invitation_id IS NULL THEN 'not_invited'
    WHEN u.user_id IS NULL AND i.accepted = FALSE AND i.expires_at > NOW() THEN 'invited'
    WHEN u.user_id IS NULL AND i.accepted = FALSE AND i.expires_at <= NOW() THEN 'invitation_expired'
    WHEN u.user_id IS NOT NULL AND u.is_active = FALSE THEN 'inactive'
    WHEN u.user_id IS NOT NULL AND u.is_active = TRUE THEN 'active'
    ELSE 'unknown'
  END as user_status,
  
  -- Additional computed fields
  CASE 
    WHEN u.user_id IS NOT NULL THEN true
    ELSE false
  END as has_user,
  
  CASE 
    WHEN i.invitation_id IS NOT NULL AND i.accepted = FALSE AND i.expires_at > NOW() THEN true
    ELSE false
  END as has_pending_invitation
  
FROM tenants t
LEFT JOIN users u ON t.tenant_id = u.tenant_id
LEFT JOIN LATERAL (
  SELECT * FROM invitations 
  WHERE invitations.tenant_id = t.tenant_id 
  ORDER BY created_at DESC 
  LIMIT 1
) i ON true
WHERE t.status = 'active';

COMMENT ON VIEW agent_user_status IS 'Combined view for Operations tab showing user status per agent/tenant';

-- =============================================================================
-- FUNCTIONS FOR USER MANAGEMENT
-- =============================================================================

-- Function to validate invitation token
CREATE OR REPLACE FUNCTION validate_invitation_token(
  p_token_hash VARCHAR
) RETURNS TABLE (
  invitation_id UUID,
  tenant_id UUID,
  email VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.invitation_id,
    i.tenant_id,
    i.email,
    i.first_name,
    i.last_name,
    CASE 
      WHEN i.accepted = TRUE THEN FALSE
      WHEN i.expires_at < NOW() THEN FALSE
      ELSE TRUE
    END as is_valid,
    CASE 
      WHEN i.accepted = TRUE THEN 'Invitation already accepted'
      WHEN i.expires_at < NOW() THEN 'Invitation expired'
      ELSE NULL
    END as error_message
  FROM invitations i
  WHERE i.token_hash = p_token_hash;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR,
      FALSE, 'Invalid invitation token'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to validate password reset token
CREATE OR REPLACE FUNCTION validate_reset_token(
  p_token_hash VARCHAR
) RETURNS TABLE (
  token_id UUID,
  user_id UUID,
  email VARCHAR,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    prt.token_id,
    prt.user_id,
    u.email,
    CASE 
      WHEN prt.used = TRUE THEN FALSE
      WHEN prt.expires_at < NOW() THEN FALSE
      ELSE TRUE
    END as is_valid,
    CASE 
      WHEN prt.used = TRUE THEN 'Token already used'
      WHEN prt.expires_at < NOW() THEN 'Token expired'
      ELSE NULL
    END as error_message
  FROM password_reset_tokens prt
  JOIN users u ON prt.user_id = u.user_id
  WHERE prt.token_hash = p_token_hash;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, NULL::VARCHAR,
      FALSE, 'Invalid reset token'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired password reset tokens older than 7 days
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =============================================================================

-- Reuse existing update_updated_at_column function from base schema
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- AUDIT LOG FOR AUTHENTICATION EVENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS auth_audit_log (
  audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE SET NULL,
  
  -- Event details
  event_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'password_reset', 'invitation_sent', etc.
  event_status VARCHAR(20) NOT NULL CHECK (event_status IN ('success', 'failure', 'pending')),
  
  -- Context
  ip_address VARCHAR(45),
  user_agent TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_tenant_id ON auth_audit_log(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON auth_audit_log(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_timestamp ON auth_audit_log(timestamp DESC);

COMMENT ON TABLE auth_audit_log IS 'Audit trail for all authentication-related events';

-- =============================================================================
-- GRANTS (if using specific database roles)
-- =============================================================================

-- Grant permissions to application role (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON users TO spotfunnel_app;
-- GRANT SELECT, INSERT, UPDATE ON invitations TO spotfunnel_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO spotfunnel_app;
-- GRANT SELECT ON agent_user_status TO spotfunnel_app;
-- GRANT INSERT ON auth_audit_log TO spotfunnel_app;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 002: User Authentication System - COMPLETED';
  RAISE NOTICE 'Tables created: users, invitations, password_reset_tokens, auth_audit_log';
  RAISE NOTICE 'Views created: agent_user_status';
  RAISE NOTICE 'Functions created: validate_invitation_token, validate_reset_token, cleanup_expired_tokens';
END $$;
