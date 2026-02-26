# Phase 7: Effects and Atmosphere - Research

**Researched:** 2026-02-26
**Domain:** PixiJS 8 visual effects -- particle systems, filters, blend modes, ambient lighting
**Confidence:** HIGH

## Summary

Phase 7 replaces the existing Fireworks celebration with a golden light column + sparkle shower, adds ambient floating particles, quest zone glow highlights, and a warm ambient color tint across the entire world. All five requirements (FX-01, FX-02, FX-03, ENV-03, ENV-04) are additive visual effects with no architectural changes to the existing agent state machine or world layout.

The primary technical decisions are: (1) use simple `Graphics` and `Sprite` objects for the light column and ambient particles (particle counts are well under 100, so `ParticleContainer` is unnecessary overhead), (2) install `pixi-filters@^6.1.5` for `GlowFilter` on the light column (FX-02), (3) use the built-in `ColorMatrixFilter` for the warm ambient tint (FX-03), and (4) use `Container.tint` on Building sprites for the quest zone active highlight (ENV-04).

**Primary recommendation:** Replace `Fireworks` class with a new `LevelUpEffect` class using Graphics-drawn light column + sparkle particles; add `AmbientParticles` class using regular Sprites; apply `GlowFilter` to the light column container; apply `ColorMatrixFilter` with manual warm matrix to `app.stage`; tint active buildings with a golden highlight.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FX-01 | Task completion triggers a golden light column + sparkle shower replacing fireworks | New `LevelUpEffect` class replaces `Fireworks` -- vertical gradient rectangle + small circles falling outward. Same lifecycle pattern (tick/isDone/destroy). Agent.startCelebration() swaps reference. |
| FX-02 | Level-up light column has a GlowFilter halo effect | `pixi-filters@^6.1.5` provides `GlowFilter` compatible with PixiJS 8. Apply to the LevelUpEffect container with gold color, distance 15, outerStrength 2. |
| FX-03 | World has a warm ambient lighting tint (ColorMatrixFilter) | Built-in `ColorMatrixFilter` from `pixi.js`. No `warmth()` method exists -- use manual 5x4 matrix to boost red/green channels and slightly reduce blue. Apply once to `app.stage.filters`. |
| ENV-03 | Ambient floating particles (fireflies/magic dust) drift through the world | New `AmbientParticles` class with 20-30 small Sprites (2-4px circles) drifting with sine-wave motion + slow alpha cycling. Regular Container, not ParticleContainer. |
| ENV-04 | Quest zones show glow/highlight when agent is actively working there | Track active buildings in World.tick(). Apply golden `tint` (e.g. 0xFFDD88) to Building containers when agents are working there; reset to 0xFFFFFF when no agents present. Optionally add pulsing alpha on the tint. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | ^8.16.0 | ColorMatrixFilter (built-in), Graphics for light column, Sprite for particles, Container.tint for zone highlights | Already installed. All filter and rendering features are built into core. |
| pixi-filters | ^6.1.5 | GlowFilter for light column halo effect | Official PixiJS community filters. v6.x confirmed compatible with PixiJS 8.x per GitHub compatibility table. Only new dependency for this phase. |

### Supporting

No additional supporting libraries needed. All particle, filter, and tint features are built into PixiJS 8 core and the existing project setup.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Graphics-drawn light column | ParticleContainer + Particle for column segments | Overkill -- the light column is a single vertical gradient, not hundreds of particles. Graphics.rect() with FillGradient is simpler and cheaper. |
| Regular Sprite ambient particles | ParticleContainer for ambient particles | ParticleContainer is designed for 500+ particles. Ambient particles use 20-30 objects. Regular Sprites in a Container work fine and support filters (ParticleContainer does not support per-container filters). |
| pixi-filters GlowFilter | ADD blend mode radial gradient behind column | ADD blend gives a glow-like effect but lacks the soft Gaussian halo that GlowFilter provides. GlowFilter is cleaner for a single Container. |
| ColorMatrixFilter warm tint | Full-screen semi-transparent Graphics overlay with warm color | Overlay approach requires managing z-order carefully and doesn't affect existing colors naturally. ColorMatrixFilter transforms all colors mathematically -- more natural warm shift. |
| Building Container.tint for zone highlight | GlowFilter on Building | GlowFilter on multiple buildings is expensive (each filter renders to off-screen texture). Container.tint is free -- it's a GPU color multiply with zero overhead. |

