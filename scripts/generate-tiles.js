/**
 * Generate the 128x32 tile atlas PNG with 4 tiles (grass_1, grass_2, grass_3, dirt_path).
 * Each tile is 32x32 with subtle pixel variation for a non-flat look.
 * Uses deterministic pixel positions for reproducibility.
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const WIDTH = 128;
const HEIGHT = 32;
const TILE = 32;

const png = new PNG({ width: WIDTH, height: HEIGHT });

function setPixel(x, y, r, g, b, a = 255) {
  const idx = (y * WIDTH + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function fillTile(offsetX, baseR, baseG, baseB) {
  // Fill with base color
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      setPixel(offsetX + x, y, baseR, baseG, baseB);
    }
  }
}

// Tile 0 (0,0): grass_1 -- medium green (58,120,50) with darker spots
fillTile(0, 58, 120, 50);
// Darker spot pixels (deterministic positions)
const grass1DarkSpots = [[5,3],[12,8],[22,15],[7,25],[28,20],[15,28],[3,18]];
grass1DarkSpots.forEach(([x, y]) => setPixel(x, y, 42, 95, 38));
// Lighter highlight pixels
const grass1LightSpots = [[10,5],[20,12],[26,7],[8,22],[17,30]];
grass1LightSpots.forEach(([x, y]) => setPixel(x, y, 72, 140, 62));

// Tile 1 (32,0): grass_2 -- lighter green (72,140,58) with different spot pattern
fillTile(32, 72, 140, 58);
const grass2DarkSpots = [[36,4],[45,12],[55,22],[39,28],[50,8],[60,18]];
grass2DarkSpots.forEach(([x, y]) => setPixel(x, y, 55, 115, 45));
const grass2LightSpots = [[42,7],[52,15],[38,20],[58,26],[48,3]];
grass2LightSpots.forEach(([x, y]) => setPixel(x, y, 88, 160, 72));

// Tile 2 (64,0): grass_3 -- darker green (42,100,38) with flower dots
fillTile(64, 42, 100, 38);
const grass3DarkSpots = [[68,5],[78,18],[86,10],[72,28],[90,24]];
grass3DarkSpots.forEach(([x, y]) => setPixel(x, y, 32, 80, 28));
// Flower dots (yellowish)
const grass3Flowers = [[70,8],[82,14],[76,24],[88,6],[92,20]];
grass3Flowers.forEach(([x, y]) => setPixel(x, y, 180, 140, 60));

// Tile 3 (96,0): dirt_path -- brown (140,105,60) with lighter grain spots
fillTile(96, 140, 105, 60);
const dirtDarkSpots = [[100,4],[112,16],[124,8],[104,26],[118,22]];
dirtDarkSpots.forEach(([x, y]) => setPixel(x, y, 120, 88, 48));
const dirtLightSpots = [[106,10],[116,6],[122,20],[102,18],[110,28],[126,14]];
dirtLightSpots.forEach(([x, y]) => setPixel(x, y, 165, 130, 80));

// Write PNG
const outPath = path.resolve(__dirname, '..', 'assets', 'sprites', 'tiles.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(outPath, buffer);
console.log(`Generated ${outPath} (${buffer.length} bytes)`);
