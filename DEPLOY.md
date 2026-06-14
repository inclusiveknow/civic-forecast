# Deploying The Civic Forecast

Two parts:

1. **The static site** → Cloudflare Pages (the public website at `civicforecast.org`)
2. **The daily pipeline** → Cloudflare Worker (cron-triggered data ingestion + LLM-written sentence)

You can deploy them independently. The static site works on its own with the bundled `data/reading.json`; the Worker is what makes it self-update each morning.

---

## What auto-runs after you deploy (the short answer)

**Yes. Once Part B is deployed, the page updates itself every morning forever, without you doing anything.** Specifically:

- A Cloudflare cron fires three times each morning (08:00, 09:00, 10:00 UTC = 04:00, 05:00, 06:00 ET).
- The Worker pulls the six civic data sources + four news RSS feeds in parallel.
- If any single source fails, the Worker uses that source's last-known-good reading from KV — the page never blanks. You'll see the failure in `/health`.
- The Worker calls Claude Haiku to write the daily sentence + advisory under partisan-neutrality constraints. If the Claude call fails, a deterministic template fills in.
- Top 5 stories are picked from the news pool, classified to indicators, and ranked.
- The reading is written to KV, archived in R2, and served at `/api/today`.
- The static page fetches `/api/today` on every load — fresh data within 5 minutes of the morning publish.

**What you do need to do, periodically:**

- Renew API keys if a source rotates them (rare; Anthropic, ACLED, CourtListener).
- Watch `https://your-worker/health` — it shows last-success timestamp per source.
- Review the methodology page once a quarter. Anything that changed should be in the changelog.

**That's it.** The page is designed to be unattended infrastructure, not something that needs daily maintenance.

---

## Prerequisites

