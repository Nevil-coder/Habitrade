# Habitrade

A frontend-only habit tracker built with React, Vite, Motion, Recharts and LocalStorage.

## Requirements
- Node.js 20.19+ or 22.12+
- npm

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

## Production build
```bash
npm run build
npm run preview
```
The production output is written to `dist/`.

## Deploy to Cloudflare Pages (Git integration)
1. Push this project to a GitHub repository.
2. Sign in to the Cloudflare dashboard.
3. Open **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
4. Authorize GitHub and select the Habitrade repository.
5. Set the framework preset to **Vite**.
6. Set **Build command** to `npm run build`.
7. Set **Build output directory** to `dist`.
8. Leave the root directory as `/` (unless you put the app in a subfolder).
9. Click **Save and Deploy**.
10. Cloudflare will provide a `*.pages.dev` URL. Future pushes to the production branch trigger new deployments.

## Deploy by direct upload
1. Run `npm install` and `npm run build` locally.
2. In Cloudflare, go to **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
3. Give the project a name such as `habitrade`.
4. Upload the contents of the `dist` folder (not the project source folder).
5. Deploy and open the generated `*.pages.dev` URL.

## Notes
- This app has no backend, account system or cloud database.
- Habits are stored in the current browser's LocalStorage. They do not sync across browsers/devices.
- Use Settings → Export backup to save a JSON backup. Import it on the same or another browser to restore.
- Browser reminders are best-effort and require notification permission. They cannot run reliably when the browser is fully closed.
- If you use a custom domain, add it from the Pages project → Custom domains.
# Habitrade
