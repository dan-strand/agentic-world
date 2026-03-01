---
phase: 17-window-layout-and-parsing-infrastructure
plan: 02
subsystem: parsing
tags: [jsonl, streaming, readline, mtime-cache, token-usage, node-test]

# Dependency graph
requires: []
provides:
  - readUsageTotals async streaming JSONL parser
  - TokenUsageTotals interface for parsed usage data
  - TokenUsage and SessionUsage interfaces in shared types
  - UsageAggregator class with mtime-based caching
affects: [18-usage-dashboard-ui, 19-daily-persistence]

# Tech tracking
tech-stack:
  added: [node:test, node:assert/strict]
  patterns: [streaming-readline-parsing, mtime-cache-invalidation]

key-files:
  created:
    - src/main/usage-aggregator.ts
    - src/main/usage-aggregator.test.ts
    - src/main/jsonl-reader.test.ts
  modified:
    - src/shared/types.ts
    - src/main/jsonl-reader.ts

key-decisions:
  - "Used node:test and node:assert/strict (Node 22 built-in) instead of installing Jest or Vitest"
  - "readUsageTotals uses fs.createReadStream + readline.createInterface for non-blocking streaming"
  - "UsageAggregator caches by sessionId with mtimeMs comparison, mirroring session-detector pattern"

patterns-established:
  - "Streaming JSONL parsing: readline.createInterface + fs.createReadStream with crlfDelay: Infinity"
  - "Test pattern: node:test + node:assert/strict with tmpdir temp files and after() cleanup"
  - "Usage cache invalidation: Map<sessionId, { mtimeMs, totals }> with statSync check"

requirements-completed: [PARSE-01, PARSE-02, PARSE-03]

# Metrics
duration: 3min
completed: 2026-03-01
---

# Phase 17 Plan 02: JSONL Usage Parser Summary

**Streaming JSONL usage parser with readline and mtime-cached UsageAggregator using node:test for TDD**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T18:27:37Z
- **Completed:** 2026-03-01T18:30:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- readUsageTotals() streams JSONL files via readline, extracting all four token fields from message.usage on assistant entries
- UsageAggregator class caches parsed results by sessionId, only re-parsing when file mtime changes
- 14 total tests (8 reader + 6 aggregator) covering edge cases: empty files, malformed lines, missing fields, cache invalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add types and implement readUsageTotals with streaming readline** - `332aba4` (feat)
2. **Task 2: Create UsageAggregator with mtime-based caching** - `96bcdee` (feat)

_Note: TDD tasks followed RED-GREEN pattern (tests written first, then implementation)_

## Files Created/Modified
- `src/shared/types.ts` - Added TokenUsage and SessionUsage interfaces
- `src/main/jsonl-reader.ts` - Added readline import, TokenUsageTotals interface, readUsageTotals async function
- `src/main/jsonl-reader.test.ts` - 8 test cases for readUsageTotals using node:test
- `src/main/usage-aggregator.ts` - UsageAggregator class with mtime cache
- `src/main/usage-aggregator.test.ts` - 6 test cases for UsageAggregator using node:test

## Decisions Made
- Used Node.js built-in node:test and node:assert/strict instead of installing Jest or Vitest -- zero dependencies added, works with npx tsx --test
- readUsageTotals wraps createReadStream in try/catch so nonexistent files return zero totals instead of throwing
- UsageAggregator uses synchronous statSync for mtime check (fast, single syscall) but async readUsageTotals for the heavy parse

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- readUsageTotals and UsageAggregator are ready for Phase 18 to wire into the dashboard UI
- TokenUsage and SessionUsage types available in shared/types.ts for renderer-side usage display
- All existing jsonl-reader functions (readLastJsonlLine, readLastToolUse) remain unchanged

## Self-Check: PASSED

- All 6 files verified present on disk
- Both task commits (332aba4, 96bcdee) verified in git log
- TypeScript compiles with zero errors (npx tsc --noEmit)
- All 14 tests pass (8 jsonl-reader + 6 usage-aggregator)

---
*Phase: 17-window-layout-and-parsing-infrastructure*
*Completed: 2026-03-01*
