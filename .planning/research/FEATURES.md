# Feature Research

**Domain:** Dynamic labels, auto-fading speech bubbles, agent fade-out lifecycle for Fantasy RPG visualizer
**Researched:** 2026-02-26
**Confidence:** HIGH (features derived directly from codebase analysis of all 22 source files)

## Context

This is v1.2 milestone research, building on an already-shipped v1.1 Fantasy RPG visualizer. The three target features (dynamic building labels, speech bubble auto-fade triggers, agent fade-out lifecycle) address a specific user pain point: the world does not yet reflect what is actually happening. Buildings have static RPG names, speech bubbles only appear on building transitions, and completed agents pile up at Guild Hall forever.

All three features operate purely in the renderer layer. The session detection pipeline (SessionStore, FilesystemSessionDetector) already provides `projectName`, `activityType`, and `status` fields -- the data is available, the display just does not use it yet.

## Feature Landscape

### Table Stakes (Users Expect These)

These are the core v1.2 features. Without all three, the milestone is incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Dynamic building labels showing project names** | Users run multiple projects; need to know which building represents which project at a glance. The existing `SessionInfo.projectName` is available but never displayed on buildings. | MEDIUM | Building class has no mutable label reference -- constructs `BitmapText` with `BUILDING_LABELS[buildingType]` but does not store it. Requires: storing `private label: BitmapText` field, adding `setLabel(text: string)` method, World tracking active-project-to-building mapping, reverting to RPG names when no active sessions target that building. |
| **Speech bubble auto-fade after display** | Persistent bubbles clutter the screen and obscure agents; auto-fade is partially implemented but under-triggered. | LOW | `SpeechBubble` already has `tick()` with `SPEECH_BUBBLE_DURATION` (4000ms) + `SPEECH_BUBBLE_FADE_MS` (1000ms). The fade mechanism is complete and working. The gap: `show()` only triggers on activity type changes between buildings (line 286 of world.ts), not on initial agent assignment or same-building activity changes. |
| **Agent fade-out at Guild Hall after celebrating** | Completed agents accumulate at Guild Hall forever, making it crowded and making it impossible to see at a glance which sessions are truly active. | MEDIUM | No agent removal code exists anywhere. `SessionStore` explicitly never removes sessions ("persist until restart"). Need: new agent state or flag (`fading_out`), alpha tween after arriving at Guild Hall post-celebration, then full cleanup from all World tracking maps (`agents`, `agentsContainer`, `speechBubbles`, `statusDebounce`, `lastCommittedStatus`, `lastRawStatus`, `lastActivity`). |

### Differentiators (Competitive Advantage)

Features that make the visualizer feel polished rather than merely functional.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Label crossfade animation** | Smooth label changes feel intentional rather than jarring; matches existing tint crossfade aesthetic used for agent status transitions. | LOW | BitmapText alpha tween: fade old label out, update text, fade new label in. ~300ms each direction. Reuse `STATUS_CROSSFADE_MS` / `lerpColor` timing pattern. |
| **Speech bubble on initial activity assignment** | Agent walks to building but no bubble appears -- looks like a silent, context-free movement. Users cannot tell what triggered the walk. | LOW | Add `bubble.show(activityType)` call when agent transitions from `idle_at_hq` to `walking_to_building` in `manageAgents()`, not just on activity type changes. |
| **Building label shows agent count** | Multiple sessions on same project go to same building; count makes occupancy visible (e.g., "Agent World (2)"). | LOW | Track active agent count per building, append to label string when count > 1. |
| **Graceful linger before fade** | Instant removal after arriving at Guild Hall feels abrupt; a brief idle pause then smooth fade feels natural and gives the user a moment to register the return. | LOW | Add `GUILD_HALL_LINGER_MS` constant (~2000ms). After arriving `idle_at_hq` post-celebration, wait linger period, then begin alpha fade over `AGENT_FADEOUT_MS` (~1500ms). |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Click building label to open project folder** | Seems convenient for project navigation. | Breaks the view-only constraint (established KEY DECISION in PROJECT.md). Adds IPC complexity, security surface, platform-specific `shell:open` calls. The visualizer is a monitor, not a launcher. | Keep view-only. Users already have terminals open for each project. |
| **Animated/scrolling text for labels** | Looks flashy, game-like. | BitmapText at 16px on pixel art is already small. Animation makes it harder to read. CPU cost of per-frame text updates for a purely decorative feature. | Static text swap with optional alpha crossfade is sufficient and readable. |
| **Speech bubbles with full activity descriptions** | More information seems better ("Reading src/renderer/world.ts"). | Requires parsing JSONL for file paths (fragile, changes with Claude Code updates), BitmapText at 16px cannot fit long strings in the tiny 28x24px bubble, and text changes too rapidly (every tool call at 3s polling). | The activity icon system already communicates the type of work (wrench, magnifier, gear, antenna). Icon-only bubbles are the right abstraction level for this display size. |
| **Permanent speech bubble while working** | "I want to always see what each agent is doing." | Contradicts the purpose of auto-fade. Persistent bubbles overlap each other, obscure agents beneath, and create visual noise -- especially with 3-4 agents at the same building. | Auto-fade on activity change: show briefly on transitions, then get out of the way. The building label + building routing already communicate ongoing activity. |
| **Remove idle sessions from SessionStore** | Clean up the data source instead of doing visual cleanup. | Breaks the "sessions persist until restart" design in `SessionStore.poll()`. Other code paths may depend on historical session presence. JSONL files are not deleted when sessions end, so the detector would rediscover them on the next poll. | Visual-only fade-out in renderer. Agent is removed from display but SessionStore retains the data. World tracks "dismissed" session IDs to prevent re-creation. |
| **Fade out ALL idle agents (not just post-celebration)** | "Clean up all unused agents." | An idle agent whose session is still running should remain visible -- the user needs to know that session exists even if it is temporarily quiet. Fading idle agents removes useful information. | Only fade agents that have gone through the full completion lifecycle: active -> idle (debounced) -> celebration -> walk back -> linger -> fade out. |

