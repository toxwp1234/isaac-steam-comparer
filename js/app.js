(function () {
  const APP_ID = 250900;
  const MAX_PLAYERS = 4;
  const COLORS = ['#f28c28', '#3b82f6', '#43b049', '#a855f7'];
  const STORE = 'isaac-coop-marks.v1';

  // Browsers can't read steamcommunity.com directly (no CORS), so requests go through
  // public relays, tried in order. corsfix only answers localhost for free; jina works anywhere.
  const RELAYS = [
    { name: 'corsfix', url: (u) => `https://proxy.corsfix.com/?${u}` },
    { name: 'jina', url: (u) => `https://r.jina.ai/${u}`, headers: { 'X-Return-Format': 'html' } },
    { name: 'allorigins', url: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
    { name: 'codetabs', url: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
  ];

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    players: [],
    selected: 'isaac',
    filter: 'all',
    coopSort: false,
    hard: true,
  };

  // ---------- persistence ----------
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        selected: state.selected, filter: state.filter, coopSort: state.coopSort, hard: state.hard,
        players: state.players.map((p) => ({
          input: p.input, path: p.path, color: p.color, name: p.name, avatar: p.avatar,
          unlocked: p.unlocked ? [...p.unlocked] : null, fetchedAt: p.fetchedAt,
        })),
      }));
    } catch (e) { /* storage unavailable: app still works for this visit */ }
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!d) return;
      Object.assign(state, { selected: d.selected || 'isaac', filter: d.filter || 'all', coopSort: !!d.coopSort, hard: d.hard !== false });
      state.players = (d.players || []).map((p) => ({ ...p, unlocked: p.unlocked ? new Set(p.unlocked) : null, status: p.unlocked ? 'ok' : 'idle' }));
    } catch (e) { /* ignore corrupt or blocked storage */ }
  }

  // ---------- Steam ----------
  function profilePath(input) {
    const s = input.trim();
    let m = s.match(/steamcommunity\.com\/(profiles\/\d{17}|id\/[^/?#\s]+)/i);
    if (m) return m[1];
    if (/^\d{17}$/.test(s)) return `profiles/${s}`;
    if (/^[\w-]{2,64}$/.test(s)) return `id/${s}`;
    return null;
  }

  async function relayFetch(steamUrl, looksValid) {
    let lastErr = 'No relay reachable';
    for (const r of RELAYS) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 20000);
      try {
        const res = await fetch(r.url(steamUrl), { headers: r.headers || {}, signal: ctl.signal });
        const text = await res.text();
        if (res.ok && looksValid(text)) return text;
        lastErr = `${r.name}: HTTP ${res.status}`;
      } catch (e) {
        lastErr = `${r.name}: ${e.name === 'AbortError' ? 'timeout' : 'network error'}`;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(lastErr);
  }

  // Works for raw XML and for relays that re-serialise it as HTML (lower-case tags, CDATA as comments).
  const tag = (xml, name) => {
    const m = xml.match(new RegExp(`<${name}>\\s*(?:<!--\\[CDATA\\[|<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]-->|\\]\\]>)?\\s*</${name}>`, 'i'));
    return m ? m[1].trim() : null;
  };

  function parseAchievements(xml) {
    const err = tag(xml, 'error');
    if (err) throw new Error(err);
    if (/<privacystate>\s*(private|friendsonly)/i.test(xml)) throw new Error('Game details are private');
    const unlocked = new Set();
    for (const chunk of xml.split(/<achievement\b/i).slice(1)) {
      if (!/^\s*closed="1"/i.test(chunk)) continue;
      const id = tag(chunk, 'apiname');
      if (id) unlocked.add(id);
    }
    return unlocked;
  }

  async function loadPlayer(p) {
    p.status = 'loading'; p.error = null;
    render();
    const base = `https://steamcommunity.com/${p.path}`;
    try {
      const achXml = await relayFetch(`${base}/stats/${APP_ID}/achievements/?xml=1&l=english`,
        (t) => /<playerstats|<error>/i.test(t));
      p.unlocked = parseAchievements(achXml);
      p.fetchedAt = Date.now();
      p.status = 'ok';
      render();
      try {
        const prof = await relayFetch(`${base}/?xml=1`, (t) => /<profile|<steamid>/i.test(t));
        p.name = tag(prof, 'steamID') || p.name;
        p.avatar = tag(prof, 'avatarMedium') || p.avatar;
      } catch (e) { /* name/avatar are optional */ }
    } catch (e) {
      p.status = 'error';
      p.error = /private/i.test(e.message) ? 'Profile or game details are private' : e.message;
    }
    save();
    render();
  }

  // ---------- marks ----------
  // Returns 'full' | 'partial' | 'none' | 'unknown' for one player's mark on a character.
  function markState(ch, mark, p) {
    const a = ch.ach;
    if (mark.key === 'greed') {
      if (!a.greedier && !a.greed) return 'unknown';
      if (!p || !p.unlocked) return 'none';
      if (a.greedier && p.unlocked.has(a.greedier)) return 'full';
      if (a.greed && p.unlocked.has(a.greed)) return 'partial';
      return 'none';
    }
    const id = a[mark.key];
    if (!id) return 'unknown';
    if (!p || !p.unlocked) return 'none';
    return p.unlocked.has(id) ? 'full' : 'none';
  }

  const loaded = () => state.players.filter((p) => p.unlocked);

  function score(ch, p) {
    let done = 0, total = 0;
    for (const m of MARKS) {
      const s = markState(ch, m, p);
      if (s === 'unknown') continue;
      total++;
      if (s !== 'none') done++;
    }
    return { done, total };
  }

  // Co-op value: how many (mark, player) pairs are still missing.
  function coopValue(ch) {
    return loaded().reduce((sum, p) => { const s = score(ch, p); return sum + s.total - s.done; }, 0);
  }

  function visibleChars() {
    let list = CHARACTERS.filter((c) => state.filter === 'all' || (state.filter === 'tainted') === c.tainted);
    if (state.coopSort && loaded().length) list = [...list].sort((a, b) => coopValue(b) - coopValue(a));
    return list;
  }

  // ---------- rendering ----------
  function renderPlayers() {
    $('#players').innerHTML = state.players.map((p, i) => {
      const status = p.status === 'loading' ? 'loading…'
        : p.status === 'error' ? esc(p.error || 'failed')
        : p.unlocked ? `${p.unlocked.size} achievements` : 'not loaded';
      return `<div class="player" data-i="${i}">
        <label class="swatch" style="background:${p.color}" title="Change color"><input type="color" value="${p.color}" data-act="color"></label>
        ${p.avatar ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}
        <div class="who"><span class="name">${esc(p.name || p.input)}</span><span class="status${p.status === 'error' ? ' err' : ''}">${status}</span></div>
        <button class="mini" data-act="reload" title="Refresh">↻</button>
        <button class="mini" data-act="remove" title="Remove">✕</button>
      </div>`;
    }).join('');
    const full = state.players.length >= MAX_PLAYERS;
    $('#add-input').disabled = full;
    $('#add-form button').disabled = full;
    $('#add-input').placeholder = full ? `Max ${MAX_PLAYERS} players` : 'Steam profile link or ID';
  }

  function renderCarousel() {
    const list = visibleChars();
    if (!list.some((c) => c.id === state.selected)) state.selected = list[0].id;
    const ps = loaded();
    let html = '', prevTainted = list[0] && list[0].tainted;
    for (const c of list) {
      if (!state.coopSort && state.filter === 'all' && c.tainted !== prevTainted) html += '<div class="divider" aria-hidden="true"></div>';
      prevTainted = c.tainted;
      const pips = ps.map((p) => { const s = score(c, p); return `<div class="pip" title="${esc(p.name || p.input)}: ${s.done}/${s.total}"><i style="width:${(100 * s.done) / s.total}%;background:${p.color}"></i></div>`; }).join('');
      html += `<button class="ccard${c.tainted ? ' tainted' : ''}${c.id === state.selected ? ' sel' : ''}" data-id="${c.id}" aria-pressed="${c.id === state.selected}">
        ${portraitSvg(c.portrait, c.tainted)}<div class="cname">${esc(c.name)}</div><div class="pips">${pips}</div></button>`;
    }
    $('#carousel').innerHTML = html;
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.filter === state.filter));
    $('#sort-coop').checked = state.coopSort;
    $('#hard-mode').checked = state.hard;
  }

  function renderStage() {
    const ch = CHARACTERS.find((c) => c.id === state.selected);
    const ps = loaded();

    const tally = ps.map((p) => { const s = score(ch, p); return `<li><span class="dot" style="background:${p.color}"></span><span class="nm">${esc(p.name || p.input)}</span><span class="sc">${s.done}/${s.total}</span></li>`; }).join('');
    $('#char-card').className = `char-card${ch.tainted ? ' tainted' : ''}`;
    $('#char-card').innerHTML = `${portraitSvg(ch.portrait, ch.tainted)}<h2>${esc(ch.name)}</h2>
      <div class="sub">${ch.tainted ? 'Tainted character' : 'Character'}</div><ul class="tally">${tally}</ul>`;

    let partialSeen = false, unknownSeen = false;
    const slots = MARKS.map((m) => {
      const per = ps.map((p) => ({ p, s: markState(ch, m, p) }));
      const unknown = markState(ch, m, null) === 'unknown';
      if (unknown) unknownSeen = true;
      const fills = unknown ? [] : per.filter((x) => x.s === 'full' || x.s === 'partial').map((x) => ({ color: x.p.color, partial: x.s === 'partial' }));
      if (fills.some((f) => f.partial)) partialSeen = true;
      const missing = unknown ? [] : per.filter((x) => x.s === 'none');
      const names = (arr) => arr.map((x) => (x.p.name || x.p.input) + (x.s === 'partial' ? ' (Greed only)' : '')).join(', ');
      const title = unknown
        ? `${m.label}: Steam has no achievement for this mark on ${ch.name}`
        : `${m.label}\nDone: ${names(per.filter((x) => x.s !== 'none')) || 'nobody'}\nMissing: ${names(missing) || 'nobody'}`;
      const miss = missing.map((x) => `<span style="color:${x.p.color}">●</span>`).join('');
      return `<div class="slot${unknown ? ' unknown' : ''}" title="${esc(title)}">
        ${markSvg(m.icon, fills, unknown ? 'unknown' : 'known', state.hard)}${unknown ? '<span class="q">?</span>' : ''}
        <span class="lbl">${esc(m.label)}</span><span class="miss">${miss}</span></div>`;
    }).join('');

    const hint = !state.players.length ? '<p class="empty-hint">Add a player above to fill in the marks.</p>'
      : !ps.length ? '<p class="empty-hint">Loading achievements…</p>' : '';
    const legend = [
      ps.length ? '<span>● under a mark = still missing for that player</span>' : '',
      partialSeen ? '<span><span class="sw" style="background:repeating-linear-gradient(45deg,#999 0 3px,#ddd 3px 6px)"></span>Greed only (not Greedier)</span>' : '',
      unknownSeen ? '<span>? = not tracked by Steam for tainted characters</span>' : '',
    ].join('');
    $('#note').innerHTML = `${hint}<div class="note-grid">${slots}</div><div class="legend">${legend}</div>`;
  }

  function render() {
    renderPlayers();
    renderCarousel();
    renderStage();
  }

  function select(id, scroll = 'smooth') {
    state.selected = id;
    save();
    renderCarousel();
    renderStage();
    if (scroll) {
      const el = document.querySelector(`.ccard[data-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: scroll, inline: 'center', block: 'nearest' });
    }
  }

  function step(dir) {
    const list = visibleChars();
    const i = list.findIndex((c) => c.id === state.selected);
    select(list[(i + dir + list.length) % list.length].id);
  }

  // ---------- events ----------
  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#add-input').value;
    const path = profilePath(input);
    if (!path) { $('#add-input').setCustomValidity('Paste a Steam profile link, a 17-digit Steam ID, or a custom URL name'); $('#add-input').reportValidity(); return; }
    if (state.players.some((p) => p.path.toLowerCase() === path.toLowerCase())) { $('#add-input').value = ''; return; }
    const used = state.players.map((p) => p.color);
    const p = { input: input.trim(), path, color: COLORS.find((c) => !used.includes(c)) || COLORS[0], unlocked: null, status: 'idle' };
    state.players.push(p);
    $('#add-input').value = '';
    save();
    loadPlayer(p);
  });
  $('#add-input').addEventListener('input', (e) => e.target.setCustomValidity(''));

  $('#players').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.dataset.act === 'color') return;
    const i = +btn.closest('.player').dataset.i;
    if (btn.dataset.act === 'remove') { state.players.splice(i, 1); save(); render(); }
    if (btn.dataset.act === 'reload') loadPlayer(state.players[i]);
  });
  $('#players').addEventListener('input', (e) => {
    if (e.target.dataset.act !== 'color') return;
    const p = state.players[+e.target.closest('.player').dataset.i];
    p.color = e.target.value;
    e.target.parentElement.style.background = p.color;
    renderCarousel();
    renderStage();
  });
  $('#players').addEventListener('change', (e) => { if (e.target.dataset.act === 'color') { save(); render(); } });

  $('#carousel').addEventListener('click', (e) => {
    const card = e.target.closest('.ccard');
    if (card) select(card.dataset.id);
  });
  $('#carousel').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  $('#prev').addEventListener('click', () => step(-1));
  $('#next').addEventListener('click', () => step(1));
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { state.filter = t.dataset.filter; save(); render(); select(state.selected); }));
  $('#sort-coop').addEventListener('change', (e) => { state.coopSort = e.target.checked; save(); render(); select(state.selected); });
  $('#hard-mode').addEventListener('change', (e) => { state.hard = e.target.checked; save(); renderStage(); });

  // ---------- start ----------
  load();
  render();
  select(state.selected, 'instant');
  state.players.filter((p) => !p.unlocked).forEach(loadPlayer);
})();
