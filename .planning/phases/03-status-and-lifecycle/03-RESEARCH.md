# Phase 3: Status and Lifecycle - Research

**Researched:** 2026-02-25
**Domain:** PixiJS 8 visual status effects (tint, filters, animation), particle-like fireworks, agent state machine lifecycle extension
**Confidence:** HIGH

## Summary

Phase 3 adds three capabilities to the existing agent system: (1) visual status differentiation so users can distinguish active, waiting, idle, and error agents at a glance, (2) a fireworks celebration animation when a session completes its task, and (3) the full walk-back-to-HQ lifecycle loop after celebration. The technical foundation from Phase 2 is solid -- the agent state machine, GraphicsContext frame-swapping animation, compound layout, and vehicle system are all in place and working.

For status differentiation, the approach combines two PixiJS 8 features: the `tint` property (available on all scene objects including Container and Graphics, and inherited by children in v8) for color shifts, and the `alpha` property for pulsing/breathing effects. The `tint` property is the primary tool: amber tint for waiting (0xffaa44), red tint for error (0xff4444), and desaturated gray tint for idle (0x888888). Active agents keep their vivid original colors with `tint = 0xffffff` (no tint). The `ColorMatrixFilter` is available built-in from `pixi.js` and provides `desaturate()`, `saturate()`, `brightness()` methods -- but for this use case, simple tint manipulation is lighter weight and sufficient. Filters render to off-screen textures and are heavier than direct property manipulation.

For fireworks, the recommendation is to build a lightweight custom particle system using plain Graphics objects rather than depending on a third-party particle library. The official `@pixi/particle-emitter` does not have stable PixiJS 8 support (only an unofficial fork exists with known limitations). A fireworks effect only needs 20-40 small Graphics objects (sparks) per burst that fly outward with gravity, fade, and are removed. This is trivially implementable with the existing tick-based animation pattern and avoids adding a dependency with uncertain v8 compatibility.

**Primary recommendation:** Use `tint` property on Agent container for status colors, `alpha` oscillation for waiting breathing effect, simple shake offset for error entry. Build fireworks as a self-contained Fireworks class using pooled Graphics spark objects. Extend the Agent state machine with `celebrating` and `driving_to_hq` states (driving_to_hq already exists). Status debouncing lives in the renderer's World class, comparing previous vs current status with a 2-3 second timer before committing visual changes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Active** (Claude working): Bright/vivid saturated colors, working animation at normal speed. The energetic, default "alive" look.
- **Waiting** (needs user input): Amber-tinted pulsing/breathing effect — slow scale or alpha oscillation. Gentle but noticeable "I'm waiting on you" signal.
- **Idle** (30+ seconds no activity): Desaturated/grayish colors, animation slowed to near-still. Agent looks dormant/sleepy. Clear contrast with active.
- **Error**: Red tint + brief shake/jitter animation on initial transition, then settles to a red-tinted idle pose. Alarming but not overwhelming.
- Fireworks above the agent — small pixel firework explosions above their head
- Multi-color burst palette (gold, red, blue, green sparks) — not agent-colored
- Duration: 2-3 seconds before agent starts heading back to HQ
- Multiple simultaneous completions: celebrations overlap independently (no queuing)
- Each active→idle transition triggers a celebration (multiple per session allowed)
- After fireworks, agent drives back to HQ in their vehicle (same travel mechanic as deployment)
- At HQ: agent parks, stands idle near the HQ entrance. Visible as "available."
- When last agent leaves a project compound: compound fades out over 2-3 seconds and despawns
- If agent at HQ gets a new task: immediately redeploy (hop in vehicle, drive to compound). No delay.
- Status visual changes use smooth crossfade over 0.5-1 second (color/effect blends between old and new state)
- Status debouncing: only commit to a visual state change if the new status holds for 2-3 seconds. Prevents jittery flickering.
- Completion detection: session was "active" and transitions to "idle" (30s threshold) = task complete → trigger celebration