## Feature Dependencies

```
[Dynamic Building Labels]
    |
    +--requires--> Building.setLabel() method (store BitmapText ref)
    +--requires--> World tracks project-to-building mapping
    +--requires--> World detects when building has no active sessions (revert label)
    |
    +--enhances--> [Label Crossfade Animation] (optional polish)

[Speech Bubble Auto-Fade]
    |
    +--already built--> SpeechBubble.tick() with duration + fade
    +--requires--> Broader trigger points in World.manageAgents()
    |
    +--enhances--> [Show Bubble on First Assignment]

[Agent Fade-Out Lifecycle]
    |
    +--requires--> New agent state or post-state flag (fading_out)
    +--requires--> World.manageAgents() cleanup after fade completes
    +--requires--> Distinguishing "idle from active session" vs "idle post-celebration"
    |
    +--conflicts--> SessionStore never-remove policy (resolved: visual-only removal)
    +--enhances--> [Graceful Linger Before Fade]

[Dynamic Building Labels] --independent-of--> [Speech Bubble Auto-Fade]
[Dynamic Building Labels] --independent-of--> [Agent Fade-Out Lifecycle]
[Speech Bubble Auto-Fade] --independent-of--> [Agent Fade-Out Lifecycle]
```

### Dependency Notes

- **Building.setLabel() is a prerequisite for dynamic labels:** The current Building constructor creates a `BitmapText` with `BUILDING_LABELS[buildingType]` but does not store a reference. The label text is set once and never updated. Must store `private label: BitmapText` as a class field and expose a `setLabel()` method.
- **World project-to-building mapping is needed for label updates:** Currently, World maps activity types to buildings via `QUEST_ZONE_POSITIONS` and `ACTIVITY_BUILDING`. For dynamic labels, World needs to track which `projectName` values have active sessions at each building and update labels when that set changes.
- **Agent fade-out must distinguish post-celebration idle from normal idle:** An agent that is `idle_at_hq` because its session is still running (just no recent tool activity) should NOT fade out. Only agents that completed the celebration cycle and returned to Guild Hall should fade. This requires a "completed" flag on the Agent or tracking in World.
- **All three features are fully independent:** They can be implemented in any order or in parallel. No feature blocks another. This allows flexible phase structuring.
- **SessionStore conflict is design-level, not code-level:** Agent fade-out removes the visual agent from the renderer, but SessionStore still holds the SessionInfo. If the session becomes active again after visual removal, World must detect this and create a fresh agent. A `Set<string>` of "dismissed session IDs" in World handles this -- remove from the set if the session's status changes from `idle` to `active/waiting`.

## MVP Definition

### Launch With (v1.2 Core)

The three committed features from PROJECT.md, broken into atomic deliverables:

