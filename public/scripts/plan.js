/* =====================================================================
   THE CIVIC FORECAST · your plan, your calendar, your sticker
   - Calendar: builds a standard .ics file of the dates that matter where
     you live, with a reminder the evening before. Your phone's calendar does
     the reminding, so nothing about you is stored anywhere.
   - Voting plan: pick how you'll vote and get your exact steps and dates.
     Saved only in this browser.
   - "I voted": draws a sticker you can share or save.
   Never says who to vote for.
   ===================================================================== */

const Plan = (() => {
  const KEY = 'cf-plan-v2';
  const SITE = 'https://civic-forecast.pages.dev';
  const NAMES = () => window.Live?.STATE_NAMES || {};

  // ---------- storage ----------
  const all = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const get = (st) => all()[st] || null;
  function set(st, value) {
    const a = all();
    if (value) a[st] = { ...(a[st] || {}), ...value }; else delete a[st];
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {}
  }

  // ---------- calendar (.ics, RFC 5545) ----------
  const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) {
    // lines longer than 75 octets wrap with CRLF + space; 70 chars keeps multibyte text safe
    const out = [];
    let s = line;
    while (s.length > 70) { out.push(s.slice(0, 70)); s = ' ' + s.slice(70); }
    out.push(s);
    return out.join('\r\n');
  }
  const compact = (iso) => iso.replace(/-/g, '');

  function ics(events, calName) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Accelerant//The Civic Forecast//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsText(calName)}`];
    for (const e of events) {
      L.push('BEGIN:VEVENT', `UID:${e.uid}@civic-forecast.pages.dev`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(Civic.addDays(e.date, 1))}`,
        `SUMMARY:${icsText(e.title)}`, `DESCRIPTION:${icsText([e.text, e.url ? `More: ${e.url}` : '', `From The Civic Forecast: ${SITE}`].filter(Boolean).join('\n\n'))}`,
        'TRANSP:TRANSPARENT');
      if (e.url) L.push(`URL:${e.url}`);
      // all-day events start at midnight: -15h is 9 a.m. the day before; +7h is 7 a.m. the day of
      for (const t of e.alarms || ['-PT15H']) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, `TRIGGER:${t}`, 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  function download(text, filename) {
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // every date that matters where you live, from today on
  function stateEvents(st, v, today, method) {
    const name = NAMES()[st] || st.toUpperCase();
    const e = v.early || {}, m = v.mail || {}, r = v.registration || {};
    const ev = [];
    const add = (o) => { if (o.date && o.date >= today) ev.push({ uid: `${st}-${o.id}-2026`, ...o }); };
    const want = (k) => !method || method === k;

    if (!method && r.deadline) add({ id: 'register', date: r.deadline, title: `Last day to register to vote (${name})`, text: r.text, url: v.pollingPlaceUrl });
    if (want('early') && e.available && !v.allMail) {
      if (!method && e.start) add({ id: 'early-open', date: e.start, title: `Early voting opens in ${name}`, text: e.text, url: v.pollingPlaceUrl, alarms: [] });
      if (e.end) add({ id: 'early-last', date: e.end, title: method ? 'Vote early: last day' : `Last day of early voting (${name})`, text: e.text, url: v.pollingPlaceUrl, alarms: ['-PT15H', 'PT7H'] });
    }
    if (want('mail') && m.receivedBy) {
      if (m.returnRule === 'received') {
        const safe = Civic.addDays(m.receivedBy, -7);
        if (method) add({ id: 'mail-send', date: safe > today ? safe : today, title: 'Send your mail ballot back', text: `It has to arrive by ${Civic.fmtDay(m.receivedBy)}. The Postal Service suggests mailing a week ahead; dropping it off is quicker. ${m.text}`, url: v.official });
        add({ id: 'mail-due', date: m.receivedBy, title: `Mail ballots must arrive today (${name})`, text: m.text, url: v.official });
      } else {
        add({ id: 'mail-postmark', date: m.postmarkBy || Civic.ELECTION, title: `Mail ballots need today's postmark (${name})`, text: m.text, url: v.official });
      }
    }
    if (want('election') || !method) {
      // a short title reads cleanly in calendar views; the hours (which vary in format) go in the description
      add({ id: 'election', date: Civic.ELECTION, title: `Election Day (${name})`, text: `Polls are open ${v.pollHours}\n\nFind your polling place before you go. If you're in line when the polls close, stay in line.`, url: v.pollingPlaceUrl, alarms: ['-PT15H', 'PT7H'] });
    }
    return ev;
  }

  function lifeEvents(cal, today) {
    return (cal || [])
      .filter((c) => !['holiday', 'vote'].includes(c.category))
      .flatMap((c) => {
        const out = [];
        if (c.date >= today) out.push({ uid: `${c.id}-start`, date: c.date, title: c.title, text: c.text, url: c.source });
        return out;
      });
  }

  function addAllToCalendar({ st, v, cal, today }) {
    const events = [...(v ? stateEvents(st, v, today) : []), ...lifeEvents(cal, today)].sort((a, b) => (a.date < b.date ? -1 : 1));
    const name = v ? `Civic Forecast · ${NAMES()[st]}` : 'Civic Forecast';
    download(ics(events, name), `civic-forecast${v ? '-' + st : ''}.ics`);
    return events.length;
  }

  function addPlanToCalendar({ st, v, today, method }) {
    const events = stateEvents(st, v, today, method);
    download(ics(events, `My voting plan · ${NAMES()[st]}`), `my-voting-plan-${st}.ics`);
    return events.length;
  }

  // ---------- the plan card ----------
  function options(v, today) {
    const e = v.early || {}, m = v.mail || {};
    const earlyOpen = e.available && !v.allMail && e.end && today <= e.end;
    return [
      { k: 'early', label: 'Early, in person', ok: earlyOpen, why: !e.available || v.allMail ? 'No early in-person voting here' : 'Early voting has ended here' },
      { k: 'mail', label: v.allMail ? 'With the ballot they mailed me' : 'By mail', ok: today <= (m.receivedBy || Civic.ELECTION), why: 'Too late to mail it back' },
      { k: 'election', label: 'On Election Day', ok: today <= Civic.ELECTION, why: '' },
    ];
  }

  function steps(method, v, today) {
    const e = v.early || {}, m = v.mail || {};
    const days = (iso) => Civic.relDay(iso, today);
    if (method === 'early') {
      return [
        { when: e.end ? `Through ${days(e.end)}` : 'Dates vary', what: 'Vote early in person', how: e.text, link: v.pollingPlaceUrl, linkText: 'Find a place to vote' },
        { when: 'Before you go', what: 'Check what to bring', how: 'Some states ask for ID. Your state\'s election site says exactly what counts.', link: v.official, linkText: 'What your state asks for' },
      ];
    }
    if (method === 'mail') {
      const out = [];
      if (!v.allMail && m.noExcuse === false) out.push({ when: 'First', what: 'Mail ballots need a reason here', how: 'Check that you qualify before counting on it.', link: v.official, linkText: 'Who can vote by mail' });
      out.push({ when: 'Now', what: 'Fill it out and sign the envelope', how: 'A missing or mismatched signature is one of the most common reasons a mail ballot doesn\'t count.' });
      out.push({
        when: m.returnRule === 'received' ? `Arrive by ${days(m.receivedBy)}` : `Postmark by ${days(m.postmarkBy || Civic.ELECTION)}`,
        what: m.returnRule === 'received' ? 'Get it back in time. It has to arrive, not just be mailed' : 'Get it postmarked in time',
        how: m.text,
      });
      return out;
    }
    return [
      { when: 'Tuesday, Nov 3', what: `Polls are open ${v.pollHours}`, how: 'Your polling place on Election Day can be different from where you voted before, so look it up.', link: v.pollingPlaceUrl, linkText: 'Find your polling place' },
      { when: 'Before you go', what: 'Check what to bring', how: 'Some states ask for ID. Your state\'s election site says exactly what counts.', link: v.official, linkText: 'What your state asks for' },
      { when: 'If there\'s a line', what: 'Stay in it', how: 'If you\'re in line when the polls close, you still get to vote.' },
    ];
  }

  // ---------- the "I voted" sticker ----------
  async function sticker(stateName) {
    try { await document.fonts.ready; } catch {}
    const S = 1080, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const bg = g.createRadialGradient(S / 2, S * 0.3, 40, S / 2, S / 2, S * 0.75);
    bg.addColorStop(0, '#1d2a4a'); bg.addColorStop(1, '#0a0e1a');
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    // the two fronts
    const blob = (x, y, rx, ry, color) => {
      const gr = g.createRadialGradient(x, y, 10, x, y, rx);
      gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    };
    blob(S * 0.36, S * 0.40, S * 0.42, S * 0.22, 'rgba(57,135,229,0.55)');
    blob(S * 0.66, S * 0.62, S * 0.44, S * 0.22, 'rgba(232,154,79,0.5)');
    // the sticker
    g.save();
    g.translate(S / 2, S / 2);
    g.fillStyle = '#f4f1ea';
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
    g.beginPath(); g.ellipse(0, 0, 400, 290, 0, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#0a0e1a'; g.lineWidth = 6;
    g.beginPath(); g.ellipse(0, 0, 372, 262, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#0a0e1a'; g.textAlign = 'center';
    g.font = 'italic 600 168px "Inter Tight", "Helvetica Neue", Arial, sans-serif';
    g.fillText('I voted', 0, 40);
    g.font = '600 34px "JetBrains Mono", Menlo, monospace';
    g.fillText(String(stateName).toUpperCase().split('').join(' ').slice(0, 44), 0, 118);
    g.font = '500 30px "Inter", Arial, sans-serif';
    g.fillStyle = '#3a4252';
    g.fillText('2026', 0, -150);
    g.restore();
    g.fillStyle = '#b3bacb'; g.textAlign = 'center';
    g.font = '500 30px "Inter", Arial, sans-serif';
    g.fillText('Make your plan at civic-forecast.pages.dev', S / 2, S - 70);
    return new Promise((res) => c.toBlob((b) => res({ blob: b, url: c.toDataURL('image/png') }), 'image/png'));
  }

  async function shareSticker(st, img) {
    const name = NAMES()[st] || '';
    const text = `I voted. Your deadlines and your plan are here: ${SITE}/?st=${st}`;
    const file = new File([img.blob], 'i-voted.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text, title: `I voted · ${name}` }); return 'shared'; } catch { return 'closed'; }
    }
    const a = Object.assign(document.createElement('a'), { href: img.url, download: 'i-voted.png' });
    document.body.appendChild(a); a.click(); a.remove();
    try { await navigator.clipboard.writeText(text); } catch {}
    return 'saved';
  }

  return { get, set, options, steps, addAllToCalendar, addPlanToCalendar, sticker, shareSticker };
})();

window.Plan = Plan;
