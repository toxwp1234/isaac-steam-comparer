// Completion marks and character portraits, drawn from the game's own sprites.
//
// Marks are rebuilt from pixel data (js/marks-art.js) as SVG rectangles, one per run of
// same-coloured pixels. Nothing is scaled, filtered or resampled, so a mark is exactly as
// sharp at 24px as at 220px - which is not true of an upscaled PNG, and is not true at all
// of a PNG that goes through an SVG filter, because filters ignore image-rendering.
// Portraits are a single sprite sheet carried inline in js/portraits-art.js and shown as a
// CSS background, upscaled by the browser with image-rendering: pixelated.
(function () {
  const ART = window.MARK_ART;
  const PORT = window.PORTRAIT_ART;
  const N = ART.size;
  const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Mark slots, in the order they appear on the note. `ach` keys come from data.js.
  // Rows on the note: 4 / 4 / 4. `ids` = achievements that prove the mark (any of them).
  // Greed mode has no normal/hard switch of its own - Greedier is its hard tier - so Greed and
  // Greedier share one slot, and `hardKey` names the achievement that draws it as a hard mark.
  // `icon` order is also the tile order in marks-art.js: rerun tools/extract-sprites.ps1
  // after reordering this list.
  window.MARKS = [
    { key: 'heart',     icon: 'heart',    label: "Mom's Heart" },
    { key: 'isaac',     icon: 'cross',    label: 'Isaac' },
    { key: 'satan',     icon: 'invcross', label: 'Satan' },
    { key: 'bluebaby',  icon: 'chest',    label: '???' },
    { key: 'lamb',      icon: 'darkroom', label: 'The Lamb' },
    { key: 'megasatan', icon: 'brim',     label: 'Mega Satan' },
    { key: 'bossrush',  icon: 'star',     label: 'Boss Rush' },
    { key: 'hush',      icon: 'hush',     label: 'Hush' },
    { key: 'delirium',  icon: 'void',     label: 'Delirium' },
    { key: 'mother',    icon: 'knife',    label: 'Mother' },
    { key: 'beast',     icon: 'note',     label: 'The Beast' },
    { key: 'greed',     icon: 'cent',     label: 'Ultra Greed', ids: ['greed', 'greedier'], hardKey: 'greedier' },
  ];

  const COL = Object.fromEntries(window.MARKS.map((m, i) => [m.icon, i]));

  // Split a tile into runs of identical pixels - far fewer rectangles than pixels, and
  // neighbouring runs share an edge exactly, so no seams show. Pixels inside the glyph's solid
  // body go in `body` (they take the player colours), the outline and shading in `shell`.
  function runsOf(tile, bodyMask) {
    const body = [], shell = [];
    for (let y = 0; y < N; y++) {
      let x = 0;
      while (x < N) {
        const i = y * N + x;
        const c = tile[i];
        if (c === '.') { x++; continue; }
        const inBody = bodyMask[i] === '1';
        let w = 1;
        while (x + w < N && tile[i + w] === c && (bodyMask[i + w] === '1') === inBody) w++;
        (inBody ? body : shell).push({ x, y, w, c });
        x += w;
      }
    }
    return { body, shell };
  }

  const rect = (r, fill) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${fill}"/>`;

  // The one-pixel ring around a glyph's body, as runs carrying palette index `c`.
  function halo(bodyMask, c) {
    const solid = (x, y) => x >= 0 && y >= 0 && x < N && y < N && bodyMask[y * N + x] === '1';
    const ring = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (solid(x, y)) continue;
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (solid(x + dx, y + dy)) { touches = true; break; }
          }
        }
        if (touches) ring.push({ x, y, w: 1, c });
      }
    }
    return ring;
  }

  // Per variant+mark: the sprite as it is in game, minus its solid interior, plus a clip path
  // holding that interior. The player colours are poured into the clip.
  const cache = new Map();
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.position = 'absolute';
  defs.innerHTML = '<defs></defs>';
  document.body.prepend(defs);

  function tileArt(variant, col) {
    const id = `${variant}-${col}`;
    let got = cache.get(id);
    if (got) return got;

    const v = ART.variants[variant];
    const mask = ART.bodies[col];
    let { body, shell } = runsOf(v.tiles[col], mask);

    // On the hard, Greed and Greedier notes the game wraps the glyph in a coloured ring. The
    // plain note has none - only a half-transparent fringe - so once the body is filled with a
    // player's colour nothing would be left to read as the shape. Grow the body by one pixel
    // and draw that as the outline instead, in the body's own colour.
    const opaque = (c) => /ff$/.test(v.pal[DIGITS.indexOf(c)]);
    if (!shell.some((r) => opaque(r.c))) {
      const solid = body.find((r) => opaque(r.c)) || body[0];
      if (solid) shell = shell.concat(halo(mask, solid.c));
    }

    got = {
      clip: `mkc-${id}`,
      art: shell.map((r) => rect(r, v.pal[DIGITS.indexOf(r.c)])).join(''),
      core: body.map((r) => rect(r, 'currentColor')).join(''),
    };
    defs.querySelector('defs').insertAdjacentHTML('beforeend',
      `<clipPath id="${got.clip}" clipPathUnits="userSpaceOnUse">` +
      body.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1"/>`).join('') +
      `</clipPath>`);
    cache.set(id, got);
    return got;
  }

  // A pie slice of the tile, so several players share one mark.
  function wedge(i, n) {
    if (n === 1) return `M-1 -1h${N + 2}v${N + 2}h${-N - 2}z`;
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const a1 = a0 + (2 * Math.PI) / n;
    const c = N / 2, R = N;
    const p = (a) => `${c + R * Math.cos(a)} ${c + R * Math.sin(a)}`;
    return `M${c} ${c}L${p(a0)}A${R} ${R} 0 0 1 ${p(a1)}Z`;
  }

  // fills: [{color}] for the players who have the mark, in player order.
  // state: 'known' | 'unknown'
  window.markSvg = function (icon, fills, state, hard) {
    const col = COL[icon] ?? 0;
    const t = tileArt(hard ? 'hard' : 'normal', col);
    const done = fills.length > 0;
    const body = done
      ? fills.map((f, i) => `<path d="${wedge(i, fills.length)}" fill="${f.color}"/>`).join('')
      : `<g class="${state === 'unknown' ? 'mk-unknown' : 'mk-empty'}">${t.core}</g>`;
    return `<svg viewBox="0 0 ${N} ${N}" class="mark-svg ${state}${done ? ' done' : ''}" ` +
      `shape-rendering="crispEdges">` +
      `<g class="mk-ink">${t.art}</g>` +
      `<g clip-path="url(#${t.clip})">${body}</g>` +
      `</svg>`;
  };

  document.documentElement.style.setProperty('--portrait-sheet', `url("${PORT.src}")`);
  document.documentElement.style.setProperty('--portrait-cols', PORT.cols);
  document.documentElement.style.setProperty('--portrait-rows', PORT.rows);
  const PCOL = Object.fromEntries(PORT.keys.map((k, i) => [k, i]));

  // Background-position is worked out here rather than in calc(): browsers disagree about
  // dividing by a var() inside calc, and a dropped declaration means a blank portrait.
  window.portraitSvg = function (key, tainted) {
    const col = PCOL[key] ?? 0;
    const x = (col / (PORT.cols - 1)) * 100;
    const y = (tainted ? 1 : 0) / (PORT.rows - 1) * 100;
    return `<span class="portrait${tainted ? ' tainted' : ''}" ` +
      `style="--px:${x.toFixed(4)}%;--py:${y}%"></span>`;
  };
})();
