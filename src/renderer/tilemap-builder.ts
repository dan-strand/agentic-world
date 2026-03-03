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
 * Path layout: Star pattern -- 2-tile-wide footpaths radiate from the central
 * campfire to the bottom-center of each building. Dirt-to-grass border
 * transitions on path edges. Small 3x3 clearing at campfire, 2x1 doorstep
 * clearings at each building entrance.
 *
 * Pond: Natural irregular pond between the two bottom buildings with ripples
 * and reed tufts.
 *
 * Ground decorations: ~120 scattered rocks, flowers, grass tufts, mushrooms,
 * and fallen leaves in grass areas (deterministic via seeded random).
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

  // Draw 2-tile-wide dirt paths from campfire to each building's bottom-center (star pattern)
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

    // Determine path direction for widening: use overall direction
    const ghCol = Math.floor(guildHallPos.x / TILE_SIZE);
    const ghRow = Math.floor(guildHallPos.y / TILE_SIZE);
    const tgtCol = Math.floor(targetX / TILE_SIZE);
    const tgtRow = Math.floor(targetY / TILE_SIZE);
    const isMoreVertical = Math.abs(tgtRow - ghRow) >= Math.abs(tgtCol - ghCol);

    for (const cell of pathCells) {
      // Primary tile
      if (cell.col >= 0 && cell.col < WORLD_COLS && cell.row >= 0 && cell.row < WORLD_ROWS) {
        grid[cell.row][cell.col] = 'dirt_path';
      }
      // Widen: add adjacent tile (col+1 for vertical paths, row+1 for horizontal)
      if (isMoreVertical) {
        const wc = cell.col + 1;
        if (wc >= 0 && wc < WORLD_COLS && cell.row >= 0 && cell.row < WORLD_ROWS) {
          grid[cell.row][wc] = 'dirt_path';
        }
      } else {
        const wr = cell.row + 1;
        if (cell.col >= 0 && cell.col < WORLD_COLS && wr >= 0 && wr < WORLD_ROWS) {
          grid[wr][cell.col] = 'dirt_path';
        }
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
  const campCol = Math.floor(guildHallPos.x / TILE_SIZE);
  const campRow = Math.floor(guildHallPos.y / TILE_SIZE);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = campCol + dc;
      const r = campRow + dr;
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

  // ── Path Border Transitions ─────────────────────────────────────────────
  // For each dirt_path tile adjacent to grass, draw 2-3px transitional border
  // (darker grass / lighter dirt blend) along the shared edge.
  const borderColor = 'rgba(100, 90, 50, 0.45)';  // warm semi-transparent brown
  const borderWidth = 3;

  for (let row = 0; row < WORLD_ROWS; row++) {
    for (let col = 0; col < WORLD_COLS; col++) {
      if (grid[row][col] !== 'dirt_path') continue;

      const px = col * TILE_SIZE;
      const py = row * TILE_SIZE;

      ctx.fillStyle = borderColor;

      // Check each neighbor -- if grass, draw border on that edge of the dirt tile
      // Top neighbor is grass -> draw border along top edge inside dirt tile
      if (row > 0 && grid[row - 1][col].startsWith('grass')) {
        ctx.fillRect(px, py, TILE_SIZE, borderWidth);
      }
      // Bottom neighbor is grass
      if (row < WORLD_ROWS - 1 && grid[row + 1][col].startsWith('grass')) {
        ctx.fillRect(px, py + TILE_SIZE - borderWidth, TILE_SIZE, borderWidth);
      }
      // Left neighbor is grass
      if (col > 0 && grid[row][col - 1].startsWith('grass')) {
        ctx.fillRect(px, py, borderWidth, TILE_SIZE);
      }
      // Right neighbor is grass
      if (col < WORLD_COLS - 1 && grid[row][col + 1].startsWith('grass')) {
        ctx.fillRect(px + TILE_SIZE - borderWidth, py, borderWidth, TILE_SIZE);
      }
    }
  }

  // ── Pond Feature ────────────────────────────────────────────────────────
  // Natural pond between the two bottom buildings, offset slightly toward center.
  // Position: bottom-center area (~col 14-19, row 19-22), which is between
  // Ancient Library (x=248, y=584) and Tavern (x=776, y=584).
  // Use pixel coordinates for smooth oval shapes.
  const pondCX = 512;  // horizontal center of world
  const pondCY = 690;  // near bottom, between bottom buildings
  const pondRX = 80;   // ~5 tiles wide radius
  const pondRY = 48;   // ~3 tiles tall radius

  // Outer edge: dark blue-green
  for (let dy = -pondRY - 2; dy <= pondRY + 2; dy++) {
    for (let dx = -pondRX - 2; dx <= pondRX + 2; dx++) {
      const normDist = (dx * dx) / ((pondRX + 2) * (pondRX + 2)) +
                       (dy * dy) / ((pondRY + 2) * (pondRY + 2));
      const innerDist = (dx * dx) / (pondRX * pondRX) +
                        (dy * dy) / (pondRY * pondRY);
      if (normDist <= 1.0 && innerDist > 0.85) {
        // Outer ring: dark blue-green edge
        ctx.fillStyle = 'rgba(20, 50, 90, 0.78)';
        ctx.fillRect(pondCX + dx, pondCY + dy, 1, 1);
      }
    }
  }

  // Middle layer: medium blue fill
  for (let dy = -pondRY; dy <= pondRY; dy++) {
    for (let dx = -pondRX; dx <= pondRX; dx++) {
      const normDist = (dx * dx) / (pondRX * pondRX) + (dy * dy) / (pondRY * pondRY);
      if (normDist <= 0.85) {
        ctx.fillStyle = 'rgb(30, 70, 130)';
        ctx.fillRect(pondCX + dx, pondCY + dy, 1, 1);
      }
    }
  }

  // Center: lighter blue core
  const innerRX = pondRX * 0.55;
  const innerRY = pondRY * 0.55;
  for (let dy = -Math.ceil(innerRY); dy <= Math.ceil(innerRY); dy++) {
    for (let dx = -Math.ceil(innerRX); dx <= Math.ceil(innerRX); dx++) {
      const normDist = (dx * dx) / (innerRX * innerRX) + (dy * dy) / (innerRY * innerRY);
      if (normDist <= 1.0) {
        ctx.fillStyle = 'rgb(50, 100, 160)';
        ctx.fillRect(pondCX + dx, pondCY + dy, 1, 1);
      }
    }
  }

  // White specular highlights
  ctx.fillStyle = 'rgba(200, 220, 255, 0.6)';
  ctx.fillRect(pondCX - 20, pondCY - 12, 3, 1);
  ctx.fillRect(pondCX + 10, pondCY - 8, 2, 1);
  ctx.fillRect(pondCX - 5, pondCY + 5, 2, 1);

  // Ripple lines (lighter blue horizontal streaks)
  ctx.fillStyle = 'rgba(80, 140, 210, 0.7)';
  ctx.fillRect(pondCX - 40, pondCY - 15, 25, 1);
  ctx.fillRect(pondCX + 5, pondCY - 5, 30, 1);
  ctx.fillRect(pondCX - 30, pondCY + 10, 20, 1);
  ctx.fillRect(pondCX + 15, pondCY + 18, 18, 1);

  // Reed tufts along the right edge (2-3 clusters)
  const reedPositions = [
    { rx: pondCX + pondRX - 8, ry: pondCY - 10 },
    { rx: pondCX + pondRX - 5, ry: pondCY + 5 },
    { rx: pondCX + pondRX - 12, ry: pondCY + 15 },
  ];
  for (const reed of reedPositions) {
    // Green reed stalks (1-2px wide, 4-6px tall)
    ctx.fillStyle = '#2a7a2a';
    ctx.fillRect(reed.rx, reed.ry - 5, 1, 6);
    ctx.fillStyle = '#3a9a3a';
    ctx.fillRect(reed.rx + 2, reed.ry - 4, 1, 5);
    ctx.fillStyle = '#2a8a2a';
    ctx.fillRect(reed.rx - 1, reed.ry - 3, 1, 4);
  }

  // ── Enhanced Ground Decorations ─────────────────────────────────────────
  // Scatter ~120 decorations including mushrooms and fallen leaves.
  // Uses seeded random for deterministic placement.
  const decorationSeed = seed + 1000; // offset to avoid correlation with grass variants
  let decorationCount = 0;
  const maxDecorations = 120;

  // Pre-compute pond bounding box for decoration avoidance (tile coords)
  const pondBounds = {
    minCol: Math.floor((pondCX - pondRX - 10) / TILE_SIZE),
    maxCol: Math.ceil((pondCX + pondRX + 10) / TILE_SIZE),
    minRow: Math.floor((pondCY - pondRY - 10) / TILE_SIZE),
    maxRow: Math.ceil((pondCY + pondRY + 10) / TILE_SIZE),
  };

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

      // Skip tiles overlapping the pond area
      if (col >= pondBounds.minCol && col <= pondBounds.maxCol &&
          row >= pondBounds.minRow && row <= pondBounds.maxRow) {
        continue;
      }

      // Deterministic check: ~12% chance of decoration on eligible tiles
      const dHash = seededRandom(decorationSeed, col, row);
      if (dHash >= 0.12) continue;

      decorationCount++;

      // Pixel position for the decoration (center of tile with slight jitter)
      const px = col * TILE_SIZE + TILE_SIZE / 2 + (dHash * 20 - 10);
      const py = row * TILE_SIZE + TILE_SIZE / 2 + (seededRandom(decorationSeed + 1, col, row) * 20 - 10);

      // Choose decoration type based on hash value ranges
      if (dHash < 0.020) {
        // Small rocks: 2-3px gray clusters
        ctx.fillStyle = '#888888';
        ctx.fillRect(px - 1, py - 1, 3, 2);
        ctx.fillStyle = '#666666';
        ctx.fillRect(px, py, 2, 2);
      } else if (dHash < 0.038) {
        // Flowers: 1-2px bright color dots
        const flowerColors = ['#ffdd44', '#ff88aa', '#ffffff', '#ff66cc'];
        const colorIdx = Math.floor(seededRandom(decorationSeed + 2, col, row) * flowerColors.length);
        ctx.fillStyle = flowerColors[colorIdx];
        ctx.fillRect(px, py, 2, 2);
        // Small green stem below
        ctx.fillStyle = '#44aa44';
        ctx.fillRect(px, py + 2, 1, 2);
      } else if (dHash < 0.058) {
        // Grass tufts: 2-3px darker green clusters
        ctx.fillStyle = '#2d8a2d';
        ctx.fillRect(px - 1, py, 1, 3);
        ctx.fillRect(px + 1, py, 1, 3);
        ctx.fillStyle = '#1d6a1d';
        ctx.fillRect(px, py - 1, 1, 3);
      } else if (dHash < 0.078) {
        // Mushrooms: tan cap on white stem (3-4px tall)
        // White stem
        ctx.fillStyle = '#eeeecc';
        ctx.fillRect(px, py, 1, 3);
        // Tan/brown cap
        ctx.fillStyle = '#c8a050';
        ctx.fillRect(px - 1, py - 1, 3, 2);
        // Cap highlight
        ctx.fillStyle = '#ddb868';
        ctx.fillRect(px, py - 1, 1, 1);
      } else if (dHash < 0.098) {
        // Fallen leaves: orange/brown 2-3px shapes
        const leafHash = seededRandom(decorationSeed + 3, col, row);
        if (leafHash < 0.5) {
          // Orange leaf
          ctx.fillStyle = '#cc8833';
          ctx.fillRect(px, py, 2, 1);
          ctx.fillRect(px + 1, py + 1, 1, 1);
        } else {
          // Brown leaf
          ctx.fillStyle = '#8a6030';
          ctx.fillRect(px, py, 1, 2);
          ctx.fillRect(px + 1, py, 1, 1);
        }
      } else {
        // Small paired stones (gray 1-2px)
        ctx.fillStyle = '#999999';
        ctx.fillRect(px, py, 2, 1);
        ctx.fillStyle = '#777777';
        ctx.fillRect(px + 3, py + 1, 1, 1);
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
