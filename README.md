# The Civic Forecast

**Your local civic weather.** Put in a ZIP and see what's coming where you live: when and how to vote, what's on your ballot, what rent, groceries, gas, electricity and jobs are doing, live weather alerts, disaster declarations and air quality, and the dates that touch most households (Medicare and HealthCare.gov enrollment, Social Security changes, tax deadlines, holidays).

Live at **https://civic-forecast.pages.dev**. A project of Accelerant.

## What's on the page

- **Hero:** days until Election Day (after the election, the next big civic date) and what's true in your state today.
- **Alerts:** like severe-weather warnings, most urgent first. Voting deadlines from your state's rules, National Weather Service warnings at your exact location, FEMA disaster declarations covering your county, and unhealthy air.
- **Your next 14 days:** a day-by-day strip of what opens, closes and changes. Tap a day for details and sources.
- **On your ballot / How to vote here:** statewide races, a link to [Same Question](https://same-question.spokenknowledge.workers.dev/) where a race has real debate answers, and your state's rules in plain language with the official source.
- **Life where you live:** rent (ZIP, county or state), regional grocery, gas and electricity prices vs a year ago, state unemployment, live air quality.
- **The civic weather map:** states colored by how people can vote today, where you can still register, rent change, and unemployment. Every layer has a list view.
- **The regular weather,** small, in the corner.

Built to live on a phone like the weather app:

- **Installs to the home screen** (PNG icons + manifest; Android gets an install button, iPhone gets the two-tap instructions) and works offline.
- **Your places:** save home, family, school. Swipe the forecast to move between them, or open the list to see each place's condition at a glance.
- **Your voting plan:** early, by mail, or on Election Day, with your exact steps and dates. Then **I voted** draws a shareable sticker (state + year, never a choice).
- **Calendar reminders instead of push notifications:** a standard `.ics` file with your dates and a reminder the evening before, so your phone does the reminding and nothing is stored on a server.
- **A living sky** that matches the day's civic condition, and the forecast brings itself up to date when you open it the next morning.

No accounts, no ads, no analytics. The ZIP stays in the visitor's browser. The page never says who to vote for.

## How it's built

A static site in `public/` (plain HTML/CSS/JS, d3 for the map). No build step, no server.

| File | What it does |
|---|---|
| `public/scripts/civic.js` | The logic: what's true in a state on a given day, alerts, the 14-day forecast. Pure functions. Add `?date=2026-11-03` to the URL to see any day. |
| `public/scripts/live.js` | Free public lookups called from the browser: Zippopotam.us (ZIP), FCC (county), Open-Meteo (weather, air), NWS (alerts), OpenFEMA (declarations). Each times out and degrades quietly. |
| `public/scripts/map.js` | The four-layer map. Palettes are validated for colorblind readers. |
| `public/scripts/plan.js` | Voting plan, calendar (.ics) export, and the "I voted" sticker. |
| `public/scripts/sky.js` | The living sky (pauses in the background, still for reduced motion). |
| `public/scripts/app.js` | Rendering, saved places, sheets, install, and interaction. |
| `public/data/civic.json` | Voting rules for 50 states + D.C., the civic calendar, ballot races, Same Question links. |
| `public/data/rent.json` | Zillow Observed Rent Index by ZIP, county and state. |
| `public/data/econ.json` | BLS unemployment by state; grocery, gas and electricity prices by region. |

## Keeping it current

- **Rent, prices, jobs:** `.github/workflows/refresh-data.yml` rebuilds them on the 22nd of each month and commits, and Pages redeploys. Run it by hand from the Actions tab any time. (Optional: add a free BLS key as the secret `BLS_KEY`.)
- **Voting rules:** researched from each state's election office into `data/research/voting_*.json`, then merged and validated with `python tools/build_civic.py <path-to-same-question/data/races.json>`. The build refuses malformed dates or windows that end before they start. Rules can change late (courts), so re-check before Election Day.
- **Calendar and ballot races:** `data/research/calendar_ballot.json`, sourced from the agencies that run each program.
- **Share card and app icons:** `python tools/make_og_image.py` and `python tools/make_icons.py` regenerate `public/og-image.png` and `public/icons/`.

By hand:

```bash
python tools/build_rent.py Zip_zori.csv County_zori.csv
python tools/build_econ.py
python tools/build_civic.py ../same-question/data/races.json
```

## Local preview

```bash
python -m http.server 8975 -d public
```

## Sources

State election offices · senate.gov · Same Question · Zillow Research · U.S. Bureau of Labor Statistics · National Weather Service · OpenFEMA · Open-Meteo · FCC Area API · Zippopotam.us · Medicare.gov · HealthCare.gov / CMS · Social Security Administration · IRS · OPM. Details in `public/methodology.html`.

## License

Apache 2.0. A project of Accelerant.
