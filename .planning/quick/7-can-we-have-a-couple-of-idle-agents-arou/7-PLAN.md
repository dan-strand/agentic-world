---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/world.ts
  - src/renderer/game-loop.ts
  - src/shared/constants.ts
autonomous: true
requirements: [AMBIENT-IDLE-AGENTS]
must_haves:
  truths:
    - "Two ambient agents are always visible sitting around the campfire when no sessions are active"
    - "Ambient agents sit idle at the campfire and animate at low FPS even when zero real sessions exist"
    - "When a real session appears, an ambient agent walks to the assigned building to work"
    - "When the real session ends (celebration + walk back), the agent returns to idle at campfire as an ambient agent again"
    - "Ambient agents use different character classes for visual variety"
  artifacts:
    - path: "src/renderer/world.ts"
      provides: "Ambient agent spawning, lifecycle management, and session-to-ambient handoff"
    - path: "src/renderer/game-loop.ts"
      provides: "Ticker keeps running at idle FPS when ambient agents are present (never fully stops)"
    - path: "src/shared/constants.ts"
      provides: "AMBIENT_AGENT_COUNT constant"
  key_links:
    - from: "src/renderer/world.ts"
      to: "Agent class"
      via: "Ambient agents are real Agent instances in idle_at_hq state"
      pattern: "ambientAgent"
    - from: "src/renderer/game-loop.ts"
      to: "world.hasActiveAnimations()"
      via: "Never stop ticker when ambient agents exist"
      pattern: "ambientAgents|sessions\\.length === 0"
---

<objective>
Add two ambient idle agents that sit around the campfire permanently. When no Claude Code sessions are active, these agents provide life to the world -- they sit there animating gently. When a real session starts, one of the ambient agents "becomes" that session's agent and walks to work. When the session ends and the agent celebrates and walks back to the campfire, it resumes as an ambient idle agent.

Purpose: The world feels alive even when no sessions are running -- adventurers hanging out at camp waiting for the next quest.
Output: Two permanent ambient agents at the campfire with seamless transition to/from real session work.
</objective>

<execution_context>
@C:/Users/dlaws/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/dlaws/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/shared/types.ts:
```typescript
export type CharacterClass = 'mage' | 'warrior' | 'ranger' | 'rogue';
export interface AgentSlot { colorIndex: number; color: number; characterClass: CharacterClass; }
```

From src/renderer/agent.ts:
```typescript
export type AgentState = 'idle_at_hq' | 'walking_to_building' | 'walking_to_workspot' | 'working' | 'celebrating' | 'fading_out';
export class Agent extends Container {
  readonly sessionId: string;
  tick(deltaMs: number): void;
  getState(): AgentState;
  setHQPosition(pos: { x: number; y: number }): void;
  assignToCompound(entrance, subLocation): void;
  assignToHQ(position): void;
  startCelebration(): void;
  startFadeOut(): void;
  cancelFadeOut(): void;
  applyStatusVisuals(status: SessionStatus): void;
  setInteriorMode(enabled: boolean): void;
  isFadedOut(): boolean;
}
```

From src/renderer/world.ts:
```typescript
// repositionIdleAgents() fans idle agents horizontally below campfire
// getCampfireIdlePosition() returns position for a specific idle agent
// agents: Map<string, Agent> -- keyed by sessionId
// manageAgents() creates/updates agents from session data
// tick() drives agent state machines, debouncing, reparenting
```

From src/renderer/game-loop.ts:
```typescript
// onSessionsUpdate(): stops ticker entirely when sessions.length === 0
// Uses world.hasActiveAnimations() to decide FPS
```