### Claude's Discretion
- Exact firework particle count and spread pattern
- Precise crossfade easing curve
- Debounce exact threshold (2 or 3 seconds)
- How idle agents space out near HQ entrance (avoid stacking)
- Firework spark size and fade speed
- Whether shake animation for error is horizontal, vertical, or both

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATUS-01 | Active, waiting, idle, and error states are visually distinct through agent appearance or animation | PixiJS 8 `tint` property on Container (inherited by children) for color shifts. Alpha oscillation for waiting breathing. Animation speed modulation for idle. Shake offset for error entry. ColorMatrixFilter available as backup for more complex desaturation but tint is lighter weight. |
| STATUS-02 | Agents play a celebration animation when their session completes a task | Custom Fireworks class using pooled Graphics spark objects. 20-40 sparks per burst, multi-color palette (gold, red, blue, green), gravity + fade physics. Completion detection via active→idle status transition tracked in World. No third-party particle library needed. |
| STATUS-03 | After celebration, agents walk back to the HQ building and remain there | Agent state machine extended with `celebrating` state. After fireworks timer (2-3s), transitions to existing `walking_to_entrance` → `driving_to_hq` → `idle_at_hq` flow. Compound despawn when last agent leaves already implemented (500ms fade-out, increase to 2-3s per user decision). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | ^8.16.0 | `tint` property for status colors, `alpha` for breathing, `ColorMatrixFilter` (built-in) for desaturation if needed, Graphics for firework sparks | Already installed. All status visual features are built into the core library. No new dependencies. |
| electron | 40.6.1 | Desktop shell | Already installed. No changes needed. |
| typescript | ~5.7 | Type safety | Already installed. Strict mode continues. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | Phase 3 requires no new dependencies. Fireworks are built with plain Graphics objects. Status effects use built-in tint/alpha/filter properties. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom firework sparks via Graphics | @pixi/particle-emitter | Official particle-emitter lacks stable PixiJS 8 support. Community fork (@barvynkoa/particle-emitter) has known limitations. Custom sparks are 50-80 lines of code and fully sufficient for 20-40 particles per burst. |
| Container.tint for status colors | ColorMatrixFilter.desaturate() for idle | ColorMatrixFilter renders to off-screen texture per frame -- heavier than direct tint property. Tint is a simple color multiply, zero overhead. Use filter only if tint proves insufficient for the desaturation look. |
| Manual alpha oscillation for waiting | GSAP tween library | GSAP adds bundle size for a single sine-wave oscillation. Manual `Math.sin(timer)` is one line and matches existing animation patterns. |

**Installation:**
```bash
# No new packages needed -- pixi.js ^8.16.0 already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/
├── agent.ts                  # Extended: new states (celebrating), status visual methods
├── agent-sprites.ts          # No changes (body frames already built)
├── fireworks.ts              # NEW: Fireworks particle effect class
├── world.ts                  # Extended: status debouncing, completion detection, celebration trigger
├── (all other files)         # No changes needed
src/shared/
├── types.ts                  # Extended: possibly add completion event type
├── constants.ts              # Extended: firework constants, status timing constants
```