- A Cloudflare account (free tier is plenty for this scale)
- Node 18+ and npm (only used for `wrangler` CLI)
- Free API registrations (15 minutes total):
  - [CourtListener](https://www.courtlistener.com/help/api/rest/) — get a token
  - [ACLED](https://acleddata.com/access-acled-data/) — get a key + email
  - [ProPublica Congress](https://www.propublica.org/datastore/api/propublica-congress-api) — free key (or skip; the Worker uses GovTrack as fallback)
  - [Anthropic Console](https://console.anthropic.com/) — Claude API key for the daily sentence (Haiku — under $0.01/day)

(MuckRock, Federal Register, Press Freedom Tracker, NPR RSS, ProPublica RSS, and Google News RSS need no key.)

---

## Part A — Deploy the static site

The site is pure static HTML/CSS/JS. Three ways to deploy:

### Option 1: Drag-and-drop (fastest, 3 minutes)

1. Open the [Cloudflare Pages dashboard](https://dash.cloudflare.com/?to=/:account/pages).
2. Click **Create a project** → **Direct upload**.
3. Drag the entire `civic-forecast-deploy/` folder (or `public/` from the everything folder).
4. Name the project `civic-forecast` and create.

You're live at `https://civic-forecast.pages.dev`.

### Option 2: Git-connected (recommended for ongoing work)

```bash
git init && git add . && git commit -m "Initial: Civic Forecast v1"
gh repo create civicdesigners/civic-forecast --public --source=. --push

# In the Cloudflare Pages dashboard:
#   Create a project → Connect to Git → select civic-forecast
#   Build command: (none — it's static)
#   Build output directory: public
#   Save and deploy
```

### Option 3: Wrangler CLI

```bash
npm install
npx wrangler login
npm run deploy:pages
```

### Custom domain

In the Pages project settings → **Custom domains** → add `civicforecast.org` (or `forecast.civicdesigners.org`). Cloudflare handles the cert.

---

## Part B — Deploy the daily pipeline

### 1. Install wrangler

```bash
npm install
npx wrangler login
```

### 2. Create the KV namespace

```bash
npm run kv:create
# → outputs an id like:  id = "a1b2c3d4..."
```

Copy that id into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "READINGS"
id = "a1b2c3d4..."   # ← paste here
```

### 3. Create the R2 archive bucket

```bash
npm run r2:create
```

### 4. Set the API secrets

```bash
npx wrangler secret put COURTLISTENER   # CourtListener token
npx wrangler secret put ACLED           # ACLED key
npx wrangler secret put PROPUBLICA      # ProPublica key (optional)
npx wrangler secret put ANTHROPIC       # Anthropic API key
```

### 5. Deploy the Worker

```bash
npm run deploy:worker
```

The Worker now runs on cron every morning. **You're done.**

### 6. Verify it works

```bash
# Trigger immediately so you don't have to wait until tomorrow morning:
curl -X POST https://civic-forecast.<your-account>.workers.dev/run

# See today's reading:
curl https://civic-forecast.<your-account>.workers.dev/today | jq

# Check per-source health:
curl https://civic-forecast.<your-account>.workers.dev/health | jq
```

`/health` returns something like:

```json
{
  "ok": true,
  "last_publish": "2026-05-01T10:00:14.221Z",
  "sources": {
    "press":    { "last_success": "2026-05-01T10:00:08.012Z", "last_error": null },
    "courts":   { "last_success": "2026-05-01T10:00:09.554Z", "last_error": null },
    "sunlight": { "last_success": "2026-05-01T10:00:08.998Z", "last_error": null },
    "chamber":  { "last_success": "2026-05-01T10:00:09.211Z", "last_error": null },
    "streets":  { "last_success": "2026-05-01T10:00:10.401Z", "last_error": null },
    "record":   { "last_success": "2026-05-01T10:00:09.882Z", "last_error": null },
    "news":     { "last_success": "2026-05-01T10:00:11.119Z", "last_error": null }
  }
}
```

If a source has a `last_error`, the page is still working — that source is using its last-known-good reading from KV. Look at the error message and decide whether you need to do anything (often: nothing, the source had a transient outage).

### 7. Wire the static site to the live data

**No code edit needed.** The page already fetches `/api/today` first on every load and falls back to the bundled `data/reading.json` if that route isn't reachable yet (see `public/scripts/data.js` → `DATA.sources()`). So once the Worker route is live, the page upgrades itself automatically.

All you do is make `/api/today` resolve from the site's own origin. The route `civicforecast.org/api/*` → Worker is already configured in `wrangler.toml`; just make sure your Pages site is served from the same domain (`civicforecast.org`). Then `/api/today` is same-origin and the Content-Security-Policy in `public/_headers` (`connect-src 'self' … https://civicforecast.org`) already allows it.

**Testing before a custom domain is set** (e.g. against `civic-forecast.<account>.workers.dev`): the Worker is a different origin, so two things apply — set `window.CF_API = 'https://civic-forecast.<account>.workers.dev/today'` (e.g. in the browser console or a tiny inline script), and add that origin to `connect-src` in `public/_headers`, or the browser's CSP will block the cross-origin fetch. On the final same-origin custom-domain setup, neither is needed.

---

## What lives where

| Thing | Where it runs | What happens if it fails |
|---|---|---|
| The static page | Cloudflare Pages CDN | Serves the bundled `data/reading.json` (last shipped) |
| `/api/today` | Cloudflare Worker | Page falls back to bundled JSON |
| Daily cron | Cloudflare Workers Cron | Next day's cron retries automatically |
| Six API pulls | Inside Worker (parallel) | That source uses last-known-good from KV |
| News RSS pull | Inside Worker (parallel) | Top stories use last-known-good from KV |
| Daily sentence (Claude) | Inside Worker | Falls back to deterministic template |
| Archive snapshot | R2 bucket | Logged to console; non-fatal |

---

## Local development

```bash
# Static site
cd public && python -m http.server 8970
# → open http://localhost:8970

# Worker (with mock data — no API keys needed)
npx wrangler dev workers/pipeline/index.ts

# Trigger the scheduled handler locally:
npx wrangler dev workers/pipeline/index.ts --test-scheduled
# Then in another terminal:
curl http://localhost:8787/__scheduled
```

---

## Cost estimate

- **Pages**: free (well under the 100k requests/day free tier)
- **Worker**: free (well under the 100k requests/day free tier)
- **KV**: free (a few writes/day)
- **R2**: free (one tiny JSON/day; well under the 10GB free tier)
- **Anthropic**: ~$0.01/day for the sentence + advisory using Haiku

**Total: under $4/year if you stay on Cloudflare's free tier.** This is a deliberate design choice — the pledge in the footer ("free, forever") needs to be financially sustainable.
