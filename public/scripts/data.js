/* =====================================================================
   THE CIVIC FORECAST — data layer
   In v1 the page is hydrated from /data/reading.json (written daily by
   the Cloudflare Worker pipeline). If that fetch fails, we fall back to
   the inline DEFAULT_READING below so the page always renders.
   ===================================================================== */

const DEFAULT_READING = {
  date: null, // filled in at runtime
  generated_at: null,
  feeling: 'overcast',           // clear | mild | overcast | warning | storm | severe
  cpi: 62,                       // Civic Pressure Index 0-100
  reading_sentence_key: 'reading_sentence', // i18n key OR inline string
  signal: 'pressure_building',
  six_days: [
    { date: 'fri', feeling: 'clear' },
    { date: 'sat', feeling: 'clear' },
    { date: 'sun', feeling: 'overcast' },
    { date: 'mon', feeling: 'storm' },
    { date: 'tue', feeling: 'overcast' },
    { date: 'wed', feeling: 'overcast' },
    { date: 'thu', feeling: 'overcast', today: true },
  ],
  indicators: [
    {
      id: 'press',
      status: 'elevated',         // status word — i18n'd via status_<key>
      tone: 'warning',            // color tone
      count_today: 14,
      count_week: 14,
      count_avg_90: 8,
      trend_dir: 'up',
      trend_n: 6,
      sparkline: [4, 5, 7, 6, 9, 11, 14],
      source: 'u.s. press freedom tracker',
      source_url: 'https://pressfreedomtracker.us/',
      events: [
        { time: '14:22', text: 'Two journalists detained while covering protest in Atlanta, GA.' },
        { time: '11:08', text: 'Equipment seized from photographer at federal courthouse, Tampa.' },
        { time: '08:45', text: 'Press credentials denied at executive briefing for nine outlets.' },
        { time: 'yest.',  text: 'Eleven reporters arrested in single overnight action, Tallahassee.' },
      ],
      // Atmospheric region this indicator paints onto the map.
      // {center: [lon, lat], radius_px, intensity_0_1}
      regions: [
        { center: [-83.5, 32.5], r: 110, i: 0.85 }, // Southeast
        { center: [-82.4, 28.0], r: 70, i: 0.65 },  // FL
      ],
    },
    {
      id: 'courts',
      status: 'unsettled',
      tone: 'watch',
      count_today: 23,
      count_week: 23,
      count_avg_90: 22,
      trend_dir: 'flat',
      trend_n: 0,
      sparkline: [20, 22, 21, 23, 24, 22, 23],
      source: 'courtlistener · free law project',
      source_url: 'https://www.courtlistener.com/',
      events: [
        { time: '15:30', text: '5th Circuit upholds voter ID requirements (3-2). Civil-rights coalitions appealing.' },
        { time: '12:14', text: '9th Circuit blocks executive order on asylum processing pending review.' },
        { time: '09:50', text: 'D.C. District grants press access to immigration hearings (1st Amendment).' },
      ],
      regions: [
        { center: [-95.0, 39.0], r: 90, i: 0.55 }, // Center
      ],
    },
    {
      id: 'sunlight',
      status: 'opaque',
      tone: 'warning',
      count_today: 61,
      count_week: 61,
      count_avg_90: 54,
      unit: '%',
      trend_dir: 'up',
      trend_n: 4,
      sparkline: [52, 54, 56, 58, 57, 60, 61],
      source: 'muckrock',
      source_url: 'https://www.muckrock.com/',
      events: [
        { time: 'today', text: 'DOJ rejected 14 of 18 FOIA requests filed in past 30 days as "national security."' },
        { time: 'wed',   text: 'EPA backlog now exceeds statutory 20-day window on 213 active requests.' },
        { time: 'tue',   text: 'DHS redirected 9 inquiries to ICE FOIA office; ICE has 14-month median response.' },
      ],
      regions: [
        { center: [-77.0, 38.9], r: 80, i: 0.7 },  // DC
      ],
    },
    {
      id: 'chamber',
      status: 'in_session',
      tone: 'mild',
      count_today: 4,
      count_week: 4,
      count_avg_90: 3,
      unit: 'days',
      trend_dir: 'flat',
      trend_n: 0,
      sparkline: [3, 4, 4, 3, 5, 4, 4],
      source: 'propublica congress · govtrack',
      source_url: 'https://projects.propublica.org/api-docs/congress-api/',
      events: [
        { time: 'today', text: '42 roll-call votes this week. 28 along party lines, 14 bipartisan.' },
        { time: 'wed',   text: 'House passed appropriations continuing resolution 218-211.' },
        { time: 'tue',   text: 'Senate cloture motion on judicial nominees: 51-48.' },
      ],
      regions: [
        { center: [-77.0, 38.9], r: 50, i: 0.4 },
      ],
    },
    {
      id: 'streets',
      status: 'active',
      tone: 'watch',
      count_today: 147,
      count_week: 147,
      count_avg_90: 125,
      unit: 'events',
      trend_dir: 'up',
      trend_n: 22,
      sparkline: [110, 115, 120, 130, 135, 140, 147],
      source: 'acled',
      source_url: 'https://acleddata.com/',
      events: [
        { time: 'today', text: 'Protests in 41 cities. Largest gathered ~30,000 in Minneapolis-St. Paul.' },
        { time: 'wed',   text: 'Use-of-force incidents reported in 4 cities (Tampa, Phoenix, Portland, NYC).' },
        { time: 'mon',   text: 'Largest single-day mobilization since previous summer.' },
      ],
      regions: [
        { center: [-93.2, 44.9], r: 70, i: 0.6 },  // Twin Cities
        { center: [-122.6, 45.5], r: 55, i: 0.5 }, // Portland
        { center: [-74.0, 40.7], r: 60, i: 0.55 }, // NYC
      ],
    },
    {
      id: 'record',
      status: 'accelerating',
      tone: 'watch',
      count_today: 38,
      count_week: 38,
      count_avg_90: 27,
      unit: 'actions',
      trend_dir: 'up',
      trend_n: 11,
      sparkline: [22, 24, 26, 28, 30, 35, 38],
      source: 'federal register',
      source_url: 'https://www.federalregister.gov/',
      events: [
        { time: 'today', text: '26 new rules issued. 9 comment periods opened. 3 executive actions.' },
        { time: 'wed',   text: 'Notable: HHS rule on data-sharing comment window closes Friday.' },
        { time: 'tue',   text: '2 presidential proclamations issued.' },
      ],
      regions: [
        { center: [-77.0, 38.9], r: 65, i: 0.55 },
      ],
    },
  ],
  advisory: {
    title_key: 'advisory_title',
    text_key: 'advisory_text',
    sources: ['u.s. press freedom tracker'],
  },
};