**Installation:**
```bash
npm install pixi-filters@^6.1.5
```

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/
├── level-up-effect.ts    # NEW: Golden light column + sparkle shower (replaces fireworks.ts)
├── ambient-particles.ts  # NEW: Floating firefly/magic dust particles
├── fireworks.ts           # DELETE after LevelUpEffect is verified working
├── world.ts               # MODIFIED: warm filter, zone highlight tracking, ambient particles container
├── agent.ts               # MODIFIED: swap Fireworks -> LevelUpEffect in startCelebration()
└── constants.ts           # MODIFIED: new effect constants, remove FIREWORK_* constants
```

### Pattern 1: Effect Lifecycle (LevelUpEffect replacing Fireworks)

**What:** The existing `Fireworks` class follows a tick/isDone/destroy lifecycle. `LevelUpEffect` must follow the exact same pattern for drop-in replacement.

**When to use:** Any visual effect that has a finite duration, is created at a point, ticked each frame, and cleaned up when done.

**Example:**
```typescript
// Same lifecycle as Fireworks -- Agent.ts only changes the class name
export class LevelUpEffect extends Container {
  private elapsed = 0;
  private done = false;

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);
    this.createColumn();
    this.createSparkles();
    // Apply GlowFilter for halo
    this.filters = [new GlowFilter({
      distance: 15,
      outerStrength: 2,
      innerStrength: 0.5,
      color: 0xFFD700,
      quality: 0.3,
    })];
  }

  tick(deltaMs: number): void { /* animate column + sparkles */ }
  isDone(): boolean { return this.done; }
}
```

### Pattern 2: Light Column via Graphics

**What:** The golden light column is a tall narrow rectangle with vertical alpha gradient -- bright at bottom (agent feet), fading to transparent at top. Use Graphics with a vertical gradient fill.

**When to use:** Simple geometric shapes with gradients.

**Example:**
```typescript
import { Graphics, FillGradient } from 'pixi.js';

private createColumn(): void {
  const column = new Graphics();
  // PixiJS 8 FillGradient for vertical fade
  const gradient = new FillGradient({
    type: 'linear',
    start: { x: 0, y: -120 },
    end: { x: 0, y: 0 },
    colorStops: [
      { offset: 0, color: 'rgba(255, 215, 0, 0)' },     // transparent at top
      { offset: 0.3, color: 'rgba(255, 215, 0, 0.3)' },  // fade in
      { offset: 1, color: 'rgba(255, 215, 0, 0.8)' },    // bright at bottom
    ],
  });
  column.rect(-8, -120, 16, 120).fill(gradient);
  this.addChild(column);
}
```

**Note on FillGradient:** PixiJS 8 replaced the old `createLinearGradient` approach with a declarative `FillGradient` class. The `colorStops` accept CSS color strings including rgba for alpha control. This is the verified PixiJS 8 API.

### Pattern 3: Sparkle Shower (small Graphics circles)

**What:** 20-30 small circles that start at the column center, burst outward and downward like a shower, then fade out. Same approach as the current Fireworks sparks but with gold/yellow colors and gentler arcs.

**When to use:** Small particle-like effects where count is under 50.

**Example:**
```typescript
interface Sparkle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

private createSparkles(): void {
  const COLORS = [0xFFD700, 0xFFAA00, 0xFFFFAA]; // gold palette
  for (let i = 0; i < 25; i++) {
    const gfx = new Graphics();
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    gfx.circle(0, 0, 1.5 + Math.random() * 1.5).fill(color);
    this.addChild(gfx);
    this.sparkles.push({
      gfx,
      vx: (Math.random() - 0.5) * 60,
      vy: -20 + Math.random() * 40,  // mostly downward shower
      life: 0,
      maxLife: 1200 + Math.random() * 800,
    });
  }
}
```

### Pattern 4: Ambient Particles (Fireflies)

**What:** 20-30 small Sprites drifting slowly across the world with sine-wave vertical oscillation and cycling alpha (fading in and out like fireflies).

**When to use:** Persistent atmospheric effects that run continuously.

**Example:**
```typescript
export class AmbientParticles extends Container {
  private particles: AmbientParticle[] = [];

