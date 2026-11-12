// A RAW (DNG) fotókból – pl. iPhone ProRAW – a beágyazott előnézeti JPEG kinyerése. A böngésző a DNG-t nem tudja
// megjeleníteni, de a fájlban mindig van egy (gyakran teljes méretű) hagyományos JPEG-előnézet. Ezt keressük meg:
// a fájlban lévő JPEG-ek közül a legnagyobb, a böngésző által is olvasható (alap vagy progresszív) változatot; a nyers
// képadat veszteségmentes JPEG-je (SOF3) kimarad. Az elforgatást a DNG fejlécéből (TIFF Orientation) olvassuk ki.
// Nincs benne böngészőfüggő kód (a teszt: dngPreview.test.mjs).

const READABLE_SOF = new Set([0xc0, 0xc1, 0xc2]); // alap, kiterjesztett, progresszív

export const isDng = (file) => /\.dng$/i.test(file?.name || '') || /dng/i.test(file?.type || '');

// A TIFF/DNG fejléc Orientation értéke (1 = álló, 3 = fejjel lefelé, 6 = 90°-kal jobbra, 8 = 90°-kal balra)
export function tiffOrientation(bytes) {
  if (bytes.length < 8) return 1;
  const le = bytes[0] === 0x49 && bytes[1] === 0x49;
  const be = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!le && !be) return 1;
  const u16 = (o) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
  const u32 = (o) => (le ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) + bytes[o + 3] * 0x1000000 : bytes[o] * 0x1000000 + ((bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]));
  const ifd = u32(4);
  if (ifd + 2 > bytes.length) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > bytes.length) break;
    if (u16(e) === 0x0112) { const v = u16(e + 8); return [1, 3, 6, 8].includes(v) ? v : 1; }
  }
  return 1;
}

// Egy JPEG a start helyen: { end, sof, width, height } vagy null
function readJpeg(bytes, start) {
  const n = bytes.length;
  let p = start + 2;
  let sof = 0, width = 0, height = 0;
  while (p + 4 <= n) {
    if (bytes[p] !== 0xff) return null;
    while (p < n && bytes[p] === 0xff) p++; // kitöltő FF-ek
    const m = bytes[p++];
    if (m === 0xd9) return { end: p, sof, width, height };
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) continue;
    if (p + 2 > n) return null;
    const len = (bytes[p] << 8) | bytes[p + 1];
    if (len < 2) return null;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && p + 7 <= n) {
      sof = m;
      height = (bytes[p + 3] << 8) | bytes[p + 4];
      width = (bytes[p + 5] << 8) | bytes[p + 6];
    }
    p += len;
    if (m === 0xda) {
      // tömörített képadat: a következő valódi jelzőig (FF után nem 00 és nem RSTn)
      while (p + 1 < n) {
        if (bytes[p] === 0xff) {
          const x = bytes[p + 1];
          if (x === 0x00 || (x >= 0xd0 && x <= 0xd7) || x === 0xff) { p += x === 0xff ? 1 : 2; continue; }
          break;
        }
        p++;
      }
      if (p + 1 >= n) return null;
    }
  }
  return null;
}

// A legnagyobb olvasható beágyazott JPEG: { start, end, width, height, orientation } vagy null
export function dngPreview(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let best = null;
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (bytes[i] !== 0xff || bytes[i + 1] !== 0xd8 || bytes[i + 2] !== 0xff) continue;
    const jpg = readJpeg(bytes, i);
    if (!jpg) continue;
    if (READABLE_SOF.has(jpg.sof) && jpg.width > 0 && jpg.height > 0 && (!best || jpg.width * jpg.height > best.width * best.height)) {
      best = { start: i, end: jpg.end, width: jpg.width, height: jpg.height };
    }
    i = jpg.end - 1; // a JPEG belsejében nem keresünk tovább
  }
  return best ? { ...best, orientation: tiffOrientation(bytes) } : null;
}
