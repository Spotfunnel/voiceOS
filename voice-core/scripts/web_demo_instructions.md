# Voice AI Demo - Web Testing Instructions

## Issue: daily-python is Linux-only

The `daily-python` SDK is not available for Windows. To test the voice AI on Windows, you have two options:

## Option 1: Use Daily.co Web Interface (Recommended for Quick Test)

1. **Join the room directly in your browser:**
   - Open: https://spotfunnel.daily.co
   - You'll be able to speak and the bot will respond

2. **The bot needs to run on Linux/Mac or WSL:**
   - If you have WSL2 (Windows Subsystem for Linux), you can run the demo there
   - Or deploy to a Linux server/container

## Option 2: Use WSL2 (Windows Subsystem for Linux)

1. **Install WSL2 if not already installed:**
   ```powershell
   wsl --install
   ```

2. **Open WSL2 terminal and navigate to the project:**
   ```bash
   cd /mnt/c/Users/leoge/OneDrive/Documents/AI\ Activity/Cursor/VoiceAIProduction/voice-core
   ```

3. **Install Python dependencies in WSL:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Copy your .env file to WSL or set environment variables**

5. **Run the demo:**
   ```bash
   python scripts/demo_call.py
   ```

## Option 3: Deploy to a Linux Server

Deploy the voice-core to a Linux server (AWS, GCP, DigitalOcean, etc.) and run it there.

## Alternative: Use Twilio for PSTN calls

If you want to test on Windows without WSL, we can switch to using Twilio's Python SDK which does support Windows. This would allow phone-based testing instead of WebRTC.

Let me know which approach you'd like to take!
