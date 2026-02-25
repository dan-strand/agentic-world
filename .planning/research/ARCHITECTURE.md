# Architecture Research

**Domain:** Fantasy RPG aesthetic overlay — integrating sprite sheets, tilemaps, and quest zone locations into an existing PixiJS/Electron visualizer
**Researched:** 2026-02-25
**Confidence:** HIGH

---

## Context: This Is an Overlay, Not a Rewrite

The v1.1 milestone adds a Fantasy RPG aesthetic to a fully working v1.0 system. The core architecture — Electron main process, IPC bridge, session detection, PixiJS game loop, Agent FSM — stays intact. The work is:

1. Replacing code-drawn Graphics primitives with sprite-sheet-driven visuals
2. Replacing the flat-color background with a tilemap
3. Replacing Compound boxes with themed quest zone buildings
4. Replacing HQ's Graphics-drawn building with a Guild Hall sprite
5. Replacing Fireworks with a level-up golden light column effect
6. Removing Vehicle entirely

Nothing in `src/main/`, `src/preload/`, or `src/shared/` needs to change. All changes are in `src/renderer/`.

---

## Current vs. Target Architecture

### Current Scene Hierarchy (v1.0)

```
app.stage
+-- backgroundContainer     (solid-color Graphics fill)
+-- roadsContainer          (Graphics polygons, radial spokes)
+-- hq                      (HQ extends Container -- Graphics-drawn building)
+-- compoundsContainer      (dynamic Compound children -- Graphics-drawn boxes)
+-- agentsContainer         (Agent children -- GraphicsContext frame-swapping)
```

### Target Scene Hierarchy (v1.1)

```
app.stage
+-- tilemapLayer            (CompositeTilemap -- grass tiles + dirt path network)
+-- buildingsLayer          (GuildHall + QuestZone sprites -- static Sprites)
+-- agentsLayer             (Agent children -- AnimatedSprite from LPC sheet)
+-- particlesLayer          (ParticleContainer -- level-up sparkles, ambient dust)
+-- uiLayer                 (speech bubbles, labels -- unchanged)
```

Key change: `roadsContainer` disappears (paths baked into tilemap). `compoundsContainer` becomes `buildingsLayer` with fixed quest zones, not dynamic project compounds.

---

## Component-by-Component: Replace vs. Extend

### Agent Class — EXTEND

The Agent class (`src/renderer/agent.ts`) keeps its entire FSM, movement system, status visuals (tint crossfade, breathing, shake), and celebration lifecycle. Only the visual rendering layer changes.

**What changes:**
- `bodyGfx: Graphics` + `accessoryGfx: Graphics` → `sprite: AnimatedSprite`
- `getBodyFrames()` / `getAccessoryContext()` → `Assets.load(spritesheet.json)` + `sheet.animations['walk_down']`
- `Vehicle` child removed entirely

**What stays the same:**
- `AgentState` 7-state FSM (except `driving_to_compound` / `driving_to_hq` states renamed to `walking_to_zone` / `walking_to_guild`)
- `moveToward()`, `hasArrived()`, tick movement math
- `applyStatusVisuals()`, tint crossfade, breathing, shake
- `startCelebration()` (replaces Fireworks with LevelUpEffect)
- All public API called by World: `assignToCompound`, `assignToHQ`, `updateActivity`, `setHQPosition`, `getState`

**Migration path:**
```typescript
// Before (v1.0)
private bodyGfx: Graphics;
private accessoryGfx: Graphics;
// context swap in animateFrames():
this.bodyGfx.context = this.currentBodyFrames[this.frameIndex];

// After (v1.1)
private sprite: AnimatedSprite;
// AnimatedSprite handles its own frame timing internally:
this.sprite.textures = sheet.animations['walk_down'];
this.sprite.play();
```

### AgentSprites Module — REPLACE

`src/renderer/agent-sprites.ts` is entirely replaced. The 104 hand-coded `GraphicsContext` objects go away.

**Replacement:** `src/renderer/sprite-loader.ts`

This module:
1. Loads the LPC-format spritesheet PNG + JSON atlas via `Assets.load()`
2. Extracts per-direction, per-state texture arrays
3. Returns `AnimatedSprite`-ready texture arrays keyed by `(colorIndex, state, direction)`

LPC spritesheet layout (standard format, verified against Universal LPC repository):
- Each row = one direction (down/left/right/up)
- Walk cycle: 9 frames per row (use frames 1-8, skip frame 0 which is "stand")
- Typically: row 0=spellcast, row 1=thrust, row 2=walk, row 3=slash, row 4=shoot, row 5=hurt
- Frame size: 64x64 (LPC standard), scaled down to ~32x32 at render time via `scale.set(0.5)`

