---
phase: quick-6
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/world.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Agents assigned to the top-left building (Wizard Tower) work at correct positions within that building"
    - "Agents switching activities while inside a building move to the new station within the same building, not to a global coordinate outside it"
    - "Agents inside top-left building are never visually obscured by the bottom-left building"
  artifacts:
    - path: "src/renderer/world.ts"
      provides: "Correct local coordinate usage for activity-change station reassignment"
      contains: "building.getWorkSpot"
  key_links:
    - from: "manageAgents activity change branch"
      to: "agent.updateActivity"
      via: "building.getWorkSpot (local coords, not getBuildingWorkPosition global coords)"
      pattern: "building\\.getWorkSpot"
---

<objective>
Fix agent positioning bug where agents working inside a building walk to wrong coordinates when switching activity/station, causing them to leave their building's bounds and disappear behind other buildings.

Purpose: When an agent's activity changes while it is reparented inside a building (working state), the code calls `getBuildingWorkPosition()` which returns GLOBAL coordinates. But the agent is in the building's LOCAL coordinate space, so it interprets those global coords as local offsets -- sending it far outside the building (e.g., local (98, 92) maps to global (346, 444) which is in the bottom-left building's area). The agent then renders behind the bottom-left building due to z-order (buildings added later in the scene graph render on top).

Output: Corrected `world.ts` where activity-change station reassignment uses local coordinates from `building.getWorkSpot()` instead of global coordinates from `getBuildingWorkPosition()`.
</objective>

<execution_context>
@C:/Users/dlaws/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/dlaws/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/renderer/world.ts
@src/renderer/building.ts
@src/renderer/agent.ts
@src/shared/constants.ts

<interfaces>
<!-- Key coordinate contract the executor must understand -->

Building.getWorkSpot(spotIndex: number) returns LOCAL coordinates (relative to building container origin):
```typescript
// e.g., { x: -150, y: -260 } for Enchanting Table in Wizard Tower
getWorkSpot(spotIndex: number): { x: number; y: number }
```

World.getBuildingWorkPosition() returns GLOBAL coordinates (building.x + local.x, building.y + local.y):
```typescript
// e.g., { x: 98, y: 92 } for Enchanting Table with building at (248, 352)
private getBuildingWorkPosition(building: Building, sessionId: string): { x: number; y: number }
```

When agent is reparented INTO building.agentsLayer, agent.x/y are in LOCAL coords.
Therefore agent.updateActivity() must receive LOCAL coords when agent is inside building.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix activity-change station reassignment to use local coordinates</name>
  <files>src/renderer/world.ts</files>
  <action>
In the `manageAgents` method of `world.ts`, find the block around lines 538-551 that handles activity changes for agents already in `working` state:

```typescript
} else if (agentState === 'working') {
  // Check for tool change (lastToolName change triggers station switch)
  const prevActivity = this.lastActivity.get(session.sessionId);
  if (prevActivity && prevActivity !== activityType) {
    // ...
    const newStationIndex = building.reassignStation(session.sessionId);
    this.agentSpotIndex.set(session.sessionId, newStationIndex);
    const newWorkPos = this.getBuildingWorkPosition(building, session.sessionId);
    agent.updateActivity(newWorkPos);
  }
}
```

The bug is on the line `const newWorkPos = this.getBuildingWorkPosition(...)`. This returns GLOBAL coordinates, but the agent is reparented into the building's local coordinate space. Replace that line with:

```typescript
const newWorkPos = building.getWorkSpot(newStationIndex);
agent.updateActivity(newWorkPos);
```

This uses `building.getWorkSpot()` which returns LOCAL coordinates -- matching the coordinate space the agent is in.

Do NOT change `getBuildingWorkPosition()` itself -- it is correctly used elsewhere (initial `assignToCompound` call when agent is still in global `agentsContainer`).

Do NOT change `handleAgentReparenting()` -- it already correctly uses `building.getWorkSpot()` for the initial reparenting.
  </action>
  <verify>
    <automated>cd "C:/Users/dlaws/Projects/Agent World" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Activity-change station reassignment in manageAgents uses building.getWorkSpot(newStationIndex) for local coordinates instead of getBuildingWorkPosition() for global coordinates. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. Visual verification: start the app with a session in the top-left building (Wizard Tower). When the session changes tools (e.g., from Read to Write), the agent moves to a new station within the Wizard Tower instead of flying to a position outside the building.
3. Agent should never appear behind the bottom-left building (Ancient Library) while assigned to the top-left building.
</verification>

<success_criteria>
- Agent stays within its assigned building when switching activity/station
- No agent visually disappears behind other buildings
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/6-there-are-jobs-being-done-in-the-top-lef/6-SUMMARY.md`
</output>
