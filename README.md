# Project Singularity

A calm, single-page study companion for Indian competitive-exam prep — a focus
timer, a mock-test tracker, and a study log, all in one offline-first web app.
No accounts required to start, no data leaves your device unless you turn on
sync. Built in plain JavaScript, no framework.

## What's inside

Seven tabs, one workspace:

- **Timer** — a Pomodoro-style focus/break timer with a configurable focus
  length and a liquid-blob dial. Time is banked against the subject you pick
  (the active exam's sections, plus General), so study time is tracked by topic.
  The scene shifts through dawn → day → sunset → night automatically (tap to
  override). Alongside it: synthesized ambient soundscapes (rain, ocean, fire,
  wind, cafe, deep), a music dock for a Spotify or YouTube playlist, a daily
  water tracker, and today/week/streak stats. Press **Space** to start or pause.
- **Mocks** — track several exams, each with its own sections and marking
  scheme. Start from a preset (SSC CGL/CHSL, UPSC Prelims & CSAT, CAT, RRB
  NTPC/Group D, Bank) or build a custom one. Log full-length or sectional
  attempts with right/wrong/skipped steppers and automatic negative marking, and
  smart name suggestions (log "Blitz 19" and it offers "Blitz 20" next time).
- **Analytics** — best / average / recent / accuracy tiles, per-section cards
  that flag your weakest section as **FIX FIRST**, and a score-trend chart (whole
  test or per-section) with a 5-mock moving average and hover details. Below it,
  a study log: a 7-day bar chart, subject splits, and a GitHub-style yearly
  heatmap with a monthly focus/break breakdown.
- **Watch** — save YouTube links; thumbnails expand into an inline, cookie-free
  player.
- **Exams applied** — a pipeline tracker (Applied → Admit card → Scheduled →
  Done → Result awaited → Result out / Next stage / Not cleared) with exam and
  result dates, marks, and notes, sorted by how soon each exam is. Feeds the
  notification bell (exam soon, admit card due, result date passed, no mock
  logged lately, no focus yet today).
- **Notes** — quick notes with autosave.
- **Backup** — export mocks and study time as CSV, export/restore everything as
  JSON, and set up cross-device sync (below).

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

## Storage

By default everything lives in the browser — IndexedDB, with localStorage as a
fallback. Nothing leaves the device and the app works offline. On first run it
seeds a sample exam and mock history; after that it only ever reads your data.

This isn't permanent: iOS Safari clears site data after about a week without a
visit, and browser storage never moves between devices. So either export a
backup from the Backup tab, or turn on sync.

## Cross-device sync

Optional, and off until you configure it. When on, it's wired into the **Backup →
Sync** section and the account button in the header:

- Passwordless **email sign-in** (a one-time magic link).
- Manual **Push** and **Pull** — nothing syncs automatically. Push checks whether
  the cloud copy changed on another device first and asks before overwriting;
  Pull confirms before replacing local data. Last-write-wins, with a **last
  synced** time shown.

To enable it:

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Run `supabase/schema.sql` in the SQL editor (creates `app_state` with
   per-user row-level security).
3. Copy `.env.example` to `.env` and fill in the project URL and anon key.

Row-level security means each row is readable only by its owner. The anon key is
safe in client code — it grants nothing on its own. Without a `.env`, the sync
module reports `syncEnabled === false` and the app runs entirely locally.

## Deploy

Push to GitHub, then connect the repo to **Cloudflare Pages** — build command
`npm run build`, output directory `dist`. It deploys straight from the repo on
the free tier (public or private), which is why there's no GitHub Pages workflow.

## Tech

Vanilla JavaScript (no framework), bundled with **Vite**. Local data in
**IndexedDB** (localStorage fallback). Optional sync via **Supabase** (auth +
Postgres). Notifications and the exam feed are planned on **Cloudflare Workers**.

```
index.html            markup for all seven tabs + the timer scene SVG
src/main.js           entry: styles, boot, service worker
src/app.js            application logic
src/data/             seed mocks and videos, applied on first run only
src/sync/supabase.js  cross-device sync client
src/styles/           base, scene, components, features
supabase/schema.sql   table and row-level security policies
public/               manifest, icon, service worker, fonts
```

## Custom fonts

Drop a webfont at `public/fonts/abolda.woff2`. The stack falls back to Melodrama,
then Gabarito, if it's absent.

## Roadmap

- **Exam-notification feed** — a Cloudflare Worker on a schedule pulls the
  official SarkariResult RSS into the app, so new postings show up without
  visiting the site.
- **Push notifications** — real web push (service worker + Cloudflare Worker) so
  "exam in 3 days" reaches you even with the app closed.
- **Refactor** — split `src/app.js` into per-feature modules.
- Android build via Capacitor once sync has settled.
