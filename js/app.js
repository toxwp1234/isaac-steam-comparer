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
  // Inline SVG icons from the sprite at the top of index.html (same stroke style everywhere)
  const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const $$ = (s) => document.querySelectorAll(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pname = (p) => p.name || p.input;
  const charById = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
  const charByName = Object.fromEntries(CHARACTERS.map((c) => [c.name, c]));

  const state = {
    view: 'marks',
    players: [],
    selected: 'isaac',
    filter: 'all',
    coopSort: false,
    hard: true,
    chalFilter: 'all',
    boss: 'mother', bossMode: 'boss', bossFilter: 'all', bossHideDone: false,
    squad: { goals: {}, dupes: false },
    spin: { source: 'union', all: false, steps: 10, item: null },
    pool: { mode: 'union', q: '', minQ: 0, sort: 'id' },
  };

  // ---------- persistence ----------
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        view: state.view, selected: state.selected, filter: state.filter, coopSort: state.coopSort, hard: state.hard,
        chalFilter: state.chalFilter, boss: state.boss, bossMode: state.bossMode, bossFilter: state.bossFilter, bossHideDone: state.bossHideDone,
        squad: state.squad, spin: state.spin, pool: state.pool,
        players: state.players.map((p) => ({
          input: p.input, path: p.path, sid: p.sid, color: p.color, name: p.name, avatar: p.avatar,
          unlocked: p.unlocked ? [...p.unlocked] : null, fetchedAt: p.fetchedAt,
        })),
      }));
    } catch (e) { /* storage unavailable: app still works for this visit */ }
    writeUrl();
  }

  // ---------- shareable link: ?p1=<steamID64 or custom URL name>&p2=…&view=marks&char=isaac (or view=bosses&boss=mother|all) ----------
  const VIEWS = ['marks', 'bosses', 'challenges', 'squad', 'spindown', 'pool'];
  const urlId = (p) => p.sid || (p.path.startsWith('profiles/') ? p.path.slice(9) : p.path.slice(3));

  function writeUrl() {
    const q = new URLSearchParams(location.search);
    for (let i = 1; i <= MAX_PLAYERS; i++) q.delete(`p${i}`);
    q.delete('view'); q.delete('char'); q.delete('boss');
    state.players.forEach((p, i) => q.set(`p${i + 1}`, urlId(p)));
    q.set('view', state.view);
    if (state.view === 'marks') q.set('char', state.selected);
    if (state.view === 'bosses') q.set('boss', state.bossMode === 'table' ? 'all' : state.boss);
    const search = q.toString();
    const url = `${location.pathname}${search ? `?${search}` : ''}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', url);
  }

  // Players in the link win over the saved list; saved data for the same profile is reused.
  function readUrl() {
    const q = new URLSearchParams(location.search);
    if (VIEWS.includes(q.get('view'))) state.view = q.get('view');
    const boss = q.get('boss');
    if (boss === 'all') state.bossMode = 'table';
    else if (MARKS.some((m) => m.key === boss)) { state.boss = boss; state.bossMode = 'boss'; }
    if (charById[q.get('char')]) {
      state.selected = q.get('char');
      if (state.filter !== 'all' && (state.filter === 'tainted') !== charById[state.selected].tainted) state.filter = 'all';
    }
    const ids = [];
    for (let i = 1; i <= MAX_PLAYERS; i++) { const v = (q.get(`p${i}`) || '').trim(); if (v) ids.push(v); }
    if (!ids.length) return;
    const saved = state.players;
    state.players = [];
    for (const id of ids) {
      const path = profilePath(id);
      if (!path || state.players.some((p) => p.path.toLowerCase() === path.toLowerCase())) continue;
      const hit = saved.find((p) => p.path.toLowerCase() === path.toLowerCase() || p.sid === id);
      const used = state.players.map((p) => p.color);
      const color = COLORS.find((c) => !used.includes(c)) || COLORS[0];
      // Not in the saved list: reuse recently checked data (shown at once, refreshed after load).
      const rec = !hit && recent.find((r) => samePlayer(r, { path, sid: /^\d{17}$/.test(id) ? id : undefined }));
      state.players.push(hit || (rec
        ? { input: id, path, sid: rec.sid, name: rec.name, avatar: rec.avatar, color, unlocked: new Set(rec.unlocked), fetchedAt: rec.fetchedAt, status: 'stale' }
        : { input: id, path, color, unlocked: null, status: 'idle' }));
    }
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!d) return;
      Object.assign(state, {
        view: d.view || 'marks', selected: d.selected || 'isaac', filter: d.filter || 'all', coopSort: !!d.coopSort,
        hard: d.hard !== false, chalFilter: d.chalFilter || 'all',
        boss: d.boss || 'mother', bossMode: d.bossMode === 'table' ? 'table' : 'boss', bossFilter: d.bossFilter || 'all', bossHideDone: !!d.bossHideDone,
        squad: { goals: {}, dupes: false, ...(d.squad || {}) },
        spin: { ...state.spin, ...(d.spin || {}) },
        pool: { ...state.pool, ...(d.pool || {}) },
      });
      state.players = (d.players || []).map((p) => ({ ...p, unlocked: p.unlocked ? new Set(p.unlocked) : null, status: p.unlocked ? 'ok' : 'idle' }));
    } catch (e) { /* ignore corrupt or blocked storage */ }
  }

  // ---------- Steam ----------
  function profilePath(input) {
    const s = input.trim();
    const m = s.match(/steamcommunity\.com\/(profiles\/\d{17}|id\/[^/?#\s]+)/i);
    if (m) return m[1];
    if (/^\d{17}$/.test(s)) return `profiles/${s}`;
    if (/^[\w-]{2,64}$/.test(s)) return `id/${s}`;
    return null;
  }

  // The relay that answered last is tried first next time (remembered in this browser).
  const RELAY_KEY = 'isaac-coop-marks.relay';
  function relayOrder() {
    let first = null;
    try { first = localStorage.getItem(RELAY_KEY); } catch (e) { /* storage blocked */ }
    return [...RELAYS].sort((a, b) => (b.name === first) - (a.name === first));
  }

  async function relayFetch(steamUrl, looksValid) {
    let lastErr = 'No relay reachable';
    for (const r of relayOrder()) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 20000);
      try {
        const res = await fetch(r.url(steamUrl), { headers: r.headers || {}, signal: ctl.signal });
        const text = await res.text();
        if (res.ok && looksValid(text)) {
          try { localStorage.setItem(RELAY_KEY, r.name); } catch (e) { /* storage blocked */ }
          return text;
        }
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

  async function loadPlayer(p, quiet = false) {
    p.status = 'loading'; p.error = null;
    render();
    const base = `https://steamcommunity.com/${p.path}`;
    const before = p.unlocked;
    try {
      const achXml = await relayFetch(`${base}/stats/${APP_ID}/achievements/?xml=1&l=english`,
        (t) => /<playerstats|<error>/i.test(t));
      p.unlocked = parseAchievements(achXml);
      p.fetchedAt = Date.now();
      p.status = 'ok';
      render();
      const fresh = before ? [...p.unlocked].filter((id) => !before.has(id)) : [];
      try {
        const prof = await relayFetch(`${base}/?xml=1`, (t) => /<profile|<steamid>/i.test(t));
        p.name = tag(prof, 'steamID') || p.name;
        p.avatar = tag(prof, 'avatarMedium') || p.avatar;
        const sid = tag(prof, 'steamID64');
        if (/^\d{17}$/.test(sid || '')) p.sid = sid;
      } catch (e) { /* name/avatar are optional */ }
      rememberPlayer(p);
      if (fresh.length) showToast(`${pname(p)} unlocked something new: ${newUnlockText(fresh)}`, 'ok', 8000);
      else if (!quiet) showToast(`✓ ${pname(p)} loaded: ${overallProgress(p)}% of all marks`, 'ok');
    } catch (e) {
      p.status = 'error';
      p.error = friendlyError(e.message);
      showToast(`${pname(p)}: ${p.error.title}. Click the player for help.`, 'err', 7000);
    }
    save();
    render();
  }

  // "Hush on Isaac, Mom's Heart on Cain and 2 more achievements"
  // "Hush on Isaac" for a completion-mark achievement, null for any other achievement.
  function markForAch(id) {
    for (const ch of CHARACTERS) {
      const m = MARKS.find((x) => ch.ach[x.key] === id);
      if (m) return `${m.label} on ${ch.name}`;
    }
    return null;
  }
  function newUnlockText(ids) {
    const names = ids.map(markForAch).filter(Boolean);
    const shown = names.slice(0, 3);
    const rest = ids.length - shown.length;
    return shown.length ? `${shown.join(', ')}${rest ? ` and ${rest} more achievement${rest === 1 ? '' : 's'}` : ''}`
      : `${ids.length} new achievement${ids.length === 1 ? '' : 's'}`;
  }

  // Turn Steam / relay errors into something a player can act on: a short title plus the steps to fix it.
  function friendlyError(msg) {
    if (/private|friendsonly/i.test(msg)) return { kind: 'private', title: 'Game details are private',
      help: 'Steam only shows achievements of public profiles. On Steam: your profile → <b>Edit Profile</b> → <b>Privacy Settings</b> → set <b>My profile</b> and <b>Game details</b> to <b>Public</b>. Then press <b>Try again</b>. It can take a few minutes for Steam to update.' };
    if (/could not be found|not found|404|invalid/i.test(msg)) return { kind: 'notfound', title: 'Profile not found',
      help: 'Check the link or ID. Use <b>steamcommunity.com/id/NAME</b>, <b>steamcommunity.com/profiles/7656…</b> or the 17-digit Steam ID. A custom URL name only works if the player set one in their Steam profile.' };
    if (/no stats|not own|game/i.test(msg)) return { kind: 'nogame', title: 'No Isaac stats on this profile',
      help: 'Steam has no Binding of Isaac: Rebirth achievements for this profile. Make sure the player owns the game on this account and has played it at least once.' };
    if (/timeout/i.test(msg)) return { kind: 'timeout', title: 'Steam took too long to answer',
      help: 'The site reads Steam through free public relays and they can be slow. Wait a moment and press <b>Try again</b>.' };
    if (/HTTP|network|relay/i.test(msg)) return { kind: 'network', title: 'Could not reach Steam',
      help: 'The site reads Steam through free public relays, and none of them answered. Check your internet, wait a moment and press <b>Try again</b>. If Steam itself is down, try later.' };
    return { kind: 'other', title: 'Steam returned an error', help: `Steam said: <i>${esc(msg)}</i>. Press <b>Try again</b>, or check the profile link.` };
  }

  // ---------- data age ----------
  const DAY = 86400000;
  const AUTO_REFRESH_AFTER = 6 * 3600000; // saved data older than this reloads on page open
  function ago(t) {
    if (!t) return 'never';
    const s = (Date.now() - t) / 1000;
    if (s < 90) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  // fresh < 1 day, old 1–7 days, stale > 7 days
  const ageClass = (t) => !t ? 'stale' : Date.now() - t < DAY ? 'fresh' : Date.now() - t < 7 * DAY ? 'old' : 'stale';

  // Share of all known completion marks (every character) this player has.
  function overallProgress(p) {
    let done = 0, total = 0;
    for (const ch of CHARACTERS) { const s = score(ch, p); done += s.done; total += s.total; }
    return total ? Math.round((100 * done) / total) : 0;
  }

  function showToast(message, kind = '', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${kind}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    $('#toast-container').appendChild(toast);
    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ---------- marks ----------
  const loaded = () => state.players.filter((p) => p.unlocked);
  const hasChar = (p, ch) => !ch.unlock || p.unlocked.has(ch.unlock);

  function markIds(ch, mark) {
    return (mark.ids || [mark.key]).map((k) => ch.ach[k]).filter(Boolean);
  }
  // Marks that share one achievement on this character, or null. Tainted characters get one
  // achievement for Isaac + ??? + Satan + The Lamb and one for Boss Rush + Hush, and Steam only
  // hands it out once all of them are done.
  const groupCache = new Map();
  function markGroup(ch, mark) {
    const k = `${ch.id}/${mark.key}`;
    if (!groupCache.has(k)) {
      const ids = markIds(ch, mark);
      const keys = ids.length === 1
        ? MARKS.filter((m) => { const o = markIds(ch, m); return o.length === 1 && o[0] === ids[0]; }).map((m) => m.key) : [];
      groupCache.set(k, keys.length > 1 ? keys : null);
    }
    return groupCache.get(k);
  }
  const groupText = (keys) => keys.map((k) => MARKS.find((m) => m.key === k).label).join(' + ');

  // 'done' | 'none' | 'maybe' | 'unknown'
  // maybe = a shared achievement is still locked, so any of its marks may or may not be done.
  function markState(ch, mark, p) {
    const ids = markIds(ch, mark);
    if (!ids.length) return 'unknown';
    if (!p || !p.unlocked) return 'none';
    if (ids.some((id) => p.unlocked.has(id))) return 'done';
    return markGroup(ch, mark) ? 'maybe' : 'none';
  }
  const notDone = (s) => s === 'none' || s === 'maybe';

  // missing counts 'maybe' marks too: they are only sure once the shared achievement pops.
  function score(ch, p) {
    let done = 0, total = 0, maybe = 0;
    for (const m of MARKS) {
      const s = markState(ch, m, p);
      if (s === 'unknown') continue;
      total++;
      if (s === 'done') done++;
      if (s === 'maybe') maybe++;
    }
    return { done, total, maybe, missing: total - done };
  }

  const coopMissing = (ch) => loaded().reduce((sum, p) => sum + score(ch, p).missing, 0);

  function visibleChars() {
    let list = CHARACTERS.filter((c) => state.filter === 'all' || (state.filter === 'tainted') === c.tainted);
    if (state.coopSort && loaded().length) list = [...list].sort((a, b) => coopMissing(b) - coopMissing(a));
    return list;
  }

  // ---------- rendering: players ----------
  function renderPlayers() {
    $('#players').innerHTML = state.players.map((p, i) => {
      const status = p.status === 'loading' ? '<span class="status">loading from Steam…</span>'
        : p.status === 'error' ? `<button class="status err" data-act="error" title="What went wrong and how to fix it">${ico('warn')}<span>${esc(p.error ? p.error.title : 'Failed')} · <u>help</u></span></button>`
        : p.unlocked ? '' : '<span class="status">not loaded</span>';
      const pct = p.unlocked ? overallProgress(p) : 0;
      const progress = p.unlocked && p.status !== 'loading'
        ? `<span class="player-progress" title="${pct}% of all completion marks · ${p.unlocked.size} achievements"><span class="progress-bar"><span class="progress-fill" style="--progress:${pct}%;--pc:${p.color}"></span></span>${pct}% marks</span>` : '';
      const age = p.unlocked && p.status !== 'loading'
        ? `<span class="age age-${ageClass(p.fetchedAt)}" title="Steam data fetched ${p.fetchedAt ? new Date(p.fetchedAt).toLocaleString() : 'at an unknown time'}. Press the refresh icon to reload.">updated ${ago(p.fetchedAt)}</span>` : '';
      return `<div class="player${p.status === 'loading' ? ' loading' : ''}${p.status === 'error' ? ' err' : ''}" data-i="${i}">
        <label class="swatch" style="background:${p.color}" title="Click to change ${esc(pname(p))}'s color"><input type="color" value="${p.color}" data-act="color" aria-label="Change ${esc(pname(p))}'s color"></label>
        ${p.avatar ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}
        <div class="who"><span class="name">${esc(pname(p))}</span>${status}${progress}${age}</div>
        <button class="mini" data-act="reload" title="Refresh from Steam" aria-label="Refresh ${esc(pname(p))}">${ico('refresh')}</button>
        <button class="mini" data-act="remove" title="Remove from lobby" aria-label="Remove ${esc(pname(p))}">${ico('close')}</button>
      </div>`;
    }).join('');
    const full = state.players.length >= MAX_PLAYERS;
    $('#add-input').disabled = full;
    $('#add-form button').disabled = full;
    $('#add-input').placeholder = full ? `Max ${MAX_PLAYERS} players` : 'Steam profile link or ID';
    const busy = state.players.some((p) => p.status === 'loading');
    $('#refresh-all').hidden = !state.players.length;
    $('#refresh-all').disabled = busy;
    $('#refresh-all').innerHTML = `${ico('refresh')}<span>${busy ? 'Refreshing…' : 'Refresh all'}</span>`;
    const stale = state.players.filter((p) => p.unlocked && p.status !== 'loading' && ageClass(p.fetchedAt) === 'stale');
    $('#stale-banner').hidden = !stale.length;
    if (stale.length) {
      $('#stale-banner-text').textContent = `${stale.map(pname).join(', ')}: Steam data is over a week old, so marks, squads and items may be out of date.`;
    }
    renderRecent();
  }

  function refreshAll() {
    state.players.filter((p) => p.status !== 'loading').forEach((p) => loadPlayer(p, true));
  }

  function openError(i) {
    const p = state.players[i];
    if (!p || !p.error) return;
    $('#unlock-body').innerHTML = `<p class="u-kind">${esc(pname(p))} · couldn't load from Steam</p>
      <h3>${esc(p.error.title)}</h3>
      <p>${p.error.help}</p>
      <p class="u-note">${p.unlocked ? `Showing the data from ${ago(p.fetchedAt)} until it loads.` : 'Nothing is shown for this player until it loads.'}</p>
      <div class="u-actions">
        <a class="u-wiki" href="https://steamcommunity.com/${esc(p.path)}" target="_blank" rel="noopener">Open the Steam profile ↗</a>
        <button class="btn" data-retry="${i}">${ico('refresh')}<span>Try again</span></button>
      </div>`;
    $('#unlock').showModal();
  }

  // ---------- recently checked players (kept in this browser, max 12) ----------
  const RECENT_KEY = 'isaac-coop-marks.recent';
  const MAX_RECENT = 12;
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { recent = []; }

  const samePlayer = (a, b) => a.path.toLowerCase() === b.path.toLowerCase() || (!!a.sid && a.sid === b.sid);

  function saveRecent() {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) { /* storage unavailable */ }
  }

  function rememberPlayer(p) {
    const entry = { path: p.sid ? `profiles/${p.sid}` : p.path, sid: p.sid, name: pname(p), avatar: p.avatar, unlocked: [...p.unlocked], fetchedAt: p.fetchedAt };
    recent = [entry, ...recent.filter((r) => !samePlayer(r, p))].slice(0, MAX_RECENT);
    saveRecent();
  }

  function renderRecent() {
    const list = recent.map((r, i) => ({ r, i })).filter(({ r }) => !state.players.some((p) => samePlayer(r, p)));
    const full = state.players.length >= MAX_PLAYERS;
    $('#recent').hidden = !list.length;
    $('#recent').innerHTML = list.length ? `<span class="recent-label" title="Players you checked before in this browser. Click one to add them to the lobby; their data reloads from Steam.">Quick add <small>(checked before, reloads on add)</small>:</span>${list.map(({ r, i }) => {
      const old = !r.fetchedAt || Date.now() - r.fetchedAt > 30 * DAY;
      const tip = full ? `Max ${MAX_PLAYERS} players` : `Add ${r.name} again. Last checked ${ago(r.fetchedAt)}${old ? ' (over a month ago)' : ''}; their data reloads from Steam.`;
      return `
      <span class="recent-item${old ? ' old' : ''}">
        <button class="recent-add" data-recent="${i}"${full ? ' disabled' : ''} title="${esc(tip)}">
          ${r.avatar ? `<img src="${esc(r.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}<span>${esc(r.name)}</span><small class="recent-age">${esc(ago(r.fetchedAt))}</small>
        </button><button class="recent-forget" data-forget="${i}" aria-label="Forget ${esc(r.name)}" title="Forget this player (removes their saved data from this browser)">${ico('close')}</button>
      </span>`;
    }).join('')}` : '';
  }

  // ---------- rendering: marks view ----------
  function renderCarousel() {
    const list = visibleChars();
    if (!list.some((c) => c.id === state.selected)) state.selected = list[0].id;
    const ps = loaded();
    let html = '', prevTainted = list[0] && list[0].tainted;
    for (const c of list) {
      if (!state.coopSort && state.filter === 'all' && c.tainted !== prevTainted) html += '<div class="divider" aria-hidden="true"></div>';
      prevTainted = c.tainted;
      const pips = ps.map((p) => {
        const s = score(c, p), lock = !hasChar(p, c);
        return `<div class="pip${lock ? ' locked' : ''}" title="${esc(pname(p))}: ${lock ? 'character locked' : `${s.done}/${s.total}`}"><i style="width:${(100 * s.done) / s.total}%;background:${p.color}"></i></div>`;
      }).join('');
      html += `<button class="ccard${c.tainted ? ' tainted' : ''}${c.id === state.selected ? ' sel' : ''}" data-id="${c.id}" aria-pressed="${c.id === state.selected}">
        ${ps.length && ps.every((p) => { const sc = score(c, p); return sc.done === sc.total; }) ? '<span class="cstar" title="Everyone has every mark">★</span>' : ''}${portraitSvg(c.portrait, c.tainted)}<div class="cname">${esc(c.name)}</div><div class="pips">${pips}</div></button>`;
    }
    $('#carousel').innerHTML = html;
    $$('#view-marks .tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.filter === state.filter));
    $('#sort-coop').checked = state.coopSort;
    $('#hard-mode').checked = state.hard;
  }

  function renderStage() {
    const ch = charById[state.selected];
    const ps = loaded();

    const tally = ps.map((p) => {
      const s = score(ch, p);
      const full = s.done === s.total;
      return `<li class="${full ? 'complete' : ''}"><span class="dot" style="background:${p.color}"></span><span class="nm">${esc(pname(p))}</span>${hasChar(p, ch) ? '' : `<span class="lock" title="Character not unlocked">${ico('lock')}</span>`}${full ? '<span class="stamp" title="All marks done">★ done</span>' : ''}<span class="sc">${s.done}/${s.total}</span></li>`;
    }).join('');
    const r = COOP[ch.id];
    $('#char-card').className = `char-card${ch.tainted ? ' tainted' : ''}`;
    $('#char-card').innerHTML = `${portraitSvg(ch.portrait, ch.tainted)}<h2>${esc(ch.name)}</h2>
      <div class="sub">${ch.tainted ? 'Tainted character' : 'Character'}</div>
      ${statBars(r)}
      <ul class="tally">${tally}</ul>`;

    let unknownSeen = false, maybeSeen = false;
    const slots = MARKS.map((m) => {
      const unknown = markState(ch, m, null) === 'unknown';
      if (unknown) unknownSeen = true;
      const per = ps.map((p) => ({ p, s: markState(ch, m, p) }));
      const have = unknown ? [] : per.filter((x) => x.s === 'done');
      const missing = unknown ? [] : per.filter((x) => notDone(x.s));
      const maybe = missing.filter((x) => x.s === 'maybe');
      if (maybe.length) maybeSeen = true;
      const miss = missing.map((x) => `<span class="dot-missing${x.s === 'maybe' ? ' maybe' : ''}" style="--pc:${x.p.color}" title="${esc(pname(x.p))} ${x.s === 'maybe' ? 'may be missing this' : 'is missing this'}"></span>`).join('');
      // The Greed slot carries its own difficulty: Greedier is the hard tier of Greed mode, so
      // it is drawn as a hard mark once everyone holding it got there through Greedier.
      const hardId = m.hardKey && ch.ach[m.hardKey];
      const onHard = m.hardKey
        ? have.length > 0 && have.every((x) => hardId && x.p.unlocked.has(hardId))
        : state.hard;
      const tip = unknown ? `${m.label} — Steam doesn't track this mark here`
        : !ps.length ? `${m.label} — click to see what it unlocks`
        : have.length === ps.length ? `${m.label} — everyone has it ✓`
        : have.length ? `${m.label} — ${have.length}/${ps.length} have it · missing: ${missing.map((x) => pname(x.p)).join(', ')}`
        : maybe.length ? `${m.label} — not confirmed by Steam yet`
        : `${m.label} — nobody has it yet`;
      const group = markGroup(ch, m);
      const shared = maybe.length ? ` · Steam only reports ${groupText(group)} together, so ${maybe.map((x) => pname(x.p)).join(', ')} may have this one already` : '';
      const greedTier = m.hardKey && have.length
        ? ` · ${onHard ? 'beaten on Greedier' : 'Greed only - nobody has Greedier yet'}` : '';
      const sel = state.selectedMark === m.key ? ' sel' : '';
      return `<button class="slot${unknown ? ' unknown' : ''}${sel}" data-mark="${m.key}" data-tip="${esc(tip + greedTier + shared)}" aria-label="${esc(tip + greedTier + shared)}. Click to see what it unlocks.">
        ${markSvg(m.icon, have.map((x) => ({ color: x.p.color })), unknown ? 'unknown' : 'known', onHard)}${unknown ? '<span class="q">?</span>' : ''}
        <span class="lbl">${esc(m.label)}</span><span class="miss">${miss}</span></button>`;
    }).join('');

    const hint = !state.players.length ? '<p class="empty-hint">Add a player above to fill in the marks.</p>'
      : !ps.length ? '<p class="empty-hint">Loading achievements…</p>' : '';
    const legend = [
      '<span>click a mark to see what it unlocks</span>',
      ps.length ? '<span>● under a mark = still missing for that player</span>' : '',
      unknownSeen ? '<span>? = not tracked by Steam for tainted characters</span>' : '',
      maybeSeen ? '<span>◌ dashed dot = maybe missing: Steam reports these bosses only all together</span>' : '',
    ].join('');
    $('#note').innerHTML = `${hint}<div class="note-grid">${slots}</div><div class="legend">${legend}</div>`;
  }

  // Five 0–5 stat bars; Team cost and Skill are "lower is better" and drawn in red.
  function statBars(r) {
    return `<div class="stats">${Object.entries(STAT_INFO).map(([k, info]) => {
      const bad = k === 'cost' || k === 'skill';
      let dots = '';
      for (let i = 1; i <= 5; i++) dots += `<i class="${i <= r[k] ? (bad ? 'on bad' : 'on') : ''}"></i>`;
      return `<span class="stat" title="${esc(info.label)} ${r[k]}/5: ${esc(info.q)}"><b>${esc(info.label)}</b><span class="dots">${dots}</span></span>`;
    }).join('')}</div>`;
  }

  // ---------- unlock details ----------
  const STEAM_ICON = 'https://shared.akamai.steamstatic.com/community_assets/images/apps/250900/';
  const TAINTED_SHARED = { isaac: 'Isaac, ???, Satan and The Lamb', bluebaby: 'Isaac, ???, Satan and The Lamb', satan: 'Isaac, ???, Satan and The Lamb', lamb: 'Isaac, ???, Satan and The Lamb', bossrush: 'Boss Rush and Hush', hush: 'Boss Rush and Hush' };

  function openUnlock(markKey, chId = state.selected) {
    const ch = charById[chId];
    const m = MARKS.find((x) => x.key === markKey);
    const ids = markIds(ch, m);
    let html;
    if (!ids.length) {
      html = `<p class="u-kind">${esc(m.label)} · ${esc(ch.name)}</p><h3>No unlock</h3>
        <p>Tainted characters get nothing for this mark, so Steam has no achievement for it and the app can't tell who has it.</p>`;
    } else {
      // Greed slot: the Greed achievement is the unlock; Greedier only proves the mark.
      const id = ids[0];
      const u = UNLOCKS[id] || { n: 'Unknown unlock', k: '', d: '' };
      const ps = loaded();
      const who = ps.map((p) => {
        const s = markState(ch, m, p);
        return `<span class="chip ${s === 'done' ? 'done' : 'open'}" style="--pc:${p.color}">${s === 'done' ? ico('check') : ''}<em>${esc(pname(p))}</em></span>`;
      }).join('');
      const shared = ch.tainted && TAINTED_SHARED[m.key]
        ? `<p class="u-note">For tainted characters this one unlock needs all of: ${TAINTED_SHARED[m.key]}.</p>` : '';
      const greedNote = m.key === 'greed' && ch.tainted ? '<p class="u-note">Tainted characters only get an unlock for Greedier, which also gives the Greed mark.</p>' : '';
      html = `<div class="u-head">
          ${u.i ? `<img src="${STEAM_ICON}${esc(u.i)}" alt="" width="64" height="64" referrerpolicy="no-referrer">` : ''}
          <div><p class="u-kind">${esc(m.label)} · ${esc(ch.name)}</p><h3>${esc(u.n)}</h3>${u.k ? `<span class="u-type">${esc(u.k)}</span>` : ''}</div>
        </div>
        ${u.q ? `<p class="u-quote">“${esc(u.q)}”</p>` : ''}
        <p>${esc(u.d)}</p>${shared}${greedNote}
        ${who ? `<div class="chips u-who">${who}</div>` : ''}
        ${u.w ? `<a class="u-wiki" href="https://bindingofisaacrebirth.wiki.gg/wiki/${encodeURIComponent(u.w.replace(/ /g, '_'))}" target="_blank" rel="noopener">Open on the wiki ↗</a>` : ''}`;
    }
    $('#unlock-body').innerHTML = html;
    $('#unlock').showModal();
  }

  // ---------- rendering: bosses view (which characters beat each boss) ----------
  // One cell = one character × one boss, for every loaded player.
  function bossCell(ch, m, ps) {
    const unknown = markState(ch, m, null) === 'unknown';
    const per = ps.map((p) => ({ p, s: unknown ? 'unknown' : markState(ch, m, p), lock: !hasChar(p, ch) }));
    const have = per.filter((x) => x.s === 'done');
    const hardId = m.hardKey && ch.ach[m.hardKey];
    const hard = m.hardKey ? have.length > 0 && have.every((x) => hardId && x.p.unlocked.has(hardId)) : state.hard;
    const svg = markSvg(m.icon, have.map((x) => ({ color: x.p.color })), unknown ? 'unknown' : 'known', hard);
    const line = (x) => {
      const greed = m.hardKey && x.s === 'done' ? (hardId && x.p.unlocked.has(hardId) ? ' (Greedier)' : ' (Greed only)') : '';
      const what = x.s === 'done' ? `done${greed}` : x.s === 'maybe' ? 'maybe (see below)'
        : x.lock ? 'character not unlocked yet' : 'not done';
      return `${pname(x.p)}: ${what}`;
    };
    const group = markGroup(ch, m);
    const tip = [`${m.label} on ${ch.name}`,
      ...(unknown ? ['Steam has no achievement for this mark on tainted characters'] : per.map(line)),
      ...(group && per.some((x) => x.s === 'maybe') ? [`Steam unlocks ${groupText(group)} as one achievement, only once all are done, so this one may already be done.`] : []),
    ].join('\n');
    const todo = per.filter((x) => notDone(x.s));
    return { ch, m, unknown, per, have, todo, svg, tip,
      everyone: ps.length > 0 && have.length === ps.length,
      ready: todo.length > 0 && per.every((x) => !x.lock) };
  }

  // A boss as a plain, readable icon (not a player's mark): the hard sprite filled in a neutral ink.
  const bossIcon = (m) => markSvg(m.icon, [{ color: '#9b7b5f' }], 'known', true);

  const BOSS_FILTERS = {
    all: { label: 'All', tip: 'Every character', test: () => true },
    todo: { label: 'Someone needs it', tip: 'At least one player has not beaten this boss with the character yet', test: (c) => c.todo.length > 0 },
    ready: { label: 'Ready for co-op', tip: 'Everyone has the character unlocked and someone still needs this boss on it', test: (c) => c.ready },
    done: { label: 'Everyone has it', tip: 'Every player has this mark on the character', test: (c) => c.everyone },
  };

  // Per-player "done / total" for one boss over all characters Steam tracks it for.
  function bossTally(m, p) {
    let done = 0, total = 0, maybe = 0;
    for (const ch of CHARACTERS) {
      const s = markState(ch, m, p);
      if (s === 'unknown') continue;
      total++;
      if (s === 'done') done++;
      if (s === 'maybe') maybe++;
    }
    return { done, total, maybe };
  }

  function renderBossPicker(ps) {
    $('#boss-picker').innerHTML = MARKS.map((m) => {
      const pips = ps.map((p) => {
        const t = bossTally(m, p);
        return `<div class="pip" title="${esc(pname(p))}: ${t.done}/${t.total}"><i style="width:${t.total ? (100 * t.done) / t.total : 0}%;background:${p.color}"></i></div>`;
      }).join('');
      const sel = state.bossMode === 'boss' && state.boss === m.key;
      return `<button class="bpick${sel ? ' sel' : ''}" data-boss="${m.key}" aria-pressed="${sel}" title="${esc(m.label)}: which characters have beaten it">
        ${bossIcon(m)}<span class="lbl">${esc(m.label)}</span><span class="pips">${pips}</span></button>`;
    }).join('');
  }

  function renderBosses() {
    const ps = loaded();
    if (!MARKS.some((m) => m.key === state.boss)) state.boss = 'mother';
    $$('#boss-mode .tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.mode === state.bossMode));
    renderBossPicker(ps);
    // On phones the picker is a scrolling strip: keep the picked boss in view.
    const box = $('#boss-picker'), sel = box.querySelector('.bpick.sel');
    if (sel && box.scrollWidth > box.clientWidth) box.scrollLeft = sel.offsetLeft - (box.clientWidth - sel.offsetWidth) / 2;
    const hint = !state.players.length ? '<p class="empty-hint light">Add a player above to see who beat each boss with which character.</p>'
      : !ps.length ? '<p class="empty-hint light">Loading achievements…</p>' : '';
    $('#boss-body').innerHTML = hint + (state.bossMode === 'table' ? bossTable(ps) : bossOne(ps));
  }

  const pdot = (cls, color) => `<span class="pdot ${cls}" style="--pc:${color}">${cls === 'lock' ? ico('lock') : cls === 'maybe' ? '?' : ''}</span>`;

  function bossOne(ps) {
    const m = MARKS.find((x) => x.key === state.boss);
    const cells = CHARACTERS.map((ch) => bossCell(ch, m, ps));
    const tracked = cells.filter((c) => !c.unknown);
    const f = BOSS_FILTERS[state.bossFilter] ? state.bossFilter : 'all';
    const tabs = Object.entries(BOSS_FILTERS).map(([k, x]) =>
      `<button class="tab" data-bf="${k}" aria-selected="${k === f}" title="${esc(x.tip)}">${esc(x.label)} <span class="n">${tracked.filter(x.test).length}</span></button>`).join('');

    const tallies = ps.map((p) => {
      const t = bossTally(m, p);
      const tip = `${pname(p)} beat ${m.label} with ${t.done} of ${t.total} characters${t.maybe ? `. ${t.maybe} more may be done: Steam reports some tainted marks only as a group` : ''}`;
      return `<span class="btally" title="${esc(tip)}"><span class="dot" style="background:${p.color}"></span><span class="nm">${esc(pname(p))}</span>
        <span class="progress-bar"><span class="progress-fill" style="--progress:${t.total ? (100 * t.done) / t.total : 0}%;--pc:${p.color}"></span></span>
        <b>${t.done}/${t.total}</b>${t.maybe ? `<small>+${t.maybe} maybe</small>` : ''}</span>`;
    }).join('');
    const everyone = tracked.filter((c) => c.everyone).length;
    const nobody = tracked.filter((c) => !c.have.length).length;
    const ready = tracked.filter((c) => c.ready).length;

    const card = (c) => {
      const dots = c.per.map((x) => pdot(c.unknown ? 'unknown' : x.s === 'done' ? 'done' : x.s === 'maybe' ? 'maybe' : x.lock ? 'lock' : 'open', x.p.color)).join('');
      const cls = c.unknown ? ' unknown' : c.everyone ? ' all' : '';
      return `<button class="bcard${c.ch.tainted ? ' tainted' : ''}${cls}" data-char="${c.ch.id}" data-mark="${m.key}" title="${esc(c.tip)}&#10;Click for this mark's unlock.">
        ${c.everyone ? '<span class="cstar" aria-hidden="true">★</span>' : ''}${portraitSvg(c.ch.portrait, c.ch.tainted)}<span class="bname">${esc(c.ch.name)}</span>
        <span class="bmark">${c.svg}${c.per.some((x) => x.s === 'maybe') ? '<span class="q">?</span>' : ''}</span>
        ${dots ? `<span class="pdots">${dots}</span>` : ''}</button>`;
    };
    const section = (title, list, note) => {
      if (note && list.every((c) => c.unknown)) return `<h3 class="sheet-h3 bsec">${title}</h3><p class="bnote">${note}</p>`;
      const shown = f === 'all' ? list : list.filter((c) => !c.unknown && BOSS_FILTERS[f].test(c));
      const body = shown.length ? `<div class="bgrid">${shown.map(card).join('')}</div>`
        : `<p class="bnote">No characters here for “${esc(BOSS_FILTERS[f].label)}”.</p>`;
      return `<h3 class="sheet-h3 bsec">${title}</h3>${body}`;
    };
    const groupCh = CHARACTERS.find((ch) => ch.tainted && markGroup(ch, m));
    const notes = [
      groupCh ? `<p class="bnote small">${ico('warn')}<span>Tainted characters: Steam unlocks <b>${esc(groupText(markGroup(groupCh, m)))}</b> as one achievement, only once all of them are done. Until then the mark shows <b>?</b>: it may already be done.</span></p>` : '',
      m.hardKey ? `<p class="bnote small">${ico('warn')}<span>Greedier also counts as Greed. The mark is drawn in its hard style when everyone who has it beat Greedier. Tainted characters only report Greedier.</span></p>` : '',
    ].join('');

    return `<div class="bhead">
        <div class="bhead-mark">${bossIcon(m)}</div>
        <div class="bhead-info">
          <h3>${esc(m.label)}</h3>
          ${ps.length ? `<p class="bsum">${everyone} of ${tracked.length} characters done by everyone · ${nobody} by nobody${ready ? ` · <b>${ready} ready for co-op</b>` : ''}</p>` : ''}
          <div class="btallies">${tallies}</div>
        </div>
      </div>
      ${ps.length ? `<div class="tabs bfilter" role="tablist">${tabs}</div>` : ''}
      ${notes}
      ${section('Characters', cells.filter((c) => !c.ch.tainted))}
      ${section('Tainted characters', cells.filter((c) => c.ch.tainted), m.key === 'heart' ? "Steam has no achievement for Mom's Heart on tainted characters, so the site can't tell who has it." : null)}
      ${ps.length ? `<p class="legend bleg"><span>${pdot('done', '#6b5a4a')} done</span><span>${pdot('open', '#6b5a4a')} not done</span><span>${pdot('maybe', '#6b5a4a')} maybe (tainted group)</span><span>${pdot('lock', '#6b5a4a')} character locked</span><span>★ everyone has it</span><span>←/→ next boss</span></p>` : ''}`;
  }

  function bossTable(ps) {
    const chars = CHARACTERS.filter((ch) => !state.bossHideDone || !ps.length || ps.some((p) => score(ch, p).missing > 0));
    const head = MARKS.map((m) => `<th scope="col"><button class="bt-head" data-boss="${m.key}" title="${esc(m.label)}: open this boss">${bossIcon(m)}<span>${esc(m.label)}</span></button></th>`).join('');
    let prevTainted = false, rows = '';
    for (const ch of chars) {
      if (ch.tainted && !prevTainted) rows += `<tr class="bt-div"><th colspan="${MARKS.length + 2}">Tainted characters</th></tr>`;
      prevTainted = ch.tainted;
      const cells = MARKS.map((m) => {
        const c = bossCell(ch, m, ps);
        const q = c.per.some((x) => x.s === 'maybe');
        return `<td class="bt-cell${c.unknown ? ' unknown' : c.everyone ? ' all' : ''}"><button data-char="${ch.id}" data-mark="${m.key}" title="${esc(c.tip)}">${c.svg}${q ? '<span class="q">?</span>' : ''}</button></td>`;
      }).join('');
      const sc = ps.map((p) => {
        const s = score(ch, p), lock = !hasChar(p, ch);
        return `<span class="bt-sc${lock ? ' lock' : ''}${s.done === s.total ? ' full' : ''}" style="--pc:${p.color}" title="${esc(pname(p))}: ${s.done}/${s.total} marks${lock ? ' · character locked' : ''}">${s.done}</span>`;
      }).join('');
      rows += `<tr class="${ch.tainted ? 'tainted' : ''}"><th scope="row"><button class="bt-char" data-goto="${ch.id}" title="Open ${esc(ch.name)} on the Marks page">${portraitSvg(ch.portrait, ch.tainted)}<span>${esc(ch.name)}</span></button></th>${cells}<td class="bt-scores">${sc}</td></tr>`;
    }
    const foot = ps.length ? `<tr class="bt-foot"><th scope="row">Characters</th>${MARKS.map((m) => `<td>${ps.map((p) => {
      const t = bossTally(m, p);
      return `<span class="bt-sc${t.done === t.total ? ' full' : ''}" style="--pc:${p.color}" title="${esc(pname(p))}: ${esc(m.label)} with ${t.done}/${t.total} characters">${t.done}</span>`;
    }).join('')}</td>`).join('')}<td></td></tr>` : '';
    return `<div class="bt-bar">
        <label class="check dark"><input type="checkbox" id="boss-hide-done"${state.bossHideDone ? ' checked' : ''}> Hide characters everyone finished</label>
        <span class="bt-help">Click a mark for its unlock, a boss for its page, a character for the Marks page. <b>?</b> = maybe done (tainted group). Faded = Steam does not track it.</span>
      </div>
      <div class="bt-wrap"><table class="btable">
        <thead><tr><th class="bt-corner"></th>${head}<th class="bt-scores" title="Marks per player on this character">Marks</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="${MARKS.length + 2}" class="bnote">Everyone finished every character.</td></tr>`}</tbody>
        <tfoot>${foot}</tfoot>
      </table></div>`;
  }

  function stepBoss(dir) {
    const i = MARKS.findIndex((m) => m.key === state.boss);
    state.boss = MARKS[(i + dir + MARKS.length) % MARKS.length].key;
    state.bossMode = 'boss';
    save();
    renderBosses();
  }

  // ---------- rendering: challenges view ----------
  function chalStatus(c, p) {
    if (c.done && p.unlocked.has(c.done)) return 'done';
    const open = c.req.every((group) => group.some((id) => p.unlocked.has(id)));
    return open ? 'open' : 'lock';
  }

  function renderChallenges() {
    const ps = loaded();
    $$('#chal-filter .tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.f === state.chalFilter));
    if (!ps.length) {
      $$('#chal-filter .tab .n').forEach((n) => { n.textContent = ''; });
      $('#chal-list').innerHTML = '<p class="empty-hint light">Add a player to see challenge progress.</p>';
      return;
    }
    const inFilter = (f, st) => {
      const all = (s) => st.every((x) => x.s === s);
      const some = (s) => st.some((x) => x.s === s);
      switch (f) {
        case 'ready': return !some('lock') && !all('done');
        case 'todo': return !all('done');
        case 'locked': return some('lock');
        default: return true;
      }
    };
    const every = CHALLENGES.map((c) => ({ c, st: ps.map((p) => ({ p, s: chalStatus(c, p) })) }));
    $$('#chal-filter .tab').forEach((t) => {
      t.querySelector('.n').textContent = every.filter(({ st }) => inFilter(t.dataset.f, st)).length;
    });
    const rows = every.filter(({ st }) => inFilter(state.chalFilter, st));
    $('#chal-list').innerHTML = rows.map(({ c, st }) => {
      const ch = charByName[c.char] || charById.isaac;
      const locked = st.filter((x) => x.s === 'lock');
      const need = st.filter((x) => x.s !== 'done');
      const kind = !need.length ? 'done' : locked.length ? 'locked' : 'open';
      const badge = kind === 'done' ? `${ico('check')}Everyone beat it`
        : kind === 'locked' ? `${ico('lock')}Locked for ${esc(locked.map((x) => pname(x.p)).join(', '))}`
        : `${ico('target')}Ready for co-op · ${need.length} still need it`;
      const chips = st.map(({ p, s }) => {
        const label = s === 'done' ? 'beaten' : s === 'open' ? 'unlocked, not beaten' : 'locked';
        return `<span class="chip ${s}" style="--pc:${p.color}" title="${esc(pname(p))}: ${label}">${s === 'done' ? ico('check') : s === 'lock' ? ico('lock') : ''}<em>${esc(pname(p))}</em></span>`;
      }).join('');
      const req = c.req.length ? `Unlock: ${esc(c.reqText)}` : 'Available from the start';
      return `<article class="chal-card ${kind}">
        <div class="chal-header">
          <div class="chal-portrait">${portraitSvg(ch.portrait, ch.tainted)}</div>
          <div class="chal-info">
            <h3 class="chal-name"><span class="chal-n">#${c.n}</span> ${esc(c.name)}</h3>
            <p class="chal-goal chal-line">${ico('target')}<span>Defeat ${esc(c.goal)} as ${esc(c.char)}</span></p>
            <p class="chal-reward chal-line">${ico('gift')}<span>${esc(c.reward)}</span></p>
          </div>
        </div>
        <span class="badge badge-${kind}">${badge}</span>
        <div class="chips">${chips}</div>
        <p class="chal-req chal-line">${ico('key')}<span>${req}</span></p>
      </article>`;
    }).join('') || '<p class="empty-hint light">Nothing matches this filter.</p>';
  }

  // ---------- squad builder ----------
  // How much a character adds to a team on its own (same weights as the win-chance rating).
  function soloValue(c) {
    const r = COOP[c.id];
    return 0.45 * r.dmg + 0.35 * r.surv + 0.3 * r.help - 0.2 * r.cost - 0.25 * Math.max(0, r.skill - 2.5);
  }

  // One run can only take one route, so a squad is scored per route and gets the route with the most marks.
  // core = marks you get by finishing the route; bonus = extra marks on the same run if you have time.
  const ROUTES = [
    { id: 'chest', name: 'Womb → Cathedral → The Chest', core: ['heart', 'isaac', 'bluebaby'], bonus: ['bossrush', 'hush', 'megasatan', 'delirium'] },
    { id: 'darkroom', name: 'Womb → Sheol → Dark Room', core: ['heart', 'satan', 'lamb'], bonus: ['bossrush', 'hush', 'megasatan', 'delirium'] },
    { id: 'mother', name: 'Alt path → Corpse → Mother', core: ['mother'], bonus: ['bossrush'] },
    { id: 'beast', name: 'Ascent → Home → The Beast', core: ['beast'], bonus: ['bossrush'] },
    { id: 'greed', name: 'Greedier mode', core: ['greed'], bonus: [] },
  ];
  const BONUS_WEIGHT = 0.6; // bonus marks are less certain than the route's own bosses
  const BONUS_TIPS = {
    bossrush: 'Boss Rush: beat Mom before 20:00',
    hush: 'Hush: beat Mom\'s Heart before 30:00 and take the Blue Womb',
    megasatan: 'Mega Satan: collect both Key Pieces from Angel rooms',
    delirium: 'Delirium: take the Void portal after Hush or the final boss',
  };
  const markByKey = Object.fromEntries(MARKS.map((m) => [m.key, m]));

  // Marks this player still needs on this character along a route.
  function routeGain(c, p, route) {
    const need = (keys) => keys.filter((k) => notDone(markState(c, markByKey[k], p)));
    const core = need(route.core), bonus = need(route.bonus);
    return { core, bonus, value: core.length + BONUS_WEIGHT * bonus.length };
  }

  function buildSquads() {
    const ps = loaded();
    const M = SQUAD_MODEL;
    const cands = ps.map((p) => {
      const goal = state.squad.goals[p.path] || 'auto';
      const role = goal === 'auto' || goal === 'carry' ? goal : 'pick';
      const weight = M.ROLE_WEIGHT[role];
      // Only characters this player has unlocked can be suggested.
      const chars = role === 'pick' ? [charById[goal]].filter((c) => c && hasChar(p, c)) : CHARACTERS.filter((c) => hasChar(p, c));
      let list = chars.map((c) => {
        const routes = ROUTES.map((r) => routeGain(c, p, r));
        return { c, weight, routes, bestRoute: Math.max(...routes.map((g) => g.value)) };
      });
      if (role !== 'pick') {
        // Keep the search small: the best characters for this player's marks, plus the best team picks.
        const byMarks = [...list].sort((x, y) => (y.bestRoute + soloValue(y.c)) - (x.bestRoute + soloValue(x.c))).slice(0, 8);
        const byTeam = [...list].sort((x, y) => soloValue(y.c) - soloValue(x.c)).slice(0, 6);
        list = [...new Set([...byMarks, ...byTeam])];
      }
      return { p, role, list, locked: role === 'pick' && !chars.length ? charById[goal] : null };
    });
    const blocked = cands.find((x) => x.locked);
    if (blocked) return { error: `${pname(blocked.p)} hasn't unlocked ${blocked.locked.name} yet, so they can't hunt marks on it.` };
    if (cands.some((x) => !x.list.length)) return { error: 'No squad possible.' };

    const best = [];
    const pick = new Array(cands.length);
    (function walk(i) {
      if (i === cands.length) {
        const chars = pick.map((x) => x.c);
        if (!state.squad.dupes && new Set(chars.map((c) => c.id)).size < chars.length) return;
        const why = M.breakdown(chars);
        let ri = 0, marks = -1;
        ROUTES.forEach((_, r) => {
          const v = pick.reduce((t, x) => t + x.weight * x.routes[r].value, 0);
          if (v > marks) { marks = v; ri = r; }
        });
        const value = why.win * marks + 0.05 * why.win;
        if (best.length < 5 || value > best[best.length - 1].value) {
          best.push({ value, win: why.win, why, route: ROUTES[ri],
            members: pick.map((x, k) => ({ p: cands[k].p, role: cands[k].role, c: x.c, gain: x.routes[ri] })) });
          best.sort((a2, b2) => b2.value - a2.value);
          if (best.length > 5) best.pop();
        }
        return;
      }
      for (const x of cands[i].list) { pick[i] = x; walk(i + 1); }
    })(0);
    return { squads: best };
  }

  // Small mark icons in the player's color, for "what you get on this run".
  const markChips = (keys, p, c) => keys.map((k) => {
    const m = markByKey[k];
    return `<span class="goal-mark" title="${esc(m.label)} on ${esc(c.name)}">${markSvg(m.icon, [{ color: p.color }], 'known', state.hard)}<span>${esc(m.label)}</span></span>`;
  }).join('');

  // Each part of the win-chance rating, with the points it adds, so the % is not a black box.
  function whyTable(sq) {
    const w = sq.why;
    const row = (label, val, max, pts, how) => `<tr><th>${label}</th><td class="v">${val}${max ? ` <small>/ ${max}</small>` : ''}</td>
      <td class="pts ${pts < 0 ? 'neg' : ''}">${pts >= 0 ? '+' : '−'}${Math.abs(pts).toFixed(2)}</td><td class="how">${how}</td></tr>`;
    return `<table class="why-table">
      <thead><tr><th>Part</th><th>Value</th><th>Points</th><th>From</th></tr></thead>
      <tbody>
        ${row('Kill speed', w.kill.toFixed(1), 5, 0.45 * w.kill, 'best + average <a href="#tier-list">Damage</a>')}
        ${row('Staying alive', w.alive.toFixed(1), 5, 0.35 * w.alive, 'best + average <a href="#tier-list">Survival</a> (dead players keep going as ghosts)')}
        ${row('Team help', w.help, 6, 0.3 * w.help, sq.members.length > 1 ? 'sum of <a href="#tier-list">Team help</a>' : 'solo: no teammates to help')}
        ${row('Team cost', w.cost, 0, -0.2 * w.cost, 'sum of <a href="#tier-list">Team cost</a>')}
        ${row('Skill load', w.skill.toFixed(1), 0, -0.25 * w.skill, 'average <a href="#tier-list">Skill</a> above 2.5')}
      </tbody>
      <tfoot><tr><th>Rating</th><td></td><td class="pts">${w.rating.toFixed(2)}</td><td class="how">win chance = 10% + 17% × rating = <b>${Math.round(w.win * 100)}%</b> (kept between 5% and 95%)</td></tr></tfoot>
    </table>
    <p class="why-note">An estimate from the characters' starting kits, not real game data. Squad score ${sq.value.toFixed(1)} = win chance × marks on the route (bonus marks ${BONUS_WEIGHT}×, weighted by goal).</p>`;
  }

  function renderSquad() {
    const ps = loaded();
    if (!ps.length) {
      $('#squad-controls').innerHTML = '<p class="empty-hint light">Add players to build a squad.</p>';
      $('#squad-results').innerHTML = '';
    } else {
      $('#squad-controls').innerHTML = ps.map((p) => {
        const goal = state.squad.goals[p.path] || 'auto';
        const hunting = goal !== 'auto' && goal !== 'carry';
        const opt = (c) => {
          const sc = score(c, p), lock = !hasChar(p, c);
          return `<option value="${c.id}"${goal === c.id ? ' selected' : ''}${lock ? ' disabled' : ''}>${esc(c.name)} — ${lock ? 'not unlocked' : `${sc.missing} missing`}</option>`;
        };
        const btn = (g, icon, label, tip, on) => `<button class="goal-button${on ? ' selected' : ''}" data-path="${esc(p.path)}" data-goal="${g}" aria-pressed="${on}" title="${tip}"><span class="goal-icon">${icon}</span><span class="goal-button-label">${label}</span></button>`;
        const unlockedCount = CHARACTERS.filter((c) => hasChar(p, c)).length;
        return `<div class="goal" style="--pc:${p.color}">
          <span class="goal-who"><span class="dot" style="background:${p.color}"></span><span class="nm">${esc(pname(p))}</span><span class="goal-unlocked" title="Only unlocked characters are suggested">${unlockedCount}/${CHARACTERS.length} characters</span></span>
          <div class="goal-buttons" role="group" aria-label="What ${esc(pname(p))} wants">
            ${btn('auto', ico('sparkle'), 'Auto', 'Best marks for me', goal === 'auto')}
            ${btn('carry', ico('shield'), 'Carry', 'Play something strong to help the team', goal === 'carry')}
            ${btn('hunt', ico('target'), 'Hunt', 'Pick a character you want marks on', hunting)}
          </div>
          ${hunting ? `<select class="hunt-select" data-path="${esc(p.path)}" aria-label="Character to hunt">
            <optgroup label="Normal">${CHARACTERS.filter((c) => !c.tainted).map(opt).join('')}</optgroup>
            <optgroup label="Tainted">${CHARACTERS.filter((c) => c.tainted).map(opt).join('')}</optgroup>
          </select>` : ''}
        </div>`;
      }).join('') + `<label class="check dark"><input type="checkbox" id="squad-dupes"${state.squad.dupes ? ' checked' : ''}> Allow the same character twice</label>`;

      const result = buildSquads();
      $('#squad-results').innerHTML = result.error ? `<p class="empty-hint light">${esc(result.error)}</p>` : result.squads.map((sq, i) => {
        const total = sq.members.reduce((t, m) => t + m.gain.core.length + m.gain.bonus.length, 0);
        const coreTotal = sq.members.reduce((t, m) => t + m.gain.core.length, 0);
        const bonusKeys = [...new Set(sq.members.flatMap((m) => m.gain.bonus))];
        const pct = Math.round(sq.win * 100);
        return `
        <article class="squad${i === 0 ? ' best' : ''}">
          <div class="squad-goal">
            <span class="rank">${i === 0 ? ico('trophy') : `#${i + 1}`}</span>
            <div class="goal-text">
              <span class="goal-kicker">${ico('target')}Goal for this run</span>
              <span class="goal-route">${esc(sq.route.name)}</span>
              <span class="goal-sum">${coreTotal} mark${coreTotal === 1 ? '' : 's'} from the route${total > coreTotal ? ` + up to ${total - coreTotal} bonus` : ''}${i === 0 ? ' · <b>best pick</b>' : ''}</span>
            </div>
          </div>
          <div class="members">${sq.members.map((m) => {
            const r = COOP[m.c.id];
            const none = !m.gain.core.length && !m.gain.bonus.length;
            return `<div class="member" style="--pc:${m.p.color}">
              <button class="member-head" data-char="${m.c.id}" title="Open ${esc(m.c.name)}'s marks · ${esc(r.good.concat(r.bad).join(' · '))}">
                ${portraitSvg(m.c.portrait, m.c.tainted)}
                <span class="m-player">${esc(pname(m.p))}${m.role === 'carry' ? ' · carry' : m.role === 'pick' ? ' · hunting' : ''}</span>
                <span class="m-char">${esc(m.c.name)}</span>
                <span class="m-tags">${r.help >= 3 ? '<em class="t-sup">helps team</em>' : ''}${r.dmg >= 4 ? '<em class="t-pow">damage</em>' : ''}${r.surv >= 4 ? '<em class="t-pow">tanky</em>' : ''}${r.surv <= 0 ? '<em class="t-hard">one-hit</em>' : ''}${r.cost >= 2 ? '<em class="t-fri">takes loot</em>' : ''}</span>
              </button>
              <div class="m-marks">
                ${none ? '<span class="m-none">Has every mark on this route: here to help</span>' : ''}
                ${m.gain.core.length ? `<div class="m-row"><span class="m-label">Gets</span>${markChips(m.gain.core, m.p, m.c)}</div>` : ''}
                ${m.gain.bonus.length ? `<div class="m-row bonus"><span class="m-label">Bonus</span>${markChips(m.gain.bonus, m.p, m.c)}</div>` : ''}
                ${m.c.tainted && m.gain.core.some((k) => TAINTED_SHARED[k]) ? `<span class="m-none">Steam only shows this unlock once ${TAINTED_SHARED[m.gain.core.find((k) => TAINTED_SHARED[k])]} are all beaten.</span>` : ''}
              </div>
            </div>`;
          }).join('')}</div>
          ${bonusKeys.length ? `<p class="bonus-tips">Bonus marks on the same run: ${bonusKeys.map((k) => esc(BONUS_TIPS[k])).join(' · ')}</p>` : ''}
          <div class="squad-win" title="Estimated from the characters' Damage, Survival, Team help, Team cost and Skill. Not real game statistics.">
            <div class="win-percent">${pct}%</div>
            <div class="win-bar-container">
              <div class="win-bar"><div class="win-bar-fill" style="--win-percent:${pct}%"></div></div>
              <div class="win-label">estimated chance this team finishes the run (from character stats, not real data)</div>
            </div>
          </div>
          <details class="why-wrap">
            <summary>Why ${pct}% win?</summary>
            ${whyTable(sq)}
          </details>
        </article>`;
      }).join('');
    }

    $('#stat-help').innerHTML = Object.values(STAT_INFO).map((x) => `<li><b>${esc(x.label)}</b>: ${esc(x.q)}</li>`).join('');
    const guide = [...CHARACTERS].sort((a, b) => soloValue(b) + 0.3 * COOP[b.id].help - soloValue(a) - 0.3 * COOP[a.id].help);
    $('#tier-list').innerHTML = guide.map((c) => {
      const r = COOP[c.id];
      return `<div class="tier" data-char="${c.id}">${portraitSvg(c.portrait, c.tainted)}
        <div class="tier-body"><b>${esc(c.name)}</b>${statBars(r)}
          <ul class="pros">${r.good.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          <ul class="cons">${r.bad.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div>`;
    }).join('');
  }

  // ---------- spindown ----------
  // Spindown Dice lowers an item's ID by one, skipping IDs that don't exist, hidden items and items
  // that aren't unlocked on the save the run uses. Unlocks are estimated from Steam achievements.
  const itemById = new Map(ITEMS.map((r) => [r[0], { id: r[0], name: r[1], quality: r[2], ach: r[3], quote: r[4], desc: r[5], hidden: !!r[6] }]));
  const MAX_ITEM_ID = ITEMS[ITEMS.length - 1][0];

  function spinOwners(it) {
    return loaded().filter((p) => !it.ach || p.unlocked.has(it.ach));
  }
  // Why an ID is skipped, or null if Spindown can land on it.
  function skipReason(id) {
    const it = itemById.get(id);
    if (!it) return 'no item with this ID';
    if (it.hidden) return 'hidden item';
    if (state.spin.all || !it.ach) return null;
    const ps = loaded();
    const p = state.spin.source !== 'union' && ps.find((x) => x.path === state.spin.source);
    if (!p) return ps.some((x) => x.unlocked.has(it.ach)) ? null : 'locked for everyone';
    return p.unlocked.has(it.ach) ? null : `locked for ${pname(p)}`;
  }

  const qualityStars = (q) => `<span class="qual q${q}" title="Quality ${q}">${'★'.repeat(q)}${'☆'.repeat(4 - q)}</span>`;
  const ownerDots = (it) => {
    if (!it.ach || loaded().length < 2 || state.spin.all) return '';
    const owners = spinOwners(it);
    return `<span class="who" title="Unlocked for: ${esc(owners.map(pname).join(', ') || 'nobody')}">${owners.map((p) => `<i style="background:${p.color}"></i>`).join('')}</span>`;
  };

  function renderSpindown() {
    const ps = loaded();
    const visible = [...itemById.values()].filter((it) => !it.hidden);
    const count = (has) => visible.filter((it) => !it.ach || has(it.ach)).length;
    const sources = [['union', `${ps.length > 1 ? 'Everyone combined (union)' : ps.length ? `${pname(ps[0])}'s save` : 'No players loaded'} · ${count((a) => ps.some((p) => p.unlocked.has(a)))} items`]]
      .concat(ps.length > 1 ? ps.map((p) => [p.path, `${pname(p)}'s save · ${count((a) => p.unlocked.has(a))} items`]) : []);
    if (!sources.some(([v]) => v === state.spin.source)) state.spin.source = 'union';
    $('#spin-source').innerHTML = sources.map(([v, l]) => `<option value="${esc(v)}"${v === state.spin.source ? ' selected' : ''}>${esc(l)}</option>`).join('');
    $('#spin-source').disabled = state.spin.all;
    const host = ps.find((p) => p.path === state.spin.source);
    $('#spin-source-help').innerHTML = state.spin.all ? 'Every item counts, as on a save with everything unlocked.'
      : ps.length < 2 ? 'Spindown skips items that aren’t unlocked on this save.'
      : host ? `Only items unlocked on <b>${esc(pname(host))}</b>’s save count. Pick whoever hosts the run.`
      : '<b>Union</b>: an item counts if <i>anyone</i> has it unlocked. Good for a quick look, but a real run uses one save (usually the host’s), so pick the host for exact results.';
    $('#spin-all').checked = state.spin.all;
    $('#spin-steps').value = String(state.spin.steps);

    const cur = itemById.get(state.spin.item);
    if (!cur) { $('#spin-out').innerHTML = '<p class="empty-hint light">Search for the item on the pedestal to see what Spindown Dice turns it into.</p>'; return; }
    const warn = !state.spin.all && !ps.length ? '<p class="spin-note">No players loaded, so only items that start unlocked count. Add players or tick "Ignore unlocks".</p>' : '';

    // Forward: what this item becomes after 1..N uses.
    let fwd = '', id = cur.id;
    for (let use = 1; use <= state.spin.steps; use++) {
      let next = id - 1;
      const skipped = [];
      while (next >= 1 && skipReason(next)) { if (itemById.get(next)) skipped.push(next); next--; }
      if (next < 1) { fwd += `<li><span class="uses">${use}×</span><span>Nothing left below this ID.</span></li>`; break; }
      fwd += chainRow(use, itemById.get(next), skipped);
      id = next;
    }

    // Backward: items above this one that spin down into it within N uses.
    let back = '', uses = 0;
    let backSkipped = [];
    for (let up = cur.id + 1; up <= MAX_ITEM_ID && uses < state.spin.steps; up++) {
      if (!skipReason(up)) { uses++; back += chainRow(uses, itemById.get(up), backSkipped); backSkipped = []; }
      else if (itemById.get(up)) backSkipped.push(up);
    }

    const curSkip = skipReason(cur.id);
    $('#spin-out').innerHTML = `${warn}
      <div class="spin-current">
        <span class="big-id">#${cur.id}</span>
        <span class="nm">${esc(cur.name)} ${qualityStars(cur.quality)} ${ownerDots(cur)}</span>
        ${cur.quote ? `<span class="q">“${esc(cur.quote)}”</span>` : '<span></span>'}
        <span class="d">${esc(cur.desc)}${curSkip ? ` <b>(${esc(curSkip)})</b>` : ''}</span>
      </div>
      <div><h3>Spin it down</h3><ol class="chain">${fwd}</ol></div>
      <div><h3>Items that spin into it</h3><ol class="chain">${back || '<li><span></span><span>Nothing above it.</span></li>'}</ol>
        <p class="spin-note">Click any item to jump to it. ★ = item quality; gold rows are quality 3–4. Colored dots = players who have that item unlocked.</p></div>`;
  }

  function chainRow(use, it, skipped) {
    const skip = skipped.length
      ? `<span class="skipped">skipped: ${skipped.map((sid) => `<s title="${esc(skipReason(sid))}">#${sid} ${esc(itemById.get(sid).name)}</s>`).join(', ')}</span>` : '';
    return `<li><span class="uses">${use}×</span>
      <button class="hit q${it.quality}" data-item="${it.id}" title="${esc(it.desc)}"><span class="iid">#${it.id}</span>${esc(it.name)} ${qualityStars(it.quality)} ${ownerDots(it)}</button>${skip}</li>`;
  }

  function searchItems(q) {
    q = q.trim().toLowerCase().replace(/^#/, '');
    if (!q) return [];
    if (/^\d+$/.test(q)) {
      return [itemById.get(+q), ...ITEMS.filter((r) => String(r[0]).startsWith(q) && r[0] !== +q).map((r) => itemById.get(r[0]))]
        .filter(Boolean).slice(0, 10);
    }
    const starts = [], has = [];
    for (const it of itemById.values()) {
      const n = it.name.toLowerCase();
      if (n.startsWith(q) || n.replace(/^the /, '').startsWith(q)) starts.push(it);
      else if (n.includes(q)) has.push(it);
    }
    return starts.concat(has).slice(0, 10);
  }

  function renderSearch() {
    const list = searchItems($('#spin-input').value);
    const ul = $('#spin-results');
    ul.hidden = !list.length;
    ul.innerHTML = list.map((it, i) => `<li data-item="${it.id}" class="${i === 0 ? 'active' : ''}"><span class="iid">#${it.id}</span>${esc(it.name)} ${qualityStars(it.quality)}</li>`).join('');
  }

  function pickItem(id) {
    state.spin.item = +id;
    $('#spin-input').value = '';
    $('#spin-results').hidden = true;
    save();
    renderSpindown();
  }

  // ---------- item pool (beta) ----------
  // Which items the lobby has unlocked, estimated from Steam achievements like the Spindown calculator.
  function poolOwners(it) {
    return loaded().filter((p) => !it.ach || p.unlocked.has(it.ach));
  }

  function renderPool() {
    const ps = loaded();
    const modes = [['union', 'Unlocked by anyone (union)'], ['everyone', 'Unlocked by everyone'],
      ...ps.map((p) => [p.path, `${pname(p)}'s save`]), ['locked', 'Locked for everyone']];
    if (!modes.some(([v]) => v === state.pool.mode)) state.pool.mode = 'union';
    $('#pool-mode').innerHTML = modes.map(([v, l]) => `<option value="${esc(v)}"${v === state.pool.mode ? ' selected' : ''}>${esc(l)}</option>`).join('');
    $('#pool-quality').value = String(state.pool.minQ);
    $('#pool-sort').value = state.pool.sort;
    if ($('#pool-search').value !== state.pool.q) $('#pool-search').value = state.pool.q;

    const all = [...itemById.values()].filter((it) => !it.hidden);
    const inMode = (it) => {
      const owners = poolOwners(it);
      switch (state.pool.mode) {
        case 'union': return !it.ach || owners.length > 0;
        case 'everyone': return !it.ach || (ps.length > 0 && owners.length === ps.length);
        case 'locked': return !!it.ach && owners.length === 0;
        default: return !it.ach || owners.some((p) => p.path === state.pool.mode);
      }
    };
    const matching = all.filter(inMode);
    const q = state.pool.q.trim().toLowerCase().replace(/^#/, '');
    let shown = matching.filter((it) => it.quality >= state.pool.minQ
      && (!q || it.name.toLowerCase().includes(q) || String(it.id) === q || (it.desc || '').toLowerCase().includes(q)));
    const by = { id: (a, b) => a.id - b.id, name: (a, b) => a.name.localeCompare(b.name), quality: (a, b) => b.quality - a.quality || a.id - b.id };
    shown.sort(by[state.pool.sort] || by.id);

    const lockedCount = all.filter((it) => it.ach && poolOwners(it).length === 0).length;
    const summary = state.pool.mode === 'locked'
      ? `<b>${matching.length}</b> items nobody has unlocked yet`
      : `<b>${matching.length}</b> of ${all.length} items available · ${lockedCount} still locked for everyone`;
    const hint = !ps.length ? '<p class="spin-note">No players loaded, so only items that start unlocked are shown. Add players at the top.</p>' : '';
    $('#pool-ages').innerHTML = ps.length ? `Steam data: ${ps.map((p) => `<span class="age age-${ageClass(p.fetchedAt)}"><i style="background:${p.color}"></i>${esc(pname(p))} ${ago(p.fetchedAt)}</span>`).join(' ')}` : '';

    $('#pool-summary').innerHTML = `${summary}${shown.length !== matching.length ? ` · showing ${shown.length}` : ''}`;
    $('#pool-grid').innerHTML = hint + (shown.map((it) => {
      const owners = poolOwners(it);
      const dots = it.ach && ps.length > 1 ? `<span class="who">${ps.map((p) => `<i style="${owners.includes(p) ? `background:${p.color}` : ''}" title="${esc(pname(p))}: ${owners.includes(p) ? 'unlocked' : 'locked'}"></i>`).join('')}</span>` : '';
      const tag = !it.ach ? '<span class="pool-tag">starts unlocked</span>' : '';
      const how = it.ach ? `Unlocked by Steam achievement #${it.ach}${markForAch(it.ach) ? ` (${markForAch(it.ach)})` : ''}` : 'Available from the start';
      return `<button class="pool-item q${it.quality}${state.pool.mode === 'locked' ? ' locked' : ''}" data-item="${it.id}" title="${esc(it.desc)}\n${esc(how)}\nClick to open in the Spindown calculator">
        <span class="pool-top"><span class="iid">#${it.id}</span>${qualityStars(it.quality)}</span>
        <span class="pool-name">${esc(it.name)}</span>
        <span class="pool-bottom">${tag}${dots}</span>
      </button>`;
    }).join('') || '<p class="empty-hint light">No items match.</p>');
  }

  // ---------- views ----------
  function renderView() {
    if (state.view === 'marks') { renderCarousel(); renderStage(); }
    if (state.view === 'bosses') renderBosses();
    if (state.view === 'challenges') renderChallenges();
    if (state.view === 'squad') renderSquad();
    if (state.view === 'spindown') renderSpindown();
    if (state.view === 'pool') renderPool();
  }

  function render() {
    renderPlayers();
    renderView();
  }

  function showView(view, animate = true) {
    const swap = () => {
      state.view = view;
      $$('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
      $$('.view-btn').forEach((b) => b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'));
      renderView();
      if (view === 'marks') scrollToSelected('instant');
      if (animate && window.scrollY > $('.top').offsetHeight) window.scrollTo({ top: 0 });
      if (view === 'spindown' && animate && matchMedia('(pointer: fine)').matches) $('#spin-input').focus();
      save();
    };
    if (animate && document.startViewTransition && view !== state.view) {
      // A hidden tab aborts the transition; the swap still runs, so ignore the rejection.
      const t = document.startViewTransition(swap);
      t.ready.catch(() => {});
      t.finished.catch(() => {});
    }
    else {
      if (animate && view !== state.view) {
        const el = $(`#view-${view}`);
        el.classList.remove('fade-in');
        requestAnimationFrame(() => el.classList.add('fade-in'));
      }
      swap();
    }
  }

  function scrollToSelected(behavior) {
    const el = document.querySelector(`.ccard[data-id="${state.selected}"]`);
    if (el) el.scrollIntoView({ behavior, inline: 'center', block: 'nearest' });
  }

  function select(id, scroll = 'smooth') {
    if (id !== state.selected) state.selectedMark = null;
    state.selected = id;
    save();
    renderCarousel();
    renderStage();
    if (scroll) scrollToSelected(scroll);
  }

  function step(dir) {
    const list = visibleChars();
    const i = list.findIndex((c) => c.id === state.selected);
    select(list[(i + dir + list.length) % list.length].id);
  }

  // ---------- events ----------
  $$('.view-btn').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#add-input').value;
    const path = profilePath(input);
    if (!input.trim()) { showToast('Paste a Steam profile link or Steam ID first.', 'err'); $('#add-input').focus(); return; }
    if (!path) { showToast('That doesn’t look like a Steam profile. Use steamcommunity.com/id/NAME or the 17-digit Steam ID (7656…).', 'err', 6000); $('#add-input').classList.add('shake'); setTimeout(() => $('#add-input').classList.remove('shake'), 500); return; }
    if (state.players.some((p) => p.path.toLowerCase() === path.toLowerCase())) { $('#add-input').value = ''; showToast('That player is already added.'); return; }
    const used = state.players.map((p) => p.color);
    const p = { input: input.trim(), path, color: COLORS.find((c) => !used.includes(c)) || COLORS[0], unlocked: null, status: 'idle' };
    state.players.push(p);
    $('#add-input').value = '';
    save();
    loadPlayer(p);
  });

  $('#recent').addEventListener('click', (e) => {
    const forget = e.target.closest('[data-forget]');
    if (forget) { recent.splice(+forget.dataset.forget, 1); saveRecent(); renderRecent(); return; }
    const add = e.target.closest('[data-recent]');
    if (!add || state.players.length >= MAX_PLAYERS) return;
    const r = recent[+add.dataset.recent];
    const used = state.players.map((p) => p.color);
    // Show the saved data right away, then refresh it from Steam.
    const p = { input: r.sid || r.path.split('/')[1], path: r.path, sid: r.sid, name: r.name, avatar: r.avatar,
      color: COLORS.find((c) => !used.includes(c)) || COLORS[0], unlocked: new Set(r.unlocked), fetchedAt: r.fetchedAt, status: 'ok' };
    state.players.push(p);
    save();
    loadPlayer(p);
  });

  $('#players').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.dataset.act === 'color') return;
    const i = +btn.closest('.player').dataset.i;
    if (btn.dataset.act === 'error') openError(i);
    if (btn.dataset.act === 'remove') {
      const gone = state.players.splice(i, 1)[0];
      if (gone.unlocked) rememberPlayer(gone);
      save();
      render();
    }
    if (btn.dataset.act === 'reload') loadPlayer(state.players[i]);
  });
  $('#refresh-all').addEventListener('click', refreshAll);
  $('#stale-refresh').addEventListener('click', refreshAll);
  $('#players').addEventListener('input', (e) => {
    if (e.target.dataset.act !== 'color') return;
    const p = state.players[+e.target.closest('.player').dataset.i];
    p.color = e.target.value;
    e.target.parentElement.style.background = p.color;
    renderView();
  });
  $('#players').addEventListener('change', (e) => { if (e.target.dataset.act === 'color') save(); });

  $('#carousel').addEventListener('click', (e) => {
    const card = e.target.closest('.ccard');
    if (card) select(card.dataset.id);
  });
  let touchX = null, touchY = null;
  $('.stage').addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; touchY = e.changedTouches[0].clientY; }, { passive: true });
  $('.stage').addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
  }, { passive: true });
  $('#carousel').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  $('#prev').addEventListener('click', () => step(-1));
  $('#next').addEventListener('click', () => step(1));
  $$('#view-marks .tab').forEach((t) => t.addEventListener('click', () => { state.filter = t.dataset.filter; save(); select(state.selected); }));
  $('#sort-coop').addEventListener('change', (e) => { state.coopSort = e.target.checked; save(); select(state.selected); });
  $('#hard-mode').addEventListener('change', (e) => { state.hard = e.target.checked; save(); renderStage(); });

  $('#spin-input').addEventListener('input', renderSearch);
  $('#spin-input').addEventListener('keydown', (e) => {
    const items = [...$$('#spin-results li')];
    const i = Math.max(0, items.findIndex((li) => li.classList.contains('active')));
    if (e.key === 'Enter' && items[i]) { e.preventDefault(); pickItem(items[i].dataset.item); }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
      e.preventDefault();
      const j = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, k) => li.classList.toggle('active', k === j));
      items[j].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Escape') $('#spin-results').hidden = true;
  });
  $('#spin-results').addEventListener('mousedown', (e) => {
    const li = e.target.closest('[data-item]');
    if (li) { e.preventDefault(); pickItem(li.dataset.item); }
  });
  $('#spin-input').addEventListener('blur', () => { $('#spin-results').hidden = true; });
  $('#spin-out').addEventListener('click', (e) => {
    const b = e.target.closest('[data-item]');
    if (b) pickItem(b.dataset.item);
  });
  $('#pool-mode').addEventListener('change', (e) => { state.pool.mode = e.target.value; save(); renderPool(); });
  $('#pool-quality').addEventListener('change', (e) => { state.pool.minQ = +e.target.value; save(); renderPool(); });
  $('#pool-sort').addEventListener('change', (e) => { state.pool.sort = e.target.value; save(); renderPool(); });
  let poolTimer;
  $('#pool-search').addEventListener('input', (e) => {
    clearTimeout(poolTimer);
    poolTimer = setTimeout(() => { state.pool.q = e.target.value; save(); renderPool(); }, 150);
  });
  $('#pool-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-item]');
    if (!b) return;
    state.spin.item = +b.dataset.item;
    showView('spindown');
  });
  $('#spin-source').addEventListener('change', (e) => { state.spin.source = e.target.value; save(); renderSpindown(); });
  $('#spin-all').addEventListener('change', (e) => { state.spin.all = e.target.checked; save(); renderSpindown(); });
  $('#spin-steps').addEventListener('change', (e) => { state.spin.steps = +e.target.value; save(); renderSpindown(); });

  $('#note').addEventListener('click', (e) => {
    const slot = e.target.closest('[data-mark]');
    if (!slot) return;
    state.selectedMark = slot.dataset.mark;
    $$('#note .slot.sel').forEach((el) => el.classList.remove('sel'));
    slot.classList.add('sel', 'pop');
    setTimeout(() => slot.classList.remove('pop'), 350);
    openUnlock(slot.dataset.mark);
  });
  // Dialogs close on the ✕ / "Got it" button or a click on the backdrop (outside the dialog box).
  $$('dialog').forEach((d) => d.addEventListener('click', (e) => {
    const r = d.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    const retry = e.target.closest('[data-retry]');
    if (retry) { d.close(); const p = state.players[+retry.dataset.retry]; if (p) loadPlayer(p); return; }
    if (outside || e.target.closest('.u-close, [data-close]')) d.close();
  }));

  // ---------- how-to popup: shown on the first visit, reopened with "?" ----------
  const INTRO_KEY = 'isaac-coop-marks.intro-seen';
  $('#help-btn').addEventListener('click', () => $('#intro').showModal());
  $('#intro').addEventListener('close', () => { try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* ignore */ } });
  $('#intro').addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (!go) return;
    $('#intro').close();
    showView(go.dataset.go);
    if (go.dataset.go === 'marks' && !state.players.length) $('#add-input').focus();
  });

  $('#view-bosses').addEventListener('click', (e) => {
    const mode = e.target.closest('#boss-mode [data-mode]');
    if (mode) { state.bossMode = mode.dataset.mode; save(); renderBosses(); return; }
    const pick = e.target.closest('[data-boss]');
    if (pick) { state.boss = pick.dataset.boss; state.bossMode = 'boss'; save(); renderBosses(); return; }
    const bf = e.target.closest('[data-bf]');
    if (bf) { state.bossFilter = bf.dataset.bf; save(); renderBosses(); return; }
    const go = e.target.closest('[data-goto]');
    if (go) {
      state.selected = go.dataset.goto;
      if (!visibleChars().some((c) => c.id === state.selected)) state.filter = 'all';
      showView('marks');
      return;
    }
    const cell = e.target.closest('[data-char][data-mark]');
    if (cell) openUnlock(cell.dataset.mark, cell.dataset.char);
  });
  $('#view-bosses').addEventListener('change', (e) => {
    if (e.target.id !== 'boss-hide-done') return;
    state.bossHideDone = e.target.checked;
    save();
    renderBosses();
  });
  // Swipe left/right on the boss page for the next/previous boss.
  let bossTouch = null;
  $('#boss-body').addEventListener('touchstart', (e) => { bossTouch = [e.changedTouches[0].clientX, e.changedTouches[0].clientY]; }, { passive: true });
  $('#boss-body').addEventListener('touchend', (e) => {
    if (!bossTouch || state.bossMode !== 'boss') return;
    const dx = e.changedTouches[0].clientX - bossTouch[0], dy = e.changedTouches[0].clientY - bossTouch[1];
    bossTouch = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 1.5 * Math.abs(dy)) stepBoss(dx < 0 ? 1 : -1);
  }, { passive: true });

  $('#chal-filter').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    state.chalFilter = t.dataset.f;
    save();
    renderChallenges();
  });

  $('#view-squad').addEventListener('change', (e) => {
    if (e.target.matches('select[data-path]')) state.squad.goals[e.target.dataset.path] = e.target.value;
    else if (e.target.id === 'squad-dupes') state.squad.dupes = e.target.checked;
    else return;
    save();
    renderSquad();
  });
  $('#view-squad').addEventListener('click', (e) => {
    const gb = e.target.closest('[data-goal]');
    if (gb) {
      const p = loaded().find((x) => x.path === gb.dataset.path);
      let goal = gb.dataset.goal;
      if (goal === 'hunt') {
        const cur = state.squad.goals[p.path];
        // Start hunting the unlocked character this player is missing the most marks on.
        goal = cur && cur !== 'auto' && cur !== 'carry' ? cur
          : CHARACTERS.filter((c) => hasChar(p, c)).sort((x, y) => score(y, p).missing - score(x, p).missing)[0].id;
      }
      state.squad.goals[p.path] = goal;
      save();
      renderSquad();
      return;
    }
    const el = e.target.closest('[data-char]');
    if (!el) return;
    state.selected = el.dataset.char;
    if (!visibleChars().some((c) => c.id === state.selected)) state.filter = 'all';
    showView('marks');
  });

  $('#share-btn').addEventListener('click', async () => {
    writeUrl();
    try {
      await navigator.clipboard.writeText(location.href);
      showToast('Link copied: it opens this page with the same players.', 'ok');
    } catch (e) {
      prompt('Copy this link:', location.href);
    }
  });

  // ---------- keyboard shortcuts ----------
  // ? help · 1–6 views · ←/→ characters (Marks) or bosses (Bosses) · / search (Spindown, Items) · Home back to top
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.target.closest && e.target.closest('input, select, textarea, [contenteditable]')) return;
    if (e.key === '?') { e.preventDefault(); $('#intro').showModal(); return; }
    if (/^[1-6]$/.test(e.key)) { showView(VIEWS[+e.key - 1]); return; }
    if (e.key === '/') {
      e.preventDefault();
      if (state.view !== 'pool' && state.view !== 'spindown') showView('spindown');
      $(state.view === 'pool' ? '#pool-search' : '#spin-input').focus();
      return;
    }
    if (state.view === 'marks' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('#carousel')) {
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    }
    if (state.view === 'bosses' && state.bossMode === 'boss' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      stepBoss(e.key === 'ArrowRight' ? 1 : -1);
    }
  });

  // ---------- back to top on long sheets ----------
  const toTop = $('#to-top');
  window.addEventListener('scroll', () => { toTop.hidden = window.scrollY < 700; }, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ---------- start ----------
  load();
  readUrl();
  writeUrl();
  [...loaded()].reverse().forEach(rememberPlayer);
  renderPlayers();
  showView(state.view, false);
  // Players with no data, or data older than a few hours, reload from Steam (all at once).
  state.players.filter((p) => !p.unlocked || p.status === 'stale' || !p.fetchedAt || Date.now() - p.fetchedAt > AUTO_REFRESH_AFTER)
    .forEach((p) => loadPlayer(p, !!p.unlocked));
  let introSeen = false;
  try { introSeen = !!localStorage.getItem(INTRO_KEY); } catch (e) { /* storage blocked: show it */ }
  if (!introSeen) $('#intro').showModal();
})();