### Pattern 1: Container Tint for Status Color
**What:** Use the `tint` property on the Agent container to shift all child Graphics (body, accessory) to a status-appropriate color. In PixiJS 8, tint is inherited by children and performs a GPU color multiply -- zero geometry rebuild.
**When to use:** Every status transition (after debounce confirms new status).
**Example:**
```typescript
// Source: PixiJS 8 Scene Objects docs (pixijs.com/8.x/guides/components/scene-objects)
// tint is inherited by child objects in v8

class Agent extends Container {
  private statusTint: number = 0xffffff; // no tint = active (vivid)
  private targetTint: number = 0xffffff;
  private tintTransitionTimer = 0;
  private readonly TINT_TRANSITION_MS = 750; // 0.5-1s crossfade

  applyStatusVisuals(status: SessionStatus): void {
    switch (status) {
      case 'active':
        this.targetTint = 0xffffff;  // No tint -- vivid original colors
        break;
      case 'waiting':
        this.targetTint = 0xffaa44;  // Amber tint
        break;
      case 'idle':
        this.targetTint = 0x888888;  // Gray/desaturated
        break;
      case 'error':
        this.targetTint = 0xff4444;  // Red tint
        break;
    }
    this.tintTransitionTimer = 0; // Start crossfade
  }

  // In tick: interpolate tint over time
  private updateTint(deltaMs: number): void {
    if (this.statusTint === this.targetTint) return;
    this.tintTransitionTimer += deltaMs;
    const t = Math.min(1, this.tintTransitionTimer / this.TINT_TRANSITION_MS);
    this.tint = lerpColor(this.statusTint, this.targetTint, t);
    if (t >= 1) {
      this.statusTint = this.targetTint;
      this.tint = this.targetTint;
    }
  }
}
```

### Pattern 2: Alpha Breathing for Waiting Status
**What:** Oscillate the agent's alpha between ~0.5 and 1.0 using a slow sine wave to create a breathing/pulsing effect when waiting for user input.
**When to use:** When status is 'waiting'. Stop oscillation on status change.
**Example:**
```typescript
// Breathing effect: slow sinusoidal alpha oscillation
private breathTimer = 0;
private readonly BREATH_SPEED = 0.002; // ~3 second full cycle
private readonly BREATH_MIN = 0.5;
private readonly BREATH_MAX = 1.0;

private updateBreathing(deltaMs: number): void {
  this.breathTimer += deltaMs * this.BREATH_SPEED;
  const t = (Math.sin(this.breathTimer) + 1) / 2; // 0..1
  this.alpha = this.BREATH_MIN + t * (this.BREATH_MAX - this.BREATH_MIN);
}
```

### Pattern 3: Error Shake Animation
**What:** Brief horizontal shake/jitter on error transition, then settle to a red-tinted idle pose. Uses a damped oscillation on the agent's x position offset.
**When to use:** On initial transition to error status only (not sustained).
**Example:**
```typescript
private shakeTimer = 0;
private isShaking = false;
private readonly SHAKE_DURATION = 600; // 0.6 seconds
private readonly SHAKE_AMPLITUDE = 4;  // 4px max displacement
private shakeOriginX = 0;

triggerShake(): void {
  this.isShaking = true;
  this.shakeTimer = 0;
  this.shakeOriginX = this.x;
}

private updateShake(deltaMs: number): void {
  if (!this.isShaking) return;
  this.shakeTimer += deltaMs;
  const progress = this.shakeTimer / this.SHAKE_DURATION;
  if (progress >= 1) {
    this.isShaking = false;
    this.x = this.shakeOriginX;
    return;
  }
  // Damped oscillation: amplitude decreases as progress increases
  const dampedAmplitude = this.SHAKE_AMPLITUDE * (1 - progress);
  const frequency = 20; // High frequency for jitter
  this.x = this.shakeOriginX + Math.sin(progress * frequency) * dampedAmplitude;
}
```

### Pattern 4: Idle Animation Slowdown
**What:** When status is idle, slow the animation frame rate significantly (e.g., 4x slower) to create a dormant/sleepy appearance combined with the gray tint.
**When to use:** When status is 'idle'.
**Example:**
```typescript
// In animateFrames, use a speed multiplier based on status
private animationSpeedMultiplier = 1.0;

// Active: 1.0, Idle: 0.25 (4x slower), Waiting: 0.5, Error: 0
private getAnimationSpeed(): number {
  switch (this.visualStatus) {
    case 'active': return 1.0;
    case 'waiting': return 0.5;
    case 'idle': return 0.25;
    case 'error': return 0; // frozen
  }
}

// In animateFrames:
private animateFrames(deltaMs: number, state: AnimState): void {
  const speed = this.getAnimationSpeed();
  this.frameTimer += deltaMs * speed;
  if (this.frameTimer >= ANIMATION_FRAME_MS) {
    // ... frame advance as before
  }
}
```

