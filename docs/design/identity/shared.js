/* Injects the SVG sprite with the Remote Harness mark ("Cursor Signal": a terminal cursor block with the `>`
   prompt cut out of it and three signal arcs leaving it to the right) so every page uses one source — the
   same 256-box geometry as apps/mobile/scripts/icons.mts.
   <svg><use href="#rh-mark"/></svg> — color via `color`; `--cutout: #fff` fills the block solid (the prompt
   disappears: the tray "working" state); the block alone can take another color via --block. */
(function () {
  var sprite = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">',
    // Regular weight: app icon, splash, README, landing.
    '<symbol id="rh-mark" viewBox="0 0 256 256">',
    '<mask id="rh-cursor"><rect width="256" height="256" fill="#fff"/><path d="M47 99L81 128L47 157" fill="none" stroke="var(--cutout, #000)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></mask>',
    '<rect x="26" y="60" width="76" height="136" rx="15" fill="var(--block, currentColor)" mask="url(#rh-cursor)"/>',
    '<g fill="none" stroke="currentColor" stroke-width="22" stroke-linecap="round">',
    '<path d="M129.6 104.9A36 36 0 0 1 129.6 151.1"/>',
    '<path d="M160.2 79.1A76 76 0 0 1 160.2 176.9"/>',
    '<path d="M190.9 53.4A116 116 0 0 1 190.9 202.6"/>',
    '</g>',
    '</symbol>',
    // Bold weight: menu bar, notification icon, favicon 16/32, anything under 24 px (wider cutout and arcs).
    '<symbol id="rh-mark-bold" viewBox="0 0 256 256">',
    '<mask id="rh-cursor-bold"><rect width="256" height="256" fill="#fff"/><path d="M47 99L81 128L47 157" fill="none" stroke="var(--cutout, #000)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/></mask>',
    '<rect x="26" y="60" width="76" height="136" rx="15" fill="var(--block, currentColor)" mask="url(#rh-cursor-bold)"/>',
    '<g fill="none" stroke="currentColor" stroke-width="28" stroke-linecap="round">',
    '<path d="M129.6 104.9A36 36 0 0 1 129.6 151.1"/>',
    '<path d="M160.2 79.1A76 76 0 0 1 160.2 176.9"/>',
    '<path d="M190.9 53.4A116 116 0 0 1 190.9 202.6"/>',
    '</g>',
    '</symbol>',
    '</svg>',
  ].join('');
  var holder = document.createElement('div');
  holder.innerHTML = sprite;
  document.body.prepend(holder.firstElementChild);

  // Theme switcher: buttons with [data-theme] swap the `t-*` class of the closest [data-themed] target.
  document.querySelectorAll('[data-theme-switch]').forEach(function (group) {
    var target = document.querySelector(group.getAttribute('data-theme-switch'));
    group.querySelectorAll('[data-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!target) return;
        target.className = target.className.replace(/\bt-\w+\b/g, '').trim() + ' ' + btn.getAttribute('data-theme');
        group.querySelectorAll('[data-theme]').forEach(function (b) { b.classList.toggle('on', b === btn); });
      });
    });
  });

  // Copy buttons on the landing mockup.
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () { var old = btn.textContent; btn.textContent = btn.getAttribute('data-copied') || 'Copied'; setTimeout(function () { btn.textContent = old; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done); else done();
    });
  });
})();
