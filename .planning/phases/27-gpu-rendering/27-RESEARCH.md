# Phase 27: GPU Rendering - Research

**Researched:** 2026-03-18
**Domain:** PixiJS 8 rendering pipeline -- ColorMatrixFilter removal, Container.tint, cacheAsTexture, threshold-gated updates
**Confidence:** HIGH

## Summary

Phase 27 replaces the stage-level `ColorMatrixFilter` with PixiJS 8's inherited `Container.tint` for the day/night color temperature system, adds threshold-gated updates to skip GPU writes during plateaus, caches static layers as single GPU textures, and gates night glow alpha updates on meaningful change.

The single most important finding from source code analysis: **all day/night tint values are already within the 0-1 range** (`NIGHT_TINT_B = 0.8`, not 1.1 as flagged in milestone research). This eliminates the primary visual regression risk -- Container.tint can represent every current tint value without clamping. The second critical finding from PixiJS 8 source code: **tint is always multiplicative through the parent chain** (`groupColor = multiplyColors(localColor, parent.groupColor)`), confirmed in `updateRenderGroupTransforms.mjs` line 93. This means agent status tints (0xFFAA44 amber, 0xFF4444 red) and building highlight tints (0xFFDD88) will be multiplied by the day/night tint, producing darker compound colors. The tint strategy must account for this: apply day/night tint to a `worldContainer` that contains background layers but excludes the agents container, OR accept compound multiplication and verify visual acceptability.

A third finding from the RenderGroupPipe source code (line 59): when `cacheAsTexture` renders to the cached texture, it uses `worldColor: 4294967295` (0xFFFFFFFF = white/untinted). Parent tint is then applied at compositing time via `worldColorAlpha`. This means cacheAsTexture on static layers (tilemap, scenery) will work correctly with the day/night tint system -- the cache stores untinted content, and the parent container's tint modulates it during compositing.

**Primary recommendation:** Introduce a `worldContainer` between `app.stage` and all child layers. Apply day/night tint to `worldContainer`. This tints all children (tilemap, buildings, scenery, night glow, particles, agents) uniformly. Agent status tints and building highlight tints multiply with the parent tint, which is physically correct behavior (everything looks color-shifted in warm day / cool night light). Accept compound tinting and verify visual acceptability at 5 cycle points via screenshot comparison.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GPU-01 | Stage-level ColorMatrixFilter replaced with Container.tint for day/night coloring (eliminates double render pass) | Container.tint is verified available on PixiJS 8.16.0; tint is multiplicative and inherited; all current tint values are within 0-1 range; filter removal eliminates the off-screen framebuffer pass |
| GPU-02 | Day/night tint and filter values only update when change exceeds perceptible threshold (~0.005) | Integer hex comparison (0x000000-0xFFFFFF) naturally gates on per-channel 1/255 change; at 30fps over 10-min cycle, ~50 tint changes per cycle vs ~18,000 frames = ~99.7% skip rate |
| GPU-03 | Static layers (scenery, building exteriors) use cacheAsTexture for single-draw rendering | cacheAsTexture confirmed to store untinted content and apply parent tint at compositing time; tilemap and scenery layers are fully static after init; antialias:false for pixel art |
| GPU-04 | Night glow alpha values only update when nightIntensity changes beyond threshold; unchanged ticks skip all 19+ glow object writes | Guard with cached lastNightIntensity and threshold comparison; also early-return when nightIntensity < threshold (all glows already at 0 during day) |
</phase_requirements>

## Standard Stack

### Core

No new packages. All work uses existing PixiJS 8.16.0 APIs.

| API | Version | Purpose | Why Standard |
|-----|---------|---------|--------------|
| `Container.tint` | PixiJS 8.0.0+ (installed: 8.16.0) | Day/night color temperature via multiplicative per-channel color | Eliminates filter render pass; inherited by children; zero GPU cost |
| `Container.cacheAsTexture()` | PixiJS 8.x (installed: 8.16.0) | Cache static layers as single GPU textures | Reduces draw calls from ~100+ to ~3 for static content |
| `Container.updateCacheTexture()` | PixiJS 8.x (installed: 8.16.0) | Force re-render of cached texture (if ever needed) | Paired API for cache invalidation |

