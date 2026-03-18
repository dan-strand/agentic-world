---
phase: 26-io-pipeline
plan: 02
subsystem: io
tags: [incremental-parse, jsonl, byte-offset, async-stat, node-test]

# Dependency graph
requires:
  - phase: 26-01
    provides: "Async fs.promises foundation, readSessionTail, readUsageTotals"
provides:
  - "readUsageTotalsIncremental: offset-based delta reads for JSONL token usage"
  - "UsageAggregator incremental cache with byteOffset and ino fields"
  - "Truncation detection (stat.size < cached.byteOffset) for full re-parse fallback"
  - "Inode change detection for file replacement safety"
affects: [26-io-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["incremental byte-offset parsing with first-line discard for partial line safety", "backup-1-byte on resume to handle line boundary alignment"]

key-files:
  created: []
  modified:
    - src/main/jsonl-reader.ts
    - src/main/jsonl-reader.test.ts
    - src/main/usage-aggregator.ts
    - src/main/usage-aggregator.test.ts

key-decisions:
  - "Back up 1 byte on non-zero offset to safely discard partial first line rather than losing the first complete line at the boundary"
  - "Windows ino=0 fallback: skip inode comparison when both ino values are 0 (Windows stat does not reliably provide inode numbers)"

patterns-established:
  - "Incremental stream read: createReadStream with start offset + readline for delta-only JSONL parsing"
  - "Cache shape extension: byteOffset + ino alongside existing mtimeMs + totals for incremental/safety tracking"

requirements-completed: [IO-03]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 26 Plan 02: Incremental JSONL Parsing Summary

**Offset-based incremental JSONL parsing reducing per-poll I/O from O(file_size) to O(delta) with truncation and inode safety fallbacks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T22:37:04Z
- **Completed:** 2026-03-18T22:42:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added readUsageTotalsIncremental function that reads only newly-appended bytes from JSONL files using byte-offset-based createReadStream, reducing per-poll I/O from O(file_size) to O(delta)
- Extended UsageAggregator cache with byteOffset and ino fields for incremental parsing with truncation and inode-change safety fallbacks
- Replaced synchronous fs.statSync with async fsp.stat in UsageAggregator, eliminating main process event loop blocking during stat calls
- Added 9 new tests (6 for readUsageTotalsIncremental, 3 for UsageAggregator incremental behavior) with zero regressions on 23 existing tests

## Task Commits

Each task was committed atomically:

1. **Task 1: readUsageTotalsIncremental + tests (TDD RED)** - `d85637e` (test)
2. **Task 1: readUsageTotalsIncremental + tests (TDD GREEN)** - `b299e5e` (feat)
3. **Task 2: UsageAggregator incremental cache + truncation/inode detection** - `084ab55` (feat)

_Note: Task 1 used TDD with separate RED/GREEN commits_

## Files Created/Modified
- `src/main/jsonl-reader.ts` - Added readUsageTotalsIncremental function with byte-offset createReadStream, partial first-line discard, and error-safe fallback
- `src/main/jsonl-reader.test.ts` - Added 6 incremental tests: offset-0 equivalence, mid-file append, partial line discard, nonexistent file, non-assistant skip, newOffset verification
- `src/main/usage-aggregator.ts` - Extended cache shape with byteOffset/ino, rewrote getUsage with incremental vs full-reparse branching, replaced statSync with async fsp.stat
- `src/main/usage-aggregator.test.ts` - Added 3 tests: incremental append accumulation, truncation full re-parse, byteOffset storage verification

## Decisions Made
- Backed up 1 byte on non-zero offset reads to properly handle line boundaries -- the plan's original "discard first line at fromOffset" would lose the first complete new entry when offset is at a line boundary (which is the normal case after storing stat.size)
- Skipped inode comparison when both ino values are 0, accommodating Windows where fs.stat does not reliably provide inode numbers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed offset-1 boundary alignment for first-line discard**
- **Found during:** Task 1 (readUsageTotalsIncremental implementation)
- **Issue:** Plan specified discarding first line at fromOffset, but when offset equals previous stat.size (the normal case), the first byte read is the start of a complete new line. Discarding it loses data.
- **Fix:** Back up 1 byte (streamStart = fromOffset - 1) so readline's first yielded line is the tail of the previous data or an empty string from the trailing newline, which gets safely discarded.
- **Files modified:** src/main/jsonl-reader.ts
- **Verification:** All 6 incremental tests pass including mid-file append accumulation test
- **Committed in:** b299e5e (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for data correctness -- without the 1-byte backup, every incremental read would lose the first new entry. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Incremental JSONL parsing foundation is complete
- Plan 03 can build on this for additional I/O pipeline optimizations
- No blockers or concerns

## Self-Check: PASSED

All 4 files verified present. All 3 commits verified in git log.

---
*Phase: 26-io-pipeline*
*Completed: 2026-03-18*
