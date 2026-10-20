/* Play the blurb's line of music as the band scrolls past: each word's note drops onto the
   staff and the word lights up, in order. With reduced motion, the whole line just shows. */
(function () {
  const band = document.querySelector('.lyrics-band');
  if (!band) return;
  const words = [...band.querySelectorAll('.lyric[data-i]')];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    words.forEach((w) => w.classList.add('on'));
    return;
  }
  let ticking = false;
  function update() {
    ticking = false;
    const r = band.getBoundingClientRect();
    const travel = Math.max(1, r.height - innerHeight);
    // Start a little before the band pins, finish with some scroll to spare
    const p = Math.min(1, Math.max(0, (innerHeight * .35 - r.top) / (travel * .8)));
    const count = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < count));
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
})();
