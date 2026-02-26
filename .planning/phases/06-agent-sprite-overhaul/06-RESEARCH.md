# Phase 6: Agent Sprite Overhaul - Research

**Researched:** 2026-02-26
**Domain:** PixiJS 8 AnimatedSprite, sprite-sheet character animation, atlas generation
**Confidence:** HIGH

## Summary

Phase 6 replaces the code-drawn `GraphicsContext` frame-swapping agent system with proper `AnimatedSprite`-based 32x32 RPG character sprites, removes the vehicle system entirely, and simplifies the agent state machine to walk-only movement. The project already has a proven atlas-first pipeline (pngjs generation + JSON descriptor + `Assets.load()` + Spritesheet) used for tiles and buildings. This same pipeline extends naturally to character sprites with the addition of the `"animations"` field in the JSON descriptor, which PixiJS Spritesheet natively supports and AnimatedSprite consumes directly via `sheet.animations['name']`.

The core technical challenge is generating 4 distinct character class sprite sheets (mage, warrior, ranger, rogue) with 3 animation states each (idle, walk, work) at 4 frames per state -- totaling 48 individual 32x32 frames packed into a single atlas. The existing `pngjs`-based generation pattern from `scripts/generate-tiles.js` and `scripts/generate-buildings.js` provides the exact template. The agent state machine must be simplified from 7 states (with driving) to 5 states (walk-only), and the slot system must map agents to character classes instead of vehicle types and accessories.

**Primary recommendation:** Generate all character sprites programmatically via pngjs following the existing atlas pattern, use PixiJS `AnimatedSprite` with `autoUpdate: false` for manual tick control, and simplify the state machine by removing all driving/vehicle states while preserving the existing status tint/breathing/shake system which works identically on AnimatedSprite (inherits from Sprite which has tint).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| THEME-01 | Agents display as Fantasy RPG adventurer characters using 32x32 sprite sheet animations from CC0 public packs | Atlas generation via pngjs (proven pattern), AnimatedSprite from Spritesheet.animations, 4 character classes with distinct visual design |
| THEME-04 | Each agent has a distinct character class appearance (mage, warrior, ranger, rogue) based on slot assignment | CharacterClass type replacing VehicleType/AccessoryType, djb2 hash slot maps to class index, distinct silhouettes per class |
| AGENT-01 | Agents use AnimatedSprite with walk, idle, and working animation states replacing Graphics frame-swapping | AnimatedSprite constructor from Texture[], swap via `.textures = sheet.animations['name']` + `.play()`, autoUpdate:false for manual tick |
| AGENT-02 | Vehicle system is removed entirely -- agents walk/run between all locations | Remove Vehicle class, remove driving states, replace AGENT_DRIVE_SPEED with AGENT_WALK_SPEED for all movement, simplify state machine |
| AGENT-03 | Each agent starts on a randomized animation frame offset for natural, non-synchronized movement | `gotoAndPlay(randomFrame)` on AnimatedSprite creation, or set initial `currentFrame` to hash-derived offset |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | ^8.16.0 | AnimatedSprite, Spritesheet, Texture, Assets | Already installed; AnimatedSprite is the native PixiJS solution for sprite-sheet animation |
| pngjs | ^7.0.0 | Deterministic atlas PNG generation | Already installed as devDependency; proven pattern from tiles and buildings scripts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | No new dependencies required for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pngjs generation | CC0 sprite packs from OpenGameArt/itch.io | External assets require manual download, licensing verification, may not match art style; pngjs generation ensures consistency with existing buildings/tiles and full control |
| AnimatedSprite | Manual GraphicsContext frame-swapping (current) | Current system works but GraphicsContext is for code-drawn shapes, not texture-based sprites; AnimatedSprite is purpose-built for this |

**Installation:**
```bash
# No new packages needed -- pixi.js and pngjs already installed
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
  generate-characters.js     # NEW: pngjs character atlas generator (4 classes x 3 states x 4 frames)
assets/sprites/
  characters.json            # NEW: spritesheet descriptor with animations field
  characters.png             # NEW: generated character atlas
src/shared/
  constants.ts               # MODIFY: CharacterClass type, remove VehicleType refs, adjust speeds
  types.ts                   # MODIFY: Replace VehicleType/AccessoryType with CharacterClass
src/renderer/
  agent-sprites.ts           # REWRITE: Load from atlas, provide texture arrays per class+state
  agent.ts                   # REWRITE: AnimatedSprite instead of Graphics, simplified state machine
  agent-factory.ts           # MODIFY: Slot maps to CharacterClass instead of vehicle/accessory
  vehicle.ts                 # DELETE: Vehicle system entirely removed
  asset-loader.ts            # MODIFY: Add character atlas loading
```

