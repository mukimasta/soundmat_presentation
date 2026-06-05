(() => {
  function parseJsonAttr(value, fallback) {
    if (!value) return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function getMaxStep(slide) {
    const stepEls = slide.querySelectorAll('[data-step]');
    if (!stepEls.length) return 0;
    return Math.max(0, ...Array.from(stepEls).map(el => +el.dataset.step || 0));
  }

  function applyZoomStage(stage, step) {
    const svg = stage.closest('svg');
    const vb = (svg?.getAttribute('viewBox') || '0 0 1400 480').split(/\s+/).map(Number);
    const vw = vb[2] || 1400;
    const vh = vb[3] || 480;
    const zones = parseJsonAttr(stage.dataset.zones, [{ s: 1, cx: vw / 2, cy: vh / 2 }]);
    const z = zones[step] || zones[0];
    stage.setAttribute(
      'transform',
      'translate(' + (vw / 2 - z.cx * z.s).toFixed(2) + ' ' + (vh / 2 - z.cy * z.s).toFixed(2) + ') scale(' + z.s.toFixed(4) + ')'
    );
  }

  function finalizeCountups(root) {
    root.querySelectorAll('[data-countup]').forEach(el => {
      const target = parseInt(el.dataset.countup, 10);
      if (!isNaN(target)) el.textContent = target.toLocaleString();
    });
  }

  /** Chromium PDF/print renders background-clip:text as solid gradient boxes. */
  function flattenGradientText(root) {
    root.querySelectorAll('*').forEach(el => {
      const clip = getComputedStyle(el).webkitBackgroundClip || getComputedStyle(el).backgroundClip;
      if (clip !== 'text') return;

      let fill = '#E89318';
      if (el.classList.contains('sketch-accent') || el.classList.contains('jam-lofi-title')) {
        fill = '#F5A623';
      } else if (el.classList.contains('spark-accent') || el.classList.contains('thesis-accent')) {
        fill = '#F5A623';
      } else if (el.closest('.s-philosophy-bento')) {
        fill = '#5c5348';
      } else if (el.closest('.s-tagline')) {
        fill = '#F5A623';
      }

      el.style.setProperty('background', 'none', 'important');
      el.style.setProperty('-webkit-background-clip', 'border-box', 'important');
      el.style.setProperty('background-clip', 'border-box', 'important');
      el.style.setProperty('-webkit-text-fill-color', fill, 'important');
      el.style.setProperty('color', fill, 'important');
    });
  }

  document.querySelector('.slide-counter')?.remove();
  document.querySelector('.deck-hud-left')?.remove();
  document.getElementById('deckBottom')?.remove();

  const style = document.createElement('style');
  style.textContent = [
    '@page { size: 1920px 1080px; margin: 0; }',
    'html, body {',
    '  width: 1920px !important;',
    '  height: auto !important;',
    '  overflow: visible !important;',
    '  margin: 0 !important;',
    '  -webkit-print-color-adjust: exact !important;',
    '  print-color-adjust: exact !important;',
    '}',
    '.deck {',
    '  width: 1920px !important;',
    '  height: auto !important;',
    '  position: relative !important;',
    '  overflow: visible !important;',
    '}',
    '.slide.pdf-page {',
    '  position: relative !important;',
    '  inset: auto !important;',
    '  opacity: 1 !important;',
    '  visibility: visible !important;',
    '  pointer-events: none !important;',
    '  display: flex !important;',
    '  flex-direction: column !important;',
    '  width: 1920px !important;',
    '  height: 1080px !important;',
    '  min-height: 1080px !important;',
    '  max-height: 1080px !important;',
    '  overflow: hidden !important;',
    '  page-break-after: always !important;',
    '  break-after: page !important;',
    '  padding: var(--pad-y) var(--pad-x) var(--pad-y) !important;',
    '  transition: none !important;',
    '}',
    '.slide.pdf-page:last-child {',
    '  page-break-after: auto !important;',
    '  break-after: auto !important;',
    '}',
  ].join('\n');
  document.head.appendChild(style);

  const deck = document.getElementById('deck');
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const pages = [];

  slides.forEach(slide => {
    const max = getMaxStep(slide);
    const titles = parseJsonAttr(slide.dataset.stepTitles, []);
    const subs = parseJsonAttr(slide.dataset.stepSubs, []);

    for (let step = 0; step <= max; step++) {
      const page = slide.cloneNode(true);
      page.classList.add('pdf-page');
      page.classList.remove('active');
      page.removeAttribute('id');
      page.setAttribute('data-step', String(step));

      const titleEl = page.querySelector('[data-step-title]');
      const subEl = page.querySelector('[data-step-sub]');
      if (titleEl && titles[step] != null) titleEl.textContent = titles[step];
      if (subEl && subs[step] != null) subEl.textContent = subs[step];

      page.querySelectorAll('[data-dot]').forEach((dot, i) => {
        dot.classList.toggle('active', i === step);
        dot.classList.toggle('done', i < step);
      });

      page.querySelectorAll('[data-zoom-stage]').forEach(stage => applyZoomStage(stage, step));
      finalizeCountups(page);

      if (slide.dataset.deckTheme === 'dark') {
        page.style.background = '#1D1D1F';
        page.style.color = '#F5F5F7';
      }

      pages.push(page);
    }
  });

  deck.replaceChildren(...pages);
  flattenGradientText(deck);
  document.body.classList.remove('deck-dark');
})();
