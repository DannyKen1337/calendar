// A DNG (RAW) előnézet-kinyerés tesztje (futtatás: node --test weblap/lib/dngPreview.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { dngPreview, tiffOrientation, isDng } from './dngPreview.js';

// Egy kis „DNG”: TIFF fejléc (kis-endian) Orientation = 6 taggel, utána egy kis alap JPEG (bélyegkép), egy nagyobb
// alap JPEG (az előnézet), és egy veszteségmentes (SOF3) „nyers” JPEG, amelyet a böngésző nem tud olvasni
function tiff(orientation) {
  const b = Buffer.alloc(8 + 2 + 12 + 4);
  b.write('II', 0, 'latin1'); b.writeUInt16LE(42, 2); b.writeUInt32LE(8, 4);
  b.writeUInt16LE(1, 8);
  b.writeUInt16LE(0x0112, 10); b.writeUInt16LE(3, 12); b.writeUInt32LE(1, 14); b.writeUInt16LE(orientation, 18);
  return b;
}
function losslessJpeg() {
  // SOI, SOF3 (1000 × 800), SOS, adat (benne kitöltött FF 00), EOI
  const sof3 = Buffer.from([0xff, 0xc3, 0x00, 0x0b, 0x10, 0x03, 0x20, 0x03, 0xe8, 0x01, 0x01, 0x11, 0x00]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x01, 0x00, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof3, sos, Buffer.from([0x12, 0xff, 0x00, 0x34, 0x56]), Buffer.from([0xff, 0xd9])]);
}

test('a legnagyobb olvasható JPEG-előnézet és az elforgatás', async () => {
  const thumb = await sharp({ create: { width: 160, height: 120, channels: 3, background: '#f00' } }).jpeg().toBuffer();
  const preview = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#0f0' } }).jpeg().toBuffer();
  const file = Buffer.concat([tiff(6), Buffer.alloc(100), thumb, Buffer.alloc(50), losslessJpeg(), preview, Buffer.alloc(20)]);
  const p = dngPreview(file);
  assert.ok(p, 'talált előnézetet');
  assert.deepEqual([p.width, p.height, p.orientation], [1200, 900, 6]);
  const cut = file.subarray(p.start, p.end);
  const meta = await sharp(cut).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1200, 900], 'a kivágott rész maga az előnézet');
});

test('olvasható előnézet nélkül null; ismeretlen fejlécnél álló', () => {
  assert.equal(dngPreview(Buffer.concat([tiff(1), losslessJpeg()])), null);
  assert.equal(tiffOrientation(Buffer.from('nem tiff fájl')), 1);
  assert.equal(isDng({ name: 'IMG_8673.DNG' }), true);
  assert.equal(isDng({ name: 'IMG_1.jpg', type: 'image/jpeg' }), false);
});