For v1.1, we only need: **walk** (4 directions, 8 frames each) + **idle** (1 frame, stand still) + **working** (spellcast, 7 frames for casting animation).

Since the LPC sheet doesn't have explicit "working" — use the spellcast row for the coding/casting visual. For idle, use frame 0 of the walk row (standing pose).

### Compound Class — REPLACE

`src/renderer/compound.ts` is entirely replaced. The 4 project compounds (dynamic, spawning/despawning per project) become 4 **fixed** quest zone locations.

**Replacement:** `src/renderer/quest-zone.ts`

Quest zones are fixed at startup, not dynamically created. Their positions are computed once based on the 1024x768 fixed window, not recalculated as sessions change.

The 4 zones map directly to ActivityType:
```
coding   → Wizard Tower     (top-left quadrant)
testing  → Training Grounds (top-right quadrant)
reading  → Ancient Library  (bottom-left quadrant)
comms    → Tavern           (bottom-right quadrant)
```

QuestZone class responsibilities:
- Render building sprite (Sprite, not Graphics)
- Provide `getEntrancePosition()` and `getSubLocationPosition(activity)` — same API as Compound
- Optionally show "active" visual indicator when an agent is present

**What disappears from World.ts:**
- `manageCompounds()` method entirely
- `CompoundEntry` interface and `compounds: Map<string, CompoundEntry>`
- `recalculateCompoundPositions()` — positions are fixed
- Compound fade-in/fade-out lifecycle

**What replaces it in World.ts:**
```typescript
// Fixed quest zones, created once at init
private questZones: Map<ActivityType, QuestZone> = new Map();

private initQuestZones(): void {
  const W = 1024, H = 768;
  this.questZones.set('coding',  new QuestZone('coding',  W * 0.25, H * 0.30));
  this.questZones.set('testing', new QuestZone('testing', W * 0.75, H * 0.30));
  this.questZones.set('reading', new QuestZone('reading', W * 0.25, H * 0.70));
  this.questZones.set('comms',   new QuestZone('comms',   W * 0.75, H * 0.70));
}
```

Agent routing becomes: find the QuestZone by `session.activityType`, get its position. No dynamic compound lifecycle needed.

### HQ Class — REPLACE

`src/renderer/hq.ts` is replaced with `src/renderer/guild-hall.ts`.

The Graphics-drawn spy HQ becomes a Guild Hall building sprite. Same public API:
- `getIdlePosition(index, totalIdle)` — positions adventurers in front of the guild entrance
- Same anchor point (bottom-center at origin)

The `getIdlePosition()` logic stays identical — just fan agents out in front of the door.

### World Class — SIGNIFICANT EXTENSION

`src/renderer/world.ts` keeps its core session management, status debouncing, and agent lifecycle logic. Key changes:

1. Replace `drawGround()` with `initTilemap()` — `CompositeTilemap` instead of `Graphics.rect()`
2. Replace `drawRoads()` with road tiles baked into tilemap at init
3. Replace `manageCompounds()` with `routeAgentToQuestZone()` using fixed zones
4. Add `particlesLayer` for level-up effects
5. Fixed 1024x768 window — remove `resize()` method entirely (or make it a no-op)

The `agentCompoundAssignment` tracking changes from project name to quest zone ActivityType:
```typescript
// Before
private agentCompoundAssignment: Map<string, string> = new Map(); // sessionId -> projectName

// After
private agentZoneAssignment: Map<string, ActivityType> = new Map(); // sessionId -> activityType
```

### Vehicle Class — DELETE

`src/renderer/vehicle.ts` is deleted. All references in `agent.ts` are removed.

State names that referenced driving are renamed:
- `driving_to_compound` → `walking_to_zone`
- `driving_to_hq` → `walking_to_guild`
- `AGENT_DRIVE_SPEED` constant removed; agents walk everywhere (slightly faster than current walk speed)

### Fireworks Class — REPLACE

`src/renderer/fireworks.ts` is replaced with `src/renderer/level-up-effect.ts`.

The multi-colored spark explosion becomes a golden light column rising from the agent, with golden sparkles falling outward.

