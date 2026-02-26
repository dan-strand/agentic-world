import { Texture } from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { TILE_SIZE, WORLD_COLS, WORLD_ROWS } from '../shared/constants';
import { tileTextures } from './asset-loader';

/**
 * Build the world tilemap -- a static CompositeTilemap with grass variants
 * and dirt paths connecting the guild hall to each quest zone.
 *
 * The tilemap is built once at init and never modified at runtime.
 * CompositeTilemap batches all ~768 tiles into a single GPU draw call.
 *
 * @param guildHallPos - Center position of the guild hall (pixels)
 * @param zonePositions - Center positions of each quest zone (pixels)
 * @param seed - Random seed for reproducible tile variation (default 42)
 */
export function buildWorldTilemap(
  guildHallPos: { x: number; y: number },
  zonePositions: Array<{ x: number; y: number }>,
  seed: number = 42,
): CompositeTilemap {
  const tilemap = new CompositeTilemap();

  // Resolve textures once (avoids per-tile Cache lookups)
  const grass1 = tileTextures['grass_1'];
  const grass2 = tileTextures['grass_2'];
  const grass3 = tileTextures['grass_3'];
  const dirtPath = tileTextures['dirt_path'];

  // Step 1: Fill entire grid with grass variants using seeded random
  // Distribution: ~80% grass_1, ~12% grass_2, ~8% grass_3
  for (let row = 0; row < WORLD_ROWS; row++) {
    for (let col = 0; col < WORLD_COLS; col++) {
      const hash = seededRandom(seed, col, row);
      let tex: Texture = grass1;
      if (hash < 0.08) tex = grass3;       // 8% darkest variant
      else if (hash < 0.20) tex = grass2;   // 12% lighter variant
      // else grass_1 (80%)
      tilemap.tile(tex, col * TILE_SIZE, row * TILE_SIZE);
    }
  }

  // Step 2: Draw 3-tile-wide dirt paths from guild hall to each zone
  for (const zonePos of zonePositions) {
    const pathCells = bresenhamLine(
      Math.floor(guildHallPos.x / TILE_SIZE),
      Math.floor(guildHallPos.y / TILE_SIZE),
      Math.floor(zonePos.x / TILE_SIZE),
      Math.floor(zonePos.y / TILE_SIZE),
    );
    for (const cell of pathCells) {
      // 3-tile wide path (center + 1 tile each side)
      for (let dx = -1; dx <= 1; dx++) {
        const c = cell.col + dx;
        if (c >= 0 && c < WORLD_COLS && cell.row >= 0 && cell.row < WORLD_ROWS) {
          tilemap.tile(dirtPath, c * TILE_SIZE, cell.row * TILE_SIZE);
        }
      }
    }
  }

  // Step 3: Add a small dirt clearing around the guild hall center (5x5 tiles)
  const ghCol = Math.floor(guildHallPos.x / TILE_SIZE);
  const ghRow = Math.floor(guildHallPos.y / TILE_SIZE);
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const c = ghCol + dc;
      const r = ghRow + dr;
      if (c >= 0 && c < WORLD_COLS && r >= 0 && r < WORLD_ROWS) {
        tilemap.tile(dirtPath, c * TILE_SIZE, r * TILE_SIZE);
      }
    }
  }

  // Step 4: Add small dirt clearings at each zone center (3x3 tiles)
  for (const zonePos of zonePositions) {
    const zCol = Math.floor(zonePos.x / TILE_SIZE);
    const zRow = Math.floor(zonePos.y / TILE_SIZE);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = zCol + dc;
        const r = zRow + dr;
        if (c >= 0 && c < WORLD_COLS && r >= 0 && r < WORLD_ROWS) {
          tilemap.tile(dirtPath, c * TILE_SIZE, r * TILE_SIZE);
        }
      }
    }
  }

  return tilemap;
}

/**
 * Seeded random number generator using integer hashing.
 * Returns a value in [0, 1) that is deterministic for a given (seed, x, y).
 */
function seededRandom(seed: number, x: number, y: number): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

/**
 * Bresenham's line algorithm -- returns grid cells along a line
 * between two tile coordinates.
 */
function bresenhamLine(
  c0: number, r0: number,
  c1: number, r1: number,
): Array<{ col: number; row: number }> {
  const cells: Array<{ col: number; row: number }> = [];
  let dc = Math.abs(c1 - c0);
  let dr = Math.abs(r1 - r0);
  const sc = c0 < c1 ? 1 : -1;
  const sr = r0 < r1 ? 1 : -1;
  let err = dc - dr;
  let c = c0;
  let r = r0;

  while (true) {
    cells.push({ col: c, row: r });
    if (c === c1 && r === r1) break;
    const e2 = 2 * err;
    if (e2 > -dr) { err -= dr; c += sc; }
    if (e2 < dc) { err += dc; r += sr; }
  }
  return cells;
}
