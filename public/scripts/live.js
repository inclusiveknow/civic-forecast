/* =====================================================================
   THE CIVIC FORECAST · live, local lookups
   All free public services that allow browser calls, no keys, no cost.
   Every call has a timeout and resolves to null/[] on failure, so one slow
   service never blanks the page. Nothing about the visitor is sent anywhere
   except the ZIP or coordinates each lookup needs.
   ===================================================================== */

const Live = (() => {
  const STATE_FIPS = {
    al: '01', ak: '02', az: '04', ar: '05', ca: '06', co: '08', ct: '09', de: '10', dc: '11', fl: '12', ga: '13',
    hi: '15', id: '16', il: '17', in: '18', ia: '19', ks: '20', ky: '21', la: '22', me: '23', md: '24', ma: '25',
    mi: '26', mn: '27', ms: '28', mo: '29', mt: '30', ne: '31', nv: '32', nh: '33', nj: '34', nm: '35', ny: '36',
    nc: '37', nd: '38', oh: '39', ok: '40', or: '41', pa: '42', ri: '44', sc: '45', sd: '46', tn: '47', tx: '48',
    ut: '49', vt: '50', va: '51', wa: '53', wv: '54', wi: '55', wy: '56',
  };
  const STATE_NAMES = {
    al: 'Alabama', ak: 'Alaska', az: 'Arizona', ar: 'Arkansas', ca: 'California', co: 'Colorado', ct: 'Connecticut',
    de: 'Delaware', dc: 'District of Columbia', fl: 'Florida', ga: 'Georgia', hi: 'Hawaii', id: 'Idaho', il: 'Illinois',
    in: 'Indiana', ia: 'Iowa', ks: 'Kansas', ky: 'Kentucky', la: 'Louisiana', me: 'Maine', md: 'Maryland',
    ma: 'Massachusetts', mi: 'Michigan', mn: 'Minnesota', ms: 'Mississippi', mo: 'Missouri', mt: 'Montana',
    ne: 'Nebraska', nv: 'Nevada', nh: 'New Hampshire', nj: 'New Jersey', nm: 'New Mexico', ny: 'New York',
    nc: 'North Carolina', nd: 'North Dakota', oh: 'Ohio', ok: 'Oklahoma', or: 'Oregon', pa: 'Pennsylvania',
    ri: 'Rhode Island', sc: 'South Carolina', sd: 'South Dakota', tn: 'Tennessee', tx: 'Texas', ut: 'Utah',
    vt: 'Vermont', va: 'Virginia', wa: 'Washington', wv: 'West Virginia', wi: 'Wisconsin', wy: 'Wyoming',
  };
  const FIPS_TO_STATE = Object.fromEntries(Object.entries(STATE_FIPS).map(([k, v]) => [v, k]));

  async function json(url, ms = 8000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  // short-lived memo so flipping between sections doesn't refetch
  const memo = new Map();
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  };

  // ZIP -> city, state, coordinates (Zippopotam.us)
  async function zip(z) {
    const d = await json(`https://api.zippopotam.us/us/${encodeURIComponent(z)}`);
    const p = d?.places?.[0];
    if (!p) return null;
    return {
      zip: z, city: p['place name'], state: p['state abbreviation'].toLowerCase(),
      lat: +p.latitude, lon: +p.longitude,
    };
  }

  // coordinates -> county (FCC Area API, census 2020)
  async function county(lat, lon) {
    const d = await json(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&censusYear=2020&format=json`);
    const r = d?.results?.[0];
    if (!r) return null;
    return { fips: r.county_fips, name: r.county_name, state: r.state_code?.toLowerCase() };
  }

  // coordinates -> nearest city name (National Weather Service points API)
  async function nearestCity(lat, lon) {
    const d = await json(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
    const p = d?.properties?.relativeLocation?.properties;
    return p ? { city: p.city, state: (p.state || '').toLowerCase() } : null;
  }

  // the regular weather (Open-Meteo)
  const WMO = [
    [[0], 'Clear', 'sun'], [[1], 'Mostly clear', 'sun'], [[2], 'Partly cloudy', 'cloud'], [[3], 'Cloudy', 'cloud'],
    [[45, 48], 'Foggy', 'fog'], [[51, 53, 55, 56, 57], 'Drizzle', 'rain'], [[61, 63, 65, 66, 67], 'Rain', 'rain'],
    [[71, 73, 75, 77], 'Snow', 'snow'], [[80, 81, 82], 'Showers', 'rain'], [[85, 86], 'Snow showers', 'snow'],
    [[95, 96, 99], 'Thunderstorms', 'storm'],
  ];
  async function weather(lat, lon) {
    const d = await json(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=auto`);
    const c = d?.current;
    if (!c) return null;
    const w = WMO.find(([codes]) => codes.includes(c.weather_code)) || [[], 'Weather', 'cloud'];
    const icon = w[2] === 'sun' && c.is_day === 0 ? 'moon' : w[2];
    return { temp: Math.round(c.temperature_2m), label: w[1], icon };
  }

  async function aqi(lat, lon) {
    const d = await json(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`);
    const v = d?.current?.us_aqi;
    return typeof v === 'number' ? Math.round(v) : null;
  }

  // active watches / warnings at this exact point (NWS)
  async function nws(lat, lon) {
    const d = await json(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`);
    const seen = new Set();
    return (d?.features || [])
      .map((f) => f.properties)
      .filter((p) => p && !seen.has(p.event) && seen.add(p.event))
      .slice(0, 3)
      .map((p) => ({ event: p.event, headline: p.headline, severity: p.severity }));
  }

  // a recent federal disaster declaration that covers this county (OpenFEMA)
  async function fema(stateCode, countyFips) {
    const sf = STATE_FIPS[stateCode];
    if (!sf) return null;
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const q = `$filter=fipsStateCode eq '${sf}' and declarationDate ge '${since}T00:00:00.000z'` +
      `&$orderby=declarationDate desc&$top=200` +
      `&$select=disasterNumber,declarationTitle,incidentType,declarationDate,fipsCountyCode,ihProgramDeclared,declarationType`;
    const d = await json(`https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?${encodeURI(q)}`, 10000);
    const county3 = (countyFips || '').slice(2);
    const hit = (d?.DisasterDeclarationsSummaries || []).find((x) =>
      x.declarationType !== 'FM' && (x.fipsCountyCode === county3 || x.fipsCountyCode === '000'));
    return hit || null;
  }

  // resolve a ZIP into a full place (city, state, county, coordinates)
  async function placeFromZip(z, rent) {
    const p = await zip(z);
    if (!p) {
      // the ZIP service is down or doesn't know it: fall back to the prefix table for the state
      const st = rent?.zip3?.[z.slice(0, 3)];
      return st ? { zip: z, state: st, city: null, approx: true } : null;
    }
    const c = await county(p.lat, p.lon);
    return { ...p, countyFips: c?.fips || null, countyName: c?.name || null };
  }

  async function placeFromCoords(lat, lon) {
    const [c, n] = await Promise.all([county(lat, lon), nearestCity(lat, lon)]);
    const state = c?.state || n?.state;
    if (!state) return null;
    return {
      zip: null, city: n?.city || null, state, lat: +lat.toFixed(4), lon: +lon.toFixed(4),
      countyFips: c?.fips || null, countyName: c?.name || null,
    };
  }

  // everything that depends on being somewhere specific
  function conditions(place) {
    if (!place || place.lat == null) return Promise.resolve({});
    const key = `${place.lat},${place.lon}`;
    return once(key, async () => {
      const [wx, air, alerts, decl] = await Promise.all([
        weather(place.lat, place.lon), aqi(place.lat, place.lon), nws(place.lat, place.lon),
        place.countyFips ? fema(place.state, place.countyFips) : null,
      ]);
      return {
        weather: wx, aqi: air, nws: alerts, fema: decl,
        nwsLink: `https://forecast.weather.gov/MapClick.php?lat=${place.lat}&lon=${place.lon}`,
      };
    });
  }

  return { STATE_FIPS, STATE_NAMES, FIPS_TO_STATE, placeFromZip, placeFromCoords, conditions };
})();

window.Live = Live;