Implementation uses `ParticleContainer` (v8 API) for performance:
```typescript
// Level-up effect: golden column + sparkle shower
class LevelUpEffect extends Container {
  private particles: ParticleContainer;
  // Golden column: several large bright particles rising upward
  // Sparkles: small particles with randomized velocities outward + up
  // Duration: same 2500ms as current fireworks
}
```

The Agent class swaps `fireworks: Fireworks` for `levelUp: LevelUpEffect`. Same lifecycle: created in `startCelebration()`, ticked in `tick()`, destroyed when done.

---

## New Components: Tilemap System

### Tilemap Strategy

Use `@pixi/tilemap` v5.x (compatible with PixiJS v8, released July 2025).

The tilemap is **static** — generated once at startup, never modified during runtime. The 1024x768 fixed window maps to a grid of 32x32 tiles (32 columns × 24 rows = 768 cells).

**Tile categories:**
- **Grass** — base ground tile filling most of the map
- **Dirt path** — connects Guild Hall to each Quest Zone (pre-computed at layout time)
- **Border/edge** — optional decorative edge tiles
- **Variation** — randomly seeded grass variants (lighter/darker patches) for visual texture

**Path computation:** A* or Bresenham's line algorithm from Guild Hall center to each zone entrance, snapping to the 32x32 tile grid. Computed once at `World.init()`.

```typescript
// src/renderer/tilemap-builder.ts
import { CompositeTilemap } from '@pixi/tilemap';

export function buildWorldTilemap(
  guildHallPos: { x: number; y: number },
  questZonePositions: Array<{ x: number; y: number }>,
  seed: number = 42,
): CompositeTilemap {
  const tilemap = new CompositeTilemap();

  // 1. Fill all cells with grass (randomized variants)
  for (let col = 0; col < 32; col++) {
    for (let row = 0; row < 24; row++) {
      const variant = seededRandom(seed, col, row) < 0.15 ? 'grass_2' : 'grass_1';
      tilemap.tile(variant, col * 32, row * 32);
    }
  }

  // 2. Draw dirt path from guild hall to each quest zone
  for (const zonePos of questZonePositions) {
    const pathCells = bresenhamPath(guildHallPos, zonePos, 32);
    for (const cell of pathCells) {
      tilemap.tile('dirt_path', cell.col * 32, cell.row * 32);
    }
  }

  return tilemap;
}
```

### Asset Loading Pattern

All sprite assets load in a single `Assets.load()` bundle before the game starts. This replaces the synchronous `initAgentSprites()` call pattern.

```typescript
// src/renderer/asset-loader.ts
export async function loadAllAssets(): Promise<void> {
  await Assets.load([
    { alias: 'characters', src: 'assets/sprites/characters.json' },
    { alias: 'buildings',  src: 'assets/sprites/buildings.json'  },
    { alias: 'tiles',      src: 'assets/sprites/tiles.json'      },
    { alias: 'particles',  src: 'assets/sprites/particles.json'  },
  ]);
}
```

The `index.ts` renderer entry point becomes:
```typescript
async function main() {
  await loadAllAssets();         // load all sprite sheets
  const world = new World();
  await world.init(document.body);
  startGameLoop(world);
}
```

---

## File Structure Changes

### Files to DELETE

```
src/renderer/vehicle.ts          — Vehicle system removed
src/renderer/fireworks.ts        — Replaced by level-up-effect.ts
src/renderer/agent-sprites.ts    — Replaced by sprite-loader.ts
src/renderer/compound.ts         — Replaced by quest-zone.ts
src/renderer/hq.ts               — Replaced by guild-hall.ts
```

### Files to CREATE

```
src/renderer/
+-- sprite-loader.ts             — Assets.load wrapper + texture extraction
+-- quest-zone.ts                — Fixed themed location (replaces compound.ts)
+-- guild-hall.ts                — Central building sprite (replaces hq.ts)
+-- tilemap-builder.ts           — CompositeTilemap generation
+-- level-up-effect.ts           — Golden column + sparkle ParticleContainer
+-- asset-loader.ts              — Centralized Assets.load bundle

assets/
+-- sprites/
|   +-- characters.json          — LPC spritesheet atlas (walk/idle/work frames)
|   +-- characters.png           — LPC spritesheet texture
|   +-- buildings.json           — Quest zone + guild hall atlas
|   +-- buildings.png            — Building textures
|   +-- tiles.json               — Tile atlas (grass variants, dirt path)
|   +-- tiles.png                — Tileset texture
|   +-- particles.json           — Sparkle/dust particle atlas
|   +-- particles.png            — Particle texture
```

### Files to SIGNIFICANTLY MODIFY

