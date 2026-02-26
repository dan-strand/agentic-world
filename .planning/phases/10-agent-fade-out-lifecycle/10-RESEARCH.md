# Phase 10: Agent Fade-Out Lifecycle - Research

**Researched:** 2026-02-26
**Domain:** Agent lifecycle termination in PixiJS 8 renderer -- fade-out animation, container destruction, session resurrection prevention
**Confidence:** HIGH

## Summary

Phase 10 implements the agent fade-out lifecycle: after an agent celebrates task completion and walks back to Guild Hall, it lingers briefly then fades out and is destroyed. This prevents completed agents from accumulating at Guild Hall indefinitely in this always-on application. The feature touches two primary files (`agent.ts` and `world.ts`) plus constants, adding a 6th state (`fading_out`) to the Agent FSM and a complete cleanup pipeline in World.

The codebase is well-prepared for this change. Every pattern needed already exists: timer-based state transitions (celebration timer), alpha fade animation (SpeechBubble fade), `destroy({ children: true })` cleanup (LevelUpEffect), and deferred processing patterns. The key complexity is not in the fade animation itself but in preventing the SessionStore's "never remove" policy from resurrecting faded agents via stale IPC data, and ensuring that ALL tracking Maps in World are cleaned up to prevent memory leaks over extended runtime.

**Primary recommendation:** Add `fading_out` as a 6th agent state with a linger delay + alpha fade, implement a single `removeAgent(sessionId)` method in World that cleans all 8 tracking structures, use a `dismissedSessions` Set to prevent resurrection from stale IPC data, and use deferred removal to avoid concurrent modification during tick iteration.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIFE-01 | Agents fade out at Guild Hall after celebrating instead of persisting indefinitely | Agent FSM extension with `fading_out` state; timer-based linger delay then alpha fade; full container destruction and Map cleanup in World.removeAgent() |
| LIFE-02 | Faded-out agents are not resurrected by session polling unless the session genuinely reactivates | `dismissedSessions: Set<string>` in World blocks recreation from stale IPC; guard in manageAgents() skips routing for fading agents; only genuine reactivation (non-idle activity) clears dismissal |
</phase_requirements>

## Standard Stack

### Core

No new dependencies. All required APIs are already imported and used in the codebase.

| API | Version | Purpose | Why Standard |
|-----|---------|---------|--------------|
| `Container.alpha` | PixiJS 8.16.0 | Alpha fade animation | Already used for SpeechBubble fade and breathing effect; multiplicative through scene hierarchy |
| `Container.destroy({ children: true })` | PixiJS 8.16.0 | Full cleanup of agent + sprite + bubble | Already used in LevelUpEffect cleanup; destroys all children recursively |
| `Container.removeChild()` | PixiJS 8.16.0 | Remove from agentsContainer before destroy | Standard PixiJS scene graph operation |
| Timer + deltaMs pattern | Project convention | Linger delay and fade duration | Used everywhere: celebration timer, speech bubble fade timer, breathing timer |

### What NOT to Use

| Instead of | Do NOT Use | Reason |
|------------|-----------|--------|
| Manual timer + alpha | GSAP/tween library | Every animation in the project uses manual timer + linear interpolation in tick(); adding GSAP for one more fade is inconsistent and adds 30KB |
| `destroy({ children: true })` | `destroy({ children: true, texture: true })` | Agent textures are shared atlas textures -- destroying them would break all other agents using the same spritesheet |
| `dismissedSessions` Set in World | IPC `session-dismiss` channel | Adding a new IPC channel to tell SessionStore to remove sessions is overengineering for max ~4 concurrent sessions. A renderer-side Set is sufficient and avoids main-process changes |
| Deferred removal array | Inline Map.delete during iteration | JavaScript Map iteration handles deletion but the tick loop also touches speechBubbles and other Maps; deferred removal is cleaner and safer |

**Installation:** None required. No new packages.

## Architecture Patterns

### Recommended Changes

```
src/
  renderer/
    agent.ts         # Add 'fading_out' state, linger timer, alpha fade, isFadedOut()
    world.ts         # Add removeAgent(), dismissedSessions Set, deferred cleanup in tick()
  shared/
    constants.ts     # Add AGENT_FADEOUT_DELAY_MS, AGENT_FADEOUT_DURATION_MS
    types.ts         # No changes needed (AgentState is defined in agent.ts, not types.ts)
```

### Pattern 1: Timer-Based State Transition with Linger + Fade (Mirrors Celebration)

**What:** Agent arrives at Guild Hall after celebrating, lingers for a delay, then fades alpha from 1 to 0 over a duration. Two-phase timer: linger delay then fade.

