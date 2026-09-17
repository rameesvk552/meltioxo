import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const projection = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + projection * dx), py - (y1 + projection * dy));
}

function renderIcon(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 512;
  const inset = maskable ? 0 : 36 * scale;
  const corner = (maskable ? 0 : 116) * scale;
  const segments = [[132, 174, 202, 344], [202, 344, 256, 218], [256, 218, 310, 344], [310, 344, 380, 174]];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let inside = true;
      if (!maskable) {
        const cx = Math.max(inset + corner, Math.min(x, size - inset - corner));
        const cy = Math.max(inset + corner, Math.min(y, size - inset - corner));
        inside = Math.hypot(x - cx, y - cy) <= corner;
      }

      let color = inside ? [181, 66, 48, 255] : [0, 0, 0, 0];
      const unitX = x / scale;
      const unitY = y / scale;
      const onStroke = segments.some(([x1, y1, x2, y2]) => segmentDistance(unitX, unitY, x1, y1, x2, y2) <= 22);
      if (inside && onStroke) color = [255, 255, 255, 255];
      if (inside && Math.hypot(unitX - 378, unitY - 140) <= 28) color = [247, 196, 184, 255];

      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    scanlines[rowOffset] = 0;
    pixels.copy(scanlines, rowOffset + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const publicDirectory = resolve(import.meta.dirname, '..', 'public');
writeFileSync(resolve(publicDirectory, 'pwa-192x192.png'), renderIcon(192, false));
writeFileSync(resolve(publicDirectory, 'pwa-512x512.png'), renderIcon(512, false));
writeFileSync(resolve(publicDirectory, 'pwa-maskable-512x512.png'), renderIcon(512, true));

console.log('Generated Wayon PWA icons in public/.');
