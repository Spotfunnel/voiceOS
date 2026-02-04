#!/bin/bash
# Voice AI Platform - Setup Script (Linux/Mac)
# Day 1 Foundation: Docker, PostgreSQL, Redis, and local development environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Voice AI Platform - Day 1 Foundation Setup             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose found${NC}"

# Check Python (for migrations)
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3 first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python 3 found${NC}"

# Check if .env exists
if [ ! -f "$INFRA_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f "$INFRA_DIR/.env.example" ]; then
        cp "$INFRA_DIR/.env.example" "$INFRA_DIR/.env"
        echo -e "${GREEN}✅ Created .env file. Please update it with your actual values.${NC}"
    else
        echo -e "${RED}❌ .env.example not found!${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Load environment variables
if [ -f "$INFRA_DIR/.env" ]; then
    set -a
    source "$INFRA_DIR/.env"
    set +a
fi

echo ""
echo -e "${YELLOW}🐳 Starting Docker services...${NC}"
cd "$INFRA_DIR"

# Start Docker services
docker-compose up -d

echo ""
echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
timeout=60
counter=0
until docker-compose exec -T postgres pg_isready -U "${POSTGRES_USER:-spotfunnel}" -d "${POSTGRES_DB:-spotfunnel}" > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}❌ PostgreSQL failed to start within ${timeout}s${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ PostgreSQL is ready${NC}"

echo ""
echo -e "${YELLOW}⏳ Waiting for Redis to be ready...${NC}"
counter=0
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -ge 30 ]; then
        echo -e "${RED}❌ Redis failed to start within 30s${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ Redis is ready${NC}"

echo ""
echo -e "${YELLOW}📦 Installing Python dependencies for migrations...${NC}"
if [ -f "$INFRA_DIR/database/requirements.txt" ]; then
    python3 -m pip install -q -r "$INFRA_DIR/database/requirements.txt"
    echo -e "${GREEN}✅ Python dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  requirements.txt not found, skipping${NC}"
fi

echo ""
echo -e "${YELLOW}🔄 Running database migrations...${NC}"
if [ -f "$INFRA_DIR/database/migrate.py" ]; then
    python3 "$INFRA_DIR/database/migrate.py" --database-url "${DATABASE_URL:-postgresql://${POSTGRES_USER:-spotfunnel}:${POSTGRES_PASSWORD:-dev}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-spotfunnel}}"
    echo -e "${GREEN}✅ Migrations completed${NC}"
else
    echo -e "${YELLOW}⚠️  migrate.py not found, skipping migrations${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Setup Complete!                                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose ps
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "   1. Update .env file with your API keys"
echo "   2. Verify services are running: docker-compose ps"
echo "   3. Check logs: docker-compose logs -f"
echo "   4. Access PgAdmin: http://localhost:${PGADMIN_PORT:-5050}"
echo ""
echo -e "${BLUE}🔗 Connection Strings:${NC}"
echo "   PostgreSQL: ${DATABASE_URL:-postgresql://${POSTGRES_USER:-spotfunnel}:${POSTGRES_PASSWORD:-dev}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-spotfunnel}}"
echo "   Redis: ${REDIS_URL:-redis://localhost:${REDIS_PORT:-6379}}"
echo ""
