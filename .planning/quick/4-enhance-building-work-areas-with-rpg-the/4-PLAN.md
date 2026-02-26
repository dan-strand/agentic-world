---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/constants.ts
  - src/renderer/building.ts
  - src/renderer/world.ts
autonomous: true
requirements: [QUICK-4]

must_haves:
  truths:
    - "Each building displays 3 small RPG prop indicators at distinct positions"
    - "When an agent's activity type changes, the agent walks to a different spot within the same building"
    - "Agents at the same building are spread across different spots, not clumped at one position"
  artifacts:
    - path: "src/shared/constants.ts"
      provides: "BUILDING_WORK_SPOTS definition with named spots per BuildingType"
      contains: "BUILDING_WORK_SPOTS"
    - path: "src/renderer/building.ts"
      provides: "getWorkSpot() method and prop Graphics drawing"
      contains: "getWorkSpot"
    - path: "src/renderer/world.ts"
      provides: "Spot rotation on activity change using agent.updateActivity()"
      contains: "updateActivity"
  key_links:
    - from: "src/renderer/world.ts"
      to: "src/renderer/building.ts"
      via: "building.getWorkSpot() called for spot positions"
      pattern: "getWorkSpot"
    - from: "src/renderer/world.ts"
      to: "src/renderer/agent.ts"
      via: "agent.updateActivity() called on activity change"
      pattern: "agent\\.updateActivity"
    - from: "src/shared/constants.ts"
      to: "src/renderer/building.ts"
      via: "BUILDING_WORK_SPOTS imported for spot definitions"
      pattern: "BUILDING_WORK_SPOTS"
---

<objective>
Add distinct RPG-themed work spots to each building and make agents move between them when their activity changes.

Purpose: Currently agents walk to a single generic work position and stay put. This makes buildings feel static. By adding multiple named spots with small prop indicators, and moving agents between them on activity changes, buildings feel alive with agents visually switching between tasks.

Output: Constants defining 3 named spots per building, Building class drawing small prop Graphics and returning named spot positions, World wiring that rotates agents between spots on activity change.
</objective>

<execution_context>
@C:/Users/dlaws/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/dlaws/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/shared/constants.ts
@src/shared/types.ts
@src/renderer/building.ts
@src/renderer/world.ts
@src/renderer/agent.ts

<interfaces>
<!-- Key existing interfaces the executor needs -->

From src/shared/constants.ts:
```typescript
export type BuildingType = 'guild_hall' | 'wizard_tower' | 'training_grounds' | 'ancient_library' | 'tavern';

export const ACTIVITY_BUILDING: Record<ActivityType, BuildingType> = {
  coding:  'wizard_tower',
  testing: 'training_grounds',
  reading: 'ancient_library',
  comms:   'tavern',
  idle:    'guild_hall',
};
```

From src/renderer/building.ts:
```typescript
export class Building extends Container {
  readonly buildingType: BuildingType;
  getWorkPosition(index: number, total: number): { x: number; y: number }; // current generic fanning
  getEntrancePosition(): { x: number; y: number };
  getIdlePosition(index: number, total: number): { x: number; y: number };
}
```

From src/renderer/agent.ts:
```typescript
// ALREADY EXISTS but is never called from world.ts:
updateActivity(subLocation: { x: number; y: number }): void {
  this.workSpotTarget = subLocation;
  if (this.state === 'working' || this.state === 'walking_to_workspot') {
    this.state = 'walking_to_workspot';
    this.setAnimation('walk');
  }
}
```

