/* =====================================================================
   THE CIVIC FORECAST · the logic
   Pure functions over the data files. No DOM, no network. Every date is a
   'YYYY-MM-DD' string so comparisons are plain string compares.
   Add ?date=2026-11-03 to the URL to see the forecast for any day.
   ===================================================================== */

const Civic = (() => {
  const ELECTION = '2026-11-03';
  const DAY = 86400000;
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // BLS price regions (Census regions)
  const REGION = {};
  for (const [r, list] of Object.entries({
    northeast: 'ct me ma nh ri vt nj ny pa',
    midwest: 'il in mi oh wi ia ks mn mo ne nd sd',
    south: 'de dc fl ga md nc sc va wv al ky ms tn ar la ok tx',
    west: 'az co id mt nv nm ut wy ak ca hi or wa',
  })) list.split(' ').forEach((s) => { REGION[s] = r; });

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  const utc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const parts = (iso) => { const t = new Date(utc(iso)); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), w: t.getUTCDay() }; };
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY);
  const addDays = (iso, n) => new Date(utc(iso) + n * DAY).toISOString().slice(0, 10);

  function today() {
    const q = new URLSearchParams(location.search).get('date');
    if (/^\d{4}-\d{2}-\d{2}$/.test(q || '')) return q;
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  }

  const fmtDay = (iso) => { const p = parts(iso); return `${WD[p.w]}, ${MO[p.m]} ${p.d}`; };
  const fmtDate = (iso) => { const p = parts(iso); return `${MO[p.m]} ${p.d}`; };
  const weekday = (iso) => WDL[parts(iso).w];
  const dayParts = (iso) => { const p = parts(iso); return { wd: WD[p.w], mo: MO[p.m], dn: p.d }; };

  // "today", "tomorrow", "Thursday" (this week), or "Tue, Nov 10"
  function relDay(iso, from) {
    const n = daysBetween(from, iso);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n > 1 && n < 7) return weekday(iso);
    return fmtDay(iso);
  }

  // ---------- what's true in a state on a given day ----------
  function openLabel(kind) {
    if (/office/.test(kind || '')) return 'You can vote now at your election office';
    if (/absentee/.test(kind || '')) return 'In-person absentee voting is open';
    return 'Early voting is open';
  }

  // ---------- after this election: the next ones ----------
  // Counting and certifying run for weeks; after about a month the 2026 cycle
  // is history and each state's forecast turns to its next election.
  const CERTIFY = addDays(ELECTION, 30);
  let DATA = { next: {}, presPrimary: {}, localNote: {} };
  function use(civic) {
    DATA = civic || DATA;
    for (const [k, v] of Object.entries(civic?.voting || {})) v._code = k;
  }
  // dated elections from `d` on (inclusive), including a 2028 presidential primary if set
  function upcoming(code, d) {
    const list = (DATA.next?.[code] || []).filter((x) => x.date && x.date >= d);
    const p = DATA.presPrimary?.[code];
    if (p?.date && p.date >= d) list.push({ date: p.date, title: '2028 presidential primary', scope: 'statewide', what: p.text, source: p.source, confidence: p.confidence });
    return list.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  // lowercase a title's first letter mid-sentence, but only for ordinary opening
  // words: "Tax Day", "HealthCare.gov", "November election" keep their capitals
  const COMMON = new Set(('last clocks deadline estimated extended your general spring fall municipal primary special runoff ' +
    'statewide consolidated presidential school local election elections regular uniform city county state constitutional ' +
    'nonpartisan judicial partisan open').split(' '));
  const lower1 = (s) => (COMMON.has(String(s).split(/[\s:(]/)[0].toLowerCase()) ? s[0].toLowerCase() + s.slice(1) : s);

  // code: inperson | mail | wait | election | arriving | counting | between
  function stateNow(v, d) {
    if (!v) return null;
    const e = v.early || {}, m = v.mail || {};
    if (d === ELECTION) return { code: 'election', label: 'Polls are open today', short: 'Election Day' };
    if (d > ELECTION) {
      const nx = upcoming(v._code, d);
      if (nx[0] && nx[0].date === d) return { code: 'election', label: `${nx[0].title} today`, short: nx[0].title, next: nx[0] };
      if (m.returnRule === 'postmarked' && m.receivedBy && d <= m.receivedBy) {
        return { code: 'arriving', label: 'Mailed ballots are still arriving', short: 'Ballots arriving' };
      }
      if (d <= CERTIFY) return { code: 'counting', label: 'Counting the vote', short: 'Counting', next: nx[0] };
      if (nx[0]) return { code: 'between', label: `Next election: ${lower1(nx[0].title)}, ${fmtDay(nx[0].date)}`, short: `Next: ${fmtDate(nx[0].date)}`, next: nx[0] };
      return { code: 'between', label: 'No statewide election set yet. Local ones may be', short: 'Between elections' };
    }
    if (v.allMail) return { code: 'mail', label: 'Every voter here gets a ballot by mail', short: 'Vote by mail' };
    if (e.available && e.end && d <= e.end && (!e.start || d >= e.start)) {
      return { code: 'inperson', label: openLabel(e.kind), short: 'Vote early', varies: !e.start };
    }
    if (e.available && !e.start && !e.end) {
      // early voting exists but only in some counties, with no statewide dates (North Dakota)
      return { code: 'inperson', label: 'Early voting in some counties. Check yours', short: 'Some counties', varies: true };
    }
    if (e.available && e.start && d < e.start) {
      return { code: 'wait', label: `Early voting opens ${fmtDay(e.start)}`, short: 'Opens soon' };
    }
    const mailNote = m.noExcuse === false ? 'Mail ballots need a reason here' : 'You can still vote by mail or on Election Day';
    if (e.available && e.end && d > e.end) return { code: 'wait', label: 'Early voting is over. Next up: Election Day', short: 'Election Day next' };
    return { code: 'wait', label: `No early voting here. ${mailNote}`, short: 'Election Day' };
  }

  // the three map categories (a choropleth can carry three colors safely)
  function mapCategory(v, d) {
    const s = stateNow(v, d);
    if (!s) return null;
    if (d > CERTIFY) {
      // between elections the map shows how soon each state votes next
      const nx = upcoming(v._code, d)[0];
      if (!nx) return 'wait';
      const n = daysBetween(d, nx.date);
      return n <= 90 ? 'now' : n <= 365 ? 'mail' : 'wait';
    }
    if (s.code === 'election') return 'now';
    if (s.code === 'arriving') return 'mail';
    if (s.code === 'counting') return 'wait';
    return { inperson: 'now', mail: 'mail', wait: 'wait' }[s.code];
  }

  // ---------- alerts (most urgent first) ----------
  const RANK = { danger: 0, urgent: 1, headsup: 2, info: 3 };

  function alertsFor(v, d, live = {}) {
    const out = [];
    if (v) {
      const r = v.registration || {}, m = v.mail || {}, e = v.early || {};
      const now = stateNow(v, d);

      if (d === ELECTION) {
        out.push({
          level: 'urgent', icon: 'ballot', title: `Polls are open today, ${v.pollHours}`,
          text: "If you're in line when the polls close, stay in line. You still get to vote.",
          link: v.pollingPlaceUrl, linkText: 'Find your polling place',
        });
      }

      if (d < ELECTION) {
        // registration
        if (r.deadline && d <= r.deadline) {
          const n = daysBetween(d, r.deadline);
          out.push({
            level: n <= 3 ? 'urgent' : 'headsup', icon: 'pen',
            title: n === 0 ? 'Today is the last day to register' : `Register by ${relDay(r.deadline, d)}`,
            text: r.text, link: v.pollingPlaceUrl, linkText: 'Check or update your registration',
          });
        } else if (r.sameDay) {
          out.push({ level: 'info', icon: 'pen', title: "Not registered yet? You still can", text: r.sameDayText || r.text });
        } else if (r.deadline) {
          out.push({
            level: 'info', icon: 'check', title: 'Registration is closed here',
            text: "Make sure you're on the rolls before you go.", link: v.pollingPlaceUrl, linkText: 'Check your registration',
          });
        } else {
          out.push({ level: 'info', icon: 'check', title: 'No voter registration needed here', text: r.text });
        }

        // mail ballots
        if (m.returnRule === 'received' && m.receivedBy) {
          const n = daysBetween(d, m.receivedBy);
          out.push({
            level: n <= 7 ? 'urgent' : 'headsup', icon: 'mail',
            title: `Mail ballots have to arrive by ${relDay(m.receivedBy, d)}`,
            text: m.text,
            extra: n <= 7 ? 'Postmarks don’t count here. The Postal Service suggests mailing a ballot at least a week before it’s due, so dropping it off may be the safer move now.' : null,
            extraLink: n <= 7 ? 'https://about.usps.com/what/government-services/election-mail/' : null,
          });
        } else if (m.returnRule === 'postmarked') {
          out.push({
            level: 'info', icon: 'mail',
            title: `Mail ballots: postmark by ${fmtDay(m.postmarkBy || ELECTION)}`,
            text: m.text,
          });
        }

        // early voting
        if (now.code === 'inperson' && e.end) {
          const n = daysBetween(d, e.end);
          out.push({
            level: n <= 1 ? 'urgent' : n <= 4 ? 'headsup' : 'info', icon: 'ballot',
            title: n === 0 ? `${now.label}, but today is the last day` : `${now.label} through ${relDay(e.end, d)}`,
            text: e.text + (now.varies ? ' Days and hours vary by county.' : ''),
          });
        } else if (e.available && e.start && d < e.start) {
          out.push({ level: 'info', icon: 'ballot', title: `Early voting opens ${relDay(e.start, d)}`, text: e.text });
        }
      }

      if (d > ELECTION) {
        if (m.returnRule === 'postmarked' && m.receivedBy && d <= m.receivedBy) {
          out.push({
            level: 'info', icon: 'mail', title: `Mailed ballots can still arrive through ${fmtDay(m.receivedBy)}`,
            text: 'Ballots postmarked in time still count. Officials keep counting until then.',
          });
        } else if (d <= CERTIFY) {
          out.push({
            level: 'info', icon: 'ballot', title: 'Election Day has passed',
            text: 'Officials keep counting and checking ballots for days or weeks before the results are certified.',
          });
        }
        // the next elections: registration first, then the day itself
        for (const x of upcoming(v._code, d).slice(0, 2)) {
          const n = daysBetween(d, x.date);
          if (n > 75) continue;
          if (x.registrationDeadline && x.registrationDeadline >= d) {
            const k = daysBetween(d, x.registrationDeadline);
            out.push({
              level: k <= 3 ? 'urgent' : k <= 14 ? 'headsup' : 'info', icon: 'pen',
              title: k === 0 ? `Last day to register for the ${lower1(x.title)}` : `Register by ${relDay(x.registrationDeadline, d)} for the ${lower1(x.title)}`,
              text: r.sameDay ? 'You can also register in person when you vote here.' : 'Registering or updating your address takes a few minutes online in most states.',
              link: v.pollingPlaceUrl, linkText: 'Check or update your registration',
            });
          }
          out.push({
            level: n <= 1 ? 'urgent' : n <= 14 ? 'headsup' : 'info', icon: 'ballot',
            title: n === 0 ? `${x.title} today` : `${x.title}${x.ifNeeded ? ' (if needed)' : ''}: ${relDay(x.date, d)}`,
            text: x.what, link: x.source, linkText: 'Official details',
          });
        }
      }
    }

    // live conditions
    for (const a of live.nws || []) {
      out.push({
        level: a.severity === 'Extreme' || a.severity === 'Severe' ? 'danger' : a.severity === 'Moderate' ? 'urgent' : 'headsup',
        icon: 'storm', title: a.event, text: a.headline, link: live.nwsLink, linkText: 'National Weather Service',
      });
    }
    if (live.fema) {
      const f = live.fema;
      out.push({
        // "act soon" only when people here can actually apply for help themselves
        level: f.ihProgramDeclared ? 'urgent' : 'info', icon: 'shield',
        title: `Federal disaster declaration covers your county`,
        text: `${titleCase(f.declarationTitle)} (${f.incidentType.toLowerCase()}), declared ${fmtDate(f.declarationDate.slice(0, 10))}.` +
          (f.ihProgramDeclared ? ' People affected may be able to apply for help directly.' : ' This one funds local and state recovery work.'),
        link: f.ihProgramDeclared ? 'https://www.disasterassistance.gov/' : `https://www.fema.gov/disaster/${f.disasterNumber}`,
        linkText: f.ihProgramDeclared ? 'Apply at DisasterAssistance.gov' : 'Read the FEMA declaration',
      });
    }
    if (typeof live.aqi === 'number' && live.aqi > 100) {
      const a = aqiBand(live.aqi);
      out.push({ level: live.aqi > 150 ? 'danger' : 'headsup', icon: 'air', title: `Air quality: ${a.label.toLowerCase()} (AQI ${live.aqi})`, text: a.advice });
    }
    return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
  }

  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
  }

  // EPA Air Quality Index bands
  function aqiBand(n) {
    if (n <= 50) return { label: 'Good', advice: 'Air is clean. Go breathe some of it.' };
    if (n <= 100) return { label: 'Moderate', advice: 'Fine for most people. Very sensitive people may want to take it easy outside.' };
    if (n <= 150) return { label: 'Unhealthy for sensitive groups', advice: 'Kids, older adults, and people with asthma or heart conditions should cut back on long or hard time outside.' };
    if (n <= 200) return { label: 'Unhealthy', advice: 'Everyone should cut back on long or hard time outside today.' };
    if (n <= 300) return { label: 'Very unhealthy', advice: 'Everyone should avoid long or hard time outside today.' };
    return { label: 'Hazardous', advice: 'Stay inside if you can, and keep windows closed.' };
  }

  // ---------- the day-by-day civic forecast ----------
  // a window's closing day is only worth its own line if the calendar doesn't
  // already have an explicit "last day" item on that date
  const hasExplicit = (cal, c) => (cal || []).some((o) => o !== c && o.date === c.end && o.category === c.category);

  function calendarEvents(cal, d) {
    const ev = [];
    for (const c of cal || []) {
      if (c.category === 'vote') continue; // voting dates come from the state's own rules
      if (c.date === d) ev.push({ title: c.title, cat: c.category, text: c.text, source: c.source });
      else if (c.end && c.end === d && !hasExplicit(cal, c)) ev.push({ title: `Last day: ${c.title}`, cat: c.category, text: c.text, source: c.source });
    }
    return ev;
  }

  function stateEvents(v, d) {
    if (!v) return [];
    const ev = [], e = v.early || {}, m = v.mail || {}, r = v.registration || {};
    if (e.available && e.start === d) ev.push({ title: 'Early voting opens', cat: 'vote' });
    if (e.available && e.end === d) ev.push({ title: /office/.test(e.kind || '') ? 'Last day to vote at the election office' : 'Last day of early voting', cat: 'vote', strong: true });
    if (r.deadline === d) ev.push({ title: 'Last day to register', cat: 'vote', strong: true });
    if (m.receivedBy === d && d !== ELECTION) ev.push({ title: 'Last day mailed ballots can arrive', cat: 'vote' });
    for (const x of DATA.next?.[v._code] || []) {
      if (x.date === d) ev.push({ title: x.title + (x.ifNeeded ? ' (if needed)' : ''), cat: 'vote', strong: true, text: x.what, source: x.source });
      if (x.registrationDeadline === d) ev.push({ title: `Register by today for the ${lower1(x.title)}`, cat: 'vote', strong: true, text: x.what, source: x.source });
    }
    const p = DATA.presPrimary?.[v._code];
    if (p?.date === d) ev.push({ title: '2028 presidential primary', cat: 'vote', strong: true, text: p.text, source: p.source });
    return ev;
  }

  // "38 states", "8 states and D.C." (D.C. votes, but it isn't a state)
  function places(codes) {
    const dc = codes.includes('dc');
    const n = codes.length - (dc ? 1 : 0);
    if (!n && dc) return 'D.C.';
    return `${n} state${n === 1 ? '' : 's'}${dc ? ' and D.C.' : ''}`;
  }
  const names = (codes) => codes.map((c) => window.Live?.STATE_NAMES?.[c] || c.toUpperCase()).sort().join(', ');

  // nationally, the story of each day is which states open or close early voting
  function nationalEvents(voting, d) {
    if (d > ELECTION) {
      // after this election: which states vote on this day
      const voters = Object.keys(DATA.next || {}).filter((c) => (DATA.next[c] || []).some((x) => x.date === d && !x.ifNeeded) || DATA.presPrimary?.[c]?.date === d);
      return voters.length ? [{ title: `Elections in ${voters.length === 1 ? names(voters) : places(voters)}`, cat: 'vote', strong: true, text: voters.length > 1 ? names(voters) + '.' : null }] : [];
    }
    if (d === ELECTION) return [];
    const ends = [], starts = [];
    for (const [c, x] of Object.entries(voting || {})) {
      const e = x.early || {};
      if (x.allMail || !e.available) continue;
      if (e.end === d) ends.push(c);
      if (e.start === d) starts.push(c);
    }
    const ev = [];
    if (ends.length) ev.push({ title: `Early voting ends in ${ends.length === 1 ? names(ends) : places(ends)}`, cat: 'vote', strong: true, text: ends.length > 1 ? names(ends) + '.' : null });
    if (starts.length) ev.push({ title: `Early voting opens in ${starts.length === 1 ? names(starts) : places(starts)}`, cat: 'vote', text: starts.length > 1 ? names(starts) + '.' : null });
    return ev;
  }

  function forecastDays(v, voting, cal, d0, n = 14) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const d = addDays(d0, i);
      const ev = [];
      if (d === ELECTION) ev.push({ title: 'Election Day', cat: 'vote', strong: true });
      ev.push(...(v ? stateEvents(v, d) : nationalEvents(voting, d)), ...calendarEvents(cal, d));
      const cond = v ? stateNow(v, d) : nationalCondition(voting, d);
      out.push({ d, i, ...dayParts(d), today: i === 0, election: d === ELECTION, cond, ev });
    }
    return out;
  }

  // ---------- the national picture ----------
  // codes per map category, plus states whose early voting closes within 3 days
  function tally(voting, d) {
    const t = { now: [], mail: [], wait: [], endingSoon: [] };
    for (const [code, v] of Object.entries(voting || {})) {
      const c = mapCategory(v, d);
      if (!c) continue;
      t[c].push(code);
      const e = v.early || {};
      if (d < ELECTION && e.available && e.end && d <= e.end && daysBetween(d, e.end) <= 3 && !v.allMail) t.endingSoon.push(code);
    }
    t.voting = [...t.now, ...t.mail];
    return t;
  }

  // states with an election (not counting "if needed" runoffs) within `days` of d
  function votingSoon(d, days) {
    return Object.keys(DATA.next || {}).filter((c) => upcoming(c, d).some((x) => !x.ifNeeded && daysBetween(d, x.date) <= days));
  }

  function nationalCondition(voting, d) {
    if (d === ELECTION) return { code: 'election', label: 'Polls open nationwide', short: 'Election Day' };
    if (d > ELECTION && d <= CERTIFY) return { code: 'counting', label: 'Counting the vote', short: 'Counting' };
    if (d > CERTIFY) {
      const soon = votingSoon(d, 90);
      return { code: 'between', label: soon.length ? `${places(soon)} vote in the next 3 months` : 'A quiet stretch between elections', short: 'Between elections' };
    }
    const t = tally(voting, d);
    return { code: t.now.length ? 'inperson' : 'wait', label: `Voting is open in ${places(t.voting)}`, short: `${t.voting.length} voting` };
  }

  function nationalSentence(voting, d) {
    const n = daysBetween(d, ELECTION);
    const t = tally(voting, d);
    if (n === 0) return 'Polls are open across the country today. Hours depend on your state.';
    if (n < 0 && d <= CERTIFY) return 'Election Day has passed. Officials are counting and checking ballots, and states certify results over the coming weeks.';
    if (n < 0) {
      const soon = votingSoon(d, 90);
      return soon.length
        ? `${places(soon).replace(/^./, (c) => c.toUpperCase())} have elections in the next three months. Put in your ZIP to see yours, along with the deadlines coming up where you live.`
        : 'No statewide elections in the next three months. Local ones still happen, so put in your ZIP to see what’s coming where you live.';
    }
    let s = '';
    if (t.now.length) s += `Early voting is open in ${places(t.now)} today.`;
    if (t.mail.length) s += ` Another ${places(t.mail)} mail every voter a ballot.`;
    if (t.endingSoon.length >= 3) s += ` Early voting wraps up in ${places(t.endingSoon)} within three days.`;
    return s.trim();
  }

  // ---------- the hero number ----------
  function hero(v, voting, cal, d) {
    const n = daysBetween(d, ELECTION);
    if (n > 0) {
      return {
        big: String(n), unit: n === 1 ? 'day until Election Day' : 'days until Election Day',
        cond: v ? stateNow(v, d).label : `${places(tally(voting, d).voting).replace(/^./, (c) => c.toUpperCase())} are voting right now`,
        date: `Tuesday, November 3`,
      };
    }
    if (n === 0) return { big: 'Today', unit: 'is Election Day', cond: v ? `Polls are open ${v.pollHours}` : 'Polls are open across the country', date: 'Tuesday, November 3' };

    // after the election, lead with what's most useful next: an election
    // within ~6 weeks, else a deadline within a month, else whichever comes
    // first of the next election and the next big date (Tax Day, the end of
    // Medicare or HealthCare.gov enrollment). Clocks and holidays stay in the strip.
    const cond = v ? stateNow(v, d).label : nationalCondition(voting, d).label;
    const dated = (cal || [])
      .filter((c) => !['holiday', 'vote', 'clock'].includes(c.category))
      .map((c) => ({ c, when: c.date >= d ? c.date : c.end && c.end >= d && !hasExplicit(cal, c) ? c.end : null, ending: c.date < d }))
      .filter((x) => x.when)
      .sort((a, b) => (a.when < b.when ? -1 : 1));
    const deadline = dated[0];
    const major = dated.find((x) => x.c.major);
    // within a month the big dates win; smaller ones lead only inside two weeks
    const soonDeadline = major && daysBetween(d, major.when) <= 30 ? major
      : deadline && daysBetween(d, deadline.when) <= 14 ? deadline : null;
    const nx = v ? upcoming(v._code, d).find((x) => !x.ifNeeded) : null; // never count down to a maybe-runoff

    const forElection = (x) => {
      const k = daysBetween(d, x.date);
      const first = String(x.what || '').split(/(?<=\.)\s/)[0];
      return {
        big: k === 0 ? 'Today' : String(k),
        unit: k === 0 ? `is the ${lower1(x.title)}` : `${k === 1 ? 'day' : 'days'} until the ${lower1(x.title)}`,
        cond: d <= CERTIFY ? cond : first || cond, date: fmtDay(x.date),
      };
    };
    const forDeadline = (x) => {
      const k = daysBetween(d, x.when);
      return {
        big: k === 0 ? 'Today' : String(k),
        unit: k === 0 ? (x.ending ? `is the last day: ${x.c.title}` : x.c.title) : `${k === 1 ? 'day' : 'days'} until ${x.ending ? 'the last day of ' : ''}${lower1(x.c.title)}`,
        cond, date: fmtDay(x.when),
      };
    };
    if (nx && daysBetween(d, nx.date) <= 45) return forElection(nx);
    if (soonDeadline) return forDeadline(soonDeadline);
    if (nx && (!major || nx.date <= major.when)) return forElection(nx);
    if (major) return forDeadline(major);
    if (nx) return forElection(nx);
    if (deadline) return forDeadline(deadline);
    return { big: '·', unit: 'A quiet stretch on the civic calendar', cond, date: '' };
  }

  // ---------- what's on the ballot ----------
  function ballotFor(code, ballot) {
    const b = ballot || {};
    const races = ['U.S. House'];
    if (code === 'dc') races[0] = 'Delegate to the U.S. House';
    if ((b.senate?.regular || []).includes(code)) races.push('U.S. Senate');
    if ((b.senate?.special || []).includes(code)) races.push('U.S. Senate (special election)');
    if ((b.governor?.states || []).includes(code)) races.push('Governor');
    return races;
  }

  // ---------- the "further out" list ----------
  function ahead(cal, d, after) {
    return (cal || [])
      .filter((c) => c.category !== 'vote')
      .map((c) => ({ ...c, when: c.date > after ? c.date : c.end && c.end > after && c.date <= after && !hasExplicit(cal, c) ? c.end : null }))
      .filter((c) => c.when)
      .map((c) => ({ ...c, ending: c.when !== c.date }))
      .sort((a, b) => (a.when < b.when ? -1 : 1));
  }

  return {
    ELECTION, CERTIFY, REGION, use, upcoming, lower1, today, addDays, daysBetween, fmtDay, fmtDate, weekday, relDay, dayParts,
    stateNow, mapCategory, alertsFor, aqiBand, forecastDays, tally, places, nationalSentence, hero, ballotFor, ahead,
  };
})();

window.Civic = Civic;
