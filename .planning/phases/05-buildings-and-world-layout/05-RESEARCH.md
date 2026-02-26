# Phase 5: Buildings and World Layout - Research

**Researched:** 2026-02-26
**Domain:** Building sprite generation, atlas-based rendering, world layout refactoring, compound-to-building migration (PixiJS 8 + Electron + existing asset pipeline)
**Confidence:** HIGH

## Summary

Phase 5 replaces the dynamic spy-themed compound system and code-drawn HQ pentagon with static Fantasy RPG building sprites -- a Guild Hall at the world center and four quest zone buildings (Wizard Tower, Training Grounds, Ancient Library, Tavern) at the fixed positions already defined in `constants.ts`. This is primarily a rendering replacement (swapping code-drawn `Graphics` containers with atlas-backed `Sprite` objects) combined with a world architecture refactoring that removes the dynamic compound lifecycle (spawn/fade/reposition) in favor of five always-visible buildings.

The existing asset pipeline from Phase 4 (pngjs atlas generation, CopyWebpackPlugin, `loadAllAssets()`, `tileTextures` map pattern) provides the exact infrastructure needed. Buildings will be generated as a new `buildings.png` atlas alongside the existing `tiles.png`, loaded through the same `asset-loader.ts` system, and rendered as `Sprite` objects using direct texture references from the spritesheet. No new dependencies are needed.

The most significant code change is gutting the dynamic compound management in `world.ts`. The current system dynamically creates/destroys `Compound` containers based on which projects have active sessions, positions them via radial layout, and uses fade-in/fade-out lifecycle. Phase 5 replaces this with five permanent building objects that are always visible and never move. Agent routing (which building to walk to based on activity type) becomes a simple lookup rather than a compound assignment system. The `compound.ts`, `compound-layout.ts`, and `hq.ts` files will be fully replaced.

**Primary recommendation:** Extend the pngjs atlas generation script to produce a `buildings.png` atlas with 5 building sprites (Guild Hall + 4 quest zones), load it through `asset-loader.ts` using the same pattern as tiles, create a `Building` class that renders a Sprite from the atlas, replace the HQ/Compound/CompoundLayout system with a `BuildingsLayer` that holds 5 static Building instances, and refactor `world.ts` to route agents directly to building positions instead of through the compound lifecycle.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| THEME-02 | Central HQ is replaced with a Guild Hall building sprite where idle agents rest | Guild Hall building sprite generated via pngjs in atlas, rendered as Sprite at `GUILD_HALL_POS` (512, 384), `getIdlePosition()` method preserved for agent positioning in front of building |
| THEME-03 | Mission locations are replaced with 4 themed quest zone buildings: Wizard Tower (coding), Training Grounds (testing), Ancient Library (reading), Tavern (comms) | Four building sprites in atlas at `QUEST_ZONE_POSITIONS`, each visually distinct via programmatic pixel art, direct activity-to-building mapping in constants |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | ^8.16.0 | Sprite rendering from atlas textures (existing) | `new Sprite(texture)` with texture from spritesheet frames. Already proven for tiles. |
| pngjs | ^7.0.0 | Programmatic building sprite atlas generation (existing) | Same approach as tiles.png -- deterministic pixel-art building generation via script |
| copy-webpack-plugin | ^13.0.1 | Serve buildings.png + buildings.json via webpack (existing) | Already configured in webpack.renderer.config.ts to copy entire `assets/` directory |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | Phase 5 requires no new dependencies. Existing stack is fully sufficient. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Programmatic pngjs building generation | CC0 building sprite packs from Kenney/OpenGameArt | Kenney RPG packs are 16x16 (not 32x32). OpenGameArt CC0 packs exist but visual consistency with existing tile style is uncertain. Programmatic generation guarantees pixel-perfect style match and is the established project pattern. |
| Separate buildings.png atlas | Add building frames to existing tiles.png | Separate atlas keeps concerns isolated. tiles.png is ground layer, buildings.png is structural layer. Cleaner for future phases that may add more building variants. |
| Static Sprite buildings | Keep Graphics-drawn buildings (just restyle) | Sprite rendering from atlas is the v1.1 direction (atlas-first). Staying with Graphics contradicts the established v1.1 pattern and would need to be replaced later anyway. |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
  generate-tiles.js           # EXISTING: tile atlas generation
  generate-buildings.js       # NEW: building atlas generation (same pattern)
