---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/constants.ts
  - src/renderer/agent.ts
  - src/renderer/world.ts
autonomous: true
requirements: [IDLE-TIMEOUT-FADEOUT]

must_haves:
  truths:
    - "Agent fades out and disappears after 5 minutes of continuous idle status"
    - "If session reactivates before fade completes, fade is cancelled and agent resumes normal behavior"
    - "Idle timeout resets if agent briefly becomes active then idle again"
    - "Agents whose sessions disappear from IPC still fade out immediately (existing behavior preserved)"
  artifacts:
    - path: "src/shared/constants.ts"
      provides: "IDLE_TIMEOUT_MS constant"
      contains: "IDLE_TIMEOUT_MS"
    - path: "src/renderer/agent.ts"
      provides: "cancelFadeOut() method for reactivation"
      exports: ["Agent"]
    - path: "src/renderer/world.ts"
      provides: "Per-agent idle duration tracking and timeout trigger"
      exports: ["World"]
  key_links:
    - from: "src/renderer/world.ts"
      to: "src/renderer/agent.ts"
      via: "startFadeOut() on idle timeout, cancelFadeOut() on reactivation"
      pattern: "agent\\.startFadeOut|agent\\.cancelFadeOut"
    - from: "src/renderer/world.ts"
      to: "src/shared/constants.ts"
      via: "IDLE_TIMEOUT_MS import"
      pattern: "IDLE_TIMEOUT_MS"
---

<objective>
Add idle timeout fadeout: agents whose sessions have been continuously idle for 5 minutes should fade out and disappear via the existing fade-out lifecycle. If a session reactivates before the fade completes, cancel the fade and resume normal behavior.

Purpose: Prevent idle agents from sitting at Guild Hall forever, cluttering the world when sessions are abandoned or long-dormant.
Output: Modified constants, agent, and world files with idle timeout tracking and cancellation.
</objective>

<execution_context>
@C:/Users/dlaws/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/dlaws/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/shared/constants.ts
@src/renderer/agent.ts
@src/renderer/world.ts
@src/shared/types.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/shared/types.ts:
```typescript
export type SessionStatus = 'active' | 'waiting' | 'idle' | 'error';
export type ActivityType = 'coding' | 'reading' | 'testing' | 'comms' | 'idle';
```

From src/renderer/agent.ts:
```typescript
export type AgentState = 'idle_at_hq' | 'walking_to_building' | 'walking_to_workspot' | 'working' | 'celebrating' | 'fading_out';
export class Agent extends Container {
  readonly sessionId: string;
  getState(): AgentState;
  startFadeOut(): void;          // Triggers terminal fade-out from any state
  isFadedOut(): boolean;         // True when fade animation complete, ready for removal
  applyStatusVisuals(status: SessionStatus): void;
  assignToCompound(entrance, subLocation): void;
  assignToHQ(position): void;
}
```

From src/renderer/world.ts:
```typescript
// Existing tracking Maps in World class:
private agents: Map<string, Agent>;
private lastCommittedStatus: Map<string, SessionStatus>;
private lastRawStatus: Map<string, SessionStatus>;
private dismissedSessions: Set<string>;
// Existing methods:
private removeAgent(sessionId: string): void;  // Full cleanup: scene graph, destroy, all Maps, factory slot, adds to dismissedSessions
private manageAgents(sessions, projectSessions): void;  // Called on every IPC update
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add IDLE_TIMEOUT_MS constant and Agent.cancelFadeOut() method</name>
  <files>src/shared/constants.ts, src/renderer/agent.ts</files>
  <action>
**constants.ts:** Add a new constant after the existing AGENT_FADEOUT_DURATION_MS line:

```typescript
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutes of continuous idle before fade-out
```

**agent.ts:** Add a `cancelFadeOut()` method to the Agent class. This allows World to cancel an idle-timeout-triggered fade and resume normal behavior when a session reactivates.

Add this public method after the existing `startFadeOut()` method:

```typescript
/**
 * Cancel an in-progress fade-out and return to idle_at_hq state.
 * Used when an idle-timeout fade is interrupted by session reactivation.
 * No-op if agent is not currently fading out.
 */
