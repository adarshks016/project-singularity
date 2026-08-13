# Exam-notification feed worker

A Cloudflare Worker that fetches the official [SarkariResult](https://www.sarkariresult.com)
RSS feed server-side (the browser can't, because of CORS), caches the latest
postings in KV, and serves them as JSON for the app to read.

## Deploy

From this directory (`worker/feed/`):

```bash
npx wrangler login
```

Create the KV namespace and copy the printed `id` into `wrangler.toml`
(replacing `REPLACE_WITH_KV_NAMESPACE_ID`):

```bash
npx wrangler kv namespace create FEED
```

Deploy:

```bash
npx wrangler deploy
```

Wrangler prints the Worker URL (e.g. `https://singularity-exam-feed.<you>.workers.dev`).
Put it in the app's `.env` and rebuild:

```
VITE_FEED_URL=https://singularity-exam-feed.<you>.workers.dev
```

## Endpoints

- `GET /` — cached postings as JSON (what the app calls).
- `GET /refresh` — force a re-fetch immediately (useful right after deploy, since
  the cron hasn't run yet).

## Notes

- The cron runs every 3 hours (`wrangler.toml` → `[triggers]`). The source feed
  returns only the latest ~10 items, so the cache holds the most recent postings.
- Be a polite consumer: this is a modest schedule against a feed the site
  publishes for consumption. Check the site's Terms of Use before going live.
- The RSS parser is deliberately minimal — it suits this well-formed feed. If the
  source changes shape, adjust `parseRss` in `src/index.js`.