From src/shared/constants.ts:
```typescript
export const CAMPFIRE_POS = { x: 512, y: 384 };
export const CAMPFIRE_SIZE = 64;
export const CHARACTER_CLASSES: CharacterClass[] = ['mage', 'warrior', 'ranger', 'rogue'];
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ambient agent constants and game-loop fix</name>
  <files>src/shared/constants.ts, src/renderer/game-loop.ts</files>
  <action>
In `src/shared/constants.ts`:
- Add `export const AMBIENT_AGENT_COUNT = 2;` near the other agent constants (after AGENT_FADEOUT_DURATION_MS block).
- Add `export const AMBIENT_AGENT_IDS = ['ambient-agent-0', 'ambient-agent-1'] as const;` -- these are stable synthetic session IDs so the AgentFactory produces deterministic character classes for them.
- Add `export const AMBIENT_WANDER_RADIUS = 20;` -- smaller wander radius for ambient agents sitting near campfire (less than the 40px building wander).
- Add `export const AMBIENT_WANDER_INTERVAL_MS = 4000;` -- slower wander cycle for relaxed campfire vibe.

In `src/renderer/game-loop.ts`:
- Modify `onSessionsUpdate()`: Remove the `sessions.length === 0` early-return that stops the ticker. Instead, when there are no sessions, set ticker to `FPS_IDLE` (5fps) and ensure it is started -- ambient agents need to animate. The key change: replace the block at lines 43-47 that does `this.app.ticker.stop()` with setting `this.app.ticker.maxFPS = FPS_IDLE` and ensuring ticker is started. This keeps ambient agents alive at minimal CPU cost.
  </action>
  <verify>
    <automated>cd "C:/Users/dlaws/Projects/Agent World" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Constants defined. Game loop no longer fully stops when zero sessions -- ticks at idle FPS so ambient agents animate.</done>
</task>

<task type="auto">
  <name>Task 2: Implement ambient agents in World</name>
  <files>src/renderer/world.ts</files>
  <action>
Add ambient agent management to World. The core idea: ambient agents are real Agent instances that live permanently at the campfire. When a real session arrives, we "claim" an ambient agent to represent that session -- reusing its visual identity. When the session ends (agent returns to campfire after celebration), it becomes ambient again.

**Implementation approach -- keep it simple, use a parallel set of ambient agents:**

1. Add a new field: `private ambientAgents: Agent[] = [];` to track the ambient agents specifically.

2. In `init()`, after creating `agentsContainer`, spawn the ambient agents:
   ```typescript
   // Spawn ambient agents at campfire
   for (const ambientId of AMBIENT_AGENT_IDS) {
     const slot = this.agentFactory.getSlot(ambientId);
     const agent = new Agent(ambientId, slot);
     const spacing = 30;
     const index = AMBIENT_AGENT_IDS.indexOf(ambientId);
     const totalWidth = (AMBIENT_AGENT_COUNT - 1) * spacing;
     const startX = CAMPFIRE_POS.x - totalWidth / 2;
     agent.x = startX + index * spacing;
     agent.y = CAMPFIRE_POS.y + CAMPFIRE_SIZE / 2 + 10;
     agent.setHQPosition({ x: agent.x, y: agent.y });
     agent.applyStatusVisuals('idle');
     this.agentsContainer.addChild(agent);
     this.ambientAgents.push(agent);
   }
   ```
   Import `AMBIENT_AGENT_COUNT`, `AMBIENT_AGENT_IDS` from constants.

3. In `tick()`, add ambient agent ticking BEFORE the main agent loop:
   ```typescript
   // Tick ambient agents (they only need basic idle animation)
   for (const ambient of this.ambientAgents) {
     ambient.tick(deltaMs);
   }
   ```

4. In `repositionIdleAgents()`, incorporate ambient agents into the positioning. Collect both real idle agents AND visible ambient agents, then fan them all out together below the campfire. An ambient agent is "visible" if it is not hidden (alpha > 0, visible = true). This ensures real idle agents and ambient agents share the campfire space nicely:
   ```typescript
   private repositionIdleAgents(): void {
     const idleAgents: Agent[] = [];
     // Include visible ambient agents
     for (const ambient of this.ambientAgents) {
       if (ambient.visible) {
         idleAgents.push(ambient);
       }
     }
     // Include real idle agents
     for (const agent of this.agents.values()) {
       if (agent.getState() === 'idle_at_hq') {
         idleAgents.push(agent);
       }
     }
     const spacing = 30;
     const baseY = this.campfire.y + CAMPFIRE_SIZE / 2 + 10;
     for (let i = 0; i < idleAgents.length; i++) {
       const totalWidth = (idleAgents.length - 1) * spacing;
       const startX = this.campfire.x - totalWidth / 2;
       const globalPos = { x: startX + i * spacing, y: baseY };
       idleAgents[i].setHQPosition(globalPos);
       if (idleAgents[i].getState() === 'idle_at_hq') {
         idleAgents[i].x = globalPos.x;
         idleAgents[i].y = globalPos.y;
       }
     }
   }
   ```
   For ambient agents that are always idle_at_hq, also directly set their x/y position (since setHQPosition only moves agents already in idle_at_hq state, and ambient agents are always in that state since they are never part of the session state machine).

5. When a real session agent returns to campfire (idle_at_hq), the `repositionIdleAgents()` call will naturally position them alongside ambient agents. When a real agent goes to work, `repositionIdleAgents()` re-fans the remaining idle + ambient agents. No special "claiming" needed -- ambient agents are purely decorative and co-exist with real session agents.

6. Hide ambient agents when 4+ real session agents are present (screen gets crowded). In `manageAgents()`, after processing all sessions, check `this.agents.size`:
   ```typescript
   // Hide ambient agents when many real agents are present to avoid clutter
   const hideAmbient = this.agents.size >= 4;
   for (const ambient of this.ambientAgents) {
     ambient.visible = !hideAmbient;
   }
   ```
   This keeps the campfire area clean when the world is busy.

7. Update `hasActiveAnimations()` to return true if any ambient agents are visible (so the game loop keeps ticking at idle FPS for their gentle animation):
   ```typescript
   hasActiveAnimations(): boolean {
     // Ambient agents always need ticking for idle animation
     if (this.ambientAgents.some(a => a.visible)) return true;
     // ... existing agent state checks ...
   }
   ```
   Actually, on second thought -- `hasActiveAnimations` returning true would force 30fps. The ambient agents only need 5fps idle animation. Better approach: do NOT modify `hasActiveAnimations()`. Instead, rely on the game-loop fix from Task 1 which ensures the ticker runs at FPS_IDLE even with zero sessions. The `tick()` method will be called at 5fps which is sufficient for idle animation. The ambient agents are ticked in the tick() method, so they will animate at idle FPS.

Do NOT add ambient agents to the `this.agents` Map (that is for real session agents only). They live in `this.ambientAgents` array and `this.agentsContainer` for rendering.

Do NOT add speech bubbles, status debounce, or any other session-tracking infrastructure for ambient agents -- they are purely visual, always idle.
  </action>
  <verify>
    <automated>cd "C:/Users/dlaws/Projects/Agent World" && npx tsc --noEmit 2>&1 | head -20 && npm run make 2>&1 | tail -5</automated>
  </verify>
  <done>Two ambient agents permanently visible at the campfire. They animate with idle animation at low FPS. When real session agents arrive/depart, all idle agents (real + ambient) reposition smoothly around the campfire. Ambient agents hide when 4+ real agents are active to avoid clutter. The world feels alive even with zero sessions running.</done>
</task>

</tasks>

<verification>
1. Launch the app with zero active Claude Code sessions -- two ambient agents should be visible at the campfire, gently animating in idle pose
2. Start a Claude Code session -- a new real agent appears at campfire then walks to a building; ambient agents reposition to share space
3. End the session -- real agent celebrates, walks back, all agents reposition at campfire
4. With 4+ sessions running, ambient agents should be hidden
5. CPU usage with zero sessions should be low (~2% at 5fps idle), not zero (ticker no longer stops)
</verification>

<success_criteria>
- Two ambient agents visible at campfire when app launches with no sessions
- Ambient agents have different character classes (deterministic from AMBIENT_AGENT_IDS)
- Ambient agents animate at idle FPS (5fps) -- visible gentle animation
- Real session agents coexist with ambient agents at campfire (proper spacing)
- Ambient agents hide when screen is busy (4+ real agents)
- TypeScript compiles without errors
- App builds successfully with `npm run make`
</success_criteria>

<output>
After completion, create `.planning/quick/7-can-we-have-a-couple-of-idle-agents-arou/7-SUMMARY.md`
</output>
