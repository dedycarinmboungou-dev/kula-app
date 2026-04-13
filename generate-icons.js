/**
 * Generates icon-192.png and icon-512.png for Kula PWA.
 * Kula brand: dark green bg (#064E3B), white plant silhouette.
 * No external dependencies — pure Node.js + built-in zlib.
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([t, data]);
  return Buffer.concat([u32(data.length), t, data, u32(crc32(crcBuf))]);
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────
const BG     = [6,   78,  59];   // #064E3B
const ACCENT = [16,  185, 129];  // #10B981
const WHITE  = [255, 255, 255];

// Smooth circle mask (anti-aliased via subpixel sampling)
function inCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return (dx * dx + dy * dy) <= r * r;
}

// ── Draw one icon size ────────────────────────────────────────────────────────
function makeIcon(size) {
  const S   = size;
  const mid = S / 2;

  // Rounded-square mask for background (corner radius = 22% of size)
  const rCorner = S * 0.22;
  function inRoundedSquare(x, y) {
    const cx = Math.max(rCorner, Math.min(S - rCorner, x));
    const cy = Math.max(rCorner, Math.min(S - rCorner, y));
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rCorner * rCorner;
  }

  // Plant drawing parameters (all relative to S)
  const stemW  = S * 0.055;   // half-width of stem
  const stemT  = mid + S * 0.03;  // stem top Y
  const stemB  = mid + S * 0.33;  // stem bottom Y
  const leafR  = S * 0.21;        // radius of each leaf lobe
  // Left lobe centre
  const llX = mid - S * 0.12, llY = mid - S * 0.07;
  // Right lobe centre
  const rlX = mid + S * 0.12, rlY = mid - S * 0.16;
  // Extra small top bud
  const budX = mid, budY = mid - S * 0.26, budR = S * 0.10;

  const rows = [];
  for (let y = 0; y < S; y++) {
    const row = [0]; // PNG filter byte: None
    for (let x = 0; x < S; x++) {
      // Outer background is always BG
      if (!inRoundedSquare(x, y)) {
        row.push(...BG);
        continue;
      }

      // Inner accent circle (soft glow, ~50% radius)
      const accentR = S * 0.46;
      if (inCircle(x, y, mid, mid, accentR)) {
        // Is this pixel part of the plant (white)?
        const inStem  = x >= mid - stemW && x <= mid + stemW && y >= stemT && y <= stemB;
        const inLeftL = inCircle(x, y, llX, llY, leafR);
        const inRightL = inCircle(x, y, rlX, rlY, leafR);
        const inBud   = inCircle(x, y, budX, budY, budR);

        if (inStem || inLeftL || inRightL || inBud) {
          row.push(...WHITE);
        } else {
          row.push(...ACCENT);
        }
      } else {
        row.push(...BG);
      }
    }
    rows.push(Buffer.from(row));
  }

  const raw        = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig      = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.concat([u32(S), u32(S), Buffer.from([8, 2, 0, 0, 0])]);
  const ihdr     = chunk('IHDR', ihdrData);
  const idat     = chunk('IDAT', compressed);
  const iend     = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ── Write both sizes ──────────────────────────────────────────────────────────
const outDir = path.join(__dirname, 'public');

for (const size of [192, 512]) {
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, makeIcon(size));
  console.log(`  ✓ ${outPath}`);
}
console.log('Icons generated successfully.');
