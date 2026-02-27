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
