import { Container, Sprite } from 'pixi.js';
import { sceneryTextures } from './asset-loader';
import {
  WORLD_WIDTH, WORLD_HEIGHT, BUILDING_WIDTH, BUILDING_HEIGHT,
  CAMPFIRE_POS, QUEST_ZONE_POSITIONS,
} from '../shared/constants';

/** Light source positions for night glow placement (used by night-glow-layer.ts). */
export interface LightSourceDef {
  x: number;
  y: number;
  type: 'lantern' | 'torch' | 'campfire' | 'window';
}

export const LIGHT_SOURCE_POSITIONS: LightSourceDef[] = [
  // Lanterns at path intersections
  { x: 482, y: 354, type: 'lantern' },
  { x: 542, y: 354, type: 'lantern' },
  { x: 482, y: 414, type: 'lantern' },
  { x: 542, y: 414, type: 'lantern' },
  // Lanterns along center cross paths
  { x: 512, y: 300, type: 'lantern' },
  { x: 512, y: 468, type: 'lantern' },
  // Torches near building entrances (2 per building)
  // Wizard Tower (coding) at (248, 184): entrance at y=184+168+12=364
  { x: 248 - 16, y: 364, type: 'torch' },
  { x: 248 + 16, y: 364, type: 'torch' },
  // Training Grounds (testing) at (776, 184): entrance at y=364
  { x: 776 - 16, y: 364, type: 'torch' },
  { x: 776 + 16, y: 364, type: 'torch' },
  // Ancient Library (reading) at (248, 584): entrance at y=584+168+12=764
  { x: 248 - 16, y: 764, type: 'torch' },
  { x: 248 + 16, y: 764, type: 'torch' },
  // Tavern (comms) at (776, 584): entrance at y=764
  { x: 776 - 16, y: 764, type: 'torch' },
  { x: 776 + 16, y: 764, type: 'torch' },
  // Campfire
  { x: 512, y: 384, type: 'campfire' },
  // Building windows (center of each building, offset upward into the structure)
  { x: 248, y: 100, type: 'window' },   // Wizard Tower window area
  { x: 776, y: 100, type: 'window' },   // Training Grounds window area
  { x: 248, y: 500, type: 'window' },   // Ancient Library window area
  { x: 776, y: 500, type: 'window' },   // Tavern window area
];

/**
 * Seeded random number generator (same algorithm as tilemap-builder.ts).
 * Returns a value in [0, 1) that is deterministic for a given (seed, x, y).
 */
function seededRandom(seed: number, x: number, y: number): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

/** Bounding box for collision checks */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Build exclusion zones for all buildings and campfire.
 * Buildings use anchor (0.5, 1.0) positioned at (pos.x, pos.y + BUILDING_HEIGHT/2).
 * So top-left of building = (pos.x - BUILDING_WIDTH/2, pos.y + BUILDING_HEIGHT/2 - BUILDING_HEIGHT)
 *                          = (pos.x - BUILDING_WIDTH/2, pos.y - BUILDING_HEIGHT/2)
 */
function buildExclusionZones(): Rect[] {
  const zones: Rect[] = [];
  const halfW = BUILDING_WIDTH / 2;
  const halfH = BUILDING_HEIGHT / 2;
  const margin = 8; // Small margin around buildings

  for (const pos of Object.values(QUEST_ZONE_POSITIONS)) {
    zones.push({
      x: pos.x - halfW - margin,
      y: pos.y - halfH - margin,
      w: BUILDING_WIDTH + margin * 2,
      h: BUILDING_HEIGHT + margin * 2,
    });
  }

  // Campfire exclusion zone (64x64 + 20px margin)
  const cfMargin = 20;
  const cfSize = 64;
  zones.push({
    x: CAMPFIRE_POS.x - cfSize / 2 - cfMargin,
    y: CAMPFIRE_POS.y - cfSize / 2 - cfMargin,
    w: cfSize + cfMargin * 2,
    h: cfSize + cfMargin * 2,
  });

  return zones;
}

/** Check if a point is inside any exclusion zone */
function isExcluded(px: number, py: number, zones: Rect[]): boolean {
  for (const z of zones) {
    if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) {
      return true;
    }
  }
  return false;
}

/**
 * Place a sprite at the given position with the given frame name.
 * Tall objects (trees, lanterns, torches, signposts, well) use anchor (0.5, 1.0).
 * Flat objects (flowers, fences, bushes) use anchor (0.5, 0.5).
 */
function placeSprite(
  container: Container,
  frameName: string,
  x: number,
  y: number,
  tall: boolean,
): void {
  const texture = sceneryTextures[frameName];
  if (!texture) return;
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, tall ? 1.0 : 0.5);
  sprite.position.set(x, y);
  container.addChild(sprite);
}

/**
 * Build the scenery layer: a Container populated with trees, bushes, flowers,
 * village props, fences, lanterns, and torches placed in the gaps between buildings.
 *
 * Uses seeded random placement for deterministic layout across sessions.
 * Scenery never overlaps buildings or the campfire zone.
 */
