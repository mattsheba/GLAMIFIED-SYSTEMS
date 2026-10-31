#!/usr/bin/env node
/**
 * generate-art.mjs — builds the product artwork for iVogue Lusaka.
 *
 * Every product/colour pair in data/catalog.json gets a hand-drawn SVG render
 * in assets/devices/. The art is generated, not stock: it is vector, tiny,
 * theme-safe and swappable for studio photography later (keep the filenames).
 *
 *   node tools/generate-art.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'devices');
mkdirSync(outDir, { recursive: true });

const catalog = JSON.parse(readFileSync(join(root, 'data', 'catalog.json'), 'utf8'));

/* ── colour maths ─────────────────────────────────────────── */
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
function rgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const hex = ([r, g, b]) => '#' + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => hex(rgb(a).map((c, i) => c + (rgb(b)[i] - c) * t));
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);
const luma = (c) => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

/* ── device families ──────────────────────────────────────── */
const FAMILY = {
  'iphone-17-pro-max': { w: 322, island: 'pro',    notch: 'island' },
  'iphone-17-pro':     { w: 300, island: 'pro',    notch: 'island' },
  'iphone-17':         { w: 300, island: 'duo',    notch: 'island' },
  'iphone-air':        { w: 304, island: 'bar',    notch: 'island' },
  'iphone-16-pro-max': { w: 320, island: 'pro',    notch: 'island' },
  'iphone-16':         { w: 298, island: 'duoV',   notch: 'island' },
  'iphone-16e':        { w: 296, island: 'single', notch: 'notch'  },
  'iphone-15':         { w: 298, island: 'duoD',   notch: 'island' },
  'iphone-13':         { w: 296, island: 'duoD',   notch: 'notch'  },
  'iphone-12':         { w: 292, island: 'duoD',   notch: 'notch'  },
  'iphone-11':         { w: 296, island: 'duoD',   notch: 'notch'  },
};

const CANVAS = { w: 760, h: 920 };

/* ── pieces ───────────────────────────────────────────────── */
function cameraIsland(kind, cx, cy, body, uid) {
  const glass = darken(body, 0.72);
  const ring = lighten(body, 0.18);
  const lens = (x, y, r) => `
    <circle cx="${x}" cy="${y}" r="${r}" fill="${ring}" opacity="0.9"/>
    <circle cx="${x}" cy="${y}" r="${r - 3}" fill="${glass}"/>
    <circle cx="${x}" cy="${y}" r="${r - 8}" fill="url(#lens-${uid})"/>
    <circle cx="${x - r / 4}" cy="${y - r / 4}" r="${Math.max(2, r / 6)}" fill="#ffffff" opacity="0.5"/>`;
  const plate = (x, y, w, h, r) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${lighten(body, 0.07)}" stroke="${darken(body, 0.25)}" stroke-width="1.5"/>`;

  switch (kind) {
    case 'pro': {
      const s = 150, x = cx - s / 2, y = cy - s / 2;
      return plate(x, y, s, s, 44) +
        lens(x + 44, y + 44, 29) + lens(x + 44, y + 106, 29) + lens(x + 106, y + 75, 29) +
        `<circle cx="${x + 110}" cy="${y + 28}" r="8" fill="${lighten(body, 0.5)}"/>
         <circle cx="${x + 110}" cy="${y + 28}" r="4.5" fill="#F6E6B8"/>`;
    }
    case 'duo': case 'duoV': {
      const w = 76, h = 142, x = cx - w / 2, y = cy - h / 2;
      return plate(x, y, w, h, 38) + lens(cx, y + 38, 27) + lens(cx, y + 104, 27) +
        `<circle cx="${cx}" cy="${y + 71}" r="5" fill="#F6E6B8" opacity="0.85"/>`;
    }
    case 'duoD': {
      const s = 128, x = cx - s / 2, y = cy - s / 2;
      return plate(x, y, s, s, 40) + lens(x + 40, y + 40, 27) + lens(x + 88, y + 88, 27) +
        `<circle cx="${x + 92}" cy="${y + 36}" r="7" fill="#F6E6B8" opacity="0.8"/>`;
    }
    case 'single': {
      return lens(cx, cy, 32) + `<circle cx="${cx + 46}" cy="${cy}" r="7" fill="#F6E6B8" opacity="0.8"/>`;
    }
    case 'bar': {
      const w = 250, h = 68, x = cx - w / 2, y = cy - h / 2;
      return plate(x, y, w, h, 24) + lens(x + 48, y + h / 2, 24) +
        `<circle cx="${x + 104}" cy="${y + h / 2}" r="7" fill="#F6E6B8" opacity="0.8"/>
         <rect x="${x + 150}" y="${y + h / 2 - 5}" width="54" height="10" rx="5" fill="${darken(body, 0.45)}" opacity="0.6"/>`;
    }
    default: return '';
  }
}

