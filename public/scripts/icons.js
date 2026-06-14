/* =====================================================================
   Atmospheric SVG glyphs — the "weather icons" of civic conditions
   These are not literal weather. They evoke the feeling.
   ===================================================================== */

const GLYPHS = {
  // CLEAR — soft sun-like radial, calm
  clear: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="g-clear" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#6ec5e8" stop-opacity="1"/>
        <stop offset="60%" stop-color="#6ec5e8" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#6ec5e8" stop-opacity="0"/>
      </radialGradient>
      <filter id="b-clear"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <circle cx="60" cy="60" r="55" fill="url(#g-clear)" filter="url(#b-clear)"/>
    <circle cx="60" cy="60" r="22" fill="#6ec5e8" opacity="0.85"/>
    <circle cx="60" cy="60" r="22" fill="none" stroke="#6ec5e8" stroke-width="0.5"/>
  </svg>`,

  // MILD — soft green halo, gentle
  mild: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="g-mild" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#a7d49b" stop-opacity="1"/>
        <stop offset="60%" stop-color="#a7d49b" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#a7d49b" stop-opacity="0"/>
      </radialGradient>
      <filter id="b-mild"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <circle cx="60" cy="60" r="55" fill="url(#g-mild)" filter="url(#b-mild)"/>
    <ellipse cx="60" cy="65" rx="25" ry="18" fill="#a7d49b" opacity="0.7"/>
    <ellipse cx="55" cy="55" rx="18" ry="12" fill="#6ec5e8" opacity="0.55"/>
  </svg>`,

  // OVERCAST — warm cloud + amber shimmer
  overcast: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="g-over" cx="55%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#e8c66e" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="#e89a4f" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#e89a4f" stop-opacity="0"/>
      </radialGradient>
      <filter id="b-over"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    <circle cx="60" cy="60" r="55" fill="url(#g-over)" filter="url(#b-over)"/>
    <ellipse cx="48" cy="58" rx="28" ry="15" fill="#a8b0c2" opacity="0.4" filter="url(#b-over)"/>
    <ellipse cx="68" cy="65" rx="32" ry="18" fill="#e89a4f" opacity="0.55" filter="url(#b-over)"/>
    <circle cx="60" cy="60" r="14" fill="#e8c66e" opacity="0.7"/>
  </svg>`,

  // WARNING — orange storm cell, eye visible
  warning: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="g-warn" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#e89a4f" stop-opacity="1"/>
        <stop offset="50%" stop-color="#d4524e" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#d4524e" stop-opacity="0"/>
      </radialGradient>
      <filter id="b-warn"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <circle cx="60" cy="60" r="58" fill="url(#g-warn)" filter="url(#b-warn)"/>
    <path d="M60 30 Q85 45 80 70 Q60 88 40 70 Q35 45 60 30 Z" fill="#e89a4f" opacity="0.85"/>
    <circle cx="60" cy="60" r="10" fill="#0a0e1a"/>
    <circle cx="60" cy="60" r="6" fill="#e8c66e"/>
  </svg>`,

  // STORM — rotating spiral, deep red
  storm: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="g-storm" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#d4524e" stop-opacity="1"/>
        <stop offset="50%" stop-color="#8b3a8f" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#8b3a8f" stop-opacity="0"/>
      </radialGradient>
      <filter id="b-storm"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <circle cx="60" cy="60" r="58" fill="url(#g-storm)" filter="url(#b-storm)"/>
    <g style="transform-origin: 60px 60px; animation: spin 22s linear infinite;">
      <path d="M60 25 Q80 30 85 55 Q88 78 65 88" fill="none" stroke="#d4524e" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
      <path d="M60 95 Q40 90 35 65 Q32 42 55 32" fill="none" stroke="#d4524e" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
    </g>
    <circle cx="60" cy="60" r="8" fill="#0a0e1a"/>
    <style>@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }</style>
  </svg>`,

  // SEVERE — deep magenta, double spiral, reserved for historic
  severe: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="g-sev" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#8b3a8f" stop-opacity="1"/>
        <stop offset="100%" stop-color="#8b3a8f" stop-opacity="0"/>
      </radialGradient>
      <filter id="b-sev"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <circle cx="60" cy="60" r="58" fill="url(#g-sev)" filter="url(#b-sev)"/>
    <g style="transform-origin: 60px 60px; animation: spin 14s linear infinite;">
      <path d="M60 20 Q85 28 90 60 Q90 92 60 98" fill="none" stroke="#d4524e" stroke-width="5" stroke-linecap="round"/>
      <path d="M60 100 Q35 92 30 60 Q30 28 60 22" fill="none" stroke="#8b3a8f" stroke-width="5" stroke-linecap="round"/>
    </g>
    <circle cx="60" cy="60" r="6" fill="#0a0e1a"/>
  </svg>`,
};

// Small status icons used inside indicator cards
const STATUS_ICONS = {
  up: `<svg viewBox="0 0 12 12" width="10" height="10"><path d="M3 8l3-4 3 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  down: `<svg viewBox="0 0 12 12" width="10" height="10"><path d="M3 4l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  flat: `<svg viewBox="0 0 12 12" width="10" height="10"><path d="M3 6h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  arrow: `<svg viewBox="0 0 12 12" width="10" height="10"><path d="M4 3l4 3-4 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

window.GLYPHS = GLYPHS;
window.STATUS_ICONS = STATUS_ICONS;