export function buildSceneryLayer(): Container {
  const container = new Container();
  container.eventMode = 'none';
  container.interactiveChildren = false;

  const zones = buildExclusionZones();
  const SEED = 7777;

  // ── Placement areas ──
  // The center cross: horizontal strip at y=352..416 (campfire row) and vertical strip at x=480..544 (campfire col)
  // Corner pockets and edge strips are also available
  // We generate candidate positions using seeded random and reject those in exclusion zones.

  // Helper: generate N valid positions in a region using seeded random
  function generatePositions(
    count: number,
    seedOffset: number,
    xMin: number, xMax: number,
    yMin: number, yMax: number,
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    let attempts = 0;
    let idx = 0;
    while (positions.length < count && attempts < count * 10) {
      const rx = seededRandom(SEED + seedOffset, idx, 0);
      const ry = seededRandom(SEED + seedOffset, idx, 1);
      const px = xMin + rx * (xMax - xMin);
      const py = yMin + ry * (yMax - yMin);
      attempts++;
      idx++;
      if (!isExcluded(px, py, zones)) {
        positions.push({ x: px, y: py });
      }
    }
    return positions;
  }

  // ── Trees (SCEN-01) ──
  // Pine trees: 10 scattered, preferring edges and corners
  const pinePositions = generatePositions(10, 100, 10, WORLD_WIDTH - 10, 10, WORLD_HEIGHT - 10);
  for (const pos of pinePositions) {
    const jx = seededRandom(SEED + 101, Math.floor(pos.x), Math.floor(pos.y)) * 16 - 8;
    const jy = seededRandom(SEED + 102, Math.floor(pos.x), Math.floor(pos.y)) * 16 - 8;
    placeSprite(container, 'pine_tree', pos.x + jx, pos.y + jy, true);
  }

  // Oak trees: 7 scattered, slightly more toward center gaps
  const oakPositions = generatePositions(7, 200, 50, WORLD_WIDTH - 50, 50, WORLD_HEIGHT - 50);
  for (const pos of oakPositions) {
    const jx = seededRandom(SEED + 201, Math.floor(pos.x), Math.floor(pos.y)) * 16 - 8;
    const jy = seededRandom(SEED + 202, Math.floor(pos.x), Math.floor(pos.y)) * 16 - 8;
    placeSprite(container, 'oak_tree', pos.x + jx, pos.y + jy, true);
  }

  // ── Bushes and flowers (SCEN-01) ──
  // Large bushes: 12 near building edges and center cross
  const bushLargePositions = generatePositions(12, 300, 20, WORLD_WIDTH - 20, 20, WORLD_HEIGHT - 20);
  for (const pos of bushLargePositions) {
    placeSprite(container, 'bush_large', pos.x, pos.y, false);
  }

  // Small bushes: 17 filling gaps between trees
  const bushSmallPositions = generatePositions(17, 400, 15, WORLD_WIDTH - 15, 15, WORLD_HEIGHT - 15);
  for (const pos of bushSmallPositions) {
    placeSprite(container, 'bush_small', pos.x, pos.y, false);
  }

  // Red flowers: 9 clusters in visible open areas
  const flowersRedPositions = generatePositions(9, 500, 30, WORLD_WIDTH - 30, 30, WORLD_HEIGHT - 30);
  for (const pos of flowersRedPositions) {
    placeSprite(container, 'flowers_red', pos.x, pos.y, false);
  }

  // Blue flowers: 7 clusters scattered
  const flowersBluePositions = generatePositions(7, 600, 30, WORLD_WIDTH - 30, 30, WORLD_HEIGHT - 30);
  for (const pos of flowersBluePositions) {
    placeSprite(container, 'flowers_blue', pos.x, pos.y, false);
  }

  // ── Village props (SCEN-02) ──
  // Well: near center, offset from campfire (between campfire and Wizard Tower)
  const wellPos = { x: 450, y: 320 };
  if (!isExcluded(wellPos.x, wellPos.y, zones)) {
    placeSprite(container, 'well', wellPos.x, wellPos.y, true);
  }

  // Signposts: near path intersections on the center cross (4 total)
  const signpostPositions = [
    { x: 470, y: 350 },  // Near campfire NW
    { x: 554, y: 350 },  // Near campfire NE
    { x: 470, y: 418 },  // Near campfire SW
    { x: 554, y: 418 },  // Near campfire SE
  ];
  for (const pos of signpostPositions) {
    if (!isExcluded(pos.x, pos.y, zones)) {
      placeSprite(container, 'signpost', pos.x, pos.y, true);
    }
  }

  // Barrels: 3 near Tavern building edge (bottom-right)
  const tavernPos = QUEST_ZONE_POSITIONS.comms;
  const barrelPositions = [
    { x: tavernPos.x + BUILDING_WIDTH / 2 + 14, y: tavernPos.y - 20 },
    { x: tavernPos.x + BUILDING_WIDTH / 2 + 14, y: tavernPos.y + 10 },
    { x: tavernPos.x + BUILDING_WIDTH / 2 + 30, y: tavernPos.y - 5 },
  ];
  for (const pos of barrelPositions) {
    if (!isExcluded(pos.x, pos.y, zones)) {
      placeSprite(container, 'barrel', pos.x, pos.y, true);
    }
  }

  // Crates: 3 near Training Grounds building edge (top-right)
  const trainingPos = QUEST_ZONE_POSITIONS.testing;
  const cratePositions = [
    { x: trainingPos.x + BUILDING_WIDTH / 2 + 14, y: trainingPos.y - 40 },
    { x: trainingPos.x + BUILDING_WIDTH / 2 + 14, y: trainingPos.y - 10 },
    { x: trainingPos.x + BUILDING_WIDTH / 2 + 30, y: trainingPos.y - 25 },
  ];
  for (const pos of cratePositions) {
    if (!isExcluded(pos.x, pos.y, zones)) {
      placeSprite(container, 'crate', pos.x, pos.y, false);
    }
  }

  // Market stall: near Ancient Library entrance (bottom-left)
  const libraryPos = QUEST_ZONE_POSITIONS.reading;
  const marketPos = { x: libraryPos.x - BUILDING_WIDTH / 2 - 20, y: libraryPos.y + 40 };
  if (!isExcluded(marketPos.x, marketPos.y, zones)) {
    placeSprite(container, 'market_stall', marketPos.x, marketPos.y, false);
  }

  // ── Fences (SCEN-02) ──
  // Horizontal fences along path edges
  const fenceHPositions = [
    { x: 380, y: 352 },  // Left of center horizontal gap
    { x: 640, y: 352 },  // Right of center horizontal gap
    { x: 380, y: 416 },  // Left of center lower gap
    { x: 640, y: 416 },  // Right of center lower gap
    { x: 200, y: 384 },  // Far left center
  ];
  for (const pos of fenceHPositions) {
    if (!isExcluded(pos.x, pos.y, zones)) {
      placeSprite(container, 'fence_h', pos.x, pos.y, false);
    }
  }

  // Vertical fences
  const fenceVPositions = [
    { x: 480, y: 280 },  // Above campfire
    { x: 544, y: 280 },  // Above campfire right
    { x: 480, y: 490 },  // Below campfire
  ];
  for (const pos of fenceVPositions) {
    if (!isExcluded(pos.x, pos.y, zones)) {
      placeSprite(container, 'fence_v', pos.x, pos.y, false);
    }
  }

  // ── Lanterns and torches (SCEN-04) ──
  // Lanterns at path intersections on the center cross (4 total)
  const lanternIntersections = [
    { x: 482, y: 354 },  // NW intersection
    { x: 542, y: 354 },  // NE intersection
    { x: 482, y: 414 },  // SW intersection
    { x: 542, y: 414 },  // SE intersection
  ];
  for (const pos of lanternIntersections) {
    if (!isExcluded(pos.x, pos.y, zones)) {
      placeSprite(container, 'lantern', pos.x, pos.y, true);
    }
  }

  // Lanterns along main center cross paths (2 additional)
  const lanternPaths = [
    { x: 512, y: 300 },  // Center cross, above campfire
    { x: 512, y: 468 },  // Center cross, below campfire
  ];
  for (const pos of lanternPaths) {
    if (!isExcluded(pos.x, pos.y, zones)) {
      placeSprite(container, 'lantern', pos.x, pos.y, true);
    }
  }

  // Torches near building entrances (2 per building = 8 total)
  // Buildings are at QUEST_ZONE_POSITIONS with anchor bottom-center
  // Entrance is at (buildingPos.x, buildingPos.y + BUILDING_HEIGHT/2 + 10)
  const buildingEntries = [
    QUEST_ZONE_POSITIONS.coding,   // Wizard Tower (top-left)
    QUEST_ZONE_POSITIONS.testing,  // Training Grounds (top-right)
    QUEST_ZONE_POSITIONS.reading,  // Ancient Library (bottom-left)
    QUEST_ZONE_POSITIONS.comms,    // Tavern (bottom-right)
  ];
  for (const bPos of buildingEntries) {
    const entranceY = bPos.y + BUILDING_HEIGHT / 2 + 12;
    const torch1 = { x: bPos.x - 16, y: entranceY };
    const torch2 = { x: bPos.x + 16, y: entranceY };
    if (!isExcluded(torch1.x, torch1.y, zones)) {
      placeSprite(container, 'torch', torch1.x, torch1.y, true);
    }
    if (!isExcluded(torch2.x, torch2.y, zones)) {
      placeSprite(container, 'torch', torch2.x, torch2.y, true);
    }
  }

  // ── Sort children by Y position for depth ordering ──
  container.children.sort((a, b) => a.y - b.y);

  return container;
}