```
src/renderer/agent.ts
  - Remove: Vehicle import, bodyGfx, accessoryGfx, driving states
  - Add: AnimatedSprite, sprite-loader usage, walking_to_zone/walking_to_guild states
  - Keep: Full FSM logic, movement system, status visuals

src/renderer/world.ts
  - Remove: drawGround, drawRoads, manageCompounds, recalculateCompoundPositions
  - Remove: CompoundEntry interface, compounds Map, lastProjectSet
  - Add: initTilemap, initQuestZones, routeAgentToQuestZone
  - Add: particlesLayer Container
  - Keep: manageAgents, status debouncing, completion detection, IPC session handling

src/shared/constants.ts
  - Remove: VEHICLE_TYPES, ACCESSORIES (spy accessories)
  - Remove: COMPOUND_INNER_RADIUS, COMPOUND_OUTER_RADIUS, COMPOUND_WIDTH/HEIGHT
  - Add: QUEST_ZONE_POSITIONS (fixed coordinates), GUILD_HALL_POSITION
  - Add: TILE_SIZE = 32, WORLD_WIDTH = 1024, WORLD_HEIGHT = 768
  - Add: LEVEL_UP_DURATION_MS, LEVEL_UP_PARTICLE_COUNT
  - Modify: AGENT_WALK_SPEED (one speed only, no drive speed)
  - Modify: AGENT_COLORS stays (8 adventurer colors), but ACCESSORIES changes to RPG items

src/shared/types.ts
  - Remove: VehicleType, AccessoryType (spy accessories)
  - Add: CharacterClass type ('warrior' | 'mage' | 'ranger' | 'rogue' | ...)
  - Modify: AgentSlot — remove vehicleType, change accessory to characterClass
```

### Files UNCHANGED

```
src/main/               — All unchanged (session detection, IPC)
src/preload/            — Unchanged (IPC bridge)
src/shared/types.ts     — Partial: SessionInfo, SessionStatus, ActivityType, IPC channels unchanged
src/renderer/game-loop.ts     — Unchanged
src/renderer/speech-bubble.ts — Unchanged
src/renderer/bitmap-font.ts   — Unchanged (or update for RPG aesthetic)
src/renderer/compound-layout.ts — DELETE (replaced by fixed positions)
src/renderer/agent-factory.ts — Keep (djb2 hash for slot assignment, just different slot properties)
```

---

## Data Flow Changes

### Session → Visual Routing (v1.0 vs v1.1)

**v1.0 flow:**
```
SessionInfo.activityType
  → find compound by session.projectName (dynamic, may not exist)
  → compound.getSubLocationPosition(activityType)
  → agent.assignToCompound(entrance, subLoc)
```

**v1.1 flow:**
```
SessionInfo.activityType
  → find quest zone by activityType (always exists, fixed position)
  → questZone.getSubLocationPosition()
  → agent.assignToZone(entrance, subLoc)
```

This simplification removes the "does a compound exist for this project?" question. Every activity type always has a corresponding quest zone. An agent working on `coding` always goes to the Wizard Tower, regardless of which project it belongs to.

### Agent Compound Assignment Logic Change

In v1.0, multiple agents from the same project share one compound. In v1.1, multiple agents doing the same activity type share one quest zone (natural clustering by activity, not project).

```typescript
// v1.1 World.ts routing logic
private routeAgent(agent: Agent, session: SessionInfo): void {
  if (session.activityType === 'idle') {
    // Send to Guild Hall
    const idlePos = this.getGlobalGuildIdlePosition(session.sessionId);
    agent.assignToHQ(idlePos);
    return;
  }

  const zone = this.questZones.get(session.activityType);
  if (!zone) return; // should never happen

  const entrance = zone.getEntrancePosition(); // already global coords (zone is positioned globally)
  const subLoc = zone.getSubLocationPosition();
  agent.assignToZone(entrance, subLoc);
  this.agentZoneAssignment.set(session.sessionId, session.activityType);
}
```

---

## Architectural Patterns for RPG Features

### Pattern 1: Sprite Sheet with Manual Atlas JSON

**What:** Rather than using a third-party packer, define the atlas JSON manually for the LPC character sheet. The LPC sheet has a predictable grid layout, so frame coordinates are computable.

**When to use:** For the character sprite sheet where we know the exact grid dimensions (64x64 per frame, predictable row/column layout).

**Trade-offs:** Manual atlas JSON requires updating when the sheet changes, but gives precise control over which frames are named what. Alternative: compute `Texture` objects directly from the base texture using `new Texture({ source, frame: new Rectangle(x, y, w, h) })`.