assets/
  sprites/
    tiles.json                # EXISTING: tile spritesheet descriptor
    tiles.png                 # EXISTING: tile atlas
    buildings.json            # NEW: building spritesheet descriptor
    buildings.png             # NEW: building atlas (5 frames)
src/
  renderer/
    asset-loader.ts           # MODIFY: add buildings atlas loading + buildingTextures map
    building.ts               # NEW: Building class (Sprite + label + idle positions)
    world.ts                  # MODIFY: replace compound system with static buildings
  shared/
    constants.ts              # MODIFY: add building size constants, update activity mapping
```

### Files to Remove
```
src/renderer/compound.ts        # REMOVE: replaced by building.ts
src/renderer/compound-layout.ts # REMOVE: buildings are at fixed positions, no radial layout
src/renderer/hq.ts              # REMOVE: replaced by Guild Hall building
```

### Pattern 1: Atlas-First Building Sprites via pngjs Generation
**What:** Generate building sprites programmatically using pngjs (same as tiles), pack into a spritesheet atlas with JSON descriptor, load via `Assets.load()`.
**When to use:** For all building visuals in Phase 5.
**Example:**
```typescript
// scripts/generate-buildings.js (follows generate-tiles.js pattern)
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

// 5 buildings, each 96x96 pixels (3x3 tiles) -> atlas is 480x96
const BUILDING_SIZE = 96;  // 3 tiles wide/tall
const ATLAS_WIDTH = 480;   // 5 buildings * 96
const ATLAS_HEIGHT = 96;

