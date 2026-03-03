---
phase: 20-world-and-building-art
plan: 02
subsystem: renderer
tags: [pixel-art, buildings, particles, sprite-atlas, pngjs]

# Dependency graph
requires:
  - phase: 15-detailed-interiors
    provides: "Building interior art in generate-buildings.js"
provides:
  - "Enhanced building atlas with exterior roof, chimney, sign, window, doorstep details"
  - "Chimney smoke particle system in Building class"
  - "CHIMNEY_SMOKE_* constants and CHIMNEY_POSITIONS in constants.ts"
affects: [20-world-and-building-art]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Alpha-blending utility for glow effects in sprite generation", "Per-building exterior detail overlay pattern"]

key-files:
  created: []
  modified:
    - scripts/generate-buildings.js
    - assets/sprites/buildings.png
    - src/renderer/building.ts
    - src/shared/constants.ts

key-decisions:
  - "Exterior details drawn as overlay functions after interior art to preserve existing art"
  - "Chimney positions calculated from atlas coordinates and building anchor offset"
  - "Alpha-blend utility added for proper glow compositing on existing pixels"

patterns-established:
  - "Exterior detail overlay: separate functions called after interior draw functions"
  - "Smoke particle lifecycle: spawn, drift, grow, fade, self-remove with Graphics objects"

requirements-completed: [BLDG-01, BLDG-02, BLDG-03, BLDG-04]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 20 Plan 02: Building Exterior Details Summary

**Enhanced 4 building sprites with roof shingles, chimneys, hanging signs, glowing windows, themed doorsteps, and per-building surroundings; added runtime chimney smoke particle system**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T13:08:04Z
- **Completed:** 2026-03-03T13:12:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All 4 building sprites enhanced with roof edge shingle detail, chimney protrusions with brick mortar, hanging signs near entrances, warm glowing windows with halos on side walls, and doorstep welcome mats with flanking torches
- Per-building unique exterior elements: wizard tower rune circles + herb garden, training grounds weapon rack + sand circle, ancient library potted plants + sundial, tavern barrels/crates + bench (tavern gets larger chimney)
- Building class now has a tick(deltaMs) method that manages a chimney smoke particle system: spawns gray puffs at chimney position, drifts upward/horizontally, grows in radius, fades alpha to 0, and self-removes after 3 seconds

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance building atlas with exterior details** - `6c3f4ff` (feat)
2. **Task 2: Add chimney smoke particle effect to buildings** - `5a24f20` (feat)

## Files Created/Modified
- `scripts/generate-buildings.js` - Added blendPixel utility, drawRoofEdge, drawChimney, drawHangingSign, drawGlowingWindows, drawDoorstep shared functions; 4 per-building exterior detail functions (466 lines added, now 2265 total)
- `assets/sprites/buildings.png` - Regenerated 1856x336 atlas with all exterior enhancements
- `src/renderer/building.ts` - Added SmokeParticle interface, smoke fields, smokeContainer child, public tick() method for chimney smoke lifecycle
- `src/shared/constants.ts` - Added CHIMNEY_SMOKE_* particle constants and CHIMNEY_POSITIONS record with per-building offsets

## Decisions Made
- Exterior detail functions are drawn as overlays after interior art functions, ensuring existing interiors remain untouched
- Added blendPixel() alpha-compositing function for proper glow effects over existing pixel content
- Chimney positions in constants.ts derived from actual atlas drawing coordinates (e.g., wizard tower chimney at x=130 in atlas maps to x=-102 relative to building center)
- Tavern chimney is 4px taller than other buildings (the tavern is always cooking)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Building exteriors complete and atlas regenerated
- Smoke particle tick() method ready; needs wiring in world.ts tick loop (Plan 20-03)
- All CHIMNEY_SMOKE_* constants available for tuning if needed

## Self-Check: PASSED

All files verified present: scripts/generate-buildings.js, assets/sprites/buildings.png, src/renderer/building.ts, src/shared/constants.ts. Both commits found: 6c3f4ff, 5a24f20. Atlas dimensions 1856x336 confirmed. TypeScript compilation clean. CHIMNEY_SMOKE_* constants present. Building.tick() method present with smoke lifecycle.

---
*Phase: 20-world-and-building-art*
*Completed: 2026-03-03*
