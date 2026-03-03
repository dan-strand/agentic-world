---
phase: 20-world-and-building-art
verified: 2026-03-03T14:30:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 20: World & Building Art Verification Report

**Phase Goal:** The world outside buildings looks like a living fantasy village, not empty space with paths
**Verified:** 2026-03-03T14:30:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A scenery sprite atlas exists containing tree, bush, flower, village prop, lantern, and fence sprites | VERIFIED | `assets/sprites/scenery.json` has 16 frames: pine_tree, oak_tree, bush_large, bush_small, flowers_red, flowers_blue, barrel, crate, well, signpost, fence_h, fence_v, lantern, torch, pond_tile, market_stall. `assets/sprites/scenery.png` is 4261 bytes, 144x112. Generator script is 630 lines. |
| 2 | The tilemap renders improved paths with dirt border transitions and a visible pond or stream | VERIFIED | `tilemap-builder.ts` (400 lines) has 2-tile-wide paths (line 57), border transitions with semi-transparent overlay (lines 141-172), pond at (512, 690) with blue gradient layers, specular highlights, ripple lines, and reed tufts (lines 176-252), plus ~120 decorations including mushrooms and fallen leaves. |
| 3 | The scenery atlas JSON descriptor is compatible with PixiJS Spritesheet loading | VERIFIED | `scenery.json` follows exact PixiJS Spritesheet format with frames, rotated, trimmed, spriteSourceSize, sourceSize fields. Meta block has `"image": "scenery.png"` (line 327). Loaded in parallel via `Assets.load('../assets/sprites/scenery.json')` in asset-loader.ts (line 30). |
| 4 | Trees, bushes, and flowers are visible filling the gaps between buildings creating a lush forested look | VERIFIED | `scenery-layer.ts` (307 lines) places 10 pine trees, 7 oak trees, 12 large bushes, 17 small bushes, 9 red flower clusters, and 7 blue flower clusters via seeded random with exclusion zones (lines 135-175). Total ~62 vegetation sprites. |
| 5 | Village props (fences, barrels, crates, well, signposts) are placed near buildings creating a lived-in feel | VERIFIED | `scenery-layer.ts` places 1 well (line 180), 4 signposts (lines 185-195), 3 barrels near Tavern (lines 198-208), 3 crates near Training Grounds (lines 211-221), 1 market stall near Ancient Library (lines 224-228), 5 horizontal fences, and 3 vertical fences (lines 232-255). |
| 6 | Lanterns and torches are placed along paths and near buildings as lighting fixtures | VERIFIED | `scenery-layer.ts` places 4 lanterns at path intersections (lines 259-269), 2 lanterns along center cross (lines 272-280), and 8 torches flanking 4 building entrances (lines 283-301). Total 14 lighting fixtures. |
| 7 | Building chimney smoke particles animate during runtime | VERIFIED | `building.ts` has `SmokeParticle` interface (line 13), `smokeParticles`/`smokeTimer`/`smokeContainer` fields (lines 58-60), smoke container added as child (lines 128-132), full `tick(deltaMs)` method (lines 335-393) with spawn at CHIMNEY_POSITIONS, upward drift, horizontal drift, scale growth, alpha fade, and self-removal. `world.ts` calls `building.tick(deltaMs)` for all quest zones (lines 357-359). Constants in `constants.ts` (lines 265-276). |
| 8 | Each building has unique surrounding details and exterior enhancements (roof, chimney, signs, windows) | VERIFIED | `generate-buildings.js` (2265 lines) has shared functions `drawRoofEdge`, `drawChimney`, `drawHangingSign`, `drawGlowingWindows`, `drawDoorstep` (lines 1815-1990). Per-building exterior functions: Wizard Tower (rune circles + herb garden, lines 2000-2064), Training Grounds (weapon rack + sand circle, lines 2072-2128), Ancient Library (potted plants + sundial, lines 2136-2182), Tavern (barrels/crates + bench + larger chimney, lines 2190-2245). All called at lines 2256-2259. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/generate-scenery.js` | Programmatic scenery atlas generation (min 200 lines) | VERIFIED | 630 lines, 16 sprite draw functions, writes scenery.png and scenery.json |
| `assets/sprites/scenery.png` | Scenery sprite atlas PNG | VERIFIED | 4261 bytes, generated from generate-scenery.js |
| `assets/sprites/scenery.json` | PixiJS Spritesheet descriptor | VERIFIED | 16 frame entries, valid format, `meta.image: "scenery.png"` |
| `src/renderer/tilemap-builder.ts` | Enhanced paths + pond | VERIFIED | 400 lines, 2-tile paths, border transitions, oval pond with ripples/reeds, ~120 decorations |
| `scripts/generate-buildings.js` | Updated building atlas with exteriors (min 1800 lines) | VERIFIED | 2265 lines, all 4 buildings have shared + unique exterior detail functions |
| `assets/sprites/buildings.png` | Regenerated building atlas | VERIFIED | 71755 bytes, 1856x336 dimensions preserved |
| `src/renderer/building.ts` | Chimney smoke particle effect | VERIFIED | 396 lines, SmokeParticle interface, tick() method with full particle lifecycle |
| `src/shared/constants.ts` | Smoke particle config constants | VERIFIED | CHIMNEY_SMOKE_* constants (lines 265-272), CHIMNEY_POSITIONS record (line 275) |
| `src/renderer/scenery-layer.ts` | Scenery placement module (min 80 lines) | VERIFIED | 307 lines, 96 sprites placed with exclusion zones and seeded random |
| `src/renderer/asset-loader.ts` | Scenery texture loading | VERIFIED | sceneryTextures export (line 16), parallel loading in Promise.all (line 30), texture population (lines 53-56) |
| `src/renderer/world.ts` | Scenery layer + building tick wiring | VERIFIED | sceneryLayer field (line 61), buildSceneryLayer() call (line 186), addChild (line 187), building.tick in tick loop (lines 357-359) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/generate-scenery.js` | `assets/sprites/scenery.png` | pngjs PNG write | WIRED | `fs.writeFileSync(outPath, buffer)` at line 599, outPath = `assets/sprites/scenery.png` |
| `scripts/generate-scenery.js` | `assets/sprites/scenery.json` | JSON write | WIRED | `fs.writeFileSync(jsonPath, ...)` at line 629, jsonPath = `assets/sprites/scenery.json` |
| `assets/sprites/scenery.json` | `assets/sprites/scenery.png` | meta.image reference | WIRED | `"image": "scenery.png"` at line 327 of scenery.json |
| `scripts/generate-buildings.js` | `assets/sprites/buildings.png` | pngjs PNG write | WIRED | `fs.writeFileSync(outPath, buffer)` at line 2264 |
| `src/renderer/building.ts` | `src/shared/constants.ts` | import smoke constants | WIRED | Lines 5-8 import all CHIMNEY_SMOKE_* and CHIMNEY_POSITIONS, used throughout tick() |
| `src/renderer/asset-loader.ts` | `assets/sprites/scenery.json` | Assets.load | WIRED | `Assets.load('../assets/sprites/scenery.json')` at line 30 |
| `src/renderer/scenery-layer.ts` | `src/renderer/asset-loader.ts` | import sceneryTextures | WIRED | `import { sceneryTextures } from './asset-loader'` at line 2 |
| `src/renderer/world.ts` | `src/renderer/scenery-layer.ts` | import and add to scene | WIRED | `import { buildSceneryLayer }` at line 28, called at line 186, addChild at line 187 |
| `src/renderer/world.ts` | `src/renderer/building.ts` | building.tick() calls | WIRED | `building.tick(deltaMs)` in tick loop at lines 357-359 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| SCEN-01 | 20-01, 20-03 | Trees and vegetation (pines, bushes, flowers) placed in spaces between buildings | SATISFIED | scenery-layer.ts places 10 pines, 7 oaks, 12 large bushes, 17 small bushes, 16 flower clusters via seeded random with building exclusion zones |
| SCEN-02 | 20-01, 20-03 | Village props (fences, barrels, crates, market stall, well, signposts) near buildings | SATISFIED | scenery-layer.ts places well, 4 signposts, 3 barrels near Tavern, 3 crates near Training Grounds, 1 market stall, 5 horizontal + 3 vertical fences |
| SCEN-03 | 20-01 | Enhanced paths and water features (improved dirt paths, small pond or stream) | SATISFIED | tilemap-builder.ts has 2-tile-wide paths with border transitions and oval pond with ripples and reeds |
| SCEN-04 | 20-01, 20-03 | Lighting props (lanterns, torches, street lamps) placed throughout the world | SATISFIED | scenery-layer.ts places 6 lanterns along paths/intersections and 8 torches flanking building entrances |
| BLDG-01 | 20-02 | Roof details and chimneys with visible smoke particles | SATISFIED | drawRoofEdge and drawChimney in generate-buildings.js for all 4 buildings; building.ts tick() emits smoke particles from CHIMNEY_POSITIONS |
| BLDG-02 | 20-02 | Hanging signs and guild banners on building facades | SATISFIED | drawHangingSign function in generate-buildings.js called for all 4 buildings with per-building theme colors |
| BLDG-03 | 20-02 | Windows that glow from within, especially visible at night | SATISFIED | drawGlowingWindows function draws 2-3 warm yellow windows per wall with blendPixel halo glow effect for all 4 buildings |
| BLDG-04 | 20-02 | Building-specific surrounding details (garden plots, doorsteps, awnings) | SATISFIED | Wizard Tower: rune circles + herb garden. Training Grounds: weapon rack + sand circle. Ancient Library: potted plants + sundial. Tavern: barrels/crates + bench. All buildings: doorstep + flanking torches via drawDoorstep. |

