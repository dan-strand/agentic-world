---
phase: 11-status-and-visibility-audit
plan: 01
subsystem: session-detection
tags: [session-status, jsonl, stale-filter, status-lifecycle]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: session-detector filesystem scanning and status determination
provides:
  - correct system entry status mapping (waiting instead of idle in 5-30s window)
  - stale session filter that preserves waiting/active sessions past 30-minute threshold
  - clean constants with dead JSONL_TOOL_BUFFER_SIZE removed
affects: [12-audio-triggers, 13-global-signals]

# Tech tracking
tech-stack:
  added: []
  patterns: [cache-aware stale filter preserving waiting sessions]

key-files:
  created: []
  modified:
    - src/main/session-detector.ts
    - src/shared/constants.ts

key-decisions:
  - "Stale filter checks mtimeCache for last known status before filtering -- sessions with waiting/active status are preserved with waiting status"
  - "System JSONL entries follow same pattern as assistant entries: recent = active, then waiting, then idle via threshold guard"

patterns-established:
  - "Status flow for completed tasks: system entry -> active (0-5s) -> waiting (5-30s) -> idle (30s+)"
  - "Stale session preservation: cache-based status check before filtering prevents premature removal of waiting sessions"

requirements-completed: [STATUS-01, VIS-02, VIS-03]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 11 Plan 01: Status & Visibility Audit Summary

**Fixed system entry status to report waiting instead of idle, and preserved waiting sessions past stale threshold to prevent premature agent disappearance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T00:22:42Z
- **Completed:** 2026-02-27T00:24:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- System JSONL entries now correctly report `waiting` status in the 5-30 second window after task completion, instead of incorrectly reporting `idle`
- Sessions genuinely waiting for user input survive past the 30-minute stale threshold instead of being filtered out and disappearing
- Removed dead `JSONL_TOOL_BUFFER_SIZE` constant that created confusion about which buffer size is used for JSONL reading

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix system entry status determination and stale session filter** - `4e17709` (fix)
2. **Task 2: Remove dead JSONL_TOOL_BUFFER_SIZE constant** - `8b06c2d` (chore)

## Files Created/Modified
- `src/main/session-detector.ts` - Fixed `determineStatus()` system case to return `waiting` instead of `idle`; stale filter now preserves sessions with cached waiting/active status
- `src/shared/constants.ts` - Removed dead `JSONL_TOOL_BUFFER_SIZE` constant (8KB, never imported)

## Decisions Made
- Stale filter checks the existing `mtimeCache` for last known status before deciding to filter a session -- this reuses existing infrastructure without adding new state
- System entries follow the same conceptual pattern as assistant entries: recent activity = active, then transitions to waiting for user input, then idle via the threshold guard at the top of `determineStatus()`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Status detection is now reliable for all entry types (system, assistant, user, progress)
- Stale session handling preserves waiting agents, enabling accurate "all sessions waiting" detection needed for Phase 12 (audio triggers) and Phase 13 (global signals)
- Tool detection fallback to `coding` activity remains unchanged for active/waiting sessions

## Self-Check: PASSED

- [x] src/main/session-detector.ts exists
- [x] src/shared/constants.ts exists
- [x] 11-01-SUMMARY.md exists
- [x] Commit 4e17709 exists
- [x] Commit 8b06c2d exists

---
*Phase: 11-status-and-visibility-audit*
*Completed: 2026-02-27*
