/* Public-image deterrents only. Public media remains downloadable; this is not DRM.
   Do not disable keyboard shortcuts, text copying, form editing, or admin tools. */
(() => {
  'use strict';
  const protectedMedia = 'img, picture, .stage-card, .work-tile, .portrait-arch, .case-modal__media';
  const editable = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
  function isProtected(target) {
    return target instanceof Element && !target.closest(editable) && Boolean(target.closest(protectedMedia));
  }
  for (const name of ['contextmenu', 'dragstart', 'selectstart']) {
    document.addEventListener(name, event => {
      if (isProtected(event.target)) event.preventDefault();
    }, { capture: true });
  }
  function markImages(root) {
    if (root instanceof HTMLImageElement) root.draggable = false;
    root.querySelectorAll?.('img').forEach(image => { image.draggable = false; });
  }
  markImages(document);
  // The portfolio, social buttons and modal images can be rendered after cloud load.
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) markImages(node);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