From src/renderer/world.ts:
```typescript
// In manageAgents(), activity change is detected but only shows bubble:
} else if (agentState === 'working') {
  const prevActivity = this.lastActivity.get(session.sessionId);
  if (prevActivity && prevActivity !== activityType) {
    // BUBBLE-03: Show speech bubble on activity change at same building
    const bubble = this.speechBubbles.get(session.sessionId);
    if (bubble) bubble.show(activityType);
  }
}

// getBuildingWorkPosition() computes generic fanned position:
private getBuildingWorkPosition(building: Building, sessionId: string): { x: number; y: number }

// Track per-agent building assignment:
private agentBuilding: Map<string, Building> = new Map();
private lastActivity: Map<string, ActivityType> = new Map();
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Define work spots per building and add prop rendering</name>
  <files>src/shared/constants.ts, src/renderer/building.ts</files>
  <action>
**In src/shared/constants.ts**, add a `BUILDING_WORK_SPOTS` constant defining 3 named spots per building type. Each spot has a name, local x/y offset (relative to building container origin at ground-center), and a color for its prop indicator. Spots should be spatially spread within the building footprint (~96px wide):

```typescript
export interface WorkSpot {
  name: string;
  x: number;    // local offset from building container origin
  y: number;    // local offset (negative = up into building, positive = below base)
  color: number; // prop indicator color
}

export const BUILDING_WORK_SPOTS: Record<BuildingType, WorkSpot[]> = {
  wizard_tower: [
    { name: 'Enchanting Table', x: -28, y: -24, color: 0x8844ff },  // purple - left
    { name: 'Scroll Desk',     x: 0,   y: -8,  color: 0xddcc88 },  // parchment - center
    { name: 'Rune Bench',      x: 28,  y: -24, color: 0x44aaff },  // blue rune - right
  ],
  training_grounds: [
    { name: 'Target Dummy',    x: -28, y: -24, color: 0xaa6633 },  // wood brown - left
    { name: 'Obstacle Course', x: 0,   y: -8,  color: 0x888888 },  // stone gray - center
    { name: 'Potion Station',  x: 28,  y: -24, color: 0x44dd44 },  // green potion - right
  ],
  ancient_library: [
    { name: 'Crystal Ball',    x: -28, y: -24, color: 0xaaccff },  // crystal blue - left
    { name: 'Ancient Bookshelf', x: 0, y: -8,  color: 0x885522 },  // leather brown - center
    { name: 'Map Table',       x: 28,  y: -24, color: 0xddddaa },  // parchment - right
  ],
  tavern: [
    { name: 'Bar Counter',     x: -28, y: -24, color: 0x664422 },  // dark wood - left
    { name: 'Notice Board',    x: 0,   y: -8,  color: 0xccaa66 },  // cork - center
    { name: 'Pigeon Roost',    x: 28,  y: -24, color: 0xcccccc },  // feather gray - right
  ],
  guild_hall: [], // Guild hall has no work spots (agents idle here)
};
```

**In src/renderer/building.ts**, make these changes:

1. Import `BUILDING_WORK_SPOTS` and `WorkSpot` from constants.

2. In the constructor, after adding the label, draw small prop indicators using PixiJS `Graphics` for each work spot defined for this building type. Each prop is a simple visual marker:
   - A small filled circle (radius 3px) at the spot's local position, using the spot's color
   - A tiny darker outline circle (radius 4px, 1px lineWidth) for definition
   - Add the Graphics object as a child of the Building container
   - These are static decorations -- drawn once in constructor, never updated.

3. Add a new method `getWorkSpot(spotIndex: number)` that returns the local {x, y} position for a specific spot index (clamped to available spots). This replaces `getWorkPosition` for building-specific work routing:

```typescript
/**
 * Get a specific named work spot position in local coordinates.
 * Spots are defined per building type in BUILDING_WORK_SPOTS.
 * Falls back to getWorkPosition() for guild_hall or out-of-range index.
 */
