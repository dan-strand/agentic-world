import { Sprite, Texture } from 'pixi.js';
import { TILE_SIZE, WORLD_COLS, WORLD_ROWS, WORLD_WIDTH, WORLD_HEIGHT } from '../shared/constants';
import { tileTextures } from './asset-loader';

/**
 * Build the world ground as a single pre-rendered Sprite.
 *
 * Renders all tiles (grass variants + dirt paths) onto an offscreen canvas,
 * then creates a PixiJS Texture from it. This avoids @pixi/tilemap
 * compatibility issues while being equally efficient for a static ground
 * layer that never changes at runtime.
 *
 * @param guildHallPos - Center position of the guild hall (pixels)
 * @param zonePositions - Center positions of each quest zone (pixels)
 * @param seed - Random seed for reproducible tile variation (default 42)
 */
export function buildWorldTilemap(
  guildHallPos: { x: number; y: number },
  zonePositions: Array<{ x: number; y: number }>,
  seed: number = 42,
): Sprite {
  // Create a tile grid tracking which tile goes where
  // Default: grass, overwritten by dirt paths/clearings
  const grid: string[][] = [];
  for (let row = 0; row < WORLD_ROWS; row++) {
    grid[row] = [];
    for (let col = 0; col < WORLD_COLS; col++) {
      const hash = seededRandom(seed, col, row);
      if (hash < 0.08) grid[row][col] = 'grass_3';       // 8% darkest variant
      else if (hash < 0.20) grid[row][col] = 'grass_2';   // 12% lighter variant
      else grid[row][col] = 'grass_1';                     // 80% base
    }
  }

  // Draw 3-tile-wide dirt paths from guild hall to each zone
  for (const zonePos of zonePositions) {
    const pathCells = bresenhamLine(
      Math.floor(guildHallPos.x / TILE_SIZE),
      Math.floor(guildHallPos.y / TILE_SIZE),
      Math.floor(zonePos.x / TILE_SIZE),
      Math.floor(zonePos.y / TILE_SIZE),
    );
    for (const cell of pathCells) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = cell.col + dx;
        if (c >= 0 && c < WORLD_COLS && cell.row >= 0 && cell.row < WORLD_ROWS) {
          grid[cell.row][c] = 'dirt_path';
        }
      }
    }
  }

  // 5x5 dirt clearing at guild hall center
  const ghCol = Math.floor(guildHallPos.x / TILE_SIZE);
  const ghRow = Math.floor(guildHallPos.y / TILE_SIZE);
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const c = ghCol + dc;
      const r = ghRow + dr;
      if (c >= 0 && c < WORLD_COLS && r >= 0 && r < WORLD_ROWS) {
        grid[r][c] = 'dirt_path';
      }
    }
  }

  // 3x3 dirt clearings at each zone center
  for (const zonePos of zonePositions) {
    const zCol = Math.floor(zonePos.x / TILE_SIZE);
    const zRow = Math.floor(zonePos.y / TILE_SIZE);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = zCol + dc;
        const r = zRow + dr;
        if (c >= 0 && c < WORLD_COLS && r >= 0 && r < WORLD_ROWS) {
          grid[r][c] = 'dirt_path';
        }
      }
    }
  }

  // Render grid to offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  for (let row = 0; row < WORLD_ROWS; row++) {
    for (let col = 0; col < WORLD_COLS; col++) {
      const tileKey = grid[row][col];
      const tex = tileTextures[tileKey];
      if (tex?.source?.resource) {
        // Extract the tile region from the atlas source image
        const frame = tex.frame;
        ctx.drawImage(
          tex.source.resource as HTMLImageElement,
          frame.x, frame.y, frame.width, frame.height,
          col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
        );
      }
    }
  }

  // Create a PixiJS Sprite from the rendered canvas
  const texture = Texture.from(canvas);
  const sprite = new Sprite(texture);
  return sprite;
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