**When to use:** When an agent's `hasCompletedTask` flag is true and state is `idle_at_hq`.

**Example (follows existing celebration timer pattern):**
```typescript
// In agent.ts -- new fading_out case in tick() switch
case 'fading_out': {
  this.fadeOutTimer += deltaMs;
  if (this.fadeOutTimer >= AGENT_FADEOUT_DELAY_MS) {
    const fadeElapsed = this.fadeOutTimer - AGENT_FADEOUT_DELAY_MS;
    const fadeProgress = Math.min(1, fadeElapsed / AGENT_FADEOUT_DURATION_MS);
    this.alpha = 1 - fadeProgress;
  }
  // Skip ALL other visual updates -- no tint, no breathing, no shake
  break;
}
```

This mirrors the celebration timer pattern exactly:
```typescript
// Existing pattern in agent.ts (celebrating state)
case 'celebrating': {
  this.celebrationTimer += deltaMs;
  // ...
  if (this.celebrationTimer >= CELEBRATION_DURATION_MS) {
    // transition
  }
}
```

### Pattern 2: Deferred Removal (Collect-Then-Remove)

**What:** During tick loop, collect sessionIds of agents that need removal into an array. After all agents have been ticked, perform cleanup outside the iteration.

**When to use:** Always, for agent cleanup. Never remove during `for...of` iteration over multiple Maps.

**Example:**
```typescript
// In world.ts tick()
const toRemove: string[] = [];
for (const agent of this.agents.values()) {
  agent.tick(deltaMs);
  // ... debounce logic ...
  if (agent.isFadedOut()) {
    toRemove.push(agent.sessionId);
  }
}

// After all iteration completes
for (const sessionId of toRemove) {
  this.removeAgent(sessionId);
}
```

### Pattern 3: Guard Set for Resurrection Prevention

**What:** Maintain a `dismissedSessions: Set<string>` in World. When an agent is fully removed, add its sessionId to the set. In `manageAgents()`, skip agent creation/routing for sessionIds in this set.

**When to use:** In `manageAgents()` when iterating sessions from IPC.

**Example:**
```typescript
// In world.ts manageAgents()
for (const session of sessions) {
  currentIds.add(session.sessionId);

  // Skip dismissed sessions -- prevents resurrection from stale IPC data
  if (this.dismissedSessions.has(session.sessionId)) {
    // Only clear dismissal if session shows genuine reactivation
    if (session.activityType !== 'idle' && session.status === 'active') {
      this.dismissedSessions.delete(session.sessionId);
      // Fall through to normal agent creation below
    } else {
      continue; // Skip this session entirely
    }
  }

  let agent = this.agents.get(session.sessionId);
  // ... rest of routing logic
}
```

### Pattern 4: Single Cleanup Method (All Maps + Destroy)

**What:** A single `removeAgent(sessionId)` method that cleans ALL tracking structures and destroys the PixiJS container.

**When to use:** Called only from the deferred removal loop in `tick()`.

**Example:**
```typescript
// In world.ts
private removeAgent(sessionId: string): void {
  const agent = this.agents.get(sessionId);
  if (!agent) return;

  // Remove from scene graph
  this.agentsContainer.removeChild(agent);

  // Destroy PixiJS container + all children (AnimatedSprite, SpeechBubble)
  agent.destroy({ children: true });

  // Clean ALL tracking Maps
  this.agents.delete(sessionId);
  this.speechBubbles.delete(sessionId);
  this.lastActivity.delete(sessionId);
  this.statusDebounce.delete(sessionId);
  this.lastCommittedStatus.delete(sessionId);
  this.lastRawStatus.delete(sessionId);
  this.agentBuilding.delete(sessionId);
  this.agentFactory.slotCache?.delete?.(sessionId); // if needed

  // Prevent resurrection
  this.dismissedSessions.add(sessionId);
}
```

### Anti-Patterns to Avoid

- **Fading without destroying:** Setting alpha to 0 is NOT cleanup. The agent container, AnimatedSprite, SpeechBubble, and all Map entries remain in memory. Each invisible agent still gets `tick()` called every frame. Over hours of always-on use, dozens of invisible agents accumulate.

- **Multiple alpha writers during fade:** Agent `applyStatusVisuals()` sets alpha for breathing effect, and `fading_out` state also sets alpha. If breathing runs during fade, it resets alpha to 0.5-1.0. Prevention: in `fading_out` state, skip ALL other visual updates (tint, breathing, shake). The tick() method must check state before calling updateTint/updateBreathing/updateShake.