### Supporting

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Hex integer tint comparison | Threshold-gated tint updates | Compare `newTintHex !== lastTintHex` to skip identical frames |
| `nightIntensity` delta check | Threshold-gated glow updates | Compare `Math.abs(current - last) >= 0.005` before updating glow alphas |
| `worldContainer` intermediate container | Isolate day/night tint from stage | Apply tint to worldContainer instead of app.stage |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Container.tint` on worldContainer | Keep `ColorMatrixFilter` with cached matrix | Filter ALWAYS forces off-screen render pass regardless of caching; tint eliminates the pass entirely |
| `cacheAsTexture()` | `@pixi/tilemap` | Incompatible with Electron Webpack (v1.1 decision); cacheAsTexture achieves the same result |
| Hex integer comparison for threshold | Float threshold (0.005) on nightIntensity | Hex comparison is simpler, naturally maps to per-channel 1/255 resolution, no float comparison issues |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Current Scene Hierarchy (Before)

```
app.stage [ColorMatrixFilter applied -- forces double render pass]
+-- tilemapLayer (Container > canvas Sprite)
+-- buildingsContainer (Container > campfire Sprite + 4 Building containers)
+-- sceneryLayer (Container > ~96 Sprites)
+-- nightGlowLayer (Container > ~19 Graphics circles)
+-- ambientParticles (AmbientParticles container)
+-- agentsContainer (Container > dynamic Agent children)
```

### Target Scene Hierarchy (After)

```
app.stage [no filter, no tint -- clean pass-through]
+-- worldContainer [Container.tint = day/night hex -- all children inherit]
    +-- tilemapLayer (cacheAsTexture -- single draw call)
    +-- buildingsContainer (campfire + 4 buildings)
    +-- sceneryLayer (cacheAsTexture -- single draw call)
    +-- nightGlowLayer (~19 glow Graphics -- NOT cached, updates per tick)
    +-- ambientParticles (floating particles)
    +-- agentsContainer (dynamic agents)
```

### Pattern 1: Intermediate World Container for Tint Isolation

**What:** Insert a `worldContainer` between `app.stage` and all current stage children. Apply the day/night tint to `worldContainer` instead of using a stage filter.

**When to use:** When you need a color temperature effect on the entire scene without a filter render pass.

**Why worldContainer instead of app.stage.tint:** Using `app.stage.tint` would also work, but a dedicated worldContainer provides a clean separation point. If future requirements need UI overlays or debug displays that should NOT be tinted, they can be added as direct children of `app.stage` alongside `worldContainer`.

**Example:**
```typescript
// In World.init():
// Replace:
//   this.stageFilter = new ColorMatrixFilter();
//   this.app.stage.filters = [this.stageFilter];
// With:
this.worldContainer = new Container();
this.app.stage.addChild(this.worldContainer);

// All existing addChild(this.app.stage, X) calls become:
this.worldContainer.addChild(this.tilemapLayer);
this.worldContainer.addChild(this.buildingsContainer);
this.worldContainer.addChild(this.sceneryLayer);
this.worldContainer.addChild(this.nightGlowLayer);
this.worldContainer.addChild(this.ambientParticles);
this.worldContainer.addChild(this.agentsContainer);
```
**Source:** PixiJS 8 Container docs, project source analysis

### Pattern 2: Threshold-Gated Tint Update via Hex Comparison

**What:** Convert `getTintRGB()` output to a hex integer. Compare with the last-applied hex value. Skip `worldContainer.tint` assignment when unchanged.

**When to use:** Every tick in `World.tick()`.

**Example:**
```typescript
// In DayNightCycle, add a method:
getTintHex(): number {
  const [r, g, b] = this.getTintRGB();
  return (Math.round(Math.min(r, 1) * 255) << 16)
       | (Math.round(Math.min(g, 1) * 255) << 8)
       | Math.round(Math.min(b, 1) * 255);
}

