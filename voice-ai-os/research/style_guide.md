# SpotFunnel UI Design System Style Guide

This style guide is the SINGLE SOURCE OF TRUTH for building SpotFunnel UI. All new tokens and components must strictly adhere to these specifications.

## 1. Design Tokens (Authoritative)

### Color System

**Format:** HSL values used with CSS variables.

| Token Name | Variable Name | HSL Value | Hex Approx | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | `--primary` | `174 72% 40%` | `#1CB096` | Main CTAs, active states, branding |
| Primary FG | `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on primary backgrounds |
| **Secondary** | `--secondary` | `215 25% 95%` | `#EEF2F6` | Supporting buttons, backgrounds |
| Secondary FG | `--secondary-foreground` | `222 47% 11%` | `#0F172A` | Text on secondary backgrounds |
| **Accent** | `--accent` | `38 92% 50%` | `#F5A623` | Highlights, warnings, special CTAs |
| Accent FG | `--accent-foreground` | `0 0% 100%` | `#FFFFFF` | Text on accent backgrounds |
| **Background** | `--background` | `220 20% 96%` | `#F1F5F9` | Page background (Light Mode) |
| **Foreground** | `--foreground` | `222 47% 11%` | `#0F172A` | Primary text color |
| **Card** | `--card` | `0 0% 100%` | `#FFFFFF` | Component backgrounds |
| Card FG | `--card-foreground` | `222 47% 11%` | `#0F172A` | Text on card backgrounds |
| **Muted** | `--muted` | `215 20% 94%` | `#EDF2F7` | Disabled states, subtle backgrounds |
| Muted FG | `--muted-foreground` | `215 16% 47%` | `#64748B` | Secondary text, placeholders |
| **Border** | `--border` | `214 32% 91%` | `#E2E8F0` | Component borders |
| **Input** | `--input` | `214 32% 91%` | `#E2E8F0` | Input field borders |
| **Ring** | `--ring` | `174 72% 40%` | `#1CB096` | Focus rings |

**Semantic Colors:**

*   **Destructive:** `0 84% 60%` (Red) - Error states, delete actions
*   **Success:** `142 76% 36%` (Green) - Success badges, completion states
*   **Warning:** `38 92% 50%` (Amber) - Warning alerts

**Gradients:**

*   `--gradient-primary`: `linear-gradient(135deg, hsl(174 72% 40%) 0%, hsl(174 72% 32%) 100%)`
*   `--gradient-hero`: `linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(222 47% 18%) 50%, hsl(174 72% 25%) 100%)`
*   `--gradient-card`: `linear-gradient(145deg, hsl(0 0% 100%) 0%, hsl(215 25% 98%) 100%)`
*   `--gradient-glow`: `radial-gradient(ellipse at center, hsl(174 72% 40% / 0.15) 0%, transparent 70%)`

### Typography

