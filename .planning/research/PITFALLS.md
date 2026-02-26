# Pitfalls Research

**Domain:** Adding dynamic building labels, auto-fading speech bubbles, and agent fade-out lifecycle to existing PixiJS 8 + Electron Fantasy RPG visualizer
**Researched:** 2026-02-26
**Confidence:** HIGH (verified via PixiJS 8 official docs, GitHub issues, codebase inspection of all 22 source files)

---

## Critical Pitfalls

### Pitfall 1: BitmapText Visibility Bug Prevents Dynamic Label Updates

**What goes wrong:**
Building labels are changed from static RPG names to dynamic project names by setting `label.text = projectName`. The text appears correct initially. Later, when a building's label needs to revert to its RPG name (because sessions end), the BitmapText is invisible or was previously hidden during a transition. The text property is set while `visible = false` or while the BitmapText is off-screen. After being made visible again, the label shows stale text or fails to render the update. This is a confirmed PixiJS 8 bug (GitHub issue #11294).

**Why it happens:**
PixiJS 8 has a known issue where setting `text` on a BitmapText instance that is currently invisible (`visible = false`) causes the internal `didViewUpdate` flag to remain stale. The rendering pipeline skips the dirty check because the object is invisible, and when it becomes visible again, the new text is not processed. This is subtle because it only manifests when text is changed while the object is hidden -- a pattern that naturally arises when toggling labels during building state transitions.

**How to avoid:**
Never hide BitmapText with `visible = false` if you intend to change its text while hidden. Instead, keep the BitmapText always visible and use `alpha = 0` to hide it visually. Alternatively, always set `visible = true` before updating the text, then set `visible = false` afterward if needed. The safest pattern for dynamic labels: always keep label `visible = true` and only change the `text` property directly. Since building labels in this app should always be visible (they just change content), this is the natural approach -- do not introduce a show/hide pattern for labels.

**Warning signs:**
- A building label shows "Wizard Tower" even though a project is assigned to it
- Labels sometimes "stick" to an old value after sessions change
- The bug is intermittent -- it depends on whether a state update happens to coincide with the label being invisible during a transition

**Phase to address:**
Phase 1 (dynamic labels). Keep BitmapText labels always visible; only change the `text` property, never toggle `visible`.

---

### Pitfall 2: BitmapFont Character Set Missing Project Name Characters

**What goes wrong:**
Building labels switch from hardcoded RPG names ("Wizard Tower", "Training Grounds") to user project folder names ("my-react-app", "Agent World", "TODO_v2"). The label renders correctly for some project names but shows blank spaces or missing characters for others. Specifically, characters like `(`, `)`, `!`, `@`, `#`, `$`, `%`, `&`, `+`, `=`, or Unicode characters are missing because the installed BitmapFont only covers a limited character set.