function backPanel(fam, body, uid, x, y) {
  const w = fam.w, h = Math.round(w * 2.04), r = Math.round(w * 0.155);
  const edge = darken(body, 0.3);
  return `
  <g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#body-${uid})" stroke="${edge}" stroke-width="2"/>
    <rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="${r - 6}" fill="none" stroke="${lighten(body, 0.35)}" stroke-width="1.2" opacity="0.55"/>
    <path d="M${r} 6 H${w - r} A${r - 6} ${r - 6} 0 0 1 ${w - 6} ${r}" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.35"/>
    ${cameraIsland(fam.island, w * 0.3, h * 0.145, body, uid)}
    <circle cx="${w / 2}" cy="${h * 0.52}" r="30" fill="none" stroke="${lighten(body, 0.3)}" stroke-width="1.2" opacity="0.4"/>
    <circle cx="${w / 2}" cy="${h * 0.52}" r="46" fill="none" stroke="${lighten(body, 0.3)}" stroke-width="1" opacity="0.22"/>
    <text x="${w / 2}" y="${h * 0.78}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif"
          font-size="17" letter-spacing="2" fill="${luma(body) > 0.55 ? darken(body, 0.55) : lighten(body, 0.6)}" opacity="0.7">iPhone</text>
  </g>`;
}

function frontPanel(fam, body, uid, x, y) {
  const w = fam.w, h = Math.round(w * 2.04), r = Math.round(w * 0.155);
  const inset = 11;
  const screenR = r - inset + 2;
  const island = fam.notch === 'island'
    ? `<rect x="${w / 2 - 48}" y="${inset + 16}" width="96" height="30" rx="15" fill="#07070A"/>
       <circle cx="${w / 2 + 30}" cy="${inset + 31}" r="8" fill="#0E1118"/>
       <circle cx="${w / 2 + 30}" cy="${inset + 31}" r="3.4" fill="#1E3A5F"/>`
    : `<path d="M${w / 2 - 78} ${inset} h156 a10 10 0 0 1 -10 10 h-18 a12 12 0 0 0 -12 12 v4 a12 12 0 0 1 -12 12 h-52 a12 12 0 0 1 -12 -12 v-4 a12 12 0 0 0 -12 -12 h-18 a10 10 0 0 1 -10 -10 z" fill="#07070A"/>`;
  return `
  <g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#frame-${uid})" stroke="${darken(body, 0.4)}" stroke-width="2"/>
    <rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" rx="${screenR}" fill="#05060A"/>
    <rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" rx="${screenR}" fill="url(#wall-${uid})"/>
    <rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" rx="${screenR}" fill="url(#gloss-${uid})"/>
    ${island}
    <g opacity="0.92" font-family="Inter, Helvetica, Arial, sans-serif" fill="#ffffff" text-anchor="middle">
      <text x="${w / 2}" y="${h * 0.30}" font-size="58" font-weight="300" letter-spacing="-1">09:41</text>
      <text x="${w / 2}" y="${h * 0.345}" font-size="16" opacity="0.72">Saturday, Lusaka</text>
    </g>
    <g opacity="0.9">
      ${[0, 1, 2, 3].map((i) => `<rect x="${w * 0.2 + i * (w * 0.2)}" y="${h * 0.80}" width="${w * 0.12}" height="${w * 0.12}" rx="${w * 0.032}" fill="#ffffff" opacity="${0.14 + i * 0.03}"/>`).join('')}
      <rect x="${w * 0.2}" y="${h * 0.88}" width="${w * 0.6}" height="${w * 0.13}" rx="${w * 0.045}" fill="#ffffff" opacity="0.12"/>
      <rect x="${w / 2 - w * 0.17}" y="${h - inset - 16}" width="${w * 0.34}" height="5" rx="2.5" fill="#ffffff" opacity="0.6"/>
    </g>
    <rect x="${w - 2}" y="${h * 0.22}" width="4" height="${h * 0.07}" rx="2" fill="${darken(body, 0.2)}"/>
    <rect x="${w - 2}" y="${h * 0.33}" width="4" height="${h * 0.12}" rx="2" fill="${darken(body, 0.2)}"/>
    <rect x="-2" y="${h * 0.2}" width="4" height="${h * 0.05}" rx="2" fill="${darken(body, 0.2)}"/>
    <rect x="-2" y="${h * 0.28}" width="4" height="${h * 0.09}" rx="2" fill="${darken(body, 0.2)}"/>
  </g>`;
}

