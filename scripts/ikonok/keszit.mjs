// A Windowsos tesztkörnyezet asztali ikonjai (scripts/ikonok/*.ico): egyszerű, egymástól jól megkülönböztethető jelek.
// Indító: zöld „lejátszás”, admin: arany fogaskerék, weboldal: kék földgömb; az iPhone-os változatok ugyanezek egy
// telefon keretében; a mappa: arany „T” a Tavern sötét színén. Újragenerálás: node scripts/ikonok/keszit.mjs
// (a sharp a projekt függősége). Az .ico PNG-képeket tartalmaz (Windows Vista óta támogatott).
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('./', import.meta.url));
const SIZES = [16, 24, 32, 48, 64, 128, 256];

const play = (c) => `<path d="M98 72 L196 128 L98 184 Z" fill="${c}" stroke="${c}" stroke-width="14" stroke-linejoin="round"/>`;
const gear = (c, cx = 128, cy = 128, r = 1) => {
  const teeth = Array.from({ length: 8 }, (_, i) => `<rect x="${cx - 15 * r}" y="${cy - 82 * r}" width="${30 * r}" height="${34 * r}" rx="${6 * r}" fill="${c}" transform="rotate(${i * 45} ${cx} ${cy})"/>`).join('');
  return `${teeth}<circle cx="${cx}" cy="${cy}" r="${58 * r}" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="${24 * r}" fill="var(--bg)"/>`;
};
const globe = (c, cx = 128, cy = 128, r = 1) => `<g fill="none" stroke="${c}" stroke-width="${14 * r}" stroke-linecap="round">
  <circle cx="${cx}" cy="${cy}" r="${70 * r}"/><ellipse cx="${cx}" cy="${cy}" rx="${30 * r}" ry="${70 * r}"/>
  <path d="M${cx - 70 * r} ${cy} H${cx + 70 * r} M${cx - 60 * r} ${cy - 36 * r} H${cx + 60 * r} M${cx - 60 * r} ${cy + 36 * r} H${cx + 60 * r}"/></g>`;
// telefon keret: a jel a kijelzőn, kisebbre véve
const phone = (fg, inner) => `<rect x="70" y="20" width="116" height="216" rx="26" fill="none" stroke="${fg}" stroke-width="14"/><rect x="108" y="36" width="40" height="9" rx="4.5" fill="${fg}"/>${inner}`;

const icon = (bg, body, fg = '#ffffff') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" style="--bg:${bg}">
  <rect x="8" y="8" width="240" height="240" rx="52" fill="${bg}"/>${body(fg).replace(/var\(--bg\)/g, bg)}</svg>`;

const ICONS = {
  indito: icon('#2f9e5b', (fg) => play(fg)),
  admin: icon('#e5b15d', (fg) => gear(fg), '#1d1517'),
  weboldal: icon('#2f6fd6', (fg) => globe(fg)),
  'admin-iphone': icon('#e5b15d', (fg) => phone(fg, gear(fg, 128, 140, 0.62)), '#1d1517'),
  'weboldal-iphone': icon('#2f6fd6', (fg) => phone(fg, globe(fg, 128, 140, 0.62))),
  mappa: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect x="8" y="8" width="240" height="240" rx="52" fill="#1d1517" stroke="#e5b15d" stroke-width="10"/>
    <path d="M58 62 H198 V98 H174 V88 H144 V196 H162 V214 H94 V196 H112 V88 H82 V98 H58 Z" fill="#e5b15d"/></svg>`,
};

// ICO: fejléc + könyvtár + PNG-adatok
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, o); head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(data.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map(p => p.data)]);
}

for (const [name, svg] of Object.entries(ICONS)) {
  const pngs = await Promise.all(SIZES.map(async (size) => ({ size, data: await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer() })));
  writeFileSync(`${DIR}${name}.ico`, ico(pngs));
  console.log(name);
}
