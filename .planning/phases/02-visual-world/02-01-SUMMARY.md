---
phase: 02-visual-world
plan: 01
subsystem: types, detection
tags: [typescript, jsonl, activity-detection, agent-identity, deterministic-hash]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "SessionInfo, jsonl-reader, session-detector, constants"
provides:
  - "ActivityType, AgentSlot, VehicleType, AccessoryType types"
  - "AGENT_COLORS 8-color palette, TOOL_TO_ACTIVITY mapping"
  - "getAgentSlot deterministic identity assignment"
  - "readLastToolUse JSONL tool_use extraction"
  - "activityType field on SessionInfo (populated every poll)"
  - "Compound layout and animation speed constants"
affects: [02-02-PLAN, 02-03-PLAN, 02-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["djb2 hash for deterministic slot assignment", "8KB backward scan for tool_use extraction"]

key-files:
  modified:
    - src/shared/types.ts
    - src/shared/constants.ts
    - src/main/jsonl-reader.ts
    - src/main/session-detector.ts

key-decisions:
  - "djb2 hash (seed 5381) for deterministic agent slot assignment -- same sessionId always maps to same color/accessory/vehicle"
  - "8KB tail buffer for tool_use extraction (vs 4KB for status) -- progress entries with tool_use may be further from tail"
  - "Unmapped tool names default to 'coding' activity -- safe fallback since most tools are code-related"
  - "No tool_use found defaults to 'idle' activity -- if no recent progress entry has tools, agent is likely idle"

patterns-established:
  - "Additive type extension: new types added above SessionInfo, new field added as last field"
  - "Additive constant extension: new constants appended after existing ones, never modifying originals"
  - "Independent function addition: readLastToolUse added alongside readLastJsonlLine without modifying it"

requirements-completed: [WORLD-02, WORLD-06]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 2 Plan 1: Shared Types and Detection Backend Summary

**ActivityType/AgentSlot types, TOOL_TO_ACTIVITY mapping, deterministic agent identity via djb2 hash, and readLastToolUse JSONL extraction feeding activityType on every SessionInfo**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T19:02:53Z
- **Completed:** 2026-02-25T19:05:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended SessionInfo with activityType field -- all downstream renderers now know what each agent is doing
- Added deterministic agent slot system (color, accessory, vehicle) via djb2 hash -- same session always gets same visual identity
- Built readLastToolUse function with 8KB backward scan to extract tool names from JSONL progress entries
- Added TOOL_TO_ACTIVITY mapping covering all 15 known Claude Code tools across 4 activity categories
- Added compound layout constants and animation speed constants for renderer plans

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend shared types and constants for Phase 2 visual world** - `b0ac2ec` (feat)
2. **Task 2: Enhance JSONL reader and session detector with activity type extraction** - `324b2b4` (feat)

## Files Created/Modified
- `src/shared/types.ts` - Added ActivityType, VehicleType, AccessoryType, AgentSlot types; extended SessionInfo with activityType
- `src/shared/constants.ts` - Added AGENT_COLORS, VEHICLE_TYPES, ACCESSORIES, TOOL_TO_ACTIVITY, hashSessionId, getAgentSlot, compound/animation constants
- `src/main/jsonl-reader.ts` - Added readLastToolUse function for extracting tool_use names from JSONL progress entries
- `src/main/session-detector.ts` - Integrated readLastToolUse and TOOL_TO_ACTIVITY to populate activityType on SessionInfo

## Decisions Made
- Used djb2 hash (seed 5381) for deterministic agent slot assignment -- lightweight, well-distributed, no crypto dependency
- 8KB buffer for tool_use extraction (double the 4KB status buffer) -- progress entries with tool_use content blocks can be further from file tail during rapid tool sequences
- Unmapped tool names default to 'coding' (most tools are code-related); no tool_use found defaults to 'idle'
- Imports use `import type` for type-only imports in constants.ts to avoid runtime dependency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All renderer plans (02-02, 02-03, 02-04) can now consume ActivityType, AgentSlot, and activityType from SessionInfo
- getAgentSlot provides deterministic visual identity for compound and agent sprite rendering
- TOOL_TO_ACTIVITY and readLastToolUse enable live activity animation in the renderer
- Compound layout constants ready for world.ts spatial layout implementation

## Self-Check: PASSED

- All 4 source files exist
- All 2 task commits verified (b0ac2ec, 324b2b4)
- SUMMARY.md exists at expected path

---
*Phase: 02-visual-world*
*Completed: 2026-02-25*