**Example:**
```typescript
// src/renderer/sprite-loader.ts

// LPC walk animation: row 2, 9 columns, 64x64 per frame
// Directions: down=row2, left=row3, right=row4, up=row5
const WALK_ROW = 2;
const FRAME_W = 64;
const FRAME_H = 64;

export function extractWalkFrames(
  baseTexture: Texture,
  direction: 'down' | 'left' | 'right' | 'up',
): Texture[] {
  const directionOffset = { down: 0, left: 1, right: 2, up: 3 };
  const row = WALK_ROW + directionOffset[direction];
  const frames: Texture[] = [];

  for (let col = 1; col <= 8; col++) { // skip col 0 (stand pose)
    frames.push(new Texture({
      source: baseTexture.source,
      frame: new Rectangle(col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H),
    }));
  }
  return frames;
}
```

### Pattern 2: Static Tilemap Generated at Init

**What:** Build the `CompositeTilemap` once during `World.init()`, never modify it at runtime. The tilemap is purely decorative background — it does not track game state.

**When to use:** For the ground layer. Paths to quest zones are fixed because quest zone positions are fixed.

**Trade-offs:** Static generation means no dynamic path updates when sessions change. In v1.1 this is fine since quest zones don't move. If future milestones needed dynamic maps, this would need revisiting.

**Example:**
```typescript
// In World.init():
this.tilemap = buildWorldTilemap(guildHallPos, questZonePositions);
this.tilemapLayer.addChild(this.tilemap);
// Never touch this.tilemap again after init
```

### Pattern 3: ParticleContainer for Level-Up Effect

**What:** Use `ParticleContainer` with `position: true, color: true` as dynamic properties for the golden sparkle shower. Particles are pre-allocated and recycled.

**When to use:** For the level-up celebration effect. Not for general particle use — the Fireworks class used individual `Graphics` objects which worked fine for ~30 sparks. `ParticleContainer` is overkill for 30 particles but good practice if we want to add ambient particle effects (floating dust, fireflies) later.

**Trade-offs:** `ParticleContainer` requires particles to share a single texture. Pre-create a small circular dot texture once. All sparkle particles use the same dot, with different tint colors.

**Example:**
```typescript
// src/renderer/level-up-effect.ts
class LevelUpEffect extends Container {
  private particles: ParticleContainer;

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);

    this.particles = new ParticleContainer({
      dynamicProperties: { position: true, color: true, scale: true },
    });
    this.addChild(this.particles);

    // Column: 10 large golden particles rising upward
    for (let i = 0; i < 10; i++) {
      const p = new Particle({
        texture: Texture.from('particle_dot'),
        tint: 0xffd700,
        scaleX: 1.5, scaleY: 3,
      });
      // ... set velocities upward
      this.particles.addParticle(p);
    }

    // Sparkles: 20 small particles outward in arc
    for (let i = 0; i < 20; i++) {
      const p = new Particle({
        texture: Texture.from('particle_dot'),
        tint: 0xffee88,
      });
      // ... set random outward velocities with upward bias
      this.particles.addParticle(p);
    }
  }
}
```

### Pattern 4: Fixed-Layout Quest Zones vs. Dynamic Compounds

**What:** Quest zones are instantiated once at startup with positions derived from the fixed 1024x768 window size. No dynamic repositioning as sessions change.

**When to use:** This milestone. The dynamic layout system from v1.0 (radial compounds, `calculateCompoundPositions()`) is removed because quest zones are permanent map features, not per-project spaces.

**Trade-offs:** Loses the "projects get their own space" metaphor in exchange for "activities have dedicated zones" metaphor. This is the desired theme change. The 4 zones correspond to the 4 activity types, which is cleaner than N compounds for N projects.

---

## Build Order (v1.1 Milestone)

This order respects dependencies and allows testing at each step with a runnable app.

### Phase 1: Asset Pipeline

**Goal:** Get sprite assets loading correctly before touching any game logic.

1. Source or generate LPC character sprite sheet (characters.png + characters.json)
2. Source or create building sprites for 4 quest zones + guild hall (buildings.png + buildings.json)
3. Create tile set (tiles.png + tiles.json) — grass variants, dirt path tile
4. Create `src/renderer/asset-loader.ts` — loads all sheets via `Assets.load()`
5. Test: add asset loading to `index.ts`, verify all assets load without errors in Electron DevTools

