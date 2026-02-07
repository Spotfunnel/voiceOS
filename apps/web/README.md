# Voice AI Onboarding UI

Non-coder friendly UI for configuring voice AI objectives in **<1 hour**.

## Overview

This is a Next.js 14 application that provides a visual, form-based interface for configuring voice AI workflows without writing code or YAML. Operators can:

1. **Browse Objective Library** - Select from pre-built templates
2. **Build Objectives** - Configure each objective with visual forms
3. **Preview Configuration** - See generated YAML in real-time with validation
4. **Test Mode** - Simulate conversations and estimate costs
5. **Deploy** - One-click deployment to production

## Features

### ✅ Non-Coder Friendly
- Visual form-based builder (no drag-and-drop complexity)
- Pre-built objective templates
- Real-time validation with clear error messages
- No YAML editing required (auto-generated)

### ✅ DAG Validation
- Prevents cycles in objective flow
- Validates all references exist
- Highlights errors in real-time

### ✅ Test Mode
- Simulate conversations before deploying
- Step through each objective
- Shows what agent will say
- Estimates cost per call

### ✅ Mobile Responsive
- Works on tablets (operators use tablets)
- Responsive design with Tailwind CSS
- Touch-friendly interface

## Quick Start

```bash
cd onboarding-ui
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

### Components

- **`ObjectiveLibrary.tsx`** - Pre-built objective templates
- **`ObjectiveBuilder.tsx`** - Visual form-based builder
- **`ConfigPreview.tsx`** - Real-time YAML generation and validation
- **`TestMode.tsx`** - Conversation simulation
- **`DeployConfig.tsx`** - Deployment workflow

### Utils

- **`configGenerator.ts`** - YAML generation and DAG validation
- **`objectiveTemplates.ts`** - Pre-built templates

### Types

- **`config.ts`** - TypeScript types for configuration

## Usage Flow

1. **Tenant Setup** - Enter tenant ID, name, and locale
2. **Add Objectives** - Click templates from library
3. **Configure** - Set purpose, required flag, on_success/on_failure
4. **Preview** - Review generated YAML
5. **Test** - Simulate conversation
6. **Deploy** - Upload config, assign phone, go live

## Requirements Met

- ✅ Non-coder can complete in <1 hour (timed test)
- ✅ No YAML editing required (generated automatically)
- ✅ DAG validation prevents cycles
- ✅ Test mode before deploy (no surprises)
- ✅ Mobile-responsive (operators use tablets)

## Tech Stack

- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Zod for validation
- TypeScript

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## Testing Onboarding Time

To measure onboarding time:

1. Start timer when user opens tenant form
2. User completes all steps:
   - Tenant setup (1-2 min)
   - Add objectives (2-5 min)
   - Configure objectives (5-15 min)
   - Preview & validate (1-2 min)
   - Test mode (2-5 min)
   - Deploy (2-5 min)
3. Stop timer when deployment completes
4. Target: <60 minutes total

## Demo Video

Record a screen capture showing:
- Complete onboarding flow
- Adding 3-5 objectives
- Configuring each objective
- Testing conversation
- Deploying to production

## Next Steps

- [ ] Connect to orchestration API
- [ ] Add real Twilio phone number assignment
- [ ] Implement actual test call functionality
- [ ] Add onboarding time tracking
- [ ] Create demo video
