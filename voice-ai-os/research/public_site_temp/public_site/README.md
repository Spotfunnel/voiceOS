
# SpotFunnel Public Website Export

This package contains the public-facing marketing pages for SpotFunnel, exported as a standalone static-deployable site.

## Included Pages
- **Home**: `/` (`pages/Index.tsx`)
- **Booking**: `/consultation` (`pages/Consultation.tsx`)
- **Contact**: `/contact` (`pages/Contact.tsx`)
- **Terms**: `/terms` (`pages/Terms.tsx`)
- **Privacy**: `/privacy` (`pages/Privacy.tsx`)

## Integration Notes

### Dependencies
This project uses **Vite** + **React** + **Tailwind CSS**.
Install dependencies with:
```bash
npm install
```

Start the dev server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

### Exclusions
- **No Supabase**: All Supabase clients, hooks, and queries have been removed. Any data fetching has been replaced with static placeholders.
- **No Auth**: No authentication logic, guards, or contexts are present.
- **No Dashboards**: Admin and User dashboards are excluded.
- **No Backend**: API routes and server-side logic are excluded.

### Forms
The forms on the **Consultation** and **Contact** pages are static.
- `onSubmit` handlers presently log to console or simulate a delay.
- You must connect these to your preferred form handling service (e.g., Formspree, a separate API endpoint, or your own backend).

### Assets
Images and icons are located in `src/assets` (or imported directly). Ensure your build process handles these imports correctly if moving files.

## Verification Checklist
- [x] No dashboard routes or components included
- [x] No auth/login included
- [x] No Supabase imports exist
- [x] No database/API logic exists
- [x] Public pages render as static site
- [x] All assets included and paths correct