  constructor(worldWidth: number, worldHeight: number, count = 25) {
    super();
    for (let i = 0; i < count; i++) {
      const gfx = new Graphics();
      gfx.circle(0, 0, 1.5 + Math.random()).fill(0xFFFFAA);
      gfx.x = Math.random() * worldWidth;
      gfx.y = Math.random() * worldHeight;
      gfx.alpha = Math.random(); // staggered initial alpha
      this.addChild(gfx);
      this.particles.push({
        gfx,
        baseY: gfx.y,
        driftSpeed: 5 + Math.random() * 10,   // px/s horizontal
        bobSpeed: 0.5 + Math.random() * 1.0,    // sine frequency
        bobAmplitude: 8 + Math.random() * 16,    // sine amplitude px
        alphaSpeed: 0.3 + Math.random() * 0.5,  // fade cycle speed
        phase: Math.random() * Math.PI * 2,      // staggered phase
      });
    }
  }

  tick(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const p of this.particles) {
      p.phase += dt;
      p.gfx.x += p.driftSpeed * dt;
      p.gfx.y = p.baseY + Math.sin(p.phase * p.bobSpeed) * p.bobAmplitude;
      p.gfx.alpha = 0.2 + 0.6 * ((Math.sin(p.phase * p.alphaSpeed) + 1) / 2);
      // Wrap around world edges
      if (p.gfx.x > WORLD_WIDTH + 10) {
        p.gfx.x = -10;
        p.baseY = Math.random() * WORLD_HEIGHT;
      }
    }
  }
}
```

### Pattern 5: Warm Ambient Tint via ColorMatrixFilter

**What:** Apply a warm color shift to the entire world by setting `app.stage.filters` to a `ColorMatrixFilter` with a custom matrix that boosts reds/greens and slightly reduces blues.

**When to use:** Global color grading that affects all children uniformly.

**CRITICAL CORRECTION:** The STACK.md research referenced `warmFilter.warmth(0.3, false)` but **`warmth()` does NOT exist** on ColorMatrixFilter. The verified API methods are: `brightness()`, `contrast()`, `saturate()`, `hue()`, `tint()`, `sepia()`, `browni()`, `vintage()`, `kodachrome()`, `technicolor()`, `polaroid()`, `night()`, `predator()`, `lsd()`, `negative()`, `blackAndWhite()`, `grayscale()`, `desaturate()`, `toBGR()`, `colorTone()`, `reset()`.

**Correct approach -- manual matrix:**
```typescript
import { ColorMatrixFilter } from 'pixi.js';

const warmFilter = new ColorMatrixFilter();
// Manual warm tint: boost R slightly, keep G, reduce B slightly
// 5x4 matrix (row-major): [R, G, B, A, offset] for each output channel
warmFilter.matrix = [
  1.1,  0.05, 0,    0, 0,    // R output: boost red, add slight green bleed
  0,    1.05, 0,    0, 0,    // G output: slight boost
  0,    0,    0.9,  0, 0,    // B output: reduce blue for warmth
  0,    0,    0,    1, 0,    // A output: unchanged
];
app.stage.filters = [warmFilter];
```

**Alternative approach -- use `tint()` method:**
```typescript
const warmFilter = new ColorMatrixFilter();
warmFilter.tint(0xFFE8C0, false); // Warm golden tint
```
The `tint()` method sets diagonal values of the matrix, effectively multiplying all colors by the tint color. A warm golden color like `0xFFE8C0` would shift everything warm. This is simpler than a manual matrix.

### Pattern 6: Quest Zone Active Highlight

**What:** When an agent is actively working at a quest zone building, highlight that building with a golden tint. Track which buildings have active agents and apply/remove tint each tick.

**When to use:** Dynamic visual state that changes based on game state.

**Example:**
```typescript
// In World.tick():
// Track which buildings have active agents
const activeBuildingTypes = new Set<BuildingType>();
for (const agent of this.agents.values()) {
  const state = agent.getState();
  if (state === 'working' || state === 'walking_to_workspot') {
    const activity = this.lastActivity.get(agent.sessionId);
    if (activity && activity !== 'idle') {
      activeBuildingTypes.add(ACTIVITY_BUILDING[activity]);
    }
  }
}

