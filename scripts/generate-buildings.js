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
// Building 0 (offset 0): Wizard Tower Interior
// Top-down arcane study: purple/blue theme, dark stone floor/walls
// Stations: enchanting table, scroll desk, rune bench
// =====================================================================
function drawWizardTower(ox) {
  const W = BLDG_W;
  const H = BLDG_H;

  // --- FLOOR: Dark stone base with mortar lines and rune symbols ---
  fillRect(ox, 0, W, H, 35, 30, 55);

  // Stone block mortar lines (every ~16px)
  for (let row = 0; row < Math.ceil(H / 16); row++) {
    const y = row * 16;
    // Horizontal mortar
    for (let x = ox + 10; x < ox + W - 10; x++) {
      if (y > 14 && y < H - 10) setPixel(x, y, 42, 37, 65);
    }
    // Vertical mortar (offset every other row)
    const vOff = (row % 2) * 8;
    for (let col = 0; col < Math.ceil(W / 16); col++) {
      const vx = ox + 10 + col * 16 + vOff;
      if (vx < ox + W - 10) {
        for (let dy = 0; dy < 16 && y + dy < H - 10 && y + dy > 14; dy++) {
          setPixel(vx, y + dy, 42, 37, 65);
        }
      }
    }
  }

  // Glowing floor runes (15-20 scattered geometric shapes)
  const floorRunes = [
    [ox+40, 50], [ox+120, 30], [ox+200, 90], [ox+340, 60], [ox+400, 110],
    [ox+70, 170], [ox+180, 200], [ox+300, 180], [ox+380, 250], [ox+440, 180],
    [ox+50, 280], [ox+160, 310], [ox+260, 260], [ox+350, 300], [ox+420, 30],
    [ox+100, 130], [ox+290, 130], [ox+230, 50], [ox+130, 260],
  ];
  floorRunes.forEach(([rx, ry]) => {
    if (ry < 16 || ry > H - 12 || rx < ox + 12 || rx > ox + W - 12) return;
    // Small diamond/cross rune shape
    const runeColors = [[80, 200, 220], [140, 100, 220], [100, 160, 240]];
    const c = runeColors[(rx + ry) % 3];
    setPixel(rx, ry, c[0], c[1], c[2], 160);
    setPixel(rx+1, ry, c[0], c[1], c[2], 120);
    setPixel(rx-1, ry, c[0], c[1], c[2], 120);
    setPixel(rx, ry+1, c[0], c[1], c[2], 120);
    setPixel(rx, ry-1, c[0], c[1], c[2], 120);
  });

  // --- WALLS: 8-10px border on all sides, darker stone ---
  // Top wall (thicker, ~14px)
  fillRect(ox, 0, W, 14, 25, 20, 45);
  // Bottom wall
  fillRect(ox, H - 10, W, 10, 25, 20, 45);
  // Left wall
  fillRect(ox, 0, 10, H, 25, 20, 45);
  // Right wall
  fillRect(ox + W - 10, 0, 10, H, 25, 20, 45);

  // Wall rune carvings (lighter lines etched into walls)
  for (let i = 0; i < 18; i++) {
    const wx = ox + 20 + i * 25;
    if (wx < ox + W - 15) {
      // Top wall rune marks
      setPixel(wx, 5, 40, 35, 65); setPixel(wx+1, 5, 40, 35, 65);
      setPixel(wx, 6, 40, 35, 65); setPixel(wx+2, 7, 40, 35, 65);
      // Bottom wall rune marks
      setPixel(wx, H - 6, 40, 35, 65); setPixel(wx+1, H - 5, 40, 35, 65);
    }
  }
  for (let i = 0; i < 12; i++) {
    const wy = 20 + i * 26;
    if (wy < H - 15) {
      // Left wall rune marks
      setPixel(ox + 3, wy, 40, 35, 65); setPixel(ox + 4, wy+1, 40, 35, 65);
      // Right wall rune marks
      setPixel(ox + W - 5, wy, 40, 35, 65); setPixel(ox + W - 4, wy+1, 40, 35, 65);
    }
  }

  // --- ROLLED CARPET/RUG under enchanting table area (bottom of top-left) ---
  fillRect(ox + 30, 40, 140, 110, 30, 22, 50);
  // Rug border pattern
  fillRect(ox + 30, 40, 140, 3, 55, 30, 75);
  fillRect(ox + 30, 147, 140, 3, 55, 30, 75);
  fillRect(ox + 30, 40, 3, 110, 55, 30, 75);
  fillRect(ox + 167, 40, 3, 110, 55, 30, 75);
  // Inner border
  fillRect(ox + 35, 45, 130, 2, 45, 25, 65);
  fillRect(ox + 35, 143, 130, 2, 45, 25, 65);
  fillRect(ox + 35, 45, 2, 100, 45, 25, 65);
  fillRect(ox + 163, 45, 2, 100, 45, 25, 65);

  // ============================================================
  // STATION 1: Enchanting Table (top-left area, ~x:60-140, y:60-130)
  // ============================================================
  // Table body (dark wood, purple tint)
  fillRect(ox + 60, 70, 80, 50, 60, 45, 80);
  // Table top surface (lighter)
  fillRect(ox + 62, 72, 76, 46, 70, 55, 90);
  // Dark edge shading (2px on bottom/right)
  fillRect(ox + 60, 118, 80, 2, 50, 35, 68);
  fillRect(ox + 138, 70, 2, 50, 50, 35, 68);
  // Highlight on top/left (1px)
  for (let x = ox + 60; x < ox + 140; x++) setPixel(x, 70, 75, 60, 98);
  for (let y = 70; y < 120; y++) setPixel(ox + 60, y, 75, 60, 98);

  // Arcane circle on table surface (thin outline)
  const acCx = ox + 100, acCy = 95;
  for (let a = 0; a < 360; a += 2) {
    const rad = a * Math.PI / 180;
    const px = Math.round(acCx + Math.cos(rad) * 18);
    const py = Math.round(acCy + Math.sin(rad) * 16);
    setPixel(px, py, 140, 80, 200, 180);
  }
  // Inner arcane circle
  for (let a = 0; a < 360; a += 3) {
    const rad = a * Math.PI / 180;
    const px = Math.round(acCx + Math.cos(rad) * 10);
    const py = Math.round(acCy + Math.sin(rad) * 9);
    setPixel(px, py, 140, 80, 200, 140);
  }

  // Glowing crystal centerpiece (~12px circle, bright cyan)
  drawCircle(acCx, acCy, 6, 80, 220, 240, 220);
  drawCircle(acCx, acCy, 4, 120, 240, 255, 240);
  drawCircle(acCx, acCy, 2, 200, 255, 255, 255);
  // Crystal glow halo
  drawCircle(acCx, acCy, 9, 80, 200, 230, 50);

  // Gemstones scattered on table
  drawCircle(ox + 72, 80, 2, 200, 40, 60);   // ruby
  drawCircle(ox + 130, 85, 2, 40, 180, 60);   // emerald
  drawCircle(ox + 75, 108, 2, 50, 80, 200);   // sapphire
  drawCircle(ox + 125, 110, 1, 200, 180, 40); // topaz

  // Two candles on table corners
  fillRect(ox + 63, 73, 3, 6, 200, 180, 130); // candle body left
  setPixel(ox + 64, 72, 255, 220, 80);         // flame
  setPixel(ox + 64, 71, 255, 200, 50);
  fillRect(ox + 134, 73, 3, 6, 200, 180, 130); // candle body right
  setPixel(ox + 135, 72, 255, 220, 80);
  setPixel(ox + 135, 71, 255, 200, 50);

  // ============================================================
  // STATION 2: Scroll Desk (center-right area, ~x:280-380, y:130-210)
  // ============================================================
  // Desk body (medium brown wood)
  fillRect(ox + 280, 140, 90, 50, 80, 60, 45);
  // Desk top surface
  fillRect(ox + 282, 142, 86, 46, 90, 72, 55);
  // Shading
  fillRect(ox + 280, 188, 90, 2, 65, 48, 35);
  fillRect(ox + 368, 140, 2, 50, 65, 48, 35);
  // Highlight
  for (let x = ox + 280; x < ox + 370; x++) setPixel(x, 140, 98, 80, 62);
  for (let y = 140; y < 190; y++) setPixel(ox + 280, y, 98, 80, 62);

  // Multiple scroll rolls (cylindrical)
  fillRect(ox + 290, 148, 20, 6, 210, 190, 140); // scroll 1
  fillRect(ox + 290, 147, 3, 8, 190, 170, 120); // scroll end cap
  fillRect(ox + 307, 147, 3, 8, 190, 170, 120);
  fillRect(ox + 315, 152, 18, 5, 200, 180, 130); // scroll 2
  fillRect(ox + 315, 151, 3, 7, 180, 160, 110);
  fillRect(ox + 330, 151, 3, 7, 180, 160, 110);
  fillRect(ox + 340, 145, 22, 6, 220, 200, 150); // scroll 3 unrolled
  fillRect(ox + 340, 144, 3, 8, 195, 175, 125);

  // Open book in center
  fillRect(ox + 305, 165, 16, 12, 240, 235, 220); // white pages
  fillRect(ox + 312, 165, 2, 12, 180, 170, 150);  // spine
  // Tiny text lines
  for (let i = 0; i < 4; i++) {
    fillRect(ox + 307, 168 + i * 2, 4, 1, 60, 50, 40);
    fillRect(ox + 316, 168 + i * 2, 4, 1, 60, 50, 40);
  }

  // Ink pot with quill
  drawCircle(ox + 350, 172, 3, 25, 20, 40); // ink pot
  drawCircle(ox + 350, 172, 2, 15, 10, 30);
  drawLine(ox + 350, 170, ox + 358, 158, 200, 190, 170); // quill shaft
  setPixel(ox + 358, 157, 220, 210, 180); // quill tip
  setPixel(ox + 357, 158, 180, 170, 140);

  // Stack of papers on one side
  fillRect(ox + 285, 170, 14, 10, 230, 225, 210);
  fillRect(ox + 286, 171, 13, 9, 240, 235, 220);
  fillRect(ox + 287, 172, 12, 8, 235, 230, 215);
  // Paper edge lines
  for (let i = 0; i < 3; i++) {
    fillRect(ox + 285, 170 + i * 3, 14, 1, 210, 205, 190);
  }

  // ============================================================
  // STATION 3: Rune Bench (bottom-center area, ~x:160-280, y:230-300)
  // ============================================================
  // Stone workbench (gray-blue stone)
  fillRect(ox + 160, 245, 100, 40, 70, 75, 100);
  // Top surface (lighter)
  fillRect(ox + 162, 247, 96, 36, 80, 85, 110);
  // Dark edge shading
  fillRect(ox + 160, 283, 100, 2, 55, 60, 85);
  fillRect(ox + 258, 245, 2, 40, 55, 60, 85);
  // Highlight
  for (let x = ox + 160; x < ox + 260; x++) setPixel(x, 245, 90, 95, 120);
  for (let y = 245; y < 285; y++) setPixel(ox + 160, y, 90, 95, 120);

  // Chiseling tools (small metallic rectangles)
  fillRect(ox + 170, 255, 8, 3, 160, 165, 175); // chisel 1
  fillRect(ox + 170, 254, 2, 1, 180, 185, 195);
  fillRect(ox + 182, 258, 6, 3, 150, 155, 165); // chisel 2
  fillRect(ox + 195, 253, 10, 2, 170, 175, 185); // flat tool

  // Partially carved rune stones (small squares with glowing lines)
  fillRect(ox + 210, 252, 12, 12, 90, 95, 115);
  // Glowing rune on stone
  setPixel(ox + 214, 255, 100, 180, 255, 200);
  setPixel(ox + 215, 256, 100, 180, 255, 200);
  setPixel(ox + 216, 257, 100, 180, 255, 200);
  setPixel(ox + 216, 255, 100, 180, 255, 200);
  setPixel(ox + 218, 256, 100, 180, 255, 200);

  fillRect(ox + 228, 255, 10, 10, 85, 90, 110);
  setPixel(ox + 231, 258, 130, 100, 220, 200);
  setPixel(ox + 232, 259, 130, 100, 220, 200);
  setPixel(ox + 233, 258, 130, 100, 220, 200);
  setPixel(ox + 234, 260, 130, 100, 220, 200);

  fillRect(ox + 242, 250, 11, 11, 88, 92, 112);
  setPixel(ox + 245, 253, 80, 200, 220, 200);
  setPixel(ox + 246, 254, 80, 200, 220, 200);
  setPixel(ox + 247, 253, 80, 200, 220, 200);
  setPixel(ox + 248, 255, 80, 200, 220, 200);

  // Dust particles (scattered lighter dots)
  const dustSpots = [
    [ox+175, 270], [ox+190, 275], [ox+205, 268], [ox+220, 278],
    [ox+240, 272], [ox+250, 265], [ox+185, 260], [ox+235, 260],
  ];
  dustSpots.forEach(([dx, dy]) => {
    setPixel(dx, dy, 120, 125, 145, 100);
    setPixel(dx+1, dy, 115, 120, 140, 80);
  });

  // Magnifying lens
  drawCircle(ox + 200, 265, 5, 160, 180, 210, 140); // glass tint
  drawCircle(ox + 200, 265, 5, 130, 150, 180, 100); // outline
  for (let a = 0; a < 360; a += 5) {
    const rad = a * Math.PI / 180;
    const px = Math.round(ox + 200 + Math.cos(rad) * 5);
    const py = Math.round(265 + Math.sin(rad) * 5);
    setPixel(px, py, 140, 160, 190, 200);
  }
  // Handle
  drawLine(ox + 204, 269, ox + 210, 275, 140, 120, 80);
  drawLine(ox + 205, 269, ox + 211, 275, 140, 120, 80);

  // ============================================================
  // AMBIENT FURNITURE
  // ============================================================

  // Bookshelf against right wall (tall, ~30x120px)
  fillRect(ox + W - 42, 30, 30, 120, 65, 45, 35);
  // Shelves
  for (let s = 0; s < 5; s++) {
    const sy = 38 + s * 24;
    fillRect(ox + W - 42, sy, 30, 3, 55, 38, 28);
    // Book spines
    for (let b = 0; b < 5; b++) {
      const bx = ox + W - 40 + b * 5;
      const bh = 8 + (b * 3) % 10;
      const colors = [[80, 50, 140], [140, 50, 60], [50, 110, 60], [50, 80, 140], [120, 90, 50]];
      const c = colors[b % 5];
      fillRect(bx, sy - bh, 4, bh, c[0], c[1], c[2]);
    }
  }
  // Bookshelf dark edge
  fillRect(ox + W - 42, 148, 30, 2, 50, 35, 25);

  // Potion shelves on left wall (~25x80px)
  fillRect(ox + 12, 170, 25, 80, 55, 40, 60);
  // Shelf boards
  for (let s = 0; s < 4; s++) {
    const sy = 180 + s * 20;
    fillRect(ox + 12, sy, 25, 2, 45, 32, 50);
    // Potion bottles
    const bottleColors = [[50, 180, 70], [60, 100, 200], [190, 50, 50], [180, 140, 50]];
    for (let b = 0; b < 3; b++) {
      const bx = ox + 16 + b * 7;
      const bc = bottleColors[(s + b) % 4];
      fillRect(bx, sy - 8, 4, 8, bc[0], bc[1], bc[2], 200);
      fillRect(bx + 1, sy - 11, 2, 3, bc[0], bc[1], bc[2], 180); // neck
    }
  }

  // Spell circle on floor (large ~60px diameter, bottom-left)
  const scCx = ox + 80, scCy = 210;
  for (let a = 0; a < 360; a += 1) {
    const rad = a * Math.PI / 180;
    const px = Math.round(scCx + Math.cos(rad) * 30);
    const py = Math.round(scCy + Math.sin(rad) * 30);
    setPixel(px, py, 130, 70, 200, 120);
  }
  // Inner circle
  for (let a = 0; a < 360; a += 2) {
    const rad = a * Math.PI / 180;
    const px = Math.round(scCx + Math.cos(rad) * 20);
    const py = Math.round(scCy + Math.sin(rad) * 20);
    setPixel(px, py, 130, 70, 200, 90);
  }
  // Pentagram lines inside circle
  const pentPts = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i * 72 - 90) * Math.PI / 180;
    pentPts.push([Math.round(scCx + Math.cos(angle) * 20), Math.round(scCy + Math.sin(angle) * 20)]);
  }
  for (let i = 0; i < 5; i++) {
    const j = (i + 2) % 5;
    drawLine(pentPts[i][0], pentPts[i][1], pentPts[j][0], pentPts[j][1], 130, 70, 200);
  }

  // Candelabra near top-right (~10x40px)
  fillRect(ox + 380, 30, 4, 40, 160, 140, 80); // main stand
  fillRect(ox + 376, 68, 12, 3, 140, 120, 65); // base
  // Three candle arms
  fillRect(ox + 374, 28, 3, 6, 200, 180, 130); // left candle
  setPixel(ox + 375, 27, 255, 220, 80);
  setPixel(ox + 375, 26, 255, 200, 50);
  fillRect(ox + 381, 26, 3, 6, 200, 180, 130); // center candle
  setPixel(ox + 382, 25, 255, 220, 80);
  setPixel(ox + 382, 24, 255, 200, 50);
  fillRect(ox + 388, 28, 3, 6, 200, 180, 130); // right candle
  setPixel(ox + 389, 27, 255, 220, 80);
  setPixel(ox + 389, 26, 255, 200, 50);
  // Arms
  drawLine(ox + 375, 33, ox + 382, 33, 150, 130, 70);
  drawLine(ox + 382, 33, ox + 389, 33, 150, 130, 70);

  // Crystal display case (~20x25px, near center-top)
  fillRect(ox + 320, 45, 20, 25, 100, 110, 140, 120); // glass case
  fillRect(ox + 322, 47, 16, 21, 80, 90, 120, 100);   // interior
  // Glowing crystal inside
  drawCircle(ox + 330, 57, 4, 160, 100, 240, 200);
  drawCircle(ox + 330, 57, 2, 200, 150, 255, 240);
  // Glass edges
  fillRect(ox + 320, 45, 20, 1, 140, 150, 180, 180);
  fillRect(ox + 320, 69, 20, 1, 90, 100, 130, 180);

  // Cauldron in corner (bottom-right, ~15px circle, dark with green glow)
  drawCircle(ox + W - 40, H - 35, 10, 30, 28, 35);
  drawCircle(ox + W - 40, H - 35, 8, 20, 18, 25);
  // Green glow at rim
  for (let a = 0; a < 360; a += 4) {
    const rad = a * Math.PI / 180;
    const px = Math.round(ox + W - 40 + Math.cos(rad) * 9);
    const py = Math.round(H - 35 + Math.sin(rad) * 9);
    setPixel(px, py, 60, 200, 80, 150);
  }
  // Bubbling liquid surface
  drawCircle(ox + W - 42, H - 37, 2, 80, 220, 100, 160);
  drawCircle(ox + W - 38, H - 33, 1, 80, 220, 100, 140);

  // Scattered loose pages on floor (3-4 small white/tan rectangles)
  fillRect(ox + 200, 160, 4, 3, 220, 215, 200, 200);
  fillRect(ox + 310, 105, 3, 4, 230, 225, 210, 200);
  fillRect(ox + 150, 190, 4, 3, 215, 210, 195, 180);
  fillRect(ox + 350, 220, 3, 4, 225, 220, 205, 190);

  // --- PURPLE GLOW SPOTS near magical objects ---
  const glowSpots = [
    [ox + 100, 95, 8],    // enchanting table crystal
    [ox + 80, 210, 10],   // spell circle center
    [ox + 330, 57, 6],    // crystal display
    [ox + W - 40, H - 35, 6], // cauldron
    [ox + 220, 256, 5],   // rune stones
  ];
  glowSpots.forEach(([gx, gy, gr]) => {
    for (let dy = -gr; dy <= gr; dy++) {
      for (let dx = -gr; dx <= gr; dx++) {
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= gr && dist > gr * 0.5) {
          const alpha = Math.floor(40 * (1 - dist / gr));
          setPixel(gx + dx, gy + dy, 100, 60, 180, alpha);
        }
      }
    }
  });
}

