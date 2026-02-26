---
phase: quick-4
plan: 01
subsystem: ui
tags: [pixi.js, rpg, buildings, work-spots, agent-movement]

# Dependency graph
requires:
  - phase: v1.1
    provides: Building class with atlas sprites and agent positioning methods
provides:
  - Named work spots per building type with RPG prop indicators
  - Agent spot rotation on activity change using updateActivity()
  - Deterministic initial spot assignment via session hash
affects: [building rendering, agent routing, world management]

# Tech tracking
tech-stack:
  added: []
  patterns: [named-spot-routing, prop-indicator-graphics]

key-files:
  created: []
  modified:
    - src/shared/constants.ts
    - src/renderer/building.ts
    - src/renderer/world.ts

key-decisions:
  - "Used modulo 3 rotation for spot cycling (simple, predictable, wraps naturally)"
  - "Prop indicators are static Graphics drawn once in constructor (no per-frame cost)"
  - "Guild hall has empty spots array (fallback to getWorkPosition for idle agents)"

patterns-established:
  - "WorkSpot pattern: named positions with visual indicators defined in constants, resolved in Building"
  - "Spot rotation pattern: increment index mod N on activity change, delegate to agent.updateActivity()"

requirements-completed: [QUICK-4]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Quick Task 4: Enhance Building Work Areas with RPG-themed Spots Summary

**Named RPG work spots per building with colored prop indicators and agent spot rotation on activity change**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T22:14:32Z
- **Completed:** 2026-02-26T22:16:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Defined 3 named work spots per building type (12 total across 4 quest zones) with RPG-themed names and colors
- Each building now renders small colored circle prop indicators at work spot positions as static decorations
- Agents receive deterministic initial spot assignment based on session hash for natural spread
- Activity changes trigger spot rotation -- agents walk between spots within the same building
- Wired up the previously dead-code `agent.updateActivity()` method from world.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Define work spots per building and add prop rendering** - `3a6d268` (feat)
2. **Task 2: Wire agent spot rotation on activity change in world.ts** - `a5e2741` (feat)

## Files Created/Modified
- `src/shared/constants.ts` - Added WorkSpot interface and BUILDING_WORK_SPOTS constant with 3 spots per building type
- `src/renderer/building.ts` - Added prop indicator Graphics drawing in constructor and getWorkSpot() method
- `src/renderer/world.ts` - Added agentSpotIndex tracking, deterministic spot assignment, spot rotation on activity change, replaced generic fanning with named spot routing

## Decisions Made
- Used modulo 3 rotation for spot cycling -- simple, predictable, wraps naturally around the 3 spots
- Prop indicators are small filled circles (3px radius) with darker outlines (4px radius) -- minimal visual footprint that marks spots without cluttering the scene
- Guild hall has empty spots array, falling back to getWorkPosition() for idle agent positioning
- Used hashSessionId % 3 for initial spot to spread agents across spots deterministically

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Steps
- Visual check: Start the app, observe small colored circles at each building's work area (3 per building)
- Visual check: When an agent's activity changes, agent walks to a different spot within its building

---
*Quick Task: 4-enhance-building-work-areas-with-rpg-the*
*Completed: 2026-02-26*