const png = new PNG({ width: ATLAS_WIDTH, height: ATLAS_HEIGHT });

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= ATLAS_WIDTH || y < 0 || y >= ATLAS_HEIGHT) return;
  const idx = (y * ATLAS_WIDTH + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

// Draw each building at offset: guild_hall(0), wizard_tower(96), ...
// ... (building pixel art generation functions)

const outPath = path.resolve(__dirname, '..', 'assets', 'sprites', 'buildings.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(outPath, buffer);
```

```json
// assets/sprites/buildings.json
{
  "frames": {
    "guild_hall": {
      "frame": { "x": 0, "y": 0, "w": 96, "h": 96 },
      "rotated": false, "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 96, "h": 96 },
      "sourceSize": { "w": 96, "h": 96 }
    },
    "wizard_tower": {
      "frame": { "x": 96, "y": 0, "w": 96, "h": 96 },
      ...
    },
    "training_grounds": { ... },
    "ancient_library": { ... },
    "tavern": { ... }
  },
  "meta": {
    "app": "Agent World",
    "version": "1.0",
    "image": "buildings.png",
    "format": "RGBA8888",
    "size": { "w": 480, "h": 96 },
    "scale": "1"
  }
}
```

### Pattern 2: Building Class Wrapping Sprite + Agent Positioning
**What:** A `Building` class extending `Container` that holds a `Sprite` from the atlas texture, a `BitmapText` label, and provides agent positioning methods (idle positions, work position, entrance).
**When to use:** For every building in the world (Guild Hall + 4 quest zones).
**Example:**
```typescript
// src/renderer/building.ts
import { Container, Sprite, BitmapText, Texture } from 'pixi.js';

export type BuildingType = 'guild_hall' | 'wizard_tower' | 'training_grounds' | 'ancient_library' | 'tavern';

export class Building extends Container {
  readonly buildingType: BuildingType;
  private sprite: Sprite;

  constructor(buildingType: BuildingType, texture: Texture, label: string) {
    super();
    this.buildingType = buildingType;

    this.sprite = new Sprite(texture);
    // Anchor at bottom-center for consistent ground placement
    this.sprite.anchor.set(0.5, 1);
    this.addChild(this.sprite);

    const text = new BitmapText({
      text: label,
      style: { fontFamily: 'PixelSignpost', fontSize: 16 },
    });
    text.anchor.set(0.5, 1);
    text.position.set(0, -this.sprite.height - 4);
    this.addChild(text);
  }

  /** Where agents stand when idle (in front of building entrance). */
  getIdlePosition(index: number, totalIdle: number): { x: number; y: number } {
    const spacing = 30;
    const totalWidth = (totalIdle - 1) * spacing;
    const startX = -totalWidth / 2;
    return {
      x: startX + index * spacing,
      y: 20, // below building sprite bottom
    };
  }

  /** Where agents work (inside/near building). */
  getWorkPosition(): { x: number; y: number } {
    return { x: 0, y: -16 }; // near building center
  }

  /** Where agents enter/exit. */
  getEntrancePosition(): { x: number; y: number } {
    return { x: 0, y: 10 }; // at building base
  }
}
```

### Pattern 3: Asset Loader Extension (Parallel Atlas Loading)
**What:** Extend `loadAllAssets()` to load the buildings atlas alongside tiles, with a `buildingTextures` map export.
**When to use:** Asset initialization at app startup.
**Example:**
```typescript
// src/renderer/asset-loader.ts (extended)
import { Assets, Spritesheet, Texture } from 'pixi.js';

export const tileTextures: Record<string, Texture> = {};
export const buildingTextures: Record<string, Texture> = {};

export async function loadAllAssets(): Promise<void> {
  // Load both atlases (they share the same ../assets/sprites/ base path)
  const [tileSheet, buildingSheet] = await Promise.all([
    Assets.load('../assets/sprites/tiles.json') as Promise<Spritesheet>,
    Assets.load('../assets/sprites/buildings.json') as Promise<Spritesheet>,
  ]);

  for (const [name, texture] of Object.entries(tileSheet.textures)) {
    tileTextures[name] = texture;
  }
  for (const [name, texture] of Object.entries(buildingSheet.textures)) {
    buildingTextures[name] = texture;
  }
}
```

### Pattern 4: World Refactoring -- Static Buildings Replace Dynamic Compounds
**What:** Replace the compound lifecycle (spawn, fade, reposition, despawn) with five permanent Building instances. Agent routing changes from "which compound is my project in?" to "which building matches my activity type?".
**When to use:** The core world.ts refactoring for Phase 5.
**Key changes:**
```typescript
// BEFORE (world.ts -- compound system):
// - compounds: Map<string, CompoundEntry>  (dynamic per-project)
// - manageCompounds()  (spawn/despawn/fade/reposition)
// - agentCompoundAssignment: Map  (tracks which compound each agent is in)
// - getGlobalCompoundEntrance()  (local-to-global via compound entry)
// - getGlobalSubLocation()  (local-to-global via compound entry)

// AFTER (world.ts -- static buildings):
// - guildHall: Building  (permanent, at GUILD_HALL_POS)
// - questZones: Map<ActivityType, Building>  (permanent, at QUEST_ZONE_POSITIONS)
// - Agent routing: activity type -> building position (direct lookup)
// - No compound lifecycle, no fade-in/fade-out, no radial repositioning
```

### Pattern 5: Building Size and Positioning Strategy
**What:** Buildings span 3x3 tiles (96x96 pixels) which is large enough to be visually distinct but small enough to fit the layout. The Guild Hall can be slightly larger (4x4 = 128x128) as the central focal point.
**When to use:** Building sprite generation and world layout.
**Rationale:**
```
World: 1024 x 768 (32 x 24 tiles)
Guild Hall: center (512, 384) -- 128x128 or 96x96
Wizard Tower: top-left (192, 160) -- 96x96
Training Grounds: top-right (832, 160) -- 96x96
Ancient Library: bottom-left (192, 608) -- 96x96
Tavern: bottom-right (832, 608) -- 96x96

Distance from center to corner zones: ~420px diagonal
Path width: 3 tiles (96px)
Space between buildings and world edges: sufficient at all positions
```

### Anti-Patterns to Avoid
- **Keeping compound.ts alive with visual-only changes:** The dynamic compound lifecycle is fundamentally wrong for static buildings. Don't try to adapt the spawn/fade/reposition code. Delete it entirely and build fresh with static objects.
- **Using Graphics to draw building shapes programmatically at runtime:** v1.1 is atlas-first. Buildings must be Sprite objects from atlas textures, not code-drawn Graphics (even if the atlas is programmatically generated offline).
- **One building per project (preserving compound semantics):** Quest zone buildings are per-activity-type, not per-project. Multiple projects' agents can work at the same quest zone building simultaneously. This is a fundamental semantic change from the compound model.
- **Rendering buildings on the tilemap canvas:** Buildings are interactive scene objects (agents walk to them), not static ground. They must be separate Container/Sprite objects above the tilemap layer, not baked into the ground canvas.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Building sprite creation | Runtime Graphics drawing for buildings | pngjs atlas generation script (offline) | Established project pattern. Deterministic, reproducible, atlas-first. |
| Spritesheet JSON descriptor | Manual JSON editing per building | Hand-write the JSON once (5 frames is trivial) | Only 5 frames. No tool needed for this size. Free Texture Packer overkill. |
| Agent-to-building routing | Complex per-project compound assignment | Simple `ACTIVITY_TO_BUILDING` map in constants | Activity type maps 1:1 to building. No dynamic assignment needed. |
| Building positioning | Radial layout algorithm | Hardcoded positions in constants.ts | Positions are already defined (`QUEST_ZONE_POSITIONS`). They never change. |

**Key insight:** The compound system's complexity existed because buildings were per-project and dynamic. With static per-activity-type buildings, the entire compound lifecycle (spawn, fade, reposition, despawn, assignment tracking) is unnecessary overhead. The replacement is dramatically simpler.

## Common Pitfalls

### Pitfall 1: Agent State Machine References to Compound Semantics
**What goes wrong:** Agent states like `driving_to_compound`, `walking_to_entrance` reference compound concepts that no longer exist after removing compounds.
**Why it happens:** The agent state machine in `agent.ts` was designed around the compound lifecycle with driving/walking phases.
**How to avoid:** Rename states to be building-generic: `walking_to_building`, `walking_from_building`. Remove driving states entirely since vehicles are removed in Phase 6 (AGENT-02), BUT Phase 5 should not remove vehicles yet -- that's Phase 6's scope. Phase 5 should preserve vehicle/driving mechanics but route them to building positions instead of compound positions. Keep the agent state machine functional but point it at buildings instead of compounds.
**Warning signs:** Runtime errors about missing compound references. Agents stuck in limbo states.

### Pitfall 2: Breaking Agent Positioning When Removing Compounds
**What goes wrong:** Agents that were positioned relative to compound containers (local coordinates converted to global) now have incorrect positions because buildings use different anchor points or coordinate systems.
**Why it happens:** Compounds used top-left origin with explicit width/height offsets. Buildings may use bottom-center anchor for ground placement.
**How to avoid:** Building's agent position methods must return values in the same coordinate space that world.ts expects. Test idle positioning at Guild Hall and work positioning at quest zones explicitly. Use `building.toGlobal()` / `building.toLocal()` if needed, or have Building methods return offsets from the building's world position.
**Warning signs:** Agents rendered at (0,0) or at building center instead of entrance. Agents overlapping buildings instead of standing in front.

### Pitfall 3: Forgetting to Update the Asset Loader Path Pattern
**What goes wrong:** `buildings.json` fails to load with 404 error.
**Why it happens:** The `../` prefix required for Electron Forge's main_window subdirectory structure is easy to forget when adding a new atlas.
**How to avoid:** Use `../assets/sprites/buildings.json` matching the exact same pattern as the existing `../assets/sprites/tiles.json`. The CopyWebpackPlugin already copies the entire `assets/` directory.
**Warning signs:** Console error `Failed to load`, `404 Not Found` for buildings.json.

### Pitfall 4: Building Sprites Rendered Blurry Despite nearest-neighbor
**What goes wrong:** Building sprites look blurry/soft despite tiles rendering crisply.
**Why it happens:** If building sprites are created with non-integer dimensions or positioned at sub-pixel coordinates, PixiJS interpolates even with nearest-neighbor scaleMode.
**How to avoid:** Building sprites must be exact pixel dimensions (96x96, 128x128). Position buildings at integer pixel coordinates. `roundPixels: true` is already set on the Application. Verify building positions in constants.ts are integers (they already are).
**Warning signs:** Building edges look softer than tile edges. Building appears slightly offset from dirt clearing.

### Pitfall 5: Removing Too Much in Phase 5 (Scope Creep into Phase 6)
**What goes wrong:** While replacing compounds, implementer also removes vehicles, replaces agent sprites, or changes celebration effects -- all Phase 6/7 work.
**Why it happens:** Once you're deep in world.ts refactoring, it's tempting to "clean up" the vehicle system or agent Graphics since they're spy-themed too.
**How to avoid:** Phase 5 scope is BUILDINGS ONLY. Agents still use their existing code-drawn Graphics spy sprites. Vehicles still exist. Fireworks still exist. The only spy-themed elements being removed are: HQ (pentagon building), Compound (fenced rectangle), CompoundLayout (radial positioning). Agent rendering changes are Phase 6.
**Warning signs:** Touching agent-sprites.ts, vehicle.ts, or fireworks.ts. Any changes to agent rendering code.

### Pitfall 6: Activity-to-Building Routing Breaks Idle Agent Flow
**What goes wrong:** When all sessions become idle, agents don't know where to go because there's no "idle building" in the activity-to-zone mapping.
**Why it happens:** The `idle` activity type doesn't map to a quest zone -- it maps to the Guild Hall. The compound system handled this with a separate HQ concept.
**How to avoid:** Maintain the Guild Hall as the explicit idle destination. The routing logic should be: `idle` -> Guild Hall, any non-idle activity -> corresponding quest zone building. This mirrors the existing HQ/compound split but with simpler implementation.
**Warning signs:** Idle agents teleporting to (0,0) or to a quest zone. Agents not returning to Guild Hall after work.

## Code Examples

Verified patterns from the existing codebase and PixiJS 8 documentation:

### Building Atlas Generation Script (generate-buildings.js)
```javascript
// scripts/generate-buildings.js
// Generates 5 building sprites in a single atlas PNG.
// Each building is 96x96 (3x3 tiles). Guild Hall may be larger.
// Pattern follows generate-tiles.js exactly.

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const BUILDING_W = 96;
const BUILDING_H = 96;
const COUNT = 5;
const WIDTH = BUILDING_W * COUNT; // 480
const HEIGHT = BUILDING_H;        // 96

const png = new PNG({ width: WIDTH, height: HEIGHT });

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function fillRect(x, y, w, h, r, g, b) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(x + dx, y + dy, r, g, b);
    }
  }
}

