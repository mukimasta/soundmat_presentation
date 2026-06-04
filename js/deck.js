(function() {
  /** Chapter markers — `at` matches stable slide class `s-{at}` from manifest */
  const CHAPTERS = [
    { at: 'title', label: 'Intro' },
    { at: 'idea-origin', label: 'Concept' },
    { at: 'structure-bento', label: 'Structure' },
    { at: 'system-zoom', label: 'System' },
    { at: 'sensor-bento', label: 'Sensor' },
    { at: 'spine-electronics', label: 'Electronics' },
    { at: 'spine-firmware', label: 'Firmware' },
    { at: 'spine-software', label: 'Software' },
    { at: 'spine-sound', label: 'Sonification' },
    { at: 'system-recap', label: 'Closing' },
  ];

  const slides = Array.from(document.querySelectorAll('.slide'));
  const total = slides.length;
  const progressTrack = document.getElementById('progressTrack');
  const chapterRail = document.getElementById('chapterRail');
  const counter = document.getElementById('slideCounter');
  let current = 0;

  function chapterStartIndex(at) {
    const cls = 's-' + at;
    const i = slides.findIndex(s => s.classList.contains(cls));
    return i >= 0 ? i : 0;
  }

  const chapterStarts = CHAPTERS.map(ch => ({
    ...ch,
    idx: chapterStartIndex(ch.at),
  }));

  const chapterCols = `repeat(${CHAPTERS.length}, 1fr)`;

  function buildChapterRail() {
    if (!chapterRail) return;
    chapterRail.style.gridTemplateColumns = chapterCols;
    document.documentElement.style.setProperty('--chapter-count', String(CHAPTERS.length));
    chapterRail.replaceChildren();
    chapterStarts.forEach(ch => {
      const seg = document.createElement('button');
      seg.type = 'button';
      seg.className = 'chapter-seg';
      seg.textContent = ch.label;
      seg.title = ch.label;
      seg.addEventListener('click', () => showSlide(ch.idx));
      chapterRail.appendChild(seg);
    });
  }

  function getChapterState(idx) {
    let active = 0;
    for (let i = chapterStarts.length - 1; i >= 0; i--) {
      if (idx >= chapterStarts[i].idx) { active = i; break; }
    }
    const start = chapterStarts[active].idx;
    const end = active < chapterStarts.length - 1
      ? chapterStarts[active + 1].idx
      : total;
    const span = Math.max(1, end - start);
    const within = (idx - start + 1) / span;
    return { active, within };
  }

  function buildProgressSegments() {
    if (!progressTrack || progressTrack.querySelector('.progress-segments')) return;
    const grid = document.createElement('div');
    grid.className = 'progress-segments';
    grid.style.gridTemplateColumns = chapterCols;
    grid.setAttribute('aria-hidden', 'true');
    CHAPTERS.forEach(() => {
      const cell = document.createElement('span');
      const fill = document.createElement('i');
      fill.className = 'progress-fill';
      cell.appendChild(fill);
      grid.appendChild(cell);
    });
    progressTrack.appendChild(grid);
  }

  function updateChapterRail(idx) {
    const { active } = getChapterState(idx);
    if (chapterRail) {
      chapterRail.querySelectorAll('.chapter-seg').forEach((seg, i) => {
        seg.classList.toggle('active', i === active);
        seg.classList.toggle('done', i < active);
      });
    }
    if (!progressTrack) return;
    const cells = progressTrack.querySelectorAll('.progress-segments span');
    const { within } = getChapterState(idx);
    cells.forEach((cell, i) => {
      const fill = cell.querySelector('.progress-fill');
      if (!fill) return;
      if (i < active) fill.style.width = '100%';
      else if (i === active) fill.style.width = (within * 100).toFixed(2) + '%';
      else fill.style.width = '0%';
    });
  }

  // ----- existing SVG helpers for sensor slide -----
  const sl32 = document.getElementById('sliceLines32');
  const sl16 = document.getElementById('sliceLines16');
  if (sl32) {
    for (let i = 0; i < 32; i++) {
      const a = i * 11.25;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', '44'); l.setAttribute('y1', '0');
      l.setAttribute('x2', '176'); l.setAttribute('y2', '0');
      l.setAttribute('transform', `rotate(${a})`);
      sl32.appendChild(l);
    }
  }
  if (sl16) {
    for (let i = 0; i < 16; i++) {
      const a = i * 22.5;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', '0'); l.setAttribute('y1', '0');
      l.setAttribute('x2', '44'); l.setAttribute('y2', '0');
      l.setAttribute('transform', `rotate(${a})`);
      sl16.appendChild(l);
    }
  }
  const rt = document.getElementById('ringTicks');
  if (rt) {
    for (let i = 0; i < 16; i++) {
      const a = i * 22.5;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', '168'); l.setAttribute('y1', '0');
      l.setAttribute('x2', '174'); l.setAttribute('y2', '0');
      l.setAttribute('transform', `rotate(${a})`);
      rt.appendChild(l);
    }
  }

  // ----- generic stepper: any slide with [data-step] sub-elements -----
  function parseJsonAttr(value, fallback) {
    if (!value) return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function createStepper(slide) {
    const stepEls = slide.querySelectorAll('[data-step]');
    if (!stepEls.length) return null;
    const max = Math.max(0, ...Array.from(stepEls).map(el => +el.dataset.step || 0));
    if (max < 1) return null;

    const titles = parseJsonAttr(slide.dataset.stepTitles, []);
    const subs   = parseJsonAttr(slide.dataset.stepSubs,   []);
    const titleEl = slide.querySelector('[data-step-title]');
    const subEl   = slide.querySelector('[data-step-sub]');
    const dots    = Array.from(slide.querySelectorAll('[data-dot]'));

    let step = 0;

    function render() {
      slide.setAttribute('data-step', String(step));
      if (titleEl && titles[step] != null) titleEl.textContent = titles[step];
      if (subEl   && subs[step]   != null) subEl.textContent   = subs[step];
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === step);
        d.classList.toggle('done',   i <  step);
      });
      slide.dispatchEvent(new CustomEvent('stepchange', { bubbles: false, detail: { step, max } }));
    }

    return {
      total: max,
      get step() { return step; },
      next() { if (step < max) { step++; render(); return true; } return false; },
      prev() { if (step > 0) { step--; render(); return true; } return false; },
      reset(toEnd) { step = toEnd ? max : 0; render(); },
    };
  }

  const stepperCache = new WeakMap();
  function getStepper(slide) {
    if (!stepperCache.has(slide)) {
      stepperCache.set(slide, createStepper(slide));
    }
    return stepperCache.get(slide);
  }

  // ----- generic interactive pan + zoom stage (svg <g data-zoom-stage>) -----
  function setupZoomStage(stage) {
    const slide = stage.closest('.slide');
    const svg = stage.closest('svg');
    if (!slide || !svg) return;

    const vb = (svg.getAttribute('viewBox') || '0 0 1400 480').split(/\s+/).map(Number);
    const vw = vb[2] || 1400, vh = vb[3] || 480;
    const zones = parseJsonAttr(stage.dataset.zones, [{ s: 1, cx: vw / 2, cy: vh / 2 }]);

    function target(step) {
      const z = zones[step] || zones[0];
      return { s: z.s, tx: vw / 2 - z.cx * z.s, ty: vh / 2 - z.cy * z.s };
    }
    function apply(t) {
      stage.setAttribute(
        'transform',
        `translate(${t.tx.toFixed(2)} ${t.ty.toFixed(2)}) scale(${t.s.toFixed(4)})`
      );
    }
    function readCurrent() {
      const tr = stage.getAttribute('transform') || '';
      const m = tr.match(/translate\(([-\d.]+)\s+([-\d.]+)\)\s*scale\(([-\d.]+)\)/);
      if (m) return { tx: +m[1], ty: +m[2], s: +m[3] };
      return { s: 1, tx: 0, ty: 0 };
    }

    let from = target(0), to = target(0), animStart = 0, rafId = null;
    const dur = 720;
    function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }
    function tick(now) {
      const p = Math.min(1, (now - animStart) / dur);
      const e = easeOutCubic(p);
      apply({
        s:  from.s  + (to.s  - from.s)  * e,
        tx: from.tx + (to.tx - from.tx) * e,
        ty: from.ty + (to.ty - from.ty) * e,
      });
      if (p < 1) rafId = requestAnimationFrame(tick);
    }
    function goTo(step) {
      from = readCurrent();
      to = target(step);
      animStart = performance.now();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    }

    apply(target(0));
    slide.addEventListener('stepchange', (e) => goTo(e.detail.step));
  }

  // ----- hash + navigation -----
  const h = parseInt(location.hash.replace('#', ''));
  if (!isNaN(h) && h >= 1 && h <= total) current = h - 1;

  const pad = n => String(n).padStart(2, '0');

  function showSlide(idx, toEnd) {
    idx = Math.max(0, Math.min(total - 1, idx));
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    const active = slides[idx];
    document.body.classList.toggle('deck-dark', active.dataset.deckTheme === 'dark');
    if (counter) counter.textContent = pad(idx + 1) + ' / ' + pad(total);
    updateChapterRail(idx);
    current = idx;
    history.replaceState(null, '', '#' + (idx + 1));

    const stepper = getStepper(active);
    if (stepper) stepper.reset(!!toEnd);

    active.querySelectorAll('[data-zoom-stage]').forEach(stage => {
      const svg = stage.closest('svg');
      const vb = (svg?.getAttribute('viewBox') || '0 0 1400 480').split(/\s+/).map(Number);
      const vw = vb[2] || 1400, vh = vb[3] || 480;
      const zones = parseJsonAttr(stage.dataset.zones, [{ s: 1, cx: vw / 2, cy: vh / 2 }]);
      const step = stepper ? stepper.step : 0;
      const z = zones[step] || zones[0];
      stage.setAttribute(
        'transform',
        `translate(${(vw / 2 - z.cx * z.s).toFixed(2)} ${(vh / 2 - z.cy * z.s).toFixed(2)}) scale(${z.s.toFixed(4)})`
      );
    });

    active.querySelectorAll('[data-countup]').forEach(el => {
      const target = parseInt(el.dataset.countup);
      if (isNaN(target)) return;
      const duration = 1100;
      const start = performance.now();
      function frame(t) {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        const val = Math.round(target * eased);
        el.textContent = val.toLocaleString();
        if (p < 1) requestAnimationFrame(frame);
      }
      setTimeout(() => requestAnimationFrame(frame), 250);
    });
  }

  function next() {
    const slide = slides[current];
    const s = getStepper(slide);
    if (s && s.next()) return;
    if (current < total - 1) showSlide(current + 1);
  }
  function prev() {
    const slide = slides[current];
    const s = getStepper(slide);
    if (s && s.prev()) return;
    if (current > 0) showSlide(current - 1, true);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'Enter') {
      e.preventDefault(); next();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault(); prev();
    } else if (e.key === 'Home') { e.preventDefault(); showSlide(0); }
    else if (e.key === 'End') { e.preventDefault(); showSlide(total - 1); }
    else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }
  });

  let tsx = 0;
  document.addEventListener('touchstart', e => { tsx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tsx;
    if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
  });

  document.querySelectorAll('[data-zoom-stage]').forEach(setupZoomStage);
  buildChapterRail();
  buildProgressSegments();
  showSlide(current);
})();
