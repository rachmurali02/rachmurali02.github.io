/* The music shelf: pluck the tambura, drone on the shruti box, play the Desh Thillana clip from
   the musical note or the now-playing bar, and knock the whole shelf over (or tidy it up). */
(function () {
  const stage = document.querySelector('.stage');
  if (!stage) return;

  // Tuned to a tambura in C#: Pa below, two middle Sa, and the low Sa
  const SA = 138.59;
  const STRINGS = [SA * 0.75, SA, SA, SA / 2];

  let ctx = null;
  const audio = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  // Browsers only allow sound after a tap or key press, so wake audio on the first one
  ['pointerdown', 'keydown'].forEach((type) => stage.addEventListener(type, audio, { once: true }));

  // Karplus-Strong plucked string, with a little buzz for the tambura's jawari
  function pluck(freq) {
    if (!ctx || ctx.state !== 'running') return;
    const rate = ctx.sampleRate, len = Math.floor(rate * 3.2), buf = ctx.createBuffer(1, len, rate), out = buf.getChannelData(0);
    const period = Math.round(rate / freq), ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const j = i % period, next = (ring[j] + ring[(j + 1) % period]) * 0.4985;
      ring[j] = next;
      out[i] = next + 0.08 * Math.tanh(next * 6) - 0.02 * prev;
      prev = next;
    }
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; g.gain.value = .5;
    src.connect(g); g.connect(ctx.destination); src.start();
  }

  const tambura = stage.querySelector('.tambura');
  const strings = [...tambura.querySelectorAll('.string')];
  function sound(i) {
    pluck(STRINGS[i]);
    const s = strings[i];
    s.classList.remove('ring'); void s.getBBox(); s.classList.add('ring');
  }
  tambura.querySelectorAll('.hit').forEach((hit) => {
    const i = +hit.dataset.string;
    hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') sound(i); });
    hit.addEventListener('pointerdown', (e) => { audio(); sound(i); e.stopPropagation(); });
  });
  // Clicking (or Enter on) the tambura plays the classic Pa-Sa-Sa-Sa cycle
  tambura.addEventListener('click', (e) => {
    if (e.target.closest('.hit')) return;
    audio();
    [0, 1, 2, 3].forEach((i, k) => setTimeout(() => sound(i), k * 420));
  });

  // Shruti box drone: Sa, Pa and upper Sa through soft reeds, swelling with the bellows
  const shruti = stage.querySelector('.shruti');
  let drone = null;
  function startDrone() {
    const c = audio(), t = c.currentTime;
    const out = c.createGain(), filter = c.createBiquadFilter(), lfo = c.createOscillator(), depth = c.createGain();
    filter.type = 'lowpass'; filter.frequency.value = 1100; filter.Q.value = .7;
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.09, t + .8);
    lfo.frequency.value = 1 / 2.6; depth.gain.value = .025;
    lfo.connect(depth); depth.connect(out.gain);
    const oscs = [SA, SA * 1.5, SA * 2, SA * 1.003].map((f) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(filter); o.start(t); return o;
    });
    filter.connect(out); out.connect(c.destination); lfo.start(t);
    drone = { out, oscs: oscs.concat(lfo) };
    shruti.classList.add('on'); shruti.setAttribute('aria-pressed', 'true'); shruti.setAttribute('aria-label', 'Shruti box: stop the drone');
  }
  function stopDrone() {
    if (!drone) return;
    const t = ctx.currentTime, d = drone;
    d.out.gain.cancelScheduledValues(t); d.out.gain.setValueAtTime(d.out.gain.value, t); d.out.gain.linearRampToValueAtTime(0, t + .5);
    d.oscs.forEach((o) => o.stop(t + .55));
    drone = null;
    shruti.classList.remove('on'); shruti.setAttribute('aria-pressed', 'false'); shruti.setAttribute('aria-label', 'Shruti box: play a drone');
  }
  shruti.addEventListener('click', () => {
    if (drone) return stopDrone();
    const m = window.sideQuestsMusic;
    if (m && !m.audio.paused) m.toggle();
    startDrone();
  });

  // The musical note and the now-playing bar share the site's Desh Thillana player (music.js)
  const note = stage.querySelector('.big-note');
  const np = document.querySelector('.now-playing');
  const npPlay = np && np.querySelector('.np-play');
  const bars = np ? [...np.querySelectorAll('.np-wave i')] : [];
  function toggleSong() {
    const m = window.sideQuestsMusic;
    if (!m) return;
    if (m.audio.paused) stopDrone();
    m.toggle();
  }
  function hookMusic() {
    const m = window.sideQuestsMusic;
    if (!m) return;
    const sync = () => {
      const on = !m.audio.paused;
      [note, npPlay].forEach((b) => { if (!b) return; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    };
    const progress = () => {
      const f = m.audio.duration ? m.audio.currentTime / m.audio.duration : 0;
      bars.forEach((b, i) => b.classList.toggle('done', i / bars.length < f));
    };
    m.audio.addEventListener('play', sync);
    m.audio.addEventListener('pause', sync);
    m.audio.addEventListener('timeupdate', progress);
    sync();
  }
  if (window.sideQuestsMusic) hookMusic(); else document.addEventListener('sidequests:music', hookMusic, { once: true });
  note.addEventListener('click', toggleSong);
  if (npPlay) npPlay.addEventListener('click', toggleSong);
  if (np) np.querySelector('.np-wave').addEventListener('click', (e) => {
    const m = window.sideQuestsMusic;
    if (!m) return;
    const r = e.currentTarget.getBoundingClientRect();
    const seek = () => { m.audio.currentTime = (e.clientX - r.left) / r.width * (m.audio.duration || 30); };
    if (m.audio.paused) { toggleSong(); m.audio.addEventListener('playing', seek, { once: true }); } else seek();
  });

  // Knock the shelf over, or tidy it back up
  const tidy = stage.querySelector('.tidy');
  tidy.addEventListener('click', () => {
    const down = stage.dataset.layout !== 'tumble';
    stage.dataset.layout = down ? 'tumble' : 'shelf';
    tidy.querySelector('span').textContent = down ? 'Tidy up' : 'Knock over';
    tidy.setAttribute('aria-label', down ? 'Tidy the shelf up' : 'Knock the shelf over');
  });
})();
