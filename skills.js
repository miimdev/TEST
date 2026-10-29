/* The skills studio: one short RAF on reveal/replay, no permanent JavaScript animation loop. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MiimSkills = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fa = value => String(value).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const glyphs = {
    design: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><circle cx="16.5" cy="16.5" r="3.5"/>',
    code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
    brand: '<path d="m4 20 4-1 11-11a2.8 2.8 0 0 0-4-4L4 15l-1 6Zm9-14 5 5M4 15l4 4"/>',
    motion: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="m10 8 6 4-6 4Z"/>',
  };
  function kind(skill) {
    const value = (String(skill.name || '') + ' ' + String(skill.tag || '')).toLowerCase();
    if (/motion|after effects|موشن|انیمیشن|video/.test(value)) return 'motion';
    if (/front|html|css|javascript|react|web|کد|وب/.test(value)) return 'code';
    if (/brand|illustrat|photoshop|برند|لوگو|گرافیک/.test(value)) return 'brand';
    return 'design';
  }
  function percent(value) { const n = Number(value); return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0; }
  function markup(skills) {
    return skills.map((skill, index) => {
      const value = percent(skill.percent), type = kind(skill);
      const tags = String(skill.tag || '').split(/[·|،,]/).map(t => t.trim()).filter(Boolean);
      return `<li class="skill-card skill-card--${type}" style="--skill-index:${Math.min(index, 5)}">
        <div class="skill-card__top"><span class="skill-card__glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${glyphs[type]}</svg></span><span class="skill-card__number" aria-hidden="true">${String(index + 1).padStart(2,'0')} / EXPERTISE</span></div>
        <div class="skill-card__body"><div class="skill-card__dial" role="meter" aria-labelledby="skill-name-${index}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><svg viewBox="0 0 72 72" aria-hidden="true"><circle class="skill-card__track" cx="36" cy="36" r="29"/><circle class="skill-card__arc" cx="36" cy="36" r="29" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100-value}"/></svg><span class="skill-card__value" data-skill-value="${value}" aria-hidden="true">${fa(value)}<small>٪</small></span></div><h3 id="skill-name-${index}" class="skill-card__name" dir="auto">${esc(skill.name)}</h3></div>
        <div class="skill-card__tools">${tags.map(tag => `<span dir="auto">${esc(tag)}</span>`).join('')}</div>
        <div class="skill-card__rail" aria-hidden="true"><span style="transform:scaleX(${value/100})"></span></div>
      </li>`;
    }).join('');
  }
  let dispose = () => {};
  function mount(skills) {
    dispose();
    const panel = document.getElementById('skills-card'), list = document.getElementById('skills-list');
    if (!panel || !list) return;
    list.innerHTML = markup(skills);
    const replay = document.getElementById('skills-replay'), count = document.getElementById('skills-total'), empty = document.getElementById('skills-empty');
    count.textContent = fa(skills.length);
    empty.hidden = skills.length > 0; replay.hidden = !skills.length;
    panel.classList.remove('skills-has-entered','skills-in-view');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const rows = Array.from(list.children).map(row => ({ element: row, value: Number(row.querySelector('[data-skill-value]').dataset.skillValue), number: row.querySelector('.skill-card__value').firstChild, arc: row.querySelector('.skill-card__arc'), rail: row.querySelector('.skill-card__rail span') }));
    let frame = 0, pointerFrame = 0, pointerCard = null, observer = null, entered = false, visible = !('IntersectionObserver' in window);
    const paint = (row, value, progress) => {
      row.number.nodeValue = fa(Math.round(value * progress));
      row.arc.style.strokeDashoffset = String(100 - value * progress);
      row.rail.style.transform = `scaleX(${value * progress / 100})`;
    };
    const finish = () => { cancelAnimationFrame(frame); frame = 0; rows.forEach(row => paint(row, row.value, 1)); };
    function animate() {
      cancelAnimationFrame(frame);
      panel.classList.add('skills-has-entered');
      if (reduced.matches || document.hidden || !visible) { finish(); return; }
      const start = performance.now();
      rows.forEach(row => paint(row, row.value, 0));
      function tick(time) {
        let complete = true;
        rows.forEach((row,index) => {
          const progress = Math.min(1, Math.max(0, (time - start - Math.min(index,5) * 65) / 1150));
          paint(row, row.value, 1 - Math.pow(1-progress,3));
          if (progress < 1) complete = false;
        });
        frame = complete ? 0 : requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    }
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        panel.classList.toggle('skills-in-view', visible && !document.hidden);
        if (visible && !entered) { entered = true; animate(); }
        if (!visible) finish();
      }, { threshold: 0 });
      observer.observe(panel);
    } else { entered = true; panel.classList.add('skills-in-view'); animate(); }
    function resetPointer() {
      cancelAnimationFrame(pointerFrame); pointerFrame = 0;
      if (pointerCard) { pointerCard.style.removeProperty('--skill-x'); pointerCard.style.removeProperty('--skill-y'); pointerCard.style.removeProperty('--skill-rx'); pointerCard.style.removeProperty('--skill-ry'); }
      pointerCard = null;
    }
    function move(event) {
      if (!fine.matches || reduced.matches || event.pointerType === 'touch') return;
      const row = event.target.closest('.skill-card'); if (!row) { resetPointer(); return; }
      if (row !== pointerCard) { resetPointer(); pointerCard = row; }
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        const box = row.getBoundingClientRect(), x = Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)), y = Math.max(0,Math.min(1,(event.clientY-box.top)/box.height));
        row.style.setProperty('--skill-x', x*100+'%'); row.style.setProperty('--skill-y', y*100+'%');
        row.style.setProperty('--skill-rx', (0.5-y)*5+'deg'); row.style.setProperty('--skill-ry', (x-0.5)*5+'deg');
        pointerFrame = 0;
      });
    }
    const motionChanged = () => { resetPointer(); if (reduced.matches) finish(); };
    const visibilityChanged = () => { panel.classList.toggle('skills-in-view', visible && !document.hidden); if (document.hidden) { finish(); resetPointer(); } };
    replay.addEventListener('click', animate);
    list.addEventListener('pointermove', move); list.addEventListener('pointerleave', resetPointer);
    reduced.addEventListener('change', motionChanged); fine.addEventListener('change', resetPointer);
    document.addEventListener('visibilitychange', visibilityChanged);
    dispose = () => { finish(); resetPointer(); observer?.disconnect(); replay.removeEventListener('click',animate); list.removeEventListener('pointermove',move); list.removeEventListener('pointerleave',resetPointer); reduced.removeEventListener('change',motionChanged); fine.removeEventListener('change',resetPointer); document.removeEventListener('visibilitychange',visibilityChanged); };
  }
  return { markup, percent, kind, mount };
});
