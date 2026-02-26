---
phase: 04-asset-pipeline-and-world-ground
plan: 01
subsystem: ui
tags: [pixi.js, electron, webpack, tilemap, asset-pipeline, sprite-atlas]

# Dependency graph
requires:
  - phase: 03-status-feedback-and-celebration
    provides: "Working PixiJS renderer, World class, GameLoop, agent sprites"
provides:
  - "Fixed 1024x768 window with hidden title bar and overlay controls"
  - "CopyWebpackPlugin asset pipeline for sprite atlases"
  - "Tile atlas (grass_1, grass_2, grass_3, dirt_path) in PixiJS spritesheet format"
  - "loadAllAssets() centralized asset loading function"
  - "TextureStyle nearest-neighbor scaleMode for pixel-crisp rendering"
  - "Zone position constants (GUILD_HALL_POS, QUEST_ZONE_POSITIONS)"
  - "Tile constants (TILE_SIZE, WORLD_COLS, WORLD_ROWS)"
affects: [04-02-tilemap-ground, 05-building-sprites, 06-character-sprites]

# Tech tracking
tech-stack:
  added: ["@pixi/tilemap@^5.0.2", "copy-webpack-plugin@^13.0.1", "pngjs@^7.0.0"]
  patterns: ["Atlas-first asset loading via Assets.load()", "CopyWebpackPlugin for static assets", "TextureStyle.defaultOptions before any texture creation"]

key-files:
  created:
    - "src/renderer/asset-loader.ts"
    - "assets/sprites/tiles.json"
    - "assets/sprites/tiles.png"
    - "scripts/generate-tiles.js"
  modified:
    - "src/main/index.ts"
    - "src/shared/constants.ts"
    - "src/renderer/index.ts"
    - "src/renderer/index.html"
    - "webpack.renderer.config.ts"
    - "forge.config.ts"

key-decisions:
  - "Asset path uses ../ prefix to navigate from Electron Forge main_window subdir to renderer output root"
  - "devContentSecurityPolicy added with worker-src blob: for PixiJS web worker asset loading"
  - "pngjs used for deterministic tile atlas PNG generation (reproducible via scripts/generate-tiles.js)"

patterns-established:
  - "Atlas-first: all sprites loaded via Assets.load() with alias + src pairs in asset-loader.ts"
  - "Pixel-crisp: TextureStyle.defaultOptions.scaleMode = 'nearest' set at module level before any import that creates textures"
  - "Static assets: CopyWebpackPlugin copies assets/ dir to webpack output, referenced via ../ relative paths"

requirements-completed: [ENV-02]

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 4 Plan 1: Asset Pipeline and Window Setup Summary

**Fixed 1024x768 Electron window with hidden title bar, CopyWebpackPlugin asset pipeline, and PixiJS tile atlas (4 tile types) with nearest-neighbor rendering**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-26T02:44:17Z
- **Completed:** 2026-02-26T02:52:49Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Locked Electron window to exactly 1024x768 with hidden title bar, titleBarOverlay, no resize, no menu bar
- Built asset pipeline: CopyWebpackPlugin copies assets/ to webpack output, loadAllAssets() loads sprite atlases
- Created 4-tile grass/dirt atlas (tiles.json + tiles.png) in PixiJS spritesheet format
- Set TextureStyle.defaultOptions.scaleMode = 'nearest' globally for pixel-crisp rendering
- Added zone position constants for Guild Hall and 4 quest zones (coding, testing, reading, comms)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fixed window, asset pipeline deps, and tile atlas** - `c59fab5` (feat)
2. **Task 2: Asset loader and renderer init sequence** - `c623ba4` (feat)
3. **Task 3: Validate asset pipeline end-to-end in dev build** - `f322dd4` (fix)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `src/main/index.ts` - Fixed 1024x768 window with hidden title bar, titleBarOverlay, Menu.setApplicationMenu(null)
- `src/shared/constants.ts` - TILE_SIZE, WORLD_COLS/ROWS, GUILD_HALL_POS, QUEST_ZONE_POSITIONS
- `src/renderer/index.ts` - TextureStyle nearest-neighbor, loadAllAssets() before World init, removed resize listener
- `src/renderer/asset-loader.ts` - Centralized async asset loading with Assets.load()
- `src/renderer/index.html` - Added -webkit-app-region: no-drag for canvas mouse events
- `webpack.renderer.config.ts` - CopyWebpackPlugin copying assets/ to output
- `forge.config.ts` - devContentSecurityPolicy with worker-src blob: for PixiJS
- `assets/sprites/tiles.json` - PixiJS spritesheet descriptor with 4 frames
- `assets/sprites/tiles.png` - 128x32 tile atlas with grass_1, grass_2, grass_3, dirt_path
- `scripts/generate-tiles.js` - Deterministic PNG generation script using pngjs

## Decisions Made
- Asset path uses `../assets/sprites/tiles.json` (relative to main_window subdir) rather than absolute URL -- works for both dev and packaged builds
- Added devContentSecurityPolicy with `worker-src 'self' blob:` to allow PixiJS's web worker for asset loading
- Used pngjs for tile PNG generation since sharp was not available -- simpler and sufficient for pixel art

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed asset loading path for Electron Forge directory structure**
- **Found during:** Task 3 (End-to-end validation)
- **Issue:** CopyWebpackPlugin copies to `.webpack/renderer/assets/` but dev server serves from `.webpack/renderer/main_window/`. The relative URL `assets/sprites/tiles.json` resolved to the wrong location, causing 404.
- **Fix:** Changed asset-loader.ts src to `../assets/sprites/tiles.json` to navigate up from main_window subdir
- **Files modified:** src/renderer/asset-loader.ts
- **Verification:** App launches, `[renderer] Assets loaded` appears in console
- **Committed in:** f322dd4 (Task 3 commit)

**2. [Rule 3 - Blocking] Added CSP worker-src directive for PixiJS blob workers**
- **Found during:** Task 3 (End-to-end validation)
- **Issue:** PixiJS 8 uses blob: workers for asset loading. Electron Forge's default CSP blocks blob: workers, causing `Creating a worker from 'blob:...' violates CSP` error.
- **Fix:** Added devContentSecurityPolicy to forge.config.ts WebpackPlugin with `worker-src 'self' blob:`
- **Files modified:** forge.config.ts
- **Verification:** App launches without CSP worker errors, assets load successfully
- **Committed in:** f322dd4 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were essential for the asset pipeline to function. No scope creep -- these are standard integration issues discovered during end-to-end validation.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tile atlas loaded and available via `Assets.get('tiles')` for tilemap rendering in Plan 02
- Zone position constants ready for path generation between Guild Hall and quest zones
- @pixi/tilemap package installed and ready for CompositeTilemap usage in Plan 02
- Fixed window means tilemap dimensions are constant (32x24 tiles)

## Self-Check: PASSED

All created files verified present. All 3 task commit hashes verified in git log.

---
*Phase: 04-asset-pipeline-and-world-ground*
*Completed: 2026-02-25*
