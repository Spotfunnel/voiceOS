#!/bin/bash
# Production startup script with SSL

set -e

echo "Starting Voice Core in PRODUCTION mode..."

# Load production environment
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
else
    echo "ERROR: .env.production not found"
    exit 1
fi

# Verify SSL certificates
if [ ! -f "$SSL_CERT_PATH" ]; then
    echo "ERROR: SSL certificate not found at $SSL_CERT_PATH"
    exit 1
fi

if [ ! -f "$SSL_KEY_PATH" ]; then
    echo "ERROR: SSL key not found at $SSL_KEY_PATH"
    exit 1
fi

# Run database migrations
echo "Running database migrations..."
python infrastructure/database/migrate.py

# Start with Uvicorn + SSL
echo "Starting server with SSL on $HOST:$PORT..."
uvicorn src.bot_runner:app \
    --host "$HOST" \
    --port "$PORT" \
    --workers "$WORKERS" \
    --ssl-keyfile "$SSL_KEY_PATH" \
    --ssl-certfile "$SSL_CERT_PATH" \
    --log-level info \
    --access-log \
    --proxy-headers \
    --forwarded-allow-ips '*'
