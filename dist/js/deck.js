(function() {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const total = slides.length;
  const progress = document.getElementById('progressBar');
  const counter = document.getElementById('slideCounter');
  let current = 0;

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

  const h = parseInt(location.hash.replace('#', ''));
  if (!isNaN(h) && h >= 1 && h <= total) current = h - 1;

  const pad = n => String(n).padStart(2, '0');

  function showSlide(idx) {
    idx = Math.max(0, Math.min(total - 1, idx));
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    progress.style.width = ((idx + 1) / total * 100) + '%';
    counter.textContent = pad(idx + 1) + ' / ' + pad(total);
    current = idx;
    history.replaceState(null, '', '#' + (idx + 1));

    const active = slides[idx];
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

  function next() { if (current < total - 1) showSlide(current + 1); }
  function prev() { if (current > 0) showSlide(current - 1); }

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

  showSlide(current);
})();