**Font Family:** `Roobert` (Primary), [Inter](file:///c:/Users/leoge/OneDrive/Documents/AI%20Activity/antigravity/UI%20Designer/spot-funnel-v2/src/integrations/supabase/types.ts#222-223), `system-ui`, `sans-serif` (Fallbacks)

**Weights:**
*   Regular: `400`
*   Medium: `500`
*   Bold: `700`

**Type Scale:** (Tailwind defaults strictly enforced)
*   **H1:** `text-4xl` / `text-5xl` (Hero) - Font bold
*   **H2:** `text-3xl` - Font bold
*   **H3:** `text-2xl` - Font semibold
*   **H4:** `text-xl` - Font semibold
*   **Body:** `text-base` / `text-sm` - Font normal
*   **Small:** `text-xs` - Font medium (Labels, metadata)

### Spacing System

**Base Unit:** `4px` (Tailwind standard `0.25rem`)

**Common Intervals:**
*   Keyword: `gap-2` (8px) - Tight grouping (icons + text)
*   Keyword: `gap-4` (16px) - Standard component spacing
*   Keyword: `p-6` (24px) - Card padding
*   Keyword: `py-10` (40px) - Section vertical spacing

### Border Radius

**Global Radius Variable:** `--radius: 0.75rem` (12px)

*   **Small:** `rounded-sm` (calc(radius - 4px)) -> 8px
*   **Medium:** `rounded-md` (calc(radius - 2px)) -> 10px
*   **Large / Default:** `rounded-lg` (radius) -> 12px
*   **Extra Large:** `rounded-xl` -> Used for larger containers/modals
*   **Full:** `rounded-full` -> Avatars, badges, nav pills

### Shadows

*   `shadow-sm`: Subtle separation
*   `shadow-md`: Default card elevation
*   `shadow-lg`: Hover states
*   `shadow-xl`: Modals, dropdowns
*   `shadow-glow`: Special effect `0 0 40px hsl(174 72% 40% / 0.3)`

---

## 2. Layout & Structure Rules

### Grid System
*   **Container:** `container mx-auto px-4` (Centers content with padding)
*   **Max Widths:** `2xl: 1400px` (Configured in tailwind theme)
*   **Columns:** Preference for `grid-cols-1 md:grid-cols-3` pattern (Mobile stack -> Tablet/Desktop 3-column)

### Page Density
*   **Compact:** Dashboard views (`py-6`)
*   **Relaxed:** Landing pages (`py-20` sections)

### Responsive Behavior
*   **Mobile First approach**
*   **Breakpoints:**
    *   `sm`: 640px
    *   [md](file:///C:/Users/leoge/.gemini/antigravity/brain/08f6a1a6-1367-45aa-b4a9-80c1d4cb8cf9/task.md): 768px (Tablet split)
    *   `lg`: 1024px (Sidebar visibility)
    *   `xl`: 1280px
    *   `2xl`: 1400px

---

## 3. Component Library (Exhaustive)

### Buttons ([Button](file:///c:/Users/leoge/OneDrive/Documents/AI%20Activity/antigravity/UI%20Designer/spot-funnel-v2/src/components/ui/button.tsx#37-42))

| Variant | Classes | Usage |
| :--- | :--- | :--- |
| **Default** | `bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg hover:-translate-y-0.5` | Primary actions |
| **Destructive** | `bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md` | Delete, disconnect |
| **Outline** | `border-2 border-primary text-primary bg-transparent hover:bg-primary hover:text-primary-foreground` | Secondary actions |
| **Secondary** | `bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm` | Low priority actions |
| **Ghost** | `hover:bg-accent hover:text-accent-foreground` | Icon buttons, navigation |
| **Link** | `text-primary underline-offset-4 hover:underline` | Inline links |

**Sizing:**
*   `default`: h-10 px-5 py-2
*   `sm`: h-9 rounded-md px-4
*   `lg`: h-12 rounded-lg px-8
*   `icon`: h-10 w-10

### Cards (`Card`)

**Structure:**
*   **Root:** `rounded-lg border bg-card text-card-foreground shadow-sm`
*   **Header:** `flex flex-col space-y-1.5 p-6`
*   **Title:** `text-2xl font-semibold leading-none tracking-tight`
*   **Content:** `p-6 pt-0`

**Motion Variant:** `.glow-card` adds a radial gradient hover effect.

### Inputs (`Input`)

**Styles:**
*   `flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base`
*   **Focus:** `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
*   **Placeholder:** `text-muted-foreground`
*   **Disabled:** `cursor-not-allowed opacity-50`

### Navigation

**Header:**
*   `sticky top-0 z-50`
*   `bg-card/80 backdrop-blur-xl`
*   `border-b border-border`

**Nav Pills:**
*   Active: `bg-white text-primary shadow-sm scale-105`
*   Inactive: `text-muted-foreground hover:text-foreground hover:bg-white/50`

### Badges / Status Indicators

*   **Success:** `bg-success/10 text-success` (Pill shape, 1px padding)
*   **Warning:** `bg-warning/10 text-warning`
*   **Neutral:** `bg-muted text-muted-foreground`

---

## 4. Interaction & Motion

### Transitions
*   **Standard:** `transition-all duration-200` (Used on buttons, inputs, links)
*   **Slow:** `duration-300` (Slower hover effects on cards)
*   **Float:** `animate-float` (3s ease-in-out infinite) - Hero elements

### Hover Effects
*   **Elevation:** `hover:shadow-lg`
*   **Lift:** `hover:-translate-y-0.5` or `hover:-translate-y-1` (Buttons, Cards)
*   **Scale:** `hover:scale-[1.02]` (Interactable cards)

### Animations (Keyframes)
*   `fade-in`: 0.5s ease-out
*   `slide-in-right`: 0.5s ease-out
*   `pulse`: 2s ease-in-out infinite

---

## 5. Accessibility & Contrast

*   **Focus Rings:** Always use `focus-visible:ring-2` with `ring-ring` (Teal) color.
*   **Text Contrast:**
    *   Primary text on light bg: `text-foreground` (Dark Slate)
    *   Muted text on light bg: `text-muted-foreground` (Slate Gray)
    *   Text on Primary color: Must use `text-primary-foreground` (White)
*   **Disabled States:** `opacity-50 pointer-events-none` (Visually distinct + non-interactive)

---

## 6. Implementation Notes

*   **Framework:** React + Tailwind CSS + Radix UI Primitives (via shadcn/ui).
*   **Styling Approach:** Utility-first (Tailwind). Do not write custom CSS unless absolutely necessary for complex animations.
*   **Composition:** Build layouts using standard Flexbox/Grid utilities.
*   **Consistency:** Always use `cn()` utility for class merging.
*   **Icons:** Lucide React icons. Standard size `w-4 h-4` or `w-5 h-5`.

**Naming Conventions:**
*   Files: PascalCase (e.g., [AdminDashboard.tsx](file:///c:/Users/leoge/OneDrive/Documents/AI%20Activity/antigravity/UI%20Designer/spot-funnel-v2/src/pages/AdminDashboard.tsx))
*   Components: PascalCase (e.g., [Button](file:///c:/Users/leoge/OneDrive/Documents/AI%20Activity/antigravity/UI%20Designer/spot-funnel-v2/src/components/ui/button.tsx#37-42))
*   Utilities: camelCase (e.g., `cn`, `formatDate`)

---

## STYLE GUIDE FOR AI IMPLEMENTATION

**Non-Negotiable Rules:**
1.  **NEVER** use hex codes directly in components. use `bg-primary`, `text-muted-foreground`, etc.
2.  **ALWAYS** use `Roobert` font family via standard class inheritance (body default).
3.  **ALWAYS** use the configured `rounded-lg`, `rounded-xl` utilities; do not use arbitrary values like `rounded-[14px]`.
4.  **ALWAYS** implement hover states for interactive elements (`hover:opacity-90` or `hover:bg-primary/90`).
5.  **ALWAYS** use the `glass` utility for backdrop blurs on sticky headers or overlays.

**Instruction to Builder:**

> "Build all new UI using these tokens and components only. Do not invent new styles. Adhere strictly to the spacing, color, and typography rules defined above. Use the `cn()` utility for class composition. When creating layouts, prioritize the `container mx-auto` pattern and standard grid gap values."
