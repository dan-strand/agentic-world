---
phase: 24-resource-leak-fixes
plan: 01
subsystem: renderer
tags: [pixi.js, graphics-pool, object-pooling, gpu-memory, particle-system, palette-swap, glow-filter]

# Dependency graph
requires:
  - phase: 23-crash-diagnosis
    provides: Memory monitoring infrastructure for leak detection
provides:
  - GraphicsPool utility class with borrow/return lifecycle
  - Pooled smoke particles in Building.tick()
  - Pooled spark particles in AmbientParticles.tick()
  - destroyCachedTextures() for palette swap cache cleanup
  - getSwapCacheSize() for monitoring cache growth
  - LevelUpEffect.cleanupFilters() for GlowFilter GPU resource release
  - Agent.cleanupLevelUpEffect() consolidated cleanup helper
  - Agent readonly characterClass and paletteIndex for external cleanup
affects: [24-02-PLAN, soak-testing, memory-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [object-pooling, borrow-return-lifecycle, explicit-gpu-resource-cleanup]

key-files:
  created:
    - src/renderer/graphics-pool.ts
    - src/renderer/graphics-pool.test.ts
    - src/renderer/palette-swap.test.ts
    - src/renderer/level-up-effect.test.ts
  modified:
    - src/renderer/building.ts
    - src/renderer/ambient-particles.ts
    - src/renderer/palette-swap.ts
    - src/renderer/level-up-effect.ts
    - src/renderer/agent.ts
    - src/renderer/world.ts

key-decisions:
  - "Pre-draw smoke/spark geometry once with fill alpha 1.0, use gfx.alpha for runtime fade (container-level alpha multiplies fill)"
  - "Exposed swapCache via _getSwapCacheForTesting() for direct cache manipulation in tests"
  - "LevelUpEffect.cleanupFilters uses Filter cast for type safety with PixiJS filter array"
  - "Agent cleanup saves characterClass/paletteIndex before destroy() since destroy invalidates the object"

patterns-established:
  - "GraphicsPool borrow/return: pre-allocate fixed pool, borrow returns visible gfx or null, return resets and hides"
  - "GPU resource cleanup order: cleanupFilters() before container.destroy({ children: true })"
  - "Palette swap cache lifecycle: destroyCachedTextures on agent removal when no other agent shares the combo"

requirements-completed: [LEAK-01, LEAK-02, LEAK-03]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 24 Plan 01: Resource Leak Fixes Summary

**GraphicsPool object pooling for particle systems, palette swap cache lifecycle with destroyCachedTextures, and explicit GlowFilter cleanup before container destruction**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T19:34:37Z
- **Completed:** 2026-03-16T19:39:39Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- GraphicsPool eliminates ~3,360 Graphics allocations/hour from smoke and spark particle churn
- Palette swap cache shrinks when agents are removed (destroyCachedTextures with source+texture destroy)
- GlowFilter GPU shader resources explicitly released before LevelUpEffect container destruction at both cleanup sites
- All 52 tests pass (27 renderer + 25 main) with zero regressions

## Task Commits

Each task was committed atomically (TDD: test -> feat):

1. **Task 1: Create GraphicsPool utility and refactor particle systems**
   - `dba05a9` (test) - Failing tests for GraphicsPool borrow/return lifecycle
   - `64c604d` (feat) - GraphicsPool implementation + Building/AmbientParticles refactors

2. **Task 2: Add palette swap cache lifecycle and GlowFilter cleanup**
   - `4884898` (test) - Failing tests for palette swap cache and GlowFilter cleanup
   - `e92d3e0` (feat) - destroyCachedTextures, cleanupFilters, agent property exposure, world cleanup

## Files Created/Modified
- `src/renderer/graphics-pool.ts` - GraphicsPool class with borrow/return lifecycle, pre-allocation, destroy
- `src/renderer/graphics-pool.test.ts` - 6 unit tests for pool borrow/return/exhaustion/reuse
- `src/renderer/building.ts` - Smoke particles use smokePool instead of new/destroy
- `src/renderer/ambient-particles.ts` - Spark particles use sparkPool instead of new/destroy
- `src/renderer/palette-swap.ts` - Added destroyCachedTextures, getSwapCacheSize, _getSwapCacheForTesting
- `src/renderer/palette-swap.test.ts` - 5 unit tests for cache lifecycle and cleanup isolation
- `src/renderer/level-up-effect.ts` - Added cleanupFilters() for explicit GlowFilter destruction
- `src/renderer/level-up-effect.test.ts` - 2 unit tests for filter cleanup pattern
- `src/renderer/agent.ts` - Readonly characterClass/paletteIndex, cleanupLevelUpEffect helper, both cleanup sites updated
- `src/renderer/world.ts` - removeAgent() cleans palette swap textures when no other agent shares combo

## Decisions Made
- Pre-draw smoke/spark geometry once with fill alpha 1.0, use gfx.alpha for runtime fade -- identical visual results since container alpha multiplies fill alpha
- Exposed swapCache via _getSwapCacheForTesting() for direct cache manipulation in unit tests (prefixed with underscore to signal test-only usage)
- LevelUpEffect.cleanupFilters uses Filter cast since PixiJS filters array types don't expose destroy() directly
- World.removeAgent() saves characterClass/paletteIndex to local vars before agent.destroy() since destroy invalidates the object

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three leak categories (LEAK-01, LEAK-02, LEAK-03) are fixed
- Ready for Plan 24-02 (soak test instrumentation and verification)
- GraphicsPool.activeCount and getSwapCacheSize() provide monitoring hooks for soak testing

## Self-Check: PASSED

All 5 created files found on disk. All 4 task commits verified in git log.

---
*Phase: 24-resource-leak-fixes*
*Completed: 2026-03-16*
