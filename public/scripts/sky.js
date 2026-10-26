/* =====================================================================
   THE CIVIC FORECAST · the living sky
   Soft particles behind the page that match the day's civic condition:
   rising blue motes while early voting is open, drifting orange flecks
   where ballots come by mail, a slow green hush while states wait for
   Election Day, gold on Election Day, slow violet stars while votes are
   counted. Pauses when the app is in the background; holds still for
   anyone who prefers reduced motion.
   ===================================================================== */

const Sky = (() => {
  const MOODS = {
    inperson: { rgb: [110, 167, 236], n: 46, vy: -0.22, vx: 0.04, size: [1, 2.6], twinkle: 0.2 },
    mail: { rgb: [240, 138, 93], n: 38, vy: 0.12, vx: 0.18, size: [1.2, 3], twinkle: 0.15 },
    wait: { rgb: [60, 190, 140], n: 28, vy: -0.06, vx: 0.02, size: [1, 2.2], twinkle: 0.3 },
    election: { rgb: [250, 196, 80], n: 70, vy: -0.3, vx: 0, size: [1, 3], twinkle: 0.9 },
    arriving: { rgb: [170, 150, 230], n: 40, vy: 0.04, vx: 0.05, size: [0.8, 2], twinkle: 0.6 },
    counting: { rgb: [170, 150, 230], n: 40, vy: 0.02, vx: 0.03, size: [0.8, 2], twinkle: 0.6 },
  };
  let cv, ctx, W = 0, H = 0, dpr = 1, parts = [], mood = MOODS.inperson, raf = 0, last = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  function spawn(randomY) {
    const m = mood;
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : m.vy < 0 ? H + 10 : -10,
      r: m.size[0] + Math.random() * (m.size[1] - m.size[0]),
      vx: m.vx * (0.5 + Math.random()) * (Math.random() < 0.5 ? -1 : 1) + (Math.random() - 0.5) * 0.05,
      vy: m.vy * (0.6 + Math.random() * 0.8),
      a: 0.15 + Math.random() * 0.45,
      ph: Math.random() * Math.PI * 2,
    };
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(t) {
    const dt = Math.min(50, t - (last || t)) / 16.7;
    last = t;
    ctx.clearRect(0, 0, W, H);
    const [r, g, b] = mood.rgb;
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.ph += 0.02 * dt;
      if (p.y < -12 || p.y > H + 12 || p.x < -12 || p.x > W + 12) Object.assign(p, spawn(false), { x: Math.random() * W });
      const tw = 1 - mood.twinkle * 0.5 * (1 + Math.sin(p.ph * 3));
      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${(p.a * tw).toFixed(3)})`;
      ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
      ctx.shadowBlur = p.r * 4;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!still.matches && !document.hidden) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function start() {
    if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); }
  }

  function set(code) {
    const next = MOODS[code] || MOODS.inperson;
    if (next === mood && parts.length) return;
    mood = next;
    parts = Array.from({ length: Math.round(mood.n * Math.min(1.4, (W * H) / (900 * 900) + 0.4)) }, () => spawn(true));
    if (still.matches) frame(performance.now()); else start();
  }

  function init(host) {
    cv = document.createElement('canvas');
    cv.className = 'sky-motes';
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    ctx = cv.getContext('2d');
    resize();
    addEventListener('resize', () => { resize(); if (still.matches) frame(performance.now()); });
    document.addEventListener('visibilitychange', start);
  }

  return { init, set };
})();

window.Sky = Sky;