- **Inline removal during iteration:** Deleting from Maps inside `for...of` loops during tick. Use deferred removal pattern instead.

- **Forgetting the `agentFactory.slotCache`:** The AgentFactory in world.ts caches slots per sessionId. While it uses a deterministic hash (so cache growth is bounded by unique sessions), cleaning it keeps memory tidy. Note: `this.agentFactory` is a class instance, not the singleton, so its `slotCache` is a private Map -- may need to add a `releaseSlot(sessionId)` method or make it accessible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Alpha fade animation | Custom tween system | Manual timer + linear interpolation in tick() | This is the established project pattern; every other animation (celebration, speech bubble, breathing) works this way |
| Scene graph cleanup | Manual removeChild + null references | `Container.destroy({ children: true })` | PixiJS handles recursive child destruction, texture reference counting, and display list cleanup automatically |
| Session dismissal tracking | IPC channel to main process | Renderer-side `Set<string>` | The SessionStore never needs to know about visual cleanup; the renderer can simply ignore stale sessions |

**Key insight:** The entire fade-out lifecycle is implementable with patterns already proven in this codebase. The celebration timer, speech bubble fade, and level-up effect destroy pattern are direct templates.

## Common Pitfalls

### Pitfall 1: Agent Resurrected by Stale IPC Data

**What goes wrong:** Agent fades out and is destroyed. Next 3-second poll arrives from SessionStore, which still includes the idle session. `manageAgents()` sees no agent for this sessionId, creates a new one. Agent appears at Guild Hall, fades out again. Repeats every 3 seconds.

**Why it happens:** SessionStore explicitly never removes sessions: "completed/ended sessions persist until app restart." The session is still `idle` status -- indistinguishable from a genuinely idle session.

**How to avoid:** Maintain `dismissedSessions: Set<string>` in World. After removing an agent, add its sessionId. In `manageAgents()`, skip dismissed sessions. Only clear the dismissal if the session shows genuine reactivation (non-idle activity with `active` status).

**Warning signs:** Agents flickering at Guild Hall; new agents appearing and immediately fading; agent count growing and shrinking on 3-second cycle.

### Pitfall 2: Memory Leak from Incomplete Cleanup

**What goes wrong:** After 30+ minutes with sessions completing, DevTools shows growing memory. `agentsContainer.children.length` increases. CPU ticks grow linearly.

**Why it happens:** Alpha is set to 0 but agent is not destroyed. Or agent is destroyed but Map entries remain. There are 7+ Maps that track per-agent state:
1. `this.agents` (Map<string, Agent>)
2. `this.speechBubbles` (Map<string, SpeechBubble>)
3. `this.lastActivity` (Map<string, ActivityType>)
4. `this.statusDebounce` (Map<string, StatusDebounce>)
5. `this.lastCommittedStatus` (Map<string, SessionStatus>)
6. `this.lastRawStatus` (Map<string, SessionStatus>)
7. `this.agentBuilding` (Map<string, Building>)
8. `this.agentFactory.slotCache` (Map<string, AgentSlot>) -- in AgentFactory instance

**How to avoid:** Single `removeAgent(sessionId)` method that deletes from ALL Maps and calls `agent.destroy({ children: true })`. Never split cleanup across multiple call sites.

**Warning signs:** Task Manager shows Electron memory growing steadily; `agentsContainer.children` array grows over time.

### Pitfall 3: Alpha Writer Conflict During Fade

**What goes wrong:** Agent is fading out (alpha decreasing). `applyStatusVisuals()` is called (because debounce timer committed a status change), resetting alpha via breathing effect (`alpha = 0.5-1.0`). Agent suddenly flashes back to partial visibility mid-fade.

**Why it happens:** `updateBreathing()` directly writes `this.alpha` based on a sine wave. The `fading_out` state also writes `this.alpha`. These are two competing writers.

**How to avoid:** In `tick()`, when state is `fading_out`, skip the calls to `updateTint()`, `updateBreathing()`, and `updateShake()`. The fade-out state must be dominant and exclusive. Also, `applyStatusVisuals()` should be a no-op when state is `fading_out`.

**Warning signs:** Agent flickers or flashes during fade-out; fade appears to reset partway through.

### Pitfall 4: Choppy Fade at Idle Frame Rate

**What goes wrong:** The last active session completes, triggering celebration then fade-out. By the time the agent arrives at Guild Hall and starts fading, GameLoop has dropped to 5fps (because `sessions.some(s => s.status === 'active')` is false). The fade animation at 5fps over 2 seconds = only 10 frames. It looks choppy.

