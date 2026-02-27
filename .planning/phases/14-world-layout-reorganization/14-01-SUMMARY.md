---
phase: 14-world-layout-reorganization
plan: 01
subsystem: ui
tags: [pixi.js, sprites, pngjs, tilemap, constants, atlas]

# Dependency graph
requires:
  - phase: 07-building-labels
    provides: "Building label system and work spots"
provides:
  - "2x2 grid layout constants (464x336 buildings, 64px campfire, grid positions)"
  - "Larger landscape building atlas (4 buildings, 1856x336)"
  - "Campfire sprite atlas (64x64)"
  - "Asset loader with campfire texture support"
affects: [14-02-world-wiring, 15-interior-art]

# Tech tracking
tech-stack:
  added: []
  patterns: ["2x2 grid layout with center campfire crossroads"]

key-files:
  created:
    - "scripts/generate-campfire.js"
    - "assets/sprites/campfire.json"
    - "assets/sprites/campfire.png"
  modified:
    - "src/shared/constants.ts"
    - "scripts/generate-buildings.js"
    - "assets/sprites/buildings.json"
    - "assets/sprites/buildings.png"
    - "src/renderer/asset-loader.ts"
    - "src/renderer/world.ts"

key-decisions:
  - "Building dimensions 464x336 maximizing 2x2 grid area within 1024x768"
  - "Replaced guild_hall with campfire in BuildingType union for clean type separation"
  - "Work spots scaled to x=140, y=100 offsets for larger building interiors"

patterns-established:
  - "Grid layout: 16px margins, 64px center gap, symmetric 2x2 quadrant placement"
  - "Campfire as separate sprite atlas loaded in parallel with buildings"

requirements-completed: [LAYOUT-01, LAYOUT-02]

# Metrics
duration: 7min
completed: 2026-02-27
---

# Phase 14 Plan 01: Grid Constants & Sprite Assets Summary

**2x2 grid layout constants with 464x336 landscape buildings, 64x64 campfire waypoint sprite, and 4-atlas parallel asset loading**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-27T17:52:48Z
- **Completed:** 2026-02-27T17:59:25Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Constants define 2x2 grid layout with buildings filling most of 1024x768 window
- Four building sprites generated at 464x336 landscape dimensions (placeholder exteriors)
- Campfire sprite generated at 64x64 with stone ring, flames, warm glow
- All spritesheet descriptors valid and matching actual PNG dimensions
- Asset loader loads 4 atlases (tiles, buildings, campfire, characters) in parallel

## Task Commits

Each task was committed atomically:

1. **Task 1: Update constants for 2x2 grid layout with campfire center** - `87a576a` (feat)
2. **Task 2: Generate larger building atlas and campfire sprite** - `26eadf1` (feat)

## Files Created/Modified
- `src/shared/constants.ts` - New grid layout constants, campfire position/size, scaled work spots
- `scripts/generate-buildings.js` - Larger 464x336 building atlas (4 buildings, no guild_hall)
- `scripts/generate-campfire.js` - New 64x64 campfire sprite generator
- `assets/sprites/buildings.json` - Updated frame dimensions for 4 buildings at 464x336
- `assets/sprites/buildings.png` - Regenerated 1856x336 building atlas
- `assets/sprites/campfire.json` - New campfire spritesheet descriptor
- `assets/sprites/campfire.png` - New 64x64 campfire sprite
- `src/renderer/asset-loader.ts` - campfireTexture export, 4-atlas parallel loading
- `src/renderer/world.ts` - Updated to use campfireTexture and campfire BuildingType

## Decisions Made
- Building dimensions: 464x336 (floor((1024-64-32)/2) for each axis) -- maximizes building area within the grid
- Grid positions computed as center of each quadrant: TL(248,184), TR(776,184), BL(248,584), BR(776,584)
- Replaced 'guild_hall' with 'campfire' in BuildingType union rather than keeping both -- cleaner type system
- Work spots spread to x=+/-140, y=-100/-40 for proportional coverage of larger building interiors
- GUILD_HALL_POS kept as legacy alias pointing to CAMPFIRE_POS for backward compatibility until Plan 02

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated world.ts guild_hall references to campfire**
- **Found during:** Task 1 (Constants update)
- **Issue:** BuildingType no longer includes 'guild_hall', causing TypeScript errors in world.ts
- **Fix:** Changed Building constructor call to use 'campfire' type and campfireTexture atlas
- **Files modified:** src/renderer/world.ts
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** 87a576a (Task 1), 26eadf1 (Task 2 -- campfireTexture import)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All dimensional constants ready for Plan 02 to wire up the actual world layout
- Building sprites at correct size for quadrant placement
- Campfire sprite ready for center crossroads positioning
- Asset loader already loading campfire atlas in parallel

## Self-Check: PASSED

All 9 files verified present. Both task commits (87a576a, 26eadf1) verified in git log.

---
*Phase: 14-world-layout-reorganization*
*Completed: 2026-02-27*