### Pattern 1: AnimatedSprite from Spritesheet Animations
**What:** Define animation sequences in the JSON descriptor, load via Assets.load(), create AnimatedSprite from sheet.animations
**When to use:** Any time you need frame-based animation from a sprite atlas
**Example:**
```typescript
// JSON descriptor (characters.json) -- "animations" field maps names to frame arrays
{
  "frames": {
    "mage_idle_0": { "frame": { "x": 0, "y": 0, "w": 32, "h": 32 }, ... },
    "mage_idle_1": { "frame": { "x": 32, "y": 0, "w": 32, "h": 32 }, ... },
    "mage_idle_2": { "frame": { "x": 64, "y": 0, "w": 32, "h": 32 }, ... },
    "mage_idle_3": { "frame": { "x": 96, "y": 0, "w": 32, "h": 32 }, ... },
    "mage_walk_0": { "frame": { "x": 128, "y": 0, "w": 32, "h": 32 }, ... },
    // ... etc
  },
  "animations": {
    "mage_idle": ["mage_idle_0", "mage_idle_1", "mage_idle_2", "mage_idle_3"],
    "mage_walk": ["mage_walk_0", "mage_walk_1", "mage_walk_2", "mage_walk_3"],
    "mage_work": ["mage_work_0", "mage_work_1", "mage_work_2", "mage_work_3"],
    "warrior_idle": ["warrior_idle_0", ...],
    // ... 12 animations total (4 classes x 3 states)
  },
  "meta": { "image": "characters.png", "format": "RGBA8888", ... }
}

// Source: PixiJS official docs -- Spritesheet + AnimatedSprite
// In asset-loader.ts:
const charSheet = await Assets.load('../assets/sprites/characters.json');
// Store animations map for agent-sprites.ts to access
characterAnimations = charSheet.animations;

// In agent construction:
import { AnimatedSprite } from 'pixi.js';
const sprite = new AnimatedSprite(characterAnimations['mage_idle']);
sprite.animationSpeed = 0.15;  // ~5fps at 30fps ticker (0.15 * 30 = 4.5 frames/sec)
sprite.autoUpdate = false;     // Manual tick control via world.tick()
sprite.play();
```

### Pattern 2: Animation State Switching on AnimatedSprite
**What:** Change animation by reassigning textures array and calling play()
**When to use:** When agent transitions between idle/walk/work states
**Example:**
```typescript
// Source: PixiJS AnimatedSprite docs
// Switch from idle to walking:
private setAnimation(state: 'idle' | 'walk' | 'work'): void {
  const key = `${this.characterClass}_${state}`;
  const textures = getCharacterAnimation(this.characterClass, state);
  if (this.sprite.textures !== textures) {
    this.sprite.textures = textures;
    this.sprite.play();
  }
}
```

### Pattern 3: Staggered Frame Offsets for Natural Movement
**What:** Each agent starts on a different animation frame so they don't animate in lockstep
**When to use:** When creating new Agent instances
**Example:**
```typescript
// Use hash-derived offset for deterministic but varied start frames
const startFrame = hashSessionId(sessionId) % sprite.totalFrames;
sprite.gotoAndPlay(startFrame);
```

### Pattern 4: Manual Animation Update with autoUpdate:false
**What:** Disable AnimatedSprite's built-in ticker attachment, update manually in world tick
**When to use:** When you want frame-rate independent animation control tied to a custom game loop
**Example:**
```typescript
// In Agent constructor:
this.sprite = new AnimatedSprite(textures);
this.sprite.autoUpdate = false;  // Don't attach to shared ticker
this.sprite.play();

// In Agent.tick(deltaMs):
// AnimatedSprite.update() expects a Ticker-like object with deltaTime
// But since we control speed via animationSpeed, we can call update directly
// The internal update uses app.ticker -- with autoUpdate:false we call manually
this.sprite.update({ deltaTime: deltaMs / 16.667 } as any);
// Or simpler: manage frame timing manually like current system
```

