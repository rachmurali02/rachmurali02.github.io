/* The tambura sends up three musical notes: Experiments, Musings and Journey. Click one to jump
   to that section. Notes rise in two lanes either side of the tambura at one steady speed, and a
   new note waits until the lane is clear, so they never overlap each other or the heading.
   Running across a string makes it shimmer and releases a note when there's room. It's silent. */
(function () {
  const hero = document.querySelector('.hero');
  const sky = hero && hero.querySelector('.sky');
  const dataEl = document.getElementById('notes-data');
  if (!sky || !dataEl) return;
  const kinds = JSON.parse(dataEl.textContent);
  const tambura = hero.querySelector('.tambura');
  const svg = tambura.querySelector('svg');
  const heading = hero.querySelector('.hello');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Geometry: two lanes beside the tambura, from the gourd up to just below the heading ----
  function toHero(x, y) {
    const m = svg.getScreenCTM(), h = hero.getBoundingClientRect();
    return { x: m.a * x + m.c * y + m.e - h.left, y: m.b * x + m.d * y + m.f - h.top };
  }
  let lanes = [], startY = 0, endY = 0;
  function measure() {
    const h = hero.getBoundingClientRect(), r = svg.getBoundingClientRect();
    const mid = r.left - h.left + r.width / 2, gap = Math.max(110, Math.min(200, h.width * .16));
    lanes = [mid - gap, mid + gap].map((x, i) => ({ x, i, notes: [] }));
    startY = toHero(100, 470).y;
    endY = heading.getBoundingClientRect().bottom - h.top + 70;
  }
  const SPEED = 36, SPACING = 200; // px per second, and the clear space a lane needs before a new note

  // ---- Notes ----
  let next = 0;
  function makeNote(kind) {
    const el = document.createElement('a');
    el.href = kind.href;
    el.className = 'float-note';
    el.tabIndex = -1; // the header menu is the keyboard route to these sections
    el.style.setProperty('--c', kind.color);
    el.innerHTML = '<svg><use href="#note-' + kind.shape + '"/></svg><span class="tag"></span>';
    el.querySelector('.tag').textContent = kind.name;
    sky.appendChild(el);
    return el;
  }
  function laneFree(lane) {
    const last = lane.notes[lane.notes.length - 1];
    return !last || startY - last.y >= SPACING;
  }
  function spawn(laneIndex) {
    const free = lanes.filter(laneFree);
    if (!free.length) return null;
    const lane = free.find((l) => l.i === laneIndex) || free[Math.floor(Math.random() * free.length)];
    const kind = kinds[next++ % kinds.length];
    const n = { el: makeNote(kind), lane, y: startY, age: 0, held: false, phase: Math.random() * 6.3 };
    n.el.addEventListener('pointerenter', () => { n.held = true; n.el.classList.add('held'); });
    n.el.addEventListener('pointerleave', () => { n.held = false; n.el.classList.remove('held'); });
    lane.notes.push(n);
    place(n);
    return n;
  }
  function place(n) {
    const sway = Math.sin(n.phase + n.age * .9) * 6;
    const fadeIn = Math.min(1, n.age / .8), fadeOut = Math.min(1, Math.max(0, (n.y - endY) / 90));
    n.el.style.transform = `translate(${n.lane.x + sway}px, ${n.y}px) translate(-50%, -50%) rotate(${Math.sin(n.phase + n.age * .7) * 6}deg)`;
    n.el.style.opacity = n.held ? 1 : Math.min(fadeIn, fadeOut);
  }

  let last = 0, running = true, sinceSpawn = 0;
  function frame(t) {
    const dt = Math.min(.05, (t - (last || t)) / 1000);
    last = t;
    if (running) {
      sinceSpawn += dt;
      if (sinceSpawn > 2.6 && spawn()) sinceSpawn = 0;
      lanes.forEach((lane) => {
        // A held note pauses its whole lane, so the notes behind it never catch up
        const paused = lane.notes.some((n) => n.held);
        for (let i = lane.notes.length - 1; i >= 0; i--) {
          const n = lane.notes[i];
          if (!paused) { n.age += dt; n.y -= SPEED * dt; }
          if (n.y < endY - 10) { n.el.remove(); lane.notes.splice(i, 1); continue; }
          place(n);
        }
      });
    }
    requestAnimationFrame(frame);
  }

  function reset() {
    lanes.forEach((l) => l.notes.forEach((n) => n.el.remove()));
    measure();
  }
  if (reduced) {
    // No floating: one still note per section beside the tambura
    const lay = () => {
      reset();
      const rows = [[0, .25], [1, .45], [0, .65]];
      kinds.forEach((kind, i) => {
        const [lane, f] = rows[i];
        const el = makeNote(kind);
        lanes[lane].notes.push({ el });
        el.style.transform = `translate(${lanes[lane].x}px, ${endY + (startY - endY) * f}px) translate(-50%, -50%)`;
      });
    };
    window.addEventListener('load', lay);
    window.addEventListener('resize', lay);
  } else {
    measure();
    window.addEventListener('load', measure);
    window.addEventListener('resize', reset);
    requestAnimationFrame(frame);
    // Rest when the hero is off screen or the tab is hidden
    new IntersectionObserver(([e]) => { running = e.isIntersecting; last = 0; }).observe(hero);
    document.addEventListener('visibilitychange', () => { running = !document.hidden; last = 0; });
  }

  // ---- Plucking (visual only) ----
  const strings = [...tambura.querySelectorAll('.string')];
  const lastPluck = [0, 0, 0, 0];
  function pluck(i) {
    const now = performance.now();
    if (now - lastPluck[i] < 220) return;
    lastPluck[i] = now;
    const s = strings[i];
    s.classList.remove('ring'); void s.getBBox(); s.classList.add('ring');
    if (!reduced && spawn(i < 2 ? 0 : 1)) sinceSpawn = 0;
  }
  tambura.querySelectorAll('.hit').forEach((hit) => {
    const i = +hit.dataset.string;
    hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pluck(i); });
    hit.addEventListener('pointerdown', (e) => { pluck(i); e.stopPropagation(); });
  });
  tambura.addEventListener('click', (e) => {
    if (e.target.closest('.hit')) return;
    [0, 1, 2, 3].forEach((i, k) => setTimeout(() => pluck(i), k * 420));
  });
})();
