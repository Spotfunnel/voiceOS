# SpotFunnel UI Kit

## Overview
Shared design system for SpotFunnel Admin and Customer dashboards.

## Structure
- `tokens.css` - CSS variables for colors, spacing, typography
- `components/` - Reusable React components
- `lib/` - Utility functions
- `hooks/` - Custom React hooks
- `contexts/` - React contexts (for mock data)

## Usage
Import components and tokens:
```tsx
import { Button } from '../../ui_kit/components/ui/Button';
import '../../ui_kit/tokens.css';
```

## Components
- Button, Card, Badge, Table, Input, Textarea, Label
- StatsCard - KPI metric display
- DashboardLayout - Admin layout wrapper
- CustomerLayout - Customer layout wrapper

## Design Tokens
All colors, spacing, and typography use CSS variables from `tokens.css`.
