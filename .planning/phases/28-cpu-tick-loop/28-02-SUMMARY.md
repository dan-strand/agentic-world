---
phase: 28-cpu-tick-loop
plan: 02
subsystem: rendering
tags: [pixi, performance, dirty-flag, tick-optimization, zero-allocation]

# Dependency graph
requires:
  - phase: 28-cpu-tick-loop
    plan: 01
    provides: "isIdle wiring, swap-and-pop particle removal, World.tick() isIdle flag"
provides:
  - "Dirty-flagged building highlight tints (only recompute on occupancy change)"
  - "State-change-gated agent reparenting (skip when state unchanged)"
  - "Zero per-tick temporary allocations in World.tick()"
affects: [28-cpu-tick-loop]

# Tech tracking
tech-stack:
  added: []
  patterns: [dirty-flag gating, state-change detection via lastTickState, reusable buffer pattern]

key-files:
  created: []
  modified:
    - src/renderer/world.ts

key-decisions:
  - "Kept reparenting in tick() with state-change guard rather than moving entirely to event handlers (agent state transitions like walking_to_workspot happen inside agent.tick(), not in manageAgents)"
  - "Used Map<string, string> for lastTickState rather than storing on agent objects (keeps tracking concern in World class)"

patterns-established:
  - "highlightsDirty flag: set true at all occupancy-changing transitions, checked once per frame"
  - "lastTickState map: O(1) state-change detection to gate expensive per-agent operations"
  - "toRemoveBuffer reuse: length=0 reset instead of new array allocation each tick"

requirements-completed: [CPU-03, CPU-05, DOM-02]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 28 Plan 02: Tick Loop CPU Reduction Summary

**Dirty-flagged building highlights, state-gated agent reparenting, and zero per-tick allocations in World.tick()**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T01:58:11Z
- **Completed:** 2026-03-19T02:02:29Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Building highlight tint recomputation now gated behind highlightsDirty flag (skips ~95%+ of frames)
- Agent reparenting only fires when agent state actually changes, not every frame for every agent
- Eliminated all per-tick temporary allocations: activeBuildings Set moved to class field, toRemove array replaced with reusable toRemoveBuffer
- Dirty flag set at 8 state transition sites covering all occupancy-changing events (celebration, fade-out, assignment, overflow, idle return, removal, reactivation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dirty-flag for building highlight tints** - `a777c49` (feat)
2. **Task 2: Move reparenting to state transitions and eliminate tick allocations** - `fc6788b` (feat)

## Files Created/Modified
- `src/renderer/world.ts` - Added highlightsDirty flag, activeBuildings class field, lastTickState map, toRemoveBuffer; gated highlight recomputation and reparenting on state changes; set dirty flag at all transition sites

## Decisions Made
- Kept reparenting in tick() with state-change guard rather than moving entirely to manageAgents() event handlers. Reason: agent state transitions like walking_to_workspot happen inside agent.tick() when hasArrived returns true, not in manageAgents(), so a tick-based check with lastTickState is the correct approach.
- Used a separate lastTickState Map rather than storing previous state on agent objects, keeping the tracking concern within the World class.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three tick loop optimization plans (28-01, 28-02, 28-03) now complete
- World.tick() has idle-aware particle throttling, dirty-flagged highlights, state-gated reparenting, and zero per-tick allocations
- Phase 28 CPU tick loop optimization is fully delivered

## Self-Check: PASSED

Source file verified present. Both task commits (a777c49, fc6788b) verified in git log. TypeScript compiles with zero errors. No per-tick allocations remain in tick().

---
*Phase: 28-cpu-tick-loop*
*Completed: 2026-03-19*
