/* The tambura sends up musical notes, one per theme of writing. Catch a note (or pick a theme
   button) to see what's in it. Plucking a string releases a note on the spot. */
(function () {
  const hero = document.querySelector('.hero');
  const sky = hero && hero.querySelector('.sky');
  const dataEl = document.getElementById('themes-data');
  if (!sky || !dataEl) return;
  const themes = JSON.parse(dataEl.textContent);
  const byId = Object.fromEntries(themes.map((t) => [t.id, t]));
  const tambura = hero.querySelector('.tambura');
  const card = hero.querySelector('.theme-card');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Sound: a plucked string (Karplus-Strong) tuned Pa-Sa-Sa-Sa in C# ----
  const SA = 138.59, STRINGS = [SA * 0.75, SA, SA, SA / 2];
  let ctx = null;
  const wake = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  };
  ['pointerdown', 'keydown'].forEach((type) => hero.addEventListener(type, wake, { once: true }));
  function pluck(freq) {
    if (!ctx || ctx.state !== 'running') return;
    const rate = ctx.sampleRate, len = Math.floor(rate * 3), buf = ctx.createBuffer(1, len, rate), out = buf.getChannelData(0);
    const period = Math.round(rate / freq), ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    for (let i = 0; i < len; i++) {
      const j = i % period, next = (ring[j] + ring[(j + 1) % period]) * 0.4985;
      ring[j] = next;
      out[i] = next + 0.08 * Math.tanh(next * 6); // a little buzz, like the jawari bridge
    }
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; g.gain.value = .45;
    src.connect(g); g.connect(ctx.destination); src.start();
  }

  // ---- Where notes come from: the tambura's gourd, in hero coordinates ----
  const svg = tambura.querySelector('svg');
  function fromTambura(stringIndex) {
    const r = svg.getBoundingClientRect(), h = hero.getBoundingClientRect();
    const vx = (x) => r.left - h.left + (x + 20) / 160 * r.width;
    const vy = (y) => r.top - h.top + y / 465 * r.height;
    if (stringIndex == null) return { x: vx(60 + (Math.random() - .5) * 30), y: vy(330) };
    return { x: vx(51 + stringIndex * 6) - Math.random() * 60, y: vy(120 + Math.random() * 200) };
  }

  // ---- Floating notes ----
  const notes = [];
  let order = [], next = 0;
  function nextTheme() {
    if (next >= order.length) { order = themes.map((t) => t.id).sort(() => Math.random() - .5); next = 0; }
    return byId[order[next++]];
  }
  function makeNote(theme) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'float-note';
    el.tabIndex = -1; // the theme buttons are the keyboard route
    el.dataset.theme = theme.id;
    el.style.setProperty('--c', theme.color);
    el.innerHTML = '<svg><use href="#note-' + theme.shape + '"/></svg><span class="tag"></span>';
    el.querySelector('.tag').textContent = theme.name;
    sky.appendChild(el);
    return el;
  }
  function spawn(theme, at) {
    const max = hero.clientWidth < 640 ? 6 : 10;
    if (notes.filter((n) => !n.held).length >= max) return;
    const el = makeNote(theme);
    const n = {
      el, theme, x: at.x, y: at.y, age: 0, held: false,
      vy: -(34 + Math.random() * 22), vx: -(10 + Math.random() * 50), // drift up and towards the text
      amp: 10 + Math.random() * 16, freq: .6 + Math.random() * .6, phase: Math.random() * 6.3, spin: (Math.random() - .5) * 20,
    };
    el.addEventListener('pointerenter', () => { n.held = true; el.classList.add('held'); });
    el.addEventListener('pointerleave', () => { if (openNote !== n) { n.held = false; el.classList.remove('held'); } });
    el.addEventListener('click', (e) => { e.stopPropagation(); openCard(theme, n); });
    notes.push(n);
    place(n);
    return n;
  }
  function place(n) {
    const sway = Math.sin(n.phase + n.age * n.freq) * n.amp;
    const fadeIn = Math.min(1, n.age / .6), fadeOut = Math.min(1, Math.max(0, (n.y + 40) / 140));
    n.el.style.transform = `translate(${n.x + sway - 23}px, ${n.y - 23}px) rotate(${Math.sin(n.phase + n.age * .8) * n.spin}deg)`;
    n.el.style.opacity = n.held ? 1 : Math.min(fadeIn, fadeOut);
  }

  let last = 0, sinceSpawn = 0, running = true;
  function frame(t) {
    const dt = Math.min(.05, (t - (last || t)) / 1000);
    last = t;
    if (running) {
      sinceSpawn += dt;
      if (sinceSpawn > 1.3) { sinceSpawn = 0; spawn(nextTheme(), fromTambura()); }
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        if (!n.held) { n.age += dt; n.y += n.vy * dt; n.x += n.vx * dt; }
        if (n.y < -80 || n.x < -120) { n.el.remove(); notes.splice(i, 1); continue; }
        place(n);
      }
    }
    requestAnimationFrame(frame);
  }

  if (reduced) {
    // No floating: lay one note per theme in an arc around the tambura
    const lay = () => {
      notes.splice(0).forEach((n) => n.el.remove());
      // Two staggered columns beside the tambura's neck
      const r = svg.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      const neckX = r.left - hr.left + r.width / 2, top = r.top - hr.top + r.height * .12, span = r.height * .62;
      const rows = Math.ceil(themes.length / 2);
      themes.forEach((t, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const n = spawn(t, { x: neckX - 120 - col * 120, y: top + (row + col * .5) * span / rows });
        if (n) { n.held = true; n.el.style.opacity = 1; }
      });
    };
    window.addEventListener('load', lay);
    window.addEventListener('resize', lay);
  } else {
    requestAnimationFrame(frame);
    // Rest when the hero is off screen or the tab is hidden
    new IntersectionObserver(([e]) => { running = e.isIntersecting; last = 0; }).observe(hero);
    document.addEventListener('visibilitychange', () => { running = !document.hidden; last = 0; });
  }

  // ---- Plucking ----
  const strings = [...tambura.querySelectorAll('.string')];
  const lastPluck = [0, 0, 0, 0];
  function sound(i, release = true) {
    const now = performance.now();
    if (now - lastPluck[i] < 220) return;
    lastPluck[i] = now;
    pluck(STRINGS[i]);
    const s = strings[i];
    s.classList.remove('ring'); void s.getBBox(); s.classList.add('ring');
    if (release && !reduced) spawn(nextTheme(), fromTambura(i));
  }
  tambura.querySelectorAll('.hit').forEach((hit) => {
    const i = +hit.dataset.string;
    hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') sound(i); });
    hit.addEventListener('pointerdown', (e) => { wake(); sound(i); e.stopPropagation(); });
  });
  tambura.addEventListener('click', (e) => {
    if (e.target.closest('.hit')) return;
    wake();
    [0, 1, 2, 3].forEach((i, k) => setTimeout(() => sound(i), k * 420));
  });

  // ---- Theme card ----
  let openNote = null, openChip = null;
  const chips = [...hero.querySelectorAll('.theme-chip')];
  chips.forEach((chip) => chip.setAttribute('aria-expanded', 'false'));
  function openCard(theme, note, chip) {
    closeCard(false);
    card.style.setProperty('--c', getComputedStyle(note ? note.el : chip).getPropertyValue('--c') || theme.color);
    card.querySelector('.theme-card-kicker use').setAttribute('href', '#note-' + theme.shape);
    card.querySelector('.theme-card-kicker span').textContent = theme.items.length + (theme.items.length === 1 ? ' piece' : ' pieces');
    card.querySelector('h2').textContent = theme.name;
    card.querySelector('.theme-card-blurb').textContent = theme.blurb;
    const list = card.querySelector('.theme-card-list');
    list.innerHTML = '';
    theme.items.forEach((it) => {
      const li = document.createElement('li'), a = document.createElement('a'), t = document.createElement('strong'), d = document.createElement('span');
      a.href = it.u; t.textContent = it.t; d.textContent = it.d;
      a.append(t, d); li.appendChild(a); list.appendChild(li);
    });
    card.hidden = false;
    // Sit the card next to whatever opened it, kept inside the hero
    const h = hero.getBoundingClientRect(), anchor = (note ? note.el : chip).getBoundingClientRect();
    const w = card.offsetWidth, ch = card.offsetHeight;
    let left = anchor.left - h.left + anchor.width / 2 - w / 2;
    left = Math.max(16, Math.min(left, h.width - w - 16));
    let top = anchor.bottom - h.top + 12;
    if (top + ch > h.height - 16) top = anchor.top - h.top - ch - 12;
    card.style.left = left + 'px';
    card.style.top = Math.max(16, top) + 'px';
    if (note) { openNote = note; note.held = true; note.el.classList.add('held'); }
    if (chip) { openChip = chip; chip.setAttribute('aria-expanded', 'true'); card.querySelector('.theme-card-close').focus(); }
  }
  function closeCard(restoreFocus = true) {
    if (card.hidden) return;
    card.hidden = true;
    if (openNote) { openNote.held = false; openNote.el.classList.remove('held'); openNote = null; }
    if (openChip) { openChip.setAttribute('aria-expanded', 'false'); if (restoreFocus) openChip.focus(); openChip = null; }
  }
  chips.forEach((chip) => chip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (openChip === chip) return closeCard();
    openCard(byId[chip.dataset.theme], null, chip);
  }));
  card.querySelector('.theme-card-close').addEventListener('click', () => closeCard());
  card.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => closeCard(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });
})();
