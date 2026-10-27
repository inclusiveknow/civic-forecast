/* =====================================================================
   THE CIVIC FORECAST · the civic weather map
   A state choropleth with four layers. Palettes are validated for the dark
   card surface (dataviz validator): the voting layer uses exactly three
   categorical colors (the most a choropleth can carry for colorblind readers),
   rent is diverging around zero, jobs is a one-hue sequential ramp.
   Every layer has a legend with counts, a hover tooltip, and a list view.
   ===================================================================== */

const CivicMap = (() => {
  const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json';
  const C = {
    now: '#3987e5', mail: '#d95926', wait: '#199e70', none: '#3a4050',
    // rent: diverging around zero, three validated steps per arm
    down3: '#86b6ef', down2: '#3987e5', down1: '#1c5cab', flat: '#3a4050', up1: '#93403c', up2: '#c45450', up3: '#ef8582',
    j1: '#184f95', j2: '#256abf', j3: '#3987e5', j4: '#6da7ec', j5: '#9ec5f4',
  };

  let topo = null, features = null, svg = null, opts = null, layer = 'vote', pinned = null;
  const el = {};

  // ---------- layers ----------
  function voteLegend(d) {
    if (d > Civic.CERTIFY) {
      return [
        { key: 'now', label: 'Statewide vote in the next 3 months' },
        { key: 'mail', label: 'In 3 to 12 months' },
        { key: 'wait', label: 'No statewide vote in the next year' },
      ];
    }
    if (d === Civic.ELECTION) return [{ key: 'now', label: 'Polls are open' }];
    if (d > Civic.ELECTION) return [{ key: 'mail', label: 'Mailed ballots still arriving' }, { key: 'wait', label: 'Counting the vote' }];
    return [
      { key: 'now', label: 'Vote early in person now' },
      { key: 'mail', label: 'Every voter got a ballot by mail' },
      { key: 'wait', label: 'Election Day is next' },
    ];
  }

  const LAYERS = {
    vote: {
      tab: 'Voting',
      title: (d) => (d > Civic.CERTIFY ? 'When each state votes next' : d > Civic.ELECTION ? 'Where the count stands' : d === Civic.ELECTION ? 'Election Day' : 'How people can vote today'),
      legend: (d) => voteLegend(d),
      key: (code, o) => Civic.mapCategory(o.voting[code], o.today),
      tip: (code, o) => {
        const v = o.voting[code];
        if (!v) return 'No data yet';
        const s = Civic.stateNow(v, o.today);
        const e = v.early || {};
        if (s.code === 'inperson' && e.end) return `${s.label} through ${Civic.fmtDay(e.end)}`;
        return s.label;
      },
      source: (o) => (o.today > Civic.CERTIFY ? 'State election offices, researched Oct 26, 2026. Local elections are on top of these.' : 'State election offices, checked Oct 26, 2026'),
    },
    reg: {
      tab: 'Can still register',
      title: () => 'Where you can still register to vote',
      legend: () => [{ key: 'now', label: 'You can still register' }, { key: 'none', label: 'Registration has closed' }],
      key: (code, o) => {
        const r = o.voting[code]?.registration;
        if (!r) return null;
        if (!r.deadline && !r.sameDay) return 'now'; // North Dakota: no registration needed
        return r.sameDay || (r.deadline && o.today <= r.deadline) ? 'now' : 'none';
      },
      tip: (code, o) => {
        const r = o.voting[code]?.registration;
        if (!r) return 'No data yet';
        if (!r.deadline && !r.sameDay) return 'No voter registration needed';
        if (r.deadline && o.today <= r.deadline) return `Register by ${Civic.fmtDay(r.deadline)}`;
        return r.sameDay ? 'Register and vote in person, same day' : `Closed ${Civic.fmtDay(r.deadline)}`;
      },
      source: 'State election offices, checked Oct 26, 2026',
    },
    rent: {
      tab: 'Rent',
      title: () => 'Rent compared with a year ago',
      legend: () => [
        { key: 'up3', label: 'Up 4% or more' }, { key: 'up2', label: 'Up 2 to 4%' }, { key: 'up1', label: 'Up under 2%' },
        { key: 'flat', label: 'About the same' },
        { key: 'down1', label: 'Down under 2%' }, { key: 'down2', label: 'Down 2 to 4%' }, { key: 'down3', label: 'Down 4% or more' },
      ],
      key: (code, o) => {
        const s = o.rent?.state?.[code];
        if (!s) return null;
        const y = s[1];
        if (Math.abs(y) < 0.5) return 'flat';
        const step = Math.abs(y) >= 4 ? 3 : Math.abs(y) >= 2 ? 2 : 1;
        return (y > 0 ? 'up' : 'down') + step;
      },
      tip: (code, o) => {
        const s = o.rent?.state?.[code];
        if (!s) return 'Not enough rentals tracked';
        const thin = s[2] < 20 ? ` (based on only ${s[2]} ZIP codes)` : '';
        return `Typical rent $${s[0].toLocaleString()} · ${s[1] >= 0 ? 'up' : 'down'} ${Math.abs(s[1])}% in a year${thin}`;
      },
      hideEmpty: true,
      source: (o) => `Zillow Observed Rent Index, ${monthName(o.rent?.asof)}. Median of the ZIP codes Zillow tracks in each state.`,
    },
    jobs: {
      tab: 'Jobs',
      title: () => 'Unemployment rate',
      legend: () => [
        { key: 'j5', label: '6% or higher' }, { key: 'j4', label: '5 to 5.9%' }, { key: 'j3', label: '4 to 4.9%' },
        { key: 'j2', label: '3 to 3.9%' }, { key: 'j1', label: 'Under 3%' },
      ],
      key: (code, o) => {
        const j = o.econ?.jobs?.[code];
        if (!j) return null;
        const v = j.value;
        return v >= 6 ? 'j5' : v >= 5 ? 'j4' : v >= 4 ? 'j3' : v >= 3 ? 'j2' : 'j1';
      },
      tip: (code, o) => {
        const j = o.econ?.jobs?.[code];
        return j ? `${j.value}% unemployed · ${j.yearAgo != null ? `${j.yearAgo}% a year ago` : ''}` : 'No data';
      },
      source: (o) => `U.S. Bureau of Labor Statistics, ${o.econ?.jobsMonth || ''}, seasonally adjusted`,
    },
  };

  function monthName(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-').map(Number);
    return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`;
  }

  // ---------- drawing ----------
  async function init(root, o) {
    opts = o;
    el.root = root;
    el.stage = root.querySelector('[data-map-stage]');
    el.tabs = root.querySelector('[data-map-tabs]');
    el.title = root.querySelector('[data-map-title]');
    el.legend = root.querySelector('[data-map-legend]');
    el.list = root.querySelector('[data-map-list]');
    el.source = root.querySelector('[data-map-source]');
    el.tip = root.querySelector('[data-map-tip]');
    el.toggle = root.querySelector('[data-map-view]');
    el.toggle.innerHTML = `${ICONS.list}<span>List view</span>`;

    const tabs = Object.entries(LAYERS).filter(([k]) => !(k === 'reg' && o.today > Civic.ELECTION));
    el.tabs.innerHTML = tabs.map(([k, l]) => `<button type="button" role="tab" data-layer="${k}" aria-selected="${k === layer}">${l.tab}</button>`).join('');
    el.tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-layer]');
      if (b) setLayer(b.dataset.layer);
    });
    el.toggle.addEventListener('click', () => {
      const listing = el.root.classList.toggle('as-list');
      el.toggle.innerHTML = listing ? `${ICONS.map}<span>Map view</span>` : `${ICONS.list}<span>List view</span>`;
    });

    try {
      if (typeof d3 === 'undefined' || typeof topojson === 'undefined') throw new Error('map libraries missing');
      topo = await d3.json(ATLAS_URL);
      features = topojson.feature(topo, topo.objects.states).features;
    } catch (err) {
      el.stage.innerHTML = '<p class="map-offline">The map couldn’t load right now. The list view below has every state.</p>';
      el.root.classList.add('as-list');
      el.toggle.hidden = true;
    }
    draw();
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
  }

  function setLayer(k) {
    layer = k;
    el.tabs.querySelectorAll('[data-layer]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.layer === k)));
    hideTip();
    draw();
  }

  function draw() {
    const L = LAYERS[layer], o = opts;
    const codes = Object.keys(Live.STATE_FIPS);
    const keyOf = Object.fromEntries(codes.map((c) => [c, L.key(c, o)]));
    const legend = L.legend(o.today);
    const counts = {};
    codes.forEach((c) => { if (keyOf[c]) counts[keyOf[c]] = (counts[keyOf[c]] || 0) + 1; });

    el.title.textContent = L.title(o.today);
    el.source.textContent = typeof L.source === 'function' ? L.source(o) : L.source;
    // a seven-step legend with four empty steps is noise; say so in one line instead
    const shown = L.hideEmpty ? legend.filter((g) => counts[g.key]) : legend;
    el.legend.innerHTML = shown.map((g) =>
      `<li><span class="sw" style="background:${C[g.key]}"></span><span>${g.label}</span><b>${counts[g.key] || 0}</b></li>`).join('') +
      (L.hideEmpty && shown.length < legend.length && layer === 'rent' && !legend.some((g) => g.key.startsWith('down') && counts[g.key])
        ? '<li class="legend-note">No state has falling rent right now.</li>' : '');

    // list view: every state, grouped by legend bucket
    el.list.innerHTML = legend.map((g) => {
      const states = codes.filter((c) => keyOf[c] === g.key).sort((a, b) => Live.STATE_NAMES[a].localeCompare(Live.STATE_NAMES[b]));
      if (!states.length) return '';
      return `<section><h4><span class="sw" style="background:${C[g.key]}"></span>${g.label} <b>${states.length}</b></h4><ul>` +
        states.map((c) => `<li><a href="?st=${c}" data-pick="${c}">${Live.STATE_NAMES[c]}</a><span>${esc(L.tip(c, o))}</span></li>`).join('') +
        '</ul></section>';
    }).join('');

    if (!features) return;
    const w = el.stage.clientWidth || 640;
    const h = Math.round(w * 0.62);
    const proj = d3.geoAlbersUsa().fitExtent([[6, 6], [w - 6, h - 6]], { type: 'FeatureCollection', features });
    const path = d3.geoPath(proj);

    el.stage.innerHTML = '';
    svg = d3.select(el.stage).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('role', 'img')
      .attr('aria-label', `${L.title(o.today)}. Use the list view for every state.`);
    const g = svg.append('g');
    g.selectAll('path').data(features).enter().append('path')
      .attr('class', 'st')
      .attr('d', path)
      .attr('fill', (f) => C[keyOf[Live.FIPS_TO_STATE[f.id]]] || C.none)
      .on('mousemove', (ev, f) => showTip(ev, Live.FIPS_TO_STATE[f.id], false))
      .on('mouseleave', () => { if (!pinned) hideTip(); })
      .on('click', (ev, f) => { ev.stopPropagation(); showTip(ev, Live.FIPS_TO_STATE[f.id], true); });

    // your state, outlined on top
    if (o.home) {
      const f = features.find((x) => Live.FIPS_TO_STATE[x.id] === o.home);
      if (f) svg.append('path').attr('class', 'st-home').attr('d', path(f));
    }
    svg.on('click', () => { pinned = null; hideTip(); });
  }

  function showTip(ev, code, pin) {
    if (!code) return;
    const L = LAYERS[layer];
    const box = el.stage.getBoundingClientRect();
    pinned = pin ? code : null;
    el.tip.hidden = false;
    el.tip.classList.toggle('pinned', !!pin);
    el.tip.innerHTML = `<strong>${Live.STATE_NAMES[code]}</strong><span>${esc(L.tip(code, opts))}</span>` +
      (pin ? `<a href="?st=${code}" data-pick="${code}">See ${Live.STATE_NAMES[code]}’s forecast ${ICONS.arrow}</a>` : '');
    const x = Math.min(Math.max(ev.clientX - box.left, 90), box.width - 90);
    const y = ev.clientY - box.top;
    el.tip.style.left = `${x}px`;
    el.tip.style.top = `${y}px`;
    el.tip.classList.toggle('below', y < 70);
  }

  function hideTip() {
    pinned = null;
    if (el.tip) el.tip.hidden = true;
  }

  function update(o) {
    opts = { ...opts, ...o };
    draw();
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  return { init, update };
})();

window.CivicMap = CivicMap;