const DAY_NAMES = {
  en: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  kid: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
  fr: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
  pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  ar: ['أحد', 'إث', 'ثل', 'أرب', 'خم', 'جم', 'سب'],
};

const DATA = {
  current: null,
  default: DEFAULT_READING,

  // Where today's reading comes from, in priority order:
  //   1. /api/today  — the live Worker pipeline (wired via the route in
  //      wrangler.toml). Present once Part B of DEPLOY.md is deployed.
  //   2. data/reading.json — the bundled snapshot shipped with the site.
  //   3. DEFAULT_READING — the inline fallback, so the page ALWAYS renders.
  // The SAME build works before and after the pipeline goes live — no manual
  // edit needed. To point at a Worker on a different origin (e.g. before a
  // custom domain is set), set window.CF_API = 'https://your-worker.dev/today'.
  sources() {
    const live = (typeof window !== 'undefined' && window.CF_API) || '/api/today';
    return [live, 'data/reading.json'];
  },

  async load() {
    const base = JSON.parse(JSON.stringify(DEFAULT_READING));
    const fetched = await this.fetchFirst(this.sources());
    const reading = fetched ? { ...base, ...fetched } : base;
    if (!reading.date) reading.date = new Date().toISOString();
    if (!reading.generated_at) reading.generated_at = new Date().toISOString();
    this.current = reading;
    return reading;
  },

  // Try each URL in order; return the first that yields a real reading (an
  // object actually carrying an indicators array). Network errors, 404s, and
  // 200-HTML fallbacks (some hosts serve index.html for unknown paths) are
  // all skipped so a missing /api/today never blanks the page.
  async fetchFirst(urls) {
    for (const url of urls) {
      try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (!resp.ok) continue;
        let data;
        try { data = await resp.json(); } catch { continue; }
        if (data && Array.isArray(data.indicators)) return data;
      } catch (e) {
        // try the next source
      }
    }
    return null;
  },

  // Get today's day-of-week index in local time
  todayDow() { return new Date().getDay(); },

  dayName(dow, lang) {
    const list = DAY_NAMES[lang] || DAY_NAMES.en;
    return list[((dow % 7) + 7) % 7];
  },

  // Color tone of a feeling
  toneColor(feeling) {
    const map = {
      clear: '#6ec5e8',
      mild: '#a7d49b',
      overcast: '#e8c66e',
      watch: '#e8c66e',
      warning: '#e89a4f',
      storm: '#d4524e',
      severe: '#8b3a8f',
      // Status words mapped to tone color
      routine: '#a7d49b',
      elevated: '#e89a4f',
      severe_status: '#d4524e',
      settled: '#a7d49b',
      unsettled: '#e8c66e',
      turbulent: '#e89a4f',
      translucent: '#a7d49b',
      opaque: '#e89a4f',
      sealed: '#d4524e',
      in_session: '#a7d49b',
      recess: '#a7d49b',
      stalled: '#e89a4f',
      paralyzed: '#d4524e',
      quiet: '#a7d49b',
      active: '#e8c66e',
      convulsing: '#8b3a8f',
      steady: '#a7d49b',
      accelerating: '#e8c66e',
      surging: '#e89a4f',
      floodtide: '#d4524e',
    };
    return map[feeling] || '#a8b0c2';
  },
};

window.DATA = DATA;
window.DEFAULT_READING = DEFAULT_READING;
window.DAY_NAMES = DAY_NAMES;