### Pattern 5: Custom Fireworks Particle System
**What:** A self-contained Fireworks class that creates a burst of 25-35 small Graphics spark objects above an agent, applies gravity and alpha fade, then cleans up. Uses object pooling for efficiency.
**When to use:** When a session completion is detected (active→idle transition).
**Example:**
```typescript
import { Container, Graphics } from 'pixi.js';

interface Spark {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const FIREWORK_COLORS = [0xffd700, 0xff4444, 0x4488ff, 0x44cc44]; // gold, red, blue, green

class Fireworks extends Container {
  private sparks: Spark[] = [];
  private elapsed = 0;
  private readonly DURATION = 2500; // 2.5 seconds total
  private done = false;

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);
    this.createBurst();
  }

  private createBurst(): void {
    const count = 25 + Math.floor(Math.random() * 10); // 25-35 sparks
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80; // 40-120 px/s
      const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      const size = 1.5 + Math.random() * 2; // 1.5-3.5px sparks

      const gfx = new Graphics();
      gfx.circle(0, 0, size).fill(color);

      this.addChild(gfx);
      this.sparks.push({
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60, // initial upward bias
        life: 0,
        maxLife: 1500 + Math.random() * 1000, // 1.5-2.5s per spark
      });
    }
  }

  tick(deltaMs: number): boolean {
    if (this.done) return true;
    this.elapsed += deltaMs;

    for (const spark of this.sparks) {
      spark.life += deltaMs;
      const dt = deltaMs / 1000;

      // Physics: velocity + gravity
      spark.vy += 80 * dt; // gravity
      spark.gfx.x += spark.vx * dt;
      spark.gfx.y += spark.vy * dt;

      // Fade out based on life
      const lifeRatio = spark.life / spark.maxLife;
      spark.gfx.alpha = Math.max(0, 1 - lifeRatio);
    }

    if (this.elapsed >= this.DURATION) {
      this.done = true;
    }

    return this.done;
  }

  isDone(): boolean {
    return this.done;
  }
}
```

### Pattern 6: Status Debouncing in World
**What:** Track the pending status per agent. Only commit a visual status change if the new status holds for 2-3 seconds. Prevents jittery flickering between states.
**When to use:** In World.manageAgents() when processing session updates.
**Example:**
```typescript
interface StatusDebounce {
  pendingStatus: SessionStatus;
  timer: number;          // ms accumulated
  committedStatus: SessionStatus;
}

private statusDebounce: Map<string, StatusDebounce> = new Map();
private readonly DEBOUNCE_MS = 2500; // 2.5 seconds

private updateAgentStatus(sessionId: string, newStatus: SessionStatus, deltaMs: number): SessionStatus {
  let debounce = this.statusDebounce.get(sessionId);
  if (!debounce) {
    debounce = { pendingStatus: newStatus, timer: 0, committedStatus: newStatus };
    this.statusDebounce.set(sessionId, debounce);
    return newStatus;
  }

  if (newStatus === debounce.committedStatus) {
    // Status unchanged from committed -- reset pending
    debounce.pendingStatus = newStatus;
    debounce.timer = 0;
    return debounce.committedStatus;
  }

  if (newStatus === debounce.pendingStatus) {
    // Same pending status -- accumulate time
    debounce.timer += deltaMs;
    if (debounce.timer >= this.DEBOUNCE_MS) {
      // Debounce threshold met -- commit the change
      debounce.committedStatus = newStatus;
      debounce.timer = 0;
      return newStatus;
    }
  } else {
    // Different pending status -- reset debounce
    debounce.pendingStatus = newStatus;
    debounce.timer = 0;
  }

  return debounce.committedStatus; // Return old committed status
}
```