// In World.tick():
private lastTintHex = 0xFFFFFF;

const tintHex = this.dayNightCycle.getTintHex();
if (tintHex !== this.lastTintHex) {
  this.worldContainer.tint = tintHex;
  this.lastTintHex = tintHex;
}
```

At 30fps over a 10-minute (600,000ms) cycle, each RGB channel spans ~255 values. The hex value changes approximately once per `600,000 / (255 * 3) = ~784ms` on average, meaning ~50 actual tint updates per full cycle vs. ~18,000 tick calls. This is a **99.7% skip rate** during plateau frames.

**Source:** Standard dirty-flag optimization pattern

### Pattern 3: Night Glow Threshold Guard

**What:** Track the last `nightIntensity` value used for glow updates. Only re-calculate and re-assign glow alphas when the intensity changes by more than 0.005.

**When to use:** Every tick in the night glow update path.

**Example:**
```typescript
// In World:
private lastGlowIntensity = -1; // Force first update

// In World.tick():
const nightIntensity = this.dayNightCycle.getNightIntensity();

if (Math.abs(nightIntensity - this.lastGlowIntensity) >= 0.005) {
  updateNightGlowLayer(this.nightGlows, nightIntensity);
  this.lastGlowIntensity = nightIntensity;
}
```

**Source:** Standard dirty-flag optimization pattern

### Pattern 4: Static Layer Caching

**What:** Call `cacheAsTexture()` on the tilemap and scenery containers after they are fully built. These containers never change after init.

**When to use:** Once during `World.init()`, after all children are added to each container.

**Example:**
```typescript
// In World.init(), after all tilemap children are added:
this.tilemapLayer.cacheAsTexture({ antialias: false });

