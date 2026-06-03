(function() {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const total = slides.length;
  const progressBar = document.getElementById('progressBar');
  const counter = document.getElementById('slideCounter');
  let current = 0;

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
      slide.dispatchEvent(new CustomEvent('stepchange', { detail: { step, max } }));
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

  // ----- generic stage pan/zoom: SVG <g> moves to focus on a zone per step -----
  function setupStageZoom(stageId, vw, vh, zones, dur = 720) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    const slide = stage.closest('.slide');
    if (!slide) return;

    function target(step) {
      const z = zones[step] || zones[0];
      return {
        s: z.s,
        tx: vw / 2 - z.cx * z.s,
        ty: vh / 2 - z.cy * z.s,
      };
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

  function setupAllStageZooms() {
    // 06 System overview — Touch / Scan / Synth / Output
    setupStageZoom('systemStage', 1400, 480, {
      0: { s: 1.00, cx: 700,  cy: 240 },
      1: { s: 1.85, cx: 200,  cy: 240 },
      2: { s: 1.85, cx: 540,  cy: 270 },
      3: { s: 1.85, cx: 870,  cy: 240 },
      4: { s: 1.85, cx: 1190, cy: 240 },
    });
    // 08 Electronics architecture — Power / Compute / I/O
    setupStageZoom('archStage', 1200, 640, {
      0: { s: 1.00, cx: 600, cy: 320 },
      1: { s: 1.55, cx: 600, cy: 145 },
      2: { s: 1.45, cx: 600, cy: 360 },
      3: { s: 1.15, cx: 600, cy: 460 },
    });
  }

  // ----- hash + navigation -----
  const h = parseInt(location.hash.replace('#', ''));
  if (!isNaN(h) && h >= 1 && h <= total) current = h - 1;

  const pad = n => String(n).padStart(2, '0');

  function showSlide(idx, toEnd) {
    idx = Math.max(0, Math.min(total - 1, idx));
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    progressBar.style.width = ((idx + 1) / total * 100) + '%';
    counter.textContent = pad(idx + 1) + ' / ' + pad(total);
    current = idx;
    history.replaceState(null, '', '#' + (idx + 1));

    const active = slides[idx];

    const stepper = getStepper(active);
    if (stepper) stepper.reset(!!toEnd);

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

  setupAllStageZooms();
  showSlide(current);
})();
