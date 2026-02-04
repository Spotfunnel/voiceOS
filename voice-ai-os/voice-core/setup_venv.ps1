# PowerShell script to set up virtual environment for Voice Core
# Run this script from the voice-core directory

Write-Host "Setting up Voice Core virtual environment..." -ForegroundColor Green

# Check Python version
$pythonVersion = python --version 2>&1
Write-Host "Python version: $pythonVersion" -ForegroundColor Cyan

# Create virtual environment
if (Test-Path "venv") {
    Write-Host "Virtual environment already exists. Removing old one..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force venv
}

Write-Host "Creating virtual environment..." -ForegroundColor Cyan
python -m venv venv

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& .\venv\Scripts\Activate.ps1

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip

# Install project in editable mode with dev dependencies
Write-Host "Installing Voice Core and dependencies..." -ForegroundColor Cyan
pip install -e ".[dev]"

Write-Host "`nSetup complete! Virtual environment is ready." -ForegroundColor Green
Write-Host "To activate the virtual environment, run:" -ForegroundColor Yellow
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "`nOr on Windows CMD:" -ForegroundColor Yellow
Write-Host "  venv\Scripts\activate.bat" -ForegroundColor White