**Why it happens:** `GameLoop.onSessionsUpdate()` checks `sessions.some(s => s.status === 'active')` and drops to 5fps when none are active. A completed session is `idle` status, so no session is `active`, but the agent is still visually animating.

**How to avoid:** GameLoop needs to treat fading agents as requiring active frame rate. Two approaches:
1. World exposes a method like `hasFadingAgents(): boolean` that GameLoop checks.
2. Simpler: the agent's status stays `active` during celebration walkback (it is transitioning, not truly idle). The `active -> idle` transition that triggers completion detection happens via debounce, and by the time the agent reaches Guild Hall it is already idle-debounced. The GameLoop drops FPS before the fade starts.

**Recommended fix:** Add a `hasActiveAnimations(): boolean` method to World that returns true if any agent is in `celebrating`, `walking_to_building`, or `fading_out` state. GameLoop calls this to determine FPS. This is a small addition to the GameLoop-World contract.

**Warning signs:** Fade animation looks stuttery when no other sessions are active.

### Pitfall 5: Speech Bubble Inherits Parent Alpha During Fade

**What goes wrong:** Agent starts fading out while speech bubble is still visible. SpeechBubble's visual alpha becomes `bubbleAlpha * agentAlpha` (multiplicative). Bubble disappears too fast. SpeechBubble's tick() continues running on an invisible bubble, wasting CPU.

**Why it happens:** SpeechBubble is a child of Agent container. PixiJS alpha is multiplicative through the scene hierarchy.

**How to avoid:** When agent enters `fading_out` state, immediately deactivate the speech bubble: set `bubble.visible = false` and mark it inactive so its `tick()` is a no-op. The agent owns the fade-out; children should be deactivated at the start.

**Warning signs:** Speech bubble appears to flash or pop during agent fade; invisible agents still have bubble tick running.

## Code Examples

Verified patterns from existing codebase:

### Agent State Machine Extension

The current 5-state FSM:
```typescript
// agent.ts -- current AgentState union
export type AgentState =
  | 'idle_at_hq'
  | 'walking_to_building'
  | 'walking_to_workspot'
  | 'working'
  | 'celebrating';
```

Extended to 6 states:
```typescript
export type AgentState =
  | 'idle_at_hq'
  | 'walking_to_building'
  | 'walking_to_workspot'
  | 'working'
  | 'celebrating'
  | 'fading_out';
```

### Triggering Fade-Out After Celebration Walk-Back

Currently, when celebration ends, the agent walks to HQ and enters `idle_at_hq`:
```typescript
// agent.ts line 164-176 -- current celebrating case
case 'celebrating': {
  this.celebrationTimer += deltaMs;
  // ...
  if (this.celebrationTimer >= CELEBRATION_DURATION_MS) {
    // Clean up level-up effect
    if (this.levelUpEffect) {
      this.removeChild(this.levelUpEffect);
      this.levelUpEffect.destroy({ children: true });
      this.levelUpEffect = null;
    }
    // Walk directly to HQ
    this.state = 'walking_to_building';
    this.buildingEntrance = this.hqPosition;
    this.workSpotTarget = null; // signals "going to HQ"
  }
}
```

The `walking_to_building` case with `workSpotTarget === null` transitions to `idle_at_hq` on arrival. The new behavior: set a `hasCompletedTask` flag when celebration ends, then in the `idle_at_hq` case, count linger time and transition to `fading_out`.

### Existing Destroy Pattern (LevelUpEffect)

```typescript
// agent.ts lines 166-169 -- the exact destroy pattern to replicate
if (this.levelUpEffect) {
  this.removeChild(this.levelUpEffect);
  this.levelUpEffect.destroy({ children: true });
  this.levelUpEffect = null;
}
```

World's removeAgent() follows the same pattern:
```typescript
this.agentsContainer.removeChild(agent);
agent.destroy({ children: true });
```

### Existing Guard Pattern (Celebration State Protection)

The codebase already guards against routing during celebration:
```typescript
// agent.ts line 320
assignToCompound(entrance, subLocation): void {
  if (this.state === 'celebrating') return; // Guard
  // ...
}
```

The `fading_out` state needs the same guard:
```typescript
assignToCompound(entrance, subLocation): void {
  if (this.state === 'celebrating' || this.state === 'fading_out') return;
  // ...
}
```

### Frame Rate Detection Pattern

Current frame rate determination in GameLoop:
```typescript
// game-loop.ts line 41
const hasActive = sessions.some(s => s.status === 'active');
```

This does not account for visual animations. World can expose:
```typescript
// world.ts -- new method
hasActiveAnimations(): boolean {
  for (const agent of this.agents.values()) {
    const state = agent.getState();
    if (state === 'celebrating' || state === 'walking_to_building' ||
        state === 'walking_to_workspot' || state === 'fading_out') {
      return true;
    }
  }
  return false;
}
```

