---
phase: 14-world-layout-reorganization
plan: 02
subsystem: ui
tags: [pixi.js, tilemap, campfire, world-layout, star-paths, ground-decorations]

# Dependency graph
requires:
  - phase: 14-01-grid-constants
    provides: "2x2 grid layout constants, building atlas, campfire sprite, asset loader"
provides:
  - "Star-pattern 1-tile-wide footpaths from campfire to each building"
  - "Ground decorations (rocks, flowers, grass tufts) scattered between buildings"
  - "Campfire sprite as central waypoint replacing guild hall building"
  - "2x2 grid building placement with interior-positioned labels"
  - "Agent idle/spawn/celebration routing to campfire position"
affects: [15-interior-art, 16-agent-stations]

# Tech tracking
tech-stack:
  added: []
  patterns: ["campfire waypoint replaces guild hall building", "star-pattern path routing", "seeded ground decorations"]

key-files:
  created: []
  modified:
    - "src/renderer/tilemap-builder.ts"
    - "src/renderer/building.ts"
    - "src/renderer/world.ts"

key-decisions:
  - "Paths narrowed to 1-tile-wide for footpath feel, radiating from campfire center"
  - "Campfire is a plain Sprite (not Building), idle positioning computed inline in World"
  - "Building labels positioned inside building sprite as interior sign/banner"
  - "3x3 dirt clearing at campfire center, doorstep clearings at path endpoints"

patterns-established:
  - "Campfire waypoint: Sprite-based center element with inline idle positioning"
  - "Ground decoration: seeded random scatter avoiding building bounding boxes"

requirements-completed: [LAYOUT-03]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 14 Plan 02: World Layout Wiring Summary

**Star-pattern footpaths, campfire waypoint sprite, 2x2 grid building placement with interior labels, and seeded ground decorations**

## Performance

- **Duration:** ~5 min (across checkpoint pause)
- **Started:** 2026-02-27T18:01:11Z
- **Completed:** 2026-02-27T18:05:34Z
- **Tasks:** 3 (2 code + 1 visual verification)
- **Files modified:** 3

## Accomplishments
- Tilemap updated with 1-tile-wide star-pattern paths from campfire to each building's bottom-center
- Ground decorations (rocks, flowers, grass tufts) scattered in grass areas, avoiding building bounding boxes
- Guild hall building replaced with campfire Sprite at world center
- Four workspace buildings placed at 2x2 grid positions filling most of the 1024x768 window
- Agent idle/spawn/celebration routing all target campfire position
- Building labels repositioned as interior signs rather than floating above
- User visually verified the complete layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Update tilemap for star-pattern paths and ground decorations** - `b5f8f3e` (feat)
2. **Task 2: Update Building class and World for campfire waypoint layout** - `0060f8f` (feat)
3. **Task 3: Visual verification of new world layout** - checkpoint approved, no commit (visual verification only)

## Files Created/Modified
- `src/renderer/tilemap-builder.ts` - Star-pattern 1-tile paths, 3x3 campfire clearing, doorstep clearings, seeded ground decorations
- `src/renderer/building.ts` - Label positioned inside building sprite, entrance/idle spacing updated for larger dimensions
- `src/renderer/world.ts` - Campfire Sprite replaces guild hall Building, 2x2 grid placement, inline idle positioning at campfire

## Decisions Made
- Paths narrowed to 1-tile-wide using single Bresenham cell (no expansion) for footpath feel
- Campfire implemented as plain PixiJS Sprite rather than Building class -- simpler since it has no label, work spots, or interior
- Idle positioning computed directly in World.ts rather than delegating to a Building method
- Building labels moved from above-sprite to inside-sprite positioning for integrated interior sign look
- Small 3x3 dirt clearing at campfire (down from 5x5 guild hall clearing) with 1x2 doorstep clearings at path endpoints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- World layout complete: 2x2 grid with campfire waypoint, paths, decorations
- Phase 14 fully done -- ready for Phase 15 (Workspace Interior Art)
- Building dimensions and positions stable for interior scene creation
- Agent routing to campfire working for idle, spawn, and celebration flows

## Self-Check: PASSED

All 3 modified files verified present. Both task commits (b5f8f3e, 0060f8f) verified in git log.

---
*Phase: 14-world-layout-reorganization*
*Completed: 2026-02-27*