### Pattern 5: Simplified State Machine (No Vehicles)
**What:** Remove driving states, agents walk everywhere at AGENT_WALK_SPEED
**When to use:** All agent movement between buildings
**Example:**
```typescript
// New state machine (5 states instead of 7):
type AgentState =
  | 'idle_at_hq'
  | 'walking_to_building'    // replaces driving_to_compound
  | 'walking_to_workspot'    // replaces walking_to_sublocation
  | 'working'
  | 'celebrating';
  // walking_to_entrance and driving_to_hq merged into walking_to_hq
  // Actually: idle_at_hq -> walking_to_building -> walking_to_workspot -> working
  //                                                                         |
  //           idle_at_hq <- walking_to_hq <----- celebrating ---------------+
```

### Anti-Patterns to Avoid
- **Creating AnimatedSprite with autoUpdate:true in a custom game loop:** Causes double-speed animation since both the shared ticker AND your manual tick will advance frames. Always set `autoUpdate: false` when calling update manually.
- **Using Texture.from() for individual character frames:** Violates the atlas-first pipeline rule. All textures must come from the spritesheet loaded via Assets.load().
- **Calling sprite.textures setter on every tick:** Only set textures when the animation state actually changes. The setter triggers internal reprocessing.
- **Destroying old GraphicsContext objects without cleanup:** When removing the old agent-sprites.ts system, ensure all GraphicsContext references are properly cleaned up to prevent memory leaks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sprite-sheet animation | Manual frame timer + texture swapping | `AnimatedSprite` | Handles frame timing, looping, speed control, events; battle-tested |
| Animation sequences from atlas | Manual frame coordinate math | Spritesheet `"animations"` field | PixiJS parses automatically, produces Texture[] for AnimatedSprite |
| Atlas PNG generation | Manual canvas rendering | `pngjs` (existing pattern) | Deterministic, reproducible, already proven in project |
| Frame rate independent animation | Custom deltaMs accumulator | AnimatedSprite.animationSpeed | Built-in speed control relative to ticker; handles edge cases |

**Key insight:** The project already solved the hard atlas pipeline problem in Phases 4-5. Phase 6 adds the `"animations"` field to that same pattern and switches from Graphics to AnimatedSprite -- both are straightforward extensions of existing, working infrastructure.

## Common Pitfalls

### Pitfall 1: AnimatedSprite Double-Update
**What goes wrong:** Animation plays at 2x speed because both shared ticker and manual update advance frames
**Why it happens:** AnimatedSprite defaults to `autoUpdate: true`, which attaches to `Ticker.shared`. If you also call `update()` in your game loop, frames advance twice per tick.
**How to avoid:** Set `autoUpdate: false` in constructor or immediately after creation. Since this project uses a custom game loop with manual `tick(deltaMs)`, all AnimatedSprites must opt out of the shared ticker.
**Warning signs:** Animations look too fast compared to movement speed.

### Pitfall 2: Tint on AnimatedSprite Works Differently Than Container.tint
**What goes wrong:** Status tint colors may look different on AnimatedSprite vs old Graphics-based agents
**Why it happens:** `Container.tint` (used by current Agent class) multiplies ALL children. `Sprite.tint` (inherited by AnimatedSprite) multiplies the sprite texture pixels directly. Since AnimatedSprite IS a Sprite, `this.tint` applies directly to the character texture -- which is the correct behavior.
**How to avoid:** The existing `Container.tint` approach on the Agent (which extends Container) will still work -- it tints all children including the AnimatedSprite child. But since the agent now has fewer children (no body+accessory+vehicle, just one AnimatedSprite), applying tint directly to the AnimatedSprite or to the parent Container will both work. Verify the visual result with all 4 status colors.
**Warning signs:** Colors look washed out or not distinct enough between status states.

### Pitfall 3: Animation Speed Mismatch with Walk Speed
**What goes wrong:** Agent's feet slide on the ground -- walk animation cycles faster or slower than actual movement speed
**Why it happens:** `animationSpeed` and `AGENT_WALK_SPEED` are set independently. A 4-frame walk cycle at 5fps means one full stride takes 800ms. If AGENT_WALK_SPEED moves the agent further than one "stride length" in 800ms, the feet will appear to slide.
**How to avoid:** Tune `animationSpeed` so the walk cycle period matches the visual stride distance at `AGENT_WALK_SPEED`. For pixel art at 32x32, one stride is roughly 16-20px. At 100px/s walk speed, one stride takes ~160-200ms, so target 4 frames in that time = ~20-25fps animation during walking. Use status animation speed multipliers on top.
**Warning signs:** Agent appears to ice-skate or moonwalk.