- [ ] **Building.setLabel() method** -- Store BitmapText reference in Building class, expose text update method
- [ ] **World dynamic label logic** -- Track project-to-building mapping, update labels each poll cycle, revert to RPG names when no active sessions
- [ ] **Speech bubble on initial assignment** -- Show activity icon when agent first leaves Guild Hall for a building
- [ ] **Speech bubble on same-building activity change** -- Trigger show() when activity poll data changes even within the same building type
- [ ] **Agent fade-out state** -- New state or flag after celebrate-walk-back-arrive, with alpha tween to 0
- [ ] **Agent cleanup after fade** -- Remove agent from all World tracking structures, add session ID to dismissed set
- [ ] **Dismissed session reactivation** -- If a dismissed session becomes active again, clear dismissed flag and create new agent

### Add After Validation (v1.2 Polish)

- [ ] **Label crossfade animation** -- Alpha tween on text change (~30 lines, uses existing timing patterns)
- [ ] **Agent count in building label** -- Append "(2)" when multiple sessions target same building
- [ ] **Graceful linger timing** -- Tunable `GUILD_HALL_LINGER_MS` constant before fade begins
- [ ] **Long project name truncation** -- Cap at ~16 chars with ellipsis for BitmapText readability

### Future Consideration (v2+)

- [ ] **Speech bubble text content** -- Show actual tool/file descriptions instead of icons (requires JSONL parsing changes and bubble UI redesign)
- [ ] **Building visual state changes** -- Door open/closed, lights on/off based on occupancy
- [ ] **Agent "resurrection" animation** -- Visual effect when a faded-out session becomes active again (instead of just spawning a new agent)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dynamic building labels (project names) | HIGH | MEDIUM | P1 |
| Building label revert to RPG names | HIGH | LOW | P1 |
| Speech bubble on initial assignment | MEDIUM | LOW | P1 |
| Agent fade-out after completion | HIGH | MEDIUM | P1 |
| Dismissed session reactivation guard | HIGH | LOW | P1 |
| Label crossfade animation | LOW | LOW | P2 |
| Agent count in label | LOW | LOW | P2 |
| Graceful linger timing | MEDIUM | LOW | P2 |
| Long project name truncation | MEDIUM | LOW | P2 |

**Priority key:**
- P1: Must have for v1.2 milestone completion
- P2: Should have, adds polish but not essential for milestone sign-off
- P3: Nice to have, future consideration

## Implementation Complexity Analysis

### Dynamic Building Labels (MEDIUM)

**What changes:**
1. `Building` class: store `private label: BitmapText`, add `setLabel(text: string)` public method
2. `World` class: add `Map<BuildingType, string>` tracking current label text per building
3. `World.updateSessions()`: after grouping sessions by activity, determine dominant project name per building, call `building.setLabel(projectName)` or revert to `BUILDING_LABELS[type]` when empty
4. `constants.ts`: add `MAX_LABEL_LENGTH` (~16 chars) for truncation

**Gotchas:**
- Multiple projects can map to the same building (two different projects both doing "coding" go to Wizard Tower). Need a policy: show the project with the most active agents, or show the most recently active, or cycle between them.
- Label should only show project name when sessions are actively *working* at that building (state: `working` or `walking_to_workspot`), not when agents are walking to the building or celebrating.
- `installPixelFont()` char set in `bitmap-font.ts` includes `a-z, A-Z, 0-9, space, dash, dot, underscore, slash, backslash`. This covers most project names but exotic characters (parentheses, `@`, `#`) will render as missing glyphs. Not worth adding -- project folder names rarely use these.
- Max 4 quest zone buildings means max 4 dynamic labels. Guild Hall label could optionally show "Guild Hall" always or show the number of idle agents.

### Speech Bubble Auto-Fade (LOW)

**What changes:**
1. `World.manageAgents()` line ~272: add `bubble.show(activityType)` when agent transitions from `idle_at_hq` to `walking_to_building` (initial assignment)
2. `World.manageAgents()`: consider showing bubble on any activity data change (not just building-changing transitions)

**Gotchas:**
- Over-triggering: if every 3-second poll triggers `show()` (because `lastModified` changed), the `fadeTimer` resets to 0 and the bubble never fades. Must only trigger on *meaningful* activity changes -- compare `activityType` not raw session data.
- The existing implementation is complete and correct. The auto-fade mechanism (4s display + 1s fade) works perfectly. The entire "feature" is about adding 2-3 `bubble.show()` calls at the right trigger points.