## State of the Art

| Old Approach (Pre-Phase 10) | New Approach (Phase 10) | Impact |
|------------------------------|-------------------------|--------|
| Agents never removed; accumulate at Guild Hall forever | Agents fade out and are destroyed after celebration + walkback | Stable memory over hours of always-on use |
| SessionStore sessions persist indefinitely; renderer creates agents for every known session | Renderer maintains `dismissedSessions` Set to ignore stale sessions | No agent resurrection from stale IPC data |
| GameLoop FPS based solely on session status | GameLoop FPS considers visual animations (fading agents) | Smooth fade animations even when all sessions are idle |
| 5-state agent FSM | 6-state FSM with `fading_out` terminal state | Clean lifecycle with deterministic cleanup |

## Open Questions

1. **AgentFactory slotCache cleanup**
   - What we know: `AgentFactory` in World is a class instance (not the singleton export) with a private `slotCache` Map. Cleaned sessionIds should be removed from this cache.
   - What's unclear: The `slotCache` field is private with no public delete method. Need to either add a `releaseSlot(sessionId)` method or access the Map directly.
   - Recommendation: Add a `releaseSlot(sessionId: string)` method to AgentFactory. Trivial one-liner.

2. **Linger delay duration**
   - What we know: Research recommends 2-3 seconds linger at Guild Hall before fade begins.
   - What's unclear: Exact value that feels natural needs visual testing.
   - Recommendation: Start with 2000ms (`AGENT_FADEOUT_DELAY_MS`). Easy to tune via constant.

3. **Fade duration**
   - What we know: Research recommends 2-3 seconds for the fade itself. Too fast (<1s) feels abrupt. Too slow (>5s) creates ghost agents.
   - What's unclear: Exact value that feels polished.
   - Recommendation: Start with 2000ms (`AGENT_FADEOUT_DURATION_MS`). Easy to tune.

4. **GameLoop integration scope**
   - What we know: GameLoop drops to 5fps when no sessions are `active`. Fading agents need 30fps for smooth animation.
   - What's unclear: Whether to add a `hasActiveAnimations()` method to World and call it from GameLoop, or use a simpler approach.
   - Recommendation: Add `hasActiveAnimations()` to World. GameLoop checks both session status AND this method. This is a 5-line change total and ensures smooth animations.

## Sources

### Primary (HIGH confidence)

- **Direct codebase analysis** -- All 22 source files read and analyzed:
  - `agent.ts`: 5-state FSM, timer patterns, alpha handling, celebration lifecycle
  - `world.ts`: 8 tracking Maps, manageAgents() routing, tick() iteration, cleanup patterns
  - `session-store.ts`: Never-remove policy confirmed (line 98-101: "We do NOT remove sessions from the map")
  - `speech-bubble.ts`: Auto-fade pattern with isActive guard
  - `game-loop.ts`: FPS determination based on session status
  - `agent-factory.ts`: slotCache Map, deterministic hash
  - `level-up-effect.ts`: destroy({ children: true }) pattern
  - `constants.ts`: All timing constants, existing CELEBRATION_DURATION_MS = 2500ms
  - `types.ts`: SessionInfo structure with status field

- **Project research files** (from milestone research phase):
  - `.planning/research/ARCHITECTURE.md` -- Component modification plan, state machine extension design
  - `.planning/research/PITFALLS.md` -- All 10 pitfalls with prevention strategies
  - `.planning/research/SUMMARY.md` -- Synthesis and phase ordering rationale

### Secondary (MEDIUM confidence)

- [PixiJS 8.x Container API](https://pixijs.download/dev/docs/scene.Container.html) -- alpha, destroy, removeChild behavior
- [PixiJS 8.x Garbage Collection Guide](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- destroy() best practices
- [PixiJS Issue #3955](https://github.com/pixijs/pixijs/issues/3955) -- visible vs renderable vs alpha: alpha = 0 still processes transforms; destroy is needed for true cleanup

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all APIs already used in codebase
- Architecture: HIGH -- every pattern needed (timer transitions, alpha fade, deferred removal, destroy) already exists in the codebase; direct templates available
- Pitfalls: HIGH -- sourced from PixiJS documentation, GitHub issues, and direct code inspection; all have concrete prevention strategies
- State machine extension: HIGH -- follows exact same timer pattern as existing `celebrating` state

**Research date:** 2026-02-26
**Valid until:** Indefinite for this project scope (no external dependencies to go stale)
