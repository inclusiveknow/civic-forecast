# Deploying The Civic Forecast

v2 is a plain static site. There is nothing to build and no server to run.

## Cloudflare Pages (already set up)

The Pages project `civic-forecast` is connected to this GitHub repo.

- **Build command:** none
- **Build output directory:** `public`
- **Production branch:** `main`. Every push to `main` deploys to https://civic-forecast.pages.dev.
- **Other branches** get their own preview URL, e.g. the `v2` branch at `https://v2.civic-forecast.pages.dev`.

`public/_headers` sets the security policy. If you add a new live data source the page calls from the browser, add its origin to `connect-src` there, or the browser will block it.

## Keeping the data current

The monthly numbers (rent, prices, jobs) refresh themselves through the GitHub Action in `.github/workflows/refresh-data.yml`. Nothing to do. To refresh by hand, open the repo's **Actions** tab, pick **Refresh monthly data**, and click **Run workflow**.

Voting rules and the civic calendar are researched data in `data/research/`. After editing them, rebuild and push:

```bash
python tools/build_civic.py "C:/Users/spoke/ovu audio/same-question/data/races.json"
git add public/data/civic.json data/research
git commit -m "Update voting rules"
git push
```

## Custom domain (later)

When you own `civicforecast.org` (or another domain): Pages project, **Custom domains**, add it, and Cloudflare handles the certificate. Then swap `civic-forecast.pages.dev` for the new domain in `public/index.html` (canonical, og:url, og:image), `public/sitemap.xml`, `public/robots.txt`, `public/embed.html`, and `tools/make_og_image.py` (then re-run it).

## The v1 Worker

The original daily pipeline (`workers/pipeline/`, deployed as `civic-forecast.spokenknowledge.workers.dev`) powered v1's six national indicators. v2 doesn't use it. It's harmless to leave running. To retire it, run `npx wrangler delete civic-forecast` from this folder (and optionally delete the `READINGS` KV namespace and `civic-forecast-archive` R2 bucket in the Cloudflare dashboard).