// Building 0 (offset 0): Guild Hall -- large stone building with banner
function drawGuildHall(ox) {
  // Stone walls
  fillRect(ox + 16, 20, 64, 60, 140, 130, 110);
  // Roof (darker brown wood)
  fillRect(ox + 12, 10, 72, 16, 100, 70, 40);
  // Roof peak
  fillRect(ox + 24, 2, 48, 12, 110, 78, 45);
  // Door
  fillRect(ox + 38, 56, 20, 24, 80, 55, 30);
  // Door arch
  fillRect(ox + 36, 52, 24, 6, 100, 70, 40);
  // Windows
  fillRect(ox + 22, 36, 12, 14, 140, 180, 220);
  fillRect(ox + 62, 36, 12, 14, 140, 180, 220);
  // Banner/flag pole
  fillRect(ox + 47, 2, 2, 10, 120, 120, 120);
  fillRect(ox + 49, 2, 8, 6, 180, 40, 40);
}

// Building 1 (offset 96): Wizard Tower -- tall narrow tower with glowing top
// Building 2 (offset 192): Training Grounds -- wide low building with fence
// Building 3 (offset 288): Ancient Library -- building with columns and books
// Building 4 (offset 384): Tavern -- warm cozy building with chimney smoke

drawGuildHall(0);
// drawWizardTower(96);
// drawTrainingGrounds(192);
// drawAncientLibrary(288);
// drawTavern(384);