### Pitfall 4: Forgetting to Remove Vehicle System Completely
**What goes wrong:** Dead code remains, vehicle.ts is still imported somewhere, old state machine paths are still reachable
**Why it happens:** Vehicle system is woven into agent.ts (6 references), types.ts (VehicleType), constants.ts (VEHICLE_TYPES, AGENT_DRIVE_SPEED), and agent-factory.ts.
**How to avoid:** Track every file that imports from vehicle.ts or references VehicleType/VEHICLE_TYPES/AGENT_DRIVE_SPEED. Remove systematically: types.ts -> constants.ts -> agent-factory.ts -> agent.ts -> delete vehicle.ts. TypeScript compiler will catch dangling references.
**Warning signs:** TypeScript compilation errors about missing Vehicle import, or unused VehicleType in types.

### Pitfall 5: Atlas Layout Frame Coordinate Errors
**What goes wrong:** Character sprites display garbled or offset, showing parts of adjacent frames
**Why it happens:** The JSON descriptor frame coordinates don't match the actual pixel positions in the generated PNG. Off-by-one errors in the generation script.
**How to avoid:** Use systematic grid layout: 4 frames per row, 3 rows per class, 4 classes = 12 rows total. Each frame is 32x32. Total atlas: 128px wide (4 frames * 32px) by 384px tall (12 rows * 32px). Verify with deterministic coordinate generation: `x = frameIndex * 32`, `y = (classIndex * 3 + stateIndex) * 32`.
**Warning signs:** Characters show partial frames, wrong body parts, or bleed from adjacent frames.

### Pitfall 6: Staggered Offsets Applied After play()
**What goes wrong:** All agents still animate in lockstep because gotoAndPlay resets to frame 0 internally
**Why it happens:** Calling `play()` after `gotoAndPlay(n)` resets the frame. Order matters.
**How to avoid:** Call `gotoAndPlay(startFrame)` LAST, not `play()` then `gotoAndPlay()`. Or set `currentFrame` directly after play: `sprite.play(); sprite.currentFrame = offset;`
**Warning signs:** All agents of the same class have identical animation phase.

## Code Examples

Verified patterns from official sources and existing codebase:

### Character Atlas Generation Script (generate-characters.js)
```javascript
// Source: Existing pattern from scripts/generate-buildings.js
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

// Atlas layout: 4 frames wide, 12 rows (4 classes x 3 states)
const FRAME_SIZE = 32;
const FRAMES_PER_ROW = 4;
const CLASSES = ['mage', 'warrior', 'ranger', 'rogue'];
const STATES = ['idle', 'walk', 'work'];
const WIDTH = FRAME_SIZE * FRAMES_PER_ROW;  // 128
const HEIGHT = FRAME_SIZE * CLASSES.length * STATES.length;  // 384

const png = new PNG({ width: WIDTH, height: HEIGHT });
// ... draw each class+state+frame at deterministic coordinates
// Each frame at: x = frameIndex * 32, y = (classIndex * 3 + stateIndex) * 32
```

### JSON Descriptor with Animations (characters.json)
```json
{
  "frames": {
    "mage_idle_0": { "frame": { "x": 0, "y": 0, "w": 32, "h": 32 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 32 }, "sourceSize": { "w": 32, "h": 32 } },
    "mage_idle_1": { "frame": { "x": 32, "y": 0, "w": 32, "h": 32 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 32 }, "sourceSize": { "w": 32, "h": 32 } }
  },
  "animations": {
    "mage_idle": ["mage_idle_0", "mage_idle_1", "mage_idle_2", "mage_idle_3"],
    "mage_walk": ["mage_walk_0", "mage_walk_1", "mage_walk_2", "mage_walk_3"],
    "mage_work": ["mage_work_0", "mage_work_1", "mage_work_2", "mage_work_3"],
    "warrior_idle": ["warrior_idle_0", "warrior_idle_1", "warrior_idle_2", "warrior_idle_3"],
    "warrior_walk": ["warrior_walk_0", "warrior_walk_1", "warrior_walk_2", "warrior_walk_3"],
    "warrior_work": ["warrior_work_0", "warrior_work_1", "warrior_work_2", "warrior_work_3"],
    "ranger_idle": ["ranger_idle_0", "ranger_idle_1", "ranger_idle_2", "ranger_idle_3"],
    "ranger_walk": ["ranger_walk_0", "ranger_walk_1", "ranger_walk_2", "ranger_walk_3"],
    "ranger_work": ["ranger_work_0", "ranger_work_1", "ranger_work_2", "ranger_work_3"],
    "rogue_idle": ["rogue_idle_0", "rogue_idle_1", "rogue_idle_2", "rogue_idle_3"],
    "rogue_walk": ["rogue_walk_0", "rogue_walk_1", "rogue_walk_2", "rogue_walk_3"],
    "rogue_work": ["rogue_work_0", "rogue_work_1", "rogue_work_2", "rogue_work_3"]
  },
  "meta": {
    "app": "Agent World",
    "version": "1.0",
    "image": "characters.png",
    "format": "RGBA8888",
    "size": { "w": 128, "h": 384 },
    "scale": "1"
  }
}
```