// =====================================================================
// Building 1 (offset 464): Training Grounds Interior
// Top-down arena/workshop: red/brown theme, packed dirt/sand floor
// Stations: target dummy, obstacle course, potion station
// =====================================================================
function drawTrainingGrounds(ox) {
  const W = BLDG_W;
  const H = BLDG_H;

  // --- FLOOR: Packed dirt/sand base ---
  fillRect(ox, 0, W, H, 140, 110, 70);

  // Dirt variation patches (darker, 5-8px irregular shapes)
  const dirtPatches = [
    [ox+50, 60, 7, 5], [ox+180, 40, 6, 6], [ox+350, 80, 8, 5],
    [ox+90, 150, 5, 7], [ox+280, 160, 7, 6], [ox+420, 140, 6, 5],
    [ox+60, 250, 8, 6], [ox+200, 290, 6, 7], [ox+370, 270, 7, 5],
    [ox+150, 100, 5, 6], [ox+320, 220, 6, 8],
  ];
  dirtPatches.forEach(([px, py, pw, ph]) => {
    fillRect(px, py, pw, ph, 120, 92, 55);
  });

  // Small pebble dots (~30 scattered)
  const pebbles = [
    [ox+30, 25], [ox+80, 45], [ox+140, 70], [ox+210, 30], [ox+270, 55],
    [ox+340, 35], [ox+400, 65], [ox+55, 120], [ox+130, 145], [ox+230, 120],
    [ox+310, 130], [ox+390, 105], [ox+450, 45], [ox+45, 200], [ox+170, 230],
    [ox+280, 240], [ox+360, 200], [ox+430, 230], [ox+70, 290], [ox+150, 310],
    [ox+250, 300], [ox+340, 310], [ox+410, 290], [ox+100, 85], [ox+200, 175],
    [ox+320, 170], [ox+440, 165], [ox+30, 315], [ox+190, 145], [ox+380, 155],
  ];
  pebbles.forEach(([px, py]) => {
    if (py > 12 && py < H - 12 && px > ox + 12 && px < ox + W - 12) {
      setPixel(px, py, 125, 98, 62);
      setPixel(px+1, py, 150, 118, 78);
    }
  });

  // Central sparring ring (lighter sand, ~80px diameter)
  const ringCx = ox + W / 2, ringCy = H / 2 + 10;
  for (let dy = -40; dy <= 40; dy++) {
    for (let dx = -40; dx <= 40; dx++) {
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= 40) {
        const px = ringCx + dx, py = ringCy + dy;
        if (px > ox + 12 && px < ox + W - 12 && py > 12 && py < H - 12) {
          setPixel(px, py, 155, 125, 82);
        }
      }
    }
  }
  // Ring outline
  for (let a = 0; a < 360; a += 1) {
    const rad = a * Math.PI / 180;
    const px = Math.round(ringCx + Math.cos(rad) * 40);
    const py = Math.round(ringCy + Math.sin(rad) * 40);
    if (px > ox + 12 && px < ox + W - 12 && py > 12 && py < H - 12) {
      setPixel(px, py, 110, 85, 50);
      setPixel(px+1, py, 110, 85, 50);
    }
  }

  // --- WALLS: 10px wooden palisade border ---
  // Top wall
  fillRect(ox, 0, W, 12, 90, 60, 30);
  // Bottom wall
  fillRect(ox, H - 12, W, 12, 90, 60, 30);
  // Left wall
  fillRect(ox, 0, 12, H, 90, 60, 30);
  // Right wall
  fillRect(ox + W - 12, 0, 12, H, 90, 60, 30);

  // Vertical plank lines in walls (2px spacing)
  for (let i = 0; i < Math.ceil(W / 6); i++) {
    const wx = ox + i * 6;
    if (wx < ox + W) {
      // Top wall planks
      for (let y = 0; y < 12; y++) setPixel(wx, y, 78, 50, 24);
      // Bottom wall planks
      for (let y = H - 12; y < H; y++) setPixel(wx, y, 78, 50, 24);
    }
  }
  for (let i = 0; i < Math.ceil(H / 6); i++) {
    const wy = i * 6;
    if (wy < H) {
      // Left wall planks
      for (let x = ox; x < ox + 12; x++) setPixel(x, wy, 78, 50, 24);
      // Right wall planks
      for (let x = ox + W - 12; x < ox + W; x++) setPixel(x, wy, 78, 50, 24);
    }
  }

  // Knot details on planks (scattered 2px circles)
  const knots = [
    [ox+3, 30], [ox+5, 120], [ox+7, 220], [ox+4, 300],
    [ox+W-5, 50], [ox+W-7, 180], [ox+W-4, 280],
    [ox+60, 4], [ox+180, 6], [ox+300, 3], [ox+420, 7],
    [ox+100, H-5], [ox+250, H-7], [ox+380, H-4],
  ];
  knots.forEach(([kx, ky]) => {
    drawCircle(kx, ky, 1, 70, 42, 18);
  });

  // ============================================================
  // STATION 1: Target Dummy (top-right area, ~x:320-400, y:50-140)
  // ============================================================
  // Wooden post
  fillRect(ox + 356, 60, 8, 60, 150, 120, 70);
  // Wood grain
  for (let y = 65; y < 120; y += 8) {
    fillRect(ox + 357, y, 6, 1, 135, 105, 58);
  }
  // Cross-arm
  fillRect(ox + 340, 75, 40, 6, 145, 115, 65);

  // Hay-stuffed torso (rounded shape)
  fillRect(ox + 348, 80, 24, 35, 195, 175, 100);
  // Rounded top
  drawCircle(ox + 360, 82, 12, 195, 175, 100);
  // Hay texture lines
  for (let i = 0; i < 6; i++) {
    const hx = ox + 350 + i * 4;
    drawLine(hx, 85 + i % 3, hx + 2, 110 - i % 4, 175, 155, 85);
  }

  // Target circles on chest (concentric)
  drawCircle(ox + 360, 98, 10, 190, 50, 40);  // outer red
  drawCircle(ox + 360, 98, 7, 240, 235, 225);  // white ring
  drawCircle(ox + 360, 98, 4, 190, 50, 40);    // inner red
  drawCircle(ox + 360, 98, 1, 255, 255, 200);  // center

  // Scattered arrows stuck in dummy and floor
  drawLine(ox + 355, 90, ox + 350, 80, 130, 110, 60); // in dummy
  drawLine(ox + 365, 100, ox + 370, 92, 130, 110, 60);
  // Arrow in floor
  drawLine(ox + 340, 125, ox + 338, 135, 130, 110, 60);
  setPixel(ox + 338, 135, 160, 140, 80);
  drawLine(ox + 375, 130, ox + 378, 140, 130, 110, 60);
  setPixel(ox + 378, 140, 160, 140, 80);
  // Arrow fletching (small V marks)
  setPixel(ox + 349, 79, 200, 50, 40);
  setPixel(ox + 351, 79, 200, 50, 40);
  setPixel(ox + 369, 91, 200, 50, 40);
  setPixel(ox + 371, 91, 200, 50, 40);

  // Wooden bucket with arrows
  fillRect(ox + 330, 115, 12, 15, 110, 80, 40);
  fillRect(ox + 330, 115, 12, 2, 95, 65, 30); // metal band
  fillRect(ox + 330, 127, 12, 2, 95, 65, 30);
  // Arrows poking out
  drawLine(ox + 333, 108, ox + 333, 115, 130, 110, 60);
  drawLine(ox + 336, 106, ox + 336, 115, 130, 110, 60);
  drawLine(ox + 339, 109, ox + 339, 115, 130, 110, 60);

  // Shading on dummy post
  fillRect(ox + 362, 60, 2, 60, 130, 100, 55);

  // ============================================================
  // STATION 2: Obstacle Course (center area, ~x:140-320, y:140-230)
  // ============================================================
  // Sand slightly more worn in this area
  fillRect(ox + 140, 140, 180, 90, 148, 120, 78);

  // Hurdle bars (3 sets: posts + horizontal beam)
  // Hurdle 1
  fillRect(ox + 155, 150, 4, 25, 120, 85, 45);
  fillRect(ox + 185, 150, 4, 25, 120, 85, 45);
  fillRect(ox + 155, 152, 34, 3, 130, 95, 52);
  // Hurdle 2
  fillRect(ox + 215, 165, 4, 20, 120, 85, 45);
  fillRect(ox + 245, 165, 4, 20, 120, 85, 45);
  fillRect(ox + 215, 168, 34, 3, 130, 95, 52);
  // Hurdle 3
  fillRect(ox + 275, 155, 4, 22, 120, 85, 45);
  fillRect(ox + 305, 155, 4, 22, 120, 85, 45);
  fillRect(ox + 275, 158, 34, 3, 130, 95, 52);

  // Rope coils on ground (spiral circles)
  const ropeCoils = [[ox + 165, 195], [ox + 230, 200], [ox + 295, 195]];
  ropeCoils.forEach(([rcx, rcy]) => {
    for (let r = 3; r <= 6; r++) {
      for (let a = 0; a < 360; a += 4) {
        const rad = a * Math.PI / 180;
        const px = Math.round(rcx + Math.cos(rad) * r);
        const py = Math.round(rcy + Math.sin(rad) * r);
        setPixel(px, py, 160, 130, 80);
      }
    }
    drawCircle(rcx, rcy, 2, 150, 120, 70); // center coil
  });

  // Balance beam (long thin plank)
  fillRect(ox + 170, 215, 80, 6, 135, 100, 55);
  // Wood grain on beam
  for (let x = ox + 172; x < ox + 248; x += 10) {
    fillRect(x, 216, 1, 4, 120, 88, 45);
  }
  // Beam supports
  fillRect(ox + 180, 221, 4, 4, 110, 78, 40);
  fillRect(ox + 236, 221, 4, 4, 110, 78, 40);
  // Beam highlight
  for (let x = ox + 170; x < ox + 250; x++) setPixel(x, 215, 148, 112, 65);

  // Tire-like rope rings on ground
  const tireRings = [[ox + 260, 215], [ox + 278, 218], [ox + 296, 214], [ox + 314, 217]];
  tireRings.forEach(([tcx, tcy]) => {
    for (let a = 0; a < 360; a += 5) {
      const rad = a * Math.PI / 180;
      const px = Math.round(tcx + Math.cos(rad) * 6);
      const py = Math.round(tcy + Math.sin(rad) * 6);
      setPixel(px, py, 130, 100, 55);
      setPixel(px, py + 1, 125, 95, 50);
    }
  });

  // Sweat/exertion indicators (tiny blue dots)
  const sweatDrops = [
    [ox + 200, 185], [ox + 250, 190], [ox + 185, 208], [ox + 270, 205],
  ];
  sweatDrops.forEach(([sx, sy]) => {
    setPixel(sx, sy, 100, 140, 200, 160);
    setPixel(sx, sy + 1, 80, 120, 180, 120);
  });

  // ============================================================
  // STATION 3: Potion Station (bottom-left area, ~x:40-150, y:230-310)
  // ============================================================
  // Sturdy wooden table
  fillRect(ox + 40, 250, 70, 10, 110, 80, 45);
  // Table legs
  fillRect(ox + 45, 260, 5, 20, 95, 68, 35);
  fillRect(ox + 100, 260, 5, 20, 95, 68, 35);
  // Table surface lighter
  fillRect(ox + 42, 252, 66, 6, 120, 90, 55);
  // Shading
  fillRect(ox + 40, 258, 70, 2, 90, 65, 35);
  fillRect(ox + 108, 250, 2, 10, 90, 65, 35);
  // Highlight
  for (let x = ox + 40; x < ox + 110; x++) setPixel(x, 250, 125, 95, 58);

  // Bubbling cauldron on table
  drawCircle(ox + 62, 248, 10, 35, 30, 28);
  drawCircle(ox + 62, 248, 8, 28, 24, 22);
  // Liquid inside (green-blue gradient)
  drawCircle(ox + 62, 248, 6, 40, 140, 100);
  drawCircle(ox + 62, 249, 4, 50, 160, 120);
  // Bubbles
  drawCircle(ox + 58, 246, 1, 80, 200, 150, 200);
  drawCircle(ox + 64, 244, 1, 80, 200, 150, 180);
  drawCircle(ox + 60, 243, 1, 90, 210, 160, 160);

  // Glass bottles/flasks in rack
  fillRect(ox + 80, 240, 25, 3, 100, 72, 38); // rack shelf
  // Healing red
  fillRect(ox + 82, 233, 4, 8, 200, 50, 50, 210);
  fillRect(ox + 83, 230, 2, 3, 200, 50, 50, 180);
  // Stamina green
  fillRect(ox + 88, 234, 4, 7, 50, 180, 60, 210);
  fillRect(ox + 89, 231, 2, 3, 50, 180, 60, 180);
  // Strength blue
  fillRect(ox + 94, 232, 4, 9, 50, 80, 200, 210);
  fillRect(ox + 95, 229, 2, 3, 50, 80, 200, 180);
  // Speed yellow
  fillRect(ox + 100, 234, 4, 7, 200, 180, 50, 210);
  fillRect(ox + 101, 231, 2, 3, 200, 180, 50, 180);

  // Mortar and pestle
  drawCircle(ox + 95, 254, 4, 130, 125, 115); // bowl
  drawCircle(ox + 95, 254, 2, 150, 145, 135);
  drawLine(ox + 95, 250, ox + 100, 246, 120, 115, 105); // pestle stick
  drawLine(ox + 96, 250, ox + 101, 246, 120, 115, 105);

  // Herb bundles hanging from wall (at top edge of station area)
  fillRect(ox + 48, 235, 6, 8, 50, 120, 45); // herb bundle 1
  fillRect(ox + 50, 233, 2, 4, 80, 60, 30);  // string
  fillRect(ox + 58, 236, 5, 7, 40, 110, 50); // herb bundle 2
  fillRect(ox + 60, 234, 2, 3, 80, 60, 30);
  fillRect(ox + 67, 235, 6, 8, 55, 130, 55); // herb bundle 3
  fillRect(ox + 69, 233, 2, 3, 80, 60, 30);

  // ============================================================
  // AMBIENT FURNITURE
  // ============================================================

  // Weapon rack along left wall (~25x100px)
  fillRect(ox + 14, 40, 25, 100, 100, 70, 38);
  // Rack posts
  fillRect(ox + 14, 40, 3, 100, 85, 58, 28);
  fillRect(ox + 36, 40, 3, 100, 85, 58, 28);
  // Horizontal rack bars
  fillRect(ox + 14, 55, 25, 2, 90, 62, 30);
  fillRect(ox + 14, 90, 25, 2, 90, 62, 30);
  fillRect(ox + 14, 125, 25, 2, 90, 62, 30);
  // Weapons hanging
  // Sword 1
  drawLine(ox + 20, 57, ox + 20, 85, 180, 185, 195);
  fillRect(ox + 18, 57, 5, 2, 140, 120, 60); // crossguard
  // Sword 2
  drawLine(ox + 27, 57, ox + 27, 82, 175, 180, 190);
  fillRect(ox + 25, 57, 5, 2, 140, 120, 60);
  // Axe head
  fillRect(ox + 19, 92, 8, 12, 170, 175, 185);
  drawLine(ox + 23, 92, ox + 23, 120, 130, 100, 55); // handle
  // Mace
  drawCircle(ox + 32, 96, 4, 160, 165, 175);
  drawLine(ox + 32, 100, ox + 32, 122, 130, 100, 55);

  // Armor stand in top-left (~20x40px)
  fillRect(ox + 50, 25, 4, 40, 120, 90, 50); // stand pole
  fillRect(ox + 42, 62, 20, 3, 110, 80, 42); // base
  // T-bar
  fillRect(ox + 40, 28, 24, 3, 115, 85, 45);
  // Chest plate shape
  fillRect(ox + 44, 31, 16, 18, 150, 155, 160);
  // Plate highlight
  fillRect(ox + 45, 32, 14, 2, 170, 175, 180);
  // Plate shading
  fillRect(ox + 44, 47, 16, 2, 130, 135, 140);

  // Barrel cluster in bottom-right corner
  drawCircle(ox + W - 35, H - 35, 10, 110, 78, 40);
  drawCircle(ox + W - 35, H - 35, 8, 120, 88, 48);
  // Metal bands
  for (let a = 0; a < 360; a += 3) {
    const rad = a * Math.PI / 180;
    setPixel(Math.round(ox + W - 35 + Math.cos(rad) * 9), Math.round(H - 35 + Math.sin(rad) * 9), 100, 100, 105);
    setPixel(Math.round(ox + W - 35 + Math.cos(rad) * 6), Math.round(H - 35 + Math.sin(rad) * 6), 100, 100, 105);
  }
  // Second barrel (overlapping)
  drawCircle(ox + W - 50, H - 28, 9, 105, 75, 38);
  drawCircle(ox + W - 50, H - 28, 7, 115, 85, 45);
  for (let a = 0; a < 360; a += 4) {
    const rad = a * Math.PI / 180;
    setPixel(Math.round(ox + W - 50 + Math.cos(rad) * 8), Math.round(H - 28 + Math.sin(rad) * 8), 100, 100, 105);
  }
  // Third barrel
  drawCircle(ox + W - 25, H - 22, 8, 108, 76, 39);
  drawCircle(ox + W - 25, H - 22, 6, 118, 86, 46);

  // Training bench for resting (~60x14px near bottom wall)
  fillRect(ox + 170, H - 30, 60, 8, 115, 82, 42);
  fillRect(ox + 175, H - 22, 4, 8, 100, 70, 35);
  fillRect(ox + 222, H - 22, 4, 8, 100, 70, 35);
  // Wood grain
  for (let x = ox + 172; x < ox + 228; x += 8) {
    fillRect(x, H - 29, 1, 6, 100, 70, 35);
  }
  // Highlight
  for (let x = ox + 170; x < ox + 230; x++) setPixel(x, H - 30, 128, 95, 52);

  // Water trough (~40x15px, near right wall)
  fillRect(ox + W - 55, 170, 40, 15, 100, 75, 40);
  fillRect(ox + W - 53, 172, 36, 11, 70, 110, 150); // water inside
  // Slight wave highlight
  fillRect(ox + W - 50, 174, 8, 1, 100, 140, 180);
  fillRect(ox + W - 38, 176, 6, 1, 100, 140, 180);

  // Hanging banner on back wall (~15x40px in deep red)
  fillRect(ox + W / 2 - 8, 14, 16, 40, 150, 35, 30);
  // Banner border
  fillRect(ox + W / 2 - 8, 14, 16, 2, 170, 50, 45);
  fillRect(ox + W / 2 - 8, 14, 2, 40, 170, 50, 45);
  fillRect(ox + W / 2 + 6, 14, 2, 40, 130, 25, 20);
  // Simple emblem (crossed swords symbol)
  drawLine(ox + W / 2 - 3, 22, ox + W / 2 + 3, 42, 200, 180, 80);
  drawLine(ox + W / 2 + 3, 22, ox + W / 2 - 3, 42, 200, 180, 80);
  // Banner point at bottom
  fillRect(ox + W / 2 - 8, 52, 7, 2, 150, 35, 30);
  fillRect(ox + W / 2 - 6, 54, 5, 1, 150, 35, 30);

  // Sandbag near obstacle area
  drawCircle(ox + 135, 185, 6, 170, 150, 105);
  drawCircle(ox + 135, 185, 4, 160, 140, 95);
  // Tie at top
  fillRect(ox + 134, 179, 3, 2, 130, 100, 55);

  // Chalk scoreboard on wall (~20x15px, right wall area)
  fillRect(ox + W - 55, 30, 22, 16, 55, 55, 60);
  fillRect(ox + W - 53, 32, 18, 12, 50, 50, 55);
  // White tick marks
  for (let i = 0; i < 4; i++) {
    fillRect(ox + W - 50 + i * 4, 34, 1, 8, 210, 210, 215);
  }
  // Cross-line for 5th mark
  drawLine(ox + W - 51, 40, ox + W - 36, 34, 210, 210, 215);

  // Scattered sawdust patches (lighter tan spots)
  const sawdustSpots = [
    [ox+100, 100, 4, 3], [ox+250, 80, 3, 4], [ox+380, 160, 5, 3],
    [ox+200, 130, 4, 3], [ox+330, 260, 3, 5], [ox+120, 220, 4, 3],
  ];
  sawdustSpots.forEach(([sx, sy, sw, sh]) => {
    if (sy > 14 && sy + sh < H - 14 && sx > ox + 14 && sx + sw < ox + W - 14) {
      fillRect(sx, sy, sw, sh, 160, 135, 95);
    }
  });

  // --- SUN HIGHLIGHT: warm top-left edge on objects ---
  // This is handled by the individual highlight lines on each furniture piece above
}

