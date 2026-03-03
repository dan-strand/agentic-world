/**
 * Generate the scenery sprite atlas PNG with outdoor elements:
 *   pine_tree, oak_tree, bush_large, bush_small, flowers_red, flowers_blue,
 *   barrel, crate, well, signpost, fence_h, fence_v, lantern, torch,
 *   pond_tile, market_stall.
 *
 * Uses the same pngjs pipeline as generate-tiles.js and generate-campfire.js.
 * Each sprite has transparent background and uses pixel art style.
 *
 * Run: node scripts/generate-scenery.js
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

// ── Sprite Definitions ──────────────────────────────────────────────────────
// Each sprite: { name, w, h } -- packed into rows for the atlas
const SPRITES = [
  // Row 0: Trees and bushes
  { name: 'pine_tree',   w: 32, h: 48 },
  { name: 'oak_tree',    w: 40, h: 48 },
  { name: 'bush_large',  w: 24, h: 16 },
  { name: 'bush_small',  w: 16, h: 12 },
  { name: 'flowers_red', w: 16, h: 16 },
  { name: 'flowers_blue',w: 16, h: 16 },
  // Row 1: Village props
  { name: 'barrel',      w: 16, h: 20 },
  { name: 'crate',       w: 16, h: 16 },
  { name: 'well',        w: 24, h: 24 },
  { name: 'signpost',    w: 12, h: 24 },
  { name: 'fence_h',     w: 32, h: 8 },
  { name: 'fence_v',     w: 8,  h: 32 },
  // Row 2: Lighting, water, market
  { name: 'lantern',     w: 12, h: 20 },
  { name: 'torch',       w: 8,  h: 20 },
  { name: 'pond_tile',   w: 32, h: 32 },
  { name: 'market_stall',w: 32, h: 24 },
];

// ── Atlas Layout ────────────────────────────────────────────────────────────
// Pack sprites into rows. Row height = max sprite height in that row.
const ROW_GROUPS = [
  SPRITES.slice(0, 6),   // Row 0: trees + bushes + flowers
  SPRITES.slice(6, 12),  // Row 1: props + fences
  SPRITES.slice(12, 16), // Row 2: lantern + torch + pond + market
];

// Compute atlas dimensions and assign frame positions
const frames = {};
let atlasWidth = 0;
let atlasHeight = 0;
let currentY = 0;

for (const rowSprites of ROW_GROUPS) {
  let rowWidth = 0;
  let rowHeight = 0;
  for (const sp of rowSprites) {
    rowWidth += sp.w;
    rowHeight = Math.max(rowHeight, sp.h);
  }
  atlasWidth = Math.max(atlasWidth, rowWidth);

  let currentX = 0;
  for (const sp of rowSprites) {
    frames[sp.name] = { x: currentX, y: currentY, w: sp.w, h: sp.h };
    currentX += sp.w;
  }
  currentY += rowHeight;
  atlasHeight = currentY;
}

console.log(`Atlas size: ${atlasWidth}x${atlasHeight}`);

const png = new PNG({ width: atlasWidth, height: atlasHeight });

// Initialize to transparent
for (let i = 0; i < atlasWidth * atlasHeight * 4; i += 4) {
  png.data[i] = 0;
  png.data[i + 1] = 0;
  png.data[i + 2] = 0;
  png.data[i + 3] = 0;
}

// ── Drawing Helpers ─────────────────────────────────────────────────────────
function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= atlasWidth || y < 0 || y >= atlasHeight) return;
  const idx = (y * atlasWidth + x) * 4;
  if (a < 255 && png.data[idx + 3] > 0) {
    // Alpha blending
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

function fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.0) {
        setPixel(cx + dx, cy + dy, r, g, b, a);
      }
    }
  }
}

function fillCircle(cx, cy, radius, r, g, b, a = 255) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(cx + dx, cy + dy, r, g, b, a);
      }
    }
  }
}

// ── Sprite Drawing Functions ────────────────────────────────────────────────

function drawPineTree(ox, oy) {
  // ox, oy = top-left of 32x48 cell
  const cx = ox + 16; // center x

  // Trunk (brown, 4px wide, bottom 12px)
  fillRect(cx - 2, oy + 36, 4, 12, 100, 70, 30);

  // Triangular canopy layers (3 triangular sections for pine shape)
  // Top layer (small)
  for (let row = 0; row < 10; row++) {
    const halfW = Math.floor(row * 0.8);
    for (let dx = -halfW; dx <= halfW; dx++) {
      const shade = dx < 0 ? 20 : -10; // left highlight, right shadow
      setPixel(cx + dx, oy + 4 + row, 40 + shade, 110 + shade, 30 + shade);
    }
  }
  // Middle layer (medium)
  for (let row = 0; row < 12; row++) {
    const halfW = Math.floor(row * 1.0) + 2;
    for (let dx = -halfW; dx <= halfW; dx++) {
      const shade = dx < 0 ? 15 : -15;
      setPixel(cx + dx, oy + 12 + row, 35 + shade, 100 + shade, 25 + shade);
    }
  }
  // Bottom layer (widest)
  for (let row = 0; row < 14; row++) {
    const halfW = Math.floor(row * 1.0) + 4;
    for (let dx = -halfW; dx <= halfW; dx++) {
      const shade = dx < 0 ? 10 : -20;
      setPixel(cx + dx, oy + 22 + row, 30 + shade, 90 + shade, 20 + shade);
    }
  }

  // Snow/highlight dots on top-left
  setPixel(cx - 2, oy + 8, 80, 160, 70);
  setPixel(cx - 4, oy + 16, 75, 150, 65);
  setPixel(cx - 6, oy + 26, 70, 140, 60);
}

function drawOakTree(ox, oy) {
  // ox, oy = top-left of 40x48 cell
  const cx = ox + 20;

  // Trunk (brown, 6px wide, bottom 14px)
  fillRect(cx - 3, oy + 34, 6, 14, 110, 75, 35);
  // Trunk highlight
  fillRect(cx - 3, oy + 34, 2, 14, 125, 90, 45);

  // Round canopy - main mass
  fillEllipse(cx, oy + 20, 16, 16, 50, 120, 40);

  // Lighter leaf clusters (top-left highlight)
  fillEllipse(cx - 5, oy + 14, 8, 8, 65, 145, 55);
  fillEllipse(cx + 6, oy + 16, 6, 7, 55, 130, 45);

  // Dark shadow clusters (bottom-right)
  fillEllipse(cx + 4, oy + 26, 7, 5, 35, 90, 28);
  fillEllipse(cx - 8, oy + 24, 5, 4, 40, 95, 32);

  // Scattered leaf texture dots
  const leafDots = [
    [-10, 12, 70, 155, 60], [-6, 8, 75, 160, 65], [2, 6, 68, 150, 58],
    [8, 10, 60, 140, 50], [-3, 18, 42, 100, 35], [10, 22, 38, 85, 30],
    [-12, 20, 55, 125, 45], [6, 28, 40, 95, 32], [-8, 28, 45, 100, 35],
  ];
  for (const [dx, dy, r, g, b] of leafDots) {
    setPixel(cx + dx, oy + dy, r, g, b);
  }
}

function drawBushLarge(ox, oy) {
  // 24x16 dense bush with berries
  const cx = ox + 12;
  const cy = oy + 10;

  // Main bush shape - wider ellipse
  fillEllipse(cx, cy, 10, 6, 45, 110, 35);
  // Lighter top
  fillEllipse(cx - 2, cy - 2, 7, 4, 55, 130, 45);
  // Darker bottom
  fillEllipse(cx + 2, cy + 2, 6, 3, 35, 85, 25);

  // Berry dots (red/purple) on top
  setPixel(cx - 4, cy - 3, 180, 40, 50);
  setPixel(cx + 2, cy - 2, 160, 30, 80);
  setPixel(cx + 5, cy - 1, 170, 45, 55);
  setPixel(cx - 1, cy - 4, 150, 35, 90);
}

function drawBushSmall(ox, oy) {
  // 16x12 small simple bush
  const cx = ox + 8;
  const cy = oy + 7;

  fillEllipse(cx, cy, 6, 4, 50, 115, 40);
  fillEllipse(cx - 1, cy - 1, 4, 3, 60, 135, 50);
  // Dark accent
  setPixel(cx + 3, cy + 2, 35, 85, 25);
  setPixel(cx - 4, cy + 1, 38, 90, 28);
}

function drawFlowersRed(ox, oy) {
  // 16x16 cluster of 4 red flowers on green stems
  const flowerPositions = [
    { fx: ox + 3, fy: oy + 4 },
    { fx: ox + 8, fy: oy + 3 },
    { fx: ox + 12, fy: oy + 5 },
    { fx: ox + 6, fy: oy + 7 },
  ];
  for (const { fx, fy } of flowerPositions) {
    // Green stem
    setPixel(fx, fy + 3, 50, 130, 40);
    setPixel(fx, fy + 4, 50, 130, 40);
    setPixel(fx, fy + 5, 45, 120, 35);
    setPixel(fx, fy + 6, 45, 120, 35);
    // Leaf
    setPixel(fx - 1, fy + 4, 55, 140, 45);
    // Red petals (2x2 + center)
    setPixel(fx, fy, 200, 40, 40);
    setPixel(fx + 1, fy, 210, 50, 50);
    setPixel(fx, fy + 1, 190, 35, 35);
    setPixel(fx + 1, fy + 1, 220, 60, 50);
    // Yellow center
    setPixel(fx, fy + 1, 220, 180, 50);
  }
}

function drawFlowersBlue(ox, oy) {
  // 16x16 cluster of 4 blue/purple flowers on green stems
  const flowerPositions = [
    { fx: ox + 4, fy: oy + 3 },
    { fx: ox + 10, fy: oy + 4 },
    { fx: ox + 7, fy: oy + 6 },
    { fx: ox + 2, fy: oy + 7 },
  ];
  for (const { fx, fy } of flowerPositions) {
    // Green stem
    setPixel(fx, fy + 3, 50, 130, 40);
    setPixel(fx, fy + 4, 50, 130, 40);
    setPixel(fx, fy + 5, 45, 120, 35);
    setPixel(fx, fy + 6, 45, 120, 35);
    // Leaf
    setPixel(fx + 1, fy + 4, 55, 140, 45);
    // Blue/purple petals
    setPixel(fx, fy, 80, 60, 200);
    setPixel(fx + 1, fy, 100, 70, 220);
    setPixel(fx, fy + 1, 70, 50, 190);
    setPixel(fx + 1, fy + 1, 110, 80, 210);
    // Light center
    setPixel(fx, fy + 1, 180, 180, 240);
  }
}

function drawBarrel(ox, oy) {
  // 16x20 wooden barrel
  const cx = ox + 8;

  // Barrel body (brown staves)
  for (let row = 0; row < 20; row++) {
    // Barrel shape: wider in middle
    const t = row / 19;
    const halfW = Math.floor(5 + 3 * Math.sin(t * Math.PI));
    for (let dx = -halfW; dx <= halfW; dx++) {
      const shade = dx < 0 ? 10 : -10;
      setPixel(cx + dx, oy + row, 130 + shade, 90 + shade, 40 + shade);
    }
  }

  // Metal bands (lighter tan/gray at 1/3 and 2/3 height)
  for (const bandY of [6, 13]) {
    const t = bandY / 19;
    const halfW = Math.floor(5 + 3 * Math.sin(t * Math.PI));
    for (let dx = -halfW; dx <= halfW; dx++) {
      setPixel(cx + dx, oy + bandY, 170, 160, 130);
      setPixel(cx + dx, oy + bandY + 1, 160, 150, 120);
    }
  }

  // Top oval visible (lighter)
  fillEllipse(cx, oy + 2, 6, 2, 155, 115, 60);
  // Dark stave lines
  for (const sx of [-3, 0, 3]) {
    for (let row = 3; row < 19; row++) {
      setPixel(cx + sx, oy + row, 100, 65, 25);
    }
  }
}

function drawCrate(ox, oy) {
  // 16x16 wooden crate
  fillRect(ox + 1, oy + 1, 14, 14, 140, 100, 50);

  // Outline
  fillRect(ox, oy, 16, 1, 100, 70, 30);      // top
  fillRect(ox, oy + 15, 16, 1, 100, 70, 30);  // bottom
  fillRect(ox, oy, 1, 16, 100, 70, 30);        // left
  fillRect(ox + 15, oy, 1, 16, 100, 70, 30);   // right

  // X cross-board pattern on top
  for (let i = 0; i < 14; i++) {
    setPixel(ox + 1 + i, oy + 1 + i, 110, 75, 35);
    setPixel(ox + 14 - i, oy + 1 + i, 110, 75, 35);
  }

  // Corner nails
  setPixel(ox + 2, oy + 2, 180, 170, 150);
  setPixel(ox + 13, oy + 2, 180, 170, 150);
  setPixel(ox + 2, oy + 13, 180, 170, 150);
  setPixel(ox + 13, oy + 13, 180, 170, 150);
}

function drawWell(ox, oy) {
  // 24x24 stone well with water center
  const cx = ox + 12;
  const cy = oy + 14;

  // Stone ring (gray elliptical ring)
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      const distOuter = (dx * dx) / (10 * 10) + (dy * dy) / (8 * 8);
      const distInner = (dx * dx) / (6 * 6) + (dy * dy) / (5 * 5);
      if (distOuter <= 1.0 && distInner > 1.0) {
        const shade = (dx + dy < 0) ? 15 : -15;
        setPixel(cx + dx, cy + dy, 130 + shade, 130 + shade, 135 + shade);
      }
    }
  }

  // Dark blue water center
  fillEllipse(cx, cy, 5, 4, 30, 60, 120);
  // Lighter water highlight
  setPixel(cx - 1, cy - 1, 50, 90, 160);
  setPixel(cx, cy - 2, 60, 100, 170);

  // Wooden post on right side
  fillRect(ox + 19, oy + 2, 2, 12, 110, 75, 35);
  // Small roof on post
  fillRect(ox + 17, oy + 1, 6, 2, 120, 80, 40);
  fillRect(ox + 18, oy, 4, 1, 130, 85, 45);

  // Rope hint
  setPixel(ox + 20, oy + 13, 160, 140, 100);
  setPixel(cx + 1, cy - 3, 160, 140, 100);

  // Stone texture dots
  setPixel(cx - 8, cy - 2, 150, 150, 155);
  setPixel(cx + 7, cy + 1, 110, 110, 115);
  setPixel(cx - 3, cy + 6, 120, 120, 125);
}

function drawSignpost(ox, oy) {
  // 12x24 thin post with sign plate
  const cx = ox + 6;

  // Brown post (2px wide, full height except top)
  fillRect(cx - 1, oy + 6, 2, 18, 110, 75, 35);
  // Post base wider
  fillRect(cx - 2, oy + 22, 4, 2, 100, 65, 30);

  // Sign plate at top (tan/beige rectangle pointing right)
  fillRect(cx - 1, oy + 3, 6, 5, 190, 170, 120);
  // Darker outline on sign
  fillRect(cx - 1, oy + 2, 6, 1, 150, 130, 90);
  fillRect(cx - 1, oy + 8, 6, 1, 150, 130, 90);
  // Arrow point on right
  setPixel(cx + 5, oy + 4, 190, 170, 120);
  setPixel(cx + 5, oy + 6, 190, 170, 120);

  // Post top cap
  fillRect(cx - 2, oy + 5, 4, 1, 130, 90, 45);
}

function drawFenceH(ox, oy) {
  // 32x8 horizontal fence segment
  // Two horizontal rails
  fillRect(ox, oy + 1, 32, 2, 120, 85, 40);
  fillRect(ox, oy + 5, 32, 2, 120, 85, 40);

  // 3 vertical posts (darker)
  fillRect(ox + 2, oy, 3, 8, 100, 65, 30);
  fillRect(ox + 14, oy, 3, 8, 100, 65, 30);
  fillRect(ox + 27, oy, 3, 8, 100, 65, 30);

  // Highlight on rails (top edge)
  fillRect(ox, oy + 1, 32, 1, 140, 100, 55);
  fillRect(ox, oy + 5, 32, 1, 140, 100, 55);
}

function drawFenceV(ox, oy) {
  // 8x32 vertical fence segment
  // Two vertical rails
  fillRect(ox + 1, oy, 2, 32, 120, 85, 40);
  fillRect(ox + 5, oy, 2, 32, 120, 85, 40);

  // 3 horizontal posts (darker)
  fillRect(ox, oy + 2, 8, 3, 100, 65, 30);
  fillRect(ox, oy + 14, 8, 3, 100, 65, 30);
  fillRect(ox, oy + 27, 8, 3, 100, 65, 30);

  // Highlight on rails (left edge)
  fillRect(ox + 1, oy, 1, 32, 140, 100, 55);
  fillRect(ox + 5, oy, 1, 32, 140, 100, 55);
}

function drawLantern(ox, oy) {
  // 12x20 street lamp with glow
  const cx = ox + 6;

  // Glow halo (semi-transparent warm yellow around top)
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 5 && dist > 2) {
        const alpha = Math.floor(60 * (1 - (dist - 2) / 3));
        if (alpha > 0) setPixel(cx + dx, oy + 3 + dy, 255, 200, 80, alpha);
      }
    }
  }

  // Thin dark post (2px wide)
  fillRect(cx - 1, oy + 6, 2, 14, 60, 60, 70);
  // Post base
  fillRect(cx - 2, oy + 18, 4, 2, 70, 70, 80);

  // Glass enclosure at top (3x4)
  fillRect(cx - 1, oy + 2, 3, 4, 80, 80, 90);
  // Warm light inside
  setPixel(cx, oy + 3, 255, 220, 100);
  setPixel(cx, oy + 4, 255, 200, 80);

  // Top cap
  fillRect(cx - 2, oy + 1, 5, 1, 70, 70, 80);
  setPixel(cx, oy, 80, 80, 90);
}

function drawTorch(ox, oy) {
  // 8x20 wall torch with flame
  const cx = ox + 4;

  // Brown stick
  fillRect(cx - 1, oy + 6, 2, 14, 110, 75, 35);

  // Orange flame tip (3-4px)
  setPixel(cx, oy + 2, 255, 200, 50);     // bright center
  setPixel(cx, oy + 3, 255, 160, 40);
  setPixel(cx - 1, oy + 3, 255, 130, 30);
  setPixel(cx + 1, oy + 3, 255, 130, 30);
  setPixel(cx, oy + 4, 240, 100, 20);
  setPixel(cx - 1, oy + 5, 200, 80, 15);
  setPixel(cx + 1, oy + 5, 200, 80, 15);
  setPixel(cx, oy + 5, 220, 120, 25);

  // Flame tip
  setPixel(cx, oy + 1, 255, 240, 100);

  // Tiny glow
  setPixel(cx - 1, oy + 2, 255, 180, 60, 80);
  setPixel(cx + 1, oy + 2, 255, 180, 60, 80);
}

function drawPondTile(ox, oy) {
  // 32x32 water tile for pond construction
  // Dark blue base
  fillRect(ox, oy, 32, 32, 30, 60, 120);

  // Slightly lighter edges for natural blending
  for (let i = 0; i < 32; i++) {
    setPixel(ox + i, oy, 40, 75, 140);
    setPixel(ox + i, oy + 31, 40, 75, 140);
    setPixel(ox, oy + i, 40, 75, 140);
    setPixel(ox + 31, oy + i, 40, 75, 140);
  }

  // Wave ripple highlights (lighter blue horizontal streaks)
  const ripples = [
    { y: 6, x: 4, len: 8 },
    { y: 12, x: 10, len: 12 },
    { y: 18, x: 2, len: 10 },
    { y: 24, x: 14, len: 9 },
  ];
  for (const rip of ripples) {
    for (let dx = 0; dx < rip.len; dx++) {
      setPixel(ox + rip.x + dx, oy + rip.y, 50, 100, 170);
    }
    // Subtle highlight dot
    setPixel(ox + rip.x + Math.floor(rip.len / 2), oy + rip.y - 1, 70, 130, 200);
  }

  // Specular highlights
  setPixel(ox + 8, oy + 10, 100, 160, 220);
  setPixel(ox + 20, oy + 16, 90, 150, 210);
  setPixel(ox + 15, oy + 22, 95, 155, 215);
}

function drawMarketStall(ox, oy) {
  // 32x24 market awning with wooden counter
  // Wooden counter (bottom half)
  fillRect(ox + 2, oy + 14, 28, 10, 130, 90, 45);
  // Counter top edge (lighter)
  fillRect(ox + 2, oy + 14, 28, 2, 150, 110, 60);
  // Counter legs
  fillRect(ox + 3, oy + 20, 2, 4, 100, 65, 30);
  fillRect(ox + 27, oy + 20, 2, 4, 100, 65, 30);

  // Striped canvas awning (top portion)
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 32; col++) {
      // Alternate red and tan stripes (4px wide each)
      const stripe = Math.floor(col / 4) % 2;
      if (stripe === 0) {
        setPixel(ox + col, oy + row, 180, 50, 40); // red
      } else {
        setPixel(ox + col, oy + row, 200, 180, 130); // tan
      }
    }
  }

  // Awning scalloped bottom edge
  for (let i = 0; i < 32; i += 4) {
    setPixel(ox + i + 1, oy + 13, 0, 0, 0, 0); // transparent gaps for scallop
    setPixel(ox + i + 2, oy + 13, 0, 0, 0, 0);
  }

  // Shadow under awning
  fillRect(ox + 2, oy + 13, 28, 1, 80, 50, 25, 120);

  // Small goods on counter (colored dots)
  setPixel(ox + 8, oy + 15, 200, 180, 60);   // gold item
  setPixel(ox + 9, oy + 15, 200, 180, 60);
  setPixel(ox + 14, oy + 15, 180, 60, 60);   // red item
  setPixel(ox + 20, oy + 15, 80, 160, 80);   // green item
  setPixel(ox + 21, oy + 15, 80, 160, 80);

  // Support poles on each side
  fillRect(ox, oy, 2, 24, 100, 65, 30);
  fillRect(ox + 30, oy, 2, 24, 100, 65, 30);
}

// ── Draw All Sprites ────────────────────────────────────────────────────────
for (const sprite of SPRITES) {
  const f = frames[sprite.name];
  switch (sprite.name) {
    case 'pine_tree':    drawPineTree(f.x, f.y); break;
    case 'oak_tree':     drawOakTree(f.x, f.y); break;
    case 'bush_large':   drawBushLarge(f.x, f.y); break;
    case 'bush_small':   drawBushSmall(f.x, f.y); break;
    case 'flowers_red':  drawFlowersRed(f.x, f.y); break;
    case 'flowers_blue': drawFlowersBlue(f.x, f.y); break;
    case 'barrel':       drawBarrel(f.x, f.y); break;
    case 'crate':        drawCrate(f.x, f.y); break;
    case 'well':         drawWell(f.x, f.y); break;
    case 'signpost':     drawSignpost(f.x, f.y); break;
    case 'fence_h':      drawFenceH(f.x, f.y); break;
    case 'fence_v':      drawFenceV(f.x, f.y); break;
    case 'lantern':      drawLantern(f.x, f.y); break;
    case 'torch':        drawTorch(f.x, f.y); break;
    case 'pond_tile':    drawPondTile(f.x, f.y); break;
    case 'market_stall': drawMarketStall(f.x, f.y); break;
  }
}

// ── Write PNG ───────────────────────────────────────────────────────────────
const outPath = path.resolve(__dirname, '..', 'assets', 'sprites', 'scenery.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(outPath, buffer);
console.log(`Generated ${outPath} (${buffer.length} bytes)`);
console.log(`Atlas dimensions: ${atlasWidth}x${atlasHeight}`);
console.log(`Sprites: ${SPRITES.map(s => s.name).join(', ')}`);

// ── Write JSON Descriptor ───────────────────────────────────────────────────
const descriptor = {
  frames: {},
  meta: {
    app: 'Agent World',
    version: '1.0',
    image: 'scenery.png',
    format: 'RGBA8888',
    size: { w: atlasWidth, h: atlasHeight },
    scale: '1',
  },
};

for (const sprite of SPRITES) {
  const f = frames[sprite.name];
  descriptor.frames[sprite.name] = {
    frame: { x: f.x, y: f.y, w: f.w, h: f.h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
    sourceSize: { w: f.w, h: f.h },
  };
}

const jsonPath = path.resolve(__dirname, '..', 'assets', 'sprites', 'scenery.json');
fs.writeFileSync(jsonPath, JSON.stringify(descriptor, null, 2));
console.log(`Generated ${jsonPath}`);
