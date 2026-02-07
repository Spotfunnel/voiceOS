 # Hosting Rewrite Guidance
 
 This repo uses two apps:
 
 - `apps/public-site` (Vite marketing site)
 - `apps/web` (Next.js dashboards)
 
 Single-domain routing requirements:
 
 - `/admin/*` and `/dashboard/*` → Next.js app
 - Everything else → Vite app
 
 ## Vercel (current)
 
 `vercel.json` already routes:
 
 - `/dashboard(.*)` → `apps/web`
 - `/admin(.*)` → `apps/web`
 - `/(.*)` → `apps/public-site`
 
 ## Cloudflare Pages
 
 Use a `_routes.json` at the root:
 
 ```
 {
   "version": 1,
   "include": [
     "/admin/*",
     "/dashboard/*"
   ],
   "exclude": [
     "/*"
   ]
 }
 ```
 
 Deploy `apps/web` to a separate Pages project and route `admin`/`dashboard` via Cloudflare Workers or Pages functions.
 
 ## Nginx
 
 ```
 location /admin/ {
   proxy_pass http://next-app;
 }
 
 location /dashboard/ {
   proxy_pass http://next-app;
 }
 
 location / {
   proxy_pass http://public-site;
 }
 ```
