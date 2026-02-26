---
phase: 04-asset-pipeline-and-world-ground
plan: 02
subsystem: ui
tags: [pixi.js, tilemap, canvas, ground-layer, dirt-paths]

# Dependency graph
requires:
  - phase: 04-asset-pipeline-and-world-ground
    plan: 01
    provides: "Tile atlas, asset pipeline, zone constants, fixed window"
provides:
  - "Canvas-rendered tilemap ground with grass variants and dirt paths"
  - "tileTextures module export for direct texture access from spritesheet"
  - "Tilemap layer replacing old backgroundContainer + roadsContainer"
affects: [05-building-sprites]

# Tech tracking
tech-stack:
  removed: ["@pixi/tilemap@^5.0.2"]
  patterns: ["Canvas-rendered static ground sprite", "Direct texture references via tileTextures map"]

key-files:
  created:
    - "src/renderer/tilemap-builder.ts"
  modified:
    - "src/renderer/world.ts"
    - "src/renderer/asset-loader.ts"
    - "src/renderer/index.ts"
    - "src/main/index.ts"
    - "webpack.renderer.config.ts"

key-decisions:
  - "Removed @pixi/tilemap due to CJS/ESM incompatibility with Electron Forge webpack (bare require() in renderer, extension registration on wrong PixiJS instance, isInteractive crash)"
  - "Canvas-based approach: render all tiles to offscreen canvas, create single PixiJS Sprite -- equally efficient for static ground, zero external deps"
  - "tileTextures module map bypasses unreliable PixiJS Cache string lookups through webpack bundle"
  - "Updated Electron console-message handler to non-deprecated API (event.message instead of positional args)"

patterns-established:
  - "Static visual layers: pre-render to canvas, use as single Sprite texture"
  - "Texture access: import tileTextures map from asset-loader, not Cache.get() or Texture.from()"

requirements-completed: [ENV-01, THEME-05]

# Metrics
duration: 25min
completed: 2026-02-26
---

# Phase 4 Plan 2: Tilemap Ground Layer Summary

**Canvas-rendered grass tilemap with dirt paths connecting guild hall to quest zones, replacing old solid-color background and Graphics road spokes**

## Performance

- **Duration:** 25 min (including @pixi/tilemap debugging and replacement)
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Created tilemap-builder.ts with seeded grass variation (80/12/8 distribution) and Bresenham dirt paths
- Replaced backgroundContainer (Graphics.rect) and roadsContainer (Graphics spokes) with tilemapLayer
- 5x5 dirt clearing at guild hall center, 3x3 at each quest zone
- All v1.0 features (agents, compounds, speech bubbles, status tints) preserved on top of tilemap

## Task Commits

1. **Task 1: Create tilemap-builder with grass variants and dirt paths** - `cf73508` (feat)
2. **Task 2: Integrate tilemap into World scene** - `7b5e83f` (feat)
3. **Task 3: Visual verification** - User approved after bug fixes

### Bug Fix Commits
4. **Fix: Resolve renderer crash from @pixi/tilemap CJS require** - `2adc4bb` (fix)
5. **Fix: Disable events on tilemap layer (isInteractive crash)** - `e1b3010` (fix)
6. **Fix: Replace @pixi/tilemap with canvas-rendered ground sprite** - `0e37b29` (fix)

## Deviations from Plan

### Major Deviation: Replaced @pixi/tilemap with canvas rendering

**Issue:** `@pixi/tilemap@5.0.2` had three cascading incompatibilities with Electron Forge + webpack:
1. CJS entry (`lib/index.js`) emitted bare `require()` calls inside webpack eval, failing with `nodeIntegration: false`
2. ESM alias workaround caused PixiJS Cache texture lookups to fail (frame textures not found)
3. CompositeTilemap objects lacked `isInteractive()` method expected by PixiJS 8's EventBoundary
4. Even after fixing #1-3, extension registration (TilemapPipe, GlTilemapAdaptor) happened on a different PixiJS module instance, so tiles were in the scene graph but never rendered

**Resolution:** Removed `@pixi/tilemap` entirely. Replaced with canvas-based rendering: build tile grid in memory, draw tiles onto an offscreen `<canvas>` using standard Canvas2D API, create a single PixiJS `Texture.from(canvas)` + `Sprite`. This is equally efficient for a static ground layer (single draw call, rendered once) and eliminates all compatibility issues.

**Impact:** No functional difference. Same visual output, same performance characteristics. The `buildWorldTilemap()` API is preserved (returns a display object for the scene graph).

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log. User visually approved the tilemap rendering.

---
*Phase: 04-asset-pipeline-and-world-ground*
*Completed: 2026-02-26*
