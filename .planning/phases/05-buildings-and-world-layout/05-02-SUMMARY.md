---
phase: 05-buildings-and-world-layout
plan: 02
subsystem: world
tags: [pixi.js, buildings, world-layout, agent-routing, guild-hall]

# Dependency graph
requires:
  - phase: 05-buildings-and-world-layout
    provides: "Building atlas PNG, buildingTextures map, BuildingType/ACTIVITY_BUILDING/BUILDING_LABELS constants"
provides:
  - "Building class wrapping Sprite + BitmapText label + agent positioning methods"
  - "Refactored World with 5 static buildings replacing dynamic compound system"
  - "Activity-based agent routing (agents go to buildings by activity type, not project)"
  - "Guild Hall idle fan-out replacing HQ pentagon"
affects: [06-agent-sprite-overhaul, world-scene, agent-routing]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Static building instances replacing dynamic compound lifecycle", "Activity-type routing instead of project-based compound assignment"]

key-files:
  created:
    - src/renderer/building.ts
  modified:
    - src/renderer/world.ts

key-decisions:
  - "Building class uses Sprite anchor (0.5, 1.0) for bottom-center ground placement with BitmapText label above"
  - "Agent routing via ACTIVITY_BUILDING map -- activity type determines building, not project name"
  - "Reused assignToCompound() method name unchanged -- rename deferred to Phase 6"

patterns-established:
  - "Static buildings at fixed positions -- no lifecycle management, always visible at alpha 1.0"
  - "Local-coordinate positioning in Building, global conversion in World"

requirements-completed: [THEME-02, THEME-03]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 5 Plan 2: Buildings and World Layout Summary

**Building class with Sprite+label rendering and refactored World replacing dynamic compounds with 5 static Fantasy RPG buildings routed by activity type**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T14:22:00Z
- **Completed:** 2026-02-26T14:25:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created Building class wrapping PixiJS Sprite from atlas with BitmapText label and agent positioning (idle fan-out, work position, entrance)
- Replaced entire dynamic compound lifecycle in world.ts with 5 static Building instances at fixed positions
- Agents now route to quest zone buildings by activity type (coding -> Wizard Tower, testing -> Training Grounds, etc.) and return to Guild Hall when idle
- Removed all imports of HQ, Compound, CompoundLayout from world.ts -- spy-themed compound system fully replaced

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Building class and refactor world.ts** - `91538c8` (feat)
2. **Task 2: Visual verification of buildings and agent routing** - checkpoint:human-verify (approved, no code commit)

## Files Created/Modified
- `src/renderer/building.ts` - Building Container class with Sprite, BitmapText label, and agent positioning methods (idle fan-out, work position, entrance)
- `src/renderer/world.ts` - Refactored to replace HQ/Compound/CompoundLayout with 5 static Building instances, activity-based agent routing

## Decisions Made
- Building class uses Sprite anchor at (0.5, 1.0) for bottom-center ground placement, with BitmapText label positioned above the building
- Agent routing uses ACTIVITY_BUILDING constant map -- activity type determines target building instead of project-to-compound assignment
- Kept assignToCompound() method name unchanged in agent.ts -- method accepts {x,y} positions regardless of name, renaming deferred to Phase 6

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 complete: all buildings rendered and agent routing working
- Phase 6 can proceed with agent sprite overhaul -- buildings provide stable positioning targets
- Agent state names ('driving_to_compound', etc.) and assignToCompound() method name remain from v1.0 -- Phase 6 will rename these

## Self-Check: PASSED

- FOUND: src/renderer/building.ts
- FOUND: src/renderer/world.ts
- FOUND: Commit 91538c8 (Task 1)

---
*Phase: 05-buildings-and-world-layout*
*Completed: 2026-02-26*