function defs(body, uid) {
  const warm = luma(body) > 0.6 ? darken(body, 0.35) : lighten(body, 0.45);
  return `
  <defs>
    <linearGradient id="body-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${lighten(body, 0.22)}"/>
      <stop offset="45%" stop-color="${body}"/>
      <stop offset="100%" stop-color="${darken(body, 0.22)}"/>
    </linearGradient>
    <linearGradient id="frame-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${lighten(body, 0.3)}"/>
      <stop offset="50%" stop-color="${body}"/>
      <stop offset="100%" stop-color="${darken(body, 0.3)}"/>
    </linearGradient>
    <linearGradient id="wall-${uid}" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="${darken(body, 0.55)}"/>
      <stop offset="55%" stop-color="${darken(warm, 0.3)}"/>
      <stop offset="100%" stop-color="#07080C"/>
    </linearGradient>
    <linearGradient id="gloss-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="38%" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="lens-${uid}" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0%" stop-color="#2B4668"/>
      <stop offset="60%" stop-color="#0B1220"/>
      <stop offset="100%" stop-color="#05070C"/>
    </radialGradient>
    <radialGradient id="floor-${uid}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
}

function phoneArt(productName, colorName, body, fam, uid) {
  const h = Math.round(fam.w * 2.04);
  const topY = Math.round((CANVAS.h - h) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" role="img" aria-label="${productName} in ${colorName}">
  <title>${productName} — ${colorName}</title>
  ${defs(body, uid)}
  <ellipse cx="${CANVAS.w / 2}" cy="${topY + h + 18}" rx="${fam.w * 1.05}" ry="34" fill="url(#floor-${uid})"/>
  ${backPanel(fam, body, uid + '', 78, topY + 22)}
  ${frontPanel(fam, body, uid + '', CANVAS.w - fam.w - 78, topY - 22)}
</svg>`;
}