const outPath = path.resolve(__dirname, '..', 'assets', 'sprites', 'buildings.png');
const buffer = PNG.sync.write(png);
fs.writeFileSync(outPath, buffer);
```

### Asset Loader Extension
```typescript
// src/renderer/asset-loader.ts -- extended for buildings
import { Assets, Spritesheet, Texture } from 'pixi.js';

export const tileTextures: Record<string, Texture> = {};
export const buildingTextures: Record<string, Texture> = {};

export async function loadAllAssets(): Promise<void> {
  // Load both atlases in parallel
  const [tileSheet, buildingSheet] = await Promise.all([
    Assets.load('../assets/sprites/tiles.json') as Promise<Spritesheet>,
    Assets.load('../assets/sprites/buildings.json') as Promise<Spritesheet>,
  ]);

  for (const [name, texture] of Object.entries(tileSheet.textures)) {
    tileTextures[name] = texture;
  }
  for (const [name, texture] of Object.entries(buildingSheet.textures)) {
    buildingTextures[name] = texture;
  }
}
```

### Constants Extensions
```typescript
// src/shared/constants.ts -- additions for Phase 5

// Building sizes (pixels)
export const BUILDING_WIDTH = 96;   // 3 tiles
export const BUILDING_HEIGHT = 96;  // 3 tiles