// =====================================================================
// Building 2 (offset 928): Ancient Library Interior
// Top-down study hall: teal/gold theme, polished marble floor/walls
// Stations: crystal ball, bookshelves, map table
// =====================================================================
function drawAncientLibrary(ox) {
  const W = BLDG_W;
  const H = BLDG_H;

  // --- FLOOR: Polished marble base ---
  fillRect(ox, 0, W, H, 195, 190, 175);

  // Subtle gradient: lighter center, slightly darker near walls
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - W / 2, dy = y - H / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.sqrt((W / 2) * (W / 2) + (H / 2) * (H / 2));
      const darken = Math.floor((dist / maxDist) * 12);
      const bx = ox + x, by = y;
      if (bx >= ox && bx < ox + W && by >= 0 && by < H) {
        const idx = (by * WIDTH + bx) * 4;
        png.data[idx] = Math.max(0, png.data[idx] - darken);
        png.data[idx + 1] = Math.max(0, png.data[idx + 1] - darken);
        png.data[idx + 2] = Math.max(0, png.data[idx + 2] - darken);
      }
    }
  }

  // Tile grid pattern (light lines every ~40px forming large square tiles)
  for (let ty = 0; ty < H; ty += 40) {
    for (let x = ox + 10; x < ox + W - 10; x++) {
      if (ty > 10 && ty < H - 10) setPixel(x, ty, 205, 200, 185);
    }
  }
  for (let tx = 10; tx < W; tx += 40) {
    for (let y = 10; y < H - 10; y++) {
      setPixel(ox + tx, y, 205, 200, 185);
    }
  }

  // Marble veining -- 4 meandering lines across the floor
  const veins = [
    { startX: 30, startY: 60, endX: 430, endY: 100 },
    { startX: 50, startY: 180, endX: 400, endY: 220 },
    { startX: 100, startY: 20, endX: 350, endY: 300 },
    { startX: 20, startY: 280, endX: 440, endY: 260 },
  ];
  veins.forEach(v => {
    let x = v.startX, y = v.startY;
    const steps = 80;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const px = Math.round(v.startX + (v.endX - v.startX) * t + Math.sin(t * 8) * 12);
      const py = Math.round(v.startY + (v.endY - v.startY) * t + Math.cos(t * 6) * 8);
      if (px > 10 && px < W - 10 && py > 10 && py < H - 10) {
        setPixel(ox + px, py, 210, 205, 192);
      }
    }
  });

  // Gold inlay lines along some tile edges (1px gold-tinted)
  for (let ty = 40; ty < H - 40; ty += 80) {
    for (let x = ox + 12; x < ox + W - 12; x++) {
      if (ty > 10 && ty < H - 10) setPixel(x, ty, 200, 180, 80, 100);
    }
  }
  for (let tx = 40; tx < W - 40; tx += 80) {
    for (let y = 12; y < H - 12; y++) {
      setPixel(ox + tx, y, 200, 180, 80, 100);
    }
  }

  // --- WALLS: 10px marble border on all sides ---
  fillRect(ox, 0, W, 10, 175, 170, 155);
  fillRect(ox, H - 10, W, 10, 175, 170, 155);
  fillRect(ox, 0, 10, H, 175, 170, 155);
  fillRect(ox + W - 10, 0, 10, H, 175, 170, 155);

  // Gold trim line (1px) along inner wall edge
  for (let x = ox + 10; x < ox + W - 10; x++) {
    setPixel(x, 10, 200, 180, 80);
    setPixel(x, H - 11, 200, 180, 80);
  }
  for (let y = 10; y < H - 10; y++) {
    setPixel(ox + 10, y, 200, 180, 80);
    setPixel(ox + W - 11, y, 200, 180, 80);
  }

  // Marble columns at corners and along walls (3 per long wall)
  const columnPositions = [
    // Corners
    { cx: ox + 14, cy: 14 }, { cx: ox + W - 15, cy: 14 },
    { cx: ox + 14, cy: H - 15 }, { cx: ox + W - 15, cy: H - 15 },
    // Top wall
    { cx: ox + 120, cy: 7 }, { cx: ox + 232, cy: 7 }, { cx: ox + 344, cy: 7 },
    // Bottom wall
    { cx: ox + 120, cy: H - 8 }, { cx: ox + 232, cy: H - 8 }, { cx: ox + 344, cy: H - 8 },
    // Left wall
    { cx: ox + 7, cy: 90 }, { cx: ox + 7, cy: 168 }, { cx: ox + 7, cy: 246 },
    // Right wall
    { cx: ox + W - 8, cy: 90 }, { cx: ox + W - 8, cy: 168 }, { cx: ox + W - 8, cy: 246 },
  ];
  columnPositions.forEach(col => {
    // Column: 14x14 circle with lighter center and darker edge
    drawCircle(col.cx, col.cy, 7, 160, 155, 140);
    drawCircle(col.cx, col.cy, 5, 185, 180, 165);
    drawCircle(col.cx, col.cy, 2, 210, 205, 195);
  });

  // ============================================================
  // CARPET/RUG under reading area (center-left area)
  // Deep teal with gold border pattern ~80x60px
  // ============================================================
  fillRect(ox + 130, 120, 80, 60, 30, 80, 75);
  // Gold border
  fillRect(ox + 130, 120, 80, 2, 200, 180, 80);
  fillRect(ox + 130, 178, 80, 2, 200, 180, 80);
  fillRect(ox + 130, 120, 2, 60, 200, 180, 80);
  fillRect(ox + 208, 120, 2, 60, 200, 180, 80);
  // Inner border
  fillRect(ox + 134, 124, 72, 1, 180, 160, 70);
  fillRect(ox + 134, 175, 72, 1, 180, 160, 70);
  fillRect(ox + 134, 124, 1, 52, 180, 160, 70);
  fillRect(ox + 205, 124, 1, 52, 180, 160, 70);
  // Teal pattern inside carpet
  for (let cy = 128; cy < 174; cy += 8) {
    for (let cx = ox + 138; cx < ox + 202; cx += 8) {
      setPixel(cx, cy, 50, 110, 100);
    }
  }

  // ============================================================
  // STATION 1: Crystal Ball (top-left area, ~x:60-140, y:60-140)
  // ============================================================

  // Constellation charts table beside crystal ball (~30x20px)
  fillRect(ox + 100, 90, 30, 20, 80, 60, 45);
  fillRect(ox + 102, 92, 26, 16, 90, 70, 55);
  // Tiny dot patterns on surface (constellation)
  setPixel(ox + 106, 96, 200, 200, 220); setPixel(ox + 110, 94, 200, 200, 220);
  setPixel(ox + 115, 99, 200, 200, 220); setPixel(ox + 120, 95, 200, 200, 220);
  setPixel(ox + 108, 101, 200, 200, 220); setPixel(ox + 118, 102, 200, 200, 220);
  // Connect some dots (constellation lines)
  drawLine(ox + 106, 96, ox + 110, 94, 180, 180, 200);
  drawLine(ox + 110, 94, ox + 115, 99, 180, 180, 200);
  drawLine(ox + 115, 99, ox + 120, 95, 180, 180, 200);

  // Ornate pedestal (~14x30px stone column)
  fillRect(ox + 80, 100, 14, 30, 165, 160, 150);
  fillRect(ox + 78, 128, 18, 4, 175, 170, 160); // base
  fillRect(ox + 78, 98, 18, 4, 175, 170, 160); // top
  // Pedestal fluting
  for (let y = 102; y < 128; y++) {
    setPixel(ox + 83, y, 155, 150, 138);
    setPixel(ox + 87, y, 180, 175, 165);
    setPixel(ox + 90, y, 155, 150, 138);
  }

  // Large crystal sphere on top (~20px diameter)
  // Glow aura first (behind the ball)
  drawCircle(ox + 87, 88, 16, 40, 140, 140, 40);
  drawCircle(ox + 87, 88, 13, 50, 160, 155, 50);
  // The sphere itself
  drawCircle(ox + 87, 88, 10, 60, 170, 180, 220);
  drawCircle(ox + 87, 88, 8, 80, 200, 210, 235);
  drawCircle(ox + 87, 88, 5, 120, 220, 230, 245);
  drawCircle(ox + 87, 88, 2, 200, 245, 250, 255);
  // Teal-blue rim glow
  for (let a = 0; a < 360; a += 3) {
    const rad = a * Math.PI / 180;
    const px = Math.round(ox + 87 + Math.cos(rad) * 10);
    const py = Math.round(88 + Math.sin(rad) * 10);
    setPixel(px, py, 40, 180, 180, 180);
  }

  // Divination cards scattered nearby (3-4 small rectangles)
  fillRect(ox + 67, 120, 5, 4, 200, 180, 120);
  fillRect(ox + 74, 118, 5, 4, 140, 100, 160);
  fillRect(ox + 62, 114, 5, 4, 100, 140, 160);
  fillRect(ox + 72, 126, 5, 4, 180, 160, 100);

  // ============================================================
  // STATION 2: Ancient Bookshelves (right side, ~x:320-440, y:60-260)
  // Massive floor-to-wall bookshelf system (~100x180px)
  // ============================================================

  // Main bookshelf frame (dark wood)
  fillRect(ox + 330, 30, 110, 210, 65, 42, 28);
  // Shelf frame border
  fillRect(ox + 330, 30, 110, 3, 55, 35, 22);
  fillRect(ox + 330, 237, 110, 3, 55, 35, 22);
  fillRect(ox + 330, 30, 3, 210, 55, 35, 22);
  fillRect(ox + 437, 30, 3, 210, 55, 35, 22);

  // Multiple shelf rows (7 shelves) with books
  for (let shelf = 0; shelf < 7; shelf++) {
    const sy = 42 + shelf * 28;
    // Shelf plank
    fillRect(ox + 333, sy + 22, 104, 4, 80, 55, 35);
    // Highlight on shelf front edge
    for (let x = ox + 333; x < ox + 437; x++) setPixel(x, sy + 22, 90, 65, 42);

    // Books of varying heights, widths, and colors
    let bx = ox + 335;
    const bookColors = [
      [40, 80, 120], [120, 40, 40], [40, 100, 50], [100, 60, 120],
      [80, 80, 40], [60, 40, 100], [140, 80, 40], [50, 90, 90],
      [100, 40, 60], [70, 110, 70], [90, 50, 80], [120, 100, 40],
    ];
    let bookIdx = shelf * 3;
    while (bx < ox + 434) {
      const bw = 4 + (bookIdx * 3) % 4; // 4-7px wide
      const bh = 8 + (bookIdx * 7) % 10; // 8-17px tall
      const col = bookColors[bookIdx % bookColors.length];

      // Some books leaning (every 5th)
      if (bookIdx % 5 === 3 && bx + bw + 3 < ox + 434) {
        // Leaning book -- draw at slight offset
        for (let dy = 0; dy < bh; dy++) {
          const lean = Math.floor(dy / 4);
          fillRect(bx + lean, sy + 22 - bh + dy, bw, 1, col[0], col[1], col[2]);
        }
        // Gold spine highlight on some larger books
        if (bh > 13) {
          for (let dy = 2; dy < bh - 2; dy += 3) {
            const lean = Math.floor(dy / 4);
            setPixel(bx + lean + Math.floor(bw / 2), sy + 22 - bh + dy, 200, 180, 80);
          }
        }
      } else {
        fillRect(bx, sy + 22 - bh, bw, bh, col[0], col[1], col[2]);
        // Gold-lettered spine highlights on larger volumes
        if (bh > 13) {
          for (let dy = 2; dy < bh - 2; dy += 3) {
            setPixel(bx + Math.floor(bw / 2), sy + 22 - bh + dy, 200, 180, 80);
          }
        }
      }

      // Some pulled-out books (every 7th)
      if (bookIdx % 7 === 2) {
        fillRect(bx, sy + 22 - bh - 2, bw, 2, col[0] + 20, col[1] + 20, col[2] + 20);
      }

      bx += bw + 1;
      bookIdx++;
    }

    // Scrolls tucked between books on some shelves (parchment cylinders)
    if (shelf % 3 === 1) {
      const scrollX = ox + 420;
      fillRect(scrollX, sy + 14, 8, 6, 200, 185, 140);
      drawCircle(scrollX, sy + 17, 3, 200, 185, 140);
      drawCircle(scrollX + 8, sy + 17, 3, 200, 185, 140);
    }
  }

  // Reading ladder leaning against shelf (thin angled line + rungs)
  drawLine(ox + 322, 230, ox + 335, 40, 100, 70, 40);
  drawLine(ox + 326, 230, ox + 339, 40, 100, 70, 40);
  // Rungs
  for (let i = 0; i < 7; i++) {
    const t = 0.1 + i * 0.12;
    const lx = Math.round(322 + (335 - 322) * t);
    const ly = Math.round(230 + (40 - 230) * t);
    drawLine(ox + lx, ly, ox + lx + 4, ly, 110, 80, 45);
  }

  // ============================================================
  // STATION 3: Map Table (bottom-center, ~x:140-300, y:230-310)
  // Large heavy table (~120x60px) in rich dark wood
  // ============================================================

  // Table body
  fillRect(ox + 160, 245, 120, 50, 70, 50, 35);
  // Table top surface (slightly lighter)
  fillRect(ox + 158, 243, 124, 48, 80, 60, 42);
  // Dark edge shading (2px bottom/right)
  fillRect(ox + 158, 289, 124, 2, 55, 38, 25);
  fillRect(ox + 280, 243, 2, 48, 55, 38, 25);
  // Highlight top/left (1px)
  for (let x = ox + 158; x < ox + 282; x++) setPixel(x, 243, 90, 70, 52);
  for (let y = 243; y < 291; y++) setPixel(ox + 158, y, 90, 70, 52);
  // Wood grain lines on table
  for (let y = 248; y < 288; y += 5) {
    for (let x = ox + 162; x < ox + 278; x++) {
      setPixel(x, y, 72, 52, 36);
    }
  }

  // Map on table surface (parchment rectangle with details)
  fillRect(ox + 175, 250, 80, 40, 220, 205, 160);
  // Parchment edge darkening
  fillRect(ox + 175, 250, 80, 1, 200, 185, 140);
  fillRect(ox + 175, 289, 80, 1, 200, 185, 140);

  // Coastline-like irregular lines on map
  const coastPoints = [
    [ox + 185, 258], [ox + 190, 262], [ox + 195, 260], [ox + 200, 265],
    [ox + 208, 263], [ox + 215, 268], [ox + 220, 266], [ox + 228, 270],
    [ox + 235, 268], [ox + 240, 272], [ox + 245, 269],
  ];
  for (let i = 0; i < coastPoints.length - 1; i++) {
    drawLine(coastPoints[i][0], coastPoints[i][1], coastPoints[i + 1][0], coastPoints[i + 1][1], 100, 140, 120);
  }
  // Second coastline
  const coast2 = [
    [ox + 188, 275], [ox + 195, 278], [ox + 205, 276], [ox + 212, 280],
    [ox + 220, 278], [ox + 230, 282], [ox + 238, 279],
  ];
  for (let i = 0; i < coast2.length - 1; i++) {
    drawLine(coast2[i][0], coast2[i][1], coast2[i + 1][0], coast2[i + 1][1], 100, 140, 120);
  }

  // Tiny dot "cities" on map
  setPixel(ox + 198, 257, 140, 40, 40); setPixel(ox + 210, 260, 140, 40, 40);
  setPixel(ox + 225, 262, 140, 40, 40); setPixel(ox + 240, 266, 140, 40, 40);

  // Compass rose on map (small star/cross shape)
  const crx = ox + 245, cry = 256;
  setPixel(crx, cry - 3, 120, 80, 40); setPixel(crx, cry - 2, 120, 80, 40);
  setPixel(crx, cry + 2, 120, 80, 40); setPixel(crx, cry + 3, 120, 80, 40);
  setPixel(crx - 3, cry, 120, 80, 40); setPixel(crx - 2, cry, 120, 80, 40);
  setPixel(crx + 2, cry, 120, 80, 40); setPixel(crx + 3, cry, 120, 80, 40);
  setPixel(crx - 1, cry - 1, 120, 80, 40); setPixel(crx + 1, cry - 1, 120, 80, 40);
  setPixel(crx - 1, cry + 1, 120, 80, 40); setPixel(crx + 1, cry + 1, 120, 80, 40);

  // Map pins/markers (colored dots on map)
  drawCircle(ox + 200, 259, 1, 200, 50, 50);
  drawCircle(ox + 222, 264, 1, 50, 50, 200);
  drawCircle(ox + 238, 270, 1, 50, 180, 50);
  drawCircle(ox + 212, 277, 1, 200, 180, 50);

  // Magnifying glass (circle with handle)
  for (let a = 0; a < 360; a += 5) {
    const rad = a * Math.PI / 180;
    const mgx = Math.round(ox + 170 + Math.cos(rad) * 5);
    const mgy = Math.round(260 + Math.sin(rad) * 5);
    setPixel(mgx, mgy, 140, 140, 150);
  }
  drawCircle(ox + 170, 260, 3, 200, 220, 240, 80);
  drawLine(ox + 174, 264, ox + 178, 268, 140, 140, 150);

  // Navigation instruments: protractor triangle
  drawLine(ox + 258, 252, ox + 270, 270, 120, 110, 90);
  drawLine(ox + 270, 270, ox + 258, 270, 120, 110, 90);
  drawLine(ox + 258, 270, ox + 258, 252, 120, 110, 90);

  // Ink wells at table edge
  fillRect(ox + 268, 248, 6, 5, 30, 30, 50);
  fillRect(ox + 269, 249, 4, 3, 20, 20, 60);
  // Quill
  drawLine(ox + 271, 247, ox + 276, 240, 200, 185, 140);
  setPixel(ox + 271, 247, 40, 40, 60);

  // Hourglass on map table (narrow figure-8 shape ~4x10px)
  fillRect(ox + 250, 282, 4, 1, 200, 180, 80); // top frame
  fillRect(ox + 250, 291, 4, 1, 200, 180, 80); // bottom frame
  setPixel(ox + 251, 283, 200, 180, 120); setPixel(ox + 252, 283, 200, 180, 120);
  setPixel(ox + 251, 284, 200, 180, 120); setPixel(ox + 252, 284, 200, 180, 120);
  setPixel(ox + 251, 285, 220, 200, 140); // narrow middle
  setPixel(ox + 252, 286, 220, 200, 140);
  setPixel(ox + 251, 287, 200, 180, 120); setPixel(ox + 252, 287, 200, 180, 120);
  setPixel(ox + 251, 288, 200, 180, 120); setPixel(ox + 252, 288, 200, 180, 120);
  setPixel(ox + 251, 289, 200, 180, 120); setPixel(ox + 252, 289, 200, 180, 120);
  setPixel(ox + 251, 290, 200, 180, 120); setPixel(ox + 252, 290, 200, 180, 120);

  // ============================================================
  // AMBIENT FURNITURE
  // ============================================================

  // Globe on stand (top-right area, circle ~16px)
  const gx = ox + 410, gy = 70;
  // Stand
  fillRect(gx - 1, gy + 8, 3, 14, 140, 120, 80);
  fillRect(gx - 5, gy + 21, 11, 2, 140, 120, 80);
  // Globe sphere
  drawCircle(gx, gy, 8, 50, 120, 110);
  drawCircle(gx, gy, 6, 60, 140, 130);
  // Cross-hatch continent lines
  drawLine(gx - 6, gy, gx + 6, gy, 40, 100, 90);
  drawLine(gx, gy - 7, gx, gy + 7, 40, 100, 90);
  for (let a = 0; a < 360; a += 45) {
    const rad = a * Math.PI / 180;
    const px = Math.round(gx + Math.cos(rad) * 5);
    const py = Math.round(gy + Math.sin(rad) * 5);
    setPixel(px, py, 40, 100, 90);
  }
  // Gold axis ring
  for (let a = 0; a < 360; a += 8) {
    const rad = a * Math.PI / 180;
    setPixel(Math.round(gx + Math.cos(rad) * 9), Math.round(gy + Math.sin(rad) * 3 - 1), 200, 180, 80, 160);
  }

  // Reading nook with armchair (center-left, on carpet)
  fillRect(ox + 150, 135, 25, 25, 35, 85, 75); // seat
  fillRect(ox + 152, 137, 21, 21, 40, 95, 85); // seat cushion
  // Armrests
  fillRect(ox + 148, 135, 4, 25, 30, 70, 65);
  fillRect(ox + 173, 135, 4, 25, 30, 70, 65);
  // Back
  fillRect(ox + 150, 132, 25, 5, 30, 75, 70);
  // Small side table next to armchair
  fillRect(ox + 180, 140, 16, 14, 80, 60, 42);
  fillRect(ox + 181, 141, 14, 12, 90, 70, 50);
  // Book on side table
  fillRect(ox + 183, 143, 8, 6, 40, 80, 120);

  // Candelabra with 5 candles (near center, ~12x30px)
  const candX = ox + 230, candY = 160;
  // Main stand
  fillRect(candX + 5, candY + 10, 3, 20, 180, 170, 100);
  fillRect(candX + 2, candY + 28, 9, 3, 180, 170, 100);
  // Branches
  drawLine(candX + 6, candY + 12, candX, candY + 6, 180, 170, 100);
  drawLine(candX + 6, candY + 12, candX + 12, candY + 6, 180, 170, 100);
  drawLine(candX + 6, candY + 14, candX + 2, candY + 8, 180, 170, 100);
  drawLine(candX + 6, candY + 14, candX + 10, candY + 8, 180, 170, 100);
  // Candles (small rectangles)
  fillRect(candX - 1, candY + 2, 3, 5, 230, 225, 200);
  fillRect(candX + 11, candY + 2, 3, 5, 230, 225, 200);
  fillRect(candX + 1, candY + 4, 3, 5, 230, 225, 200);
  fillRect(candX + 9, candY + 4, 3, 5, 230, 225, 200);
  fillRect(candX + 5, candY + 6, 3, 5, 230, 225, 200);
  // Warm flame dots
  setPixel(candX, candY + 1, 255, 200, 80);
  setPixel(candX + 12, candY + 1, 255, 200, 80);
  setPixel(candX + 2, candY + 3, 255, 200, 80);
  setPixel(candX + 10, candY + 3, 255, 200, 80);
  setPixel(candX + 6, candY + 5, 255, 200, 80);

  // Document chest (bottom-right area, ~30x20px)
  fillRect(ox + 380, 280, 30, 20, 90, 65, 40);
  fillRect(ox + 382, 282, 26, 16, 100, 75, 50);
  // Gold clasp
  fillRect(ox + 393, 280, 6, 3, 200, 180, 80);
  setPixel(ox + 396, 282, 220, 200, 100);
  // Wood grain on chest
  for (let x = ox + 384; x < ox + 406; x += 4) {
    for (let y = 284; y < 296; y++) setPixel(x, y, 88, 62, 38);
  }
  // Dark bottom edge
  fillRect(ox + 380, 298, 30, 2, 70, 50, 30);

  // Astrolabe on small pedestal (metallic gold circles)
  const astX = ox + 290, astY = 140;
  fillRect(astX - 2, astY + 5, 5, 10, 160, 150, 120);
  // Concentric rings
  for (let a = 0; a < 360; a += 4) {
    const rad = a * Math.PI / 180;
    setPixel(Math.round(astX + Math.cos(rad) * 6), Math.round(astY + Math.sin(rad) * 6), 200, 180, 80);
    setPixel(Math.round(astX + Math.cos(rad) * 4), Math.round(astY + Math.sin(rad) * 4), 190, 170, 70);
    setPixel(Math.round(astX + Math.cos(rad) * 2), Math.round(astY + Math.sin(rad) * 2), 210, 190, 90);
  }
  setPixel(astX, astY, 220, 200, 100);

  // Stone bust on pedestal (near top wall)
  fillRect(ox + 270, 18, 6, 15, 175, 170, 160); // pedestal column
  fillRect(ox + 268, 32, 10, 2, 180, 175, 165); // pedestal base
  // Head (oval)
  drawCircle(ox + 273, 16, 4, 185, 180, 170);
  drawCircle(ox + 273, 16, 2, 195, 190, 180);
  // Shoulders hint
  fillRect(ox + 269, 20, 8, 3, 180, 175, 165);

  // Quill pen rack on wall (near bookshelves)
  fillRect(ox + 316, 50, 15, 8, 90, 65, 42);
  fillRect(ox + 317, 51, 13, 6, 100, 75, 50);
  // Vertical quill lines
  for (let q = 0; q < 4; q++) {
    const qx = ox + 319 + q * 3;
    drawLine(qx, 48, qx, 56, 200, 185, 140);
    setPixel(qx, 47, 40, 40, 60); // quill tip
  }

  // Scattered loose parchment on floor (2-3 small tan rectangles)
  fillRect(ox + 250, 200, 5, 4, 220, 205, 160);
  fillRect(ox + 310, 270, 5, 4, 215, 200, 155);
  fillRect(ox + 55, 200, 5, 4, 225, 210, 165);
  // Slight rotation appearance: offset pixel
  setPixel(ox + 254, 199, 220, 205, 160);
  setPixel(ox + 314, 269, 215, 200, 155);
}