No orphaned requirements found. All 8 requirement IDs (SCEN-01 through SCEN-04, BLDG-01 through BLDG-04) are accounted for across Plans 20-01, 20-02, and 20-03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODO, FIXME, PLACEHOLDER, stub returns, or console.log-only implementations found in any Phase 20 artifact |

### Human Verification Required

### 1. Visual World Appearance

**Test:** Run `npm start` and observe the world between buildings
**Expected:** Trees, bushes, flowers, village props, fences, lanterns, and torches fill the spaces between buildings. The world should look like a lush fantasy village, not empty space with paths.
**Why human:** Visual aesthetics and "feel" of a living village cannot be verified programmatically.

### 2. Pond Visual Quality

**Test:** Look at the bottom-center area of the world
**Expected:** An oval blue pond with visible gradient layers, ripple highlights, and green reed tufts along one edge
**Why human:** Water rendering quality and natural appearance require visual judgment.

### 3. Path Width and Border Transitions

**Test:** Observe the dirt paths from campfire to buildings
**Expected:** Paths should be 2 tiles wide with visible dirt-to-grass transition borders (not hard pixel edges)
**Why human:** Visual smoothness of transitions requires human assessment.

### 4. Building Exterior Details

**Test:** Look at each building's exterior walls and surroundings
**Expected:** Roof edge shingles visible at top, chimney protrusion, hanging sign near entrance, warm yellow glowing windows along walls, doorstep with flanking torches, and unique surrounding elements per building
**Why human:** Pixel art quality and readability at native resolution require visual judgment.

