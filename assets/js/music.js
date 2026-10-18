/* Background music for Side Quests: a ♪ switch in the header, off until a visitor turns it on.
   The clip is 30 seconds of Desh Thillana by Vittal Rangan, looped. */
(function () {
  const CREDIT = 'Desh Thillana by Vittal Rangan';
  const src = new URL('../audio/desh-thillana.mp3', document.currentScript.src).href;
  const nav = document.querySelector('header.top nav');
  const themeToggle = document.getElementById('theme-toggle');
  if (!nav) return;

  const store = {
    get(area, key) { try { return window[area].getItem(key); } catch (e) { return null; } },
    set(area, key, value) { try { window[area].setItem(key, value); } catch (e) {} },
  };

  const audio = new Audio();
  audio.src = src;
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0.35;

  const button = document.createElement('button');
  button.id = 'music-toggle';
  button.className = 'theme-emoji music-toggle';
  button.innerHTML = '<span aria-hidden="true">♪</span>';
  nav.insertBefore(button, themeToggle);

  // Credit the music in every footer
  const copy = document.querySelector('footer .copy');
  if (copy) {
    const credit = document.createElement('span');
    credit.className = 'music-credit';
    credit.textContent = '♪ ' + CREDIT;
    copy.appendChild(credit);
  }

  function sync() {
    const playing = !audio.paused;
    const label = (playing ? 'Pause' : 'Play') + ' background music: ' + CREDIT;
    button.classList.toggle('playing', playing);
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function play() {
    // Carry on from where the previous page left off
    const t = parseFloat(store.get('sessionStorage', 'musicTime'));
    if (!isNaN(t) && audio.currentTime === 0) {
      audio.addEventListener('loadedmetadata', () => { audio.currentTime = t % (audio.duration || 30); }, { once: true });
    }
    return audio.play();
  }

  button.addEventListener('click', () => {
    if (audio.paused) {
      store.set('localStorage', 'music', 'on');
      play().catch(() => {});
    } else {
      store.set('localStorage', 'music', 'off');
      audio.pause();
    }
  });
  audio.addEventListener('play', sync);
  audio.addEventListener('pause', sync);
  window.addEventListener('pagehide', () => {
    if (!audio.paused) store.set('sessionStorage', 'musicTime', String(audio.currentTime));
  });
  sync();

  // Visitors who turned the music on keep it on as they move between pages.
  // Browsers may block sound until the page is touched, so resume on the first tap or key press.
  if (store.get('localStorage', 'music') === 'on') {
    play().catch(() => {
      const resume = (e) => {
        if (button.contains(e.target)) return;
        window.removeEventListener('pointerdown', resume, true);
        window.removeEventListener('keydown', resume, true);
        if (store.get('localStorage', 'music') === 'on') play().catch(() => {});
      };
      window.addEventListener('pointerdown', resume, true);
      window.addEventListener('keydown', resume, true);
    });
  }
})();