### Asset Loader Extension
```typescript
// Source: Existing pattern from src/renderer/asset-loader.ts
import { Assets, Spritesheet, Texture } from 'pixi.js';

export const characterAnimations: Record<string, Texture[]> = {};

export async function loadAllAssets(): Promise<void> {
  const [tileSheet, buildingSheet, characterSheet] = await Promise.all([
    Assets.load('../assets/sprites/tiles.json') as Promise<Spritesheet>,
    Assets.load('../assets/sprites/buildings.json') as Promise<Spritesheet>,
    Assets.load('../assets/sprites/characters.json') as Promise<Spritesheet>,
  ]);

  // ... existing tile/building loading ...

  // Store character animation texture arrays for AnimatedSprite creation
  for (const [name, textures] of Object.entries(characterSheet.animations)) {
    characterAnimations[name] = textures;
  }
}
```

### Agent Class with AnimatedSprite
```typescript
// Source: PixiJS AnimatedSprite docs + existing Agent pattern
import { Container, AnimatedSprite } from 'pixi.js';
import { characterAnimations } from './asset-loader';

export class Agent extends Container {
  private sprite: AnimatedSprite;
  private characterClass: CharacterClass;

  constructor(sessionId: string, slot: AgentSlot) {
    super();
    this.characterClass = slot.characterClass;

    // Create AnimatedSprite from idle animation
    const idleTextures = characterAnimations[`${this.characterClass}_idle`];
    this.sprite = new AnimatedSprite(idleTextures);
    this.sprite.anchor.set(0.5, 1.0);  // Bottom-center for ground placement
    this.sprite.autoUpdate = false;     // Manual tick control
    this.sprite.animationSpeed = 0.15;  // Base animation speed
    this.sprite.loop = true;

    // Staggered frame offset (AGENT-03)
    const startFrame = hashSessionId(sessionId) % this.sprite.totalFrames;
    this.sprite.gotoAndPlay(startFrame);

    this.addChild(this.sprite);
  }

  tick(deltaMs: number): void {
    // Update AnimatedSprite manually (since autoUpdate is false)
    // AnimatedSprite.update expects deltaTime in ticker units (1 = one frame at 60fps)
    const deltaFrames = deltaMs / 16.667;  // Convert ms to 60fps frame units
    this.sprite.update({ deltaTime: deltaFrames } as any);

    // Status effects + state machine (preserved from current implementation)
    this.updateTint(deltaMs);
    this.updateBreathing(deltaMs);
    this.updateShake(deltaMs);

    // State machine logic...
  }
}
```

