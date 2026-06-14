# The Civic Forecast

A daily forecast for civic life in the United States. Treats democracy like weather. Pulls real-time data from six independent civic-monitoring sources every morning, runs them through documented thresholds, and publishes a single page showing what the day's conditions look like.

> Not a dashboard. Not analytics. A forecast — designed to be checked the way you check the weather before leaving the house.

## What's in this repo

```
civic-forecast/
├── public/                   # The static site (deploy this to Cloudflare Pages)
│   ├── index.html            # The forecast page
│   ├── methodology.html      # Open methodology — required, non-optional
│   ├── styles/               # CSS — atmospheric design, mobile-first
│   ├── scripts/              # i18n, data, map (D3), app
│   ├── data/reading.json     # Today's reading (regenerated daily by the Worker)
│   ├── _headers              # Cloudflare edge headers (CSP, caching)
│   └── _redirects            # Pages redirects
├── workers/
│   └── pipeline/             # Cloudflare Worker — daily data pipeline
│       ├── index.ts          # Cron-triggered orchestration
│       ├── sources/          # One file per data source
│       ├── compute/          # Status, geography, sentence, advisory
│       └── publish/          # Write to KV + R2 archive
├── docs/                     # Architecture & indicator notes
├── wrangler.toml             # Cloudflare config
└── package.json
```

## Quick start (local)

```bash
# Serve the static site (Python)
cd public
python -m http.server 8970

# Open http://localhost:8970
```

That's it for the frontend. The page renders from `public/data/reading.json`, which ships with a real-shaped sample so you see the full UI immediately.

## Deploy to Cloudflare

See [DEPLOY.md](DEPLOY.md) for the full walkthrough. Quick version:

```bash
# 1. One-time: install wrangler, log in, create infra
npm install
npx wrangler login
npm run kv:create     # creates KV namespace, copy the id into wrangler.toml
npm run r2:create     # creates R2 archive bucket
npm run secrets:set   # sets PROPUBLICA, COURTLISTENER, ACLED, ANTHROPIC

# 2. Deploy
npm run deploy:pages  # static site → civic-forecast.pages.dev
npm run deploy:worker # daily pipeline → cron + /api routes
```

## Languages

The page ships in 8 languages plus a "kid mode" plain-English register. Toggle with the language picker in the top-left, or via Kid Mode button below the advisory.

| Code | Language | Notes |
|------|----------|-------|
| `en` | English | Default |
| `kid` | Plain English (~age 8) | Translates jargon: *opaque* → *hidden*, *unsettled* → *wobbly* |
| `es` | Español | |
| `zh` | 中文 | |
| `fr` | Français | |
| `pt` | Português | |
| `vi` | Tiếng Việt | |
| `ar` | العربية | RTL — full layout flip |

Adding a language: drop a dictionary into `public/scripts/i18n.js → DICT` and add the entry to `LANGS`. Two-line change.

## What it is not

- **Not partisan.** Same vocabulary applies regardless of who is in power.
- **Not opinion.** The page reports conditions; it does not interpret.
- **Not a dashboard for analysts.** This is for ordinary people who want to glance at the country once a day.
- **Not a news site.** One page. One reading. Updated at dawn.

## License

Apache 2.0. A project of [Civic Designers](https://civicdesigners.org), a 501(c)(3).

## Credits

Every reading on this site is computed from the work of organizations whose data feeds it: U.S. Press Freedom Tracker, Free Law Project / CourtListener, MuckRock, ProPublica, GovTrack, ACLED, and the Federal Register. None of them endorse the Civic Forecast; their work simply makes it possible.
