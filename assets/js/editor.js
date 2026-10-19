/* In-place editor for experiment posts. Open a post with ?edit (or use the Edit link that appears
   once a GitHub token is saved in this browser) to edit the title, standfirst and article exactly
   as they look, with a formatting toolbar and photo uploads. Save commits the page, and any new
   photos, to GitHub in one commit. Nothing can be saved without a token, which is kept only in
   this browser. */
(function () {
  const REPO = 'rachmurali02/rachmurali02.github.io';
  const BRANCH = 'main';
  const API = 'https://api.github.com/repos/' + REPO;
  const TOKEN_KEY = 'sideQuestsGithubToken';

  const article = document.querySelector('article.post-body');
  const title = document.querySelector('.post-title h1');
  const standfirst = document.querySelector('.post-title .standfirst');
  if (!article || !title) return;

  const store = {
    get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } },
    set: (v) => { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} },
  };
  const params = new URLSearchParams(location.search);
  const path = decodeURIComponent(location.pathname).replace(/^\//, '');
  const slug = path.split('/').pop().replace(/\.html$/, '');

  // Readers never see the editor. The owner (token saved here) gets a quiet Edit link in the footer.
  if (!params.has('edit')) {
    if (store.get()) {
      const links = document.querySelector('footer .links');
      if (links) {
        const a = document.createElement('a');
        a.href = '?edit';
        a.textContent = '✎ Edit';
        links.appendChild(a);
      }
    }
    return;
  }

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('../css/editor.css', document.currentScript.src).href;
  document.head.appendChild(css);

  // ---------- UI ----------
  const el = (tag, attrs, html) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  };
  const bar = el('div', { class: 'ed-bar', role: 'toolbar', 'aria-label': 'Editor' }, `
    <span class="ed-dot" aria-hidden="true"></span><span class="ed-status">Editing</span>
    <button type="button" class="ed-btn" data-act="photo">Add photo</button>
    <button type="button" class="ed-btn" data-act="cancel">Done</button>
    <button type="button" class="ed-btn ed-primary" data-act="save">Save</button>`);
  const fmt = el('div', { class: 'ed-fmt', role: 'toolbar', 'aria-label': 'Formatting' }, `
    <button type="button" data-cmd="bold" title="Bold (Ctrl/⌘+B)"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italic (Ctrl/⌘+I)"><i>I</i></button>
    <button type="button" data-block="h2" title="Heading">H2</button>
    <button type="button" data-block="h3" title="Subheading">H3</button>
    <button type="button" data-block="p" title="Normal text">¶</button>
    <button type="button" data-block="blockquote" title="Quote">“”</button>
    <button type="button" data-cmd="insertUnorderedList" title="Bullet list">•</button>
    <button type="button" data-cmd="insertOrderedList" title="Numbered list">1.</button>
    <button type="button" data-act="link" title="Link">🔗</button>
    <button type="button" data-act="code" title="Code">&lt;/&gt;</button>
    <button type="button" data-cmd="removeFormat" title="Clear formatting">⨯</button>`);
  const fileInput = el('input', { type: 'file', accept: 'image/*', hidden: '' });
  document.body.append(bar, fmt, fileInput);

  const status = bar.querySelector('.ed-status');
  function say(text, kind) {
    status.textContent = text;
    bar.dataset.state = kind || '';
  }

  // ---------- Make the post editable ----------
  // Remember the article as published, so Save can tell what changed and Done can put it back
  const clean = (node) => {
    const c = node.cloneNode(true);
    c.querySelectorAll('[contenteditable]').forEach((e) => e.removeAttribute('contenteditable'));
    c.querySelectorAll('.ed-selected').forEach((e) => e.classList.remove('ed-selected'));
    c.querySelectorAll('[data-reveal].in, [data-rule].in').forEach((e) => e.classList.remove('in'));
    c.querySelectorAll('[class=""]').forEach((e) => e.removeAttribute('class'));
    // Match the posts' own markup: <strong> and <em>, not the browser's <b> and <i>
    c.querySelectorAll('b, i').forEach((e) => { const n = document.createElement(e.tagName === 'B' ? 'strong' : 'em'); n.append(...e.childNodes); e.replaceWith(n); });
    // New photos show from memory while editing; the saved page points at their file in the repo
    c.querySelectorAll('img[data-target]').forEach((img) => { img.src = img.dataset.target; img.removeAttribute('data-pending'); img.removeAttribute('data-target'); });
    return c.innerHTML;
  };
  const tidy = (e) => e.innerHTML.replace(/&nbsp;/g, ' ').replace(/(<br>|\s)+$/, '').replace(/\s+/g, ' ').trim();
  const original = { article: clean(article), title: tidy(title), standfirst: standfirst ? tidy(standfirst) : null };
  let sourceSha = null; // the file's version on GitHub when editing started

  article.contentEditable = 'true';
  title.contentEditable = 'true';
  if (standfirst) standfirst.contentEditable = 'true';
  // Embedded demos stay as they are
  article.querySelectorAll('iframe, video').forEach((e) => { (e.parentElement === article ? e : e.parentElement).contentEditable = 'false'; });
  document.documentElement.classList.add('ed-on');
  article.focus();

  let dirty = false;
  const markDirty = () => { if (!dirty) { dirty = true; say('Unsaved changes', 'dirty'); } };
  [article, title, standfirst].forEach((e) => e && e.addEventListener('input', markDirty));
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // Paste as plain text, so formatting from other apps doesn't sneak in
  document.addEventListener('paste', (e) => {
    if (!e.target.closest || !e.target.closest('[contenteditable="true"]')) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  });
  // Titles stay one line
  [title, standfirst].forEach((e) => e && e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.preventDefault(); }));

  // ---------- Formatting toolbar ----------
  const inArticle = (node) => node && article.contains(node.nodeType === 1 ? node : node.parentNode);
  let savedRange = null;
  document.addEventListener('selectionchange', () => {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed || !inArticle(sel.anchorNode)) { if (!fmt.contains(document.activeElement)) fmt.classList.remove('show'); return; }
    savedRange = sel.getRangeAt(0).cloneRange();
    const r = savedRange.getBoundingClientRect();
    fmt.classList.add('show');
    const w = fmt.offsetWidth;
    fmt.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    fmt.style.top = Math.max(8, r.top - fmt.offsetHeight - 10) + scrollY + 'px';
  });
  fmt.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection
  fmt.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
    if (b.dataset.cmd) document.execCommand(b.dataset.cmd);
    if (b.dataset.block) document.execCommand('formatBlock', false, b.dataset.block);
    if (b.dataset.act === 'link') {
      const url = prompt('Link to (leave empty to remove the link):', 'https://');
      if (url === null) return;
      document.execCommand(url && url !== 'https://' ? 'createLink' : 'unlink', false, url);
    }
    if (b.dataset.act === 'code') {
      const s = getSelection();
      const text = s.toString();
      document.execCommand('insertHTML', false, '<code>' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</code>');
    }
    markDirty();
  });

  // ---------- Photos ----------
  const pending = new Map(); // repo path -> base64 data
  let caretRange = null;
  article.addEventListener('blur', () => { const s = getSelection(); if (s.rangeCount && inArticle(s.anchorNode)) caretRange = s.getRangeAt(0).cloneRange(); });
  article.addEventListener('click', (e) => {
    article.querySelectorAll('.ed-selected').forEach((x) => x.classList.remove('ed-selected'));
    if (e.target.tagName === 'IMG') e.target.classList.add('ed-selected');
  });

  function resize(file) {
    return new Promise((resolve, reject) => {
      if (/svg|gif/.test(file.type)) {
        const r = new FileReader();
        r.onload = () => resolve({ dataUrl: r.result, ext: file.type.includes('svg') ? 'svg' : 'gif' });
        r.onerror = reject; r.readAsDataURL(file); return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const png = file.type === 'image/png' && file.size < 1.2e6;
        resolve({ dataUrl: c.toDataURL(png ? 'image/png' : 'image/jpeg', .85), ext: png ? 'png' : 'jpg' });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('That file is not an image this browser can read.'));
      img.src = URL.createObjectURL(file);
    });
  }
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      say('Preparing photo…');
      const { dataUrl, ext } = await resize(file);
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const name = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'photo';
      const repoPath = `assets/images/posts/${slug}/${stamp}-${name}.${ext}`;
      pending.set(repoPath, dataUrl.split(',')[1]);
      const fig = el('figure', {}, '');
      const img = el('img', { src: dataUrl, alt: '', 'data-pending': '', 'data-target': '../' + repoPath });
      const cap = el('figcaption', {}, 'Add a caption');
      fig.append(img, cap);
      const s = getSelection();
      if (caretRange && inArticle(caretRange.startContainer)) { s.removeAllRanges(); s.addRange(caretRange); }
      let block = s.rangeCount && inArticle(s.anchorNode) ? s.anchorNode : null;
      while (block && block.parentNode !== article) block = block.parentNode;
      const gap = () => document.createTextNode('\n\n      ');
      if (block) block.after(gap(), fig, gap()); else article.append(gap(), fig);
      const alt = prompt('Describe the photo for people who can’t see it (alt text):', '');
      if (alt) img.alt = alt;
      const range = document.createRange(); range.selectNodeContents(cap);
      s.removeAllRanges(); s.addRange(range);
      dirty = true;
      say('Unsaved changes', 'dirty');
    } catch (err) { say(err.message, 'error'); }
  });

  // ---------- GitHub ----------
  async function gh(url, opts = {}) {
    const token = store.get();
    const res = await fetch(url.startsWith('http') ? url : API + url, {
      ...opts,
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).message || res.statusText;
      const err = new Error(res.status === 401 ? 'GitHub didn’t accept the token. Check it hasn’t expired.' : res.status === 403 || res.status === 404 ? 'The token can’t write to this repository. Give it Contents: read and write on rachmurali02.github.io.' : 'GitHub said: ' + msg);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
  const fromBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
  async function fetchSource() {
    const f = await gh(`/contents/${path}?ref=${BRANCH}&t=${Date.now()}`);
    return { text: fromBase64(f.content), sha: f.sha };
  }
  fetchSource().then((f) => { sourceSha = f.sha; }).catch(() => {});

  // Put the edited parts back into the page's HTML, leaving everything else exactly as it was
  function splice(html, parts) {
    const a = html.match(/<article[^>]*>/);
    const end = html.lastIndexOf('</article>');
    if (!a || end < 0) throw new Error('Couldn’t find the article in the page’s HTML.');
    const start = a.index + a[0].length;
    const lead = html.slice(start).match(/^\s*/)[0], trail = html.slice(0, end).match(/\s*$/)[0];
    html = html.slice(0, start) + lead + parts.article.trim() + trail + html.slice(end);
    html = html.replace(/(<div class="post-title[^>]*>\s*<h1>)[\s\S]*?(<\/h1>)/, (m, p1, p2) => p1 + parts.title + p2);
    if (parts.standfirst != null) html = html.replace(/(<p class="standfirst">)[\s\S]*?(<\/p>)/, (m, p1, p2) => p1 + parts.standfirst + p2);
    const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (parts.title !== original.title) html = html.replace(/(<title>)[\s\S]*?( \| Side Quests<\/title>)/, (m, p1, p2) => p1 + plain(parts.title) + p2);
    if (parts.standfirst != null && parts.standfirst !== original.standfirst) html = html.replace(/(<meta name="description" content=")[^"]*(")/, (m, p1, p2) => p1 + plain(parts.standfirst).replace(/"/g, '&quot;') + p2);
    return html;
  }

  function askToken() {
    return new Promise((resolve) => {
      const dlg = el('div', { class: 'ed-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ed-token-title' }, `
        <div class="ed-card">
          <h2 id="ed-token-title">Connect to GitHub to save</h2>
          <p>Saving commits this post to <strong>${REPO}</strong>. Create a fine-grained token once and paste it here. It’s kept only in this browser.</p>
          <ol>
            <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → New fine-grained token</a>.</li>
            <li>Repository access: <em>Only select repositories</em> → <strong>rachmurali02.github.io</strong>.</li>
            <li>Permissions → Repository → <strong>Contents: Read and write</strong>. Nothing else.</li>
            <li>Generate, copy, and paste it below.</li>
          </ol>
          <input type="password" class="ed-input" placeholder="github_pat_…" autocomplete="off" spellcheck="false">
          <div class="ed-actions"><button type="button" class="ed-btn" data-x="0">Cancel</button><button type="button" class="ed-btn ed-primary" data-x="1">Save token</button></div>
        </div>`);
      document.body.appendChild(dlg);
      const input = dlg.querySelector('input');
      input.focus();
      const done = (ok) => { const v = input.value.trim(); dlg.remove(); if (ok && v) store.set(v); resolve(ok && v ? v : null); };
      dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) done(b.dataset.x === '1'); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    });
  }

  let saving = false;
  async function save() {
    if (saving) return;
    const parts = { article: clean(article), title: tidy(title), standfirst: standfirst ? tidy(standfirst) : null };
    if (!dirty && parts.article === original.article && parts.title === original.title) { say('Nothing to save'); return; }
    if (!store.get() && !(await askToken())) return;
    saving = true;
    bar.classList.add('busy');
    try {
      say('Saving…');
      const latest = await fetchSource();
      if (sourceSha && latest.sha !== sourceSha &&
          !confirm('This post changed on GitHub since you started editing. Save anyway and replace those changes?')) { say('Not saved', 'dirty'); return; }
      const html = splice(latest.text, parts);
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const head = await gh(`/git/commits/${ref.object.sha}`);
      const tree = [{ path, mode: '100644', type: 'blob', content: html }];
      // Upload only the new photos still in the post
      const kept = [...article.querySelectorAll('img[data-pending]')].map((img) => img.dataset.target.replace(/^\.\.\//, ''));
      for (const [p, data] of pending) {
        if (!kept.includes(p)) continue;
        const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: data, encoding: 'base64' }) });
        tree.push({ path: p, mode: '100644', type: 'blob', sha: blob.sha });
      }
      const newTree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const plainTitle = title.textContent.replace(/\s+/g, ' ').trim();
      const photos = kept.length ? ` and add ${kept.length} photo${kept.length > 1 ? 's' : ''}` : '';
      const commit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: `Edit "${plainTitle}"${photos}`, tree: newTree.sha, parents: [ref.object.sha] }) });
      await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
      // Photos now live in the repo, so point the page at them
      article.querySelectorAll('img[data-pending]').forEach((img) => { img.removeAttribute('data-pending'); });
      pending.clear();
      sourceSha = null;
      fetchSource().then((f) => { sourceSha = f.sha; }).catch(() => {});
      original.article = parts.article; original.title = parts.title; original.standfirst = parts.standfirst;
      dirty = false;
      say('Saved. Live in about a minute.', 'saved');
    } catch (err) {
      if (err.status === 401) store.set(null);
      say(err.message, 'error');
    } finally {
      saving = false;
      bar.classList.remove('busy');
    }
  }

  bar.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'save') save();
    if (act.dataset.act === 'photo') fileInput.click();
    if (act.dataset.act === 'cancel') {
      if (dirty && !confirm('Discard your unsaved changes?')) return;
      dirty = false;
      location.href = location.pathname;
    }
  });
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
  say('Editing');
})();