cancelFadeOut(): void {
  if (this.state !== 'fading_out') return;
  this.state = 'idle_at_hq';
  this.fadeOutTimer = 0;
  this.alpha = 1;
  this.setAnimation('idle');
}
```

Also import IDLE_TIMEOUT_MS is NOT needed in agent.ts -- the timeout logic lives entirely in World.
  </action>
  <verify>
Run `npx tsc --noEmit` from project root. No type errors. Confirm IDLE_TIMEOUT_MS is exported and Agent has cancelFadeOut method.
  </verify>
  <done>IDLE_TIMEOUT_MS = 300000 exported from constants.ts. Agent.cancelFadeOut() restores fading_out agents to idle_at_hq with full alpha.</done>
</task>

<task type="auto">
  <name>Task 2: Add idle duration tracking and timeout trigger to World</name>
  <files>src/renderer/world.ts</files>
  <action>
This is the core logic. World needs to:
1. Track how long each agent has been continuously idle
2. Trigger fade-out when the idle duration exceeds IDLE_TIMEOUT_MS
3. Cancel fade-out and reset the timer when a session reactivates
4. Clean up the idle timer Map in removeAgent()

**Step-by-step changes to world.ts:**

**A. Add import:** Add `IDLE_TIMEOUT_MS` to the existing import from `'../shared/constants'`.

**B. Add tracking Map:** Add a new private field alongside the existing status tracking Maps (near line 69):
```typescript
// Idle timeout tracking (ms of continuous committed-idle time per agent)
private idleTimers: Map<string, number> = new Map();
```

**C. Modify tick() -- advance idle timers and trigger timeout:**
In the `tick()` method, after the existing per-agent loop that calls `agent.tick(deltaMs)` and advances status debounce (the `for (const agent of this.agents.values())` loop ending around line 197), add idle timeout logic INSIDE the same loop, right after the completion check block (after the `if (this.checkForCompletion(...))` block):

```typescript
// Idle timeout: track continuous idle duration and trigger fade-out
const committed = this.lastCommittedStatus.get(agent.sessionId);
if (committed === 'idle' && agent.getState() !== 'fading_out') {
  const prev = this.idleTimers.get(agent.sessionId) ?? 0;
  const next = prev + deltaMs;
  this.idleTimers.set(agent.sessionId, next);
  if (next >= IDLE_TIMEOUT_MS) {
    agent.startFadeOut();
    this.idleTimers.delete(agent.sessionId);
  }
} else {
  // Not idle or already fading -- reset timer
  this.idleTimers.delete(agent.sessionId);
}
```

**D. Modify manageAgents() -- cancel fade-out on reactivation:**
In `manageAgents()`, after the existing fading_out guard (line 361: `if (agentState === 'fading_out') continue;`), replace it with logic that checks whether this is an idle-timeout fade that should be cancelled:

Replace:
```typescript
// Don't route fading agents -- they're being removed
if (agentState === 'fading_out') continue;
```

With:
```typescript
// Handle fading agents: cancel idle-timeout fades on reactivation, skip session-gone fades
if (agentState === 'fading_out') {
  // Session is still in IPC list AND showing non-idle activity = reactivation
  if (session.activityType !== 'idle' || session.status !== 'idle') {
    agent.cancelFadeOut();
    // Re-read state after cancellation for routing below
  } else {
    continue; // Still idle, let fade-out proceed
  }
}
```

After `agent.cancelFadeOut()`, do NOT continue -- fall through to the normal routing logic below so the reactivated agent gets routed to its building. The `agentState` variable is stale after cancel, but the routing code below re-checks conditions that work correctly because `cancelFadeOut()` sets state to `idle_at_hq`.

However, since `agentState` was captured before the cancel, we need to re-read it. Refactor the agentState capture to happen after the fading_out check. Move the `const agentState = agent.getState();` line (currently at line 358) to AFTER the fading_out block. The fading_out check should use `agent.getState()` directly:

```typescript
// Handle fading agents: cancel idle-timeout fades on reactivation
if (agent.getState() === 'fading_out') {
  if (session.activityType !== 'idle' || session.status !== 'idle') {
    agent.cancelFadeOut();
    // Fall through to routing with fresh state
  } else {
    continue;
  }
}

const agentState = agent.getState();
```

**E. Clean up idleTimers in removeAgent():**
In the `removeAgent()` method, add `this.idleTimers.delete(sessionId);` alongside the other Map cleanups (after `this.lastRawStatus.delete(sessionId)` around line 290).

**F. Clean up idleTimers in manageAgents() cleanup block:**
In the existing cleanup loop near line 419 (`for (const [sessionId] of this.statusDebounce)`), add `this.idleTimers.delete(sessionId);` inside the `if (!currentIds.has(sessionId))` block.

IMPORTANT: The existing fade-out trigger for sessions that disappear from IPC (lines 411-416) must remain unchanged. The idle timeout is an ADDITIONAL trigger -- both paths funnel into the same `startFadeOut()` and `removeAgent()` pipeline. The key difference: idle-timeout fades are cancellable (session still exists in IPC), session-gone fades are not (session is gone).
  </action>
  <verify>
Run `npx tsc --noEmit` from project root. No type errors. Then run `npx electron-vite build` to confirm the full build succeeds. Visually confirm by reading the modified world.ts that:
1. idleTimers Map exists as a class field
2. tick() advances idle timers and triggers fade at IDLE_TIMEOUT_MS
3. manageAgents() cancels fade-out when a fading agent's session shows non-idle activity
4. removeAgent() cleans up idleTimers entry
5. The existing session-gone fade-out trigger (lines 411-416) is preserved unchanged
  </verify>
  <done>
Agents whose sessions remain idle for 5 continuous minutes get startFadeOut() called, entering the existing fade-out lifecycle (2s linger + 2s fade + removeAgent cleanup). If the session shows any non-idle activity or status before the fade completes, cancelFadeOut() restores the agent to idle_at_hq with full alpha, and normal routing resumes. Existing session-disappearance fade-out behavior is unchanged.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npx electron-vite build` succeeds
3. Manual test: Start a Claude Code session, let it go idle, wait 5+ minutes -- agent should fade out and disappear
4. Manual test: Start a session, let it idle for 4 minutes, then send a message -- agent should NOT fade out
5. Manual test: Start a session, let it idle for 5 minutes (fade begins), then send a message during the 2s linger or 2s fade -- fade cancels, agent reappears at full alpha
6. Manual test: Close a Claude Code session entirely -- agent should still fade out immediately (existing behavior)
</verification>

<success_criteria>
- Idle agents fade out and are cleaned up after 5 minutes of continuous idle status
- Reactivated sessions cancel in-progress idle-timeout fades
- Existing session-disappearance fade-out behavior is unchanged
- No TypeScript errors, build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/2-add-idle-timeout-fadeout-agents-whose-se/2-SUMMARY.md`
</output>
