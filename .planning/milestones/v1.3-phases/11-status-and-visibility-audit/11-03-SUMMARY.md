---
phase: 11-status-and-visibility-audit
plan: 03
subsystem: session-detection, renderer
tags: [session-status, tool-use, completion-detection, celebration, defense-in-depth]

# Dependency graph
requires:
  - phase: 11-status-and-visibility-audit
    provides: "Reliable status determination (11-01), hardened renderer pipeline (11-02)"
provides:
  - "tool_use-aware status determination preventing false waiting during tool execution"
  - "system entry validation as second gate for completion detection"
  - "defense-in-depth against false job's done celebrations"
affects: [12-audio-triggers, 13-global-signals]

# Tech tracking
tech-stack:
  added: []
  patterns: ["tool_use content inspection for assistant JSONL entries", "dual-gate completion detection (status transition + entry type validation)"]

key-files:
  created: []
  modified:
    - src/main/session-detector.ts
    - src/renderer/world.ts

key-decisions:
  - "Detect tool_use by inspecting message.content array in assistant JSONL entries rather than adding a separate entry type"
  - "Cache hasToolUse flag in mtimeCache so repeated polls with unchanged mtime still correctly report active"
  - "Require lastEntryType === 'system' as second gate for completion detection, providing defense-in-depth"

patterns-established:
  - "JSONL content inspection: look beyond entry type to message.content for finer-grained status determination"
  - "Dual-gate completion: require both status transition AND entry type validation before triggering effects"

requirements-completed: [STATUS-01]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 11 Plan 03: False Job's Done Gap Closure Summary

**Fixed false celebration during tool execution via tool_use-aware status detection and system entry completion validation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T03:33:39Z
- **Completed:** 2026-02-27T03:35:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Sessions with assistant(tool_use) entries now correctly stay `active` during tool execution regardless of mtime age, preventing false active->waiting transitions
- Completion detection (checkForCompletion) now requires `lastEntryType === 'system'` as a second gate beyond the active->waiting transition, blocking false celebrations from any remaining edge cases
- Defense-in-depth: Bug 1 fix prevents the false status transition, Bug 2 fix adds system entry validation -- both must fail for a false celebration to occur

## Task Commits

Each task was committed atomically:

1. **Task 1: Detect tool_use in assistant entries and keep status as active during tool execution** - `7265633` (fix)
2. **Task 2: Harden completion detection to require system entry type as definitive completion signal** - `34a1a82` (fix)

## Files Created/Modified
- `src/main/session-detector.ts` - Added `hasToolUseContent()` helper, updated `determineStatus()` to accept and use `hasToolUse` parameter, cached `hasToolUse` in mtimeCache
- `src/renderer/world.ts` - Added `lastEntryType` tracking Map, updated `checkForCompletion()` to require system entry type, added cleanup in removeAgent() and stale session loop

## Decisions Made
- Detect tool_use by inspecting `message.content` array in assistant JSONL entries rather than adding a separate entry type -- this uses the existing JSONL structure without schema changes
- Cache `hasToolUse` flag in mtimeCache so repeated polls during tool execution (unchanged mtime) still correctly report active
- Require `lastEntryType === 'system'` as second gate for completion detection -- system entries (turn_duration) are only written at true turn boundaries, providing a definitive completion signal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Status detection is now fully reliable for all scenarios including tool execution gaps
- Completion detection is hardened with dual-gate validation
- Ready for Phase 12 (Audio Triggers) which depends on accurate completion detection for sound cues
- Ready for Phase 13 (Global Signals) which depends on reliable per-session status for all-waiting detection

## Self-Check: PASSED

- [x] src/main/session-detector.ts exists
- [x] src/renderer/world.ts exists
- [x] 11-03-SUMMARY.md exists
- [x] Commit 7265633 exists
- [x] Commit 34a1a82 exists

---
*Phase: 11-status-and-visibility-audit*
*Completed: 2026-02-27*
