# Project Singularity

Focus timer, mock-test tracker and study log for competitive exam prep.

## Run it locally

Requires Node 18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Edits reload instantly.

```bash
npm run build      # production build into dist/
npm run preview    # serve that build locally
```

## Push it to GitHub

```bash
git init
git add .
git commit -m "Project Singularity"
git branch -M main
git remote add origin https://github.com/<you>/project-singularity.git
git push -u origin main
```

Then either:

- **Cloudflare Pages** — connect the repo, build command `npm run build`, output `dist`.
- **GitHub Pages** — Settings → Pages → Source: GitHub Actions. The included
  workflow builds and deploys on every push to `main`. For a project page
  (`you.github.io/project-singularity`), set `base: "/project-singularity/"`
  in `vite.config.js`.

## Layout

```
index.html            markup for all seven tabs
src/main.js           entry: styles, boot, service worker
src/app.js            application logic
src/data/             seed mocks and videos, applied on first run only
src/sync/supabase.js  optional cross-device sync
src/styles/           base, scene, components, features
supabase/schema.sql   table and row-level security policies
public/               manifest, icon, service worker, fonts
```

## Storage

By default everything lives in the browser: IndexedDB, with localStorage as a
fallback. Nothing leaves the device, and the app works offline.

This is not permanent. iOS Safari clears site data after about a week without a
visit, and it never syncs between devices. Use the Backup tab, or turn on sync.

## Optional sync

1. Create a project at supabase.com (free tier).
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key.

Row-level security means each row is readable only by the user who owns it. The
anon key is safe in client code; it grants nothing on its own.

Without a `.env` the sync module reports `syncEnabled === false` and the app runs
entirely locally.

## Custom fonts

Drop a webfont at `public/fonts/abolda.woff2`. The stack falls back to Melodrama,
then Gabarito, if it is absent.

## Roadmap

- Split `src/app.js` into per-feature modules, with tests first.
- Android build via Capacitor once sync is in place.
- Assistant endpoint holding an API key server-side.
