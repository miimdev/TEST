/* Photo-first editorial motion. Flat CSS graphics only: no canvas, projection or 3D tilt. */
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
  const INTRO_DURATION = 2600;
  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  let dispose = () => {};
  function start() {
    dispose();
    const stage = document.getElementById('hero-stage'), poster = document.getElementById('portrait-poster');
    const photo = document.getElementById('hero-photo');
    const toggle = document.getElementById('hero-motion-toggle'), replay = document.getElementById('hero-replay');
    if (!stage || !poster || !toggle || !replay) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)'), fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    let paused = false, entered = false, visible = !('IntersectionObserver' in window), running = false, observer;
    let pointerFrame = 0, introFrame = 0, introTimer = 0;
    try { paused = localStorage.getItem('miim:hero-motion') === 'paused'; } catch { /* Optional local motion preference. */ }
    function resetLight() {
      cancelAnimationFrame(pointerFrame); pointerFrame = 0;
      poster.style.removeProperty('--poster-light-x'); poster.style.removeProperty('--poster-light-y');
    }
    function finishIntro() {
      cancelAnimationFrame(introFrame); clearTimeout(introTimer);
      stage.classList.remove('is-poster-entering');
    }
    function playIntro() {
      finishIntro();
      if (!running) return;
      // Separate style frames so even a rapid replay starts a fresh timeline.
      introFrame = requestAnimationFrame(() => {
        introFrame = requestAnimationFrame(() => {
          if (!running) return;
          stage.classList.add('is-poster-entering');
          introTimer = setTimeout(finishIntro, INTRO_DURATION);
        });
      });
    }
    function updateState() {
      running = visible && !paused && !reduced.matches && !document.hidden;
      stage.classList.toggle('is-poster-running', running);
      stage.dataset.posterState = reduced.matches ? 'reduced' : paused ? 'paused' : document.hidden ? 'hidden' : visible ? 'running' : 'offscreen';
      toggle.disabled = reduced.matches; replay.disabled = reduced.matches || paused;
      toggle.setAttribute('aria-pressed', String(paused || reduced.matches));
      toggle.querySelector('span').textContent = reduced.matches ? 'حرکت کاهش‌یافته' : paused ? 'پخش حرکت' : 'توقف حرکت';
      if (!running) { resetLight(); finishIntro(); }
      // The global curtain used to cover most of the entrance. Wait for its
      // removal and a loaded photo; on mobile this also waits for scrolling in.
      if (visible && !entered && document.documentElement.classList.contains('is-ready') && !document.getElementById('loader') && (!photo || (photo.complete && photo.naturalWidth > 0))) {
        entered = true; readyObserver.disconnect(); playIntro();
      }
    }
    function move(event) {
      if (!running || !fine.matches || event.pointerType === 'touch') return;
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        const box = poster.getBoundingClientRect();
        poster.style.setProperty('--poster-light-x', clamp((event.clientX-box.left)/box.width*100)+'%');
        poster.style.setProperty('--poster-light-y', clamp((event.clientY-box.top)/box.height*100)+'%');
        pointerFrame = 0;
      });
    }
    function toggleMotion() {
      paused = !paused;
      try { localStorage.setItem('miim:hero-motion', paused ? 'paused' : 'running'); } catch {}
      updateState();
    }
    function preferenceChanged() { resetLight(); updateState(); }
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; updateState(); }, { threshold: 0 });
      observer.observe(stage);
    }
    const readyObserver = new MutationObserver(updateState);
    readyObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const loader = document.getElementById('loader');
    if (loader?.parentNode) readyObserver.observe(loader.parentNode, { childList: true });
    photo?.addEventListener('load', updateState);
    toggle.addEventListener('click', toggleMotion); replay.addEventListener('click', playIntro);
    poster.addEventListener('pointermove', move, { passive: true }); poster.addEventListener('pointerleave', resetLight);
    reduced.addEventListener('change', preferenceChanged); fine.addEventListener('change', preferenceChanged);
    document.addEventListener('visibilitychange', updateState);
    updateState();
    dispose = () => {
      running = false; resetLight(); finishIntro(); observer?.disconnect(); readyObserver.disconnect();
      photo?.removeEventListener('load',updateState);
      toggle.removeEventListener('click',toggleMotion); replay.removeEventListener('click',playIntro);
      poster.removeEventListener('pointermove',move); poster.removeEventListener('pointerleave',resetLight);
      reduced.removeEventListener('change',preferenceChanged); fine.removeEventListener('change',preferenceChanged);
      document.removeEventListener('visibilitychange',updateState);
      stage.classList.remove('is-poster-running'); stage.dataset.posterState = 'stopped';
    };
  }
  return { INTRO_DURATION, clamp, start, stop: () => dispose() };
});