### Pattern 7: Completion Detection
**What:** Detect when a session completes a task by tracking the transition from active→idle. The session was "active" and transitions to "idle" (30s threshold met) = task complete.
**When to use:** In World.manageAgents() after debouncing confirms the status change.
**Example:**
```typescript
// Track last committed status per agent for transition detection
private lastCommittedStatus: Map<string, SessionStatus> = new Map();

private checkForCompletion(sessionId: string, newCommittedStatus: SessionStatus): boolean {
  const prev = this.lastCommittedStatus.get(sessionId);
  this.lastCommittedStatus.set(sessionId, newCommittedStatus);

  // Completion = was active, now idle
  return prev === 'active' && newCommittedStatus === 'idle';
}
```

### Anti-Patterns to Avoid
- **Using ColorMatrixFilter for simple tint effects:** Filters render to off-screen textures and are significantly heavier than the `tint` property. Use `tint` for color shifts; only use filters if you need effects that tint cannot achieve (like non-uniform desaturation).
- **Creating new Graphics objects for each firework burst:** Pool and reuse spark Graphics objects. Each burst creates 25-35 objects; frequent completions would leak memory without cleanup.
- **Debouncing status in the main process:** Debouncing belongs in the renderer where visual state is managed, not in the session detector which reports raw data. Keep the data pipeline honest and debounce at the display layer.
- **Coupling celebration to the session detection layer:** Completion detection is a renderer concern (comparing committed visual states), not a detection concern. The detector reports raw status; the renderer interprets transitions.
- **Modifying body GraphicsContext objects for status:** Do not rebuild or alter the pre-built body frame GraphicsContexts. They are shared across all agents of the same color. Use the Container's `tint` property to overlay status colors without touching the cached frames.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color tinting for status | Custom color matrix shader | `Container.tint = 0xrrggbb` | Built-in, inherited by children, zero overhead. PixiJS 8 handles the GPU color multiply. |
| Desaturation for idle | Manual RGB channel manipulation | `Container.tint = 0x888888` (gray multiply) | Gray tint on vivid colors produces a washed-out/desaturated look. Close enough to true desaturation and vastly simpler than a filter. |
| Alpha breathing oscillation | Tween library (GSAP, pixi-actions) | `Math.sin(timer) * range + offset` | One line of math. Tween libraries add bundle size for a trivial calculation. |
| Particle fireworks | @pixi/particle-emitter (no stable v8) | Custom Fireworks class with Graphics sparks | 50-80 lines of code. Particle-emitter lacks stable PixiJS 8 support. Custom implementation matches existing tick-based animation patterns. |
| Color interpolation | External color library | Simple per-channel lerp: `r1 + (r2-r1)*t` | 5 lines of code. No need for a color library for linear RGB interpolation. |

**Key insight:** Phase 3's visual effects are all achievable with built-in PixiJS 8 properties (`tint`, `alpha`, `visible`, `position`) and simple math (sine waves, linear interpolation, damped oscillation). No new libraries are needed. The fireworks are the most complex new code and still only need ~80 lines.

## Common Pitfalls

### Pitfall 1: Tint Color Multiply Math
**What goes wrong:** Setting `tint = 0xff0000` (pure red) on an agent with a blue trenchcoat produces black (red * blue = 0 in each channel). Tint is a multiplicative blend, not additive.
**Why it happens:** Misunderstanding that tint multiplies per-channel, not blends/overlays.
**How to avoid:** Use light, pastel-ish tint values that preserve some of the original color. For amber: `0xffaa44` (not `0xff8800`). For error red: `0xff4444` (not `0xff0000`). For idle gray: `0x888888` (darkens all channels equally). For active: `0xffffff` (no tint). Test with multiple agent colors to ensure visibility.
**Warning signs:** Dark-colored agents becoming nearly invisible under tint. Agent colors becoming indistinguishable from each other.