// Activity type -> building type mapping
export const ACTIVITY_BUILDING: Record<ActivityType, string> = {
  coding:  'wizard_tower',
  testing: 'training_grounds',
  reading: 'ancient_library',
  comms:   'tavern',
  idle:    'guild_hall',
};

// Building display labels
export const BUILDING_LABELS: Record<string, string> = {
  guild_hall:       'Guild Hall',
  wizard_tower:     'Wizard Tower',
  training_grounds: 'Training Grounds',
  ancient_library:  'Ancient Library',
  tavern:           'Tavern',
};
```

### World.ts Refactoring Pattern (Agent Routing)
```typescript
// BEFORE: Agent routing through compound system
const compoundEntry = this.compounds.get(session.projectName);
if (compoundEntry && !compoundEntry.removing) {
  const entrance = this.getGlobalCompoundEntrance(compoundEntry);
  const subLoc = this.getGlobalSubLocation(compoundEntry, session.activityType);
  agent.assignToCompound(entrance, subLoc);
}

// AFTER: Agent routing through static buildings
const building = this.questZones.get(session.activityType);
if (building && session.activityType !== 'idle') {
  const entrance = {
    x: building.x + building.getEntrancePosition().x,
    y: building.y + building.getEntrancePosition().y,
  };
  const workPos = {
    x: building.x + building.getWorkPosition().x,
    y: building.y + building.getWorkPosition().y,
  };
  agent.assignToCompound(entrance, workPos); // method name can be updated in Phase 6
}
```

## State of the Art

| Old Approach (v1.0/current) | New Approach (Phase 5) | When Changed | Impact |
|-----------------------------|------------------------|--------------|--------|
| Code-drawn Graphics HQ (pentagon + windows + door) | Sprite from atlas `guild_hall` frame | This phase | Pixel art building matching RPG theme |
| Dynamic Compound containers per project | Static Building objects per activity type | This phase | Dramatically simpler world management |
| Radial layout for compound positioning | Fixed positions from `QUEST_ZONE_POSITIONS` | This phase | Predictable, stable layout |
| Compound lifecycle (fade-in/fade-out/reposition) | Buildings always visible, never created/destroyed | This phase | No visual popping, consistent world |
| Agent assigned to compound by project name | Agent routed to building by activity type | This phase | Multiple projects' agents share buildings |
| HQ separate from mission locations | Guild Hall is just another Building with special idle behavior | This phase | Unified Building class for all structures |

**Deprecated/removed in this phase:**
- `compound.ts`: Entire file removed (dynamic per-project compounds)
- `compound-layout.ts`: Entire file removed (radial positioning algorithm)
- `hq.ts`: Entire file removed (code-drawn HQ pentagon)
- `COMPOUND_*` constants: Removed from constants.ts
- CompoundEntry interface: Removed from world.ts

## Open Questions

1. **Building sprite size: 96x96 vs 128x128 for Guild Hall**
   - What we know: Quest zone buildings at 96x96 (3x3 tiles) fit comfortably at their positions. Guild Hall could be larger as the central focal point.
   - What's unclear: Whether a 128x128 Guild Hall looks proportionally right compared to 96x96 quest zones.
   - Recommendation: Start with 96x96 for all buildings (uniform size). If Guild Hall needs visual emphasis, increase to 128x128 after visual verification. The Building class handles either size via the Sprite texture dimensions.

2. **Building visual distinctiveness at pixel art scale**
   - What we know: 96x96 pixels gives reasonable detail for fantasy buildings. Each building needs a unique silhouette and color palette to be distinguishable at a glance.
   - What's unclear: Exact pixel art designs. The generate-buildings.js script needs careful visual design per building.
   - Recommendation: Use distinct silhouettes (tall/narrow for tower, wide/low for training grounds, symmetric/columned for library, cozy/chimney for tavern) and distinct color palettes (blue/purple for wizard, brown/red for training, gray/gold for library, warm orange for tavern). Visual verification is essential.

3. **Agent "working at" positioning for shared buildings**
   - What we know: Under the compound model, each project had its own compound with sub-locations. Now multiple agents from different projects may work at the same quest zone building.
   - What's unclear: How to position multiple agents at the same building without overlap.
   - Recommendation: Building.getWorkPosition() should accept an index parameter (like getIdlePosition) to fan agents out. Or use a simple offset: agents fan out horizontally near the building, similar to how idle agents fan out at the Guild Hall.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files in `src/renderer/`, `src/shared/`, `scripts/`, `assets/sprites/`
- Phase 4 RESEARCH.md, SUMMARY-01.md, SUMMARY-02.md -- documented asset pipeline patterns, tileTextures approach, CopyWebpackPlugin config, @pixi/tilemap removal rationale
- PixiJS 8 Textures guide (https://pixijs.com/8.x/guides/components/textures) -- Sprite from spritesheet pattern: `new Sprite(sheet.textures['frame_name'])`
- Existing working code: `asset-loader.ts` pattern for loading spritesheet and populating texture map
- Existing working code: `generate-tiles.js` pattern for pngjs atlas generation

### Secondary (MEDIUM confidence)
- Kenney.nl RPG packs (https://kenney.nl/assets/roguelike-rpg-pack, https://kenney.nl/assets/rpg-urban-pack) -- confirmed CC0 but 16x16 tiles, not suitable for direct use. Visual style reference only.
- OpenGameArt CC0 collections (https://opengameart.org/content/cc0-resources) -- various 32x32 RPG tilesets exist but visual consistency with existing tile style uncertain
- STATE.md blocker note: "Building sprite availability: All four quest zone building types may not exist in visually compatible CC0 packs."

### Tertiary (LOW confidence)
- Building pixel art designs at 96x96 -- specific pixel placements are design decisions that need visual iteration and approval. The code patterns are HIGH confidence but the visual output is subjective.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies. Extends existing atlas pipeline pattern proven in Phase 4.
- Architecture: HIGH - Compound-to-building replacement is well-understood from codebase analysis. All touch points identified. State machine routing changes are mechanical.
- Asset pipeline: HIGH - Identical to existing tiles pipeline. Same tools, same patterns, same webpack config.
- Building visual design: MEDIUM - Programmatic pixel art at 96x96 needs iteration. Code patterns are solid but visual quality depends on design execution.
- Pitfalls: HIGH - All pitfalls identified from direct codebase analysis of compound/HQ/agent interaction patterns.

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable -- no library changes expected, purely project-internal refactoring)
