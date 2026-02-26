/**
 * Generate the 128x384 character atlas PNG with 4 character classes x 3 states x 4 frames = 48 frames.
 * Layout: 4 columns (frames) x 12 rows (4 classes x 3 states) at 32x32 each.
 *
 * Row order:
 *   0-2:  mage   (idle, walk, work)
 *   3-5:  warrior (idle, walk, work)
 *   6-8:  ranger  (idle, walk, work)
 *   9-11: rogue   (idle, walk, work)
 *
 * Also generates assets/sprites/characters.json spritesheet descriptor with
 * frames and animations fields.
 *
 * Uses deterministic pixel positions for reproducibility.
 * Follows the same pattern as generate-buildings.js.
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const WIDTH = 128;   // 4 frames x 32px
const HEIGHT = 384;  // 12 rows x 32px
const FRAME = 32;    // frame size

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
// Skin color constant
// =====================================================================
const SKIN = [255, 217, 179];

// =====================================================================
// MAGE: Pointed hat, flowing robe, staff
// Colors: Purple/blue robe (90,50,160), gold trim (200,180,80),
//         staff (100,70,40), glowing cyan tip (100,200,255)
// =====================================================================

function drawMageBase(ox, oy, yOff) {
  // Pointed hat (tall peak ~6px above head)
  // Hat tip
  setPixel(ox + 15, oy + 3 + yOff, 90, 50, 160);
  setPixel(ox + 14, oy + 4 + yOff, 90, 50, 160);
  setPixel(ox + 15, oy + 4 + yOff, 80, 40, 150);
  setPixel(ox + 16, oy + 4 + yOff, 90, 50, 160);
  fillRect(ox + 13, oy + 5 + yOff, 5, 1, 90, 50, 160);
  fillRect(ox + 12, oy + 6 + yOff, 7, 1, 90, 50, 160);
  fillRect(ox + 11, oy + 7 + yOff, 9, 1, 90, 50, 160);
  fillRect(ox + 10, oy + 8 + yOff, 11, 2, 90, 50, 160);
  // Hat brim
  fillRect(ox + 8, oy + 10 + yOff, 15, 1, 75, 40, 140);

  // Face (under hat brim)
  fillRect(ox + 12, oy + 11 + yOff, 7, 3, ...SKIN);
  // Eyes
  setPixel(ox + 13, oy + 12 + yOff, 30, 30, 30);
  setPixel(ox + 17, oy + 12 + yOff, 30, 30, 30);

  // Robe body
  fillRect(ox + 11, oy + 14 + yOff, 9, 10, 90, 50, 160);
  // Robe widens at bottom
  fillRect(ox + 10, oy + 22 + yOff, 11, 2, 90, 50, 160);
  fillRect(ox + 9, oy + 24 + yOff, 13, 3, 90, 50, 160);
  fillRect(ox + 8, oy + 27 + yOff, 15, 2, 90, 50, 160);

  // Gold trim belt
  fillRect(ox + 11, oy + 18 + yOff, 9, 1, 200, 180, 80);

  // Robe edge highlight
  for (let y = oy + 14 + yOff; y < oy + 29 + yOff; y++) {
    if (y < HEIGHT) setPixel(ox + 11, y, 110, 60, 180);
  }

  // Hands (skin)
  setPixel(ox + 10, oy + 17 + yOff, ...SKIN);
  setPixel(ox + 20, oy + 17 + yOff, ...SKIN);

  // Feet hint
  fillRect(ox + 10, oy + 29 + yOff, 3, 1, 70, 40, 130);
  fillRect(ox + 18, oy + 29 + yOff, 3, 1, 70, 40, 130);
}

function drawMageStaff(ox, oy, yOff, staffXOff) {
  // Staff shaft
  const sx = ox + 22 + staffXOff;
  for (let y = oy + 8 + yOff; y < oy + 28 + yOff; y++) {
    if (y >= 0 && y < HEIGHT) setPixel(sx, y, 100, 70, 40);
  }
  // Staff hand grip
  setPixel(sx, oy + 17 + yOff, 80, 55, 30);
}

function drawMageStaffTip(ox, oy, yOff, staffXOff, alpha) {
  const sx = ox + 22 + staffXOff;
  // Glowing cyan tip
  setPixel(sx, oy + 6 + yOff, 100, 200, 255, alpha);
  setPixel(sx - 1, oy + 7 + yOff, 100, 200, 255, Math.floor(alpha * 0.6));
  setPixel(sx + 1, oy + 7 + yOff, 100, 200, 255, Math.floor(alpha * 0.6));
  setPixel(sx, oy + 7 + yOff, 150, 230, 255, alpha);
}

// Mage idle (row 0): subtle vertical bob, staff tip glow flicker
function drawMageIdle(frame) {
  const oy = 0;
  const yOff = (frame === 1 || frame === 2) ? -1 : 0; // sinusoidal bob
  const ox = frame * FRAME;
  drawMageBase(ox, oy, yOff);
  drawMageStaff(ox, oy, yOff, 0);
  const alpha = (frame % 2 === 0) ? 255 : 180;
  drawMageStaffTip(ox, oy, yOff, 0, alpha);
}

// Mage walk (row 1): robe sways, alternating legs, staff bobs
function drawMageWalk(frame) {
  const oy = FRAME;
  const ox = frame * FRAME;
  const yOff = 0;

  drawMageBase(ox, oy, yOff);

  // Leg movement: alternating feet positions
  const legOff = (frame % 2 === 0) ? -1 : 1;
  fillRect(ox + 10 + legOff, oy + 29, 3, 2, 70, 40, 130);
  fillRect(ox + 18 - legOff, oy + 29, 3, 2, 70, 40, 130);

  // Robe sway: shift bottom of robe slightly
  const swayOff = (frame === 0 || frame === 3) ? -1 : 1;
  fillRect(ox + 8 + swayOff, oy + 28, 15, 1, 90, 50, 160);

  drawMageStaff(ox, oy, (frame % 2 === 0) ? -1 : 0, 0);
  drawMageStaffTip(ox, oy, (frame % 2 === 0) ? -1 : 0, 0, 220);
}

// Mage work (row 2): staff raised, casting gesture, sparkle dots
function drawMageWork(frame) {
  const oy = FRAME * 2;
  const ox = frame * FRAME;
  const yOff = 0;

  drawMageBase(ox, oy, yOff);

  // Staff raised upward
  const sx = ox + 22;
  for (let y = oy + 2; y < oy + 20; y++) {
    setPixel(sx, y, 100, 70, 40);
  }
  // Glowing tip at top
  setPixel(sx, oy + 1, 100, 200, 255);
  setPixel(sx - 1, oy + 1, 100, 200, 255, 180);
  setPixel(sx + 1, oy + 1, 100, 200, 255, 180);
  setPixel(sx, oy + 0, 150, 230, 255, 200);

  // Casting hand raised
  setPixel(ox + 10, oy + 14, ...SKIN);
  setPixel(ox + 9, oy + 13, ...SKIN);

  // Sparkle dots (alternate positions per frame)
  const sparklePositions = [
    [[ox + 7, oy + 5], [ox + 25, oy + 8], [ox + 5, oy + 12]],
    [[ox + 8, oy + 7], [ox + 26, oy + 4], [ox + 6, oy + 10]],
    [[ox + 6, oy + 4], [ox + 24, oy + 6], [ox + 4, oy + 14]],
    [[ox + 9, oy + 6], [ox + 27, oy + 5], [ox + 7, oy + 11]],
  ];
  sparklePositions[frame].forEach(([x, y]) => {
    setPixel(x, y, 200, 220, 255);
    setPixel(x + 1, y, 180, 200, 255, 150);
  });
}

// =====================================================================
// WARRIOR: Helmet with visor, plate armor body, sword at side
// Colors: Silver/gray armor (160,160,175), red plume (180,40,40),
//         gold trim (200,180,80), blade silver (200,200,210)
// =====================================================================

function drawWarriorBase(ox, oy, yOff) {
  // Helmet (wider head area)
  fillRect(ox + 11, oy + 5 + yOff, 10, 6, 160, 160, 175);
  // Helmet top highlight
  fillRect(ox + 12, oy + 4 + yOff, 8, 1, 180, 180, 195);
  // Visor slit (face)
  fillRect(ox + 13, oy + 8 + yOff, 6, 2, ...SKIN);
  // Eye dots in visor
  setPixel(ox + 14, oy + 9 + yOff, 30, 30, 30);
  setPixel(ox + 17, oy + 9 + yOff, 30, 30, 30);
  // Chin guard
  fillRect(ox + 12, oy + 10 + yOff, 8, 1, 150, 150, 165);

  // Red plume on helmet
  fillRect(ox + 14, oy + 2 + yOff, 4, 3, 180, 40, 40);
  setPixel(ox + 15, oy + 1 + yOff, 180, 40, 40);
  setPixel(ox + 16, oy + 1 + yOff, 160, 30, 30);

  // Plate armor body (boxy)
  fillRect(ox + 10, oy + 11 + yOff, 12, 12, 160, 160, 175);
  // Armor shading on sides
  fillRect(ox + 10, oy + 11 + yOff, 2, 12, 140, 140, 155);
  fillRect(ox + 20, oy + 11 + yOff, 2, 12, 140, 140, 155);
  // Gold chest trim
  fillRect(ox + 12, oy + 13 + yOff, 8, 1, 200, 180, 80);
  // Belt
  fillRect(ox + 10, oy + 21 + yOff, 12, 1, 120, 100, 50);
  // Belt buckle
  setPixel(ox + 16, oy + 21 + yOff, 200, 180, 80);

  // Legs (armored)
  fillRect(ox + 11, oy + 23 + yOff, 4, 5, 150, 150, 165);
  fillRect(ox + 17, oy + 23 + yOff, 4, 5, 150, 150, 165);
  // Boots
  fillRect(ox + 10, oy + 28 + yOff, 5, 2, 100, 80, 60);
  fillRect(ox + 17, oy + 28 + yOff, 5, 2, 100, 80, 60);

  // Gauntlets / hands
  setPixel(ox + 9, oy + 18 + yOff, 160, 160, 175);
  setPixel(ox + 22, oy + 18 + yOff, 160, 160, 175);
}

function drawWarriorSword(ox, oy, yOff, swordXOff, swordAngle) {
  // Sword at side
  const sx = ox + 23 + swordXOff;
  // Hilt
  fillRect(sx - 1, oy + 16 + yOff, 3, 2, 200, 180, 80);
  // Blade
  if (swordAngle === 0) {
    // Vertical (at side)
    for (let y = oy + 10 + yOff; y < oy + 16 + yOff; y++) {
      setPixel(sx, y, 200, 200, 210);
    }
    setPixel(sx, oy + 9 + yOff, 220, 220, 230); // tip
  } else if (swordAngle === 1) {
    // Guard position (angled up-right)
    drawLine(sx, oy + 16 + yOff, sx + 4, oy + 8 + yOff, 200, 200, 210);
  } else {
    // Strike position (horizontal)
    for (let x = sx; x < sx + 7; x++) {
      setPixel(x, oy + 14 + yOff, 200, 200, 210);
    }
    setPixel(sx + 7, oy + 14 + yOff, 220, 220, 230); // tip
  }
}

// Warrior idle (row 3): subtle breathing sway, sword position shift
function drawWarriorIdle(frame) {
  const oy = FRAME * 3;
  const ox = frame * FRAME;
  const yOff = (frame === 1 || frame === 2) ? -1 : 0;
  drawWarriorBase(ox, oy, yOff);
  const swordXOff = (frame % 2 === 0) ? 0 : 1;
  drawWarriorSword(ox, oy, yOff, swordXOff, 0);
}

// Warrior walk (row 4): heavy stride, wider leg alternation
function drawWarriorWalk(frame) {
  const oy = FRAME * 4;
  const ox = frame * FRAME;
  const yOff = 0;
  drawWarriorBase(ox, oy, yOff);

  // Override leg positions for stride
  const legOff = (frame % 2 === 0) ? -2 : 2;
  fillRect(ox + 11 + legOff, oy + 28, 5, 2, 100, 80, 60);
  fillRect(ox + 17 - legOff, oy + 28, 5, 2, 100, 80, 60);

  drawWarriorSword(ox, oy, yOff, (frame % 2 === 0) ? 0 : -1, 0);
}

// Warrior work (row 5): sword practice, alternating guard and strike
function drawWarriorWork(frame) {
  const oy = FRAME * 5;
  const ox = frame * FRAME;
  const yOff = 0;
  drawWarriorBase(ox, oy, yOff);

  // Alternate between guard (1) and strike (2) poses
  const angle = (frame % 2 === 0) ? 1 : 2;
  drawWarriorSword(ox, oy, yOff, 0, angle);
}

// =====================================================================
// RANGER: Hood/cowl, cloak, bow over shoulder, quiver on back
// Colors: Green/brown cloak (60,100,50), leather (130,90,50),
//         bow wood (140,100,50), quiver (100,70,35)
// =====================================================================

function drawRangerBase(ox, oy, yOff, cloakOff) {
  // Hood (pointed hood shape)
  fillRect(ox + 12, oy + 4 + yOff, 8, 4, 60, 100, 50);
  setPixel(ox + 15, oy + 3 + yOff, 50, 85, 40);
  setPixel(ox + 16, oy + 3 + yOff, 50, 85, 40);
  // Hood peak
  setPixel(ox + 15, oy + 2 + yOff, 45, 80, 35);

  // Face under hood
  fillRect(ox + 13, oy + 8 + yOff, 6, 3, ...SKIN);
  // Eyes
  setPixel(ox + 14, oy + 9 + yOff, 30, 30, 30);
  setPixel(ox + 17, oy + 9 + yOff, 30, 30, 30);

  // Cloak body
  fillRect(ox + 11, oy + 11 + yOff, 10, 10, 60, 100, 50);
  // Cloak drapes down
  fillRect(ox + 10 + cloakOff, oy + 20 + yOff, 12, 4, 55, 90, 45);
  fillRect(ox + 10 + cloakOff, oy + 24 + yOff, 12, 3, 50, 85, 40);

  // Leather vest underneath
  fillRect(ox + 12, oy + 12 + yOff, 8, 8, 130, 90, 50);
  // Belt
  fillRect(ox + 12, oy + 19 + yOff, 8, 1, 100, 70, 35);

  // Legs
  fillRect(ox + 12, oy + 24 + yOff, 3, 4, 80, 60, 35);
  fillRect(ox + 17, oy + 24 + yOff, 3, 4, 80, 60, 35);
  // Boots
  fillRect(ox + 11, oy + 28 + yOff, 4, 2, 70, 50, 30);
  fillRect(ox + 17, oy + 28 + yOff, 4, 2, 70, 50, 30);

  // Hands
  setPixel(ox + 10, oy + 16 + yOff, ...SKIN);
  setPixel(ox + 21, oy + 16 + yOff, ...SKIN);

  // Quiver on back (right side)
  fillRect(ox + 21, oy + 8 + yOff, 2, 10, 100, 70, 35);
  // Arrow tips poking out of quiver
  setPixel(ox + 21, oy + 7 + yOff, 180, 180, 190);
  setPixel(ox + 22, oy + 7 + yOff, 180, 180, 190);
  setPixel(ox + 21, oy + 6 + yOff, 180, 180, 190);
}

function drawRangerBow(ox, oy, yOff, bowXOff) {
  // Bow slung over shoulder (left side)
  const bx = ox + 8 + bowXOff;
  // Bow arc (curved line)
  setPixel(bx, oy + 8 + yOff, 140, 100, 50);
  setPixel(bx - 1, oy + 9 + yOff, 140, 100, 50);
  setPixel(bx - 1, oy + 10 + yOff, 140, 100, 50);
  setPixel(bx - 1, oy + 11 + yOff, 140, 100, 50);
  setPixel(bx - 1, oy + 12 + yOff, 140, 100, 50);
  setPixel(bx, oy + 13 + yOff, 140, 100, 50);
  setPixel(bx, oy + 14 + yOff, 140, 100, 50);
  setPixel(bx + 1, oy + 15 + yOff, 140, 100, 50);
  setPixel(bx + 1, oy + 16 + yOff, 140, 100, 50);
  setPixel(bx, oy + 17 + yOff, 140, 100, 50);
  // Bowstring
  drawLine(bx, oy + 8 + yOff, bx + 1, oy + 17 + yOff, 180, 170, 150);
}

// Ranger idle (row 6): slight cloak flutter, relaxed stance
function drawRangerIdle(frame) {
  const oy = FRAME * 6;
  const ox = frame * FRAME;
  const yOff = 0;
  const cloakOff = (frame === 0 || frame === 3) ? 0 : 1; // subtle flutter
  drawRangerBase(ox, oy, yOff, cloakOff);
  drawRangerBow(ox, oy, yOff, 0);
}

// Ranger walk (row 7): light stride, cloak flutter more, bow bobs
function drawRangerWalk(frame) {
  const oy = FRAME * 7;
  const ox = frame * FRAME;
  const yOff = 0;
  const cloakOff = [-1, 0, 1, 0][frame]; // more pronounced flutter
  drawRangerBase(ox, oy, yOff, cloakOff);

  // Leg stride
  const legOff = (frame % 2 === 0) ? -1 : 1;
  fillRect(ox + 11 + legOff, oy + 28, 4, 2, 70, 50, 30);
  fillRect(ox + 17 - legOff, oy + 28, 4, 2, 70, 50, 30);

  const bowBob = (frame % 2 === 0) ? 0 : -1;
  drawRangerBow(ox, oy, yOff + bowBob, 0);
}

// Ranger work (row 8): bow drawn/aiming, arrow nocked
function drawRangerWork(frame) {
  const oy = FRAME * 8;
  const ox = frame * FRAME;
  const yOff = 0;
  drawRangerBase(ox, oy, yOff, 0);

  // Bow in aiming position (in front)
  const bx = ox + 8;
  // Bow arc (larger, facing right)
  setPixel(bx, oy + 10 + yOff, 140, 100, 50);
  setPixel(bx - 1, oy + 11 + yOff, 140, 100, 50);
  setPixel(bx - 1, oy + 12 + yOff, 140, 100, 50);
  setPixel(bx - 1, oy + 13 + yOff, 140, 100, 50);
  setPixel(bx - 1, oy + 14 + yOff, 140, 100, 50);
  setPixel(bx, oy + 15 + yOff, 140, 100, 50);
  // Bowstring pulled
  const pullBack = [1, 2, 3, 2][frame]; // pull-back variation
  drawLine(bx, oy + 10 + yOff, bx + pullBack, oy + 12 + yOff, 180, 170, 150);
  drawLine(bx + pullBack, oy + 12 + yOff, bx, oy + 15 + yOff, 180, 170, 150);
  // Arrow nocked
  drawLine(bx + pullBack, oy + 12 + yOff, bx - 4, oy + 12 + yOff, 180, 180, 190);
  // Arrow tip
  setPixel(bx - 5, oy + 12 + yOff, 200, 200, 210);

  // Aiming hand
  setPixel(ox + 10, oy + 12 + yOff, ...SKIN);
}

// =====================================================================
// ROGUE: Bandana/mask, light leather body (slim), daggers at belt
// Colors: Dark gray/black (50,50,60), belt pouches (100,80,50),
//         dagger glint (200,200,215), dark mask (40,40,50)
// =====================================================================

function drawRogueBase(ox, oy, yOff, crouchOff) {
  // Head (bandana on top)
  fillRect(ox + 13, oy + 5 + yOff, 6, 3, 50, 50, 60); // bandana wrap
  setPixel(ox + 12, oy + 6 + yOff, 50, 50, 60); // bandana left
  setPixel(ox + 19, oy + 6 + yOff, 45, 45, 55); // bandana tail
  setPixel(ox + 20, oy + 7 + yOff, 45, 45, 55); // bandana tail end

  // Forehead/eyes visible
  fillRect(ox + 13, oy + 8 + yOff, 6, 2, ...SKIN);
  // Eyes (visible above mask)
  setPixel(ox + 14, oy + 9 + yOff, 30, 30, 30);
  setPixel(ox + 17, oy + 9 + yOff, 30, 30, 30);

  // Dark mask across lower face
  fillRect(ox + 13, oy + 10 + yOff, 6, 2, 40, 40, 50);

  // Slim leather body
  fillRect(ox + 12, oy + 12 + yOff + crouchOff, 8, 10, 50, 50, 60);
  // Leather vest detail
  fillRect(ox + 13, oy + 13 + yOff + crouchOff, 6, 7, 55, 55, 65);
  // Center seam
  for (let y = oy + 13 + yOff + crouchOff; y < oy + 20 + yOff + crouchOff; y++) {
    setPixel(ox + 16, y, 45, 45, 55);
  }

  // Belt with pouches
  fillRect(ox + 12, oy + 21 + yOff + crouchOff, 8, 1, 100, 80, 50);
  // Pouches
  setPixel(ox + 13, oy + 22 + yOff + crouchOff, 100, 80, 50);
  setPixel(ox + 14, oy + 22 + yOff + crouchOff, 90, 70, 40);
  setPixel(ox + 18, oy + 22 + yOff + crouchOff, 100, 80, 50);
  setPixel(ox + 19, oy + 22 + yOff + crouchOff, 90, 70, 40);

  // Legs (slim)
  fillRect(ox + 13, oy + 23 + yOff + crouchOff, 3, 5, 45, 45, 55);
  fillRect(ox + 17, oy + 23 + yOff + crouchOff, 3, 5, 45, 45, 55);
  // Soft boots
  fillRect(ox + 12, oy + 28 + yOff + crouchOff, 4, 2, 40, 35, 30);
  fillRect(ox + 17, oy + 28 + yOff + crouchOff, 4, 2, 40, 35, 30);

  // Hands
  setPixel(ox + 11, oy + 17 + yOff + crouchOff, ...SKIN);
  setPixel(ox + 20, oy + 17 + yOff + crouchOff, ...SKIN);
}

function drawRogueDaggers(ox, oy, yOff, crouchOff, glintAlpha) {
  // Left dagger at belt
  const ly = oy + 20 + yOff + crouchOff;
  setPixel(ox + 10, ly, 100, 80, 50); // hilt
  setPixel(ox + 10, ly + 1, 100, 80, 50);
  setPixel(ox + 10, ly + 2, 200, 200, 215, glintAlpha); // blade
  setPixel(ox + 10, ly + 3, 200, 200, 215, glintAlpha);

  // Right dagger at belt
  setPixel(ox + 22, ly, 100, 80, 50);
  setPixel(ox + 22, ly + 1, 100, 80, 50);
  setPixel(ox + 22, ly + 2, 200, 200, 215, glintAlpha);
  setPixel(ox + 22, ly + 3, 200, 200, 215, glintAlpha);
}

// Rogue idle (row 9): subtle weight-shift, dagger glint flicker
function drawRogueIdle(frame) {
  const oy = FRAME * 9;
  const ox = frame * FRAME;
  const yOff = 0;
  const weightShift = (frame === 0 || frame === 3) ? 0 : 0;
  drawRogueBase(ox, oy, yOff, weightShift);
  const glintAlpha = (frame % 2 === 0) ? 255 : 180;
  drawRogueDaggers(ox, oy, yOff, weightShift, glintAlpha);
}

// Rogue walk (row 10): sneaky crouch-walk (lower stance), light on feet
function drawRogueWalk(frame) {
  const oy = FRAME * 10;
  const ox = frame * FRAME;
  const yOff = 0;
  const crouchOff = 1; // slightly lower stance
  drawRogueBase(ox, oy, yOff, crouchOff);
  drawRogueDaggers(ox, oy, yOff, crouchOff, 220);

  // Alternate feet - sneaky light steps
  const legOff = (frame % 2 === 0) ? -1 : 1;
  fillRect(ox + 12 + legOff, oy + 29 + crouchOff, 4, 1, 40, 35, 30);
  fillRect(ox + 17 - legOff, oy + 29 + crouchOff, 4, 1, 40, 35, 30);
}

// Rogue work (row 11): lockpicking/examining, hands forward with tool
function drawRogueWork(frame) {
  const oy = FRAME * 11;
  const ox = frame * FRAME;
  const yOff = 0;
  drawRogueBase(ox, oy, yOff, 0);
  drawRogueDaggers(ox, oy, yOff, 0, 200);

  // Hands forward with lockpick tool
  const handY = oy + 15;
  setPixel(ox + 9, handY, ...SKIN);
  setPixel(ox + 8, handY, ...SKIN);
  // Lockpick tool
  const toolVariation = [0, 1, 0, -1][frame]; // jiggle
  setPixel(ox + 7, handY + toolVariation, 180, 180, 190);
  setPixel(ox + 6, handY + toolVariation, 180, 180, 190);
  setPixel(ox + 5, handY + toolVariation, 200, 200, 215);
  // Other hand supporting
  setPixel(ox + 8, handY + 1, ...SKIN);
}

// =====================================================================
// Draw all 48 frames
// =====================================================================

// Mage (rows 0-2)
for (let f = 0; f < 4; f++) drawMageIdle(f);
for (let f = 0; f < 4; f++) drawMageWalk(f);
for (let f = 0; f < 4; f++) drawMageWork(f);

// Warrior (rows 3-5)
for (let f = 0; f < 4; f++) drawWarriorIdle(f);
for (let f = 0; f < 4; f++) drawWarriorWalk(f);
for (let f = 0; f < 4; f++) drawWarriorWork(f);

// Ranger (rows 6-8)
for (let f = 0; f < 4; f++) drawRangerIdle(f);
for (let f = 0; f < 4; f++) drawRangerWalk(f);
for (let f = 0; f < 4; f++) drawRangerWork(f);

// Rogue (rows 9-11)
for (let f = 0; f < 4; f++) drawRogueIdle(f);
for (let f = 0; f < 4; f++) drawRogueWalk(f);
for (let f = 0; f < 4; f++) drawRogueWork(f);

// =====================================================================
// Write PNG
// =====================================================================
const outDir = path.resolve(__dirname, '..', 'assets', 'sprites');
const pngPath = path.resolve(outDir, 'characters.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(pngPath, buffer);
console.log(`Generated ${pngPath} (${buffer.length} bytes)`);

// =====================================================================
// Generate characters.json spritesheet descriptor
// =====================================================================
const classes = ['mage', 'warrior', 'ranger', 'rogue'];
const states = ['idle', 'walk', 'work'];

const frames = {};
const animations = {};

for (let classIndex = 0; classIndex < classes.length; classIndex++) {
  for (let stateIndex = 0; stateIndex < states.length; stateIndex++) {
    const animName = `${classes[classIndex]}_${states[stateIndex]}`;
    const animFrames = [];

    for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
      const frameName = `${animName}_${frameIndex}`;
      const x = frameIndex * FRAME;
      const y = (classIndex * 3 + stateIndex) * FRAME;

      frames[frameName] = {
        frame: { x, y, w: FRAME, h: FRAME },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: FRAME, h: FRAME },
        sourceSize: { w: FRAME, h: FRAME },
      };

      animFrames.push(frameName);
    }

    animations[animName] = animFrames;
  }
}

const descriptor = {
  frames,
  animations,
  meta: {
    app: 'Agent World',
    version: '1.0',
    image: 'characters.png',
    format: 'RGBA8888',
    size: { w: WIDTH, h: HEIGHT },
    scale: '1',
  },
};

const jsonPath = path.resolve(outDir, 'characters.json');
fs.writeFileSync(jsonPath, JSON.stringify(descriptor, null, 2));
console.log(`Generated ${jsonPath} (${Object.keys(frames).length} frames, ${Object.keys(animations).length} animations)`);
