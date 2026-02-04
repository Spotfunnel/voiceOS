#!/bin/bash
# Bash script to set up virtual environment for Voice Core
# Run this script from the voice-core directory

set -e

echo "Setting up Voice Core virtual environment..."

# Check Python version
python_version=$(python3 --version 2>&1)
echo "Python version: $python_version"

# Create virtual environment
if [ -d "venv" ]; then
    echo "Virtual environment already exists. Removing old one..."
    rm -rf venv
fi

echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install project in editable mode with dev dependencies
echo "Installing Voice Core and dependencies..."
pip install -e ".[dev]"

echo ""
echo "Setup complete! Virtual environment is ready."
echo "To activate the virtual environment, run:"
echo "  source venv/bin/activate"