// After scenery layer is built:
this.sceneryLayer.cacheAsTexture({ antialias: false });
```

**Critical:** Do NOT cache `nightGlowLayer` (alpha changes every tick), `ambientParticles` (continuously animating), or `agentsContainer` (dynamic children). Do NOT cache `buildingsContainer` because building `tint` changes when agents arrive/depart (line 445 in world.ts).

**Source:** [PixiJS 8 cacheAsTexture guide](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture), verified via RenderGroupPipe.mjs source

### Anti-Patterns to Avoid

- **Applying tint to app.stage directly then later needing untinted overlays:** Use the worldContainer pattern instead for future flexibility.
- **Caching containers that have dynamic children or changing tints:** buildingsContainer tint changes per-frame based on agent activity -- do NOT cache it. nightGlowLayer alpha changes per-tick -- do NOT cache it.
- **Toggling cacheAsTexture on/off:** The re-caching cost is significant. Set it once and leave it.
- **Using float threshold for tint comparison:** Converting to hex integer and using `!==` is simpler, avoids float comparison issues, and naturally quantizes to perceptible (1/255 channel) resolution.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Day/night color temperature | Custom WebGL shader | `Container.tint` | Built-in, hardware-accelerated, zero render passes, inherited by children |
| Static layer optimization | Manual RenderTexture management | `Container.cacheAsTexture()` | Handles lifecycle, pool integration, resolution matching automatically |
| Tint color multiplication | Manual per-sprite tint application | Parent container tint inheritance | PixiJS 8 propagates tints multiplicatively through the scene graph |
| Threshold detection for updates | Complex float-based change detection | Integer hex comparison (`!==`) | Naturally maps to perceptible color resolution (1/255) |

## Common Pitfalls

### Pitfall 1: Compound Tint Multiplication Darkens Agent Status Colors

**What goes wrong:** Parent day/night tint multiplies with child agent status tints. At night (`tint ~0x6680CC`), an amber waiting agent (`0xFFAA44`) renders as `0x66 * 0xFF / 255 = 0x66` red, `0x80 * 0xAA / 255 = 0x55` green, `0xCC * 0x44 / 255 = 0x37` blue = `0x665537` (muddy dark brown). The agent status becomes nearly indistinguishable.

**Why it happens:** PixiJS 8 tints are always multiplicative through the parent chain (`groupColor = multiplyColors(localColor, parent.groupColor)` in updateRenderGroupTransforms.mjs line 93). There is no way to exempt a child from parent tint inheritance.

**How to avoid:** Two viable strategies:
1. **Accept compound tinting** -- physically correct ("everything under moonlight looks blue-shifted"). Verify that all 4 status tints (active=white, waiting=amber, idle=gray, error=red) remain visually distinguishable at all 5 cycle points. Building highlight (0xFFDD88) must also remain distinguishable at night.
2. **Compensate agent tints** -- mathematically divide out the parent tint: if parent tint channel is `p` and desired visual channel is `d`, set agent tint channel to `min(255, d / p * 255)`. This only works when the parent tint darkens (< 1.0), which is always true for this app. Requires recalculating agent tints whenever the day/night tint changes.

**Recommendation:** Strategy 1 (accept compound tinting). The current ColorMatrixFilter also shifts agent colors (it applies post-composite, tinting everything including agents). The shift will be slightly different with multiplicative tint vs. post-composite filter, but the user has been looking at tinted agents for all of v2.0. Take screenshots at 5 cycle points and compare.

**Warning signs:** Agent status colors look muddy or indistinguishable at night, especially waiting (amber) and error (red).

### Pitfall 2: Dirty Flag Threshold Too Large Causes Visible Color Stepping

**What goes wrong:** A threshold of 0.01 on nightIntensity produces visible color jumps during the 30-60 second dawn/dusk transition windows where the sine wave derivative peaks.

**Why it happens:** The pow(raw, 1.5) curve steepens transitions. At maximum derivative (~progress 0.25 and 0.75), intensity can change by 0.003 per frame at 30fps. A threshold of 0.01 means updates fire every 3-4 frames during transitions, causing visible stepping.

**How to avoid:** Use hex integer comparison for the tint update (inherently per-channel 1/255 resolution, no stepping visible). For the glow layer, use threshold 0.005 or smaller. The glow update is 19 alpha assignments -- cheap enough that even updating every 2 frames is fine.

### Pitfall 3: Caching Dynamic Containers

**What goes wrong:** If buildingsContainer is cached, building highlight tint changes (line 445: `building.tint = 0xFFDD88 / 0xFFFFFF`) are invisible because the cache is not refreshed.

**Why it happens:** cacheAsTexture freezes the container's visual state. Changes to child properties require `updateCacheTexture()` which defeats the purpose.

**How to avoid:** Only cache truly static containers: tilemapLayer (never changes after init) and sceneryLayer (never changes after init). Do NOT cache buildingsContainer, nightGlowLayer, ambientParticles, or agentsContainer.

### Pitfall 4: Screenshot Baseline Must Be Captured BEFORE Any Code Changes

**What goes wrong:** Without a visual baseline, there is no way to objectively compare the post-migration appearance against the original.

**Why it happens:** The ColorMatrixFilter and Container.tint produce mathematically different results (post-composite vs. per-child multiplicative). The difference may be subtle or significant depending on overlapping semi-transparent elements.

**How to avoid:** Before any code changes, capture 5 screenshots at cycle points: dawn (~progress 0.125), midday (~progress 0.0), dusk (~progress 0.375), peak night (~progress 0.5), late night (~progress 0.625). These serve as the visual regression baseline for success criteria #1.

## Code Examples

### Converting ColorMatrixFilter to Container.tint

```typescript
// BEFORE (world.ts line 252-253, 284-292):
import { ColorMatrixFilter } from 'pixi.js';

// In init():
this.stageFilter = new ColorMatrixFilter();
this.app.stage.filters = [this.stageFilter];

// In tick():
const [r, g, b] = this.dayNightCycle.getTintRGB();
this.stageFilter.matrix = [
  r, 0, 0, 0, 0,
  0, g, 0, 0, 0,
  0, 0, b, 0, 0,
  0, 0, 0, 1, 0,
];

