/* =====================================================================
   THE CIVIC FORECAST — app
   Wires data + i18n + map + indicator cards + bottom sheet.
   ===================================================================== */

// =====================================================================
// ACTIONS — what can you do, contextual to today's indicator state.
// Each indicator carries 2-3 actions, sorted by directness of impact.
// The renderer surfaces 3 cards total, prioritizing whichever indicators
// are most elevated.
// =====================================================================
const ACTION_CATALOG = {
  press: [
    { title: 'Support press freedom', body: 'Donate to the U.S. Press Freedom Tracker, the people who count every incident.', cta: 'Donate', url: 'https://pressfreedomtracker.us/donate/' },
    { title: 'Defend a journalist', body: 'Reporters Committee for Freedom of the Press provides legal aid to working journalists.', cta: 'Support', url: 'https://www.rcfp.org/donate/' },
  ],
  courts: [
    { title: 'Track the rulings', body: 'CourtListener publishes every federal opinion in the country. Free, searchable, theirs is the source.', cta: 'Browse', url: 'https://www.courtlistener.com/' },
    { title: 'Support legal aid', body: 'The American Civil Liberties Union litigates the cases that move this indicator.', cta: 'Support', url: 'https://action.aclu.org/give/now' },
  ],
  sunlight: [
    { title: 'File a FOIA request', body: 'Anyone can ask the federal government for records. FOIA.gov walks you through it.', cta: 'File one', url: 'https://www.foia.gov/how-to.html' },
    { title: 'Track FOIA backlogs', body: 'MuckRock tracks every request and publishes the responses. They power the SUNLIGHT reading.', cta: 'Visit', url: 'https://www.muckrock.com/' },
  ],
  chamber: [
    { title: 'Find your representatives', body: 'Look up your senators and house member. House.gov + Senate.gov are the official directories.', cta: 'Look up', url: 'https://www.house.gov/representatives/find-your-representative' },
    { title: 'Watch the votes', body: 'GovTrack shows every roll-call vote in real time. See how your reps voted this week.', cta: 'Browse', url: 'https://www.govtrack.us/congress/votes' },
  ],
  streets: [
    { title: 'Find a protest near you', body: 'ACLED publishes a public dataset of every U.S. protest. Their data feeds STREETS.', cta: 'Search', url: 'https://acleddata.com/dashboard/' },
    { title: 'Know your rights at a protest', body: 'The ACLU publishes pocket-card guides to your rights when assembling.', cta: 'Read', url: 'https://www.aclu.org/know-your-rights/protesters-rights' },
  ],
  record: [
    { title: 'Comment on an open rule', body: 'Federal agencies must read public comments on proposed rules. Regulations.gov is where you submit them.', cta: 'Comment', url: 'https://www.regulations.gov/' },
    { title: 'Read the Federal Register', body: 'Every executive order and rule, in plain text, the day it is signed.', cta: 'Browse', url: 'https://www.federalregister.gov/' },
  ],
  // Always-relevant baseline actions used to fill out to 3 cards
  baseline: [
    { title: 'Register to vote', body: 'Vote.gov is the official, non-partisan registration portal for every state.', cta: 'Register', url: 'https://vote.gov/' },
    { title: 'Open the methodology', body: 'Every reading on this page is traceable. The math is the math.', cta: 'Read', url: 'methodology.html' },
  ],
};

