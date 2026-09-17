// Hand-drawn look-alike SVG art: completion mark icons and character portraits.
(function () {
  // Mark slots, in the order they appear on the note. `ach` keys come from data.js.
  window.MARKS = [
    { key: 'heart',     icon: 'heart',    label: "Mom's Heart / It Lives" },
    { key: 'isaac',     icon: 'cross',    label: 'Isaac' },
    { key: 'satan',     icon: 'invcross', label: 'Satan' },
    { key: 'bluebaby',  icon: 'polaroid', label: '???' },
    { key: 'lamb',      icon: 'negative', label: 'The Lamb' },
    { key: 'megasatan', icon: 'brim',     label: 'Mega Satan' },
    { key: 'bossrush',  icon: 'star',     label: 'Boss Rush' },
    { key: 'hush',      icon: 'hush',     label: 'Hush' },
    { key: 'greed',     icon: 'cent',     label: 'Ultra Greed(ier)' },
    { key: 'delirium',  icon: 'paper',    label: 'Delirium' },
    { key: 'mother',    icon: 'knife',    label: 'Mother' },
    { key: 'beast',     icon: 'note',     label: 'The Beast' },
  ];

  // Icon shapes on a 100x100 canvas, drawn white so they double as masks.
  const W = 'fill="#fff"';
  const S = (w) => `fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const ICONS = {
    heart: `<path ${W} d="M50 88C22 66 7 48 12 29 17 12 41 9 50 29 59 9 83 12 88 29 93 48 78 66 50 88Z"/>`,
    cross: `<path ${W} d="M41 8h18v22h22v17H59v45H41V47H19V30h22z"/>`,
    invcross: `<path ${W} d="M41 92h18V70h22V53H59V8H41v45H19v17h22z"/>`,
    polaroid: `<path ${W} fill-rule="evenodd" d="M20 10h60v80H20zM28 18v46h44V18z"/><circle ${W} cx="50" cy="38" r="9"/><path ${W} d="M36 64c2-11 26-11 28 0z"/>`,
    negative: `<path ${W} fill-rule="evenodd" d="M12 22h76v56H12zM17 26v7h7v-7zm13 0v7h7v-7zm13 0v7h7v-7zm13 0v7h7v-7zm13 0v7h7v-7zM17 67v7h7v-7zm13 0v7h7v-7zm13 0v7h7v-7zm13 0v7h7v-7zm13 0v7h7v-7zM22 38v24h56V38z"/><path ${W} d="M40 40l6 8-2 12h12l-2-12 6-8-10 5z"/>`,
    brim: `<path ${W} fill-rule="evenodd" d="M16 10c2 18 8 26 16 30-6 6-8 12-8 20 0 18 12 30 26 30s26-12 26-30c0-8-2-14-8-20 8-4 14-12 16-30-10 10-20 14-30 14h-8C36 24 26 20 16 10zM34 56l12 4-3 8-10-4zm32 0l-12 4 3 8 10-4zM40 78c6-5 14-5 20 0z"/>`,
    star: `<path ${W} d="M50 6l12 30 32 2-25 20 9 32-28-18-28 18 9-32-25-20 32-2z"/>`,
    hush: `<path ${W} fill-rule="evenodd" d="M50 8C27 8 10 26 10 50s17 42 40 42 40-18 40-42S73 8 50 8zM28 38c4-6 14-6 18 2-6 5-14 5-18-2zm44 0c-4-6-14-6-18 2 6 5 14 5 18-2zM34 68c10-8 22-8 32 0-10 5-22 5-32 0z"/>`,
    cent: `<path ${S(11)} d="M70 30A26 26 0 1 0 70 70"/><path ${S(9)} d="M52 10v80"/>`,
    paper: `<path ${W} fill-rule="evenodd" d="M18 14l24 4 20-6 22 8-4 22 6 22-8 22-24-4-22 6-18-8 4-24-6-20zM34 34l10 12-6 12 14-6 12 10-4-16 10-8-14 2-8-12-2 14z"/>`,
    knife: `<path ${W} d="M62 6c10 10 12 30 2 50L50 64l-10-8z"/><path ${W} d="M40 60l12 10-16 22c-4 4-10 2-12-2-2-4 0-8 2-10z"/><path ${W} d="M32 54l30 22-4 5-30-22z"/>`,
    note: `<path ${W} fill-rule="evenodd" d="M16 14h54l14 14v58H16zM26 32v5h46v-5zm0 13v5h46v-5zm0 13v5h36v-5zm0 13v5h26v-5z"/>`,
  };

  // Hidden SVG with shared defs: icon groups, masks, pencil/ink filters, hatch.
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.position = 'absolute';
  defs.innerHTML = `<defs>
    ${Object.entries(ICONS).map(([k, v]) => `<g id="ic-${k}">${v}</g><mask id="mk-${k}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><use href="#ic-${k}"/></mask>`).join('')}
    <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="4"/>
      <feDisplacementMap in="SourceGraphic" scale="3"/>
    </filter>
    ${[['empty', '#6b5a4a', 2.2], ['normal', '#1e1410', 3.2], ['hard', '#b3221b', 3.6]].map(([k, c, r]) => `<filter id="ink-${k}" x="-10%" y="-10%" width="120%" height="120%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="${r}" result="fat"/>
      <feComposite in="fat" in2="SourceAlpha" operator="out" result="edge"/>
      <feFlood flood-color="${c}"/>
      <feComposite in2="edge" operator="in"/>
    </filter>`).join('')}
    <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4.5" height="9" fill="#fff" fill-opacity=".55"/>
    </pattern>
  </defs>`;
  document.body.prepend(defs);

  function wedge(i, n) {
    if (n === 1) return 'M-10-10h120v120h-120z';
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const a1 = a0 + (2 * Math.PI) / n;
    const R = 90, p = (a) => `${50 + R * Math.cos(a)} ${50 + R * Math.sin(a)}`;
    return `M50 50L${p(a0)}A${R} ${R} 0 0 1 ${p(a1)}Z`;
  }

  // fills: [{color, partial}] for the players who have the mark, in player order.
  // state: 'known' | 'unknown'
  window.markSvg = function (icon, fills, state, hard) {
    const body = state === 'unknown'
      ? `<rect width="100" height="100" class="mk-unknown"/>`
      : `<rect width="100" height="100" class="mk-empty"/>` +
        fills.map((f, i) => `<path d="${wedge(i, fills.length)}" fill="${f.color}"${f.partial ? ' fill-opacity=".5"' : ''}/>` +
          (f.partial ? `<path d="${wedge(i, fills.length)}" fill="url(#hatch)"/>` : '')).join('');
    const done = fills.length > 0;
    const ink = state === 'unknown' || !done ? 'empty' : hard ? 'hard' : 'normal';
    return `<svg viewBox="-6 -6 112 112" class="mark-svg ${state}${done ? ' done' : ''}"><g filter="url(#rough)">
      <g mask="url(#mk-${icon})">${body}</g>
      <use href="#ic-${icon}" filter="url(#ink-${ink})"/>
    </g></svg>`;
  };

  // ---- Portraits: one parametric Isaac-style head, dressed per character ----
  const P = {
    isaac:     { skin: '#f3d9c9' },
    magdalene: { skin: '#f3d9c9', hair: 'curls', hc: '#f2c94c' },
    cain:      { skin: '#f3d9c9', hair: 'short', hc: '#6b4a2b', patch: true },
    judas:     { skin: '#f3d9c9', hat: 'fez' },
    bluebaby:  { skin: '#8fb3dd', eyes: 'x' },
    eve:       { skin: '#f3d9c9', hair: 'bob', hc: '#2b2230' },
    samson:    { skin: '#f3d9c9', hair: 'long', hc: '#8a5a33', band: '#c0392b' },
    azazel:    { skin: '#3a3434', horns: true, eyes: 'red' },
    lazarus:   { skin: '#eadbc8', hair: 'short', hc: '#4a3a2a' },
    eden:      { skin: '#f3d9c9', hair: 'spiky', hc: '#5fbf6f' },
    lost:      { skin: '#f7f7f4', eyes: 'hollow', ghost: true },
    lilith:    { skin: '#e9d6cf', hood: '#1f1b22', eyes: 'shut' },
    keeper:    { skin: '#b89f84', eyes: 'coin', grin: true },
    apollyon:  { skin: '#a9a7b4', hood: '#4b4a5a' },
    forgotten: { skin: '#ebe4d2', eyes: 'hollow', bone: true },
    bethany:   { skin: '#f3d9c9', hair: 'buns', hc: '#b85c38' },
    jacob:     { twin: true },
  };

  function head(o, tainted, dx = 0, scale = 1, esau = false) {
    const t = `transform="translate(${dx} 0) translate(50 56) scale(${scale}) translate(-50 -56)"`;
    let s = `<g ${t}>`;
    if (o.hood) s += `<path d="M14 62C12 28 30 12 50 12s38 16 36 50c0 14-4 26-8 30H22c-4-4-8-16-8-30z" fill="${o.hood}"/>`;
    if (o.hair === 'long') s += `<path d="M18 50c0-26 14-40 32-40s32 14 32 40v40H18z" fill="${o.hc}"/>`;
    if (o.horns) s += `<path d="M26 34C16 26 14 14 18 6c4 10 12 16 20 18zM74 34c10-8 12-20 8-28-4 10-12 16-20 18z" fill="#2a2424"/>`;
    s += `<ellipse cx="50" cy="56" rx="33" ry="31" fill="${o.skin}" stroke="#2a1d17" stroke-width="3"${o.ghost ? ' fill-opacity=".85"' : ''}/>`;
    if (o.bone) s += `<path d="M34 80l4 6M50 82v7M66 80l-4 6" stroke="#2a1d17" stroke-width="3"/>`;
    if (o.hair === 'curls') s += `<g fill="${o.hc}" stroke="#2a1d17" stroke-width="2.5"><circle cx="28" cy="34" r="12"/><circle cx="44" cy="26" r="12"/><circle cx="60" cy="26" r="12"/><circle cx="74" cy="36" r="11"/><circle cx="20" cy="50" r="9"/><circle cx="81" cy="52" r="8"/></g>`;
    if (o.hair === 'short') s += `<path d="M18 50c0-22 14-26 32-26s32 4 32 26c-8-10-18-14-32-12-14-2-24 2-32 12z" fill="${o.hc}" stroke="#2a1d17" stroke-width="2.5"/>`;
    if (o.hair === 'bob') s += `<path d="M16 66c-6-30 10-44 34-44s40 14 34 44c-4-14-8-20-12-22-8 4-38 4-44 0-4 2-8 8-12 22z" fill="${o.hc}" stroke="#2a1d17" stroke-width="2.5"/>`;
    if (o.hair === 'spiky') s += `<path d="M18 48l2-18 8 6 4-16 8 10 8-16 6 14 10-12 2 16 10-4-2 16c-10-8-20-10-32-10s-22 4-34 14z" fill="${o.hc}" stroke="#2a1d17" stroke-width="2.5"/>`;
    if (o.hair === 'buns') s += `<g fill="${o.hc}" stroke="#2a1d17" stroke-width="2.5"><circle cx="24" cy="30" r="10"/><circle cx="76" cy="30" r="10"/><path d="M20 50c2-18 14-26 30-26s28 8 30 26c-10-8-20-12-30-12s-20 4-30 12z"/></g>`;
    if (o.hair === 'long') s += `<path d="M22 44c4-16 14-22 28-22s24 6 28 22c-10-6-18-8-28-8s-18 2-28 8z" fill="${o.hc}" stroke="#2a1d17" stroke-width="2.5"/>`;
    if (o.band) s += `<path d="M19 46c20-8 42-8 62 0" stroke="${o.band}" stroke-width="6" fill="none"/>`;
    if (o.hat === 'fez') s += `<path d="M34 30l4-22h24l4 22z" fill="#b8322a" stroke="#2a1d17" stroke-width="2.5"/><path d="M60 10c8 2 10 10 8 16" stroke="#2a1d17" stroke-width="2.5" fill="none"/>`;
    if (o.hood) s += `<path d="M18 64c0-26 14-44 32-44s32 18 32 44c-6-18-16-26-32-26s-26 8-32 26z" fill="${o.hood}"/>`;
    // eyes
    const ey = 58, ex = [37, 63];
    const eye = (x) => {
      switch (o.eyes) {
        case 'x': return `<path d="M${x - 5} ${ey - 5}l10 10m0-10l-10 10" stroke="#2a1d17" stroke-width="3.5"/>`;
        case 'hollow': return `<ellipse cx="${x}" cy="${ey}" rx="6" ry="8" fill="#2a1d17" fill-opacity=".85"/>`;
        case 'shut': return `<path d="M${x - 7} ${ey}q7 5 14 0" stroke="#2a1d17" stroke-width="3" fill="none"/>`;
        case 'coin': return `<circle cx="${x}" cy="${ey}" r="7" fill="#e3b341" stroke="#2a1d17" stroke-width="2.5"/><path d="M${x - 3} ${ey}h6" stroke="#2a1d17" stroke-width="2"/>`;
        case 'red': return `<ellipse cx="${x}" cy="${ey}" rx="6" ry="7" fill="#d23b2e"/>`;
        default: return `<ellipse cx="${x}" cy="${ey}" rx="6.5" ry="8" fill="#2a1d17"/><circle cx="${x - 2}" cy="${ey - 3}" r="2.2" fill="#fff"/>`;
      }
    };
    if (o.patch) s += eye(ex[1]) + `<ellipse cx="${ex[0]}" cy="${ey}" rx="9" ry="9" fill="#2a1d17"/><path d="M18 46l62 -6" stroke="#2a1d17" stroke-width="2.5"/>`;
    else s += eye(ex[0]) + eye(ex[1]);
    if (esau) s += `<path d="M28 46l14 6M72 46l-14 6" stroke="#2a1d17" stroke-width="3.5"/>`;
    // mouth
    if (o.grin) s += `<path d="M34 74q16 10 32 0" stroke="#2a1d17" stroke-width="3" fill="#5a2b20"/>`;
    else s += `<path d="M44 76q6 3 12 0" stroke="#2a1d17" stroke-width="3" fill="none"/>`;
    if (tainted) {
      s += `<path d="M${ex[0]} ${ey + 8}c-2 8 2 12 0 22M${ex[1]} ${ey + 8}c2 8-2 12 0 22" stroke="#7a0f12" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      s += `<ellipse cx="50" cy="56" rx="33" ry="31" fill="#2b0a10" fill-opacity=".22"/>`;
    }
    return s + '</g>';
  }

  window.portraitSvg = function (key, tainted) {
    const o = P[key] || P.isaac;
    let inner;
    if (o.twin) {
      inner = head({ skin: '#f3d9c9', hair: 'short', hc: '#6b4a2b' }, tainted, -17, 0.72) +
              head({ skin: '#f3d9c9', hair: 'spiky', hc: '#9b3b2b' }, tainted, 17, 0.72, true);
    } else {
      inner = head(o, tainted);
    }
    return `<svg viewBox="0 0 100 100" class="portrait${tainted ? ' tainted' : ''}"><g filter="url(#rough)">${inner}</g></svg>`;
  };
})();