**Why first:** Everything else depends on assets being available. Discovering that a sprite sheet has the wrong format or that LPC frames are offset incorrectly is cheapest to fix here.

### Phase 2: Tilemap Ground

**Goal:** Replace solid-color background with grass tilemap + dirt path stubs.

1. Create `src/renderer/tilemap-builder.ts`
2. Install `@pixi/tilemap` v5.x
3. In `World.init()`, replace `drawGround()` + `drawRoads()` with `buildWorldTilemap()`
4. Temporarily use hardcoded guild hall + zone positions for path generation
5. Test: app shows grass tilemap with dirt paths to four quadrants

**Why second:** Background must exist before buildings are placed on top. Confirms tilemap library integration works before other rendering changes.

### Phase 3: Guild Hall + Quest Zone Buildings

**Goal:** Replace HQ and Compound Graphics with sprite-based buildings.

1. Create `src/renderer/guild-hall.ts` with building sprite + idle position logic
2. Create `src/renderer/quest-zone.ts` with 4 themed building sprites
3. Update `World.init()` to use `GuildHall` and `QuestZone` instead of `HQ` and dynamic compounds
4. Wire `initQuestZones()` with hardcoded positions (finalize in this step)
5. Test: app shows Guild Hall center + 4 quest zone buildings at correct positions

**Why third:** Buildings define the landmark positions that agents navigate to. Agents need destination coordinates before their movement can be tested.

### Phase 4: Agent Sprite Replacement

**Goal:** Replace GraphicsContext agents with AnimatedSprite from LPC sheet.

1. Create `src/renderer/sprite-loader.ts` — extracts walk/idle/work texture arrays
2. Modify `Agent` class:
   - Remove `bodyGfx`, `accessoryGfx`, vehicle imports
   - Add `sprite: AnimatedSprite`
   - Update `animateFrames()` to set `sprite.textures` and call `sprite.play()`
   - Update `setBodyFrames()` to swap `sprite.textures`
3. Remove `driving_to_compound` and `driving_to_hq` states (agents now walk everywhere)
4. Test: agents spawn at guild hall with walking animation, move to quest zones

**Why fourth:** Agent visual swap is independent of the tilemap and building changes. Can test with agents walking over existing ground before tilemap is complete if needed, but by this point tilemap exists.

### Phase 5: Remove Vehicle System

**Goal:** Clean up vehicle-related code after agent animation is confirmed working.

1. Delete `src/renderer/vehicle.ts`
2. Remove Vehicle import and usage from `agent.ts`
3. Rename states: `driving_to_compound` → `walking_to_zone`, `driving_to_hq` → `walking_to_guild`
4. Remove `AGENT_DRIVE_SPEED` from constants; adjust `AGENT_WALK_SPEED` to ~120px/s for travel segments
5. Update `AgentSlot` type: remove `vehicleType`, add `characterClass`
6. Test: full agent lifecycle (idle → zone → work → celebrate → guild) using walking only

**Why fifth:** Separate cleanup step after the positive test in Phase 4. Clean removal of dead code.

### Phase 6: Level-Up Effect

**Goal:** Replace Fireworks with golden light column celebration.

1. Create `src/renderer/level-up-effect.ts` using `ParticleContainer`
2. In `Agent.startCelebration()`, replace `Fireworks` instantiation with `LevelUpEffect`
3. Add `particlesLayer` to World scene hierarchy (above agents layer)
4. Test: trigger a celebration (can mock with a keyboard shortcut in dev) and verify golden effect

**Why sixth:** Celebration effect is self-contained and the last visual piece. The rest of the system is working by this point.

### Phase 7: World Simplification

**Goal:** Remove dynamic compound lifecycle from World.ts and replace with fixed zone routing.

1. Remove `manageCompounds()`, `recalculateCompoundPositions()`, `CompoundEntry`, `compounds` Map
2. Remove `drawRoads()` (already in tilemap from Phase 2, but remove the call)
3. Replace agent routing to use `agentZoneAssignment: Map<string, ActivityType>`
4. Remove `resize()` method (fixed 1024x768 window)
5. Verify all 7 agent states still work correctly
6. Test: session changes correctly route agents to appropriate quest zones

**Why seventh:** This is architectural cleanup enabled by the previous phases. Doing it earlier would require changing agent routing before the zones exist.

### Phase 8: Polish and Ambient Effects

**Goal:** Add ambient visual polish without changing architecture.