// =====================================================================
// Building 3 (offset 1392): Tavern Interior
// Top-down gathering space: amber/orange theme, wooden plank floor/walls
// Stations: bar counter, notice board, pigeon roost
// =====================================================================
function drawTavern(ox) {
  const W = BLDG_W;
  const H = BLDG_H;

  // --- FLOOR: Wooden plank base ---
  fillRect(ox, 0, W, H, 140, 100, 55);

  // Plank lines every ~12px (1px slightly darker)
  for (let py = 0; py < H; py += 12) {
    for (let x = ox; x < ox + W; x++) {
      setPixel(x, py, 125, 88, 45);
    }
  }

  // Wood grain variation: occasional knot circles
  const knots = [
    [50, 25], [150, 70], [300, 50], [400, 95], [80, 140],
    [220, 160], [370, 180], [110, 240], [280, 270], [430, 300],
    [60, 310], [190, 30], [340, 130], [250, 220], [420, 250],
  ];
  knots.forEach(([kx, ky]) => {
    drawCircle(ox + kx, ky, 1, 115, 78, 38);
    // Ring around knot
    for (let a = 0; a < 360; a += 30) {
      const rad = a * Math.PI / 180;
      setPixel(ox + kx + Math.round(Math.cos(rad) * 2), ky + Math.round(Math.sin(rad) * 2), 120, 82, 40);
    }
  });

  // Some planks slightly different shade for variety
  for (let py = 24; py < H; py += 36) {
    fillRect(ox + 10, py, W - 20, 10, 145, 105, 58);
  }

  // Sawdust patches near bar area (slightly lighter spots)
  const sawdust = [[80, 75], [120, 60], [200, 80], [300, 65], [350, 85]];
  sawdust.forEach(([sx, sy]) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 3) {
          setPixel(ox + sx + dx, sy + dy, 155, 115, 65, 120);
        }
      }
    }
  });

  // --- WALLS: 10px timber frame border ---
  // Wall infill (cream/plaster)
  fillRect(ox, 0, W, 10, 200, 185, 150);
  fillRect(ox, H - 10, W, 10, 200, 185, 150);
  fillRect(ox, 0, 10, H, 200, 185, 150);
  fillRect(ox + W - 10, 0, 10, H, 200, 185, 150);

  // Thick timber beams at corners and mid-points (4px wide)
  // Corner beams
  fillRect(ox, 0, 4, H, 90, 60, 30);
  fillRect(ox + W - 4, 0, 4, H, 90, 60, 30);
  fillRect(ox, 0, W, 4, 90, 60, 30);
  fillRect(ox, H - 4, W, 4, 90, 60, 30);
  // Mid-point beams
  fillRect(ox + W / 2 - 2, 0, 4, 10, 90, 60, 30);
  fillRect(ox + W / 2 - 2, H - 10, 4, 10, 90, 60, 30);
  fillRect(ox, H / 2 - 2, 10, 4, 90, 60, 30);
  fillRect(ox + W - 10, H / 2 - 2, 10, 4, 90, 60, 30);

  // Cross-brace diagonal beams in wall sections (top wall)
  for (let section = 0; section < 4; section++) {
    const sx = ox + 4 + section * (W / 4);
    const ex = sx + W / 4 - 8;
    const midX = (sx + ex) / 2;
    // X brace
    drawLine(Math.round(sx), 2, Math.round(ex), 8, 90, 60, 30);
    drawLine(Math.round(ex), 2, Math.round(sx), 8, 90, 60, 30);
  }
  // Bottom wall cross braces
  for (let section = 0; section < 4; section++) {
    const sx = ox + 4 + section * (W / 4);
    const ex = sx + W / 4 - 8;
    drawLine(Math.round(sx), H - 8, Math.round(ex), H - 2, 90, 60, 30);
    drawLine(Math.round(ex), H - 8, Math.round(sx), H - 2, 90, 60, 30);
  }

  // ============================================================
  // STATION 1: Bar Counter (top area, spanning most of width)
  // L-shaped: ~300x50px main + 50x60px end section
  // ============================================================

  // Main bar counter (horizontal)
  fillRect(ox + 60, 50, 300, 50, 80, 55, 30);
  // Bar top surface (lighter/shinier)
  fillRect(ox + 62, 52, 296, 46, 95, 68, 38);
  // Polished highlight
  for (let x = ox + 64; x < ox + 356; x++) setPixel(x, 53, 110, 80, 48);
  // Dark edge bottom
  fillRect(ox + 60, 98, 300, 2, 65, 42, 22);
  // Dark edge right
  fillRect(ox + 358, 50, 2, 50, 65, 42, 22);

  // L-shape end section (vertical extension on right)
  fillRect(ox + 310, 50, 50, 60, 80, 55, 30);
  fillRect(ox + 312, 52, 46, 56, 95, 68, 38);
  fillRect(ox + 310, 108, 50, 2, 65, 42, 22);

  // Tap handles (4 small vertical rectangles, metallic)
  for (let t = 0; t < 4; t++) {
    const tx = ox + 100 + t * 40;
    fillRect(tx, 54, 3, 8, 160, 150, 130);
    fillRect(tx, 53, 5, 2, 180, 170, 140); // handle top
  }

  // Mugs on bar (6 small shapes with foam)
  const mugPositions = [ox + 80, ox + 140, ox + 195, ox + 240, ox + 280, ox + 330];
  mugPositions.forEach((mx, i) => {
    fillRect(mx, 70, 5, 6, 160, 120, 50);
    fillRect(mx + 5, 72, 2, 3, 160, 120, 50); // handle
    if (i % 2 === 0) {
      // Foam on top
      drawCircle(mx + 2, 69, 2, 240, 235, 215);
    }
  });

  // Bottles behind bar on shelf (row of colored rectangles)
  const bottleColors = [
    [160, 120, 40], [100, 70, 30], [40, 100, 50], [180, 180, 200],
    [160, 120, 40], [100, 70, 30], [120, 40, 40], [40, 80, 100],
  ];
  for (let b = 0; b < 8; b++) {
    const bx = ox + 75 + b * 30;
    const bc = bottleColors[b];
    fillRect(bx, 56, 4, 10, bc[0], bc[1], bc[2]);
    fillRect(bx + 1, 52, 2, 4, bc[0], bc[1], bc[2]); // neck
  }

  // Cash box/coin pile on bar
  fillRect(ox + 340, 72, 10, 7, 120, 100, 50);
  setPixel(ox + 342, 74, 200, 180, 60); setPixel(ox + 345, 73, 200, 180, 60);
  setPixel(ox + 347, 75, 200, 180, 60);

  // Bar stools along customer side (4 circles for seat tops)
  const stoolPositions = [ox + 110, ox + 180, ox + 250, ox + 310];
  stoolPositions.forEach(sx => {
    drawCircle(sx, 108, 4, 100, 70, 40);
    drawCircle(sx, 108, 3, 115, 82, 48);
    // Stool legs
    setPixel(sx - 2, 112, 80, 55, 30); setPixel(sx + 2, 112, 80, 55, 30);
  });

  // ============================================================
  // STATION 2: Notice Board (left wall area, ~x:20-100, y:140-250)
  // Large wooden board (~70x90px) mounted on wall
  // ============================================================

  // Board frame (darker wood)
  fillRect(ox + 25, 140, 70, 90, 100, 70, 40);
  // Cork/fabric backing
  fillRect(ox + 28, 143, 64, 84, 180, 160, 120);

  // Multiple pinned notices (5-7 papers)
  // Paper 1 (largest - WANTED poster)
  fillRect(ox + 32, 148, 14, 16, 235, 230, 210);
  // Simple stick-figure head on wanted poster
  drawCircle(ox + 39, 155, 3, 80, 70, 60);
  setPixel(ox + 37, 162, 80, 70, 60); setPixel(ox + 41, 162, 80, 70, 60);
  fillRect(ox + 38, 158, 3, 4, 80, 70, 60);

  // Paper 2
  fillRect(ox + 50, 146, 10, 8, 240, 235, 200);
  // Paper 3
  fillRect(ox + 64, 150, 12, 10, 230, 225, 190);
  // Paper 4 (yellow tint)
  fillRect(ox + 34, 170, 12, 9, 240, 230, 170);
  // Paper 5
  fillRect(ox + 50, 168, 14, 12, 235, 230, 210);
  // Paper 6 (overlapping paper 5)
  fillRect(ox + 58, 172, 10, 8, 230, 220, 195);
  // Paper 7
  fillRect(ox + 68, 165, 8, 14, 240, 235, 205);

  // Quest marker (gold star on one notice)
  setPixel(ox + 56, 170, 220, 200, 60);
  setPixel(ox + 55, 171, 220, 200, 60); setPixel(ox + 57, 171, 220, 200, 60);
  setPixel(ox + 54, 172, 220, 200, 60); setPixel(ox + 58, 172, 220, 200, 60);

  // Push pin dots (red, blue, green at tops of papers)
  drawCircle(ox + 38, 148, 1, 200, 50, 50); // red
  drawCircle(ox + 54, 146, 1, 50, 50, 200); // blue
  drawCircle(ox + 69, 150, 1, 200, 50, 50); // red
  drawCircle(ox + 39, 170, 1, 50, 180, 50); // green
  drawCircle(ox + 56, 168, 1, 50, 50, 200); // blue
  drawCircle(ox + 71, 165, 1, 200, 50, 50); // red

  // Ink stamps/seals on some papers (tiny colored circles)
  drawCircle(ox + 42, 162, 1, 140, 40, 40);
  drawCircle(ox + 62, 178, 1, 40, 40, 140);

  // Lower notice board area -- more overlapping papers
  fillRect(ox + 30, 186, 14, 10, 230, 225, 195);
  fillRect(ox + 48, 190, 12, 12, 235, 230, 205);
  fillRect(ox + 65, 184, 10, 14, 240, 235, 200);
  fillRect(ox + 38, 200, 16, 10, 230, 220, 180);
  fillRect(ox + 58, 204, 14, 8, 235, 230, 210);
  // More pins
  drawCircle(ox + 36, 186, 1, 50, 50, 200);
  drawCircle(ox + 53, 190, 1, 200, 50, 50);
  drawCircle(ox + 70, 184, 1, 50, 180, 50);

  // ============================================================
  // STATION 3: Pigeon Roost (bottom-right, ~x:320-440, y:230-320)
  // Wooden dovecote structure (~80x70px) with compartments
  // ============================================================

  // Main structure frame
  fillRect(ox + 335, 238, 80, 70, 110, 78, 42);
  // Inner frame (lighter)
  fillRect(ox + 338, 241, 74, 64, 130, 95, 55);

  // 3x3 grid of compartments
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = ox + 340 + col * 23;
      const cy = 243 + row * 20;
      // Compartment opening (darker)
      fillRect(cx, cy, 20, 17, 80, 55, 30);
      // Lighter interior
      fillRect(cx + 1, cy + 1, 18, 15, 90, 65, 38);

      // Straw/hay in some compartments (tiny yellow lines)
      if ((row + col) % 2 === 0) {
        for (let s = 0; s < 4; s++) {
          const sx = cx + 3 + s * 4;
          setPixel(sx, cy + 13, 190, 180, 100);
          setPixel(sx + 1, cy + 14, 190, 180, 100);
        }
      }
    }
  }

  // Perch bars (horizontal lines across front)
  for (let row = 0; row < 3; row++) {
    const py = 260 + row * 20;
    fillRect(ox + 338, py, 74, 2, 100, 70, 38);
  }

  // Pigeons in compartments (3-4 bird silhouettes)
  // Pigeon 1 (top-left compartment)
  const p1x = ox + 347, p1y = 249;
  drawCircle(p1x + 3, p1y + 2, 3, 170, 170, 175); // body
  drawCircle(p1x, p1y, 2, 180, 180, 185); // head
  setPixel(p1x - 2, p1y, 200, 160, 60); // beak

  // Pigeon 2 (top-right compartment)
  const p2x = ox + 393, p2y = 250;
  drawCircle(p2x + 3, p2y + 2, 3, 160, 160, 165); // body
  drawCircle(p2x, p2y, 2, 175, 175, 180); // head
  setPixel(p2x - 2, p2y, 200, 160, 60); // beak

  // Pigeon 3 (middle-center compartment)
  const p3x = ox + 370, p3y = 269;
  drawCircle(p3x + 3, p3y + 2, 3, 200, 200, 205); // white pigeon body
  drawCircle(p3x, p3y, 2, 210, 210, 215); // head
  setPixel(p3x - 2, p3y, 200, 160, 60); // beak

  // Pigeon 4 (bottom-left compartment)
  const p4x = ox + 348, p4y = 290;
  drawCircle(p4x + 3, p4y + 2, 3, 150, 150, 155); // body
  drawCircle(p4x, p4y, 2, 165, 165, 170); // head
  setPixel(p4x - 2, p4y, 200, 160, 60); // beak

  // Feathers scattered below (tiny curved lines in light gray)
  setPixel(ox + 350, 312, 190, 190, 195); setPixel(ox + 351, 313, 185, 185, 190);
  setPixel(ox + 370, 315, 195, 195, 200); setPixel(ox + 371, 314, 190, 190, 195);
  setPixel(ox + 390, 310, 185, 185, 190); setPixel(ox + 391, 311, 180, 180, 185);
  setPixel(ox + 380, 316, 192, 192, 197); setPixel(ox + 381, 317, 188, 188, 193);

  // Feeding trough (rectangle with grain dots)
  fillRect(ox + 345, 310, 20, 5, 110, 78, 42);
  fillRect(ox + 347, 311, 16, 3, 120, 88, 50);
  // Grain dots
  setPixel(ox + 350, 312, 200, 180, 100); setPixel(ox + 354, 312, 200, 180, 100);
  setPixel(ox + 358, 312, 200, 180, 100); setPixel(ox + 352, 313, 200, 180, 100);

  // Message scroll basket nearby
  fillRect(ox + 420, 280, 18, 14, 140, 110, 70);
  fillRect(ox + 422, 282, 14, 10, 150, 120, 80);
  // Scrolls in basket (small cylinder shapes)
  fillRect(ox + 424, 278, 8, 4, 220, 205, 160);
  fillRect(ox + 426, 276, 6, 3, 215, 200, 155);
  // Colored ribbon on scrolls
  setPixel(ox + 428, 278, 180, 50, 50); // red ribbon
  setPixel(ox + 430, 277, 50, 50, 180); // blue ribbon

  // ============================================================
  // AMBIENT FURNITURE
  // ============================================================

  // Fireplace on right wall (rectangular opening with flames)
  fillRect(ox + 420, 145, 30, 25, 150, 140, 130); // stone surround
  fillRect(ox + 423, 148, 24, 19, 40, 30, 25); // dark opening
  // Flames inside
  fillRect(ox + 428, 155, 4, 10, 220, 120, 30); // flame 1
  fillRect(ox + 433, 153, 3, 12, 240, 150, 40); // flame 2
  fillRect(ox + 438, 156, 3, 8, 200, 100, 25); // flame 3
  setPixel(ox + 430, 154, 255, 200, 80); setPixel(ox + 435, 152, 255, 220, 100);
  // Embers
  setPixel(ox + 427, 165, 200, 80, 30); setPixel(ox + 432, 164, 200, 80, 30);
  setPixel(ox + 437, 165, 180, 60, 20); setPixel(ox + 441, 164, 200, 80, 30);
  // Mantle shelf above
  fillRect(ox + 418, 142, 34, 4, 110, 78, 42);
  // Warm glow around fireplace
  for (let dy = -6; dy <= 28; dy++) {
    for (let dx = -6; dx <= 36; dx++) {
      const gx = ox + 420 + dx, gy = 145 + dy;
      if (gx >= ox + 423 && gx < ox + 447 && gy >= 148 && gy < 167) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 30 && dist > 0) {
        setPixel(gx, gy, 200, 140, 40, Math.max(0, Math.floor(25 - dist * 0.8)));
      }
    }
  }

  // Dining table with chairs (center-right area)
  fillRect(ox + 240, 180, 50, 30, 100, 70, 40);
  fillRect(ox + 242, 182, 46, 26, 110, 80, 48);
  // Table edge shading
  fillRect(ox + 240, 208, 50, 2, 80, 55, 30);
  // Chairs (4 small squares around table)
  fillRect(ox + 250, 172, 10, 8, 90, 62, 35); // top
  fillRect(ox + 270, 172, 10, 8, 90, 62, 35);
  fillRect(ox + 250, 210, 10, 8, 90, 62, 35); // bottom
  fillRect(ox + 270, 210, 10, 8, 90, 62, 35);
  // Plates/food on table
  drawCircle(ox + 255, 190, 3, 200, 195, 185);
  drawCircle(ox + 275, 195, 3, 200, 195, 185);

  // Barrel stack in corner (top-right, 3 circles)
  drawCircle(ox + 430, 30, 7, 100, 70, 35);
  drawCircle(ox + 430, 30, 5, 120, 85, 45);
  // Barrel bands
  for (let a = 0; a < 360; a += 5) {
    const rad = a * Math.PI / 180;
    setPixel(Math.round(ox + 430 + Math.cos(rad) * 6), Math.round(30 + Math.sin(rad) * 6), 80, 55, 25);
  }
  drawCircle(ox + 445, 25, 6, 100, 70, 35);
  drawCircle(ox + 445, 25, 4, 120, 85, 45);
  drawCircle(ox + 438, 18, 5, 100, 70, 35);
  drawCircle(ox + 438, 18, 3, 120, 85, 45);

  // Hanging lanterns (3 scattered -- diamond shapes with warm glow)
  const lanternPos = [[ox + 180, 130], [ox + 300, 140], [ox + 130, 220]];
  lanternPos.forEach(([lx, ly]) => {
    // Diamond shape
    setPixel(lx, ly - 3, 180, 160, 80);
    setPixel(lx - 1, ly - 2, 180, 160, 80); setPixel(lx + 1, ly - 2, 180, 160, 80);
    setPixel(lx - 2, ly - 1, 180, 160, 80); setPixel(lx + 2, ly - 1, 180, 160, 80);
    setPixel(lx - 2, ly, 180, 160, 80); setPixel(lx + 2, ly, 180, 160, 80);
    setPixel(lx - 1, ly + 1, 180, 160, 80); setPixel(lx + 1, ly + 1, 180, 160, 80);
    setPixel(lx, ly + 2, 180, 160, 80);
    // Center glow
    setPixel(lx, ly - 1, 255, 220, 100);
    setPixel(lx - 1, ly, 255, 220, 100); setPixel(lx, ly, 255, 240, 120);
    setPixel(lx + 1, ly, 255, 220, 100);
    setPixel(lx, ly + 1, 255, 220, 100);
    // Warm glow halo
    drawCircle(lx, ly, 6, 200, 140, 40, 20);
  });

  // Trophy moose/deer head mount on top wall
  const trophy_x = ox + 200, trophy_y = 14;
  fillRect(trophy_x - 3, trophy_y - 2, 7, 6, 120, 90, 55); // mount plate
  // Head
  drawCircle(trophy_x, trophy_y + 1, 2, 130, 100, 60);
  // Antlers (small branching lines)
  drawLine(trophy_x - 2, trophy_y - 1, trophy_x - 6, trophy_y - 4, 100, 80, 45);
  drawLine(trophy_x - 4, trophy_y - 2, trophy_x - 5, trophy_y - 5, 100, 80, 45);
  drawLine(trophy_x + 2, trophy_y - 1, trophy_x + 6, trophy_y - 4, 100, 80, 45);
  drawLine(trophy_x + 4, trophy_y - 2, trophy_x + 5, trophy_y - 5, 100, 80, 45);

  // Broom leaning against wall (thin line with wider bottom)
  drawLine(ox + 15, 280, ox + 20, 310, 140, 120, 70);
  fillRect(ox + 16, 310, 8, 6, 160, 140, 80);
  // Bristles
  for (let b = 0; b < 6; b++) {
    drawLine(ox + 17 + b, 316, ox + 16 + b, 322, 180, 160, 100);
  }

  // Mop and bucket near bar
  drawLine(ox + 50, 110, ox + 52, 135, 140, 120, 70);
  // Bucket
  fillRect(ox + 44, 130, 12, 10, 100, 100, 110);
  fillRect(ox + 45, 131, 10, 8, 80, 80, 90);
  // Water in bucket
  fillRect(ox + 46, 133, 8, 4, 100, 140, 180, 150);

  // Welcome mat at bottom center (small rectangle, entrance area)
  fillRect(ox + 210, 318, 24, 10, 120, 80, 50);
  fillRect(ox + 212, 319, 20, 8, 130, 90, 55);
  // Mat texture
  for (let x = ox + 214; x < ox + 230; x += 2) {
    setPixel(x, 321, 110, 70, 40);
    setPixel(x, 324, 110, 70, 40);
  }

  // Keg stand behind bar (near bar end)
  drawCircle(ox + 380, 65, 9, 100, 70, 35);
  drawCircle(ox + 380, 65, 7, 120, 85, 45);
  // Bands
  for (let a = 0; a < 360; a += 6) {
    const rad = a * Math.PI / 180;
    setPixel(Math.round(ox + 380 + Math.cos(rad) * 8), Math.round(65 + Math.sin(rad) * 8), 80, 55, 25);
  }
  // Tap fixture
  fillRect(ox + 380, 73, 3, 5, 160, 150, 130);
  setPixel(ox + 381, 78, 140, 140, 150);

  // Coin purse on dining table (small gold lump)
  drawCircle(ox + 262, 188, 2, 180, 160, 60);
  setPixel(ox + 264, 187, 200, 180, 80);

  // Dartboard on wall (circle with concentric rings, near notice board)
  const dart_x = ox + 30, dart_y = 125;
  drawCircle(dart_x, dart_y, 7, 40, 80, 40);
  drawCircle(dart_x, dart_y, 5, 180, 50, 50);
  drawCircle(dart_x, dart_y, 3, 40, 80, 40);
  drawCircle(dart_x, dart_y, 1, 180, 50, 50);
  // Wire/divider lines
  setPixel(dart_x, dart_y - 7, 160, 160, 160);
  setPixel(dart_x, dart_y + 7, 160, 160, 160);
  setPixel(dart_x - 7, dart_y, 160, 160, 160);
  setPixel(dart_x + 7, dart_y, 160, 160, 160);

  // --- Ambient warm amber glow increases near fireplace and lanterns ---
  // Already applied via fireplace glow and lantern halos above
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
