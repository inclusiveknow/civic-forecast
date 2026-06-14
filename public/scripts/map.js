/* =====================================================================
   THE CIVIC FORECAST — atmospheric map
   D3 + us-atlas TopoJSON. Renders state outlines on a dark stage and
   projects each indicator's regions as soft, screen-blended color blobs.
   ===================================================================== */

const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json';

// Color tones used for atmospheric regions
const TONE_COLOR = {
  clear: '#6ec5e8',
  mild: '#a7d49b',
  watch: '#e8c66e',
  warning: '#e89a4f',
  storm: '#d4524e',
  severe: '#8b3a8f',
};

const Map = {
  svg: null,
  topo: null,
  projection: null,
  path: null,
  width: 960,
  height: 540,
  initialized: false,

  async init(container, reading) {
    this.container = container;
    container.classList.add('loading');

    if (typeof d3 === 'undefined' || typeof topojson === 'undefined') {
      // Wait for libs
      await new Promise((res) => setTimeout(res, 100));
      if (typeof d3 === 'undefined') return this.fail();
    }

    try {
      this.topo = await d3.json(ATLAS_URL);
    } catch (e) {
      console.warn('[map] atlas fetch failed; using fallback', e);
      return this.failGracefully(reading);
    }

    this.render(reading);
    container.classList.remove('loading');
    this.initialized = true;
    window.addEventListener('resize', () => this.resize());
  },

  failGracefully(reading) {
    // Render a simple ambient map without geography
    this.container.innerHTML = '';
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 450;
    const svg = d3.select(this.container).append('svg').attr('viewBox', `0 0 ${w} ${h}`);
    svg.append('rect').attr('width', w).attr('height', h).attr('fill', '#0d1322');
    svg.append('text').attr('x', w / 2).attr('y', h / 2).attr('text-anchor', 'middle')
       .attr('class', 'compass').text('atmospheric map · offline');
    this.container.classList.remove('loading');
  },

  fail() {
    this.container.innerHTML = '<div class="compass" style="position:absolute;inset:0;display:grid;place-items:center;color:var(--ink-quiet);font-family:var(--font-mono);font-size:11px;">map libraries loading…</div>';
  },

  render(reading) {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 450;
    this.width = w; this.height = h;

    this.container.innerHTML = '';
    const svg = d3.select(this.container).append('svg')
      .attr('viewBox', `0 0 ${w} ${h}`)
      .attr('preserveAspectRatio', 'xMidYMid slice');
    this.svg = svg;

    // Defs: gradient + blur filters
    const defs = svg.append('defs');

    // Big blur filter for atmospheric blobs
    const blur = defs.append('filter')
      .attr('id', 'atm-blur')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    blur.append('feGaussianBlur').attr('stdDeviation', 24);

    // Lighter blur for storm dots
    const dotBlur = defs.append('filter').attr('id', 'dot-blur');
    dotBlur.append('feGaussianBlur').attr('stdDeviation', 1.5);

    // Radial gradients per tone — softer at edges
    Object.entries(TONE_COLOR).forEach(([tone, color]) => {
      const g = defs.append('radialGradient').attr('id', `grad-${tone}`).attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
      g.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.95);
      g.append('stop').attr('offset', '50%').attr('stop-color', color).attr('stop-opacity', 0.45);
      g.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0);
    });

    // Background subtle vignette
    const bg = defs.append('radialGradient').attr('id', 'bg-vignette').attr('cx', '50%').attr('cy', '50%').attr('r', '70%');
    bg.append('stop').attr('offset', '0%').attr('stop-color', '#10182a').attr('stop-opacity', 1);
    bg.append('stop').attr('offset', '100%').attr('stop-color', '#06080f').attr('stop-opacity', 1);
    svg.append('rect').attr('width', w).attr('height', h).attr('fill', 'url(#bg-vignette)');

    // Subtle grid lines (latitude/longitude feel)
    const gridG = svg.append('g').attr('class', 'grid');
    for (let i = 1; i < 12; i++) {
      gridG.append('line')
        .attr('x1', (w / 12) * i).attr('x2', (w / 12) * i)
        .attr('y1', 0).attr('y2', h)
        .attr('stroke', 'rgba(168, 176, 194, 0.04)')
        .attr('stroke-width', 1);
    }
    for (let i = 1; i < 8; i++) {
      gridG.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', (h / 8) * i).attr('y2', (h / 8) * i)
        .attr('stroke', 'rgba(168, 176, 194, 0.04)')
        .attr('stroke-width', 1);
    }

    // Projection
    this.projection = d3.geoAlbersUsa()
      .scale(w * 1.25)
      .translate([w / 2, h / 2]);
    this.path = d3.geoPath(this.projection);

    // ATMOSPHERIC LAYER — render BEFORE states so it sits behind state outlines
    const atmG = svg.append('g').attr('class', 'atmosphere');

    // Each indicator paints its regions
    const allRegions = [];
    reading.indicators.forEach((ind) => {
      (ind.regions || []).forEach((r) => {
        allRegions.push({ ...r, tone: ind.tone, indicator_id: ind.id });
      });
    });

    allRegions.forEach((r) => {
      const proj = this.projection(r.center);
      if (!proj) return;
      const [cx, cy] = proj;
      const radius = Math.min(w, h) * (r.r / 700); // bumped up from 800 for stronger blobs
      atmG.append('circle')
        .attr('class', `atm-region r-${r.tone}`)
        .attr('cx', cx).attr('cy', cy)
        .attr('r', radius)
        .attr('fill', `url(#grad-${r.tone})`)
        .attr('filter', 'url(#atm-blur)')
        .attr('opacity', Math.min(1, r.i + 0.1)); // a touch stronger
    });

    // STATES
    const statesG = svg.append('g').attr('class', 'states');
    const states = topojson.feature(this.topo, this.topo.objects.states);
    statesG.selectAll('.state')
      .data(states.features)
      .enter().append('path')
      .attr('class', 'state')
      .attr('d', this.path)
      .append('title')
      .text(d => d.properties.name);

    // Nation outline
    const nation = topojson.mesh(this.topo, this.topo.objects.states, (a, b) => a !== b);
    svg.append('path')
      .attr('class', 'nation')
      .attr('d', this.path(nation));

    // Storm-center dots — every region with notable intensity gets a marker.
    // Stronger ones (warning/storm/severe) get pulse rings.
    const markerPoints = allRegions
      .filter(r => r.i > 0.4)
      .sort((a, b) => b.i - a.i)
      .slice(0, 9);

    const dotsG = svg.append('g').attr('class', 'storms');
    markerPoints.forEach((r) => {
      const proj = this.projection(r.center);
      if (!proj) return;
      const [cx, cy] = proj;
      const color = TONE_COLOR[r.tone] || '#d4524e';
      const isStorm = r.tone === 'storm' || r.tone === 'severe' || (r.tone === 'warning' && r.i > 0.7);

      if (isStorm) {
        [0, 0.6, 1.2].forEach((delay) => {
          dotsG.append('circle')
            .attr('class', 'pulse-ring')
            .attr('cx', cx).attr('cy', cy)
            .attr('r', 8)
            .attr('stroke', color)
            .style('animation-delay', `${delay}s`);
        });
      }

      // Center dot — sized by intensity
      dotsG.append('circle')
        .attr('class', 'storm-dot')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 2 + r.i * 2)
        .attr('fill', color)
        .style('filter', `drop-shadow(0 0 ${4 + r.i * 6}px ${color})`);

      // Label
      if (r.label) {
        dotsG.append('text')
          .attr('class', 'region-label')
          .attr('x', cx)
          .attr('y', cy - 12)
          .text(r.label);
      }

      // Invisible click target — bigger than the dot. Pass the DOM element
      // so the app can compute the real screen position (SVG coords ≠ pixels).
      const hotZone = dotsG.append('circle')
        .attr('class', 'hot-zone')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 26)
        .attr('data-region-label', r.label || '')
        .attr('data-indicator-id', r.indicator_id);

      hotZone.on('click', function(e) {
        e.stopPropagation();
        window.App?.openMapPopover(r, this);
      });
      hotZone.on('mouseenter', function() {
        window.App?.openMapPopover(r, this);
      });
    });

    // Click outside any region closes the popover
    svg.on('click', () => window.App?.closeMapPopover());

    // Mouseleave on the whole map closes the popover after a brief delay
    svg.on('mouseleave', () => {
      clearTimeout(this._mapLeaveTimer);
      this._mapLeaveTimer = setTimeout(() => window.App?.closeMapPopover(), 600);
    });

    // Coordinate stamp (bottom-left so it doesn't overlap northern labels)
    svg.append('text')
      .attr('class', 'stamp')
      .attr('x', 12).attr('y', h - 12)
      .text('CONUS · ALBERS USA · 06:00 ET');

    // Compass / scale (bottom-right)
    svg.append('text')
      .attr('class', 'compass')
      .attr('x', w - 12).attr('y', h - 12)
      .attr('text-anchor', 'end')
      .text('N ↑');
  },

  resize() {
    if (!this.initialized || !window.DATA?.current) return;
    // Debounced redraw
    clearTimeout(this._rt);
    this._rt = setTimeout(() => this.render(window.DATA.current), 200);
  },
};

window.Map = Map;
