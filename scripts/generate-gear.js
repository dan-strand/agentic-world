/**
 * Generate the 128x128 gear overlay atlas PNG with 4 classes x 4 gear variants = 16 frames.
 * Layout: 4 columns (variants) x 4 rows (classes) at 32x32 each.
 *
 * Row order:
 *   0: mage gear    (pointy hat, circlet/tiara, hooded cowl, crystal crown)
 *   1: warrior gear (horned helmet, royal crown, winged helm, skull helm)
 *   2: ranger gear  (feathered cap, leaf circlet, fur-trimmed hood, antler crown)
 *   3: rogue gear   (eye patch + bandana, thieves guild mask, shadow hood, spiked headband)
 *
 * Each gear item is a HEAD OVERLAY -- drawn at the character's head region
 * (roughly y=2-10, x=10-22 within the 32x32 frame) on transparent background.
 *
 * Also generates assets/sprites/gear.json spritesheet descriptor.
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const WIDTH = 128;   // 4 variants x 32px
const HEIGHT = 128;  // 4 rows x 32px
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

// =====================================================================
// ROW 0: MAGE GEAR
// =====================================================================

// Mage gear 0: Pointy wizard hat (taller/different than base)
function drawMageGear0(ox, oy) {
  // Extra-tall pointy hat -- more dramatic than base
  setPixel(ox + 15, oy + 1, 70, 30, 140);
  setPixel(ox + 15, oy + 2, 75, 35, 145);
  setPixel(ox + 14, oy + 3, 80, 40, 150);
  setPixel(ox + 15, oy + 3, 85, 45, 155);
  setPixel(ox + 16, oy + 3, 80, 40, 150);
  fillRect(ox + 13, oy + 4, 5, 1, 85, 45, 155);
  fillRect(ox + 12, oy + 5, 7, 1, 90, 50, 160);
  fillRect(ox + 11, oy + 6, 9, 2, 90, 50, 160);
  fillRect(ox + 10, oy + 8, 11, 2, 90, 50, 160);
  // Wide brim with gold trim
  fillRect(ox + 7, oy + 10, 17, 1, 200, 180, 80);
  // Star decoration on hat
  setPixel(ox + 14, oy + 5, 255, 255, 200);
  setPixel(ox + 16, oy + 6, 255, 255, 200);
}

// Mage gear 1: Circlet/tiara -- delicate headpiece
function drawMageGear1(ox, oy) {
  // Thin circlet band across forehead
  fillRect(ox + 11, oy + 7, 9, 1, 200, 180, 80);
  // Central gem
  setPixel(ox + 15, oy + 6, 100, 200, 255);
  setPixel(ox + 15, oy + 7, 120, 220, 255);
  // Side gems
  setPixel(ox + 12, oy + 7, 180, 160, 60);
  setPixel(ox + 18, oy + 7, 180, 160, 60);
  // Filigree above
  setPixel(ox + 14, oy + 6, 200, 180, 80, 180);
  setPixel(ox + 16, oy + 6, 200, 180, 80, 180);
}

// Mage gear 2: Hooded cowl -- mystic hood
function drawMageGear2(ox, oy) {
  // Deep hood shape
  fillRect(ox + 11, oy + 3, 9, 5, 60, 40, 100);
  setPixel(ox + 14, oy + 2, 55, 35, 95);
  setPixel(ox + 15, oy + 2, 55, 35, 95);
  setPixel(ox + 16, oy + 2, 55, 35, 95);
  // Hood drapes on sides
  setPixel(ox + 10, oy + 6, 60, 40, 100, 180);
  setPixel(ox + 10, oy + 7, 60, 40, 100, 180);
  setPixel(ox + 20, oy + 6, 60, 40, 100, 180);
  setPixel(ox + 20, oy + 7, 60, 40, 100, 180);
  // Shadow inside hood
  fillRect(ox + 12, oy + 5, 7, 3, 40, 25, 80, 120);
}

// Mage gear 3: Crystal crown -- arcane headpiece
function drawMageGear3(ox, oy) {
  // Crown base band
  fillRect(ox + 11, oy + 7, 9, 1, 150, 130, 200);
  // Crystal spikes
  setPixel(ox + 12, oy + 6, 180, 200, 255);
  setPixel(ox + 12, oy + 5, 200, 220, 255, 200);
  setPixel(ox + 15, oy + 5, 180, 200, 255);
  setPixel(ox + 15, oy + 4, 200, 220, 255, 200);
  setPixel(ox + 15, oy + 3, 220, 240, 255, 150);
  setPixel(ox + 18, oy + 6, 180, 200, 255);
  setPixel(ox + 18, oy + 5, 200, 220, 255, 200);
  // Glow effect at tips
  setPixel(ox + 15, oy + 2, 255, 255, 255, 100);
}

// =====================================================================
// ROW 1: WARRIOR GEAR
// =====================================================================

// Warrior gear 0: Horned helmet
function drawWarriorGear0(ox, oy) {
  // Helmet dome
  fillRect(ox + 11, oy + 5, 10, 5, 170, 170, 185);
  fillRect(ox + 12, oy + 4, 8, 1, 180, 180, 195);
  // Horns
  setPixel(ox + 10, oy + 5, 200, 190, 160);
  setPixel(ox + 9, oy + 4, 200, 190, 160);
  setPixel(ox + 8, oy + 3, 190, 180, 150);
  setPixel(ox + 21, oy + 5, 200, 190, 160);
  setPixel(ox + 22, oy + 4, 200, 190, 160);
  setPixel(ox + 23, oy + 3, 190, 180, 150);
  // Nose guard
  setPixel(ox + 15, oy + 8, 160, 160, 175);
  setPixel(ox + 16, oy + 8, 160, 160, 175);
}

// Warrior gear 1: Royal crown
function drawWarriorGear1(ox, oy) {
  // Crown band
  fillRect(ox + 11, oy + 6, 10, 2, 200, 180, 80);
  // Crown points
  setPixel(ox + 12, oy + 5, 200, 180, 80);
  setPixel(ox + 15, oy + 4, 200, 180, 80);
  setPixel(ox + 15, oy + 5, 200, 180, 80);
  setPixel(ox + 19, oy + 5, 200, 180, 80);
  // Gems in crown
  setPixel(ox + 12, oy + 6, 200, 40, 40); // ruby
  setPixel(ox + 15, oy + 6, 40, 120, 200); // sapphire
  setPixel(ox + 19, oy + 6, 40, 180, 80); // emerald
}

// Warrior gear 2: Winged helm
function drawWarriorGear2(ox, oy) {
  // Helmet base
  fillRect(ox + 11, oy + 5, 10, 5, 175, 175, 190);
  fillRect(ox + 12, oy + 4, 8, 1, 185, 185, 200);
  // Wing left
  setPixel(ox + 9, oy + 5, 200, 200, 215);
  setPixel(ox + 8, oy + 4, 200, 200, 215);
  setPixel(ox + 7, oy + 3, 190, 190, 205);
  setPixel(ox + 8, oy + 3, 200, 200, 215);
  setPixel(ox + 7, oy + 2, 180, 180, 195, 180);
  // Wing right
  setPixel(ox + 22, oy + 5, 200, 200, 215);
  setPixel(ox + 23, oy + 4, 200, 200, 215);
  setPixel(ox + 24, oy + 3, 190, 190, 205);
  setPixel(ox + 23, oy + 3, 200, 200, 215);
  setPixel(ox + 24, oy + 2, 180, 180, 195, 180);
}

// Warrior gear 3: Skull helm
function drawWarriorGear3(ox, oy) {
  // Skull-shaped helmet
  fillRect(ox + 11, oy + 4, 10, 6, 220, 220, 210);
  // Eye sockets (dark)
  fillRect(ox + 13, oy + 6, 2, 2, 30, 10, 10);
  fillRect(ox + 17, oy + 6, 2, 2, 30, 10, 10);
  // Nose hole
  setPixel(ox + 15, oy + 8, 40, 20, 20);
  setPixel(ox + 16, oy + 8, 40, 20, 20);
  // Teeth
  setPixel(ox + 13, oy + 9, 200, 200, 190);
  setPixel(ox + 15, oy + 9, 200, 200, 190);
  setPixel(ox + 17, oy + 9, 200, 200, 190);
  // Jaw outline
  fillRect(ox + 12, oy + 9, 8, 1, 180, 180, 170, 150);
}

// =====================================================================
// ROW 2: RANGER GEAR
// =====================================================================

// Ranger gear 0: Feathered cap
function drawRangerGear0(ox, oy) {
  // Cap body
  fillRect(ox + 12, oy + 5, 8, 3, 80, 120, 60);
  fillRect(ox + 11, oy + 7, 9, 1, 70, 110, 50);
  // Cap peak
  setPixel(ox + 14, oy + 4, 75, 115, 55);
  setPixel(ox + 15, oy + 4, 75, 115, 55);
  // Feather
  setPixel(ox + 20, oy + 4, 180, 40, 40);
  setPixel(ox + 20, oy + 3, 180, 40, 40);
  setPixel(ox + 21, oy + 2, 160, 30, 30);
  setPixel(ox + 21, oy + 1, 140, 20, 20, 200);
  // Feather barbs
  setPixel(ox + 19, oy + 3, 160, 35, 35, 150);
  setPixel(ox + 21, oy + 3, 160, 35, 35, 150);
}

// Ranger gear 1: Leaf circlet
function drawRangerGear1(ox, oy) {
  // Vine/circlet band
  fillRect(ox + 11, oy + 6, 9, 1, 60, 100, 40);
  // Leaf shapes
  setPixel(ox + 12, oy + 5, 50, 130, 40);
  setPixel(ox + 11, oy + 5, 40, 120, 30, 200);
  setPixel(ox + 15, oy + 5, 60, 140, 50);
  setPixel(ox + 15, oy + 4, 50, 130, 40, 200);
  setPixel(ox + 18, oy + 5, 50, 130, 40);
  setPixel(ox + 19, oy + 5, 40, 120, 30, 200);
  // Small berries
  setPixel(ox + 13, oy + 6, 180, 40, 40);
  setPixel(ox + 17, oy + 6, 180, 40, 40);
}

// Ranger gear 2: Fur-trimmed hood
function drawRangerGear2(ox, oy) {
  // Deep hood
  fillRect(ox + 11, oy + 3, 9, 5, 70, 55, 35);
  setPixel(ox + 14, oy + 2, 65, 50, 30);
  setPixel(ox + 15, oy + 2, 65, 50, 30);
  setPixel(ox + 16, oy + 2, 65, 50, 30);
  // Fur trim around face opening
  fillRect(ox + 11, oy + 7, 1, 2, 200, 190, 170);
  fillRect(ox + 19, oy + 7, 1, 2, 200, 190, 170);
  fillRect(ox + 12, oy + 8, 7, 1, 200, 190, 170);
  // Fur texture dots
  setPixel(ox + 13, oy + 8, 190, 180, 160);
  setPixel(ox + 16, oy + 8, 190, 180, 160);
}

// Ranger gear 3: Antler crown
function drawRangerGear3(ox, oy) {
  // Leather headband
  fillRect(ox + 11, oy + 6, 9, 1, 130, 90, 50);
  // Left antler
  setPixel(ox + 11, oy + 5, 200, 190, 160);
  setPixel(ox + 10, oy + 4, 200, 190, 160);
  setPixel(ox + 9, oy + 3, 190, 180, 150);
  setPixel(ox + 10, oy + 3, 180, 170, 140);
  setPixel(ox + 8, oy + 2, 180, 170, 140, 200);
  // Right antler
  setPixel(ox + 19, oy + 5, 200, 190, 160);
  setPixel(ox + 20, oy + 4, 200, 190, 160);
  setPixel(ox + 21, oy + 3, 190, 180, 150);
  setPixel(ox + 20, oy + 3, 180, 170, 140);
  setPixel(ox + 22, oy + 2, 180, 170, 140, 200);
  // Antler tine detail
  setPixel(ox + 9, oy + 2, 170, 160, 130, 180);
  setPixel(ox + 21, oy + 2, 170, 160, 130, 180);
}

// =====================================================================
// ROW 3: ROGUE GEAR
// =====================================================================

// Rogue gear 0: Eye patch + bandana upgrade
function drawRogueGear0(ox, oy) {
  // Enhanced bandana with knot detail
  fillRect(ox + 13, oy + 5, 6, 2, 60, 10, 10);
  setPixel(ox + 12, oy + 5, 60, 10, 10);
  // Bandana tails (longer)
  setPixel(ox + 19, oy + 5, 55, 8, 8);
  setPixel(ox + 20, oy + 6, 50, 6, 6);
  setPixel(ox + 21, oy + 7, 45, 5, 5, 200);
  // Eye patch
  fillRect(ox + 13, oy + 8, 3, 2, 30, 20, 15);
  // Eye patch strap
  setPixel(ox + 12, oy + 7, 30, 20, 15);
  setPixel(ox + 11, oy + 6, 30, 20, 15, 200);
}

// Rogue gear 1: Thieves guild mask
function drawRogueGear1(ox, oy) {
  // Full face mask with ornate design
  fillRect(ox + 12, oy + 7, 8, 4, 30, 30, 40);
  // Eye cutouts
  fillRect(ox + 13, oy + 8, 2, 1, 0, 0, 0, 0); // transparent eye holes
  fillRect(ox + 17, oy + 8, 2, 1, 0, 0, 0, 0);
  // Guild emblem on forehead
  setPixel(ox + 15, oy + 7, 160, 130, 50);
  setPixel(ox + 16, oy + 7, 160, 130, 50);
  // Mask edge decoration
  fillRect(ox + 12, oy + 7, 8, 1, 50, 50, 60, 180);
}

// Rogue gear 2: Shadow hood
function drawRogueGear2(ox, oy) {
  // Deep shadow hood
  fillRect(ox + 11, oy + 3, 9, 5, 30, 30, 40);
  setPixel(ox + 14, oy + 2, 25, 25, 35);
  setPixel(ox + 15, oy + 2, 25, 25, 35);
  setPixel(ox + 16, oy + 2, 25, 25, 35);
  // Hood peak
  setPixel(ox + 15, oy + 1, 20, 20, 30);
  // Deep shadow inside
  fillRect(ox + 12, oy + 5, 7, 3, 15, 15, 25, 150);
  // Hood side drapes
  setPixel(ox + 10, oy + 6, 30, 30, 40, 180);
  setPixel(ox + 10, oy + 7, 30, 30, 40, 160);
  setPixel(ox + 20, oy + 6, 30, 30, 40, 180);
  setPixel(ox + 20, oy + 7, 30, 30, 40, 160);
}

// Rogue gear 3: Spiked headband
function drawRogueGear3(ox, oy) {
  // Leather headband
  fillRect(ox + 11, oy + 6, 9, 1, 60, 50, 40);
  // Metal spikes
  setPixel(ox + 12, oy + 5, 180, 180, 190);
  setPixel(ox + 12, oy + 4, 190, 190, 200);
  setPixel(ox + 15, oy + 5, 180, 180, 190);
  setPixel(ox + 15, oy + 4, 190, 190, 200);
  setPixel(ox + 15, oy + 3, 200, 200, 210);
  setPixel(ox + 18, oy + 5, 180, 180, 190);
  setPixel(ox + 18, oy + 4, 190, 190, 200);
  // Spike glints
  setPixel(ox + 15, oy + 3, 220, 220, 230, 200);
  setPixel(ox + 12, oy + 4, 210, 210, 220, 180);
  setPixel(ox + 18, oy + 4, 210, 210, 220, 180);
}

// =====================================================================
// Draw all 16 gear frames
// =====================================================================

// Mage gear (row 0)
drawMageGear0(0 * FRAME, 0 * FRAME);
drawMageGear1(1 * FRAME, 0 * FRAME);
drawMageGear2(2 * FRAME, 0 * FRAME);
drawMageGear3(3 * FRAME, 0 * FRAME);

// Warrior gear (row 1)
drawWarriorGear0(0 * FRAME, 1 * FRAME);
drawWarriorGear1(1 * FRAME, 1 * FRAME);
drawWarriorGear2(2 * FRAME, 1 * FRAME);
drawWarriorGear3(3 * FRAME, 1 * FRAME);

// Ranger gear (row 2)
drawRangerGear0(0 * FRAME, 2 * FRAME);
drawRangerGear1(1 * FRAME, 2 * FRAME);
drawRangerGear2(2 * FRAME, 2 * FRAME);
drawRangerGear3(3 * FRAME, 2 * FRAME);

// Rogue gear (row 3)
drawRogueGear0(0 * FRAME, 3 * FRAME);
drawRogueGear1(1 * FRAME, 3 * FRAME);
drawRogueGear2(2 * FRAME, 3 * FRAME);
drawRogueGear3(3 * FRAME, 3 * FRAME);

// =====================================================================
// Write PNG
// =====================================================================
const outDir = path.resolve(__dirname, '..', 'assets', 'sprites');
const pngPath = path.resolve(outDir, 'gear.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(pngPath, buffer);
console.log(`Generated ${pngPath} (${buffer.length} bytes)`);

// =====================================================================
// Generate gear.json spritesheet descriptor
// =====================================================================
const classes = ['mage', 'warrior', 'ranger', 'rogue'];

const frames = {};

for (let classIndex = 0; classIndex < classes.length; classIndex++) {
  for (let variant = 0; variant < 4; variant++) {
    const frameName = `${classes[classIndex]}_gear_${variant}`;
    const x = variant * FRAME;
    const y = classIndex * FRAME;

    frames[frameName] = {
      frame: { x, y, w: FRAME, h: FRAME },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: FRAME, h: FRAME },
      sourceSize: { w: FRAME, h: FRAME },
    };
  }
}

const descriptor = {
  frames,
  meta: {
    app: 'Agent World',
    version: '1.0',
    image: 'gear.png',
    format: 'RGBA8888',
    size: { w: WIDTH, h: HEIGHT },
    scale: '1',
  },
};

const jsonPath = path.resolve(outDir, 'gear.json');
fs.writeFileSync(jsonPath, JSON.stringify(descriptor, null, 2));
console.log(`Generated ${jsonPath} (${Object.keys(frames).length} frames)`);