### 5. Chimney Smoke Animation

**Test:** Watch any building's chimney area for 5+ seconds
**Expected:** Small gray smoke puffs should spawn, drift upward and slightly horizontal, grow larger, fade out, and disappear
**Why human:** Animation smoothness and visual effect quality require runtime observation.

### 6. Existing Functionality Preservation

**Test:** Wait for agents to walk to buildings, work, celebrate, and return to campfire
**Expected:** All agent routing, building interiors, campfire gathering, speech bubbles, and dashboard functionality work unchanged
**Why human:** Full integration regression requires interactive testing.

### Gaps Summary

No gaps found. All 8 observable truths are verified with concrete codebase evidence. All 11 artifacts exist, are substantive (well above minimum line counts), and are properly wired through imports and function calls. All 9 key links are connected. All 8 requirement IDs are satisfied. No anti-patterns detected in any modified file. All 5 commits verified in git history.

The phase goal -- "The world outside buildings looks like a living fantasy village, not empty space with paths" -- is supported by comprehensive infrastructure: a 16-sprite scenery atlas, 96 placed scenery sprites with exclusion zone logic, enhanced tilemap with wider paths and pond, 4 building exteriors with shared and unique detail functions, and a chimney smoke particle system wired into the tick loop.

---

_Verified: 2026-03-03T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
