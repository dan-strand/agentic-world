---
phase: 24-resource-leak-fixes
plan: 02
subsystem: renderer
tags: [timer-modulo, collection-pruning, stream-cleanup, memory-leak, long-running-stability]

# Dependency graph
requires:
  - phase: 24-resource-leak-fixes
    provides: Plan 01 GPU resource fixes (GraphicsPool, palette swap, GlowFilter)
provides:
  - Timer modulo wrap on DayNightCycle.elapsed, 3 particle phase accumulators, Agent.breathTimer
  - pruneByAge utility for age-based Map pruning
  - dismissedSessions timestamp-based pruning (30 min max age, 5 min interval)
  - SessionDetector.pruneStaleEntries for mtimeCache and cwdCache
  - UsageAggregator.pruneStaleEntries for usage cache
  - readUsageTotals finally block with stream.destroy()
affects: [soak-testing, memory-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [modulo-wrap-bounded-timers, age-based-collection-pruning, optional-interface-method]

key-files:
  created:
    - src/renderer/day-night-cycle.test.ts
    - src/renderer/collection-pruning.test.ts
  modified:
    - src/renderer/day-night-cycle.ts
    - src/renderer/ambient-particles.ts
    - src/renderer/agent.ts
    - src/main/jsonl-reader.ts
    - src/main/jsonl-reader.test.ts
    - src/renderer/world.ts
    - src/main/session-detector.ts
    - src/main/session-store.ts
    - src/main/usage-aggregator.ts

key-decisions:
  - "pruneByAge exported as pure function from world.ts for testability (same pattern as Phase 23 checkTrend)"
  - "pruneStaleEntries added as optional method on SessionDetector interface to avoid runtime type assertion"
  - "dismissedSessions pruning runs every 5 min with 30 min max age to balance cleanup frequency vs overhead"

patterns-established:
  - "Modulo wrap pattern: accumulator = (accumulator + delta) % PERIOD for all bounded-cycle timers"
  - "Collection pruning pattern: pruneStaleEntries(activeIds) iterates cache and deletes non-active entries"
  - "Pure function export for testability: export domain logic as standalone functions testable without full class setup"

requirements-completed: [LEAK-04, STAB-01, STAB-02]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 24 Plan 02: Collection Pruning, Timer Modulo Wraps, and Stream Cleanup Summary

**Modulo wrap on 5 timer accumulators to prevent floating-point drift, age-based pruning for 4 collection caches, and finally-block stream cleanup in JSONL reader**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T19:42:40Z
- **Completed:** 2026-03-16T19:47:10Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- All 5 timer accumulators (DayNightCycle.elapsed, 3 particle phases, Agent.breathTimer) now wrap via modulo, preventing floating-point precision loss after hours of operation
- dismissedSessions converted from unbounded Set to timestamped Map with periodic age-based pruning (30 min max age)
- Session detector mtimeCache/cwdCache and UsageAggregator cache are pruned after each poll cycle for sessions no longer discovered
- readUsageTotals stream always destroyed in finally block, preventing file descriptor leaks on error paths
- Full test suite: 63 tests pass with zero regressions

## Task Commits

Each task was committed atomically (TDD: test -> feat):

1. **Task 1: Timer modulo wraps and stream cleanup**
   - `1e03d6a` (test) - Tests for DayNightCycle modulo wrap and jsonl-reader stream cleanup
   - `dc807ae` (feat) - Modulo wraps on all 5 accumulators, finally block in readUsageTotals

2. **Task 2: Collection pruning for dismissedSessions, detector caches, and usage cache**
   - `6d5269e` (test) - Failing tests for pruneByAge utility function
   - `2021688` (feat) - pruneByAge, dismissedSessions Map conversion, detector/aggregator cache pruning

## Files Created/Modified
- `src/renderer/day-night-cycle.ts` - Modulo wrap in tick(), simplified getProgress()
- `src/renderer/day-night-cycle.test.ts` - 5 unit tests for elapsed bounding and progress correctness
- `src/renderer/ambient-particles.ts` - Modulo wrap on firefly, dust mote, and leaf phase accumulators
- `src/renderer/agent.ts` - Modulo wrap on breathTimer accumulator
- `src/main/jsonl-reader.ts` - Finally block with stream.destroy() in readUsageTotals
- `src/main/jsonl-reader.test.ts` - 2 additional tests for stream cleanup on success and error paths
- `src/renderer/world.ts` - pruneByAge export, dismissedSessions Map conversion, pruneDismissedSessions method
- `src/renderer/collection-pruning.test.ts` - 4 unit tests for pruneByAge utility
- `src/main/session-detector.ts` - pruneStaleEntries on interface and FilesystemSessionDetector implementation
- `src/main/session-store.ts` - Calls detector.pruneStaleEntries and usageAggregator.pruneStaleEntries after poll
- `src/main/usage-aggregator.ts` - pruneStaleEntries method for cache cleanup

## Decisions Made
- Exported pruneByAge as a pure function from world.ts for testability, following the same pattern as Phase 23's checkTrend extraction
- Added pruneStaleEntries as an optional method on SessionDetector interface (with `?.` call syntax) to avoid runtime type assertion or casting
- Set dismissedSessions pruning interval to 5 minutes with 30 min max age -- balances cleanup frequency against unnecessary iteration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 requirements (LEAK-01 through LEAK-04, STAB-01, STAB-02) are now complete across Plans 01 and 02
- Phase 24 resource leak fixes are fully implemented
- Ready for Phase 25 or soak testing to verify long-running stability

## Self-Check: PASSED

All 11 modified/created files found on disk. All 4 task commits verified in git log.

---
*Phase: 24-resource-leak-fixes*
*Completed: 2026-03-16*