const GLOSSARY = {
  pressure: {
    title: "Today's pressure",
    text: 'A 0–100 reading of how much stress the country\'s civic systems are under right now. 0 means everything calm; 100 means historic stress on every front. Like barometric pressure, not a quality score.',
  },
  indicators: {
    title: 'Six indicators',
    text: 'Six things we watch every day, each measuring a different system democracy needs to be working: a free press, courts, government transparency, Congress, freedom of assembly, and the executive branch. We pull the numbers from public sources.',
  },
  press: {
    title: 'PRESS',
    text: 'When reporters get arrested, hurt, have equipment seized, or are denied access to events. Counted by the U.S. Press Freedom Tracker.',
  },
  courts: {
    title: 'COURTS',
    text: 'Federal court rulings on civil rights, voting access, executive power, and free speech. Counted by CourtListener at the Free Law Project.',
  },
  sunlight: {
    title: 'SUNLIGHT',
    text: 'The percent of FOIA (public records) requests that the federal government denies, redirects, or sits on past the legal deadline. Higher = more hidden.',
  },
  chamber: {
    title: 'CHAMBER',
    text: 'Whether Congress is showing up and voting. Days in session, votes cast, party-line vs bipartisan. Sourced from ProPublica and GovTrack.',
  },
  streets: {
    title: 'STREETS',
    text: 'Protests, rallies, and demonstrations across the country, plus any incidents where police use force. Sourced from ACLED.',
  },
  record: {
    title: 'RECORD',
    text: 'How many new rules, executive orders, and proclamations the executive branch published this week. The Federal Register publishes them all.',
  },
  unknown: { title: '—', text: '' },
};

const FEELING_TO_TONE = {
  clear: 'clear',
  mild: 'mild',
  overcast: 'watch',
  warning: 'warning',
  storm: 'storm',
  severe: 'severe',
};

