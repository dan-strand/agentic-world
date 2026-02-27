/**
 * Generate a 64x64 campfire sprite PNG.
 * Ring of gray stones, orange/red flames, warm glow halo, log/tinder shapes.
 * Uses the same pngjs pattern as other generation scripts.
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const SIZE = 64;

const png = new PNG({ width: SIZE, height: SIZE });

// Initialize to transparent
for (let i = 0; i < SIZE * SIZE * 4; i += 4) {
  png.data[i] = 0;
  png.data[i + 1] = 0;
  png.data[i + 2] = 0;
  png.data[i + 3] = 0;
}

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const idx = (y * SIZE + x) * 4;
  // Alpha blending for semi-transparent pixels
  if (a < 255 && png.data[idx + 3] > 0) {
    const srcA = a / 255;
    const dstA = png.data[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    png.data[idx] = Math.round((r * srcA + png.data[idx] * dstA * (1 - srcA)) / outA);
    png.data[idx + 1] = Math.round((g * srcA + png.data[idx + 1] * dstA * (1 - srcA)) / outA);
    png.data[idx + 2] = Math.round((b * srcA + png.data[idx + 2] * dstA * (1 - srcA)) / outA);
    png.data[idx + 3] = Math.round(outA * 255);
  } else {
    png.data[idx] = r;
    png.data[idx + 1] = g;
    png.data[idx + 2] = b;
    png.data[idx + 3] = a;
  }
}

function fillRect(x0, y0, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(x0 + dx, y0 + dy, r, g, b, a);
    }
  }
}

function drawCircle(cx, cy, radius, r, g, b, a = 255) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(cx + dx, cy + dy, r, g, b, a);
      }
    }
  }
}

const CX = 32;  // center X
const CY = 36;  // center Y (slightly below center for visual balance)

// 1. Warm glow halo (semi-transparent orange, widest layer)
for (let dy = -18; dy <= 18; dy++) {
  for (let dx = -18; dx <= 18; dx++) {
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 18 && dist > 8) {
      const alpha = Math.floor(40 * (1 - (dist - 8) / 10));
      if (alpha > 0) setPixel(CX + dx, CY + dy - 4, 255, 160, 40, alpha);
    }
  }
}

// 2. Inner glow (brighter, closer)
for (let dy = -10; dy <= 10; dy++) {
  for (let dx = -10; dx <= 10; dx++) {
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 10 && dist > 4) {
      const alpha = Math.floor(60 * (1 - (dist - 4) / 6));
      if (alpha > 0) setPixel(CX + dx, CY + dy - 4, 255, 180, 60, alpha);
    }
  }
}

// 3. Ring of stones (8 stones in a circle, radius ~14)
const stoneCount = 8;
const stoneRadius = 14;
for (let i = 0; i < stoneCount; i++) {
  const angle = (i / stoneCount) * Math.PI * 2 - Math.PI / 2;
  const sx = CX + Math.round(Math.cos(angle) * stoneRadius);
  const sy = CY + Math.round(Math.sin(angle) * stoneRadius * 0.7); // slight vertical squish for perspective
  const stoneSize = 3 + (i % 2);
  // Stone body
  drawCircle(sx, sy, stoneSize, 100, 95, 85);
  // Stone highlight (top)
  drawCircle(sx, sy - 1, stoneSize - 1, 120, 115, 105);
  // Stone shadow (bottom)
  for (let dx = -stoneSize; dx <= stoneSize; dx++) {
    setPixel(sx + dx, sy + stoneSize, 70, 65, 55, 120);
  }
}

// 4. Logs beneath the flames (small crossing logs)
// Log 1: angled left-to-right
for (let i = -8; i <= 8; i++) {
  const lx = CX + i;
  const ly = CY + 4 + Math.floor(i * 0.3);
  setPixel(lx, ly, 90, 55, 25);
  setPixel(lx, ly + 1, 80, 48, 20);
  setPixel(lx, ly + 2, 70, 42, 18);
}
// Log 2: angled opposite
for (let i = -6; i <= 6; i++) {
  const lx = CX + i;
  const ly = CY + 5 - Math.floor(i * 0.4);
  setPixel(lx, ly, 95, 60, 28);
  setPixel(lx, ly + 1, 85, 52, 22);
}
// Log 3: small vertical-ish
for (let i = -3; i <= 3; i++) {
  setPixel(CX - 3, CY + 2 + i, 85, 50, 22);
  setPixel(CX - 2, CY + 2 + i, 75, 45, 18);
}

// 5. Embers/char base (dark red-orange glow at the base)
for (let dy = -2; dy <= 3; dy++) {
  for (let dx = -5; dx <= 5; dx++) {
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 5) {
      setPixel(CX + dx, CY + 1 + dy, 180, 60, 20, 180);
    }
  }
}

// 6. Main flame shapes (orange/red, ~20px tall)
// Central flame (tallest)
for (let row = 0; row < 20; row++) {
  const t = row / 20;
  const halfW = Math.floor(6 * (1 - t * 0.8));
  const r = Math.floor(255 - t * 60);
  const g = Math.floor(200 * (1 - t * 0.7));
  const b = Math.floor(30 + t * 20);
  const alpha = Math.floor(255 - t * 80);
  for (let dx = -halfW; dx <= halfW; dx++) {
    setPixel(CX + dx, CY - row, r, g, b, alpha);
  }
}

// Left flame (shorter, offset)
for (let row = 0; row < 14; row++) {
  const t = row / 14;
  const halfW = Math.floor(4 * (1 - t * 0.7));
  const r = Math.floor(240 - t * 40);
  const g = Math.floor(140 * (1 - t * 0.6));
  const b = Math.floor(20 + t * 30);
  const alpha = Math.floor(230 - t * 80);
  for (let dx = -halfW; dx <= halfW; dx++) {
    setPixel(CX - 4 + dx, CY - 1 - row, r, g, b, alpha);
  }
}

// Right flame (shorter, offset)
for (let row = 0; row < 12; row++) {
  const t = row / 12;
  const halfW = Math.floor(3 * (1 - t * 0.7));
  const r = Math.floor(250 - t * 50);
  const g = Math.floor(160 * (1 - t * 0.5));
  const b = Math.floor(15 + t * 25);
  const alpha = Math.floor(220 - t * 70);
  for (let dx = -halfW; dx <= halfW; dx++) {
    setPixel(CX + 5 + dx, CY - 2 - row, r, g, b, alpha);
  }
}

// 7. Bright core (yellow-white at flame base)
for (let dy = -2; dy <= 2; dy++) {
  for (let dx = -3; dx <= 3; dx++) {
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 3) {
      setPixel(CX + dx, CY - 4 + dy, 255, 240, 180, 200);
    }
  }
}

// 8. Spark particles above flames
const sparks = [
  [CX - 2, CY - 22], [CX + 3, CY - 24], [CX - 5, CY - 18],
  [CX + 6, CY - 16], [CX + 1, CY - 26], [CX - 3, CY - 14],
];
sparks.forEach(([sx, sy]) => {
  setPixel(sx, sy, 255, 200, 80, 200);
  setPixel(sx + 1, sy, 255, 180, 60, 120);
});

// Write PNG
const outPath = path.resolve(__dirname, '..', 'assets', 'sprites', 'campfire.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(outPath, buffer);
console.log(`Generated ${outPath} (${buffer.length} bytes, ${SIZE}x${SIZE})`);
