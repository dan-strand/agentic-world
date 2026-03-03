---
phase: 20-world-and-building-art
plan: 01
subsystem: ui
tags: [pngjs, pixel-art, spritesheet, tilemap, canvas]

# Dependency graph
requires:
  - phase: 05-tilemap-and-tiles
    provides: "Tile atlas pipeline (pngjs + JSON descriptor), tilemap builder"
provides:
  - "Scenery sprite atlas (16 outdoor element sprites) for world population"
  - "Enhanced tilemap with 2-tile-wide paths, border transitions, and pond"
  - "120+ deterministic ground decorations including mushrooms and leaves"
affects: [20-world-and-building-art, 20-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-row atlas packing for mixed-size sprites"
    - "Canvas-based path border transitions using semi-transparent overlays"
    - "Pixel-level pond rendering with ripple and reed details"

key-files:
  created:
    - scripts/generate-scenery.js
    - assets/sprites/scenery.png
    - assets/sprites/scenery.json
  modified:
    - src/renderer/tilemap-builder.ts

key-decisions:
  - "Pack 16 sprites in 3-row layout (144x112) to minimize atlas size"
  - "Place pond at bottom-center (512, 690) between bottom buildings to avoid overlaps"
  - "Use semi-transparent border overlay for path transitions instead of custom tile variants"

patterns-established:
  - "Scenery atlas pipeline: generate-scenery.js -> scenery.png + scenery.json"
  - "Path widening via direction-aware Bresenham expansion (col+1 or row+1)"

requirements-completed: [SCEN-01, SCEN-02, SCEN-03, SCEN-04]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 20 Plan 01: Scenery Atlas & Enhanced Tilemap Summary

**16-sprite scenery atlas with trees, props, lanterns, and fences plus tilemap upgrade with 2-tile-wide bordered paths, oval pond with reeds, and 120+ ground decorations**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-03T13:07:48Z
- **Completed:** 2026-03-03T13:12:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Generated 144x112 scenery sprite atlas with 16 distinct pixel art sprites (trees, bushes, flowers, barrel, crate, well, signpost, fences, lantern, torch, pond tile, market stall)
- Enhanced tilemap paths from 1-tile to 2-tile width with dirt-to-grass border transitions for natural look
- Added oval pond feature near bottom-center with dark blue gradient, ripple highlights, and reed tufts
- Increased ground decoration density from ~50 to ~120 with new mushroom and fallen leaf types

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate scenery sprite atlas with trees, props, lanterns, and fences** - `45998a7` (feat)
2. **Task 2: Enhance tilemap builder with improved paths and pond feature** - `d1fd83d` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `scripts/generate-scenery.js` - Programmatic scenery atlas generator using pngjs (630 lines, 16 sprite draw functions)
- `assets/sprites/scenery.png` - 144x112 scenery sprite atlas PNG (4261 bytes)
- `assets/sprites/scenery.json` - PixiJS Spritesheet descriptor with 16 frame entries
- `src/renderer/tilemap-builder.ts` - Enhanced with 2-tile paths, border transitions, pond, and 120+ decorations

## Decisions Made
- Packed 16 sprites into 3 rows (trees/bushes row, props/fences row, lighting/water/market row) for efficient 144x112 atlas
- Positioned pond at world bottom-center (512, 690) with 80x48px oval to fit between bottom buildings without overlap
- Used semi-transparent CSS rgba overlay for path border transitions -- simpler than creating custom transition tiles and visually effective
- Direction-aware path widening: vertical paths widen horizontally, horizontal paths widen vertically

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scenery atlas ready for Plan 20-03 to wire into the live scene via asset-loader.ts
- Tilemap ground improvements will be visible immediately on next app launch
- All 16 sprite frames documented in scenery.json with correct coordinates for PixiJS Spritesheet loading

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 20-world-and-building-art*
*Completed: 2026-03-03*
