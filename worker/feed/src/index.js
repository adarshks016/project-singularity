/**
 * Exam-notification feed for Project Singularity.
 *
 * The browser can't read sarkariresult.com directly (CORS), so this Worker
 * fetches the site's official RSS server-side on a schedule, parses the latest
 * postings, and caches them in KV. The app reads the cached JSON from `fetch`.
 *
 * Endpoints:
 *   GET /          -> cached postings as JSON (what the app calls)
 *   GET /refresh   -> force a re-fetch now (handy for testing)
 * Cron: pulls the feed every few hours (see wrangler.toml).
 */
const SOURCE = "https://www.sarkariresult.com/feed_rss.xml";
const KEY = "latest";
const UA =
  "ProjectSingularityFeed/1.0 (+https://github.com/adarshks016/project-singularity)";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300",
};

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refresh(env));
  },

  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    if (url.pathname === "/refresh") {
      const items = await refresh(env);
      return json({ refreshed: items.length });
    }

    let cached = await env.FEED.get(KEY);
    if (!cached) {
      // Cold start: nothing cached yet, so fetch once on demand.
      const items = await refresh(env);
      cached = JSON.stringify(items);
    }
    return new Response(cached, { headers: CORS });
  },
};

async function refresh(env) {
  const res = await fetch(SOURCE, {
    headers: {
      "user-agent": UA,
      accept: "application/rss+xml, application/xml, text/xml",
    },
    cf: { cacheTtl: 300 },
  });
  if (!res.ok) throw new Error("source responded " + res.status);
  const items = parseRss(await res.text());
  if (items.length) await env.FEED.put(KEY, JSON.stringify(items));
  return items;
}

/** Minimal RSS 2.0 item extractor — the source feed is well-formed. */
function parseRss(xml) {
  const out = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/item>/i)[0];
    const title = pick(block, "title");
    const link = pick(block, "link");
    if (!title || !link) continue;
    const date = pick(block, "pubDate");
    out.push({
      title,
      link,
      date: date && !isNaN(Date.parse(date)) ? new Date(date).toISOString() : "",
      category: pick(block, "category"),
      source: "SarkariResult",
    });
  }
  return out.slice(0, 30);
}

function pick(block, tag) {
  const m = block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", "i"));
  if (!m) return "";
  return decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
}

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function json(obj) {
  return new Response(JSON.stringify(obj), { headers: CORS });
}
