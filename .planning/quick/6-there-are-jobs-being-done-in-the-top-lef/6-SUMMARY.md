---
phase: quick-6
plan: 1
subsystem: renderer
tags: [bugfix, coordinates, agent-positioning, building-interior]
dependency_graph:
  requires: []
  provides:
    - correct-local-coordinate-station-reassignment
  affects:
    - agent-visual-positioning
    - building-interior-rendering
tech_stack:
  added: []
  patterns:
    - "Use building.getWorkSpot() for local coords when agent is reparented into building"
    - "Use getBuildingWorkPosition() for global coords only when agent is in agentsContainer"
key_files:
  modified:
    - src/renderer/world.ts
decisions:
  - id: QK6-D1
    summary: "Use building.getWorkSpot(newStationIndex) instead of this.getBuildingWorkPosition() for activity-change station reassignment"
    rationale: "Agent is in building-local coordinate space when reparented; global coords cause agent to fly outside building bounds"
metrics:
  duration: ~30s
  completed: "2026-03-03"
---

# Quick Task 6: Fix Agent Positioning on Activity Change Summary

Fixed activity-change station reassignment to use local coordinates (building.getWorkSpot) instead of global coordinates (getBuildingWorkPosition) when agent is reparented into building interior.

## What Changed

In `src/renderer/world.ts`, the `manageAgents` method's activity-change branch (line ~549) called `this.getBuildingWorkPosition(building, session.sessionId)` which returns GLOBAL coordinates (building.x + local.x, building.y + local.y). However, at this point the agent has already been reparented into the building's `agentsLayer` container by `handleAgentReparenting()`, meaning the agent's x/y are interpreted as LOCAL coordinates relative to the building.

The global coordinates (e.g., x=98, y=92 for Wizard Tower's enchanting table) were being treated as local offsets, sending the agent far outside the building (to global position ~346, ~444 which lands in the bottom-left building area). The agent would then render behind the Ancient Library due to z-order (buildings added later cover earlier ones).

**Fix:** Replaced `this.getBuildingWorkPosition(building, session.sessionId)` with `building.getWorkSpot(newStationIndex)` which returns LOCAL coordinates matching the agent's coordinate space.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix activity-change station reassignment to use local coordinates | 3e35ed8 | src/renderer/world.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation: PASSED (npx tsc --noEmit, zero errors)
- Visual verification: requires manual testing -- start app, have agent in Wizard Tower, switch tools to trigger activity change, confirm agent stays within building bounds

## Self-Check: PASSED

- [x] src/renderer/world.ts modified correctly
- [x] Commit 3e35ed8 exists
- [x] getBuildingWorkPosition replaced with building.getWorkSpot in activity-change branch only
- [x] getBuildingWorkPosition still used correctly in initial assignToCompound call (line 532)
- [x] handleAgentReparenting still correctly uses building.getWorkSpot (line 831)
