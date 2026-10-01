import type { Shape } from './data/products';

/** Lightens (amount > 0) or darkens (amount < 0) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const adjust = (c: number) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  const r = adjust((n >> 16) & 255);
  const g = adjust((n >> 8) & 255);
  const b = adjust(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const escapeXml = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );

function pictogram(shape: Shape, c: string): string {
  const dark = shade(c, -0.25);
  const mid = c;
  const light = shade(c, 0.35);
  const white = '#ffffff';
  switch (shape) {
    case 'bag':
      return `<path d="M118 112q82-26 164 0l16 190q-98 24-196 0z" fill="${mid}"/>
        <path d="M118 112q82 22 164 0l-6-22q-76-16-152 0z" fill="${light}"/>
        <path d="M124 128q76 18 152 0" stroke="${dark}" stroke-width="5" fill="none" opacity=".5"/>
        <rect x="148" y="190" width="104" height="62" rx="8" fill="${white}" opacity=".92"/>
        <rect x="162" y="204" width="76" height="8" rx="4" fill="${dark}"/><rect x="162" y="222" width="52" height="8" rx="4" fill="${light}"/>`;
    case 'box':
      return `<polygon points="200,90 310,140 310,270 200,320 90,270 90,140" fill="${mid}"/>
        <polygon points="200,90 310,140 200,190 90,140" fill="${light}"/>
        <polygon points="200,190 310,140 310,270 200,320" fill="${dark}"/>
        <polygon points="165,115 235,147 235,175 165,143" fill="${white}" opacity=".85"/>`;
    case 'bucket':
      return `<path d="M130 156h140l-16 150h-108z" fill="${mid}"/>
        <ellipse cx="200" cy="156" rx="70" ry="16" fill="${light}"/>
        <path d="M138 140q62-86 124 0" stroke="${dark}" stroke-width="7" fill="none"/>
        <rect x="150" y="200" width="100" height="56" rx="8" fill="${white}" opacity=".9"/>
        <rect x="164" y="214" width="72" height="8" rx="4" fill="${dark}"/><rect x="164" y="232" width="44" height="8" rx="4" fill="${light}"/>`;
    case 'pipe':
      return `<rect x="46" y="168" width="308" height="64" rx="32" fill="${mid}"/>
        <rect x="46" y="176" width="308" height="14" rx="7" fill="${light}" opacity=".7"/>
        <rect x="46" y="156" width="26" height="88" rx="8" fill="${dark}"/><rect x="328" y="156" width="26" height="88" rx="8" fill="${dark}"/>`;
    case 'sheet':
      return `<polygon points="86,276 152,116 332,116 268,276" fill="${mid}"/>
        ${[0, 1, 2, 3, 4, 5].map((i) => `<polygon points="${112 + i * 26},276 ${172 + i * 26},116 ${182 + i * 26},116 ${122 + i * 26},276" fill="${i % 2 ? dark : light}" opacity=".55"/>`).join('')}`;
    case 'brick':
      return `<rect x="86" y="236" width="110" height="52" rx="6" fill="${mid}"/><rect x="204" y="236" width="110" height="52" rx="6" fill="${dark}"/>
        <rect x="140" y="176" width="110" height="52" rx="6" fill="${light}"/><rect x="86" y="116" width="110" height="52" rx="6" fill="${dark}"/><rect x="204" y="116" width="110" height="52" rx="6" fill="${mid}"/>`;
    case 'tool':
      return `<g transform="rotate(-35 200 200)"><rect x="186" y="110" width="28" height="200" rx="12" fill="${dark}"/>
        <rect x="132" y="92" width="136" height="48" rx="12" fill="${mid}"/><rect x="132" y="92" width="52" height="48" rx="12" fill="${light}"/></g>`;
    case 'bulb':
      return `<circle cx="200" cy="170" r="72" fill="${light}"/><circle cx="200" cy="170" r="72" fill="${mid}" opacity=".35"/>
        <rect x="170" y="238" width="60" height="44" rx="10" fill="${dark}"/><rect x="176" y="282" width="48" height="14" rx="7" fill="${mid}"/>
        <path d="M176 170q24-34 48 0" stroke="${white}" stroke-width="7" fill="none" opacity=".85"/>`;
    case 'roll':
      return `<rect x="104" y="130" width="192" height="140" rx="14" fill="${mid}"/>
        <ellipse cx="200" cy="130" rx="96" ry="26" fill="${light}"/><ellipse cx="200" cy="270" rx="96" ry="26" fill="${dark}"/><rect x="104" y="130" width="192" height="140" fill="${mid}"/>
        <ellipse cx="200" cy="130" rx="96" ry="26" fill="${light}"/><ellipse cx="200" cy="130" rx="38" ry="10" fill="${white}" opacity=".8"/>
        <path d="M104 176q96 28 192 0M104 214q96 28 192 0" stroke="${dark}" stroke-width="5" fill="none" opacity=".5"/>`;
    case 'bolt':
      return `<polygon points="142,110 196,88 250,110 250,150 196,172 142,150" fill="${light}"/>
        <rect x="178" y="150" width="36" height="150" rx="6" fill="${mid}"/>
        ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="172" y="${176 + i * 20}" width="48" height="8" rx="3" fill="${dark}"/>`).join('')}`;
    case 'tap':
      return `<path d="M120 210v-62a64 64 0 0 1 128 0v30h-36v-30a28 28 0 0 0-56 0v62z" fill="${mid}"/>
        <rect x="104" y="204" width="64" height="30" rx="8" fill="${dark}"/><rect x="248" y="178" width="28" height="64" rx="10" fill="${dark}"/>
        <path d="M262 250q0 36 0 56" stroke="${light}" stroke-width="8" stroke-linecap="round"/><circle cx="262" cy="320" r="9" fill="${light}"/>`;
    default:
      return `<rect x="104" y="104" width="192" height="192" rx="28" fill="${mid}"/><rect x="132" y="132" width="136" height="136" rx="18" fill="${light}" opacity=".55"/>
        <circle cx="200" cy="200" r="36" fill="${white}" opacity=".9"/>`;
  }
}

/** 400×400 product artwork: tinted background and a pictogram drawn in the category colour. */
export function productSvg(shape: Shape, color: string, label: string): string {
  const bg1 = shade(color, 0.9);
  const bg2 = shade(color, 0.72);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${escapeXml(label)}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <circle cx="330" cy="70" r="90" fill="${shade(color, 0.6)}" opacity=".35"/><circle cx="60" cy="350" r="110" fill="${shade(color, 0.55)}" opacity=".3"/>
  <ellipse cx="200" cy="330" rx="104" ry="14" fill="#0f172a" opacity=".14"/>
  ${pictogram(shape, color)}
</svg>`;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** Round store logo with initials. */
export function logoSvg(name: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${escapeXml(name)} logo">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(color, 0.12)}"/><stop offset="1" stop-color="${shade(color, -0.2)}"/></linearGradient></defs>
  <rect width="200" height="200" rx="44" fill="url(#g)"/>
  <path d="M30 150h140" stroke="#fff" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"/>
  <text x="100" y="118" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="70" fill="#fff">${escapeXml(initials(name))}</text>
</svg>`;
}

/** Wide store banner (shown on the store page). */
export function bannerSvg(name: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320" role="img" aria-label="${escapeXml(name)} banner">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(color, -0.15)}"/><stop offset="1" stop-color="${shade(color, 0.1)}"/></linearGradient></defs>
  <rect width="1200" height="320" fill="url(#g)"/>
  ${Array.from({ length: 9 }, (_, i) => `<rect x="${-80 + i * 160}" y="-40" width="70" height="420" fill="#fff" opacity="${0.04 + (i % 3) * 0.02}" transform="rotate(18 ${i * 160} 160)"/>`).join('')}
  <circle cx="1040" cy="90" r="150" fill="#fff" opacity=".08"/><circle cx="160" cy="320" r="160" fill="#000" opacity=".08"/>
</svg>`;
}