// AFTER:
// In init():
this.worldContainer = new Container();
this.app.stage.addChild(this.worldContainer);
// Move all children from app.stage to worldContainer
// Remove ColorMatrixFilter import and stageFilter field

// In tick():
const tintHex = this.dayNightCycle.getTintHex();
if (tintHex !== this.lastTintHex) {
  this.worldContainer.tint = tintHex;
  this.lastTintHex = tintHex;
}
```

### DayNightCycle.getTintHex() Method

```typescript
// Add to day-night-cycle.ts:
/**
 * Get the current tint as a hex integer (0xRRGGBB).
 * Clamps each channel to [0, 255] for Container.tint compatibility.
 */
getTintHex(): number {
  const [r, g, b] = this.getTintRGB();
  return (Math.round(Math.min(r, 1) * 255) << 16)
       | (Math.round(Math.min(g, 1) * 255) << 8)
       | Math.round(Math.min(b, 1) * 255);
}
```

### Static Layer Caching

```typescript
// In World.init(), AFTER all children are added to each container:

// Tilemap is static after init
this.tilemapLayer.cacheAsTexture({ antialias: false });

// Scenery (trees, bushes, flowers, props) is static after init
this.sceneryLayer.cacheAsTexture({ antialias: false });
```

### Night Glow Threshold Guard

```typescript
// In World class:
private lastGlowIntensity = -1; // Force first update

// In World.tick():
const nightIntensity = this.dayNightCycle.getNightIntensity();

