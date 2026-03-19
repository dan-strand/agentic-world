---
phase: 28-cpu-tick-loop
plan: 01
subsystem: rendering
tags: [pixi, particles, performance, idle-throttling, swap-and-pop]

# Dependency graph
requires:
  - phase: 27-gpu-rendering
    provides: "Stable rendering pipeline with cacheAsTexture"
provides:
  - "isIdle parameter on AmbientParticles.tick() and Building.tick()"
  - "O(1) swapRemove particle removal in ambient-particles.ts and building.ts"
  - "World.tick() computes and passes isIdle flag to particle subsystems"
affects: [28-cpu-tick-loop]

# Tech tracking
tech-stack:
  added: []
  patterns: [swap-and-pop removal, idle-aware tick gating, reverse-iteration invariant]

key-files:
  created: []
  modified:
    - src/renderer/ambient-particles.ts
    - src/renderer/building.ts
    - src/renderer/world.ts

key-decisions:
  - "Sparks gated behind !isIdle (imperceptible at 5fps, wastes CPU)"
  - "Chimney smoke uses isIdle early-return (entire subsystem skipped at idle)"
  - "Fireflies, dust, leaves left unconditional (too cheap to throttle, too visible to skip)"

patterns-established:
  - "swapRemove<T> helper: O(1) array removal for reverse-iteration particle loops"
  - "isIdle flag derived from app.ticker.maxFPS <= FPS_IDLE in World.tick()"

requirements-completed: [CPU-01, CPU-02]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 28 Plan 01: Idle-Aware Particle Throttling Summary

**Idle-gated spark/smoke particle ticks and O(1) swap-and-pop removal replacing Array.splice across all particle loops**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T01:52:41Z
- **Completed:** 2026-03-19T01:55:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Smoke and spark particle subsystems skip update logic at idle FPS (5fps), eliminating wasted CPU cycles
- All particle removal uses O(1) swap-and-pop instead of O(n) Array.splice
- Fireflies, dust motes, and leaves continue updating unconditionally (cheap + visually important)
- World.tick() derives isIdle from ticker.maxFPS and passes it through to all particle subsystems

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isIdle parameter and swap-and-pop to AmbientParticles and Building** - `d7ce882` (feat)
2. **Task 2: Pass isIdle flag from World tick to particle subsystems** - `ecdd699` (feat)

## Files Created/Modified
- `src/renderer/ambient-particles.ts` - Added swapRemove helper, isIdle param on tick, spark section gated behind !isIdle
- `src/renderer/building.ts` - Added swapRemove helper, isIdle param on tick, early-return for isIdle chimney smoke
- `src/renderer/world.ts` - Compute isIdle from ticker.maxFPS, pass to building.tick() and ambientParticles.tick()

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- isIdle flag is now available in the particle tick pipeline for future subsystems
- swap-and-pop pattern established for any new particle array removal
- Ready for 28-02 (agent tick consolidation) and 28-03 (further tick loop optimizations)

## Self-Check: PASSED

All 3 source files verified present. Both task commits (d7ce882, ecdd699) verified in git log. TypeScript compiles with zero errors. No splice calls remain in particle files.

---
*Phase: 28-cpu-tick-loop*
*Completed: 2026-03-19*