const App = {
  reading: null,

  async init() {
    // Set initial language
    I18N.set(I18N.detect());

    // Build language picker
    this.buildLangPicker();

    // Load today's reading
    this.reading = await DATA.load();

    // Render hero glyph + word + sentence
    this.renderHero();

    // Render top stories
    this.renderStories();

    // Render indicators
    this.renderIndicators();

    // Render seven-days
    this.renderDays();

    // Render advisory
    this.renderAdvisory();

    // Render gauge (with counter animation on first load)
    this.renderGauge(true);

    // Render hero trend (vs yesterday)
    this.renderHeroTrend();

    // Render the prominent "updated at" stamp
    this.renderUpdatedStamp();

    // Render action card
    this.renderActions();

    // Wire glossary tips
    this.wireGlossary();

    // Wire share button
    this.wireShare();

    // Status bar date
    this.renderDate();

    // Init map
    const mapStage = document.getElementById('map-stage');
    if (mapStage) Map.init(mapStage, this.reading);

    // Wire kid mode toggle
    document.getElementById('kid-toggle').addEventListener('click', () => {
      const next = I18N.current === 'kid' ? 'en' : 'kid';
      I18N.set(next);
    });

    // Wire sheet close
    document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => this.closeSheet()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeSheet(); });

    // Re-render dynamic bits on language change
    document.addEventListener('langchange', () => {
      this.renderHero();
      this.renderStories();
      this.renderIndicators();
      this.renderDays();
      this.renderAdvisory();
      this.renderDate();
      this.renderGauge(false);
      this.renderHeroTrend();
      this.renderUpdatedStamp();
      this.renderActions();
      this.updateLangPicker();
      this.updateKidToggleLabel();
    });

    this.updateKidToggleLabel();
  },

  buildLangPicker() {
    const btn = document.getElementById('lang-button');
    const menu = document.getElementById('lang-menu');
    const current = document.getElementById('lang-current');

    LANGS.forEach(l => {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'option';
      b.dataset.lang = l.code;
      b.innerHTML = `<span>${l.name}</span><span class="lang-tag">${l.tag}</span>`;
      b.addEventListener('click', () => {
        I18N.set(l.code);
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
      menu.appendChild(b);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    this.updateLangPicker();
  },

  updateLangPicker() {
    const meta = LANGS.find(l => l.code === I18N.current);
    if (meta) document.getElementById('lang-current').textContent = meta.tag;
    document.querySelectorAll('#lang-menu button').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === I18N.current);
    });
  },

  updateKidToggleLabel() {
    const t = document.querySelector('#kid-toggle [data-i18n]');
    const btn = document.getElementById('kid-toggle');
    if (I18N.current === 'kid') {
      t.textContent = I18N.t('kid_nudge_active');
      btn.classList.add('active');
      t.setAttribute('data-i18n', 'kid_nudge_active');
    } else {
      t.textContent = I18N.t('kid_nudge');
      btn.classList.remove('active');
      t.setAttribute('data-i18n', 'kid_nudge');
    }
  },

  renderHero() {
    const r = this.reading;
    if (!r) return;
    const glyph = document.getElementById('hero-glyph');
    glyph.innerHTML = GLYPHS[r.feeling] || GLYPHS.overcast;

    document.querySelector('#hero-feeling .hero-word-main').textContent = I18N.t(`feeling_${r.feeling}`);

    const sentence = document.getElementById('hero-sentence');
    // Live data ships today's sentence as a literal string (written by the
    // pipeline). The bundled fallback may instead carry an i18n key. Prefer
    // the literal live sentence; fall back to the translated key.
    sentence.textContent = r.reading_sentence || I18N.t(r.reading_sentence_key || 'reading_sentence');

    // Update pill status
    const pill = document.querySelector('.hero-pill[data-status]');
    const tone = FEELING_TO_TONE[r.feeling] || 'watch';
    pill.setAttribute('data-status', tone);
    pill.querySelector('[data-i18n]').textContent = I18N.t(`signal_${r.signal}`);
  },

  renderGauge(animate) {
    const r = this.reading;
    if (!r) return;
    const pressure = r.pressure ?? r.cpi ?? 0;
    const pointer = document.getElementById('pbar-pointer');
    const value = document.getElementById('pbar-value');
    if (pointer) pointer.style.left = `${pressure}%`;
    if (value) {
      if (animate && !this._gaugeAnimated) {
        this._gaugeAnimated = true;
        this.animateNumber(value, 0, pressure, 1100);
      } else {
        value.textContent = pressure;
      }
    }

    // Trend arrow on the gauge — derived from yesterday's pressure
    const trendEl = document.getElementById('pbar-trend');
    if (trendEl && r.six_days?.length >= 2) {
      const yesterday = r.six_days[r.six_days.length - 2]?.pressure;
      if (yesterday != null && yesterday !== 0) {
        const delta = pressure - yesterday;
        if (Math.abs(delta) >= 1) {
          trendEl.dataset.dir = delta > 0 ? 'up' : 'down';
          trendEl.textContent = delta > 0 ? '↑' : '↓';
        } else {
          trendEl.dataset.dir = 'flat';
          trendEl.textContent = '';
        }
      }
    }

    // Restore previous dismiss state
    try {
      const dismissed = localStorage.getItem('cf-pbar-dismissed') === '1';
      this.setPbarDismissed(dismissed);
    } catch {}

    // Wire dismiss/restore (idempotent)
    const closeBtn = document.getElementById('pbar-close');
    if (closeBtn && !closeBtn.dataset.wired) {
      closeBtn.dataset.wired = '1';
      closeBtn.addEventListener('click', () => {
        this.setPbarDismissed(true);
        try { localStorage.setItem('cf-pbar-dismissed', '1'); } catch {}
      });
    }
    const restoreBtn = document.getElementById('pbar-restore');
    if (restoreBtn && !restoreBtn.dataset.wired) {
      restoreBtn.dataset.wired = '1';
      restoreBtn.addEventListener('click', () => {
        this.setPbarDismissed(false);
        try { localStorage.removeItem('cf-pbar-dismissed'); } catch {}
      });
    }
  },

  setPbarDismissed(yes) {
    const pbar = document.getElementById('pbar');
    const restore = document.getElementById('pbar-restore');
    if (!pbar || !restore) return;
    pbar.hidden = yes;
    restore.hidden = !yes;
  },

  renderStories() {
    const list = document.getElementById('stories-list');
    if (!list || !this.reading?.top_stories) return;
    list.innerHTML = '';
    this.reading.top_stories.forEach(s => {
      const tone = (s.indicators || []).map(id => {
        const ind = this.reading.indicators.find(i => i.id === id);
        return ind ? ind.tone : 'watch';
      })[0] || 'watch';
      const color = DATA.toneColor(tone);
      const dirSymbol = s.direction === 'up' ? '↑' : s.direction === 'down' ? '↓' : '·';

      const tags = (s.indicators || []).map(id => {
        return `<span class="story-tag" style="--tag-bg: ${this.toRgba(color, 0.14)}; --tag-color: ${color};">
          <span class="arr">${dirSymbol}</span>
          <span>${id}</span>
        </span>`;
      }).join('');

      // Thumbnail: real image if available, otherwise atmospheric chip matching the indicator
      const indId = (s.indicators || [])[0] || 'overcast';
      const chipFeeling = ({
        press: 'warning', courts: 'overcast', sunlight: 'warning',
        chamber: 'mild', streets: 'overcast', record: 'overcast',
      })[indId] || 'overcast';
      const thumb = s.image
        ? `<img src="${s.image}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
           <div class="story-thumb-chip" style="--chip-color: ${color}; display: none;">${GLYPHS[chipFeeling] || GLYPHS.overcast}</div>`
        : `<div class="story-thumb-chip" style="--chip-color: ${color};">${GLYPHS[chipFeeling] || GLYPHS.overcast}</div>`;

      const el = document.createElement('article');
      el.className = 'story';
      el.style.setProperty('--story-color', color);
      el.innerHTML = `
        <div class="story-rank">${String(s.rank).padStart(2, '0')}</div>
        <div class="story-thumb">${thumb}</div>
        <div class="story-body">
          <h3 class="story-headline">${s.headline}</h3>
          <div class="story-meta">
            <span>${s.source}</span>
            <span class="story-meta-divider">·</span>
            <span>${s.time}</span>
            <span class="story-meta-divider">·</span>
            ${tags}
          </div>
          <div class="story-weather-note">${s.weather_note}</div>
          <a class="story-source-link" href="${s.url}" target="_blank" rel="noopener">
            ${I18N.t('story_read_source')} →
          </a>
        </div>
      `;
      list.appendChild(el);
    });
  },

  toRgba(hex, alpha) {
    if (!hex) return `rgba(232, 154, 79, ${alpha})`;
    const m = hex.replace('#', '').match(/.{1,2}/g);
    if (!m) return hex;
    const [r, g, b] = m.map(x => parseInt(x, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  renderIndicators() {
    const grid = document.getElementById('indicator-grid');
    if (!this.reading) return;
    grid.innerHTML = '';
    this.reading.indicators.forEach(ind => {
      const tone = ind.tone;
      const tint = DATA.toneColor(tone);
      const trendArrow = ind.trend_dir === 'up' ? STATUS_ICONS.up :
                        ind.trend_dir === 'down' ? STATUS_ICONS.down : STATUS_ICONS.flat;
      const trendText = ind.trend_dir === 'flat'
        ? I18N.t('trend_flat')
        : I18N.t(`trend_${ind.trend_dir}`, { n: ind.trend_n });

      // Plain-English label & count, in the active language
      const plainLabel = ind[`plain_label_${I18N.current}`] || ind.plain_label || '';
      const plainCount = ind[`plain_count_${I18N.current}`] || ind.plain_count || '';
      const plainSubtitle = ind[`plain_subtitle_${I18N.current}`] || ind.plain_subtitle || '';
      const coName = ind[`co_name_${I18N.current}`] || ind.co_name || '';

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'indicator';
      card.setAttribute('aria-label', `${ind.id} — ${plainLabel} — ${I18N.t(`status_${ind.status}`)}`);
      card.innerHTML = `
        <div class="indicator-tint" style="background: radial-gradient(circle at 70% 30%, ${tint} 0%, transparent 70%);"></div>
        <div class="indicator-head">
          <span>
            <span class="indicator-name">${ind.id}</span>
            ${coName ? `<span class="indicator-coname">${coName}</span>` : ''}
          </span>
          <span class="indicator-trend trend-${ind.trend_dir}">${trendArrow}<span>${trendText}</span></span>
        </div>
        <div class="indicator-status status-${tone}">${I18N.t(`status_${ind.status}`)}</div>
        <div class="indicator-plain">${plainCount}</div>
        ${plainSubtitle ? `<div class="indicator-subtitle">${plainSubtitle}</div>` : ''}
        <div class="indicator-spark" aria-hidden="true">${this.sparkline(ind.sparkline, tint)}</div>
        <div class="indicator-foot">
          <span class="indicator-source">${ind.source}</span>
          <span class="indicator-arrow">${STATUS_ICONS.arrow}</span>
        </div>
      `;
      card.addEventListener('click', () => this.openSheet(ind));
      grid.appendChild(card);
    });
  },

  sparkline(values, color) {
    if (!values || !values.length) return '';
    const w = 100, h = 30, pad = 2;
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const stepX = (w - pad * 2) / (values.length - 1);
    const points = values.map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return [x, y];
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${path} L${points[points.length - 1][0]},${h} L${points[0][0]},${h} Z`;
    return `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sg-${Math.random().toString(36).slice(2, 7)}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="${color}" opacity="0.18"/>
        <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${points[points.length - 1][0]}" cy="${points[points.length - 1][1]}" r="2" fill="${color}"/>
      </svg>
    `;
  },

  renderDays() {
    const strip = document.getElementById('days-strip');
    if (!this.reading) return;
    strip.innerHTML = '';
    this.reading.six_days.forEach((d, idx) => {
      const tone = FEELING_TO_TONE[d.feeling] || 'watch';
      const color = DATA.toneColor(tone);
      // Compute day name + day-of-month from the ISO date when available.
      let dayName;
      let dayNum = '';
      if (d.date && /^\d{4}-\d{2}-\d{2}/.test(d.date)) {
        const dt = new Date(d.date + 'T12:00:00');
        const dow = dt.getDay();
        dayName = DATA.dayName(dow, I18N.current);
        dayNum = String(dt.getDate());
      } else if (typeof d.dow === 'number') {
        dayName = DATA.dayName(d.dow, I18N.current);
      } else {
        dayName = d.date || '';
      }
      const wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'day' + (d.today ? ' today' : '');
      wrap.setAttribute('aria-label', `${dayName}${dayNum ? ' ' + dayNum : ''} — ${I18N.t(`feeling_${d.feeling}`)}`);
      wrap.innerHTML = `
        <span class="day-name">${dayName}${dayNum ? ` <em class="day-num">${dayNum}</em>` : ''}</span>
        <span class="day-pill" style="--day-color: ${color};"></span>
        <span class="day-temp">${d.today ? I18N.t('map_live') : I18N.t(`feeling_${d.feeling}`)}</span>
      `;
      wrap.addEventListener('click', () => this.openDayHistory(d));
      strip.appendChild(wrap);
    });
  },

  renderAdvisory() {
    if (!this.reading?.advisory) return;
    const adv = this.reading.advisory;
    document.getElementById('advisory-title').textContent = I18N.t(adv.title_key || 'advisory_title');
    // Live advisory text is a literal string from the pipeline; the bundled
    // fallback may use an i18n key. Prefer the literal.
    document.getElementById('advisory-text').textContent = adv.text || I18N.t(adv.text_key || 'advisory_text');
    document.getElementById('advisory-time').textContent = I18N.t('advisory_time_today');
    const sources = (adv.sources || []).join(' · ');
    if (sources) document.getElementById('advisory-sources').textContent = sources;
  },

  renderDate() {
    const d = new Date();
    const opts = { weekday: 'short', month: 'short', day: 'numeric' };
    let formatted;
    try {
      formatted = d.toLocaleDateString(I18N.current === 'kid' ? 'en' : I18N.current, opts);
    } catch {
      formatted = d.toLocaleDateString('en', opts);
    }
    const el = document.getElementById('status-date');
    el.textContent = formatted.toUpperCase();
    el.setAttribute('datetime', d.toISOString());
  },

  animateNumber(el, from, to, duration) {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  renderUpdatedStamp() {
    const r = this.reading;
    const el = document.getElementById('hero-updated-time');
    if (!el || !r?.generated_at) return;
    const d = new Date(r.generated_at);
    if (isNaN(d.getTime())) { el.textContent = I18N.t('updated_dawn') || 'this morning at dawn ET'; return; }
    const sameDay = d.toDateString() === new Date().toDateString();
    if (sameDay) {
      const time = d.toLocaleTimeString(I18N.current === 'kid' ? 'en' : I18N.current, { hour: 'numeric', minute: '2-digit' });
      el.textContent = `${I18N.t('time_today')?.toLowerCase() || 'today'} · ${time} ET`;
    } else {
      el.textContent = d.toLocaleString(I18N.current === 'kid' ? 'en' : I18N.current, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
    }
    el.setAttribute('datetime', r.generated_at);
  },

  renderHeroTrend() {
    const r = this.reading;
    if (!r?.six_days || r.six_days.length < 2) return;
    const today = r.pressure ?? r.cpi ?? 0;
    // Find yesterday's pressure (the last six_days entry before today's)
    const yesterday = r.six_days.length >= 2 ? (r.six_days[r.six_days.length - 2]?.pressure ?? null) : null;
    const pill = document.getElementById('hero-trend-pill');
    if (!pill || yesterday == null || yesterday === 0) {
      if (pill) pill.hidden = true;
      return;
    }
    const delta = today - yesterday;
    const arrow = document.getElementById('hero-trend-arrow');
    const text = document.getElementById('hero-trend-text');
    if (Math.abs(delta) < 1) {
      pill.hidden = true;
      return;
    }
    if (delta > 0) {
      arrow.textContent = '↑';
      pill.dataset.status = 'warning';
      text.textContent = I18N.t('trend_rose_yesterday', { n: delta }) || `rose ${delta} from yesterday`;
    } else {
      arrow.textContent = '↓';
      pill.dataset.status = 'mild';
      text.textContent = I18N.t('trend_fell_yesterday', { n: -delta }) || `fell ${-delta} from yesterday`;
    }
    pill.hidden = false;
  },

  renderActions() {
    const list = document.getElementById('actions-list');
    if (!list || !this.reading) return;
    list.innerHTML = '';

    // Pick actions weighted by indicator urgency (storm/severe > warning > watch)
    const TONE_WEIGHT = { severe: 5, storm: 4, warning: 3, watch: 2, mild: 1, clear: 0 };
    const ranked = [...this.reading.indicators].sort((a, b) =>
      (TONE_WEIGHT[b.tone] || 0) - (TONE_WEIGHT[a.tone] || 0)
    );

    const picked = [];
    const seenInd = new Set();
    for (const ind of ranked) {
      if (picked.length >= 3) break;
      if (seenInd.has(ind.id)) continue;
      const actions = ACTION_CATALOG[ind.id] || [];
      if (actions.length === 0) continue;
      picked.push({ ind, action: actions[0] });
      seenInd.add(ind.id);
    }
    // Top up with baseline if we have fewer than 3
    let baselineIdx = 0;
    while (picked.length < 3 && baselineIdx < ACTION_CATALOG.baseline.length) {
      picked.push({ ind: null, action: ACTION_CATALOG.baseline[baselineIdx++] });
    }

    picked.forEach(({ ind, action }) => {
      const tone = ind?.tone || 'mild';
      const tint = DATA.toneColor(tone);
      const indLabel = ind ? `${ind.id} · ${I18N.t(`status_${ind.status}`)}` : I18N.t('actions_baseline_label') || 'always-on';

      const el = document.createElement('a');
      el.className = 'action';
      el.href = action.url;
      el.target = '_blank';
      el.rel = 'noopener';
      el.style.setProperty('--action-color', tint);
      el.innerHTML = `
        <div class="action-stripe"></div>
        <div class="action-tag">${indLabel}</div>
        <h3 class="action-title">${action.title}</h3>
        <p class="action-body">${action.body}</p>
        <div class="action-cta">
          <span>${action.cta}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      `;
      list.appendChild(el);
    });
  },

  wireShare() {
    const btn = document.getElementById('hero-share');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const r = this.reading;
      const title = 'The Civic Forecast';
      const text = `${I18N.t('share_text_prefix')} ${I18N.t(`feeling_${r.feeling}`)}. ${r.reading_sentence || I18N.t('reading_sentence')}`;
      const url = window.location.origin + window.location.pathname;
      if (navigator.share) {
        try { await navigator.share({ title, text, url }); } catch {}
      } else {
        try {
          await navigator.clipboard.writeText(`${text} — ${url}`);
          this.toast(I18N.t('share_copied') || 'copied to clipboard');
        } catch {
          window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}`);
        }
      }
    });
  },

  toast(message) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  },

  wireGlossary() {
    const tip = document.getElementById('glossary-tip');
    const title = document.getElementById('glossary-tip-title');
    const text = document.getElementById('glossary-tip-text');

    const open = (e, key) => {
      e.stopPropagation();
      const def = GLOSSARY[key] || GLOSSARY.unknown;
      title.textContent = I18N.t(`glossary_${key}_title`) || def.title;
      text.textContent = I18N.t(`glossary_${key}_text`) || def.text;
      const rect = e.target.getBoundingClientRect();
      tip.hidden = false;
      // Position below the button by default
      const tipW = 280;
      let left = rect.left + rect.width / 2 - tipW / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));
      tip.style.left = `${left}px`;
      tip.style.top = `${rect.bottom + 8}px`;
    };

    document.body.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-glossary]');
      if (trigger) {
        open(e, trigger.dataset.glossary);
        return;
      }
      if (!tip.contains(e.target) && !tip.hidden) {
        tip.hidden = true;
      }
    });
  },

  openMapPopover(region, hotZoneEl) {
    const pop = document.getElementById('map-popover');
    const stage = document.getElementById('map-stage');
    if (!pop || !stage) return;
    const ind = this.reading.indicators.find(i => i.id === region.indicator_id);
    if (!ind) return;

    // Compute real DOM position from the clicked element (SVG coords ≠ pixels).
    const stageRect = stage.getBoundingClientRect();
    const dotRect = hotZoneEl.getBoundingClientRect();
    const cx = (dotRect.left + dotRect.right) / 2 - stageRect.left;
    const cy = dotRect.top - stageRect.top;

    document.getElementById('popover-region').textContent = region.label || '—';
    document.getElementById('popover-status').textContent = `${ind.id.toUpperCase()} · ${I18N.t(`status_${ind.status}`)}`;
    document.getElementById('popover-status').style.color = DATA.toneColor(ind.tone);
    const ev = (ind.events || [])[0];
    const evText = ev?.text || ind.plain_label || '';
    const evWhen = ev ? this.formatRelativeDate(ev.at || ev.time || '') : '';
    document.getElementById('popover-text').innerHTML = evWhen
      ? `<span class="popover-when">${evWhen}</span>${evText}`
      : evText;

    pop.hidden = false;
    // Position above the dot, then clamp to map bounds so it never escapes.
    const popW = 240;
    let left = cx;
    left = Math.max(popW / 2 + 8, Math.min(left, stageRect.width - popW / 2 - 8));
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.max(8, cy - 4)}px`;

    clearTimeout(this._popTimer);
    this._popTimer = setTimeout(() => { pop.hidden = true; }, 6000);
  },

  closeMapPopover() {
    const pop = document.getElementById('map-popover');
    if (pop) pop.hidden = true;
  },

  // Formats an ISO timestamp as "Today · 2:22 PM", "Yesterday · 8:45 AM",
  // or "Apr 28 · 11:08 AM" depending on how recent it is.
  formatRelativeDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso; // already a string we can't parse — show as-is
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString(I18N.current === 'kid' ? 'en' : I18N.current, { hour: 'numeric', minute: '2-digit' });
    if (sameDay)    return `${I18N.t('time_today')    || 'Today'} · ${time}`;
    if (isYesterday) return `${I18N.t('time_yesterday') || 'Yesterday'} · ${time}`;
    const md = d.toLocaleDateString(I18N.current === 'kid' ? 'en' : I18N.current, { month: 'short', day: 'numeric' });
    return `${md} · ${time}`;
  },

  openSheet(ind) {
    const sheet = document.getElementById('sheet');
    const content = document.getElementById('sheet-content');
    const tone = ind.tone;
    const tint = DATA.toneColor(tone);

    const eventsHTML = (ind.events || []).map(e => {
      // Live events carry `time` as an ISO timestamp; the bundled fallback
      // uses `at`. formatRelativeDate passes through any string it can't parse
      // (legacy literals like "today" or "14:22") unchanged.
      const when = this.formatRelativeDate(e.at || e.time || '');
      return `
        <div class="sheet-event" style="border-left-color: ${tint};">
          <span class="sheet-event-time">${when}</span>
          <span class="sheet-event-text">${e.text}</span>
        </div>
      `;
    }).join('');

    const unit = ind.unit || '';
    content.innerHTML = `
      <div class="sheet-eyebrow">${ind.id}</div>
      <h3 class="sheet-title status-${tone}" style="color:${tint};">${I18N.t(`status_${ind.status}`)}</h3>
      <p class="sheet-subtitle">${I18N.t(`indicator_${ind.id}`)} — ${I18N.t(`desc_${ind.id}`)}</p>

      <div class="sheet-stat-row">
        <div class="sheet-stat">
          <div class="sheet-stat-label">${I18N.t('sheet_count_today')}</div>
          <div class="sheet-stat-value">${ind.count_today}${unit ? ' ' + unit : ''}</div>
        </div>
        <div class="sheet-stat">
          <div class="sheet-stat-label">${I18N.t('sheet_count_week')}</div>
          <div class="sheet-stat-value">${ind.count_week}${unit ? ' ' + unit : ''}</div>
        </div>
        <div class="sheet-stat">
          <div class="sheet-stat-label">${I18N.t('sheet_count_avg')}</div>
          <div class="sheet-stat-value">${ind.count_avg_90}${unit ? ' ' + unit : ''}</div>
        </div>
      </div>

      <div class="sheet-section">
        <h4>${I18N.t('sheet_recent')}</h4>
        <div class="sheet-events">${eventsHTML}</div>
      </div>

      <div class="sheet-section">
        <h4>${I18N.t('sheet_method')}</h4>
        <div class="sheet-method">
          ${I18N.t(`desc_${ind.id}`)}
          <br><br>
          <a href="${ind.source_url}" target="_blank" rel="noopener" style="color: var(--clear); text-decoration: underline; text-underline-offset: 3px;">
            ${ind.source} →
          </a>
        </div>
      </div>
    `;

    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
  },

  closeSheet() {
    const sheet = document.getElementById('sheet');
    sheet.hidden = true;
    document.body.style.overflow = '';
  },

  openDayHistory(d) {
    // For v1 — show a small toast / sheet with the day's reading
    if (d.today) return;
    const sheet = document.getElementById('sheet');
    const content = document.getElementById('sheet-content');
    const tone = FEELING_TO_TONE[d.feeling] || 'watch';
    const tint = DATA.toneColor(tone);
    content.innerHTML = `
      <div class="sheet-eyebrow">${d.date || ''}</div>
      <h3 class="sheet-title" style="color:${tint};">${I18N.t(`feeling_${d.feeling}`)}</h3>
      <p class="sheet-subtitle">Archive view coming soon. Each day's full reading will be browseable here.</p>
    `;
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
  },
};

window.App = App;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}

// Register the service worker for offline support. Only on https/localhost.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('[sw] register failed:', err);
    });
  });
}
