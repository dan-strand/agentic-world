/**
 * Generate the 480x96 building atlas PNG with 5 buildings:
 *   guild_hall, wizard_tower, training_grounds, ancient_library, tavern.
 * Each building is 96x96 with transparent background.
 * Uses deterministic pixel positions for reproducibility.
 * Follows the same pattern as generate-tiles.js.
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const WIDTH = 480;
const HEIGHT = 96;
const BLDG = 96;

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

// =====================================================================
// Building 0 (offset 0): Guild Hall
// Central stone building with peaked roof, double doors, windows, banner
// =====================================================================
function drawGuildHall(ox) {
  // Stone walls - wide building body
  fillRect(ox + 12, 30, 72, 54, 140, 130, 110);

  // Wall texture - subtle stone block lines
  for (let row = 0; row < 6; row++) {
    const y = 35 + row * 9;
    for (let x = ox + 12; x < ox + 84; x++) {
      setPixel(x, y, 130, 120, 100);
    }
    // Vertical mortar lines (offset every other row)
    const offset = (row % 2) * 12;
    for (let col = 0; col < 7; col++) {
      const mx = ox + 18 + col * 12 + offset;
      if (mx < ox + 84) {
        for (let dy = 0; dy < 9; dy++) {
          if (y + dy < 84) setPixel(mx, y + dy, 130, 120, 100);
        }
      }
    }
  }

  // Foundation strip
  fillRect(ox + 10, 82, 76, 4, 120, 110, 95);

  // Dark brown wooden roof - peaked triangle
  for (let row = 0; row < 24; row++) {
    const halfW = 38 - Math.floor(row * 38 / 24);
    const cx = ox + 48;
    fillRect(cx - halfW, 8 + row, halfW * 2, 1, 100, 70, 40);
  }
  // Roof edge highlight
  for (let row = 0; row < 24; row++) {
    const halfW = 38 - Math.floor(row * 38 / 24);
    const cx = ox + 48;
    setPixel(cx - halfW, 8 + row, 120, 85, 50);
    setPixel(cx + halfW - 1, 8 + row, 80, 55, 30);
  }

  // Double doors at center bottom
  fillRect(ox + 40, 62, 8, 22, 80, 55, 30);
  fillRect(ox + 49, 62, 8, 22, 80, 55, 30);
  // Door frame
  fillRect(ox + 38, 60, 22, 2, 90, 60, 30);
  // Door handles
  setPixel(ox + 47, 72, 200, 180, 80);
  setPixel(ox + 50, 72, 200, 180, 80);
  // Door arch
  for (let i = -4; i <= 4; i++) {
    setPixel(ox + 48 + i, 59 - Math.abs(i) / 2, 90, 60, 30);
  }

  // Left window with blue glass
  fillRect(ox + 20, 44, 10, 12, 60, 50, 40); // frame
  fillRect(ox + 22, 46, 6, 8, 140, 180, 220); // blue glass
  // Window cross
  fillRect(ox + 24, 46, 2, 8, 80, 60, 40);
  fillRect(ox + 22, 49, 6, 2, 80, 60, 40);

  // Right window with blue glass
  fillRect(ox + 66, 44, 10, 12, 60, 50, 40);
  fillRect(ox + 68, 46, 6, 8, 140, 180, 220);
  fillRect(ox + 70, 46, 2, 8, 80, 60, 40);
  fillRect(ox + 68, 49, 6, 2, 80, 60, 40);

  // Banner/flag pole on roof peak
  fillRect(ox + 47, 2, 2, 10, 90, 65, 35);
  // Red banner
  fillRect(ox + 50, 3, 8, 6, 180, 40, 40);
  fillRect(ox + 51, 9, 6, 2, 160, 30, 30);
  fillRect(ox + 52, 11, 4, 1, 140, 25, 25);

  // Side torch details
  setPixel(ox + 16, 52, 200, 150, 50);
  setPixel(ox + 16, 51, 255, 200, 80);
  setPixel(ox + 80, 52, 200, 150, 50);
  setPixel(ox + 80, 51, 255, 200, 80);

  // Ground shadow
  for (let x = ox + 14; x < ox + 82; x++) {
    setPixel(x, 86, 100, 90, 70, 80);
    setPixel(x, 87, 100, 90, 70, 40);
  }
}

// =====================================================================
// Building 1 (offset 96): Wizard Tower
// Tall narrow cylindrical tower, conical purple roof, glowing window, sparkles
// =====================================================================
function drawWizardTower(ox) {
  // Cylindrical stone tower body (center ~40px wide)
  fillRect(ox + 28, 28, 40, 58, 100, 100, 120);

  // Stone texture -- horizontal lines
  for (let row = 0; row < 7; row++) {
    const y = 32 + row * 8;
    for (let x = ox + 28; x < ox + 68; x++) {
      setPixel(x, y, 88, 88, 108);
    }
  }

  // Tower curvature shading (darker at edges)
  for (let y = 28; y < 86; y++) {
    for (let i = 0; i < 4; i++) {
      setPixel(ox + 28 + i, y, 80 - i * 5, 80 - i * 5, 100 - i * 5);
      setPixel(ox + 67 - i, y, 80 - i * 5, 80 - i * 5, 100 - i * 5);
    }
  }

  // Foundation
  fillRect(ox + 24, 84, 48, 4, 80, 80, 95);
  // Wider base
  fillRect(ox + 26, 80, 44, 4, 90, 90, 105);

  // Conical purple/blue roof
  for (let row = 0; row < 26; row++) {
    const halfW = 24 - Math.floor(row * 24 / 26);
    const cx = ox + 48;
    const r = 90 - Math.floor(row * 20 / 26);
    const g = 50 - Math.floor(row * 10 / 26);
    const b = 130 + Math.floor(row * 25 / 26);
    fillRect(cx - halfW, 4 + row, halfW * 2, 1, r, g, b);
  }
  // Roof highlight edge
  for (let row = 0; row < 26; row++) {
    const halfW = 24 - Math.floor(row * 24 / 26);
    const cx = ox + 48;
    setPixel(cx - halfW, 4 + row, 120, 70, 160);
  }
  // Roof tip orb
  setPixel(ox + 47, 2, 200, 180, 255);
  setPixel(ox + 48, 2, 200, 180, 255);
  setPixel(ox + 47, 3, 180, 160, 240);
  setPixel(ox + 48, 3, 180, 160, 240);

  // Glowing window near top
  fillRect(ox + 42, 34, 12, 10, 60, 50, 70); // frame
  fillRect(ox + 44, 36, 8, 6, 255, 220, 80); // gold glow
  // Glow halo around window
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 9; dx++) {
      const x = ox + 43 + dx;
      const y = 35 + dy;
      if (x >= ox + 44 && x < ox + 52 && y >= 36 && y < 42) continue;
      setPixel(x, y, 200, 170, 50, 60);
    }
  }

  // Lower window (small slit)
  fillRect(ox + 44, 56, 8, 4, 60, 50, 70);
  fillRect(ox + 45, 57, 6, 2, 180, 160, 60);

  // Spiral stair suggestion (small dots spiraling up the exterior)
  const spiralPixels = [
    [ox + 30, 75], [ox + 29, 68], [ox + 30, 61], [ox + 32, 54],
    [ox + 34, 47], [ox + 36, 40], [ox + 38, 35],
  ];
  spiralPixels.forEach(([x, y]) => {
    setPixel(x, y, 75, 75, 90);
    setPixel(x + 1, y, 75, 75, 90);
  });

  // Door at base
  fillRect(ox + 42, 70, 12, 14, 70, 55, 45);
  // Arch over door
  for (let i = -3; i <= 3; i++) {
    setPixel(ox + 48 + i, 68 - Math.abs(i) / 2, 80, 65, 50);
  }

  // Magical sparkle dots (cyan)
  const sparkles = [
    [ox + 20, 15], [ox + 72, 10], [ox + 18, 42], [ox + 76, 38],
    [ox + 22, 70], [ox + 74, 62], [ox + 35, 8], [ox + 60, 12],
    [ox + 15, 28], [ox + 78, 50],
  ];
  sparkles.forEach(([x, y]) => {
    setPixel(x, y, 100, 200, 255);
    setPixel(x + 1, y, 100, 200, 255, 180);
    setPixel(x, y + 1, 100, 200, 255, 180);
  });

  // Ground shadow
  for (let x = ox + 26; x < ox + 70; x++) {
    setPixel(x, 88, 70, 70, 85, 80);
    setPixel(x, 89, 70, 70, 85, 40);
  }
}

// =====================================================================
// Building 2 (offset 192): Training Grounds
// Wide low barracks with practice area, weapon racks, wooden fence
// =====================================================================
function drawTrainingGrounds(ox) {
  // Dirt ground patch across full width
  fillRect(ox + 4, 70, 88, 22, 140, 105, 60);
  // Dirt texture
  const dirtSpots = [
    [ox + 10, 75], [ox + 30, 80], [ox + 50, 76], [ox + 70, 82],
    [ox + 20, 85], [ox + 60, 78], [ox + 40, 88], [ox + 80, 84],
  ];
  dirtSpots.forEach(([x, y]) => {
    setPixel(x, y, 125, 90, 50);
    setPixel(x + 1, y, 155, 115, 70);
  });

  // Wide low barracks building (wide, shorter)
  fillRect(ox + 8, 32, 80, 38, 130, 75, 40);

  // Wood plank texture -- horizontal lines
  for (let row = 0; row < 8; row++) {
    const y = 34 + row * 5;
    for (let x = ox + 8; x < ox + 88; x++) {
      setPixel(x, y, 115, 65, 32);
    }
  }

  // Darker wood trim at edges
  fillRect(ox + 8, 32, 2, 38, 90, 50, 25);
  fillRect(ox + 86, 32, 2, 38, 90, 50, 25);
  fillRect(ox + 8, 32, 80, 2, 90, 50, 25);

  // Foundation
  fillRect(ox + 6, 68, 84, 3, 100, 60, 30);

  // Flat roof with slight overhang
  fillRect(ox + 5, 26, 86, 8, 90, 50, 25);
  // Roof highlight
  for (let x = ox + 5; x < ox + 91; x++) {
    setPixel(x, 26, 105, 60, 30);
  }

  // Open doorway (dark interior)
  fillRect(ox + 38, 48, 20, 22, 50, 30, 15);
  // Door frame
  fillRect(ox + 36, 46, 2, 24, 90, 50, 25);
  fillRect(ox + 58, 46, 2, 24, 90, 50, 25);
  fillRect(ox + 36, 46, 24, 2, 90, 50, 25);

  // Side windows (small)
  fillRect(ox + 16, 42, 10, 8, 60, 35, 20);
  fillRect(ox + 18, 44, 6, 4, 120, 100, 70);
  fillRect(ox + 70, 42, 10, 8, 60, 35, 20);
  fillRect(ox + 72, 44, 6, 4, 120, 100, 70);

  // Weapon rack (crossed swords/poles) -- left side of practice yard
  fillRect(ox + 12, 72, 2, 14, 90, 50, 25); // rack post
  fillRect(ox + 20, 72, 2, 14, 90, 50, 25); // rack post
  fillRect(ox + 12, 72, 10, 2, 90, 50, 25); // top bar
  // Weapons (metal)
  drawLine(ox + 13, 74, ox + 13, 84, 180, 180, 190);
  drawLine(ox + 15, 74, ox + 15, 84, 180, 180, 190);
  drawLine(ox + 17, 74, ox + 17, 84, 180, 180, 190);
  drawLine(ox + 19, 74, ox + 19, 84, 180, 180, 190);
  // Cross swords
  drawLine(ox + 13, 74, ox + 19, 84, 190, 190, 200);
  drawLine(ox + 19, 74, ox + 13, 84, 190, 190, 200);

  // Wooden fence segments in front
  for (let i = 0; i < 5; i++) {
    const fx = ox + 56 + i * 8;
    fillRect(fx, 74, 2, 12, 110, 70, 35);
    if (i < 4) {
      fillRect(fx, 77, 10, 2, 110, 70, 35);
      fillRect(fx, 82, 10, 2, 110, 70, 35);
    }
  }

  // Training dummy (right area)
  fillRect(ox + 76, 73, 2, 10, 130, 100, 50); // post
  fillRect(ox + 72, 74, 10, 2, 130, 100, 50); // cross arm
  setPixel(ox + 77, 72, 160, 140, 80); // head

  // Ground shadow
  for (let x = ox + 6; x < ox + 90; x++) {
    setPixel(x, 92, 110, 85, 50, 80);
    setPixel(x, 93, 110, 85, 50, 40);
  }
}

// =====================================================================
// Building 3 (offset 288): Ancient Library
// Classical building with columns, triangular pediment, arched doorway, books
// =====================================================================
function drawAncientLibrary(ox) {
  // Main building body - light stone
  fillRect(ox + 14, 32, 68, 52, 170, 165, 150);

  // Stone block texture
  for (let row = 0; row < 6; row++) {
    const y = 36 + row * 8;
    for (let x = ox + 14; x < ox + 82; x++) {
      setPixel(x, y, 155, 150, 135);
    }
    const offset = (row % 2) * 10;
    for (let col = 0; col < 8; col++) {
      const mx = ox + 20 + col * 10 + offset;
      if (mx < ox + 82) {
        for (let dy = 0; dy < 8; dy++) {
          if (y + dy < 84) setPixel(mx, y + dy, 155, 150, 135);
        }
      }
    }
  }

  // Foundation/steps
  fillRect(ox + 10, 82, 76, 3, 150, 145, 130);
  fillRect(ox + 8, 85, 80, 3, 140, 135, 120);
  fillRect(ox + 6, 88, 84, 3, 130, 125, 110);

  // Triangular pediment/roof
  for (let row = 0; row < 20; row++) {
    const halfW = 40 - Math.floor(row * 40 / 20);
    const cx = ox + 48;
    fillRect(cx - halfW, 14 + row, halfW * 2, 1, 180, 175, 160);
  }
  // Pediment edge lines
  for (let row = 0; row < 20; row++) {
    const halfW = 40 - Math.floor(row * 40 / 20);
    const cx = ox + 48;
    setPixel(cx - halfW, 14 + row, 190, 185, 170);
    setPixel(cx + halfW - 1, 14 + row, 155, 150, 135);
  }
  // Pediment top decoration
  fillRect(ox + 46, 12, 4, 4, 200, 180, 80); // gold ornament

  // Two stone columns
  // Left column
  fillRect(ox + 18, 34, 8, 48, 190, 185, 170);
  fillRect(ox + 17, 34, 10, 3, 200, 195, 180); // capital
  fillRect(ox + 17, 79, 10, 3, 200, 195, 180); // base
  // Column fluting
  for (let y = 37; y < 79; y++) {
    setPixel(ox + 19, y, 175, 170, 155);
    setPixel(ox + 22, y, 200, 195, 180);
    setPixel(ox + 24, y, 175, 170, 155);
  }

  // Right column
  fillRect(ox + 70, 34, 8, 48, 190, 185, 170);
  fillRect(ox + 69, 34, 10, 3, 200, 195, 180);
  fillRect(ox + 69, 79, 10, 3, 200, 195, 180);
  for (let y = 37; y < 79; y++) {
    setPixel(ox + 71, y, 175, 170, 155);
    setPixel(ox + 74, y, 200, 195, 180);
    setPixel(ox + 76, y, 175, 170, 155);
  }

  // Arched doorway
  fillRect(ox + 38, 52, 20, 30, 60, 50, 40);
  // Arch curve
  for (let i = -10; i <= 10; i++) {
    const archY = 52 - Math.floor(Math.sqrt(100 - i * i) * 0.6);
    for (let y = archY; y <= 52; y++) {
      setPixel(ox + 48 + i, y, 60, 50, 40);
    }
  }
  // Arch border
  for (let i = -10; i <= 10; i++) {
    const archY = 52 - Math.floor(Math.sqrt(100 - i * i) * 0.6);
    setPixel(ox + 48 + i, archY, 200, 180, 80);
  }
  // Door interior detail
  fillRect(ox + 42, 58, 12, 24, 45, 38, 30);

  // Book-filled window -- left
  fillRect(ox + 30, 44, 6, 10, 60, 50, 40); // frame
  fillRect(ox + 31, 45, 4, 8, 200, 195, 175); // glass bg
  // Books (colored rectangles)
  fillRect(ox + 31, 45, 1, 6, 70, 100, 170);  // blue book
  fillRect(ox + 32, 45, 1, 6, 170, 60, 50);   // red book
  fillRect(ox + 33, 45, 1, 6, 60, 130, 60);   // green book
  fillRect(ox + 34, 45, 1, 5, 70, 100, 170);  // blue book

  // Book-filled window -- right
  fillRect(ox + 60, 44, 6, 10, 60, 50, 40);
  fillRect(ox + 61, 45, 4, 8, 200, 195, 175);
  fillRect(ox + 61, 45, 1, 6, 170, 60, 50);
  fillRect(ox + 62, 45, 1, 6, 60, 130, 60);
  fillRect(ox + 63, 45, 1, 6, 70, 100, 170);
  fillRect(ox + 64, 45, 1, 5, 170, 60, 50);

  // Scroll detail on facade above door
  fillRect(ox + 43, 42, 10, 3, 200, 180, 80);
  setPixel(ox + 42, 42, 210, 190, 90);
  setPixel(ox + 53, 42, 210, 190, 90);

  // Gold trim lines
  for (let x = ox + 14; x < ox + 82; x++) {
    setPixel(x, 32, 200, 180, 80);
  }

  // Ground shadow
  for (let x = ox + 8; x < ox + 88; x++) {
    setPixel(x, 91, 120, 115, 100, 80);
    setPixel(x, 92, 120, 115, 100, 40);
  }
}

// =====================================================================
// Building 4 (offset 384): Tavern
// Timber-frame building with chimney, warm windows, hanging sign, open door
// =====================================================================
function drawTavern(ox) {
  // Main building body - cream fill
  fillRect(ox + 14, 30, 62, 56, 210, 195, 160);

  // Timber frame beams (brown)
  // Horizontal beams
  fillRect(ox + 12, 28, 66, 3, 100, 70, 35);  // top
  fillRect(ox + 12, 54, 66, 2, 100, 70, 35);  // middle
  fillRect(ox + 12, 84, 66, 2, 100, 70, 35);  // bottom
  // Vertical beams
  fillRect(ox + 12, 28, 3, 58, 100, 70, 35);  // left
  fillRect(ox + 75, 28, 3, 58, 100, 70, 35);  // right
  fillRect(ox + 44, 28, 3, 58, 100, 70, 35);  // center
  // Diagonal braces (X pattern in left section)
  for (let i = 0; i < 26; i++) {
    setPixel(ox + 15 + i, 31 + i, 100, 70, 35);
    setPixel(ox + 43 - i, 31 + i, 100, 70, 35);
  }

  // Roof (brown with slight peak)
  for (let row = 0; row < 18; row++) {
    const halfW = 42 - Math.floor(row * 10 / 18);
    const cx = ox + 45;
    fillRect(cx - halfW, 12 + row, halfW * 2, 1, 100, 70, 35);
  }
  // Roof shingle texture
  for (let row = 0; row < 6; row++) {
    const y = 14 + row * 3;
    const halfW = 42 - Math.floor((row * 3) * 10 / 18);
    const cx = ox + 45;
    for (let x = cx - halfW; x < cx + halfW; x++) {
      if ((x + row) % 6 === 0) setPixel(x, y, 85, 58, 28);
    }
  }

  // Brick chimney (right side)
  fillRect(ox + 72, 4, 10, 28, 150, 80, 60);
  // Chimney brick texture
  for (let row = 0; row < 7; row++) {
    const y = 6 + row * 4;
    for (let x = ox + 72; x < ox + 82; x++) {
      setPixel(x, y, 130, 65, 48);
    }
    const brickOff = (row % 2) * 3;
    for (let col = 0; col < 4; col++) {
      const mx = ox + 74 + col * 3 + brickOff;
      if (mx < ox + 82) {
        for (let dy = 0; dy < 4; dy++) {
          setPixel(mx, y + dy, 130, 65, 48);
        }
      }
    }
  }
  // Chimney cap
  fillRect(ox + 70, 2, 14, 3, 130, 65, 48);
  // Smoke suggestion (light gray pixels above chimney)
  const smokePixels = [
    [ox + 75, 0], [ox + 77, 0], [ox + 74, 1], [ox + 78, 1],
    [ox + 76, 0],
  ];
  smokePixels.forEach(([x, y]) => setPixel(x, y, 180, 180, 190, 120));

  // Warm orange-lit windows
  // Left window
  fillRect(ox + 20, 36, 12, 10, 80, 55, 30); // frame
  fillRect(ox + 22, 38, 8, 6, 220, 160, 60); // warm glow
  fillRect(ox + 25, 38, 2, 6, 80, 55, 30);   // mullion
  fillRect(ox + 22, 40, 8, 2, 80, 55, 30);   // cross bar
  // Window glow halo
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 9; dx++) {
      const x = ox + 21 + dx;
      const y = 37 + dy;
      if (x >= ox + 22 && x < ox + 30 && y >= 38 && y < 44) continue;
      setPixel(x, y, 200, 140, 40, 40);
    }
  }

  // Right window
  fillRect(ox + 52, 36, 12, 10, 80, 55, 30);
  fillRect(ox + 54, 38, 8, 6, 220, 160, 60);
  fillRect(ox + 57, 38, 2, 6, 80, 55, 30);
  fillRect(ox + 54, 40, 8, 2, 80, 55, 30);
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 9; dx++) {
      const x = ox + 53 + dx;
      const y = 37 + dy;
      if (x >= ox + 54 && x < ox + 62 && y >= 38 && y < 44) continue;
      setPixel(x, y, 200, 140, 40, 40);
    }
  }

  // Lower windows
  fillRect(ox + 20, 60, 12, 10, 80, 55, 30);
  fillRect(ox + 22, 62, 8, 6, 220, 160, 60);
  fillRect(ox + 25, 62, 2, 6, 80, 55, 30);
  fillRect(ox + 52, 60, 12, 10, 80, 55, 30);
  fillRect(ox + 54, 62, 8, 6, 220, 160, 60);
  fillRect(ox + 57, 62, 2, 6, 80, 55, 30);

  // Welcoming open door with warm glow inside
  fillRect(ox + 36, 58, 16, 28, 80, 55, 30); // door frame
  fillRect(ox + 38, 60, 12, 26, 200, 140, 50); // warm interior glow
  // Interior depth
  fillRect(ox + 40, 62, 8, 22, 180, 120, 40);
  // Door handle
  setPixel(ox + 37, 72, 200, 180, 80);

  // Hanging sign
  fillRect(ox + 10, 36, 2, 12, 80, 55, 30);  // bracket
  fillRect(ox + 6, 42, 8, 6, 100, 70, 35);   // sign board
  // Sign detail (mug icon suggestion)
  setPixel(ox + 8, 44, 220, 180, 80);
  setPixel(ox + 9, 44, 220, 180, 80);
  setPixel(ox + 10, 43, 220, 180, 80);
  setPixel(ox + 10, 44, 220, 180, 80);

  // Foundation
  fillRect(ox + 12, 86, 66, 3, 130, 100, 55);

  // Ground shadow
  for (let x = ox + 10; x < ox + 84; x++) {
    setPixel(x, 89, 140, 120, 80, 80);
    setPixel(x, 90, 140, 120, 80, 40);
  }
}

// =====================================================================
// Draw all buildings
// =====================================================================
drawGuildHall(0);
drawWizardTower(96);
drawTrainingGrounds(192);
drawAncientLibrary(288);
drawTavern(384);

// Write PNG
const outPath = path.resolve(__dirname, '..', 'assets', 'sprites', 'buildings.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(outPath, buffer);
console.log(`Generated ${outPath} (${buffer.length} bytes)`);