1. Add ambient particle effect (floating fireflies / magical dust) — small `ParticleContainer` on `particlesLayer`
2. Add quest zone "active" visual when an agent is present (glowing aura sprite)
3. Finalize lighting overlay if desired (`ColorMatrixFilter` on top-level container for slight warm/cool tone)
4. Verify fixed 1024x768 window settings in `src/main/index.ts`
5. Final test: full end-to-end with real Claude Code sessions

---

## Integration Points

### Internal Boundaries (v1.1)

| Boundary | Communication | Change from v1.0 |
|----------|---------------|------------------|
| World ↔ Agent | Direct method calls | `assignToCompound` renamed to `assignToZone`; Vehicle removed from call path |
| World ↔ QuestZone | Direct property access | New. `questZone.getEntrancePosition()` returns global coords (not local like Compound did) |
| World ↔ Tilemap | One-way init | New. Tilemap built once, no runtime interaction |
| Agent ↔ AnimatedSprite | Direct property assignment | New. `sprite.textures = frames; sprite.play()` replaces context swapping |
| Agent ↔ LevelUpEffect | Same pattern as Fireworks | Rename only |
| Main Process ↔ Renderer | IPC (unchanged) | No changes — session data format stays identical |

### External Libraries

| Library | Version | Role | Integration |
|---------|---------|------|-------------|
| `@pixi/tilemap` | v5.x | Tilemap rendering | `import { CompositeTilemap } from '@pixi/tilemap'` — add to `package.json` |
| PixiJS | v8.x (existing) | Renderer | `AnimatedSprite`, `ParticleContainer`, `Particle`, `Assets` — all in `pixi.js` core |
| Asset sources | — | LPC sprite sheets | Static files in `assets/` directory — no library needed |

### Constants Requiring Update

```typescript
// src/shared/constants.ts — key changes

// DELETE
VEHICLE_TYPES, ACCESSORIES (spy), COMPOUND_WIDTH/HEIGHT/INNER_RADIUS/OUTER_RADIUS
AGENT_DRIVE_SPEED, FIREWORK_* constants

// ADD
export const WORLD_WIDTH = 1024;
export const WORLD_HEIGHT = 768;
export const TILE_SIZE = 32;
export const QUEST_ZONE_POSITIONS: Record<ActivityType, { x: number; y: number }> = {
  coding:  { x: 256, y: 230 },   // Wizard Tower — top-left
  testing: { x: 768, y: 230 },   // Training Grounds — top-right
  reading: { x: 256, y: 538 },   // Ancient Library — bottom-left
  comms:   { x: 768, y: 538 },   // Tavern — bottom-right
};
export const GUILD_HALL_POSITION = { x: 512, y: 384 }; // center

// MODIFY
export const AGENT_WALK_SPEED = 120;     // px/s (was 100; slightly faster for longer paths)
export const CELEBRATION_DURATION_MS = 2500;  // unchanged
export const LEVEL_UP_PARTICLE_COUNT = 30;    // replaces FIREWORK_SPARK_COUNT
export const LEVEL_UP_COLORS = [0xffd700, 0xffee88, 0xffffff] as const; // gold palette
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Lazy-Loading Assets Per Agent

**What people do:** Load sprite sheet textures inside `Agent` constructor on first use.

**Why it's wrong:** Creates sequential loading waterfalls. Multiple agents spawning simultaneously each trigger their own `Assets.load()` call. PixiJS caches after the first, but the initial loading is sequential rather than parallel.

**Do this instead:** Load all assets in `asset-loader.ts` before the game starts. By the time any `Agent` or `QuestZone` is constructed, all textures are in the `Assets` cache and `Assets.get('characters')` is synchronous.

### Anti-Pattern 2: Re-implementing Compound Dynamic Layout for Quest Zones

**What people do:** Keep the `calculateCompoundPositions()` radial layout for quest zones "for flexibility."

**Why it's wrong:** Quest zones are themed map locations, not dynamically allocated project spaces. The Wizard Tower is always at the top-left. Adding dynamic positioning re-introduces complexity that the milestone specifically removes.

**Do this instead:** Hardcode zone positions in `constants.ts`. The fixed 1024x768 window makes these reliable and unchanging.

### Anti-Pattern 3: Extending AnimatedSprite with Children

**What people do:** Try to add speech bubbles or accessories as children of `AnimatedSprite`.

**Why it's wrong:** In PixiJS v8, `Sprite` and `AnimatedSprite` are leaf nodes — they cannot have children. This is a breaking change from v7.

**Do this instead:** The Agent class is a `Container`. Children of Agent are: the `AnimatedSprite` sprite, and separately a `SpeechBubble` (also added to Agent container). The container acts as the parent, not the AnimatedSprite.

```typescript
class Agent extends Container {
  private sprite: AnimatedSprite;   // leaf node — no children
  private bubble: SpeechBubble;     // sibling, not child of sprite

