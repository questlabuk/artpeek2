// Deterministic SVG generators used for seed artwork and default avatars.
// Pure string output — no canvas, no native deps.

function rng(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return function () {
    h += 0x6D2B79F5; h >>>= 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ['#80ffb9', '#1f8a8a'], ['#ffd166', '#ff8b5e'], ['#a0c4ff', '#5cb6ff'],
  ['#ffadad', '#ff6b9d'], ['#caffbf', '#9bf6c0'], ['#d9b8db', '#b07ec0'], ['#fdffb6', '#ffd166']
];

function genArtSvg(seed, ratio) {
  const r = rng(seed);
  const W = 600, H = Math.round(600 * (ratio || 1));
  const pal = PALETTES[Math.floor(r() * PALETTES.length)];
  const ink = '#20232f', paper = '#fffdf7';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  s += `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
       `<stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></linearGradient></defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#g)"/>`;
  const shapes = 5 + Math.floor(r() * 6);
  const cols = [ink, paper, pal[0], pal[1]];
  for (let i = 0; i < shapes; i++) {
    const cx = r() * W, cy = r() * H, rad = 25 + r() * 110;
    const col = cols[Math.floor(r() * 4)];
    const fill = r() > 0.5;
    const sw = 6 + r() * 8;
    const rot = Math.round(r() * 180);
    const attr = fill ? `fill="${col}"` : `fill="none" stroke="${col}" stroke-width="${sw.toFixed(1)}"`;
    const t = Math.floor(r() * 4);
    if (t === 0) s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" ${attr}/>`;
    else if (t === 1) s += `<rect x="${(cx - rad / 2).toFixed(1)}" y="${(cy - rad / 2).toFixed(1)}" width="${rad.toFixed(1)}" height="${rad.toFixed(1)}" ${attr} transform="rotate(${rot} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
    else if (t === 2) s += `<polygon points="${cx.toFixed(1)},${(cy - rad).toFixed(1)} ${(cx + rad).toFixed(1)},${(cy + rad).toFixed(1)} ${(cx - rad).toFixed(1)},${(cy + rad).toFixed(1)}" ${attr} transform="rotate(${rot} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
    else {
      let d = `M ${(cx - rad).toFixed(1)} ${cy.toFixed(1)}`;
      for (let x = -rad; x <= rad; x += 14) d += ` L ${(cx + x).toFixed(1)} ${(cy + Math.sin(x / 14) * 18).toFixed(1)}`;
      s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`;
    }
  }
  if (r() > 0.5) { // eye motif
    const ex = W / 2, ey = H / 2, ew = 80 + r() * 60;
    s += `<ellipse cx="${ex}" cy="${ey}" rx="${ew.toFixed(1)}" ry="${(ew * 0.62).toFixed(1)}" fill="${paper}" stroke="${ink}" stroke-width="8"/>`;
    s += `<circle cx="${ex}" cy="${ey}" r="${(ew * 0.32).toFixed(1)}" fill="${ink}"/>`;
  }
  return s + '</svg>';
}

function genAvatarSvg(seed) {
  const r = rng(seed);
  const pal = PALETTES[Math.floor(r() * PALETTES.length)];
  const ink = '#20232f';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">`;
  s += `<rect width="200" height="200" fill="${pal[0]}"/>`;
  for (let i = 0; i < 4; i++) s += `<circle cx="${(r() * 200).toFixed(1)}" cy="${(r() * 200).toFixed(1)}" r="${(20 + r() * 50).toFixed(1)}" fill="${pal[1]}"/>`;
  s += `<circle cx="78" cy="90" r="11" fill="${ink}"/><circle cx="122" cy="90" r="11" fill="${ink}"/>`;
  s += `<path d="M 76 120 Q 100 144 124 120" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>`;
  return s + '</svg>';
}

module.exports = { genArtSvg, genAvatarSvg };
