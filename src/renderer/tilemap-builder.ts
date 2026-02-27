import { Sprite, Texture } from 'pixi.js';
import {
  TILE_SIZE, WORLD_COLS, WORLD_ROWS, WORLD_WIDTH, WORLD_HEIGHT,
  BUILDING_WIDTH, BUILDING_HEIGHT,
} from '../shared/constants';
import { tileTextures } from './asset-loader';

/**
 * Build the world ground as a single pre-rendered Sprite.
 *
 * Renders all tiles (grass variants + dirt paths) onto an offscreen canvas,
 * then creates a PixiJS Texture from it. This avoids @pixi/tilemap
 * compatibility issues while being equally efficient for a static ground
 * layer that never changes at runtime.
 *
 * Path layout: Star pattern -- 1-tile-wide footpaths radiate from the central
 * campfire to the bottom-center of each building. Small 3x3 clearing at
 * campfire, 2x1 doorstep clearings at each building entrance.
 *
 * Ground decorations: Scattered rocks, flowers, and grass tufts in grass areas
 * between buildings and paths (deterministic via seeded random).
 *
 * @param guildHallPos - Center position of the campfire waypoint (pixels)
 * @param zonePositions - Center positions of each quest zone building (pixels)
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

  // Compute building bounding boxes (in tile coordinates) for decoration avoidance
  const buildingBounds = zonePositions.map(pos => ({
    minCol: Math.floor((pos.x - BUILDING_WIDTH / 2) / TILE_SIZE),
    maxCol: Math.floor((pos.x + BUILDING_WIDTH / 2) / TILE_SIZE),
    minRow: Math.floor((pos.y - BUILDING_HEIGHT / 2) / TILE_SIZE),
    maxRow: Math.floor((pos.y + BUILDING_HEIGHT / 2) / TILE_SIZE),
  }));

  // Draw 1-tile-wide dirt paths from campfire to each building's bottom-center (star pattern)
  for (const zonePos of zonePositions) {
    // Path endpoint: bottom-center of building
    const targetX = zonePos.x;
    const targetY = zonePos.y + BUILDING_HEIGHT / 2;
    const pathCells = bresenhamLine(
      Math.floor(guildHallPos.x / TILE_SIZE),
      Math.floor(guildHallPos.y / TILE_SIZE),
      Math.floor(targetX / TILE_SIZE),
      Math.floor(targetY / TILE_SIZE),
    );
    for (const cell of pathCells) {
      // Single tile wide -- no dx expansion
      if (cell.col >= 0 && cell.col < WORLD_COLS && cell.row >= 0 && cell.row < WORLD_ROWS) {
        grid[cell.row][cell.col] = 'dirt_path';
      }
    }

    // Small 2x1 "doorstep" clearing at building entrance (where path meets building)
    const doorCol = Math.floor(targetX / TILE_SIZE);
    const doorRow = Math.floor(targetY / TILE_SIZE);
    for (let dc = -1; dc <= 0; dc++) {
      const c = doorCol + dc;
      if (c >= 0 && c < WORLD_COLS && doorRow >= 0 && doorRow < WORLD_ROWS) {
        grid[doorRow][c] = 'dirt_path';
      }
    }
  }

  // Small 3x3 dirt clearing at campfire center (was 5x5 for the old guild hall)
  const ghCol = Math.floor(guildHallPos.x / TILE_SIZE);
  const ghRow = Math.floor(guildHallPos.y / TILE_SIZE);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = ghCol + dc;
      const r = ghRow + dr;
      if (c >= 0 && c < WORLD_COLS && r >= 0 && r < WORLD_ROWS) {
        grid[r][c] = 'dirt_path';
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

  // Scatter ground decorations in grass areas between buildings and paths
  // Uses seeded random for deterministic placement (~50 decorations)
  const decorationSeed = seed + 1000; // offset to avoid correlation with grass variants
  let decorationCount = 0;
  const maxDecorations = 50;

  for (let row = 0; row < WORLD_ROWS && decorationCount < maxDecorations; row++) {
    for (let col = 0; col < WORLD_COLS && decorationCount < maxDecorations; col++) {
      // Only decorate grass tiles
      if (!grid[row][col].startsWith('grass')) continue;

      // Skip tiles under building bounding boxes
      let underBuilding = false;
      for (const bb of buildingBounds) {
        if (col >= bb.minCol && col <= bb.maxCol && row >= bb.minRow && row <= bb.maxRow) {
          underBuilding = true;
          break;
        }
      }
      if (underBuilding) continue;

      // Deterministic check: ~6.5% chance of decoration on eligible tiles
      const dHash = seededRandom(decorationSeed, col, row);
      if (dHash >= 0.065) continue;

      decorationCount++;

      // Pixel position for the decoration (center of tile with slight jitter)
      const px = col * TILE_SIZE + TILE_SIZE / 2 + (dHash * 20 - 10);
      const py = row * TILE_SIZE + TILE_SIZE / 2 + (seededRandom(decorationSeed + 1, col, row) * 20 - 10);

      // Choose decoration type based on hash value ranges
      if (dHash < 0.025) {
        // Small rocks: 2-3px gray clusters
        ctx.fillStyle = '#888888';
        ctx.fillRect(px - 1, py - 1, 3, 2);
        ctx.fillStyle = '#666666';
        ctx.fillRect(px, py, 2, 2);
      } else if (dHash < 0.045) {
        // Flowers: 1-2px bright color dots
        const flowerColors = ['#ffdd44', '#ff88aa', '#ffffff', '#ff66cc'];
        const colorIdx = Math.floor(seededRandom(decorationSeed + 2, col, row) * flowerColors.length);
        ctx.fillStyle = flowerColors[colorIdx];
        ctx.fillRect(px, py, 2, 2);
        // Small green stem below
        ctx.fillStyle = '#44aa44';
        ctx.fillRect(px, py + 2, 1, 2);
      } else {
        // Grass tufts: 2-3px darker green clusters
        ctx.fillStyle = '#2d8a2d';
        ctx.fillRect(px - 1, py, 1, 3);
        ctx.fillRect(px + 1, py, 1, 3);
        ctx.fillStyle = '#1d6a1d';
        ctx.fillRect(px, py - 1, 1, 3);
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