  constructor(...) {
    super();
    this.sprite = new AnimatedSprite([...]);
    this.bubble = new SpeechBubble();
    this.addChild(this.sprite);     // add both to the Container (Agent)
    this.addChild(this.bubble);     // not to the AnimatedSprite
  }
}
```

### Anti-Pattern 4: Using Graphics for Tiles Instead of Tilemap

**What people do:** Draw the grass background and paths using a single large `Graphics` object (many `rect()` calls).

**Why it's wrong:** This is what v1.0 does for the solid-color background, and it works for a single color fill. For a tilemap with texture variety (grass variants, dirt path), a `Graphics`-drawn grid re-uploads geometry every time. `CompositeTilemap` renders tiles as batched GPU draw calls using the tileset texture, which is dramatically more efficient for hundreds of tiles.

**Do this instead:** `@pixi/tilemap` with `CompositeTilemap.tile()` calls, built once at startup.

### Anti-Pattern 5: Keeping `driving_to_compound` State Name as Dead Code

**What people do:** Rename the state but leave old handling code commented out "just in case."

**Why it's wrong:** Dead code causes confusion about the state machine's actual behavior. The 7-state FSM is already well-documented; removing vehicle states produces a cleaner 6-state machine that's easier to reason about.

**Do this instead:** Hard delete all vehicle-related state handling. New state names:
- `walking_to_zone` (was `driving_to_compound`)
- `walking_to_guild` (was `driving_to_hq`)
- Agent always visible (no vehicle visibility toggle needed)

---

## Scaling Considerations

This app targets 2-10 simultaneous sessions. The v1.1 changes don't affect the scaling profile meaningfully.

| Concern | v1.0 | v1.1 Change |
|---------|------|-------------|
| Agent rendering | 104 GraphicsContext objects, shared | ~4 AnimatedSprites per agent (one per state), loaded once from sheet |
| Background rendering | 1 Graphics rect | ~768 tile calls, batched by CompositeTilemap into few draw calls |
| Compound rendering | Dynamic Graphics-drawn boxes | 4 static building Sprites |
| Celebration effect | ~30 individual Graphics sparks | ParticleContainer with 30 particles — similar cost |
| Memory | ~5 MB for GraphicsContext objects | ~8-12 MB for PNG sprite sheet textures (compressed on GPU) |

The tilemap adds a fixed overhead of one GPU texture upload at startup. After that it's a static background — zero per-frame work beyond the normal scene graph traversal.

---

## Sources

- [PixiJS v8 Migration Guide — Sprite children breaking change](https://pixijs.com/8.x/guides/migrations/v8) — HIGH confidence (official)
- [PixiJS Assets API — Assets.load for spritesheets](https://pixijs.com/8.x/guides/components/assets) — HIGH confidence (official)
- [PixiJS Textures Guide — sub-texture frame extraction](https://pixijs.com/8.x/guides/components/textures) — HIGH confidence (official)
- [PixiJS ParticleContainer Guide — v8 API](https://pixijs.com/8.x/guides/components/scene-objects/particle-container) — HIGH confidence (official)
- [@pixi/tilemap v5.x — PixiJS v8 compatible, released July 2025](https://github.com/pixijs-userland/tilemap) — HIGH confidence (GitHub, version confirmed)
- [PixiJS Performance Tips — Graphics vs Sprites](https://pixijs.com/8.x/guides/concepts/performance-tips) — HIGH confidence (official)
- [Universal LPC Spritesheet Character Generator — frame layout reference](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) — HIGH confidence (canonical LPC repository)
- [OpenGameArt — Fantasy RPG Sprite Kit (32x32) CC0](https://opengameart.org/content/fantasy-rpg-sprite-kit-32x32) — HIGH confidence (OpenGameArt listing)
- [OpenGameArt — LPC Medieval Fantasy Character Sprites](https://opengameart.org/content/lpc-medieval-fantasy-character-sprites) — HIGH confidence (OpenGameArt listing)
- Existing codebase analysis (`src/renderer/*.ts`) — direct read — HIGH confidence

---

*Architecture research for: Agent World v1.1 — Fantasy RPG aesthetic integration*
*Researched: 2026-02-25*