/* ── accessory art ────────────────────────────────────────── */
function accessoryArt(id, productName, colorName, body, uid) {
  const C = { w: 760, h: 920 };
  const open = (label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${C.w} ${C.h}" role="img" aria-label="${label}">
  <title>${label}</title>${defs(body, uid)}
  <ellipse cx="${C.w / 2}" cy="${C.h * 0.84}" rx="250" ry="38" fill="url(#floor-${uid})"/>`;
  const close = '</svg>';
  const cx = C.w / 2, cy = C.h / 2;

  if (id === 'airpods-pro-3' || id === 'airpods-4') {
    const pro = id === 'airpods-pro-3';
    const bud = (x, y, flip) => `
      <g transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)">
        <ellipse cx="0" cy="0" rx="46" ry="40" fill="url(#body-${uid})" stroke="${darken(body, 0.2)}" stroke-width="2"/>
        <ellipse cx="-12" cy="-10" rx="16" ry="12" fill="#ffffff" opacity="0.5"/>
        <rect x="-16" y="26" width="32" height="${pro ? 118 : 150}" rx="16" fill="url(#body-${uid})" stroke="${darken(body, 0.2)}" stroke-width="2"/>
        ${pro ? `<ellipse cx="34" cy="-6" rx="24" ry="20" fill="${darken(body, 0.12)}" stroke="${darken(body, 0.25)}" stroke-width="1.5"/>` : ''}
        <rect x="-10" y="${pro ? 120 : 152}" width="20" height="10" rx="5" fill="${darken(body, 0.3)}" opacity="0.5"/>
      </g>`;
    return open(`${productName} in ${colorName}`) + `
      <rect x="${cx - 140}" y="${cy + 40}" width="280" height="210" rx="70" fill="url(#body-${uid})" stroke="${darken(body, 0.2)}" stroke-width="2.5"/>
      <rect x="${cx - 140}" y="${cy + 40}" width="280" height="22" rx="11" fill="${darken(body, 0.08)}" opacity="0.5"/>
      <circle cx="${cx}" cy="${cy + 150}" r="16" fill="none" stroke="${darken(body, 0.2)}" stroke-width="2.5" opacity="0.6"/>
      <circle cx="${cx}" cy="${cy + 150}" r="5" fill="${darken(body, 0.25)}" opacity="0.6"/>
      ${bud(cx - 92, cy - 160, false)}
      ${bud(cx + 92, cy - 160, true)}
    ` + close;
  }

  if (id === 'apple-watch-series-11') {
    return open(`${productName} in ${colorName}`) + `
      <path d="M${cx - 54} ${cy - 300} h108 a26 26 0 0 1 26 26 v150 h-160 v-150 a26 26 0 0 1 26 -26 z" fill="${darken(body, 0.12)}"/>
      <path d="M${cx - 80} ${cy + 124} h160 v150 a26 26 0 0 1 -26 26 h-108 a26 26 0 0 1 -26 -26 z" fill="${darken(body, 0.12)}"/>
      <rect x="${cx - 118}" y="${cy - 148}" width="236" height="280" rx="68" fill="url(#frame-${uid})" stroke="${darken(body, 0.35)}" stroke-width="2.5"/>
      <rect x="${cx - 104}" y="${cy - 134}" width="208" height="252" rx="58" fill="#05060A"/>
      <rect x="${cx - 104}" y="${cy - 134}" width="208" height="252" rx="58" fill="url(#wall-${uid})"/>
      <rect x="${cx - 104}" y="${cy - 134}" width="208" height="252" rx="58" fill="url(#gloss-${uid})"/>
      <g font-family="Inter, Helvetica, Arial, sans-serif" fill="#ffffff" text-anchor="middle">
        <text x="${cx}" y="${cy - 40}" font-size="56" font-weight="300">09:41</text>
        <text x="${cx}" y="${cy + 4}" font-size="15" opacity="0.7">LUSAKA · 24°</text>
        <circle cx="${cx}" cy="${cy + 62}" r="34" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.18"/>
        <path d="M${cx} ${cy + 28} a34 34 0 0 1 30 50" fill="none" stroke="#E86A4B" stroke-width="7" stroke-linecap="round"/>
      </g>
      <rect x="${cx + 116}" y="${cy - 66}" width="12" height="42" rx="6" fill="${lighten(body, 0.2)}" stroke="${darken(body, 0.3)}" stroke-width="1.5"/>
      <rect x="${cx + 116}" y="${cy - 2}" width="10" height="56" rx="5" fill="${darken(body, 0.1)}"/>
    ` + close;
  }

  if (id === 'magsafe-case') {
    return open(`${productName} in ${colorName}`) + `
      <rect x="${cx - 150}" y="${cy - 320}" width="300" height="640" rx="50" fill="url(#body-${uid})" stroke="${darken(body, 0.25)}" stroke-width="2.5"/>
      <rect x="${cx - 136}" y="${cy - 306}" width="272" height="612" rx="42" fill="none" stroke="${lighten(body, 0.3)}" stroke-width="1.5" opacity="0.5"/>
      <rect x="${cx - 118}" y="${cy - 282}" width="150" height="150" rx="44" fill="${darken(body, 0.42)}"/>
      <rect x="${cx - 108}" y="${cy - 272}" width="130" height="130" rx="36" fill="${darken(body, 0.55)}" stroke="${lighten(body, 0.25)}" stroke-width="2" opacity="0.9"/>
      <circle cx="${cx - 72}" cy="${cy - 236}" r="22" fill="#10151E"/>
      <circle cx="${cx - 72}" cy="${cy - 236}" r="13" fill="#24405F"/>
      <circle cx="${cx - 18}" cy="${cy - 180}" r="22" fill="#10151E"/>
      <circle cx="${cx - 18}" cy="${cy - 180}" r="13" fill="#24405F"/>
      <circle cx="${cx}" cy="${cy + 20}" r="52" fill="none" stroke="${lighten(body, 0.4)}" stroke-width="3" opacity="0.45"/>
      <circle cx="${cx}" cy="${cy + 20}" r="34" fill="none" stroke="${lighten(body, 0.4)}" stroke-width="2" opacity="0.3"/>
      <path d="M${cx - 150} ${cy + 120} q150 70 300 0" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.14"/>
      <text x="${cx}" y="${cy + 250}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18"
            letter-spacing="3" fill="${luma(body) > 0.55 ? darken(body, 0.5) : lighten(body, 0.55)}" opacity="0.6">MAGSAFE</text>
    ` + close;
  }

  if (id === 'ceramic-protector') {
    return open(`${productName}`) + `
      <rect x="${cx - 140}" y="${cy - 300}" width="280" height="600" rx="42" fill="#CFE0EC" opacity="0.28" stroke="#9FC2D8" stroke-width="2"/>
      <rect x="${cx - 120}" y="${cy - 280}" width="240" height="560" rx="34" fill="#E9F3F8" opacity="0.18"/>
      <path d="M${cx - 140} ${cy - 120} L${cx + 140} ${cy - 300} L${cx + 140} ${cy - 190} L${cx - 140} ${cy - 10} Z" fill="#ffffff" opacity="0.35"/>
      <g stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.8">
        <path d="M${cx + 70} ${cy + 150} v34 M${cx + 53} ${cy + 167} h34"/>
        <path d="M${cx - 80} ${cy + 230} v22 M${cx - 91} ${cy + 241} h22"/>
      </g>
      <text x="${cx}" y="${cy + 60}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" letter-spacing="4" fill="#5E7E92">9H CERAMIC</text>
    ` + close;
  }

  if (id === 'charger-20w') {
    return open(`${productName}`) + `
      <rect x="${cx - 130}" y="${cy - 150}" width="260" height="260" rx="52" fill="url(#body-${uid})" stroke="${darken(body, 0.2)}" stroke-width="2.5"/>
      <rect x="${cx - 36}" y="${cy + 100}" width="72" height="36" rx="12" fill="${darken(body, 0.45)}"/>
      <g fill="${darken(body, 0.6)}">
        <rect x="${cx - 14}" y="${cy - 230}" width="28" height="84" rx="6"/>
        <rect x="${cx - 74}" y="${cy - 196}" width="28" height="50" rx="6"/>
        <rect x="${cx + 46}" y="${cy - 196}" width="28" height="50" rx="6"/>
      </g>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="46" font-weight="600" fill="${darken(body, 0.55)}" opacity="0.75">20W</text>
      <text x="${cx}" y="${cy + 46}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="16" letter-spacing="3" fill="${darken(body, 0.45)}" opacity="0.6">USB-C PD</text>
    ` + close;
  }

  if (id === 'braided-cable') {
    return open(`${productName} in ${colorName}`) + `
      <path d="M${cx - 190} ${cy - 220} C ${cx + 150} ${cy - 170}, ${cx - 170} ${cy + 40}, ${cx + 120} ${cy + 90}
               S ${cx - 100} ${cy + 250}, ${cx + 40} ${cy + 250}" fill="none" stroke="${darken(body, 0.15)}" stroke-width="22" stroke-linecap="round"/>
      <path d="M${cx - 190} ${cy - 220} C ${cx + 150} ${cy - 170}, ${cx - 170} ${cy + 40}, ${cx + 120} ${cy + 90}
               S ${cx - 100} ${cy + 250}, ${cx + 40} ${cy + 250}" fill="none" stroke="${lighten(body, 0.22)}" stroke-width="10"
            stroke-linecap="round" stroke-dasharray="14 12" opacity="0.7"/>
      <g fill="${lighten(body, 0.1)}" stroke="${darken(body, 0.3)}" stroke-width="2">
        <rect x="${cx - 214}" y="${cy - 250}" width="54" height="62" rx="18"/>
        <rect x="${cx + 20}" y="${cy + 222}" width="54" height="62" rx="18"/>
      </g>
      <g fill="${darken(body, 0.5)}">
        <rect x="${cx - 202}" y="${cy - 268}" width="30" height="22" rx="11"/>
        <rect x="${cx + 32}" y="${cy + 274}" width="30" height="22" rx="11"/>
      </g>
    ` + close;
  }

  if (id === 'magsafe-powerbank') {
    return open(`${productName} in ${colorName}`) + `
      <rect x="${cx - 160}" y="${cy - 230}" width="320" height="460" rx="46" fill="url(#body-${uid})" stroke="${darken(body, 0.25)}" stroke-width="2.5"/>
      <circle cx="${cx}" cy="${cy - 40}" r="92" fill="none" stroke="${lighten(body, 0.35)}" stroke-width="4" opacity="0.5"/>
      <circle cx="${cx}" cy="${cy - 40}" r="62" fill="none" stroke="${lighten(body, 0.35)}" stroke-width="3" opacity="0.32"/>
      <g fill="${lighten(body, 0.6)}" opacity="0.8">
        ${[0, 1, 2, 3].map((i) => `<rect x="${cx - 52 + i * 28}" y="${cy + 110}" width="18" height="30" rx="5" opacity="${i < 3 ? 0.9 : 0.25}"/>`).join('')}
      </g>
      <text x="${cx}" y="${cy + 182}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="17" letter-spacing="2"
            fill="${luma(body) > 0.55 ? darken(body, 0.5) : lighten(body, 0.55)}" opacity="0.65">10,000 mAh</text>
      <rect x="${cx - 24}" y="${cy + 226}" width="48" height="12" rx="6" fill="${darken(body, 0.45)}"/>
    ` + close;
  }

  /* bundles — a phone back with a satellite case and buds */
  const fam = FAMILY[id === 'bundle-pro-edit' ? 'iphone-16-pro-max' : 'iphone-17'];
  return open(`${productName} in ${colorName}`) + `
    ${backPanel(fam, body, uid, cx - fam.w / 2 - 40, 150)}
    <g transform="translate(${cx + 150} ${cy + 180}) scale(0.62)">
      <rect x="-140" y="-100" width="280" height="210" rx="70" fill="${lighten(body, 0.55)}" stroke="${darken(body, 0.2)}" stroke-width="3"/>
      <circle cx="0" cy="10" r="16" fill="none" stroke="${darken(body, 0.2)}" stroke-width="3" opacity="0.5"/>
    </g>
    <g transform="translate(${cx - 210} ${cy + 230}) scale(0.5) rotate(-12)">
      <rect x="-150" y="-300" width="300" height="600" rx="50" fill="${darken(body, 0.18)}" opacity="0.95"/>
      <rect x="-132" y="-282" width="264" height="564" rx="40" fill="none" stroke="${lighten(body, 0.3)}" stroke-width="4" opacity="0.5"/>
      <rect x="-118" y="-262" width="150" height="150" rx="44" fill="${darken(body, 0.34)}"/>
      <circle cx="0" cy="40" r="52" fill="none" stroke="${lighten(body, 0.4)}" stroke-width="4" opacity="0.4"/>
    </g>
  ` + close;
}

/* ── run ──────────────────────────────────────────────────── */
for (const f of readdirSync(outDir)) if (f.endsWith('.svg')) unlinkSync(join(outDir, f));

let n = 0;
for (const p of catalog.products) {
  for (const c of p.colors) {
    const uid = `${p.id}-${c.id}`.replace(/[^a-z0-9-]/gi, '');
    const svg = FAMILY[p.id]
      ? phoneArt(p.name, c.name, c.hex, FAMILY[p.id], uid)
      : accessoryArt(p.id, p.name, c.name, c.hex, uid);
    writeFileSync(join(outDir, `${p.id}--${c.id}.svg`), svg.replace(/\n\s*\n/g, '\n'));
    n++;
  }
}
console.log(`generated ${n} product renders into assets/devices/`);
