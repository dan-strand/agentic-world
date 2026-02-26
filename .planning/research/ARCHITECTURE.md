# Architecture Research

**Domain:** Integrating dynamic building labels, auto-fading speech bubbles with text, and agent fade-out lifecycle into existing Fantasy RPG PixiJS/Electron visualizer
**Researched:** 2026-02-26
**Confidence:** HIGH

---

## Context: Three Targeted Feature Additions

The v1.2 milestone adds three features to a fully working v1.1 system. The core architecture -- Electron main process polling JSONL files, IPC bridge, PixiJS game loop, Agent 5-state FSM, static Building instances, SpeechBubble with auto-fade -- stays intact. The work is:

1. **Dynamic building labels** -- Buildings show active project folder names instead of RPG names when agents are working there
2. **Speech bubble text** -- Speech bubbles already auto-fade (SPEECH_BUBBLE_DURATION + SPEECH_BUBBLE_FADE_MS exist); need to show current activity text content
3. **Agent fade-out lifecycle** -- Agents fade out and get removed after celebrating + walking back to Guild Hall, instead of accumulating forever

All three features touch `src/renderer/` only. No changes to `src/main/`, `src/preload/`, or IPC contracts are needed -- SessionInfo already carries `projectName`, `activityType`, and `status`.

---

## Current vs. Target Architecture

### Current Scene Hierarchy (v1.1 -- unchanged)

```
app.stage [ColorMatrixFilter warm tint]
+-- tilemapLayer              (canvas-rendered grass + dirt paths)
+-- buildingsContainer        (Guild Hall + 4 quest zone Buildings)
|   +-- Building              (Container: Sprite + static BitmapText label)
+-- ambientParticles          (floating firefly particles)
+-- agentsContainer           (dynamic Agent children)
    +-- Agent                 (Container: AnimatedSprite + SpeechBubble child)
        +-- SpeechBubble      (Container: Graphics bubble + Graphics icon)
        +-- LevelUpEffect     (temporary, during celebration only)
```

### Target Scene Hierarchy (v1.2)

```
app.stage [ColorMatrixFilter warm tint]
+-- tilemapLayer              (unchanged)
+-- buildingsContainer        (unchanged container)
|   +-- Building              (Container: Sprite + DYNAMIC BitmapText label)  <-- MODIFIED
+-- ambientParticles          (unchanged)
+-- agentsContainer           (dynamic Agent children -- now with removal lifecycle)
    +-- Agent                 (Container -- now with 'fading_out' state)  <-- MODIFIED
        +-- SpeechBubble      (Container -- now with BitmapText activity text)  <-- MODIFIED
        +-- LevelUpEffect     (unchanged)
```

---

## Feature 1: Dynamic Building Labels

### Current State

`Building` constructor creates a static `BitmapText` label from `BUILDING_LABELS[buildingType]` (e.g., "Wizard Tower"). The label is set once and never updated. The BitmapText instance is added as a child but not stored as a class property -- it is unreachable after construction.

### What Needs to Change

| Component | Change Type | Details |
|-----------|-------------|---------|
| `Building` class | MODIFY | Store label as `private label: BitmapText`, add `setLabel(text)` and `resetLabel()` methods |
| `World.tick()` | MODIFY | After computing `activeBuildingTypes`, compute project-to-building mapping and call `setLabel()` / `resetLabel()` |
| `constants.ts` | ADD | `MAX_LABEL_CHARS` constant (truncation threshold for long project names) |

### Data Flow

```
SessionInfo[]
    |
    v
World.tick() -- already iterates agents to find activeBuildingTypes
    |
    +-- For each quest zone building:
    |     Collect projectNames of agents working at this building
    |     If any active agents:
    |       building.setLabel(projectName)      // e.g., "Agent World"
    |     Else:
    |       building.resetLabel()               // back to "Wizard Tower"
    |
    v
Building.setLabel(text) -- update BitmapText.text property
```

### Key Design Decision: Which Project Name to Show

A building can have multiple agents from different projects (e.g., two sessions both using `coding` activity route to Wizard Tower). Options:

1. **Show first project name only** -- Simple, always fits, may hide information
2. **Show all project names joined** -- Too long for a signpost label
3. **Show project name with count** -- "Agent World (+1)" when multiple projects

