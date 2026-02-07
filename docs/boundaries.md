 # Boundary Rules
 
 ## Ownership
 
 - `apps/public-site/` is **Antigravity vendor output** (Vite). Update only by re-importing the ZIP.
 - `apps/web/` is **Cursor-owned** (Next.js dashboards).
 - `vendor/antigravity/` stores **raw ZIP exports** (versioned, never edited).
 
 ## Allowed Imports
 
 - `apps/public-site/` must not import anything from `apps/web/`.
 - `apps/web/` must not import anything from `apps/public-site/`.
 - Vendor files under `vendor/antigravity/` are read-only and never imported at runtime.
 
 ## Prohibited in Public Site
 
 - Supabase imports (`@supabase/*` or `supabase`)
 - Auth/session logic
 - Database/ORM clients (`pg`, `prisma`, `typeorm`)
 - Dashboard/admin code
 
 ## Update Procedures
 
 ### Public Site
 1. Drop new Antigravity ZIP into `vendor/antigravity/public-site/<version>/`.
 2. Unzip into `apps/public-site/` (replace contents).
 3. Run `npm run lint:boundaries` from repo root.
 4. Verify routes: `/`, `/consultation`, `/contact`, `/terms`, `/privacy`.
 
 ### Dashboard UI
 1. Drop new Antigravity ZIP into `vendor/antigravity/dashboards/<version>/`.
 2. Extract UI kit to `apps/web/src/shared_ui/`.
 3. Extract page shells to `apps/web/src/admin_control_panel/` and `apps/web/src/customer_dashboard/`.
 4. Confirm `/admin/*` and `/dashboard/*` routes render the imported shells.
