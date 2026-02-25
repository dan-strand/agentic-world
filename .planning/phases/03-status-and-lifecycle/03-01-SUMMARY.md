---
phase: 03-status-and-lifecycle
plan: 01
subsystem: renderer
tags: [pixi.js, animation, particle-effects, tint, status-visuals]

# Dependency graph
requires:
  - phase: 02-visual-world
    provides: Agent class with state machine, GraphicsContext animation, PixiJS Container hierarchy
provides:
  - STATUS_TINTS and STATUS_ANIM_SPEED constants keyed by SessionStatus
  - lerpColor per-channel color interpolation utility
  - Firework particle constants and timing constants
  - Agent.applyStatusVisuals() method for tint crossfade, breathing, shake
  - Agent.startCelebration() method with Fireworks child container
  - Fireworks particle class with gravity, fade, multi-color burst
  - celebrating AgentState with auto-cleanup and transition to walking_to_entrance
affects: [03-status-and-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns: [Container.tint crossfade via lerpColor, sinusoidal breathing alpha, damped shake, Graphics-based particle system]

key-files:
  created:
    - src/renderer/fireworks.ts
  modified:
    - src/shared/constants.ts
    - src/renderer/agent.ts

key-decisions:
  - "Container.tint for status coloring (not ColorMatrixFilter) -- inherited by all children in PixiJS 8"
  - "Plain Graphics sparks for fireworks (not @pixi/particle-emitter) -- stable PixiJS 8 support"
  - "Celebration guards on assignToCompound/assignToHQ to prevent interruption during 2.5s fireworks"

patterns-established:
  - "Status visual pipeline: World debounces -> agent.applyStatusVisuals() -> tick updates tint/breathing/shake"
  - "Particle effects as Container children: create on start, tick in parent, removeChild+destroy on completion"

requirements-completed: [STATUS-01, STATUS-02]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 03 Plan 01: Status Visuals and Fireworks Summary

**Per-agent status visual differentiation (tint, breathing, shake, animation speed) and self-contained Fireworks particle burst class**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T20:28:55Z
- **Completed:** 2026-02-25T20:32:24Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Extended constants.ts with STATUS_TINTS, STATUS_ANIM_SPEED, timing constants, firework constants, and lerpColor utility
- Extended Agent class with 7-state machine (added celebrating), applyStatusVisuals method, tint crossfade, breathing alpha oscillation, error shake, and animation speed modulation
- Created Fireworks particle class with 25-35 Graphics sparks, multi-color palette, gravity physics, and alpha fade

## Task Commits

Each task was committed atomically:

1. **Task 1: Add status constants, firework constants, and lerpColor utility** - `410c82b` (feat)
2. **Task 3: Create Fireworks particle class** - `2971134` (feat)
3. **Task 2: Extend Agent class with status visuals and celebrating state** - `ac56745` (feat)

_Note: Task 3 was executed before Task 2 because agent.ts imports from fireworks.ts_

## Files Created/Modified
- `src/shared/constants.ts` - Added STATUS_TINTS, STATUS_ANIM_SPEED, timing/firework constants, lerpColor function
- `src/renderer/agent.ts` - Extended with status visual methods, celebrating state, Fireworks integration, celebration guards
- `src/renderer/fireworks.ts` - New self-contained particle burst class extending PixiJS Container

## Decisions Made
- Executed Task 3 (fireworks.ts) before Task 2 (agent.ts) since agent.ts imports from fireworks.ts -- ensures clean compilation at each commit
- Used `Record<SessionStatus, number>` typing for STATUS_TINTS and STATUS_ANIM_SPEED for type safety
- Placed status visual methods in their own section between Animation and Public API for clear code organization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Agent class ready to receive applyStatusVisuals() calls from World after debouncing
- Fireworks class ready to be instantiated via startCelebration() by World's lifecycle manager
- Plan 02 will wire these into World for status debouncing, completion detection, and lifecycle triggering

## Self-Check: PASSED

All 3 source files exist. All 3 task commits verified. TypeScript compiles cleanly.

---
*Phase: 03-status-and-lifecycle*
*Completed: 2026-02-25*