### Pitfall 2: Status Debounce Timing vs Poll Interval
**What goes wrong:** Status flickers because the debounce timer advances only when IPC updates arrive (every 3 seconds), not on every tick.
**Why it happens:** Debounce timer is incremented only in `updateSessions()` (called every 3s poll cycle), not in `tick()`.
**How to avoid:** Two approaches: (A) increment debounce timers in tick() using deltaMs, checking the last received status, or (B) use the session update count/timestamp instead of elapsed time. Approach A is simpler and matches the existing tick-based pattern. Debounce threshold of ~2.5s means the status must hold across at least one full poll cycle.
**Warning signs:** Status changes appearing instant despite debounce code, or taking far too long (9+ seconds) to commit.

### Pitfall 3: Firework Spark Memory Leaks
**What goes wrong:** Graphics objects from completed firework bursts remain in the scene graph, consuming GPU memory.
**Why it happens:** Forgetting to call `removeChild()` and `destroy()` on spark Graphics after the firework animation completes.
**How to avoid:** The Fireworks class must have a cleanup method that removes all spark children and destroys them. The World class must check `fireworks.isDone()` each tick and clean up finished instances. Consider a maximum active fireworks limit (e.g., 8 simultaneous) to cap memory usage.
**Warning signs:** Memory usage creeping up over time. Spark count in scene graph increasing monotonically.

### Pitfall 4: Celebration Triggering on App Startup
**What goes wrong:** On app startup, all sessions start with no previous status, and when the first poll comes in showing "idle" sessions, the completion detector incorrectly triggers celebrations for every idle session.
**Why it happens:** The previous status is undefined on first update, and `undefined` to `idle` looks like a state transition.
**How to avoid:** Initialize `lastCommittedStatus` for each agent to their first received status without triggering completion detection. Only detect completions after the second status update for a given agent.
**Warning signs:** All agents celebrating simultaneously right after app launch. Fireworks firing before any agent has been "active."

### Pitfall 5: Agent State Machine Conflict with Celebrating State
**What goes wrong:** The agent starts celebrating (fireworks playing), but a new status update reassigns it to a compound before the celebration finishes.
**Why it happens:** `updateSessions()` fires every 3 seconds. During the 2-3 second celebration window, a new update may try to send the agent to a compound.
**How to avoid:** While agent state is `celebrating`, ignore compound assignment requests. Only after celebration completes and agent transitions to `walking_to_entrance`/`driving_to_hq` should it accept new assignments. The agent should queue any pending assignment for after it arrives at HQ.
**Warning signs:** Agent teleporting from celebration to compound. Fireworks playing while agent is already driving.

### Pitfall 6: Compound Despawn Timing with Celebrations
**What goes wrong:** All agents at a compound become idle (triggering celebrations), but the compound immediately starts fading out while agents are still celebrating above it.
**Why it happens:** Compound despawn is triggered by "all sessions idle for project" which happens at the same time celebrations start.
**How to avoid:** Delay compound despawn evaluation until all celebrating agents have left the compound. The compound should only start fading when no agents are working, celebrating, or walking within it -- only after the last agent has entered its vehicle and is driving away.
**Warning signs:** Fireworks playing over a fading/invisible compound. Agent appears to celebrate in empty space.

## Code Examples

### Color Lerp Utility
```typescript
// Source: Standard per-channel linear interpolation
function lerpColor(from: number, to: number, t: number): number {
  const r1 = (from >> 16) & 0xff;
  const g1 = (from >> 8) & 0xff;
  const b1 = from & 0xff;
  const r2 = (to >> 16) & 0xff;
  const g2 = (to >> 8) & 0xff;
  const b2 = to & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}
```

### Extended Agent State Machine
```typescript
// Source: Existing agent.ts, extended for Phase 3
export type AgentState =
  | 'idle_at_hq'
  | 'driving_to_compound'
  | 'walking_to_sublocation'
  | 'working'
  | 'celebrating'            // NEW: fireworks playing above agent
  | 'walking_to_entrance'
  | 'driving_to_hq';

// New lifecycle:
// working -> celebrating (2-3s fireworks) -> walking_to_entrance -> driving_to_hq -> idle_at_hq
```

