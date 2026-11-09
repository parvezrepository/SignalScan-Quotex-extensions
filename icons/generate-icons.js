/**
 * SignalScan - Pure Node.js PNG Icon Generator
 * Generates sleek glass & neon icons (16, 32, 48, 128px) without external dependencies using built-in zlib.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4);
  data.copy(buf, 8);
  const crcTarget = Buffer.concat([Buffer.from(type), data]);
  buf.writeUInt32BE(crc32(crcTarget), 8 + len);
  return buf;
}

/**
 * Render RGBA pixels for SignalScan icon at size NxN
 */
function renderIconPixels(size) {
  const img = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // Dark glass background with slight gradient
        const grad = 1 - (y / size) * 0.35;
        let rVal = Math.round(10 * grad);
        let gVal = Math.round(14 * grad);
        let bVal = Math.round(20 * grad);
        let aVal = 245;

        // Border ring
        if (dist >= r - 1.5) {
          rVal = 0;
          gVal = 255;
          bVal = 157;
          aVal = 220;
        }

        // Inner glowing reticle / up chevron
        const relX = (x - cx) / r;
        const relY = (y - cy) / r;

        // Up arrow shape
        const inArrowHead = relY < 0.2 && relY > -0.55 && Math.abs(relX) < (0.25 - relY * 0.5);
        const inArrowStem = relY >= 0.15 && relY < 0.55 && Math.abs(relX) < 0.16;

        if (inArrowHead || inArrowStem) {
          rVal = 0;
          gVal = 255;
          bVal = 157;
          aVal = 255;
        } else if (dist < r * 0.7 && Math.abs(relY) < 0.08) {
          // Horizontal scan beam
          rVal = 0;
          gVal = 255;
          bVal = 157;
          aVal = 120;
        }

        img[idx] = rVal;
        img[idx + 1] = gVal;
        img[idx + 2] = bVal;
        img[idx + 3] = aVal;
      } else {
        // Transparent outside circle
        img[idx] = 0;
        img[idx + 1] = 0;
        img[idx + 2] = 0;
        img[idx + 3] = 0;
      }
    }
  }

  return img;
}

/**
 * Generate a valid PNG buffer from RGBA pixels
 */
function makePNG(size) {
  const rawData = renderIconPixels(size);
  const rowSize = size * 4;
  const filtered = Buffer.alloc(size * (rowSize + 1));

  for (let y = 0; y < size; y++) {
    filtered[y * (rowSize + 1)] = 0; // Filter type 0 (None)
    rawData.copy(filtered, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }

  const deflated = zlib.deflateSync(filtered, { level: 9 });

  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', deflated);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

[16, 32, 48, 128].forEach((size) => {
  const png = makePNG(size);
  const outPath = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated icon: ${outPath} (${size}x${size}, ${png.length} bytes)`);
});