getWorkSpot(spotIndex: number): { x: number; y: number } {
  const spots = BUILDING_WORK_SPOTS[this.buildingType];
  if (!spots || spots.length === 0) {
    return this.getWorkPosition(0, 1);
  }
  const clamped = spotIndex % spots.length;
  return { x: spots[clamped].x, y: spots[clamped].y };
}
```

4. Keep the existing `getWorkPosition()` method unchanged -- it serves as fallback and is used for initial assignment.
  </action>
  <verify>
    npm run build completes with no TypeScript errors. Verify BUILDING_WORK_SPOTS has entries for all 5 BuildingType values. Verify Building.getWorkSpot() method exists.
  </verify>
  <done>
    Each building type has 3 defined work spots with names, positions, and colors. Building class draws small colored circle props at each spot position. getWorkSpot(index) returns specific spot coordinates. Build passes cleanly.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire agent spot rotation on activity change in world.ts</name>
  <files>src/renderer/world.ts</files>
  <action>
**In src/renderer/world.ts**, make these changes to route agents to specific work spots and move them between spots on activity change:

1. Add a new private Map to track the current spot index per agent:
```typescript
private agentSpotIndex: Map<string, number> = new Map();
```

2. Replace the `getBuildingWorkPosition()` method to use named spots instead of generic fanning. The new version picks a spot by index:

```typescript
private getBuildingWorkPosition(building: Building, sessionId: string): { x: number; y: number } {
  const spotIndex = this.agentSpotIndex.get(sessionId) ?? 0;
  const local = building.getWorkSpot(spotIndex);
  return { x: building.x + local.x, y: building.y + local.y };
}
```

3. When a NEW agent is first assigned to a building (the `agentState === 'idle_at_hq'` branch), assign an initial spot index. Use `hashSessionId(sessionId) % 3` to deterministically pick a starting spot so agents spread across spots. Add before the `agent.assignToCompound()` call:
```typescript
import { hashSessionId } from '../shared/constants';
// ...
this.agentSpotIndex.set(session.sessionId, hashSessionId(session.sessionId) % 3);
```

4. In the `agentState === 'working'` branch where activity change is detected (`prevActivity && prevActivity !== activityType`), AFTER showing the speech bubble, rotate the agent to the next spot and call `agent.updateActivity()`:
```typescript
// Rotate to next work spot within the building
const currentSpot = this.agentSpotIndex.get(session.sessionId) ?? 0;
const nextSpot = (currentSpot + 1) % 3;
this.agentSpotIndex.set(session.sessionId, nextSpot);
const newWorkPos = this.getBuildingWorkPosition(building, session.sessionId);
agent.updateActivity(newWorkPos);
```

This calls `agent.updateActivity()` which already exists in agent.ts and correctly transitions the agent to `walking_to_workspot` state with the new target position.

5. Clean up `agentSpotIndex` in `removeAgent()`:
```typescript
this.agentSpotIndex.delete(sessionId);
```

6. Also clean up in the debounce cleanup loop at the end of `manageAgents()` (the `for (const [sessionId] of this.statusDebounce)` block):
```typescript
this.agentSpotIndex.delete(sessionId);
```

**Important:** Do NOT change the existing `getWorkPosition()` method on Building -- it remains as-is for backward compatibility. The new `getBuildingWorkPosition()` in world.ts now delegates to `building.getWorkSpot()` instead.

**Important:** The `agent.updateActivity()` method in agent.ts already handles the state transition correctly -- it sets `workSpotTarget` and transitions to `walking_to_workspot`. No changes to agent.ts are needed.
  </action>
  <verify>
    npm run build completes with no TypeScript errors. Grep for `updateActivity` in world.ts to confirm it is now called (previously it was only defined in agent.ts but never invoked). Grep for `agentSpotIndex` to confirm tracking map is created, used, and cleaned up in removeAgent().
  </verify>
  <done>
    Agents receive deterministic initial spot assignments when arriving at buildings. Activity changes trigger spot rotation -- agent walks from current spot to next spot within the same building. The existing updateActivity() method on Agent is now wired up. Spot index tracking is properly cleaned up on agent removal. Build passes.
  </done>
</task>

</tasks>

<verification>
1. `npm run build` passes with zero errors
2. Visual check: Start the app, observe small colored circles at each building's work area (3 per building)
3. Visual check: When an agent's activity changes (tool_use switches category), agent walks to a different spot within its building instead of standing still
4. Confirm `agent.updateActivity()` is now called from world.ts (was previously dead code)
</verification>

<success_criteria>
- Each of the 4 quest zone buildings shows 3 small colored prop indicators at distinct positions
- Agents assigned to a building start at a deterministic spot (spread via hash)
- Activity type changes cause agents to walk to the next spot within their building
- No regressions: agent routing to buildings, celebrations, fade-outs all still work
- TypeScript build passes cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/4-enhance-building-work-areas-with-rpg-the/4-SUMMARY.md`
</output>