### Status Tint Constants
```typescript
// Source: User decisions from CONTEXT.md
export const STATUS_TINTS = {
  active:  0xffffff,  // No tint -- vivid original colors
  waiting: 0xffcc66,  // Warm amber tint
  idle:    0x777788,  // Gray/desaturated
  error:   0xff5555,  // Red tint
} as const;

// Animation speed multipliers per status
export const STATUS_ANIM_SPEED = {
  active:  1.0,   // Normal speed
  waiting: 0.5,   // Half speed
  idle:    0.2,   // Near-still
  error:   0.0,   // Frozen
} as const;

// Firework constants
export const FIREWORK_SPARK_COUNT_MIN = 25;
export const FIREWORK_SPARK_COUNT_MAX = 35;
export const FIREWORK_DURATION_MS = 2500;
export const FIREWORK_COLORS = [0xffd700, 0xff4444, 0x4488ff, 0x44cc44] as const;
export const FIREWORK_GRAVITY = 80;     // px/s^2
export const FIREWORK_SPARK_SPEED_MIN = 40;
export const FIREWORK_SPARK_SPEED_MAX = 120;

// Status timing
export const STATUS_CROSSFADE_MS = 750;
export const STATUS_DEBOUNCE_MS = 2500;
export const SHAKE_DURATION_MS = 600;
export const BREATH_CYCLE_SPEED = 0.002; // ~3 second full cycle
```

### Fireworks Integration with Agent
```typescript
// In Agent class:
private fireworks: Fireworks | null = null;

startCelebration(): void {
  this.state = 'celebrating';
  // Fireworks positioned above agent head (-40px up)
  this.fireworks = new Fireworks(0, -40);
  this.addChild(this.fireworks);
}

// In tick, during 'celebrating' state:
case 'celebrating':
  if (this.fireworks) {
    const done = this.fireworks.tick(deltaMs);
    if (done) {
      this.removeChild(this.fireworks);
      this.fireworks.destroy({ children: true });
      this.fireworks = null;
      // Transition: start walking to compound entrance, then drive to HQ
      if (this.compoundEntrance) {
        this.state = 'walking_to_entrance';
        this.setBodyFrames('walking');
      } else {
        this.onArrivedAtHQ(); // Fallback: teleport to HQ
      }
    }
  }
  break;
```

