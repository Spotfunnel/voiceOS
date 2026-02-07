
# SpotFunnel Dashboard UI Kit & Page Shells

This is a presentation-only export of the SpotFunnel Dashboard visual system.
It contains the core design tokens, reusable components, and 5 static page shells representing key operational workflows.

## 📦 Content

- **ui_kit/**: The core design system.
    - `tokens.css`: Tailwind-compatible CSS variables for colors, radius, and shadows.
    - `components/`: Reusable React components (Button, Card, Table, etc.).
    - `lib/`: Utility functions.
- **page_shells/**: Full page templates.
    - `operations/`: "Mission Control" view.
    - `new_agent/`: Provisioning flow.
    - `configure/`: Deep system settings.
    - `quality/`: Error analysis.
    - `intelligence/`: Strategy & ROI.

## 🎨 Visual System

**Philosophy**: "Elegant, User-Friendly, Non-Threatening."
**Palette**: Zinc/Slate foundation with Deep Blue primary and softened status colors (Emerald, Amber, Muted Red).

## 🛠 Usage

1.  **Import Tokens**: Ensure `tokens.css` is imported in your global CSS.
2.  **Dependencies**: This kit assumes:
    -   React
    -   Tailwind CSS (with `tailwindcss-animate`)
    -   `lucide-react` (for icons)
    -   `clsx` and `tailwind-merge` (for utils)

## ⚠️ Constraints (Verified)

-   ✅ **No Supabase**: No backend connection logic.
-   ✅ **No Auth**: No login/guards.
-   ✅ **Static Data**: All data is mocked within the components.
-   ✅ **No Routing**: Pages are standalone components.