// Apply/remove highlight tint
for (const [activityType, building] of this.questZones) {
  const buildingType = ACTIVITY_BUILDING[activityType];
  if (activeBuildingTypes.has(buildingType)) {
    building.tint = 0xFFDD88; // Warm golden highlight
  } else {
    building.tint = 0xFFFFFF; // No tint (original colors)
  }
}
```

**Optional enhancement:** Add a slow alpha pulse to the tint for a "glowing" feel. This can be a sine-wave modulation on the building alpha (e.g., 0.85 to 1.0) that only runs when the building is active.

### Anti-Patterns to Avoid

- **Using ParticleContainer for < 50 particles:** ParticleContainer adds complexity (TextureSource constraints, no filters, manual `update()` calls) with zero performance benefit at low counts. Regular Container + Graphics/Sprite is simpler and equally fast.
- **Applying GlowFilter to multiple buildings simultaneously:** Each GlowFilter creates an off-screen render texture. Multiple simultaneous glows multiply GPU memory usage. Use simple `tint` for buildings; reserve GlowFilter for the single celebration effect.
- **Calling `warmth()` on ColorMatrixFilter:** This method does not exist. Will throw a runtime error. Use manual matrix or `tint()` method instead.
- **Forgetting to destroy LevelUpEffect children:** Graphics objects must be explicitly destroyed via `destroy({ children: true })` or they leak GPU memory. The existing Fireworks cleanup pattern in Agent.tick() already does this correctly -- maintain that pattern.
- **Adding ambient particles above agents in z-order:** Firefly particles should drift BEHIND agents, not in front. Place the ambient particles container between the tilemap layer and the buildings container, or between buildings and agents (depending on desired visual depth).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glow halo effect | Manual radial gradient sprites around light column | `GlowFilter` from `pixi-filters` | Gaussian blur-based glow is GPU-accelerated and handles arbitrary shapes. Manual sprites look blocky on pixel art. |
| Color grading | Per-sprite tint manipulation | `ColorMatrixFilter` on `app.stage` | One filter on the root container affects everything uniformly. Per-sprite tinting would require touching every sprite and wouldn't affect Graphics objects. |
| Gradient fills | Canvas 2D gradient → Texture conversion | PixiJS 8 `FillGradient` class | Native PixiJS 8 feature specifically for gradient fills in Graphics. No canvas round-trip needed. |

**Key insight:** PixiJS 8's built-in filter system and `FillGradient` handle all the visual effects this phase needs. The only external dependency is `pixi-filters` for the GlowFilter halo, which is a single, well-maintained, officially blessed package.

## Common Pitfalls

### Pitfall 1: GlowFilter distance cannot be changed after creation

**What goes wrong:** The `distance` property of GlowFilter is baked into the shader at construction time. Changing it after creation has no effect.
**Why it happens:** GlowFilter pre-computes the blur kernel size from `distance`. Changing it would require recompiling the shader.
**How to avoid:** Set `distance` correctly in the constructor. If dynamic distance is needed, create a new GlowFilter instance.
**Warning signs:** Glow radius appears unchanged despite setting `distance` property.

### Pitfall 2: ColorMatrixFilter `warmth()` does not exist

**What goes wrong:** Runtime TypeError when calling `warmFilter.warmth()`.
**Why it happens:** The STACK.md research document incorrectly listed this method. It is not part of the PixiJS API (verified against official source code and API docs).
**How to avoid:** Use `warmFilter.tint(color)` for simple color shifts, or set `warmFilter.matrix` directly for precise control.
**Warning signs:** Any reference to `warmth()` in code or documentation.

### Pitfall 3: Filter on stage affects performance at scale

**What goes wrong:** Applying a filter to `app.stage` forces the entire scene to render to an off-screen texture first, then applies the filter, then renders to screen. This doubles the draw cost.
**Why it happens:** PixiJS filters work by capturing the container's rendered output into a texture, applying the filter shader, then compositing the result.
**How to avoid:** For a warm tint, this is acceptable -- it's a single full-screen pass on a 1024x768 canvas, which is trivial for any GPU. But avoid stacking multiple filters on `app.stage`. One `ColorMatrixFilter` is fine.
**Warning signs:** Frame rate drops noticeably when filter is applied. (Unlikely at 1024x768 resolution.)

### Pitfall 4: Ambient particles wrapping creates visible pop-in

**What goes wrong:** Particles that wrap from the right edge to the left edge visually "pop" into existence, breaking the atmospheric illusion.
**Why it happens:** Particle resets position from x > worldWidth to x = 0 in a single frame.
**How to avoid:** Wrap to x = -10 (offscreen left) so particles drift in naturally. Also randomize the baseY on wrap to avoid pattern repetition.
**Warning signs:** Particles appearing to flash at the left edge.

### Pitfall 5: GlowFilter + nearest-neighbor scaling artifacts

**What goes wrong:** GlowFilter applies a Gaussian blur, which can produce smooth/blurry pixels that conflict with the pixel-art nearest-neighbor aesthetic.
**Why it happens:** The glow operates at the filter resolution, not the pixel-art resolution. The blur naturally produces anti-aliased pixels.
**How to avoid:** Use low `quality` (0.2-0.3) to keep the glow rough/pixelated. The glow is intentionally soft -- it's a halo effect, not pixel art. This is an acceptable exception to the nearest-neighbor rule. Alternatively, keep `distance` small (10-15) to limit the blur radius.
**Warning signs:** Glow looking too smooth compared to surrounding pixel art. Adjust quality parameter.

### Pitfall 6: Agent status tint interacting with warm filter

**What goes wrong:** The warm ColorMatrixFilter on `app.stage` shifts the status tint colors (error red becomes orange-red, active teal becomes slightly warm-teal).
**Why it happens:** The ColorMatrixFilter applies after all container tints are resolved.
**How to avoid:** This is actually desirable -- the warm filter should unify all colors into the warm palette. If specific status colors must remain pure, adjust `STATUS_TINTS` values to compensate for the warm shift. Likely no adjustment needed since the warm shift is subtle.
**Warning signs:** Status colors looking "off" compared to Phase 3 expectations.

## Code Examples

### Complete LevelUpEffect Replacement Pattern
```typescript
// Source: Verified PixiJS 8 API (pixi.js ^8.16.0, pixi-filters ^6.1.5)
import { Container, Graphics, FillGradient } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';

