# Voice AI Platform - Setup Script (Windows PowerShell)
# Day 1 Foundation: Docker, PostgreSQL, Redis, and local development environment

$ErrorActionPreference = "Stop"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Get script directory
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$INFRA_DIR = Split-Path -Parent $SCRIPT_DIR

Write-ColorOutput Cyan "╔══════════════════════════════════════════════════════════╗"
Write-ColorOutput Cyan "║  Voice AI Platform - Day 1 Foundation Setup             ║"
Write-ColorOutput Cyan "╚══════════════════════════════════════════════════════════╝"
Write-Output ""

# Check prerequisites
Write-ColorOutput Yellow "📋 Checking prerequisites..."

# Check Docker
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not found"
    }
    Write-ColorOutput Green "✅ Docker found"
} catch {
    Write-ColorOutput Red "❌ Docker is not installed. Please install Docker Desktop first."
    Write-Output "   Visit: https://docs.docker.com/desktop/install/windows-install/"
    exit 1
}

# Check Docker Compose
try {
    $composeVersion = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) {
        $composeVersion = docker-compose --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Docker Compose not found"
        }
    }
    Write-ColorOutput Green "✅ Docker Compose found"
} catch {
    Write-ColorOutput Red "❌ Docker Compose is not installed."
    exit 1
}

# Check Python (for migrations)
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Python not found"
    }
    Write-ColorOutput Green "✅ Python found"
} catch {
    Write-ColorOutput Red "❌ Python is not installed. Please install Python 3 first."
    Write-Output "   Visit: https://www.python.org/downloads/"
    exit 1
}

# Check if .env exists
$envPath = Join-Path $INFRA_DIR ".env"
$envExamplePath = Join-Path $INFRA_DIR ".env.example"

if (-not (Test-Path $envPath)) {
    Write-ColorOutput Yellow "⚠️  .env file not found. Creating from .env.example..."
    if (Test-Path $envExamplePath) {
        Copy-Item $envExamplePath $envPath
        Write-ColorOutput Green "✅ Created .env file. Please update it with your actual values."
    } else {
        Write-ColorOutput Red "❌ .env.example not found!"
        exit 1
    }
} else {
    Write-ColorOutput Green "✅ .env file exists"
}

# Load environment variables from .env
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)\s*$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Expand variables in value
            $value = $value -replace '\$\{([^}]+)\}', { param($m) 
                $varName = $m.Groups[1].Value
                if (Test-Path "env:$varName") {
                    (Get-Item "env:$varName").Value
                } else {
                    $m.Value
                }
            }
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

Write-Output ""
Write-ColorOutput Yellow "🐳 Starting Docker services..."
Set-Location $INFRA_DIR

# Start Docker services
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput Red "❌ Failed to start Docker services"
    exit 1
}

Write-Output ""
Write-ColorOutput Yellow "⏳ Waiting for PostgreSQL to be ready..."
$timeout = 60
$counter = 0
$postgresUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "spotfunnel" }
$postgresDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "spotfunnel" }

do {
    Start-Sleep -Seconds 2
    $counter += 2
    $result = docker-compose exec -T postgres pg_isready -U $postgresUser -d $postgresDb 2>&1
    if ($LASTEXITCODE -eq 0) {
        break
    }
    if ($counter -ge $timeout) {
        Write-ColorOutput Red "❌ PostgreSQL failed to start within ${timeout}s"
        exit 1
    }
} while ($true)

Write-ColorOutput Green "✅ PostgreSQL is ready"

Write-Output ""
Write-ColorOutput Yellow "⏳ Waiting for Redis to be ready..."
$counter = 0
do {
    Start-Sleep -Seconds 1
    $counter++
    $result = docker-compose exec -T redis redis-cli ping 2>&1
    if ($LASTEXITCODE -eq 0) {
        break
    }
    if ($counter -ge 30) {
        Write-ColorOutput Red "❌ Redis failed to start within 30s"
        exit 1
    }
} while ($true)

Write-ColorOutput Green "✅ Redis is ready"

Write-Output ""
Write-ColorOutput Yellow "📦 Installing Python dependencies for migrations..."
$requirementsPath = Join-Path $INFRA_DIR "database\requirements.txt"
if (Test-Path $requirementsPath) {
    python -m pip install -q -r $requirementsPath
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "✅ Python dependencies installed"
    } else {
        Write-ColorOutput Yellow "⚠️  Failed to install Python dependencies"
    }
} else {
    Write-ColorOutput Yellow "⚠️  requirements.txt not found, skipping"
}

Write-Output ""
Write-ColorOutput Yellow "🔄 Running database migrations..."
$migratePath = Join-Path $INFRA_DIR "database\migrate.py"
if (Test-Path $migratePath) {
    $dbUrl = if ($env:DATABASE_URL) {
        $env:DATABASE_URL
    } else {
        $user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "spotfunnel" }
        $pass = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "dev" }
        $port = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
        $db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "spotfunnel" }
        "postgresql://${user}:${pass}@localhost:${port}/${db}"
    }
    
    python $migratePath --database-url $dbUrl
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "✅ Migrations completed"
    } else {
        Write-ColorOutput Yellow "⚠️  Migration script encountered an error"
    }
} else {
    Write-ColorOutput Yellow "⚠️  migrate.py not found, skipping migrations"
}

Write-Output ""
Write-ColorOutput Green "╔══════════════════════════════════════════════════════════╗"
Write-ColorOutput Green "║  ✅ Setup Complete!                                     ║"
Write-ColorOutput Green "╚══════════════════════════════════════════════════════════╝"
Write-Output ""
Write-ColorOutput Cyan "📊 Service Status:"
docker-compose ps
Write-Output ""
Write-ColorOutput Cyan "📝 Next Steps:"
Write-Output "   1. Update .env file with your API keys"
Write-Output "   2. Verify services are running: docker-compose ps"
Write-Output "   3. Check logs: docker-compose logs -f"
$pgadminPort = if ($env:PGADMIN_PORT) { $env:PGADMIN_PORT } else { "5050" }
Write-Output "   4. Access PgAdmin: http://localhost:$pgadminPort"
Write-Output ""
Write-ColorOutput Cyan "🔗 Connection Strings:"
$dbUrlDisplay = if ($env:DATABASE_URL) {
    $env:DATABASE_URL
} else {
    $user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "spotfunnel" }
    $pass = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "dev" }
    $port = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
    $db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "spotfunnel" }
    "postgresql://${user}:${pass}@localhost:${port}/${db}"
}
Write-Output "   PostgreSQL: $dbUrlDisplay"
$redisPort = if ($env:REDIS_PORT) { $env:REDIS_PORT } else { "6379" }
Write-Output "   Redis: redis://localhost:$redisPort"
Write-Output ""
