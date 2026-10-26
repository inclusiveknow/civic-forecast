/* =====================================================================
   THE CIVIC FORECAST · the app
   Loads the three data files, figures out where you are (ZIP, location, a
   state, or nowhere yet), and renders the forecast. Live local conditions
   (weather, air, NWS alerts, FEMA) arrive a moment later and slot in.
   ===================================================================== */

const App = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const PLACE_KEY = 'cf-place-v2';

  const S = { civic: null, rent: null, econ: null, today: Civic.today(), place: null, live: {}, selDay: 0, alertsOpen: false };
  const CAT_ICON = { vote: 'ballot', health: 'health', money: 'money', benefits: 'benefits', clock: 'clock', holiday: 'holiday', tax: 'tax' };
  const COND_ICON = { inperson: 'ballot', mail: 'mail', wait: 'calendar', election: 'star', arriving: 'mail', counting: 'check' };

  async function getJSON(p) {
    try { const r = await fetch(p, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; }
  }

  // ---------- place ----------
  const saved = () => { try { return JSON.parse(localStorage.getItem(PLACE_KEY)); } catch { return null; } };
  const save = (p) => { try { p ? localStorage.setItem(PLACE_KEY, JSON.stringify(p)) : localStorage.removeItem(PLACE_KEY); } catch {} };

  async function placeFromURL() {
    const q = new URLSearchParams(location.search);
    const z = (q.get('zip') || '').trim();
    if (/^\d{5}$/.test(z)) return Live.placeFromZip(z, S.rent);
    const st = (q.get('st') || '').toLowerCase();
    if (Live.STATE_NAMES[st]) return { state: st, stateOnly: true };
    return null;
  }

  function placeLabel(p, long) {
    if (!p) return 'United States';
    const st = p.state.toUpperCase();
    if (p.city) return `${p.city}, ${st}`;
    if (p.countyName && long) return `${p.countyName}, ${st}`;
    return Live.STATE_NAMES[p.state];
  }

  async function setPlace(p, { persist = true } = {}) {
    S.place = p;
    S.live = {};
    S.selDay = 0;
    if (persist && p && !p.stateOnly) save(p);
    // keep the address bar shareable without carrying a ZIP around
    const url = new URL(location.href);
    url.searchParams.delete('zip');
    if (p?.stateOnly) url.searchParams.set('st', p.state); else url.searchParams.delete('st');
    history.replaceState(null, '', url);
    render();
    CivicMap.update({ home: p?.state || null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (p?.lat != null) {
      const live = await Live.conditions(p);
      if (S.place !== p) return; // they moved on
      S.live = live;
      renderWeather(); renderAlerts(); renderTiles();
    }
  }

  // ---------- render ----------
  function render() {
    const v = S.place ? S.civic?.voting?.[S.place.state] : null;
    const h = Civic.hero(v, S.civic?.voting, S.civic?.calendar, S.today);
    const cond = v ? Civic.stateNow(v, S.today) : null;
    document.body.dataset.sky = cond?.code || (S.today === Civic.ELECTION ? 'election' : S.today > Civic.ELECTION ? 'counting' : 'inperson');
    document.title = S.place ? `${placeLabel(S.place)} · The Civic Forecast` : "The Civic Forecast · what's coming where you live";

    renderChip(); renderWeather(); renderHero(v, h); renderFind(); renderAlerts();
    renderStrip(v); renderVote(v); renderTiles(); renderAhead();
  }

  function renderChip() {
    const b = $('#place-chip');
    b.hidden = !S.place;
    if (S.place) b.innerHTML = `${ICONS.pin}<span>${esc(placeLabel(S.place))}</span>`;
  }

  function renderWeather() {
    const w = S.live.weather, el = $('#wx');
    el.hidden = !w;
    if (!w) return;
    el.innerHTML = `${ICONS[w.icon] || ICONS.cloud}<span>${w.temp}°</span><small>${esc(w.label.toLowerCase())}</small>`;
    el.tabIndex = 0;
    el.dataset.quip = `That's the regular weather: ${w.temp}° and ${w.label.toLowerCase()}. Everything else on this page is the civic kind.`;
    el.setAttribute('aria-label', el.dataset.quip);
  }

  function renderHero(v, h) {
    const d = S.today;
    let line = '';
    if (v) {
      const next = Civic.forecastDays(v, S.civic.voting, S.civic.calendar, d, 14)
        .flatMap((x) => x.ev.map((e) => ({ ...e, d: x.d })))
        .find((e) => (e.d > d || (e.d === d && e.strong)) && !(e.d === d && e.title === 'Election Day'));
      if (next) line = `Next up: ${next.title}, ${Civic.relDay(next.d, d)}.`;
      if (S.place.stateOnly) line += ' Put in your ZIP for rent, air, and local alerts.';
    } else {
      line = Civic.nationalSentence(S.civic?.voting, d);
    }
    const word = !/^\d+$/.test(h.big);
    $('#hero').innerHTML = `
      <div class="hero-place">${ICONS.pin}<span>${esc(placeLabel(S.place, true))}</span></div>
      <div class="hero-big"><span class="hero-num${word ? ' word' : ''}">${esc(h.big)}</span><span class="hero-unit">${esc(h.unit)}</span></div>
      <p class="hero-cond">${esc(h.cond)}</p>
      ${line ? `<p class="hero-line">${esc(line)}</p>` : ''}
      <div class="hero-actions">
        ${S.place ? `<button class="pill-btn" type="button" data-act="change">${ICONS.pin}Change place</button>` : ''}
        <button class="pill-btn" type="button" data-act="share">${ICONS.share}Share this forecast</button>
      </div>`;
  }

  function renderFind() {
    const f = $('#find');
    f.classList.toggle('compact', !!S.place);
    // with a place set, the finder tucks to the bottom of the page; without one it leads
    if (S.place) $('main').appendChild(f); else $('#hero').after(f);
    f.querySelector('h2').textContent = S.place ? 'Check somewhere else' : "What's the civic weather where you live?";
    $('#find-msg').textContent = '';
  }

  function renderAlerts() {
    const v = S.place ? S.civic?.voting?.[S.place.state] : null;
    const box = $('#alerts');
    if (!v) { box.innerHTML = ''; return; }
    const list = Civic.alertsFor(v, S.today, S.live);
    const TAG = { danger: 'Warning', urgent: 'Act soon', headsup: 'Heads up', info: 'Good to know' };
    const show = S.alertsOpen ? list : list.slice(0, 3);
    box.innerHTML = show.map((a) => `
      <article class="alert ${a.level}">
        <div class="alert-ic">${ICONS[a.icon] || ICONS.alert}</div>
        <span class="alert-tag">${TAG[a.level]}</span>
        <h3>${esc(a.title)}</h3>
        <div>
          ${a.text ? `<p>${esc(a.text)}</p>` : ''}
          ${a.extra ? `<p class="extra">${esc(a.extra)}${a.extraLink ? ` <a href="${esc(a.extraLink)}" target="_blank" rel="noopener">USPS ${ICONS.out}</a>` : ''}</p>` : ''}
          ${a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.linkText || 'More')} ${ICONS.out}</a>` : ''}
        </div>
      </article>`).join('') +
      (list.length > 3 ? `<button class="link-btn alerts-more" type="button" data-act="alerts">${S.alertsOpen ? 'Show fewer' : `Show all ${list.length}`}</button>` : '');
  }

  function renderStrip(v) {
    const days = Civic.forecastDays(v, S.civic?.voting, S.civic?.calendar, S.today, 14);
    $('#strip-title').textContent = v ? `Your next 14 days in ${Live.STATE_NAMES[S.place.state]}` : 'The next 14 days';
    $('#strip-meta').textContent = 'tap a day';
    $('#strip').innerHTML = days.map((x) => {
      const top = x.ev.find((e) => e.strong) || x.ev[0];
      const icon = x.election ? 'star' : top ? CAT_ICON[top.cat] || 'calendar' : COND_ICON[x.cond?.code] || 'calendar';
      return `<li class="day c-${x.cond?.code || ''} ${x.today ? 'today' : ''} ${x.election ? 'election' : ''} ${x.ev.length ? 'has' : ''} ${x.i === S.selDay ? 'sel' : ''}">
        <button type="button" data-day="${x.i}" aria-label="${esc(`${x.wd} ${x.mo} ${x.dn}: ${x.ev.map((e) => e.title).join(', ') || x.cond?.short || ''}`)}">
          <span class="dw">${x.wd}</span><span class="dd">${x.mo} ${x.dn}</span>
          <span class="di">${ICONS[icon]}</span>
          ${x.ev.slice(0, 2).map((e) => `<span class="de ${e.strong ? 'strong' : ''}">${esc(e.title)}</span>`).join('')}
          ${x.ev.length ? '' : `<span class="dc">${esc(x.cond?.short || '')}</span>`}
        </button></li>`;
    }).join('');
    renderDay(days[S.selDay], v);
  }

  function renderDay(x, v) {
    if (!x) return;
    const rows = x.ev.map((e) => `<div class="dd-row">${ICONS[CAT_ICON[e.cat] || 'calendar']}<div><b>${esc(e.title)}</b>${e.text ? `<p>${esc(e.text)}</p>` : ''}${e.source ? `<a href="${esc(e.source)}" target="_blank" rel="noopener">${esc(host(e.source))}</a>` : ''}</div></div>`);
    if (x.cond && v) rows.push(`<div class="dd-row">${ICONS[COND_ICON[x.cond.code] || 'calendar']}<div><b>${esc(x.cond.label)}</b></div></div>`);
    if (!v && x.cond) rows.push(`<div class="dd-row">${ICONS.ballot}<div><b>${esc(x.cond.label)}</b><p>Pick a place to see exactly what's open where you vote.</p></div></div>`);
    $('#day-detail').innerHTML = `<div class="dd-head">${x.today ? 'Today' : Civic.weekday(x.d)}, ${x.mo} ${x.dn}</div>${rows.join('')}`;
  }

  function renderVote(v) {
    const pair = $('#vote-pair');
    pair.hidden = !v;
    if (!v) return;
    const code = S.place.state;
    const races = Civic.ballotFor(code, S.civic.ballot);
    const sq = (S.civic.races || []).filter((r) => r.state === code);
    const after = S.today > Civic.ELECTION;

    $('#ballot').innerHTML = `
      <div class="card-head"><h2 id="ballot-title">${after ? 'Was on the ballot' : 'On your ballot'}, Nov 3</h2></div>
      <ul class="races">${races.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="plus">Plus state and local races, and any ballot questions. Your exact ballot depends on your address.</p>
      ${sq.map((r) => `
        <a class="sq" href="${esc(r.url)}" target="_blank" rel="noopener">
          <span class="sq-k">Hear them answer the same questions</span>
          <b>${esc(r.office)}: ${esc(r.candidates.join(' vs. '))}</b>
          <span>Their real debate answers with names hidden, so you pick on what was said. ${esc(r.note || '')}</span>
          <span class="go-arrow">Open Same Question ${ICONS.out}</span>
        </a>`).join('')}
      <div class="links">
        <a href="${esc(v.pollingPlaceUrl)}" target="_blank" rel="noopener"><span>Look up your polling place and registration</span>${ICONS.out}</a>
        <a href="${esc(v.official)}" target="_blank" rel="noopener"><span>${esc(Live.STATE_NAMES[code])} elections office</span>${ICONS.out}</a>
      </div>`;

    const e = v.early || {}, m = v.mail || {}, r = v.registration || {};
    const rows = [
      ['ballot', e.available ? 'Early, in person' : 'Early, in person', e.text || 'No early in-person voting here.'],
      ['mail', v.allMail ? 'By mail (everyone gets a ballot)' : 'By mail', m.text],
      ['star', 'On Election Day', `Polls are open ${String(v.pollHours).replace(/[.\s]+$/, '')}.`],
      // same-day details live in the alert above; here, the state's own summary
      ['pen', 'Registering', r.text || r.sameDayText],
    ];
    $('#howto').classList.add('howto');
    $('#howto').innerHTML = `
      <div class="card-head"><h2 id="howto-title">How to vote in ${esc(Live.STATE_NAMES[code])}</h2></div>
      <dl>${rows.map(([ic, k, t]) => `<div class="row">${ICONS[ic]}<dt>${esc(k)}</dt><dd>${esc(t)}</dd></div>`).join('')}</dl>
      ${v.note ? `<details class="goodto"><summary>Good to know</summary><p>${esc(v.note)}</p></details>` : ''}
      ${v.confidence === 'medium' ? `<div class="verify">${ICONS.alert}Some details here couldn't be fully confirmed. Double-check with your state.</div>` : ''}
      <p class="source">From <a href="${esc(v.official)}" target="_blank" rel="noopener">${esc(host(v.official))}</a> and other official ${esc(Live.STATE_NAMES[code])} sources, checked ${esc(Civic.fmtDate(v.checked || S.civic.checked))}. Rules can change, so confirm with your state.</p>`;
  }

  function rentFor(p) {
    const R = S.rent;
    if (!R) return null;
    if (p?.zip && R.zip[p.zip]) return { v: R.zip[p.zip], where: `ZIP ${p.zip}` };
    if (p?.countyFips && R.county[p.countyFips]) return { v: R.county[p.countyFips], where: R.county[p.countyFips][2] };
    if (p?.state && R.state[p.state]) return { v: R.state[p.state], where: `${Live.STATE_NAMES[p.state]}, across the ZIPs Zillow tracks` };
    return { v: R.us, where: 'the U.S., across the ZIPs Zillow tracks' };
  }

  const REGION_NAME = { northeast: 'Northeast', midwest: 'Midwest', south: 'South', west: 'West', us: 'U.S.' };
  const delta = (n, words) => `<span class="tile-d">${ICONS[n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'flat']}${esc(words)}</span>`;
  const signed = (n) => `${n > 0 ? '+' : ''}${n}%`;

  function renderTiles() {
    const p = S.place, E = S.econ, R = S.rent, tiles = [];
    const reg = p ? Civic.REGION[p.state] || 'us' : 'us';
    $('#life-title').textContent = p ? `Life in ${p.city || Live.STATE_NAMES[p.state]}` : 'Life across the country';
    $('#life-meta').textContent = 'compared with a year ago';

    const r = rentFor(p);
    if (r) {
      const [val, yoy] = r.v;
      tiles.push(`<div class="tile">
        <div class="tile-k">${ICONS.home}Rent</div>
        <div class="tile-v">$${val.toLocaleString()}<small>/mo</small></div>
        ${delta(yoy, `${yoy >= 0 ? 'up' : 'down'} ${Math.abs(yoy)}% in a year`)}
        <p class="tile-t">Typical asking rent in ${esc(r.where)}.${p ? ` U.S.: $${R.us[0].toLocaleString()}.` : ''}</p>
        <p class="tile-s">Zillow, ${esc(monthYear(R.asof))}</p></div>`);
    }
    const pr = E?.prices?.[reg], us = E?.prices?.us;
    const priceTile = (key, icon, label, noun) => {
      const c = pr?.[key]?.change;
      if (c == null) return;
      const more = c >= 0 ? 'more' : 'less';
      tiles.push(`<div class="tile">
        <div class="tile-k">${ICONS[icon]}${label}</div>
        <div class="tile-v">${signed(c)}</div>
        <p class="tile-t">${esc(noun)} costs about ${Math.abs(c)}% ${more} than a year ago${reg !== 'us' ? ` in the ${REGION_NAME[reg]}` : ''}.${reg !== 'us' && us?.[key] ? ` U.S.: ${signed(us[key].change)}.` : ''}</p>
        <p class="tile-s">BLS consumer prices, ${esc(pr[key].month)}</p></div>`);
    };
    priceTile('groceries', 'cart', 'Groceries', 'Food from the store');
    priceTile('gas', 'fuel', 'Gas', 'Gasoline');
    priceTile('electricity', 'bolt', 'Electricity', 'Electricity');

    const j = E?.jobs?.[p?.state] || E?.jobs?.us;
    if (j) {
      const where = p && E.jobs[p.state] ? Live.STATE_NAMES[p.state] : 'the U.S.';
      const ch = j.yearAgo != null ? +(j.value - j.yearAgo).toFixed(1) : null;
      tiles.push(`<div class="tile">
        <div class="tile-k">${ICONS.work}Jobs</div>
        <div class="tile-v">${j.value}%<small>unemployed</small></div>
        ${ch != null ? delta(ch, ch === 0 ? `same as a year ago` : `${ch > 0 ? 'up' : 'down'} from ${j.yearAgo}% a year ago`) : ''}
        <p class="tile-t">Share of people in ${esc(where)} who want work and can't find it.${where !== 'the U.S.' && E.jobs.us ? ` U.S.: ${E.jobs.us.value}%.` : ''}</p>
        <p class="tile-s">BLS, ${esc(j.month)}</p></div>`);
    }
    const aqi = S.live.aqi;
    if (typeof aqi === 'number') {
      const b = Civic.aqiBand(aqi);
      tiles.push(`<div class="tile air">
        <div class="tile-k">${ICONS.air}Air right now</div>
        <div class="tile-v"><b>${aqi}</b><small>AQI</small></div>
        <span class="aqi-band">${esc(b.label)}</span>
        <p class="tile-t">${esc(b.advice)}</p>
        <p class="tile-s">Open-Meteo, U.S. EPA scale</p></div>`);
    }
    $('#tiles').innerHTML = tiles.join('');
  }

  function renderAhead() {
    const cal = S.civic?.calendar || [], d = S.today, end14 = Civic.addDays(d, 13);
    const open = cal.filter((c) => c.end && c.date <= d && c.end >= d && c.category !== 'vote');
    $('#now-on').innerHTML = open.map((c) => `<span class="now-chip">${ICONS[CAT_ICON[c.category] || 'calendar']}<span><b>Open now:</b> ${esc(c.title)}, through ${esc(Civic.fmtDate(c.end))}</span></span>`).join('');
    const items = Civic.ahead(cal, d, end14).slice(0, 8);
    $('#ahead').innerHTML = items.map((c) => {
      const p = Civic.dayParts(c.when);
      return `<li><div class="when"><b>${p.dn}</b><span>${p.mo}</span></div>
        <div><h3>${ICONS[CAT_ICON[c.category] || 'calendar']}${esc(c.ending ? `Last day: ${c.title}` : c.title)}</h3>
        <p>${esc(c.text)}</p><a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(host(c.source))}</a></div></li>`;
    }).join('') || '<li><p>Nothing big on the national calendar past the next two weeks.</p></li>';
  }

  const monthYear = (ym) => {
    if (!ym) return '';
    const [y, m] = ym.split('-').map(Number);
    return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`;
  };

  // ---------- interactions ----------
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  async function share() {
    const h = Civic.hero(S.place ? S.civic.voting[S.place.state] : null, S.civic.voting, S.civic.calendar, S.today);
    const url = `${location.origin}${location.pathname}${S.place ? `?st=${S.place.state}` : ''}`;
    const where = S.place ? Live.STATE_NAMES[S.place.state] : 'the U.S.';
    const text = `The civic forecast for ${where}: ${h.big} ${h.unit}. ${h.cond}.`;
    if (navigator.share) {
      try { await navigator.share({ title: 'The Civic Forecast', text, url }); return; } catch { /* closed the sheet */ }
    }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied'); } catch { prompt('Copy this link', url); }
  }

  function wire() {
    document.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'share') share();
      if (act === 'change') { $('#find').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('#zip').focus(), 400); }
      if (act === 'alerts') { S.alertsOpen = !S.alertsOpen; renderAlerts(); }
      const day = e.target.closest('[data-day]');
      if (day) {
        S.selDay = +day.dataset.day;
        document.querySelectorAll('.day').forEach((li, i) => li.classList.toggle('sel', i === S.selDay));
        const v = S.place ? S.civic.voting[S.place.state] : null;
        renderDay(Civic.forecastDays(v, S.civic.voting, S.civic.calendar, S.today, 14)[S.selDay], v);
      }
      const pick = e.target.closest('[data-pick]');
      if (pick) { e.preventDefault(); setPlace({ state: pick.dataset.pick, stateOnly: true }, { persist: false }); }
    });
    $('#place-chip').addEventListener('click', () => { $('#find').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('#zip').focus(), 400); });

    $('#find-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const z = $('#zip').value.trim();
      const msg = $('#find-msg');
      if (!/^\d{5}$/.test(z)) { msg.textContent = 'Five digits, please.'; return; }
      msg.textContent = 'Looking that up…';
      const p = await Live.placeFromZip(z, S.rent);
      if (!p) { msg.textContent = "We couldn't find that ZIP. Try another, or pick your state."; return; }
      $('#zip').value = '';
      setPlace(p);
    });

    const loc = $('#locate');
    loc.innerHTML = `${ICONS.locate}<span>Use my location</span>`;
    if (!navigator.geolocation) loc.hidden = true;
    loc.addEventListener('click', () => {
      const msg = $('#find-msg');
      msg.textContent = 'Finding you…';
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const p = await Live.placeFromCoords(pos.coords.latitude, pos.coords.longitude);
        if (!p) { msg.textContent = "We couldn't place that location in a U.S. state."; return; }
        setPlace(p);
      }, () => { msg.textContent = 'Location is off. Try your ZIP instead.'; }, { timeout: 10000, maximumAge: 600000 });
    });

    const sel = $('#state-pick');
    sel.innerHTML += Object.entries(Live.STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
    sel.addEventListener('change', () => { if (sel.value) setPlace({ state: sel.value, stateOnly: true }, { persist: false }); sel.value = ''; });
  }

  async function init() {
    [S.civic, S.rent, S.econ] = await Promise.all([getJSON('data/civic.json'), getJSON('data/rent.json'), getJSON('data/econ.json')]);
    if (!S.civic) {
      $('#hero').innerHTML = '<p class="hero-cond">The forecast couldn’t load. Try again in a minute.</p>';
      return;
    }
    wire();
    const fromURL = await placeFromURL();
    const p = fromURL || saved();
    await CivicMap.init($('#map-card'), { voting: S.civic.voting, rent: S.rent, econ: S.econ, today: S.today, home: p?.state || null });
    setPlace(p, { persist: !!fromURL && !fromURL.stateOnly });
  }

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  return { init };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.init);
else App.init();