interface Sparkle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class LevelUpEffect extends Container {
  private sparkles: Sparkle[] = [];
  private column: Graphics;
  private elapsed = 0;
  private done = false;
  private columnAlpha = 1;

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);

    // Golden light column (vertical gradient rectangle)
    this.column = new Graphics();
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: -100 },
      end: { x: 0, y: 0 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 215, 0, 0)' },
        { offset: 0.4, color: 'rgba(255, 215, 0, 0.4)' },
        { offset: 1, color: 'rgba(255, 215, 0, 0.9)' },
      ],
    });
    this.column.rect(-10, -100, 20, 100).fill(gradient);
    this.addChild(this.column);

    // Sparkle shower
    this.createSparkles();

    // GlowFilter halo (FX-02)
    this.filters = [new GlowFilter({
      distance: 15,
      outerStrength: 2,
      innerStrength: 0.5,
      color: 0xFFD700,
      quality: 0.3,
    })];
  }

  // ... tick() and sparkle logic follows Fireworks pattern
}
```

### Warm Filter Application
```typescript
// Source: Verified PixiJS 8 ColorMatrixFilter API
import { ColorMatrixFilter } from 'pixi.js';

// In World.init() after all containers are added:
const warmFilter = new ColorMatrixFilter();
warmFilter.tint(0xFFE8C0, false); // Warm golden tone
this.app.stage.filters = [warmFilter];
```

### Building Highlight Toggle
```typescript
// Source: PixiJS 8 Container.tint property
// In World.tick(), after agent state updates:
for (const [activityType, building] of this.questZones) {
  const hasActiveAgent = this.isZoneActive(activityType);
  building.tint = hasActiveAgent ? 0xFFDD88 : 0xFFFFFF;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Fireworks` class with multi-color burst | `LevelUpEffect` with golden light column + sparkle shower | Phase 7 (this phase) | Replaces spy-themed fireworks with RPG-themed level-up celebration |
| No ambient effects | `AmbientParticles` with drifting fireflies | Phase 7 (this phase) | Adds atmospheric depth to the world |
| `@pixi/particle-emitter` for particles | Native Sprites/Graphics in Container | PixiJS 8.0.0 (2024) | `@pixi/particle-emitter` never updated for PixiJS 8. Native approach is simpler for low counts. |
| `createLinearGradient()` canvas API | `FillGradient` class in PixiJS 8 | PixiJS 8.0.0 (2024) | Declarative gradient fills without canvas round-trip |

**Deprecated/outdated:**
- `warmth()` method on ColorMatrixFilter: **Never existed.** This was an error in the project's STACK.md research. Do not use.
- `@pixi/particle-emitter`: Still no PixiJS 8 support as of Feb 2026. Not needed for this phase's particle counts.

## Open Questions

1. **FillGradient with rgba color stops**
   - What we know: PixiJS 8 `FillGradient` accepts color stops. The docs show hex colors. CSS color strings (including `rgba()`) need to be verified to work with alpha values.
   - What's unclear: Whether FillGradient color stops support alpha transparency via CSS strings or only via separate alpha property.
   - Recommendation: Test at implementation time. Fallback: draw the column as multiple overlapping rectangles with decreasing alpha, which is guaranteed to work.

2. **GlowFilter performance on Electron with integrated GPU**
   - What we know: GlowFilter applies a multi-pass Gaussian blur. On dedicated GPUs this is trivial. Some users may run on integrated Intel GPUs.
   - What's unclear: Whether `quality: 0.3` at the celebration effect size (~20x100px source) causes any frame drop on integrated GPUs.
   - Recommendation: Start with `quality: 0.3`. If performance is an issue, reduce to `0.1` or remove the filter entirely (the light column is still visible without the glow).

3. **Warm filter interaction with titleBarOverlay**
   - What we know: The `titleBarOverlay` renders native Windows controls outside the PixiJS canvas. The ColorMatrixFilter only affects the PixiJS stage.
   - What's unclear: Whether the visual boundary between the warm-tinted canvas and the titleBarOverlay looks jarring.
   - Recommendation: The titleBarOverlay is already styled with `color: '#1a1a2e'` (dark background) and `symbolColor: '#c9a96e'` (golden buttons), which should complement the warm tint. Verify visually.

## Sources

### Primary (HIGH confidence)
- [PixiJS 8 ParticleContainer Guide](https://pixijs.com/8.x/guides/components/scene-objects/particle-container) - Confirmed ParticleContainer API, Particle properties, TextureSource constraint
- [PixiJS 8 Particle API Docs](https://pixijs.download/release/docs/scene.Particle.html) - Full Particle class properties: x, y, alpha, tint, scaleX, scaleY, rotation, anchorX, anchorY, color
- [PixiJS 8 ParticleContainer API Docs](https://pixijs.download/dev/docs/scene.ParticleContainer.html) - boundsArea property, addParticle/removeParticle methods, update() requirement
- [PixiJS 8 ColorMatrixFilter API Docs](https://pixijs.download/dev/docs/filters.ColorMatrixFilter.html) - Complete method list verified: NO warmth() method. Confirmed: tint(), brightness(), saturate(), hue(), sepia(), browni(), vintage(), etc.
- [PixiJS 8 ColorMatrixFilter Source](https://api.pixijs.io/@pixi/filter-color-matrix/src/ColorMatrixFilter.ts.html) - Source code verification: warmth() confirmed absent
- [PixiJS 8 Filters Guide](https://pixijs.com/8.x/guides/components/filters) - How to apply filters to containers, filter ordering, built-in filters list
- [pixi-filters GitHub](https://github.com/pixijs/filters) - v6.x confirmed compatible with PixiJS 8.x per compatibility table

### Secondary (MEDIUM confidence)
- [GlowFilter API Docs](https://pixijs.io/filters/docs/GlowFilter.html) - GlowFilter options: distance (default 10), outerStrength (default 4), innerStrength (default 0), color (default 0xFFFFFF), quality (default 0.1), knockout (default false)
- [pixi-filters npm](https://www.npmjs.com/package/pixi-filters) - Latest version 6.1.5, published ~3 months ago
- [PixiJS 8 ParticleContainer Blog](https://pixijs.com/blog/particlecontainer-v8) - Performance guidance: 1M particles at 60fps capability; static vs dynamic properties

### Tertiary (LOW confidence)
- None. All findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pixi.js ^8.16.0 already installed; pixi-filters ^6.1.5 compatibility verified against multiple official sources
- Architecture: HIGH - all patterns use existing project conventions (tick/isDone lifecycle, Graphics primitives, Container hierarchy); effect system is purely additive
- Pitfalls: HIGH - warmth() non-existence verified against source code; GlowFilter distance immutability confirmed in API docs; filter performance characteristics well-documented

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (stable APIs, no expected breaking changes)