Recommendation: **Option 3** -- show primary project name (first active agent's project) with a count suffix when multiple distinct projects are present. This fits the signpost width constraint while being informative.

### Integration Points

- `Building.label` must be stored as a class property (currently anonymous `addChild()` call)
- `World` already tracks `lastActivity` per agent and knows which agents are at which building via the `activeBuildingTypes` loop in `tick()`
- `World` needs to track `projectName` per sessionId (add to existing `lastActivity` map or create parallel map)
- The `PixelSignpost` BitmapFont already includes all characters needed for project folder names (a-z, A-Z, 0-9, space, dash, dot, underscore)

### Complexity: LOW

This is a straightforward property addition to Building and a data aggregation in World.tick(). No new classes, no new state machines, no new rendering primitives.

---

## Feature 2: Speech Bubble Activity Text

### Current State

`SpeechBubble` already has complete auto-fade lifecycle:
- `show(activity)` makes bubble visible, resets `fadeTimer`
- `tick(deltaMs)` handles fade after `SPEECH_BUBBLE_DURATION` (4000ms) over `SPEECH_BUBBLE_FADE_MS` (1000ms)
- Currently shows a `Graphics` icon (wrench, magnifying glass, gear, antenna, pause bars)
- Bubble is 28x24px with a triangle pointer -- very small, sized for icon only

`World.manageAgents()` calls `bubble.show(activityType)` only on activity TYPE change (e.g., coding -> testing). It does NOT show the bubble when an agent first arrives at a building or when activity text changes within the same type.

### What Needs to Change

| Component | Change Type | Details |
|-----------|-------------|---------|
| `SpeechBubble` class | MODIFY | Add BitmapText child for activity text, resize bubble to fit text, keep icon |
| `SpeechBubble.show()` | MODIFY | Accept optional text string in addition to activity type |
| `World.manageAgents()` | MODIFY | Show bubble on initial building assignment too (not just activity type changes) |
| `constants.ts` | POSSIBLY MODIFY | Adjust SPEECH_BUBBLE_DURATION if current 4s feels wrong with text |

### Key Design Decision: What Text to Show

The `SessionInfo.activityType` is one of 5 enum values (`coding`, `reading`, `testing`, `comms`, `idle`). That is not "activity text" -- it is a category. The v1.2 description says "speech bubbles show current activity text."

The richest activity info available is the tool name from JSONL (e.g., "Read", "Write", "Bash", "Grep"). SessionInfo does not currently carry the raw tool name -- only the mapped `activityType`. Options:

1. **Show the activityType as text** -- "Coding", "Reading", "Testing", "Comms" -- simple but redundant with the icon
2. **Show the tool name** -- "Write", "Bash", "Grep" -- more informative but requires passing tool name through IPC
3. **Show the icon + activityType text label** -- Combines both, slightly redundant

Recommendation: **Option 1 for now** -- show the activityType as a capitalized label ("Coding", "Reading", "Testing", "Comms"). This requires zero IPC changes. The text provides meaning that icons alone do not (users may not know what the gear icon means). If tool-level detail is wanted later, `SessionInfo` can be extended with a `lastToolName` field.

### Bubble Sizing

Current bubble is 28x24px -- too small for text. Need to auto-size based on text content:
- Measure BitmapText width after setting text
- Set bubble Graphics width to `textWidth + padding`
- Keep bubble center-anchored above agent head
- Maximum width cap to prevent absurdly long bubbles

### Integration Points

- SpeechBubble already has `icon: Graphics` child positioned at (7, 5) -- text goes beside or below the icon
- SpeechBubble position is `(-14, -60)` relative to agent -- may need adjusting for wider bubble
- `installPixelFont()` BitmapFont already includes needed characters
- World.manageAgents() currently only triggers bubble on activity TYPE change -- needs to also trigger on initial assignment

### Complexity: LOW-MEDIUM

Bubble resize logic and text layout within a small container require some care, but no new architectural patterns.

---

## Feature 3: Agent Fade-Out Lifecycle

### Current State

Agents are NEVER removed. The SessionStore (main process) keeps sessions forever ("persist until app restart"). The World (renderer) creates agents on first sight and never deletes them from `this.agents` Map or removes them from `this.agentsContainer`.

After celebrating, an agent walks back to Guild Hall, enters `idle_at_hq` state, and stays there with idle visual treatment (gray tint, 0.25x animation speed). Over time, completed sessions pile up at the Guild Hall.

### What Needs to Change

| Component | Change Type | Details |
|-----------|-------------|---------|
| `Agent` class | MODIFY | Add `fading_out` state to AgentState union, implement alpha fade in tick() |
| `Agent` class | MODIFY | Add `isFadedOut(): boolean` public method for World to detect removal readiness |
| `World.tick()` | MODIFY | After agent tick, check for `isFadedOut()` and remove/destroy agent + cleanup maps |
| `World.manageAgents()` | MODIFY | When setting agent to idle_at_hq after walk-back from celebration, trigger fade-out |
| `constants.ts` | ADD | `AGENT_FADEOUT_DELAY_MS` (time at HQ before fade starts), `AGENT_FADEOUT_MS` (fade duration) |

### State Machine Extension

Current 5-state machine:
```
idle_at_hq -> walking_to_building -> walking_to_workspot -> working
                                                              |
idle_at_hq <- walking_to_building (to HQ) <--- celebrating --+
```

Extended with fade-out (6 states):
```
idle_at_hq -> walking_to_building -> walking_to_workspot -> working
     |                                                        |
     +-- fading_out              walking_to_building <-- celebrating
     |        |                       |
     |        v                       v
     |   [REMOVED]               idle_at_hq
     |                                |
     +--------------------------------+
```

The `fading_out` state is a terminal state entered from `idle_at_hq` when the agent is detected as a completed session. During this state, the agent's alpha decreases over `AGENT_FADEOUT_MS`. When alpha reaches 0, the agent is eligible for removal by World.

### Key Design Decision: When to Trigger Fade-Out

Two approaches:

**A. Fade immediately when arriving at HQ after celebration**
- Pro: Simple trigger point (state transitions from `walking_to_building` to `idle_at_hq` with `workSpotTarget === null` after celebration)
- Con: Agent barely appears at HQ before disappearing

**B. Fade after a brief idle delay at HQ**
- Pro: User sees the agent arrive home, pause, then fade -- feels intentional
- Con: Slightly more state tracking (need to know "this agent completed a task and is now idle")

Recommendation: **Option B** -- fade after a brief delay (e.g., 2-3 seconds at HQ). The agent arrives, stands idle briefly, then fades out. This feels natural and gives the user a moment to register the agent's return.

Implementation: Track which agents have completed (arrived at HQ after celebrating). When an agent in `idle_at_hq` state has been there for `AGENT_FADEOUT_DELAY_MS` AND was previously celebrating, transition to `fading_out`.

### Key Design Decision: Can a Fading Agent Be Reactivated?

If a session that is fading out suddenly becomes active again (new JSONL activity), should the fade be canceled?

Recommendation: **Yes, cancel the fade.** If `World.manageAgents()` sees a session with a non-idle activity for an agent currently in `fading_out` state, reset alpha to 1 and transition to `walking_to_building`. This handles the edge case of rapid session reuse.

### Cleanup Requirements

When an agent is removed, World must clean up:
1. `this.agents.delete(sessionId)`
2. `this.agentsContainer.removeChild(agent)`
3. `agent.destroy({ children: true })` -- destroys Agent, its AnimatedSprite, its SpeechBubble
4. `this.speechBubbles.delete(sessionId)`
5. `this.lastActivity.delete(sessionId)`
6. `this.statusDebounce.delete(sessionId)`
7. `this.lastCommittedStatus.delete(sessionId)`
8. `this.lastRawStatus.delete(sessionId)`
9. `this.agentFactory` -- release slot? (Currently AgentFactory uses deterministic hash, no slot pool, so no release needed)

### Integration Points

- Agent's `tick()` switch statement needs a new `case 'fading_out'` branch
- Agent needs internal tracking: `private hasCompletedTask: boolean` flag, set when celebration ends
- Agent needs `private idleAtHqTimer: number` to track delay before fade starts
- World's `manageAgents()` must check for fading_out state and skip normal routing for those agents
- World's `tick()` must check `isFadedOut()` after ticking each agent and perform cleanup
- SessionStore (main process) continues to persist sessions -- renderer-side removal is purely visual

### Complexity: MEDIUM

New state in the FSM, timer-based transitions, cleanup of 8 maps, edge case handling for reactivation. Not architecturally complex but requires careful state management.

---

## Data Flow Changes

### Current IPC Data Flow (Unchanged)

```
Electron Main Process
    |
    SessionDetector.discoverSessions()  -- polls JSONL files every 3s
    |
    SessionStore.poll()  -- detects changes, pushes via IPC
    |
    IPC: 'sessions-update' (SessionInfo[])
    |
    v
Renderer Process
    |
    World.updateSessions(sessions)
    |
    +-- manageAgents()  -- create/update/route agents
    |
    World.tick(deltaMs)  -- per-frame updates
    |
    +-- agent.tick()     -- FSM, movement, animation
    +-- bubble.tick()    -- auto-fade countdown
    +-- building labels  -- [NEW] dynamic text updates
    +-- agent cleanup    -- [NEW] fade-out removal
```

### New Data Requirements

No new IPC data needed. All three features use data already present in SessionInfo:
- `projectName` -- for building labels
- `activityType` -- for speech bubble text
- `status` -- for detecting completion (already used for celebration trigger)

### New Per-Agent State in World

| Map/Tracking | Current | New |
|-------------|---------|-----|
| `agents` | Map<sessionId, Agent> | unchanged |
| `speechBubbles` | Map<sessionId, SpeechBubble> | unchanged |
| `lastActivity` | Map<sessionId, ActivityType> | unchanged |
| `lastProjectName` | -- | NEW: Map<sessionId, string> for building label aggregation |

The `lastProjectName` map parallels `lastActivity` and is set in the same location in `manageAgents()`.

---

## Build Order (Dependency-Driven)

### Phase 1: Dynamic Building Labels

**Why first:** Zero dependencies on other features. Simplest change. Modifies Building class (add property + setter) and World.tick() (add label aggregation logic). Can be tested independently.

**Files modified:**
- `src/renderer/building.ts` -- store label ref, add setLabel/resetLabel
- `src/renderer/world.ts` -- add project name tracking, label update logic in tick()
- `src/shared/constants.ts` -- add MAX_LABEL_CHARS constant

### Phase 2: Speech Bubble Text

**Why second:** Independent of building labels and agent fade-out. Modifies SpeechBubble class (add BitmapText, resize logic) and World.manageAgents() (trigger on initial assignment). Moderate complexity.

**Files modified:**
- `src/renderer/speech-bubble.ts` -- add BitmapText, auto-sizing, show() accepts text
- `src/renderer/world.ts` -- show bubble on first building assignment, pass activity text

### Phase 3: Agent Fade-Out Lifecycle

**Why last:** Most complex. Depends on understanding the full agent lifecycle (which phases 1-2 exercise). Adds new FSM state, timer logic, and multi-map cleanup. Should be tested after the other features are stable.

**Files modified:**
- `src/renderer/agent.ts` -- add fading_out state, timer, alpha fade, isFadedOut()
- `src/renderer/world.ts` -- trigger fade-out, cleanup on isFadedOut(), handle reactivation
- `src/shared/constants.ts` -- add AGENT_FADEOUT_DELAY_MS, AGENT_FADEOUT_MS

---

## Architectural Patterns

### Pattern: Timer-Based State Transitions (Already Established)

**What:** Agent states transition after a timer reaches a threshold (celebration -> walk home after CELEBRATION_DURATION_MS). Fade-out follows the same pattern.

**Existing example (celebration):**
```typescript
case 'celebrating': {
  this.celebrationTimer += deltaMs;
  if (this.celebrationTimer >= CELEBRATION_DURATION_MS) {
    // transition to next state
  }
}
```

**New fade-out follows same pattern:**
```typescript
case 'fading_out': {
  this.fadeOutTimer += deltaMs;
  if (this.fadeOutTimer > AGENT_FADEOUT_DELAY_MS) {
    const fadeProgress = (this.fadeOutTimer - AGENT_FADEOUT_DELAY_MS) / AGENT_FADEOUT_MS;
    this.alpha = Math.max(0, 1 - fadeProgress);
  }
}
```

### Pattern: World Owns Lifecycle, Components Own Rendering (Established)

**What:** World decides when to create, assign, and destroy entities. Agent/Building/SpeechBubble handle their own visual state. This pattern continues for all three features.

- World decides which label text a building gets -- Building renders it
- World decides when to show a speech bubble -- SpeechBubble renders and auto-fades it
- World decides when to remove an agent -- Agent handles its own fade-out rendering

### Pattern: Map-Per-Concern Tracking (Established but Growing)

**What:** World maintains parallel Maps keyed by sessionId for different concerns (agents, speechBubbles, lastActivity, statusDebounce, etc.).

**Current count:** 6 Maps in World
**After v1.2:** 7 Maps in World (adding lastProjectName)

This is acceptable for a small system. If it grew further, a per-agent state bag would be cleaner, but at 7 maps the pattern still holds.

---

## Anti-Patterns to Avoid

### Anti-Pattern: Orphaned Map Entries

**What goes wrong:** Removing an agent from `agents` Map but forgetting to clean up `speechBubbles`, `lastActivity`, `statusDebounce`, `lastCommittedStatus`, `lastRawStatus`, `lastProjectName`.

**Why it's bad:** Memory leak in an always-on app. After many session cycles, orphaned entries accumulate.

**Prevention:** Create a single `private removeAgent(sessionId: string)` method in World that deletes from ALL maps and destroys the agent. Call this one method from the fade-out cleanup in `tick()`.

### Anti-Pattern: Modifying Alpha in Multiple Places

**What goes wrong:** Agent.tick() sets alpha for fade-out, but `applyStatusVisuals()` also sets alpha for breathing effect, and `updateBreathing()` also modifies alpha. Multiple alpha writers conflict.

**Why it's bad:** A fading-out agent that receives a breathing status update resets to alpha 0.5-1.0, breaking the fade.

**Prevention:** In `fading_out` state, skip all other visual updates (tint, breathing, shake). The fade-out state should be dominant and exclusive.

### Anti-Pattern: Rebuilding Graphics Every Frame for Bubble Resize

**What goes wrong:** Calling `bubble.clear().roundRect().fill()` every tick to resize the speech bubble.

**Why it's bad:** Graphics rebuild is expensive per-frame in PixiJS 8.

**Prevention:** Only rebuild bubble background Graphics when `show()` is called (which happens on activity change, not every frame). The bubble size is static between show() calls.

---

## Component Modification Summary

### Building (building.ts) -- Modifications

```
BEFORE:
  constructor() {
    const label = new BitmapText(...);  // anonymous, unreachable
    this.addChild(label);
  }

AFTER:
  private label: BitmapText;           // stored reference
  private defaultLabel: string;        // "Wizard Tower" etc.

  constructor() {
    this.defaultLabel = BUILDING_LABELS[buildingType];
    this.label = new BitmapText(...);
    this.addChild(this.label);
  }

  setLabel(text: string): void {       // NEW
    this.label.text = text.length > MAX_LABEL_CHARS
      ? text.slice(0, MAX_LABEL_CHARS - 1) + '...'
      : text;
  }

  resetLabel(): void {                 // NEW
    this.label.text = this.defaultLabel;
  }
```

### SpeechBubble (speech-bubble.ts) -- Modifications

```
BEFORE:
  - Graphics bubble (28x24 fixed size)
  - Graphics icon only
  - show(activity: ActivityType)

AFTER:
  - Graphics bubble (auto-sized to content)
  - Graphics icon (kept, smaller position)
  - BitmapText label (activity name text)
  - show(activity: ActivityType, text?: string)
  - Bubble background redrawn on show() only (not per-frame)
```

### Agent (agent.ts) -- Modifications

```
BEFORE:
  5 states: idle_at_hq, walking_to_building, walking_to_workspot, working, celebrating

AFTER:
  6 states: + fading_out
  New properties:
    - hasCompletedTask: boolean (set true when celebration ends)
    - fadeOutTimer: number
  New methods:
    - isFadedOut(): boolean (for World cleanup)
    - cancelFadeOut(): void (for reactivation edge case)
  Modified tick():
    - idle_at_hq: if hasCompletedTask, count time, transition to fading_out
    - fading_out: alpha fade over AGENT_FADEOUT_MS, skip other visual updates
```

### World (world.ts) -- Modifications

```
New tracking:
  - lastProjectName: Map<string, string>

Modified manageAgents():
  - Track projectName alongside activityType
  - Show speech bubble on initial building assignment (not just activity change)
  - Handle fading_out agents: skip normal routing, allow reactivation

Modified tick():
  - After agent ticks: check isFadedOut(), call removeAgent()
  - After activeBuildingTypes loop: compute project names per building, call setLabel/resetLabel

New method:
  - removeAgent(sessionId): cleanup all 7+ maps, destroy agent container
```

---

## Sources

- Codebase analysis: all 22 source files in `src/` examined directly
- PixiJS 8.16.0 BitmapText.text property: text is settable at runtime (verified in existing codebase usage)
- PixiJS 8.16.0 Container.alpha: inherited by children, used for fade effects throughout codebase
- PixiJS 8.16.0 Container.destroy({ children: true }): recursive cleanup (used in LevelUpEffect already)
- Existing patterns: Timer-based transitions (celebration), auto-fade (SpeechBubble), Map-based tracking (World)

---

*Architecture research for: Agent World v1.2 -- Dynamic building labels, speech bubble text, agent fade-out lifecycle*
*Researched: 2026-02-26*
