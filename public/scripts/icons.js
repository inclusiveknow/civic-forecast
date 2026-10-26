/* THE CIVIC FORECAST · icons. 24px line icons, stroke = currentColor. */
const ICONS = (() => {
  const s = (d, extra = '') => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
  return {
    ballot: s('<path d="M4 13h16v7H4z"/><path d="M8 13V5h8v8"/><path d="M10.5 8.5l1.2 1.2 2.3-2.4"/><path d="M8 16.5h8"/>'),
    mail: s('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>'),
    pen: s('<path d="M14.5 5.5l4 4L8 20H4v-4z"/><path d="M12.5 7.5l4 4"/>'),
    check: s('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>'),
    star: s('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
    health: s('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M12 10.5v4M10 12.5h4"/>'),
    money: s('<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2 2.8.8 2.8 2.1-1.2 2.1-2.8 2.1c-1.2 0-2.3-.5-2.8-1.5M12 6.3v1.5M12 16.2v1.5"/>'),
    benefits: s('<path d="M4 10.5h16v9.5H4z"/><path d="M3 7h18v3.5H3z"/><path d="M12 7v13"/><path d="M12 7c-1.2-2.8-4.6-3.2-4.6-1 0 1.4 2.4 1 4.6 1zM12 7c1.2-2.8 4.6-3.2 4.6-1 0 1.4-2.4 1-4.6 1z"/>'),
    clock: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    holiday: s('<path d="M5 20V4.5"/><path d="M5 5h11l-2 3.5 2 3.5H5"/>'),
    tax: s('<path d="M6 3.5h9l3 3v14H6z"/><path d="M15 3.5v3h3"/><path d="M9 11h6M9 14.5h6M9 18h3.5"/>'),
    vote: s('<path d="M4 13h16v7H4z"/><path d="M8 13V5h8v8"/><path d="M10.5 8.5l1.2 1.2 2.3-2.4"/><path d="M8 16.5h8"/>'),
    calendar: s('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
    alert: s('<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5h.01"/>'),
    storm: s('<path d="M7 15.5a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.6 9 3.3 3.3 0 0 1 18 15.5z"/><path d="M12.5 13l-2 3.5h3l-2 3.5"/>'),
    shield: s('<path d="M12 3.5l7.5 3v5.3c0 4.4-3.1 7.6-7.5 8.7-4.4-1.1-7.5-4.3-7.5-8.7V6.5z"/><path d="M9 12l2 2 4-4.2"/>'),
    air: s('<path d="M3.5 9h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3.5 13h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3.5 17h6"/>'),
    home: s('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>'),
    cart: s('<path d="M3.5 4.5h2.2l2.1 10.5h10.4l2-7.5H6.6"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>'),
    fuel: s('<path d="M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15.5"/><path d="M4 20.5h11"/><path d="M5 10h9"/><path d="M14 9l3.5 2.5V17a1.5 1.5 0 0 0 3 0V8.5L18 6"/>'),
    bolt: s('<path d="M13.5 3L5.5 13.5h6L10.5 21l8-10.5h-6z"/>'),
    work: s('<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2"/><path d="M3.5 12.5h17"/>'),
    pin: s('<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
    locate: s('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="7"/>'),
    share: s('<path d="M12 3.5v12"/><path d="M7.5 8L12 3.5 16.5 8"/><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/>'),
    out: s('<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5L11 13"/><path d="M17.5 14v4.5A1.5 1.5 0 0 1 16 20H6a1.5 1.5 0 0 1-1.5-1.5V8.5A1.5 1.5 0 0 1 6 7h4.5"/>'),
    list: s('<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>'),
    map: s('<path d="M9 4.5L3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>'),
    close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
    arrow: s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    up: s('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: s('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    flat: s('<path d="M5 12h14"/>'),
    // the regular weather, small
    sun: s('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    moon: s('<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>'),
    cloud: s('<path d="M7 18.5a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.6 12 3.3 3.3 0 0 1 18 18.5z"/>'),
    rain: s('<path d="M7 14.5a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.6 8 3.3 3.3 0 0 1 18 14.5z"/><path d="M9 17.5l-1 2.5M13 17.5l-1 2.5M17 17.5l-1 2.5"/>'),
    snow: s('<path d="M7 14a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.6 7.5 3.3 3.3 0 0 1 18 14z"/><path d="M9 18h.01M12 20h.01M15 18h.01M12 17h.01"/>'),
    fog: s('<path d="M4 9h16M6 13h12M4 17h16"/>'),
  };
})();

window.ICONS = ICONS;
