/**
 * Generate the building atlas PNG with 4 workspace buildings:
 *   wizard_tower, training_grounds, ancient_library, tavern.
 * Each building is 464x336 landscape orientation -- placeholder exteriors
 * that will be replaced with detailed interiors in Phase 15.
 * Uses deterministic pixel positions for reproducibility.
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const BLDG_W = 464;
const BLDG_H = 336;
const BUILDING_COUNT = 4;
const WIDTH = BLDG_W * BUILDING_COUNT; // 1856
const HEIGHT = BLDG_H;                 // 336

const png = new PNG({ width: WIDTH, height: HEIGHT });

// Initialize entire buffer to transparent (alpha = 0)
for (let i = 0; i < WIDTH * HEIGHT * 4; i += 4) {
  png.data[i] = 0;
  png.data[i + 1] = 0;
  png.data[i + 2] = 0;
  png.data[i + 3] = 0;
}

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function fillRect(x0, y0, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(x0 + dx, y0 + dy, r, g, b, a);
    }
  }
}

function drawLine(x0, y0, x1, y1, r, g, b) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0, y = y0;
  while (true) {
    setPixel(x, y, r, g, b);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
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

// =====================================================================
// Building 0 (offset 0): Wizard Tower
// Purple/blue tower with glowing windows, starry accents, landscape
// =====================================================================
function drawWizardTower(ox) {
  const W = BLDG_W;
  const H = BLDG_H;

  // Dark purple-blue background fill for the building area
  fillRect(ox, 0, W, H, 30, 25, 55, 255);

  // Stone floor
  fillRect(ox, H - 40, W, 40, 50, 45, 70);
  // Floor tile grid
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 16; col++) {
      const tx = ox + col * 30 + (row % 2) * 15;
      const ty = H - 38 + row * 14;
      fillRect(tx, ty, 28, 12, 55, 50, 78);
      // Slight highlight on top edge
      for (let dx = 0; dx < 28; dx++) setPixel(tx + dx, ty, 62, 57, 85);
    }
  }

  // Back wall -- stone with purple tint
  fillRect(ox + 10, 10, W - 20, H - 55, 60, 50, 85);

  // Wall stone texture
  for (let row = 0; row < 20; row++) {
    const y = 20 + row * 15;
    if (y >= H - 50) break;
    for (let x = ox + 10; x < ox + W - 10; x++) {
      setPixel(x, y, 52, 42, 75);
    }
    const offset = (row % 2) * 20;
    for (let col = 0; col < 25; col++) {
      const mx = ox + 20 + col * 20 + offset;
      if (mx < ox + W - 10) {
        for (let dy = 0; dy < 15 && y + dy < H - 50; dy++) {
          setPixel(mx, y + dy, 52, 42, 75);
        }
      }
    }
  }

  // Central tower element (tall, narrow) rising from the floor
  const towerCx = ox + W / 2;
  const towerW = 80;
  fillRect(towerCx - towerW / 2, 30, towerW, H - 70, 80, 70, 110);

  // Tower conical roof
  for (let row = 0; row < 30; row++) {
    const halfW = 50 - Math.floor(row * 50 / 30);
    const r = 90 - Math.floor(row * 20 / 30);
    const g = 50 - Math.floor(row * 10 / 30);
    const b = 130 + Math.floor(row * 25 / 30);
    fillRect(towerCx - halfW, row, halfW * 2, 1, r, g, b);
  }
  // Roof orb
  drawCircle(towerCx, 4, 3, 200, 180, 255);

  // Tower glowing window (large)
  fillRect(towerCx - 12, 60, 24, 20, 50, 40, 60);
  fillRect(towerCx - 10, 62, 20, 16, 255, 220, 80);
  // Window glow halo
  for (let dy = -3; dy <= 19; dy++) {
    for (let dx = -3; dx <= 23; dx++) {
      const x = towerCx - 12 + dx;
      const y = 60 + dy;
      if (x >= towerCx - 10 && x < towerCx + 10 && y >= 62 && y < 78) continue;
      setPixel(x, y, 200, 170, 50, 40);
    }
  }

  // Enchanting table -- left side
  fillRect(ox + 50, H - 80, 90, 10, 70, 50, 100);  // table top
  fillRect(ox + 55, H - 70, 6, 30, 60, 45, 80);    // left leg
  fillRect(ox + 129, H - 70, 6, 30, 60, 45, 80);   // right leg
  // Glowing items on table
  drawCircle(ox + 75, H - 86, 4, 140, 100, 255, 200);
  drawCircle(ox + 100, H - 86, 3, 100, 200, 255, 200);
  fillRect(ox + 115, H - 90, 8, 6, 180, 140, 60);  // scroll

  // Scroll desk -- right side
  fillRect(ox + W - 170, H - 80, 100, 10, 90, 75, 50); // desk surface
  fillRect(ox + W - 165, H - 70, 6, 30, 70, 55, 35);   // left leg
  fillRect(ox + W - 81, H - 70, 6, 30, 70, 55, 35);    // right leg
  // Scrolls and books
  fillRect(ox + W - 155, H - 90, 6, 8, 200, 180, 120);
  fillRect(ox + W - 145, H - 92, 5, 10, 180, 160, 100);
  fillRect(ox + W - 130, H - 88, 20, 6, 170, 130, 80);
  // Quill
  drawLine(ox + W - 100, H - 95, ox + W - 90, H - 82, 220, 200, 150);

  // Rune bench -- center right
  fillRect(ox + W / 2 + 50, H - 75, 80, 8, 60, 55, 90);
  fillRect(ox + W / 2 + 55, H - 67, 5, 27, 55, 50, 80);
  fillRect(ox + W / 2 + 120, H - 67, 5, 27, 55, 50, 80);
  // Glowing runes
  for (let i = 0; i < 5; i++) {
    setPixel(ox + W / 2 + 65 + i * 12, H - 80, 80, 160, 255);
    setPixel(ox + W / 2 + 66 + i * 12, H - 80, 80, 160, 255);
  }

  // Magical sparkle dots scattered
  const sparkles = [
    [ox + 30, 20], [ox + W - 40, 25], [ox + 100, 50], [ox + W - 100, 60],
    [ox + 60, 100], [ox + W - 70, 110], [ox + 200, 30], [ox + W - 200, 40],
    [ox + 150, 140], [ox + W - 150, 150], [ox + 80, 180], [ox + W - 80, 190],
    [ox + 300, 70], [ox + 350, 120], [ox + 120, 230],
  ];
  sparkles.forEach(([x, y]) => {
    setPixel(x, y, 120, 200, 255);
    setPixel(x + 1, y, 120, 200, 255, 180);
    setPixel(x, y + 1, 120, 200, 255, 180);
  });

  // Purple curtains on left and right walls
  for (let y = 15; y < 200; y++) {
    const wave = Math.floor(Math.sin(y * 0.1) * 3);
    fillRect(ox + 14 + wave, y, 12, 1, 100, 40, 120, 200);
    fillRect(ox + W - 26 + wave, y, 12, 1, 100, 40, 120, 200);
  }

  // Bookshelf on left wall
  fillRect(ox + 30, 100, 60, 120, 80, 55, 40);
  for (let shelf = 0; shelf < 4; shelf++) {
    const sy = 108 + shelf * 30;
    fillRect(ox + 30, sy, 60, 3, 65, 42, 30);
    // Books
    for (let b = 0; b < 8; b++) {
      const bx = ox + 33 + b * 7;
      const bh = 10 + (b * 3) % 8;
      const colors = [[70, 100, 170], [170, 60, 50], [60, 130, 60], [130, 80, 160]];
      const c = colors[b % 4];
      fillRect(bx, sy - bh, 5, bh, c[0], c[1], c[2]);
    }
  }
}

// =====================================================================
// Building 1 (offset 464): Training Grounds
// Wide wooden barracks with practice yard feel, landscape
// =====================================================================
function drawTrainingGrounds(ox) {
  const W = BLDG_W;
  const H = BLDG_H;

  // Dirt ground fill
  fillRect(ox, 0, W, H, 100, 75, 45);
  // Dirt texture variation
  for (let i = 0; i < 200; i++) {
    const dx = ox + (i * 37 + 13) % W;
    const dy = (i * 53 + 7) % H;
    setPixel(dx, dy, 90, 65, 38);
    setPixel(dx + 1, dy, 115, 85, 55);
  }

  // Wide barracks building in the back third
  fillRect(ox + 20, 15, W - 40, 130, 110, 65, 35);

  // Wood plank texture
  for (let row = 0; row < 14; row++) {
    const y = 20 + row * 10;
    for (let x = ox + 20; x < ox + W - 20; x++) {
      setPixel(x, y, 95, 55, 28);
    }
  }

  // Darker wood trim
  fillRect(ox + 20, 15, 4, 130, 75, 42, 20);
  fillRect(ox + W - 24, 15, 4, 130, 75, 42, 20);
  fillRect(ox + 20, 15, W - 40, 4, 75, 42, 20);

  // Flat roof with overhang
  fillRect(ox + 14, 6, W - 28, 14, 75, 42, 20);
  for (let x = ox + 14; x < ox + W - 14; x++) {
    setPixel(x, 6, 90, 52, 28);
  }

  // Windows across barracks
  for (let i = 0; i < 6; i++) {
    const wx = ox + 60 + i * 60;
    fillRect(wx, 50, 20, 16, 50, 30, 15);
    fillRect(wx + 2, 52, 16, 12, 120, 100, 65);
    fillRect(wx + 9, 52, 2, 12, 50, 30, 15);
  }

  // Large open doorway
  fillRect(ox + W / 2 - 25, 80, 50, 65, 40, 25, 12);
  fillRect(ox + W / 2 - 27, 78, 54, 3, 75, 42, 20);

  // Practice yard -- center area
  // Sandy patch
  fillRect(ox + 40, 170, W - 80, 120, 130, 105, 65);

  // Weapon rack -- left side
  fillRect(ox + 50, 180, 4, 60, 80, 50, 25);
  fillRect(ox + 80, 180, 4, 60, 80, 50, 25);
  fillRect(ox + 50, 180, 34, 4, 80, 50, 25);
  // Weapons
  for (let w = 0; w < 6; w++) {
    const wx = ox + 55 + w * 5;
    drawLine(wx, 184, wx, 235, 180, 180, 190);
  }
  // Cross swords
  drawLine(ox + 55, 184, ox + 78, 235, 190, 190, 200);
  drawLine(ox + 78, 184, ox + 55, 235, 190, 190, 200);

  // Training dummy -- center-left
  fillRect(ox + 160, 195, 4, 50, 130, 100, 50);
  fillRect(ox + 146, 200, 32, 4, 130, 100, 50);
  drawCircle(ox + 162, 192, 6, 160, 140, 80);

  // Training dummy -- center-right
  fillRect(ox + 300, 195, 4, 50, 130, 100, 50);
  fillRect(ox + 286, 200, 32, 4, 130, 100, 50);
  drawCircle(ox + 302, 192, 6, 160, 140, 80);

  // Wooden fence along the practice area
  for (let i = 0; i < 12; i++) {
    const fx = ox + 100 + i * 25;
    if (fx > ox + W - 60) break;
    fillRect(fx, H - 55, 3, 20, 100, 65, 32);
    if (i < 11 && fx + 25 < ox + W - 60) {
      fillRect(fx, H - 50, 28, 3, 100, 65, 32);
      fillRect(fx, H - 42, 28, 3, 100, 65, 32);
    }
  }

  // Potion station -- right side
  fillRect(ox + W - 130, 185, 70, 8, 80, 55, 35);
  fillRect(ox + W - 125, 193, 5, 25, 70, 45, 25);
  fillRect(ox + W - 70, 193, 5, 25, 70, 45, 25);
  // Potion bottles
  drawCircle(ox + W - 110, 180, 5, 40, 200, 40, 200);
  drawCircle(ox + W - 95, 180, 4, 200, 40, 40, 200);
  drawCircle(ox + W - 80, 180, 5, 40, 100, 200, 200);

  // Archery targets -- far right
  for (let t = 0; t < 2; t++) {
    const tcx = ox + W - 50;
    const tcy = 200 + t * 50;
    drawCircle(tcx, tcy, 12, 200, 40, 40);
    drawCircle(tcx, tcy, 8, 255, 255, 255);
    drawCircle(tcx, tcy, 4, 200, 40, 40);
  }

  // Ground shadow for barracks
  for (let x = ox + 18; x < ox + W - 18; x++) {
    setPixel(x, 148, 80, 60, 35, 100);
    setPixel(x, 149, 80, 60, 35, 60);
  }
}

// =====================================================================
// Building 2 (offset 928): Ancient Library
// Classical stone with columns, pediment, arched doorways, books
// =====================================================================
function drawAncientLibrary(ox) {
  const W = BLDG_W;
  const H = BLDG_H;

  // Light stone background
  fillRect(ox, 0, W, H, 155, 150, 135);

  // Stone floor with tile pattern
  fillRect(ox, H - 50, W, 50, 140, 135, 115);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 16; col++) {
      const tx = ox + col * 30 + (row % 2) * 15;
      const ty = H - 48 + row * 16;
      fillRect(tx, ty, 28, 14, 148, 143, 123);
      for (let dx = 0; dx < 28; dx++) setPixel(tx + dx, ty, 155, 150, 130);
    }
  }

  // Main stone walls
  fillRect(ox + 20, 30, W - 40, H - 85, 165, 160, 145);

  // Wall stone block texture
  for (let row = 0; row < 18; row++) {
    const y = 40 + row * 16;
    if (y >= H - 60) break;
    for (let x = ox + 20; x < ox + W - 20; x++) {
      setPixel(x, y, 150, 145, 128);
    }
    const offset = (row % 2) * 14;
    for (let col = 0; col < 32; col++) {
      const mx = ox + 30 + col * 14 + offset;
      if (mx < ox + W - 20) {
        for (let dy = 0; dy < 16 && y + dy < H - 60; dy++) {
          setPixel(mx, y + dy, 150, 145, 128);
        }
      }
    }
  }

  // Triangular pediment/roof
  for (let row = 0; row < 30; row++) {
    const halfW = Math.floor(W / 2) - 10 - Math.floor(row * (W / 2 - 10) / 30);
    const cx = ox + W / 2;
    fillRect(cx - halfW, row, halfW * 2, 1, 175, 170, 155);
  }
  // Pediment edge
  for (let row = 0; row < 30; row++) {
    const halfW = Math.floor(W / 2) - 10 - Math.floor(row * (W / 2 - 10) / 30);
    const cx = ox + W / 2;
    setPixel(cx - halfW, row, 185, 180, 165);
    setPixel(cx + halfW - 1, row, 145, 140, 125);
  }
  // Gold ornament at top
  drawCircle(ox + W / 2, 4, 4, 200, 180, 80);

  // Stone columns (4 evenly spaced)
  const colSpacing = Math.floor((W - 60) / 5);
  for (let c = 1; c <= 4; c++) {
    const cx = ox + 30 + c * colSpacing;
    fillRect(cx - 6, 34, 12, H - 85, 185, 180, 165);
    // Capital
    fillRect(cx - 8, 34, 16, 5, 195, 190, 175);
    // Base
    fillRect(cx - 8, H - 54, 16, 5, 195, 190, 175);
    // Fluting
    for (let y = 39; y < H - 54; y++) {
      setPixel(cx - 4, y, 170, 165, 150);
      setPixel(cx, y, 195, 190, 175);
      setPixel(cx + 3, y, 170, 165, 150);
    }
  }

  // Central arched doorway
  const doorCx = ox + W / 2;
  fillRect(doorCx - 20, 120, 40, H - 170, 50, 42, 35);
  // Arch
  for (let i = -20; i <= 20; i++) {
    const archY = 120 - Math.floor(Math.sqrt(400 - i * i) * 0.5);
    for (let y = archY; y <= 120; y++) {
      setPixel(doorCx + i, y, 50, 42, 35);
    }
  }
  // Gold arch border
  for (let i = -20; i <= 20; i++) {
    const archY = 120 - Math.floor(Math.sqrt(400 - i * i) * 0.5);
    setPixel(doorCx + i, archY, 200, 180, 80);
    setPixel(doorCx + i, archY + 1, 200, 180, 80);
  }

  // Bookshelves along walls -- left
  fillRect(ox + 40, 60, 80, 180, 80, 55, 35);
  for (let shelf = 0; shelf < 6; shelf++) {
    const sy = 70 + shelf * 30;
    fillRect(ox + 40, sy, 80, 4, 65, 42, 28);
    for (let b = 0; b < 10; b++) {
      const bx = ox + 44 + b * 8;
      const bh = 12 + (b * 5) % 10;
      const colors = [[70, 100, 170], [170, 60, 50], [60, 130, 60], [130, 80, 160], [100, 100, 50]];
      const col = colors[b % 5];
      fillRect(bx, sy - bh, 6, bh, col[0], col[1], col[2]);
    }
  }

  // Bookshelves along walls -- right
  fillRect(ox + W - 120, 60, 80, 180, 80, 55, 35);
  for (let shelf = 0; shelf < 6; shelf++) {
    const sy = 70 + shelf * 30;
    fillRect(ox + W - 120, sy, 80, 4, 65, 42, 28);
    for (let b = 0; b < 10; b++) {
      const bx = ox + W - 116 + b * 8;
      const bh = 12 + (b * 7) % 10;
      const colors = [[170, 60, 50], [70, 100, 170], [130, 80, 160], [60, 130, 60], [140, 120, 50]];
      const col = colors[b % 5];
      fillRect(bx, sy - bh, 6, bh, col[0], col[1], col[2]);
    }
  }

  // Crystal ball on pedestal -- center-left
  fillRect(ox + 155, H - 80, 12, 30, 140, 135, 120);  // pedestal
  drawCircle(ox + 161, H - 88, 8, 160, 200, 240, 200);
  drawCircle(ox + 159, H - 90, 3, 220, 240, 255, 150);

  // Map table -- center-right
  fillRect(ox + W - 200, H - 75, 70, 8, 110, 80, 50);
  fillRect(ox + W - 195, H - 67, 5, 27, 90, 65, 40);
  fillRect(ox + W - 140, H - 67, 5, 27, 90, 65, 40);
  // Map on table
  fillRect(ox + W - 190, H - 82, 50, 5, 200, 185, 140);

  // Gold trim line across top of walls
  for (let x = ox + 20; x < ox + W - 20; x++) {
    setPixel(x, 30, 200, 180, 80);
    setPixel(x, 31, 200, 180, 80);
  }

  // Scroll decorations on wall
  for (let s = 0; s < 3; s++) {
    const sx = ox + 145 + s * 60;
    fillRect(sx, 50, 16, 5, 200, 185, 120);
    setPixel(sx - 1, 50, 210, 195, 130);
    setPixel(sx + 16, 50, 210, 195, 130);
  }
}

// =====================================================================
// Building 3 (offset 1392): Tavern
// Timber-frame with warm glowing windows, chimney, cozy feel
// =====================================================================
function drawTavern(ox) {
  const W = BLDG_W;
  const H = BLDG_H;

  // Warm interior background
  fillRect(ox, 0, W, H, 180, 140, 80);

  // Wooden floor planks
  fillRect(ox, H - 50, W, 50, 120, 85, 45);
  for (let row = 0; row < 5; row++) {
    const y = H - 48 + row * 10;
    for (let x = ox; x < ox + W; x++) {
      setPixel(x, y, 105, 72, 35);
    }
  }

  // Back wall -- cream with timber frame
  fillRect(ox + 15, 20, W - 30, H - 75, 200, 185, 150);

  // Timber frame beams (dark brown)
  // Horizontal
  fillRect(ox + 12, 16, W - 24, 5, 90, 60, 30);
  fillRect(ox + 12, H / 2, W - 24, 4, 90, 60, 30);
  fillRect(ox + 12, H - 58, W - 24, 4, 90, 60, 30);
  // Vertical
  fillRect(ox + 12, 16, 5, H - 72, 90, 60, 30);
  fillRect(ox + W - 17, 16, 5, H - 72, 90, 60, 30);
  fillRect(ox + W / 2, 16, 5, H - 72, 90, 60, 30);
  // Diagonal braces in left section
  for (let i = 0; i < 80; i++) {
    const factor = i / 80;
    const x1 = ox + 17 + Math.floor(factor * (W / 2 - 20));
    const y1 = 21 + Math.floor(factor * (H / 2 - 25));
    setPixel(x1, y1, 90, 60, 30);
    setPixel(x1 + 1, y1, 90, 60, 30);
    // Opposite diagonal
    const x2 = ox + W / 2 - 3 - Math.floor(factor * (W / 2 - 20));
    setPixel(x2, y1, 90, 60, 30);
    setPixel(x2 + 1, y1, 90, 60, 30);
  }

  // Roof area
  for (let row = 0; row < 18; row++) {
    const halfW = Math.floor(W / 2) - 5 - Math.floor(row * 15 / 18);
    const cx = ox + W / 2;
    fillRect(cx - halfW, row, halfW * 2, 1, 90, 60, 30);
  }
  // Shingle texture
  for (let row = 0; row < 6; row++) {
    const y = 2 + row * 3;
    const halfW = Math.floor(W / 2) - 5 - Math.floor(y * 15 / 18);
    const cx = ox + W / 2;
    for (let x = cx - halfW; x < cx + halfW; x++) {
      if ((x + row) % 8 === 0) setPixel(x, y, 75, 48, 22);
    }
  }

  // Chimney (right side)
  fillRect(ox + W - 70, 0, 18, 30, 140, 75, 55);
  // Chimney brick texture
  for (let row = 0; row < 7; row++) {
    const y = 2 + row * 4;
    for (let x = ox + W - 70; x < ox + W - 52; x++) {
      setPixel(x, y, 120, 60, 42);
    }
  }
  fillRect(ox + W - 72, 0, 22, 3, 120, 60, 42);
  // Smoke
  setPixel(ox + W - 63, 0, 180, 180, 190, 80);
  setPixel(ox + W - 61, 0, 180, 180, 190, 60);

  // Warm glowing windows -- upper row
  for (let w = 0; w < 4; w++) {
    const wx = ox + 50 + w * 95;
    if (wx + 30 > ox + W - 20) break;
    fillRect(wx, 50, 30, 22, 70, 48, 25);
    fillRect(wx + 2, 52, 26, 18, 220, 160, 60);
    fillRect(wx + 13, 52, 4, 18, 70, 48, 25);  // mullion
    fillRect(wx + 2, 60, 26, 3, 70, 48, 25);   // cross bar
    // Glow halo
    for (let dy = -2; dy <= 21; dy++) {
      for (let dx = -2; dx <= 31; dx++) {
        const x = wx + dx;
        const y = 50 + dy;
        if (x >= wx + 2 && x < wx + 28 && y >= 52 && y < 70) continue;
        if (x >= ox && x < ox + W) setPixel(x, y, 200, 140, 40, 30);
      }
    }
  }

  // Lower windows
  for (let w = 0; w < 4; w++) {
    const wx = ox + 50 + w * 95;
    if (wx + 30 > ox + W - 20) break;
    fillRect(wx, H / 2 + 20, 30, 22, 70, 48, 25);
    fillRect(wx + 2, H / 2 + 22, 26, 18, 220, 160, 60);
    fillRect(wx + 13, H / 2 + 22, 4, 18, 70, 48, 25);
  }

  // Bar counter -- long horizontal bar across the back
  fillRect(ox + 40, H - 90, W - 80, 14, 90, 60, 30);
  // Bar supports
  for (let s = 0; s < 6; s++) {
    const sx = ox + 60 + s * 60;
    if (sx > ox + W - 60) break;
    fillRect(sx, H - 76, 5, 26, 80, 52, 25);
  }
  // Mugs and bottles on bar
  for (let m = 0; m < 8; m++) {
    const mx = ox + 55 + m * 45;
    if (mx > ox + W - 60) break;
    if (m % 2 === 0) {
      // Mug
      fillRect(mx, H - 98, 8, 8, 160, 120, 50);
      fillRect(mx + 8, H - 96, 3, 4, 160, 120, 50);
    } else {
      // Bottle
      fillRect(mx + 1, H - 104, 6, 14, 60, 100, 60, 180);
      fillRect(mx + 2, H - 108, 4, 4, 60, 100, 60, 180);
    }
  }

  // Hanging sign (left wall)
  fillRect(ox + 20, 70, 3, 20, 70, 48, 25);
  fillRect(ox + 16, 85, 12, 8, 90, 60, 30);
  // Sign icon (mug)
  setPixel(ox + 20, 87, 220, 180, 80);
  setPixel(ox + 21, 87, 220, 180, 80);
  setPixel(ox + 22, 86, 220, 180, 80);

  // Notice board -- right wall
  fillRect(ox + W - 80, 60, 50, 40, 150, 120, 70);
  fillRect(ox + W - 78, 62, 46, 36, 180, 150, 100);
  // Pinned notes
  fillRect(ox + W - 74, 65, 14, 10, 230, 220, 190);
  fillRect(ox + W - 56, 68, 12, 8, 230, 220, 190);
  fillRect(ox + W - 72, 80, 10, 12, 230, 220, 190);
  fillRect(ox + W - 58, 82, 16, 8, 230, 220, 190);
  // Pin dots
  setPixel(ox + W - 68, 66, 200, 50, 50);
  setPixel(ox + W - 50, 69, 50, 50, 200);

  // Welcoming open door -- center
  fillRect(ox + W / 2 - 22, H / 2 + 10, 44, H / 2 - 64, 70, 48, 25);
  fillRect(ox + W / 2 - 18, H / 2 + 14, 36, H / 2 - 70, 200, 140, 50);
  fillRect(ox + W / 2 - 14, H / 2 + 18, 28, H / 2 - 76, 180, 120, 40);

  // Barrel in corner
  drawCircle(ox + 35, H - 65, 12, 100, 70, 35);
  drawCircle(ox + 35, H - 65, 10, 120, 85, 45);
  // Barrel bands
  for (let x = ox + 25; x < ox + 45; x++) {
    setPixel(x, H - 70, 80, 55, 25);
    setPixel(x, H - 60, 80, 55, 25);
  }
}

// =====================================================================
// Draw all buildings
// =====================================================================
drawWizardTower(0);
drawTrainingGrounds(BLDG_W);
drawAncientLibrary(BLDG_W * 2);
drawTavern(BLDG_W * 3);

// Write PNG
const outPath = path.resolve(__dirname, '..', 'assets', 'sprites', 'buildings.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(outPath, buffer);
console.log(`Generated ${outPath} (${buffer.length} bytes, ${WIDTH}x${HEIGHT})`);