### Completion Detection in World
```typescript
// In World.manageAgents():
for (const session of sessions) {
  // ... existing agent management ...

  // Status debouncing
  const debouncedStatus = this.updateAgentStatus(
    session.sessionId,
    session.status,
    /* time since last update */
  );

  // Apply visual status to agent
  agent.applyStatusVisuals(debouncedStatus);

  // Completion detection (active → idle transition after debounce)
  if (this.checkForCompletion(session.sessionId, debouncedStatus)) {
    // Only celebrate if agent is currently working at a compound
    if (agent.getState() === 'working') {
      agent.startCelebration();
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PIXI.Container had no tint property | Container.tint inherited by children | PixiJS 8.0.0 (2024) | Can tint an entire agent (body + accessory) by setting one property on the parent Container. No per-child manipulation needed. |
| ColorMatrixFilter for all color effects | tint + alpha for simple effects, filter only for complex | PixiJS 8.0.0+ | Filters are powerful but render to off-screen textures. For status colors, direct tint is lighter weight and sufficient. |
| @pixi/particle-emitter (v7 compatible) | No stable v8 particle library | 2024 (v8 release) | Official particle-emitter lacks v8 support. Custom Graphics-based particles are the practical path for small effects. |
| graphics.lineStyle() + beginFill() | graphics.circle().fill(color) chain | PixiJS 8.0.0 (2024) | v8 chain pattern applies to firework spark drawing. |

**Deprecated/outdated:**
- `@pixi/particle-emitter` (official): Not v8 compatible. Community fork exists but unstable.
- Container tint workarounds (setTintForChildren): No longer needed -- v8 Container.tint inherits naturally.

## Open Questions

1. **Tint appearance across all 8 agent colors**
   - What we know: Tint is multiplicative. Amber tint (0xffcc66) on a teal agent (0x00d4aa) will shift colors. Gray tint (0x777788) will desaturate.
   - What's unclear: Whether the specific tint values look good across all 8 palette colors. Some combinations may look muddy.
   - Recommendation: Start with the proposed tint values. During visual verification, test all 8 agent colors in each status state and adjust tint values if needed. This is a tuning exercise, not an architectural risk.

2. **Debounce timer advancement method**
   - What we know: Session updates arrive every 3 seconds (POLL_INTERVAL_MS). The debounce threshold is 2.5 seconds.
   - What's unclear: Whether to advance the debounce timer in tick() (smooth, needs to store last-received status) or only on updateSessions() calls (simpler, but coarser 3s granularity).
   - Recommendation: Advance in tick() using deltaMs for smooth transitions. Store the last received raw status from IPC and compare against the committed status each tick. This gives sub-second accuracy and smooth crossfade timing.

3. **Compound fade-out timing with celebrating agents**
   - What we know: Compounds currently fade over 500ms. User wants 2-3 second fade. Celebrations last 2-3 seconds.
   - What's unclear: Whether the compound should wait for all celebrations to finish before starting to fade, or if they can overlap.
   - Recommendation: Delay compound fade-out start until all agents have physically left the compound (state is driving_to_hq or idle_at_hq). This avoids fireworks over a vanishing compound. Increase compound fade duration from 500ms to 2500ms per user decision.

## Sources

### Primary (HIGH confidence)
- [PixiJS 8 Scene Objects](https://pixijs.com/8.x/guides/components/scene-objects) - Confirmed tint property on all scene objects, inherited by children in v8
- [PixiJS 8 Container API](https://pixijs.download/release/docs/scene.Container.html) - Confirmed tint, alpha, filters properties on Container
- [PixiJS 8 ColorMatrixFilter API](https://pixijs.download/dev/docs/filters.ColorMatrixFilter.html) - desaturate(), saturate(), brightness(), tint() methods; imported from 'pixi.js'
- [PixiJS 8 Filters Guide](https://pixijs.com/8.x/guides/components/filters) - Filters apply to Container/Sprite/Graphics; ColorMatrixFilter is built-in
- [PixiJS 8 Color Guide](https://pixijs.com/8.x/guides/components/color) - Color formats, tint property usage patterns
- Existing codebase analysis (2026-02-25) - Agent state machine, GraphicsContext frame-swapping, compound lifecycle, world.ts integration

### Secondary (MEDIUM confidence)
- [PixiJS particle-emitter v8 issue](https://github.com/pixijs/particle-emitter/issues/211) - Confirmed no stable v8 support for official particle-emitter
- [@spd789562/particle-emitter](https://jsr.io/@spd789562/particle-emitter) - Community v8 fork exists but with known limitations

### Tertiary (LOW confidence)
- None -- all critical findings verified against PixiJS 8 official docs and existing working codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies needed. All visual features use built-in PixiJS 8 properties (tint, alpha, filters) verified in official docs.
- Architecture: HIGH -- Extends existing, working Agent state machine and World management patterns. Fireworks class follows established GraphicsContext and tick-based animation patterns from Phase 2.
- Pitfalls: HIGH -- Tint multiply math is well-documented. Debounce timing derives from known poll interval. Memory management for fireworks follows standard PixiJS cleanup patterns. Startup celebration false-positive is an edge case identified through analysis.
- Status effects: HIGH -- Container.tint inheritance confirmed as a PixiJS 8 feature in official docs. Alpha oscillation and shake animation use basic math already used elsewhere in the codebase.

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- PixiJS 8 tint/filter API is settled, agent state machine architecture is internal)
