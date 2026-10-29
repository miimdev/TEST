/* MIIM creative engine. No photo, remote assets, WebGL or third-party animation runtime. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.MiimHero = api;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', api.start, { once: true });
    else api.start();
  }
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function project(x, y, z, turn, radius, width, height) {
    const rx = x * Math.cos(turn) - z * Math.sin(turn), rz = x * Math.sin(turn) + z * Math.cos(turn);
    const ry = y * .9 - rz * .3, depth = y * .3 + rz * .9;
    const perspective = 3.5 / (3.5 + depth);
    return { x: width / 2 + rx * radius * perspective, y: height * .46 + ry * radius * perspective, depth, scale: perspective };
  }
  let dispose = () => {};
  function start() {
    dispose();
    const stage = document.getElementById('hero-stage'), canvas = document.getElementById('hero-reactor-canvas');
    const toggle = document.getElementById('hero-motion-toggle'), spark = document.getElementById('hero-spark');
    if (!stage || !canvas || !toggle || !spark) return;
    const art = stage.querySelector('.reactor-art'), space = document.getElementById('reactor-space');
    let context = null; try { context = canvas.getContext('2d'); } catch { /* CSS sculpture remains visible without canvas. */ }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    let paused = false;
    try { paused = localStorage.getItem('miim:hero-motion') === 'paused'; } catch { /* Optional preference only. */ }
    let inView = !('IntersectionObserver' in window), running = false, frame = 0, pointerFrame = 0, observer, resizeObserver;
    let width = 0, height = 0, elapsed = 0, previous = 0, lastPaint = 0, sparkUntil = 0, sparkTimer = 0;
    let tx = 0, ty = 0, px = 0, py = 0;
    function resetPointer() {
      tx = ty = px = py = 0; cancelAnimationFrame(pointerFrame); pointerFrame = 0;
      for (const property of ['--reactor-rx','--reactor-ry','--reactor-x','--reactor-y']) space.style.removeProperty(property);
    }
    function paintPointer() {
      px += (tx - px) * .12; py += (ty - py) * .12;
      space.style.setProperty('--reactor-rx', (-py * 7).toFixed(2) + 'deg');
      space.style.setProperty('--reactor-ry', (px * 9).toFixed(2) + 'deg');
      space.style.setProperty('--reactor-x', (px * 5).toFixed(1) + 'px');
      space.style.setProperty('--reactor-y', (py * 4).toFixed(1) + 'px');
    }
    function draw() {
      if (!context || !width || !height) return;
      const light = document.documentElement.dataset.theme === 'light', color = light ? '160,109,29' : '232,185,99';
      const radius = Math.min(width * .32, height * .36), turn = elapsed * .00014;
      context.clearRect(0, 0, width, height);
      // A projected constellation, O(n), not an expensive all-pairs particle simulation.
      const total = fine.matches ? 76 : 32;
      for (let i = 0; i < total; i++) {
        const phi = Math.acos(1 - 2 * (i + .5) / total), theta = i * 2.399963;
        const point = project(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta), turn, radius, width, height);
        const alpha = clamp((1.5 - point.depth) / 3, .12, .8);
        context.fillStyle = `rgba(${color},${alpha})`;
        context.beginPath(); context.arc(point.x, point.y, (i % 9 ? .9 : 1.8) * point.scale, 0, Math.PI * 2); context.fill();
        if (i % 8 === 0) {
          const next = project(Math.sin(phi+.2)*Math.cos(theta+.3),Math.cos(phi+.2),Math.sin(phi+.2)*Math.sin(theta+.3),turn,radius,width,height);
          context.strokeStyle = `rgba(${color},${alpha*.3})`; context.lineWidth = .6;
          context.beginPath(); context.moveTo(point.x,point.y); context.lineTo(next.x,next.y); context.stroke();
        }
      }
      if (sparkUntil > elapsed) {
        const progress = 1 - (sparkUntil - elapsed) / 800;
        context.strokeStyle = `rgba(${color},${(1-progress)*.8})`; context.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
          const angle = i * Math.PI / 10, r = radius * (.25 + progress * 1.1);
          context.beginPath(); context.moveTo(width/2+Math.cos(angle)*r,height*.46+Math.sin(angle)*r*.75);
          context.lineTo(width/2+Math.cos(angle)*(r+8),height*.46+Math.sin(angle)*(r+8)*.75); context.stroke();
        }
      }
    }
    function tick(time) {
      if (!running) return;
      if (!previous) previous = time;
      elapsed += Math.min(64, time - previous); previous = time;
      // At most 30 canvas paints per second, DPR capped below, including high-refresh screens.
      if (time - lastPaint >= 1000 / 30) { lastPaint = time; if (fine.matches) paintPointer(); draw(); }
      frame = requestAnimationFrame(tick);
    }
    function updateState() {
      running = !paused && !reduced.matches && inView && !document.hidden;
      stage.classList.toggle('is-reactor-running', running);
      stage.dataset.reactorState = reduced.matches ? 'reduced' : paused ? 'paused' : document.hidden ? 'hidden' : !inView ? 'offscreen' : 'running';
      toggle.setAttribute('aria-pressed', String(paused || reduced.matches));
      toggle.disabled = reduced.matches;
      toggle.querySelector('span').textContent = reduced.matches ? 'حرکت کاهش‌یافته' : paused ? 'پخش انیمیشن' : 'توقف انیمیشن';
      spark.disabled = paused || reduced.matches;
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      if (running && context) frame = requestAnimationFrame(tick);
      else { resetPointer(); sparkUntil = 0; clearTimeout(sparkTimer); stage.classList.remove('is-reactor-spark'); draw(); }
    }
    function resize() {
      const box = art.getBoundingClientRect();
      width = Math.max(1, box.width); height = Math.max(1, box.height);
      const dpr = Math.min(window.devicePixelRatio || 1, fine.matches ? 1.5 : 1);
      canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr);
      context?.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    }
    function move(event) {
      if (!running || !fine.matches || event.pointerType === 'touch') return;
      const box = art.getBoundingClientRect();
      tx = clamp((event.clientX - box.left) / box.width * 2 - 1, -1, 1);
      ty = clamp((event.clientY - box.top) / box.height * 2 - 1, -1, 1);
      if (!context) { cancelAnimationFrame(pointerFrame); pointerFrame = requestAnimationFrame(paintPointer); }
    }
    function leave() { tx = ty = 0; if (!context) resetPointer(); }
    function toggleMotion() {
      paused = !paused;
      try { localStorage.setItem('miim:hero-motion', paused ? 'paused' : 'running'); } catch {}
      updateState();
    }
    function makeSpark() {
      if (!running || sparkUntil > elapsed) return;
      sparkUntil = elapsed + 800; stage.classList.add('is-reactor-spark');
      clearTimeout(sparkTimer); sparkTimer = setTimeout(() => { stage.classList.remove('is-reactor-spark'); sparkUntil = 0; }, 850);
    }
    function preferenceChanged() { resize(); updateState(); }
    const themeObserver = new MutationObserver(() => { if (!running) draw(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if ('ResizeObserver' in window) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(art); }
    else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; updateState(); }, { threshold: 0 });
      observer.observe(stage);
    }
    toggle.addEventListener('click', toggleMotion); spark.addEventListener('click', makeSpark);
    art.addEventListener('pointermove', move, { passive: true }); art.addEventListener('pointerleave', leave);
    reduced.addEventListener('change', preferenceChanged); fine.addEventListener('change', preferenceChanged);
    document.addEventListener('visibilitychange', updateState);
    resize(); updateState();
    dispose = () => {
      running = false; cancelAnimationFrame(frame); resetPointer(); clearTimeout(sparkTimer);
      observer?.disconnect(); resizeObserver?.disconnect(); themeObserver.disconnect();
      window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', updateState);
      reduced.removeEventListener('change', preferenceChanged); fine.removeEventListener('change', preferenceChanged);
      toggle.removeEventListener('click',toggleMotion); spark.removeEventListener('click',makeSpark);
      art.removeEventListener('pointermove',move); art.removeEventListener('pointerleave',leave);
      stage.classList.remove('is-reactor-running','is-reactor-spark');
    };
  }
  return { project, clamp, start, stop: () => dispose() };
});