### Character Class Visual Design Guidelines
```
Each class should have a visually distinct silhouette at 32x32:

MAGE:     Pointed hat (tall peak), flowing robe, staff in hand
          Colors: purple/blue robe, gold trim, glowing staff tip
          Walk: robe swings, staff bobs
          Work: staff raised, casting gesture

WARRIOR:  Helmet with visor, plate armor, sword/shield
          Colors: silver/gray armor, red plume, gold shield
          Walk: heavy stride, shield sway
          Work: sword practice, defensive stance

RANGER:   Hood/cowl, cloak, bow slung over shoulder
          Colors: green/brown cloak, leather gear, quiver arrows
          Walk: light stride, cloak flutter
          Work: bow drawn, scouting pose

ROGUE:    Bandana/mask, light leather, daggers at belt
          Colors: dark gray/black outfit, glint of blade, belt pouches
          Walk: sneaky crouch-walk, light on feet
          Work: lockpicking, examining gesture
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GraphicsContext frame-swapping | AnimatedSprite from Spritesheet | PixiJS 8 (current) | AnimatedSprite is the intended API; GraphicsContext was a creative workaround for code-drawn agents |
| Code-drawn shapes (Graphics primitives) | Texture-based sprites from atlas | This phase | Enables proper pixel art characters; aligns with building/tile asset pipeline |
| Vehicle system for fast travel | Walk-only movement | This phase | Simpler state machine; fits RPG fantasy theme |

**Deprecated/outdated:**
- `Graphics.context` swapping: Not deprecated in PixiJS 8, but it's a low-level approach meant for programmatic drawing. AnimatedSprite is the standard for texture-based animation.
- `VehicleType` / vehicle system: Removed in this phase per AGENT-02 requirement.

## Open Questions

1. **AnimatedSprite.update() parameter format in PixiJS 8**
   - What we know: AnimatedSprite.update() expects a Ticker or ticker-like object. The `autoUpdate: false` approach requires manual calls.
   - What's unclear: The exact parameter signature in v8. Some docs show `update(ticker)` where ticker has `deltaTime`. The project uses deltaMs from its own game loop.
   - Recommendation: Test with `sprite.update({ deltaTime: deltaMs / 16.667 })` to convert milliseconds to 60fps-relative frame units. If that doesn't work, fall back to manual frame management (set `currentFrame` directly based on timer, similar to current `animateFrames()` approach). The fallback is LOW risk since the current manual frame timer logic is proven. **Confidence: MEDIUM -- verify at implementation time.**

2. **Walk animation speed tuning**
   - What we know: AGENT_WALK_SPEED is 100px/s. 4-frame walk cycle. ANIMATION_FRAME_MS is 200ms (5fps).
   - What's unclear: Exact animationSpeed value to prevent foot sliding at different movement speeds. Status multipliers (0.5x for waiting, 0.25x for idle) also affect animation.
   - Recommendation: Start with `animationSpeed = 0.15` (about 4.5fps at 30fps ticker), tune visually. For walking states, temporarily increase to `0.25` (~7.5fps) to match faster leg movement. This is a visual polish concern, not a blocker.

3. **Whether compound.ts and compound-layout.ts are still used**
   - What we know: World.ts no longer uses Compound class (replaced by Building in Phase 5). compound-layout.ts has `calculateCompoundPositions` and `calculateRoadPath`.
   - What's unclear: Whether these files are imported anywhere or are already dead code from Phase 5.
   - Recommendation: Check imports during implementation. If dead code, delete both files as part of vehicle/spy-theme cleanup.

## Sources

### Primary (HIGH confidence)
- [PixiJS AnimatedSprite API docs (v8)](https://pixijs.download/dev/docs/scene.AnimatedSprite.html) - Constructor, properties, methods, autoUpdate
- [PixiJS Spritesheet API docs (v8)](https://pixijs.download/dev/docs/assets.Spritesheet.html) - animations field format, Texture[] from sheet.animations
- [PixiJS Sprite tint docs](https://pixijs.download/v8.14.3/docs/scene.Sprite.html) - tint property inheritance chain

### Secondary (MEDIUM confidence)
- [PixiJS Spritesheet guide (7.x)](https://pixijs.com/7.x/guides/components/sprite-sheets) - JSON descriptor format (same in v8)
- [PixiJS AnimatedSprite spritesheet discussion](https://github.com/pixijs/pixijs/discussions/9131) - Swapping textures pattern
- [OpenGameArt CC0 sprite resources](https://opengameart.org/content/cc0-walk-cycles) - Reference for walk cycle frame counts and patterns

### Tertiary (LOW confidence)
- AnimatedSprite.update() parameter format in v8 -- inferred from docs, needs implementation verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pixi.js AnimatedSprite and pngjs are already installed and proven in the project
- Architecture: HIGH - Extends existing atlas pipeline pattern; AnimatedSprite API is well-documented
- Pitfalls: HIGH - Identified from direct code analysis and PixiJS docs; autoUpdate gotcha is well-known
- Character generation: MEDIUM - pngjs pixel art drawing at 32x32 is proven (buildings are 96x96), but 4 distinct character classes will require careful visual design

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable -- PixiJS 8 API is mature, project deps pinned)