**Why it happens:**
The existing `installPixelFont()` function in `bitmap-font.ts` defines a restricted character set: `a-z`, `A-Z`, `0-9`, space, `-`, `.`, `_`, `/`, `\`. This was adequate for the five hardcoded RPG building names. Project folder names from the filesystem can contain any character the OS allows -- on Windows this includes parentheses, ampersands, plus signs, etc. When BitmapText encounters a character not in the installed font, PixiJS either silently skips it or triggers dynamic font generation (which creates per-character textures and produces a warning when 50+ are generated).

**How to avoid:**
Expand the character set in `installPixelFont()` to cover all printable ASCII characters. Use `BitmapFont.ASCII` or manually add all characters from code point 32 (space) to 126 (`~`). This covers every character a Windows folder name can contain. Also add a defensive truncation: before setting a building label, truncate the project name to a maximum display length (e.g., 16 characters) and replace any remaining non-ASCII characters with `?`. This prevents exotic Unicode folder names from triggering dynamic font generation.

**Warning signs:**
- Building labels render with gaps or missing characters for certain project names
- Console warning: "%.0f dynamically created textures" from PixiJS BitmapFont system
- Label text width is shorter than expected even though the full name was set

**Phase to address:**
Phase 1 (dynamic labels). Expand the character set in `installPixelFont()` before any dynamic text is assigned. This is a one-line change to the `chars` array.

---

### Pitfall 3: Agent Fade-Out Without Proper Destroy Causes Memory Leak Over Hours

**What goes wrong:**
Agents that complete their session now fade to alpha 0 at the Guild Hall instead of remaining visible forever. The fade animation runs, the agent becomes invisible -- but the Agent container, its AnimatedSprite, its SpeechBubble child, and all associated Map entries (`agents`, `speechBubbles`, `statusDebounce`, `lastActivity`, `lastCommittedStatus`, `lastRawStatus`) remain in memory. Over 8-24 hours of continuous use (the app is "always-on"), dozens of invisible agents accumulate. Each invisible agent still has its `tick()` called every frame (the tick loop iterates all agents in the Map), wasting CPU. AnimatedSprite frame textures are not freed. The scene graph grows.

**Why it happens:**
The current architecture in `world.ts` never removes agents from the `agents` Map. The `SessionStore` also never removes sessions ("completed/ended sessions persist until app restart"). This was acceptable when agents remained visible at the Guild Hall -- they served as a visible history. Once agents fade out and become invisible, they serve no purpose but still consume resources. The natural instinct is to add a fade animation and then stop -- but "faded out" is not the same as "cleaned up."

**How to avoid:**
Add a new terminal state to the agent state machine: `faded_out`. After the celebration completes and the agent walks back to the Guild Hall, begin an alpha fade (e.g., over 2 seconds). When alpha reaches 0, transition to `faded_out`. In the World's tick loop, check for `faded_out` agents and perform full cleanup:
1. Remove the Agent container from `agentsContainer`
2. Remove the SpeechBubble from the agent and destroy it
3. Call `agent.destroy({ children: true })` to free the AnimatedSprite and its textures
4. Delete the sessionId from all six Maps: `agents`, `speechBubbles`, `statusDebounce`, `lastActivity`, `lastCommittedStatus`, `lastRawStatus`

Also tell the `SessionStore` (main process) to remove the session entry so it is no longer pushed via IPC. Otherwise the renderer will recreate the agent on the next `updateSessions` call.

**Warning signs:**
- Task Manager shows Electron memory growing steadily over hours
- CPU usage slowly increases even when no active sessions exist
- DevTools shows the `agentsContainer.children` array growing over time
- Invisible agents still receive `tick()` calls (add a console.log guard to detect)

**Phase to address:**
Phase 3 (agent lifecycle). This must be implemented as a complete pipeline: fade animation + state transition + full cleanup + session store sync. Do not implement the fade without the cleanup.

---

### Pitfall 4: Fade-Out Agent Gets Resurrected by Next IPC Update

**What goes wrong:**
An agent begins fading out after celebrating. Midway through the fade (or after reaching alpha 0 but before cleanup), the next 3-second `SessionStore` poll arrives via IPC. The `updateSessions` call in `world.ts` sees the session still present in the data (because `SessionStore` never removes sessions). The code path `let agent = this.agents.get(session.sessionId)` finds the fading/invisible agent, and the session routing logic tries to assign it to a building again. The agent snaps back to full alpha or walks to a building while mostly transparent, creating a ghost effect.

**Why it happens:**
The `SessionStore` was explicitly designed to never remove sessions: "completed/ended sessions stay visible until app restart." This was fine for v1.0/v1.1 where agents accumulated visually at the Guild Hall. For v1.2, the fade-out lifecycle creates a new requirement: the renderer must know that a faded-out agent should not be reactivated by stale session data. The 3-second polling interval means there is always a window where stale data can arrive after the renderer has decided to fade out an agent.

**How to avoid:**
Two-part fix:
1. **Renderer side:** Add a `fadingOut` Set or flag on the Agent. Once an agent enters the fade-out sequence, mark it as `fadingOut`. In `manageAgents()`, skip all routing logic for agents in the `fadingOut` set -- do not reassign them to buildings or update their activity.
2. **Main process side:** Add a mechanism for the renderer to tell the SessionStore to drop a session. Add an IPC channel `session-dismiss` that the renderer sends when an agent reaches `faded_out`. The SessionStore removes the session from its map, so subsequent polls no longer include it.

Without part 2, the session will keep appearing in IPC data forever, and the renderer will need to maintain a `dismissedSessionIds` set that grows without bound (minor but inelegant).

**Warning signs:**
- Agents that should be fading out suddenly snap to full opacity and start walking
- "Ghost" agents appear partially transparent at buildings
- Agents oscillate between fading and visible state every 3 seconds (aligned with poll interval)

**Phase to address:**
Phase 3 (agent lifecycle). The `fadingOut` guard must be implemented in the same phase as the fade animation -- they are inseparable. The IPC dismiss channel should be added in the same phase.

---

### Pitfall 5: Activity-Based Building Routing Conflicts With Project-Based Label Assignment

**What goes wrong:**
v1.2 introduces project-based building labels (e.g., "Agent World" replaces "Wizard Tower"). But the existing agent routing in `world.ts` sends agents to buildings based on `activityType` (coding -> Wizard Tower, testing -> Training Grounds, etc.). This means two agents from the same project working on different activities go to different buildings. Building "Agent World" (Wizard Tower) shows one agent coding, but the same project's testing agent is at "Training Grounds" -- which might be labeled with a different project or the default RPG name. The visual mapping of "project <-> building" breaks because the routing is still activity-based, not project-based.

**Why it happens:**
The v1.2 requirements say "buildings labeled with active project folder names (max 4 projects)" but the existing routing maps activities to buildings, not projects. These two systems are fundamentally different mapping strategies:
- Activity routing: `activityType -> buildingType` (many-to-one, activities are deterministic)
- Project routing: `projectName -> buildingType` (requires a project-to-building assignment that changes dynamically)

If you add dynamic labels without changing the routing, the labels lie -- a building labeled "Agent World" might have agents from three different projects, because the activity-based routing doesn't respect project boundaries.

**How to avoid:**
Replace activity-based routing with project-based routing. Each active project gets assigned to one of the four quest zone buildings. The ACTIVITY_BUILDING constant should be replaced (or supplemented) by a dynamic `projectToBuilding` Map in World that assigns projects as they appear:
- First active project gets building slot 0 (Wizard Tower position)
- Second active project gets building slot 1 (Training Grounds position)
- Max 4 projects fill all four slots
- When a project's sessions all end, its building slot becomes available for reuse
- Building label reflects the assigned project name, or reverts to RPG name when unassigned

This is the largest architectural change in v1.2 and should be designed carefully before implementation.

**Warning signs:**
- Building labels show a project name but agents from that project are scattered across multiple buildings
- Two buildings show the same project name because two activities from one project were routed to different buildings
- The "max 4 projects" constraint has no enforcement, causing a 5th project's agents to have nowhere to go

**Phase to address:**
Phase 2 (building labels + routing). The routing change and the label change must be implemented together -- they are two sides of the same feature. Implementing labels without routing creates a misleading UI.

---

### Pitfall 6: Changing Building Labels Without Repositioning the Label Anchor

**What goes wrong:**
Building labels change from "Wizard Tower" (12 characters) to "my-incredibly-long-project-name" (31 characters). The label extends far beyond the building width, overlapping adjacent buildings or going off-screen. Short project names like "App" leave the label looking oddly undersized. The label is anchored at `(0.5, 1)` (center-bottom), which works for the fixed-length RPG names but creates visual problems with variable-length project names.

**Why it happens:**
The Building constructor positions the BitmapText label above the building sprite at a fixed offset: `label.position.set(0, -texture.height - 4)`. The anchor at `(0.5, 1)` centers the text horizontally over the building. This works because all five RPG building names are 10-16 characters and fit within the 96px building width at 16px font size. Dynamic project names have no length constraint and can be 1-40+ characters.

**How to avoid:**
Truncate project names to a maximum display width before setting them as labels. Calculate max characters based on building width: at 16px BitmapFont with monospace, each character is approximately 8-10px wide, so 96px building width supports about 10-12 characters. Truncate longer names with an ellipsis: `"my-incredibly..."`. Store a `setLabel(text: string)` method on the Building class that handles truncation, so the caller does not need to worry about length. Also consider reducing font size to 12px for project names (vs. 16px for RPG names) to fit more characters.

Additionally, the current Building class has no public reference to the BitmapText label -- it is created in the constructor and added as a child but not stored as a property. You will need to store `this.label = label` to update it later.

**Warning signs:**
- Long project names visually overlap neighboring buildings
- Very short names look oddly small centered above a wide building
- Label text extends beyond the 1024px window boundary for corner buildings

**Phase to address:**
Phase 1 (dynamic labels). Add a `setLabel()` method to Building and implement truncation before any dynamic labels are assigned. Also store the BitmapText as a class property.

---

### Pitfall 7: Speech Bubble Auto-Fade Conflicts With Agent Alpha Fade-Out

**What goes wrong:**
An agent is in the process of fading out (alpha going from 1 to 0 over 2 seconds) after completing and returning to the Guild Hall. The speech bubble, which is a child of the Agent container, inherits the parent's alpha through PixiJS's alpha multiplication. If the speech bubble was still visible (mid-display or mid-fade), its alpha is now `bubbleAlpha * agentAlpha`. This creates a double-fade effect where the bubble disappears too quickly. Worse, if the speech bubble's own fade logic checks `this.alpha <= 0` to mark itself as inactive, the inherited alpha from the parent can cause it to trigger the inactive state prematurely.

**Why it happens:**
PixiJS alpha is multiplicative through the scene hierarchy. The SpeechBubble reads its own `this.alpha` in the `tick()` method (line 67: `if (this.alpha <= 0)`), but `this.alpha` is the local alpha, not the world alpha. The local alpha might still be 0.5 (mid-fade), but the visual alpha is 0.5 * 0.3 (parent agent alpha) = 0.15. The bubble appears nearly invisible but its internal fade logic thinks it is still partially visible. This is confusing but does not cause the premature-deactivation bug. The actual bug is the reverse: if the agent fade sets `agent.alpha = 0` before the bubble's own fade completes, the bubble becomes invisible instantly (visual alpha = 0) even though its internal timer has not elapsed. When the bubble later "fades" through its normal timer, it is already invisible -- wasting tick cycles on an already-invisible element.

**How to avoid:**
When an agent enters the fade-out sequence, immediately deactivate its speech bubble (`bubble.visible = false; bubble.isActive = false`). Do not let the speech bubble's independent fade timer run concurrently with the agent's fade-out. The agent fade-out should take priority: once the agent starts fading, its speech bubble should be killed instantly. This is cleaner than trying to coordinate two independent fade timers on parent and child.

**Warning signs:**
- Speech bubbles flash or pop during agent fade-out
- Speech bubbles appear to fade faster when the agent is also fading
- Invisible agents still have their speech bubble tick running (wasted CPU)

**Phase to address:**
Phase 3 (agent lifecycle). When implementing the agent fade-out, add explicit bubble cleanup as part of the fade initiation, not as an afterthought.

---

### Pitfall 8: Agent Removal During Tick Loop Iteration Causes Concurrent Modification

**What goes wrong:**
In the World's `tick()` method, the code iterates over `this.agents` with a `for...of` loop. The fade-out cleanup logic (removing agents from the Map when they reach alpha 0) runs inside this same loop. Deleting a Map entry during `for...of` iteration is technically safe in JavaScript (the iterator handles deletions), but the code also iterates over `this.speechBubbles` in the same tick and accesses `this.lastActivity`, `this.statusDebounce`, etc. If cleanup deletes from multiple Maps mid-iteration, the tick loop produces inconsistent state. Worse, `agent.destroy()` removes the agent from `agentsContainer.children`, which can cause issues if PixiJS is mid-render or if subsequent code references the destroyed container.

**Why it happens:**
The tick loop in `world.ts` currently assumes agents are never removed. All agent management happens in `updateSessions()` (driven by IPC), and the tick loop is purely for animation advancement. Adding removal to the tick loop breaks this assumption. Additionally, PixiJS documentation warns that removing display objects from their parent during event handlers or update loops can cause issues because the display list may be iterated elsewhere.

**How to avoid:**
Use a deferred removal pattern. During the tick loop, collect sessionIds that need removal into a `toRemove` array. After the tick loop completes (after all agents and bubbles have been ticked), iterate `toRemove` and perform cleanup:
```typescript
// In tick():
const toRemove: string[] = [];
for (const agent of this.agents.values()) {
  agent.tick(deltaMs);
  if (agent.getState() === 'faded_out') {
    toRemove.push(agent.sessionId);
  }
}
// After all iteration:
for (const id of toRemove) {
  this.cleanupAgent(id);
}
```
This ensures no Map mutation during iteration and no display list modification during the tick traversal.

**Warning signs:**
- Sporadic "Cannot read property of undefined" errors during tick
- Agents occasionally fail to clean up (skip condition hit inconsistently)
- PixiJS console warnings about destroyed display objects during render

**Phase to address:**
Phase 3 (agent lifecycle). The deferred removal pattern must be the implementation strategy from the start. Do not attempt inline removal during iteration.

---

### Pitfall 9: Building Label Revert Logic Races With Session Polling

**What goes wrong:**
A project's last session ends. The building label should revert from "Agent World" to "Wizard Tower." But the session data is stale -- the SessionStore still has the session marked as "idle" (not removed). On the next poll, the renderer sees the session, keeps the building assigned to the project, and the label stays as "Agent World." The label never reverts. Alternatively, the renderer correctly detects all sessions for a project are idle and reverts the label, but 3 seconds later the next poll arrives with the same stale session, re-assigning the building and flipping the label back to "Agent World." The label flickers between RPG name and project name every 3 seconds.

**Why it happens:**
The `SessionStore` never removes sessions by design. An "idle" session and a "completed and gone" session are indistinguishable in the current data model. The renderer cannot tell whether an idle session will become active again in 10 seconds (user just paused) or will never update again (user closed the terminal). Without a "session ended" signal, the label revert timing is ambiguous.

**How to avoid:**
Define a clear "session is dead" heuristic. Options:
1. **Time-based:** If a session has been idle for more than N minutes (e.g., 5 minutes), consider it dead. The building label reverts, and the agent begins its fade-out sequence. This is simple and matches user expectations.
2. **Process-based:** Have the SessionDetector check if the Claude Code process is still running (via PID or lock file). If the process is gone, mark the session as `ended`. This is more accurate but requires process detection logic.
3. **Explicit removal:** Add a `session-ended` status to the SessionInfo type. The SessionDetector transitions idle sessions to `ended` after the idle threshold. The renderer treats `ended` sessions as triggering label revert and agent fade-out.

Option 3 is recommended because it gives the renderer a clear signal and does not require guessing. The idle-to-ended transition happens in the main process, and the renderer reacts to it deterministically.

**Warning signs:**
- Building labels never revert to RPG names even after all Claude sessions are closed
- Labels flicker between project name and RPG name on a 3-second cycle
- Closing all terminals does not change the world at all

**Phase to address:**
Phase 2 (building labels). The "when to revert" logic must be designed alongside the "when to assign" logic. These are complementary halves of the same feature.

---

### Pitfall 10: Speech Bubble Shows Activity Text But Content Is Stale After Auto-Fade

**What goes wrong:**
The v1.2 requirement says "speech bubbles show current activity text." The existing SpeechBubble shows an activity icon (coding wrench, reading magnifier, etc.) and auto-fades after 4 seconds. When the bubble fades and the activity changes again, the bubble reappears with a new icon. But if the activity does not change for a long time (agent sits at a building coding for 5 minutes), the bubble fades and stays hidden. The user cannot tell what the agent is doing. The bubble only reappears on activity change, but continuous work within the same activity type produces no visual feedback.

If v1.2 changes bubbles to show text (e.g., "reading files" or "running tests") instead of icons, the problem is worse: the text fades, and there is no indication of what the agent is currently doing until the next activity change.

**Why it happens:**
The current SpeechBubble design is event-driven: it shows on activity change and fades after a timeout. This works for icons (the activity type is shown on the agent's building assignment). But text-based bubbles create an expectation that the bubble reflects current state, not just the last state change. Users glancing at the screen expect to see what each agent is doing right now.

**How to avoid:**
Two approaches:
1. **Keep bubbles event-driven, rely on building context:** The bubble shows on activity change and fades. Users know the agent is at the Wizard Tower (coding). The bubble is supplementary, not the primary status indicator. This preserves the current pattern and avoids clutter.
2. **Add periodic re-show:** If the activity text is important, re-show the bubble every N seconds while the agent is working (e.g., flash briefly every 30 seconds). This risks visual noise.

Approach 1 is recommended for this app. The building assignment is the primary "what is this agent doing" signal. The speech bubble is a change notification, not a persistent status display. Keep the auto-fade behavior as-is and do not try to make bubbles show persistent state.

**Warning signs:**
- Users complain they cannot tell what an agent is doing (signals the bubble is relied upon too heavily)
- Bubbles re-appearing repeatedly create visual noise that distracts from the dashboard's at-a-glance purpose
- Attempting to keep bubbles always-visible defeats the "clean dashboard" aesthetic

**Phase to address:**
Phase 2 (speech bubbles). Decide the bubble's role (change notification vs. persistent status) before implementation. Document the decision.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Not storing BitmapText label as a class property on Building | No refactor of existing constructor | Cannot update label text later; must restructure to add dynamic labels | Never for v1.2 -- the label must be accessible |
| Keeping `SessionStore` "never remove" policy for v1.2 | No main-process changes needed | Renderer must maintain its own "dismissed" set that grows without bound; stale sessions create ghost state | Acceptable for MVP only if the renderer handles staleness defensively |
| Implementing agent fade without session cleanup IPC | Simpler (renderer-only change) | Faded agents get resurrected by next IPC poll; requires fadingOut guard that papers over the root cause | Never -- the resurrection bug will ship |
| Hard-coding max 4 projects | Matches 4 quest zone buildings | If user runs 5+ projects, 5th project's agents have no building and fall through to Guild Hall | Acceptable -- document the limit clearly and handle the overflow gracefully (agents stay at Guild Hall with a speech bubble showing the project name) |
| Using `Container.alpha` for agent fade-out (instead of a shader/filter) | Simple, no new dependencies | Alpha is multiplicative to children; speech bubble inherits alpha | Acceptable -- just deactivate children before fading parent |
| Skipping the `session-dismiss` IPC channel | No IPC changes, renderer-only | SessionStore grows unbounded; renderer must filter stale sessions forever | Acceptable for MVP if session count stays low (< 50 over a day) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| BitmapText dynamic text | Setting `text` while BitmapText is `visible = false` -- update is silently lost (PixiJS issue #11294) | Keep BitmapText always visible; only change `text` property directly |
| BitmapFont character set | Font installed with limited chars; project names with special characters render blank | Expand font chars to cover all printable ASCII (32-126) before any dynamic text is set |
| Agent `destroy()` with children | Calling `agent.destroy({ children: true })` while speech bubble or level-up effect still referenced elsewhere | Null out all references (speechBubbles Map, levelUpEffect) before calling destroy |
| SessionStore + renderer lifecycle | Renderer fades out agent, but SessionStore still pushes the session on next poll, recreating the agent | Add `fadingOut` guard in `manageAgents()` to skip routing for fading agents; add IPC dismiss channel |
| PixiJS alpha inheritance | Parent alpha set to 0 makes children invisible, but children's local alpha is unchanged | Check worldAlpha (not local alpha) for visibility decisions; or deactivate children explicitly before parent fade |
| Map deletion during iteration | Deleting from `this.agents` Map inside `for...of` loop during tick | Collect IDs to remove in array; delete after iteration completes |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Ticking invisible faded-out agents | CPU usage grows linearly with session history; tick loop processes agents with alpha 0 | Remove agents from Map after fade-out completes; do not just hide them | After 20+ sessions complete over several hours of always-on use |
| Updating BitmapText label every frame | Unnecessary layout recalculation on BitmapText even though text has not changed | Only set `label.text` when the value actually changes (compare before setting) | With 4 buildings updated every 3-second poll cycle -- unlikely to matter at this scale, but good hygiene |
| Creating new SpeechBubble instances per activity change | Graphics objects and containers accumulate if bubbles are not reused | Reuse one SpeechBubble per agent (current design is correct -- preserve it) | If someone mistakenly creates new bubbles instead of calling `show()` on existing ones |
| Running agent fade-out animation at 5fps idle ticker rate | Fade animation looks choppy and stuttery; 2-second fade at 5fps = only 10 frames of animation | Ensure fade-out keeps the ticker at active FPS (30fps) until fade completes; treat fading agents as "active" for frame rate purposes | When the only remaining activity is a fading agent and GameLoop drops to idle FPS |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Building labels update instantly (no transition) | Labels snap from "Wizard Tower" to "Agent World" jarringly; feels like a glitch rather than a state change | Add a brief alpha crossfade on label change: fade old text to 0, set new text, fade to 1 (over 500ms) |
| Agent fade-out is too fast (< 1 second) | Agent disappears abruptly after celebration; user misses it or thinks it is a bug | Use a 2-3 second fade duration; slow enough to be noticed, fast enough not to linger |
| Agent fade-out is too slow (> 5 seconds) | Semi-transparent agents linger at Guild Hall, looking like ghosts; clutters the view | Keep fade duration to 2-3 seconds; begin fade immediately after arriving at Guild Hall |
| Speech bubble shows raw tool names ("Bash", "Edit", "Grep") | Technical jargon meaningless to casual glances; defeats the "at-a-glance" dashboard purpose | Keep the current activity-type icons (wrench, magnifier, gear, antenna) -- they communicate category, not implementation |
| All four buildings get project labels even when only one project is active | Three buildings with RPG names + one with a project name looks inconsistent; all four with project names when three are empty is misleading | Only label buildings that have at least one active session assigned; others keep RPG names |
| Building label font size is too large for project names | Project names like "my-really-long-project" overflow the building width | Use smaller font (12px) for project names or truncate with ellipsis at 10-12 characters |

---

## "Looks Done But Isn't" Checklist

- [ ] **Dynamic labels:** Labels change correctly -- verify labels revert to RPG names when all sessions for a project end (not just when sessions go idle temporarily)
- [ ] **Character set:** Labels show "Agent World" correctly -- test with a project name containing parentheses, numbers, and underscores like "my_app (v2.0)"
- [ ] **Agent fade-out:** Agents fade and disappear -- confirm GPU memory returns to baseline after 10 agents cycle through creation/celebration/fade-out/destroy
- [ ] **Agent resurrection:** Agent fades out -- verify the same session's stale IPC data does not recreate the agent on the next poll (wait 6+ seconds to span two poll cycles)
- [ ] **Speech bubble cleanup:** Agent fades out while speech bubble is visible -- confirm bubble stops ticking and is destroyed with the agent, not leaked
- [ ] **Label revert timing:** All sessions close -- verify building labels revert within a reasonable time (< 5 minutes), not remain stuck on project names forever
- [ ] **Frame rate during fade:** Last active agent finishes and fades -- confirm the ticker stays at 30fps during the fade animation, then drops to 5fps after cleanup
- [ ] **Overflow projects:** Start 5 simultaneous projects -- verify the 5th project's agents go to Guild Hall gracefully instead of crashing or displacing existing assignments
- [ ] **Label truncation:** Create a project with a very long folder name (30+ characters) -- verify the label truncates with ellipsis and does not overlap neighboring buildings

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| BitmapText visibility bug (stale labels) | LOW | Keep BitmapText always visible; only change `text` property; no architectural change needed |
| Missing font characters | LOW | Expand `chars` array in `installPixelFont()` to printable ASCII; one-line fix |
| Memory leak from undestroyed agents | MEDIUM | Implement deferred cleanup in tick loop; add `faded_out` state; audit all six Maps for leftover entries |
| Agent resurrection by stale IPC | MEDIUM | Add `fadingOut` guard in `manageAgents()`; add `session-dismiss` IPC channel; requires main + renderer changes |
| Activity vs. project routing mismatch | HIGH | Replace `ACTIVITY_BUILDING` routing with dynamic `projectToBuilding` assignment; significant refactor of `manageAgents()` |
| Label overflow/truncation | LOW | Add `setLabel()` method with truncation to Building class; purely additive change |
| Double-fade on speech bubble | LOW | Deactivate bubble when agent enters fade-out; one-line addition to fade initiation |
| Concurrent modification during tick | LOW | Switch to deferred removal pattern; collect IDs first, remove after iteration |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| BitmapText visibility bug | Phase 1 (dynamic labels) | Set label text 10 times while toggling visibility; confirm all updates render correctly |
| BitmapFont missing characters | Phase 1 (dynamic labels) | Test with project name "(Test_App v2.0!)" -- all characters must render |
| Building label property access | Phase 1 (dynamic labels) | Verify `Building.setLabel()` exists and updates the BitmapText before any caller code is written |
| Label truncation/overflow | Phase 1 (dynamic labels) | Test with 30-character project name; label must not exceed building width |
| Activity-to-project routing | Phase 2 (routing change) | Two agents from same project both appear at the same building, not split by activity |
| Label revert timing | Phase 2 (routing + labels) | Close all sessions for a project; label reverts within defined threshold |
| Speech bubble role decision | Phase 2 (speech bubbles) | Document whether bubble is "change notification" or "persistent status"; verify behavior matches |
| Agent fade-out + cleanup | Phase 3 (agent lifecycle) | Cycle 10 agents; memory returns to baseline; no entries left in any Map |
| Agent resurrection guard | Phase 3 (agent lifecycle) | Fade an agent; wait 6 seconds (2 poll cycles); confirm no resurrection |
| Deferred removal pattern | Phase 3 (agent lifecycle) | Fade multiple agents simultaneously; no errors during tick loop |
| Speech bubble deactivation during fade | Phase 3 (agent lifecycle) | Agent fades while bubble is visible; bubble stops immediately, no double-fade |
| Frame rate during fade | Phase 3 (agent lifecycle) | Last agent fades; ticker stays at 30fps until cleanup, then drops to 5fps |

---

## Sources

- [PixiJS BitmapText Visibility Bug - Issue #11294](https://github.com/pixijs/pixijs/issues/11294) -- BitmapText not updating while invisible (HIGH confidence, confirmed bug)
- [PixiJS BitmapText Caching Issue - Issue #11877](https://github.com/pixijs/pixijs/issues/11877) -- Dynamic BitmapText style caching pitfalls (HIGH confidence)
- [PixiJS BitmapFont Dynamic Warnings - PR #10627](https://github.com/pixijs/pixijs/pull/10627) -- Dynamic font texture warning threshold and fixes (HIGH confidence)
- [PixiJS BitmapFont Space Corruption - Issue #11413](https://github.com/pixijs/pixijs/issues/11413) -- Space character corrupts dynamic BitmapFont (MEDIUM confidence, version-dependent)
- [PixiJS Bitmap Text Guide](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap) -- Official BitmapText documentation for PixiJS 8 (HIGH confidence)
- [PixiJS Garbage Collection](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- TextureGCSystem and destroy() guidance (HIGH confidence)
- [PixiJS Render Layer Destroy Bug - Issue #11373](https://github.com/pixijs/pixijs/issues/11373) -- Destroying parent with children and render layers (HIGH confidence)
- [PixiJS visible vs renderable vs alpha](https://github.com/pixijs/pixijs/issues/3955) -- Performance difference: visible = false skips transforms; alpha = 0 still renders (HIGH confidence)
- [PixiJS Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) -- Official optimization guidance for PixiJS 8 (HIGH confidence)
- [PixiJS pixi-spine removeChild during event - Issue #203](https://github.com/pixijs-userland/spine/issues/203) -- Removing child during event trigger breaks display list (MEDIUM confidence, spine-specific but pattern applies)
- Codebase inspection: `building.ts`, `agent.ts`, `speech-bubble.ts`, `world.ts`, `session-store.ts`, `bitmap-font.ts`, `constants.ts`, `types.ts` (HIGH confidence -- direct source code analysis)

---
*Pitfalls research for: Agent World v1.2 -- Dynamic building labels, auto-fading speech bubbles, agent fade-out lifecycle*
*Researched: 2026-02-26*