// Only update glow alphas when intensity meaningfully changes
if (Math.abs(nightIntensity - this.lastGlowIntensity) >= 0.005) {
  updateNightGlowLayer(this.nightGlows, nightIntensity);
  this.lastGlowIntensity = nightIntensity;
}
```

## State of the Art

| Old Approach (current) | New Approach (Phase 27) | Impact |
|------------------------|------------------------|--------|
| `ColorMatrixFilter` on `app.stage` -- forces full-scene off-screen render | `Container.tint` on worldContainer -- zero-cost multiplicative tint | Eliminates entire framebuffer render pass every frame |
| Tint matrix assigned every frame (18,000x per cycle) | Hex integer comparison skips identical frames | ~99.7% of tick calls skip tint write |
| Night glow alphas set on all 19 sprites every frame | Threshold-gated: skip when intensity delta < 0.005 | ~98% of ticks skip glow writes during plateaus |
| ~100+ draw calls for static tilemap + scenery | 2 cached textures (tilemap + scenery) | Reduces static draw calls to 2 |

**Deprecated/removed:**
- `ColorMatrixFilter` import and `stageFilter` field in world.ts
- `this.app.stage.filters = [this.stageFilter]` assignment
- Per-frame `this.stageFilter.matrix = [...]` 20-element array allocation

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js test runner + tsx v4.21.0 |
| Config file | None (uses Node.js built-in `node:test`) |
| Quick run command | `npx tsx --test src/renderer/day-night-cycle.test.ts` |
| Full suite command | `npx tsx --test src/**/*.test.ts` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GPU-01 | getTintHex() returns valid hex for all cycle points | unit | `npx tsx --test src/renderer/day-night-cycle.test.ts` | Partial (file exists, needs new tests) |
| GPU-01 | Visual comparison at 5 cycle points | manual-only | Screenshot comparison (human judgment) | N/A |
| GPU-02 | Tint hex value changes ~50 times per cycle (not 18,000) | unit | `npx tsx --test src/renderer/day-night-cycle.test.ts` | No -- Wave 0 |
| GPU-03 | cacheAsTexture called on tilemap and scenery | smoke | Visual inspection (app renders correctly with caching) | N/A manual |
| GPU-04 | Glow updates skip when nightIntensity unchanged within threshold | unit | `npx tsx --test src/renderer/day-night-cycle.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsx --test src/renderer/day-night-cycle.test.ts`
- **Per wave merge:** `npx tsx --test src/**/*.test.ts`
- **Phase gate:** Full suite green + visual comparison at 5 cycle points

### Wave 0 Gaps
- [ ] Add `getTintHex()` tests to `day-night-cycle.test.ts` -- covers GPU-01
- [ ] Add `getTintHex()` change-count test (iterate full cycle at 30fps, count unique hex values) -- covers GPU-02
- [ ] Add threshold guard test (verify glow update skips during plateaus) -- covers GPU-04

## Open Questions

1. **Building highlight tint with cacheAsTexture**
   - What we know: Buildings set `building.tint = 0xFFDD88` for active buildings (world.ts line 445). buildingsContainer is NOT cached. Building tint changes will multiply with parent worldContainer tint.
   - What's unclear: Whether the building warm highlight is visually distinguishable at night when compounded with the cool night tint (~0x6680CC). `0xFFDD88 * 0x6680CC / 0xFFFFFF = ~0x6656 73` (dark muddy color).
   - Recommendation: Verify visually after migration. If building highlights are invisible at night, consider boosting the highlight tint to compensate, or use a brighter color like 0xFFFF88.

2. **Whether to remove the `getTintRGB()` method after adding `getTintHex()`**
   - What we know: `getTintRGB()` is currently the only consumer interface. After adding `getTintHex()`, the RGB method may be unused.
   - Recommendation: Keep `getTintRGB()` for now -- it's well-tested and `getTintHex()` can call it internally. Remove in a future cleanup pass if confirmed unused.

## Sources

### Primary (HIGH confidence)
- [PixiJS 8 Container API docs](https://pixijs.download/dev/docs/scene.Container.html) -- tint property, getGlobalTint()
- [PixiJS 8 Scene Objects guide](https://pixijs.com/8.x/guides/components/scene-objects) -- tint inheritance
- [PixiJS 8 cacheAsTexture guide](https://pixijs.com/8.x/guides/components/scene-objects/container/cache-as-texture) -- API, options, best practices
- PixiJS 8.16.0 installed source code (`node_modules/pixi.js/lib/scene/container/`):
  - `utils/updateRenderGroupTransforms.mjs` line 93: `groupColor = multiplyColors(localColor, parent.groupColor)` -- confirms tint is always multiplicative
  - `RenderGroupPipe.mjs` line 59: `worldColor: 4294967295` during cache render -- confirms cached textures are untinted, parent tint applied at compositing
  - `container-mixins/getGlobalMixin.mjs`: `getGlobalTint()` traverses parent chain with multiplyColors
- Agent World source code: `world.ts`, `day-night-cycle.ts`, `night-glow-layer.ts`, `agent.ts`, `constants.ts` -- direct analysis of current implementation

### Secondary (MEDIUM confidence)
- [PixiJS v8 launch blog](https://pixijs.com/blog/pixi-v8-launches) -- confirms tint inheritance is new in v8
- [PixiJS cacheAsTexture PR #11031](https://github.com/pixijs/pixijs/pull/11031) -- implementation details
- Milestone research: `.planning/research/STACK.md`, `PITFALLS.md`, `FEATURES.md`, `SUMMARY.md`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all APIs verified in installed source code, zero new dependencies
- Architecture: HIGH -- scene hierarchy analyzed from world.ts, tint multiplication verified from PixiJS source, all constant values confirmed
- Pitfalls: HIGH -- compound tint math verified from actual PixiJS source code (not docs); NIGHT_TINT_B=0.8 (not 1.1) confirmed from constants.ts; cacheAsTexture tint interaction confirmed from RenderGroupPipe source
- Code examples: HIGH -- patterns derived from actual project code with line number references

**Key correction from milestone research:** The PITFALLS.md stated `NIGHT_TINT_B = 1.1` requiring clamping. Actual value in `constants.ts` line 380 is `NIGHT_TINT_B = 0.8`. All tint values are within [0, 1]. No clamping needed. The blue channel concern is unfounded.

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- PixiJS 8.x APIs well-established, project constants unlikely to change)
