-- Add session tracking improvements
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);

-- Add index for active sessions per user
CREATE INDEX IF NOT EXISTS idx_sessions_user_active
    ON sessions(user_id, expires_at);

COMMENT ON COLUMN sessions.user_agent IS 'Browser/device user agent string';
COMMENT ON COLUMN sessions.ip_address IS 'IP address when session created';
COMMENT ON COLUMN sessions.device_name IS 'User-friendly device name';
