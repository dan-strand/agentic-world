---
phase: 08-dynamic-building-labels
plan: 02
subsystem: renderer
tags: [pixi.js, agent-routing, building-labels, project-mapping]

# Dependency graph
requires:
  - phase: 08-dynamic-building-labels
    plan: 01
    provides: Building.setLabel() and Building.resetLabel() methods, MAX_LABEL_CHARS constant
provides:
  - Project-to-building mapping (projectToBuilding Map)
  - Project-based agent routing replacing activity-based routing
  - Dynamic building label updates (project names on occupied buildings, RPG names on vacant)
  - Building slot release when projects go idle
  - Overflow handling (5th+ project stays at Guild Hall)
affects: [09-speech-bubbles-project-routing]

# Tech tracking
tech-stack:
  added: []
  patterns: [project-slot-assignment, slot-release-on-idle, overflow-to-guild-hall]

key-files:
  created: []
  modified:
    - src/renderer/world.ts

key-decisions:
  - "Project-based routing replaces activity-based routing: agents from same project go to same building regardless of activity type"
  - "Building slots assigned in stable order: coding, testing, reading, comms"
  - "5th+ project overflows to Guild Hall rather than evicting existing projects"

patterns-established:
  - "Slot assignment pattern: Map<projectName, Building> with stable ordered slot pool and first-available allocation"
  - "Slot release pattern: after processing all sessions, release buildings for projects with zero active (non-idle) sessions"
  - "Agent-building tracking: agentBuilding Map<sessionId, Building> enables project-aware glow highlights and work positioning"

requirements-completed: [LABEL-01, LABEL-02, LIFE-03]

# Metrics
duration: 5min
completed: 2026-02-26
---

# Phase 8 Plan 02: Project-to-Building Routing and Dynamic Labels Summary

**Project-based agent routing with dynamic building labels showing active project folder names, slot release on idle, and 5th-project overflow to Guild Hall**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-26T17:43:39Z
- **Completed:** 2026-02-26T18:02:24Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced activity-based routing with project-based routing so agents from the same project go to the same building
- Buildings dynamically display the active project's folder name via setLabel() and revert to RPG names via resetLabel() when all project sessions go idle
- Only 4 active projects get dedicated buildings; 5th+ project sessions overflow to Guild Hall
- Quest zone glow highlights updated to use project-based building detection instead of activity-based detection
- Agent work positions now tracked via agentBuilding Map for correct positioning within project-assigned buildings

## Task Commits

Each task was committed atomically:

1. **Task 1: Add project-to-building mapping and replace activity-based routing** - `525f40a` (feat)
2. **Task 2: Verify dynamic building labels and project-based routing** - checkpoint:human-verify (approved)

## Files Created/Modified
- `src/renderer/world.ts` - Added projectToBuilding Map, buildingSlots array, agentBuilding Map; getProjectBuilding() and releaseInactiveProjectSlots() methods; rewrote routing logic from activity-based to project-based; updated glow highlights and work position calculation

## Decisions Made
- Project-based routing replaces activity-based routing entirely -- agents from the same project always go to the same building regardless of whether they are coding, testing, or reading. This makes building labels meaningful since the label reflects the project, not the activity.
- Building slots are assigned in a stable order (coding, testing, reading, comms buildings) to ensure deterministic assignment.
- When all 4 slots are occupied, overflow projects remain at Guild Hall rather than evicting existing project assignments.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Project-to-building mapping is fully operational for Phase 9 speech bubbles to reference
- agentBuilding Map provides the foundation for knowing which building an agent is at (useful for speech bubble positioning)
- Building labels correctly show project names, establishing the visual context that speech bubbles will complement
- Phase 8 is complete -- both plans (infrastructure + routing) are done

## Self-Check: PASSED

- Modified file src/renderer/world.ts exists on disk
- Commit 525f40a (Task 1) found in git log
- SUMMARY.md created at expected path

---
*Phase: 08-dynamic-building-labels*
*Completed: 2026-02-26*
