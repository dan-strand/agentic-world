---
phase: 16-agent-stations-and-info-overlay
plan: 02
subsystem: agent-interior-behavior
tags: [agents, wander, stations, z-ordering, tool-overlay]

# Dependency graph
requires:
  - phase: 16-agent-stations-and-info-overlay
    plan: 01
    provides: "lastToolName IPC field, station coordinates, wander/scale constants"
provides:
  - "Agents positioned inside building interiors at themed stations with wander behavior"
  - "Z-ordered agent rendering within building containers"
  - "RPG-styled tool name overlay banner on each active building"
  - "Station assignment and reassignment on tool change"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Agent reparenting between global and building-local coordinate spaces", "Station occupancy tracking per building"]

key-files:
  created: []
  modified:
    - "src/renderer/agent.ts"
    - "src/renderer/building.ts"
    - "src/renderer/world.ts"

key-decisions:
  - "Agents reparented between agentsContainer (global) and building agentsLayer (local) for z-ordering"
  - "Coordinate conversion happens at reparent boundary: global-to-local on enter, local-to-global on exit"
  - "Tool name banner uses per-building theme colors with 0.85 alpha rounded rect background"
  - "hqPosition initialized on agent creation to prevent walk-to-origin bug after celebrations"

patterns-established:
  - "handleAgentReparenting() called per-agent in tick loop to detect state transitions requiring container switch"
  - "reparentAgentOut() for explicit reparenting before state changes (idle transition, fade-out)"

requirements-completed: [AGENT-01, AGENT-02, WORK-06]

# Metrics
duration: 8min
completed: 2026-02-27
---

# Phase 16 Plan 02: Agent Interior Behavior and Tool Name Overlay Summary

**Agents walk into building interiors, position at themed stations with wander behavior, are z-ordered within buildings, and tool name overlay banners display on each active workspace**

## Performance

- **Duration:** ~8 min (including checkpoint + bug fix)
- **Started:** 2026-02-27T21:24:00Z
- **Completed:** 2026-02-27T22:15:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- Agents walk from campfire into building interiors, positioned at themed stations (Enchanting Table, Target Dummy, etc.)
- Wander behavior: agents move ~40px around station center with walk/work animation switching
- 1.5x scale inside buildings for readability, normal scale outside
- Z-ordering via reparenting: agents render within building interiors, not floating on top
- Station assignment: random station, reassigns on tool change, freed on departure
- RPG-styled tool name banner at bottom of each active building (theme-colored background)
- Bug fix: hqPosition initialized on agent creation, preventing walk-to-origin after celebrations
- Bug fix: agents reparented out of buildings before fade-out for disappeared sessions

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent interior behavior with wander, scale, z-ordering, station management** - `e33e487` (feat)
2. **Task 2: Tool name overlay with RPG-styled banner** - `863c16d` (feat)
3. **Task 3: Visual verification + bug fix** - `b2cc9de` (fix)

## Files Created/Modified
- `src/renderer/agent.ts` - Added interiorMode, wander behavior, setInteriorMode(), interior walk speed, wander center initialization
- `src/renderer/building.ts` - Added agentsLayer Container, station occupancy tracking (assign/release/reassign), tool name banner with themed colors, work spot prop indicators
- `src/renderer/world.ts` - Agent reparenting system (handleAgentReparenting, reparentAgentOut), station assignment routing, tool label updates, hqPosition initialization, pre-fadeout reparenting

## Decisions Made
- Agents reparented between global agentsContainer and building agentsLayer for proper z-ordering
- Coordinate conversion at reparent boundary (global↔local) handles all position math
- Tool name banner uses building-specific theme colors (purple/brown/teal/amber) with 0.85 alpha
- hqPosition set on creation to campfire coords, preventing (0,0) walk-back after celebrations

## Deviations from Plan

- Added hqPosition initialization on agent creation (not in original plan, discovered during checkpoint testing)
- Added pre-fadeout reparenting for disappeared sessions (robustness fix discovered during testing)

## Issues Encountered
- Agents walked to top-left (0,0) instead of campfire after state transitions. Root cause: hqPosition defaulted to (0,0) and was never set for agents that went directly from creation to working. Fixed by initializing hqPosition to campfire position on agent creation.

## User Setup Required
None

## Next Phase Readiness
- Phase 16 is the final phase of v1.4 milestone
- All v1.4 requirements satisfied: workspace interiors, agent stations, tool overlay

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 16-agent-stations-and-info-overlay*
*Completed: 2026-02-27*