### Agent Fade-Out Lifecycle (MEDIUM)

**What changes:**
1. `Agent` class: add `fading_out` state to `AgentState` union, or add a boolean `isCompleted` flag alongside `idle_at_hq`
2. `Agent.tick()`: in the `idle_at_hq` case (when `isCompleted`), count down a linger timer, then tween alpha from 1.0 to 0.0
3. `Agent`: add `startFadeOut()` method (called by World when agent arrives at Guild Hall after celebration), add `isFadedOut(): boolean` getter
4. `World.tick()`: after ticking agents, check for `isFadedOut()` and run full cleanup
5. `World`: add `private dismissedSessions: Set<string>` to track visually-removed session IDs
6. `World.manageAgents()`: skip agent creation for dismissed sessions unless status is `active` or `waiting` (then clear from dismissed set and create fresh agent)
7. Cleanup code: remove agent from `agents` Map, `agentsContainer.removeChild()`, remove from `speechBubbles` (destroy bubble), remove from `statusDebounce`, `lastCommittedStatus`, `lastRawStatus`, `lastActivity`

**Gotchas:**
- **Biggest gotcha:** SessionStore never removes sessions. After visual fade-out, the next poll still includes the idle session in the `sessions` array passed to `World.updateSessions()`. Without the dismissed-sessions guard, World would immediately recreate the agent, causing a flicker loop.
- **Fade must be interruptible:** If a session status changes to `active` during the fade animation (user started a new conversation), cancel the fade (`alpha = 1`, clear `isCompleted` flag) and reassign to a building normally.
- **`repositionIdleAgents()` must exclude fading agents:** Fading agents should not count in the fan-out layout at Guild Hall. Otherwise, the remaining agents would shift position when the faded agent is finally removed.
- **State machine consideration:** Adding `fading_out` as a 6th state to `AgentState` is cleaner than a boolean flag because it integrates with the existing `switch(this.state)` in `tick()`. But it means `getState()` callers need to handle the new state. A private boolean + special handling within `idle_at_hq` case keeps the public API unchanged.

## Existing Infrastructure Reuse

| Existing Code | How It Is Reused |
|---------------|-----------------|
| `SpeechBubble.tick()` + `show()` | Already implements the full auto-fade lifecycle. Just needs more trigger points in World |
| `BitmapText` in Building constructor | Pattern exists. Store the reference and add a setter |
| `STATUS_CROSSFADE_MS` + `lerpColor()` | Reusable timing pattern for optional label crossfade animation |
| Celebrate -> walk-back -> `idle_at_hq` pipeline | The trigger point for fade-out is when this pipeline completes |
| Agent `applyStatusVisuals()` breathing alpha | Proof that `Container.alpha` manipulation works cleanly on agents |
| `installPixelFont()` char set | Already covers common project name characters (a-z, A-Z, 0-9, space, dash, dot, underscore) |
| `SessionInfo.projectName` field | Already available from session detector, extracted from JSONL `cwd` field via `path.basename()` |
| `ACTIVITY_BUILDING` mapping | Already maps activity types to building types -- reuse for project-to-building label routing |

## Sources

- Direct codebase analysis of all 22 source files in `C:/Users/dlaws/Projects/Agent World/src/`
- `Building` class: `src/renderer/building.ts` -- static label at construction, no mutable reference stored
- `SpeechBubble` class: `src/renderer/speech-bubble.ts` -- auto-fade fully implemented with timer + alpha tween
- `Agent` class: `src/renderer/agent.ts` -- 5-state machine (idle_at_hq, walking_to_building, walking_to_workspot, working, celebrating), no fade-out state
- `World` class: `src/renderer/world.ts` -- agent lifecycle management, speech bubble triggers only on activity type changes
- `SessionStore`: `src/main/session-store.ts` -- explicitly never removes sessions from map
- `constants.ts`: `src/shared/constants.ts` -- SPEECH_BUBBLE_DURATION=4000, SPEECH_BUBBLE_FADE_MS=1000, BUILDING_LABELS static record
- `types.ts`: `src/shared/types.ts` -- SessionInfo includes projectName field
- `bitmap-font.ts`: `src/renderer/bitmap-font.ts` -- PixelSignpost font char set covers standard project name characters
- `activity-icons.ts`: `src/renderer/activity-icons.ts` -- 5 pre-built GraphicsContext icons for activity types

---
*Feature research for: v1.2 Activity Monitoring & Labeling milestone*
*Researched: 2026-02-26*
