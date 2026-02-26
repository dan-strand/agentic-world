# Project Research Summary

**Project:** Agent World v1.2 -- Activity Monitoring & Labeling
**Domain:** Incremental feature additions to an animated 2D pixel-art desktop process visualizer (Electron + PixiJS 8, Windows)
**Researched:** 2026-02-26
**Confidence:** HIGH

## Executive Summary

Agent World v1.2 is a focused feature increment on a fully working v1.1 Fantasy RPG visualizer. The three target features -- dynamic building labels showing project folder names, speech bubble auto-fade with broader trigger points, and agent fade-out lifecycle after task completion -- all operate purely in the renderer layer. The session detection pipeline already provides `projectName`, `activityType`, and `status` fields through IPC; the data is available but the display does not use it yet. No new npm dependencies are required. All three features are implementable with PixiJS 8 APIs already present in the codebase: `BitmapText.text` setter for labels, `Container.alpha` for fades, and the existing timer-based animation patterns used throughout the project.

The recommended approach is to implement the three features in sequence: building labels first (simplest, no dependencies), speech bubble trigger expansion second (builds familiarity with World.manageAgents()), and agent fade-out lifecycle last (most complex, touches the most files and tracking structures). All three features are technically independent and could be parallelized, but the fade-out lifecycle has the most gotchas and benefits from the implementer having already worked through the simpler World modifications. The single most consequential architectural decision is whether to change agent routing from activity-based to project-based. Currently, agents route to buildings by activity type (coding goes to Wizard Tower, testing to Training Grounds). Adding project-name labels to buildings without changing this routing creates a misleading UI where a building labeled "Agent World" might contain agents from multiple unrelated projects. The research strongly recommends project-based routing as the correct approach, though it is the largest refactor in the milestone.

The key risks are: (1) agent fade-out without proper destroy causes memory leaks in this always-on app -- fading to alpha 0 is not the same as cleanup, and the `SessionStore` never-remove policy means stale sessions will resurrect faded agents unless guarded; (2) the BitmapFont character set needs expansion to cover all printable ASCII before any dynamic project names are displayed; (3) modifying agent alpha for fade-out conflicts with existing alpha manipulation for breathing effects, requiring the fade-out state to be dominant and exclusive. All risks have straightforward mitigations documented in the research files.

## Key Findings

### Recommended Stack

No new npm dependencies are needed for v1.2. The validated core stack (Electron 40.6.1, PixiJS 8.16.0, TypeScript 5.7, pixi-filters 6.1.5, Webpack/Electron Forge) is unchanged. All three features use PixiJS primitives already imported in the codebase. See `.planning/research/STACK.md` for full API verification and code patterns.

**Core technologies (unchanged):**
- **PixiJS 8.16.0 BitmapText.text setter**: Dynamic label updates -- setting text is cheap because BitmapText renders from pre-generated atlas glyphs with no texture regeneration
- **PixiJS 8.16.0 Container.alpha**: Fade effects for both speech bubbles (already implemented) and agent fade-out (new) -- when alpha reaches 0, rendering is automatically skipped
- **PixiJS 8.16.0 Container.destroy({ children: true })**: Agent cleanup after fade-out -- destroys agent and all children but must NOT pass `{ texture: true }` since textures are shared atlas textures

**What NOT to use:**
- GSAP or any tween library -- every animation in the project uses manual timer + linear interpolation in tick(); adding GSAP for one more fade is inconsistent and adds 30KB
- PixiJS Text (canvas-rendered) -- heavier than BitmapText; generates a canvas texture on every text change
- Object pooling for agents -- premature optimization for max 4 concurrent sessions

### Expected Features

All three v1.2 features address a specific user pain point: the world does not yet reflect what is actually happening. Buildings have static RPG names, speech bubbles only appear on building transitions, and completed agents pile up at Guild Hall forever. See `.planning/research/FEATURES.md` for full dependency analysis and prioritization matrix.

**Must have (v1.2 table stakes):**
- Dynamic building labels showing project folder names -- users need to know which building represents which project at a glance
- Speech bubble triggers on initial agent assignment and same-building activity changes -- not just on building transitions
- Agent fade-out after celebration + walk-back to Guild Hall -- completed agents must not accumulate forever
- Dismissed session reactivation guard -- if a faded session becomes active again, create a new agent cleanly

**Should have (polish):**
- Label crossfade animation -- smooth transition matching the existing tint crossfade aesthetic (~300ms each direction)
- Graceful linger before fade -- 2-second pause at Guild Hall before fade begins, feels intentional rather than abrupt
- Long project name truncation -- cap at ~14-16 characters with `..` ellipsis for readability
- Agent count in building label -- "(2)" suffix when multiple sessions target the same building

**Defer (v2+):**
- Speech bubble text content showing actual tool/file descriptions instead of icons -- requires JSONL parsing changes and bubble UI redesign
- Building visual state changes (door open/closed, lights on/off) based on occupancy
- Agent "resurrection" animation when a faded session reactivates

**Anti-features (do not build):**
- Click building label to open project folder -- breaks the view-only constraint from PROJECT.md
- Animated/scrolling label text -- unreadable at 16px BitmapText scale, unnecessary CPU cost
- Permanent speech bubbles while working -- contradicts auto-fade purpose, causes visual clutter with overlapping bubbles
- Fade ALL idle agents -- idle agents from running sessions should remain visible

### Architecture Approach

All three features touch `src/renderer/` only. No changes to `src/main/`, `src/preload/`, or IPC contracts are needed. The scene hierarchy is unchanged; modifications are to existing components (Building stores a mutable label reference, Agent gains a `fading_out` state, SpeechBubble gets broader trigger points). The World class continues to own lifecycle decisions while components own their rendering. See `.planning/research/ARCHITECTURE.md` for the complete component modification plan and data flow diagrams.

**Major component modifications:**

1. **Building (building.ts)** -- Store `private label: BitmapText` reference (currently anonymous addChild), add `setLabel(text)` and `resetLabel()` public methods for dynamic label updates
2. **Agent (agent.ts)** -- Add `fading_out` as 6th state to FSM, implement alpha fade in tick(), add `isFadedOut()` for World cleanup, add `cancelFadeOut()` for reactivation edge case; skip all other visual updates (tint, breathing, shake) during fade-out
3. **World (world.ts)** -- Track project-to-building mapping for labels, show speech bubbles on initial assignment and same-building activity changes, implement deferred removal pattern for faded agents, maintain `dismissedSessions` Set to prevent resurrection
4. **SpeechBubble (speech-bubble.ts)** -- Existing auto-fade mechanism is complete and correct; work is adding 2-3 `bubble.show()` calls at the right trigger points in World
5. **constants.ts** -- Add `AGENT_FADEOUT_DELAY_MS`, `AGENT_FADEOUT_MS`, `MAX_LABEL_CHARS`
6. **bitmap-font.ts** -- Expand chars to full printable ASCII range (32-126) to support all possible project folder name characters

### Critical Pitfalls

Top 5 pitfalls synthesized from `.planning/research/PITFALLS.md`:

1. **Agent fade-out without destroy causes memory leak** -- Fading to alpha 0 is not cleanup. The agent container, AnimatedSprite, SpeechBubble, and 6+ Map entries remain in memory. Each invisible agent still gets `tick()` called every frame. Over 8-24 hours of always-on use, dozens of invisible agents accumulate. Prevention: implement a single `removeAgent(sessionId)` method in World that cleans ALL maps and calls `agent.destroy({ children: true })`. Use deferred removal pattern (collect IDs in array, remove after tick loop).

2. **Faded agent resurrected by stale IPC data** -- SessionStore never removes sessions. After visual fade-out, the next 3-second poll still includes the idle session. Without a guard, World recreates the agent, causing flicker. Prevention: add `fadingOut` guard in `manageAgents()` that skips routing for fading agents. Maintain a `dismissedSessions: Set<string>` in World. Consider adding `session-dismiss` IPC channel so SessionStore drops the session.

3. **BitmapFont character set gaps for project names** -- The existing font covers only a-z, A-Z, 0-9, and a few punctuation marks. Project folder names can contain parentheses, ampersands, plus signs, etc. Missing characters render as blank spaces. Prevention: expand `installPixelFont()` chars to cover all printable ASCII (code points 32-126) before any dynamic text is set. One-line fix, negligible cost.

4. **Activity-based routing conflicts with project-based labels** -- Buildings are labeled with project names but agents route by activity type. Two agents from the same project doing different activities go to different buildings, making labels misleading. Prevention: replace or supplement activity-based routing with project-based routing where each active project gets assigned to one of four buildings.

5. **Multiple alpha writers conflict during fade-out** -- Agent `applyStatusVisuals()` sets alpha for breathing effect, and `fading_out` state also sets alpha. A breathing update during fade resets alpha to 0.5-1.0, breaking the fade. Prevention: in `fading_out` state, skip ALL other visual updates (tint, breathing, shake). The fade-out state must be dominant and exclusive.

## Implications for Roadmap

Based on combined research, the three features should be implemented in three phases. All are independent in terms of code dependencies, but the ordering below reflects increasing complexity and the benefit of building familiarity with World.manageAgents() before tackling the most stateful change.

### Phase 1: Dynamic Building Labels

**Rationale:** Simplest feature with the fewest moving parts. Modifies two files (Building and World) with no state machine changes. Establishes the pattern of World tracking per-building state and updating display components, which Phase 2 and 3 build upon. Must address the BitmapFont character set expansion before any dynamic text is displayed.

**Delivers:** Buildings show active project folder names when sessions are working there; labels revert to RPG names when no active sessions target the building; long names truncated with ellipsis; BitmapFont expanded to full printable ASCII.

**Addresses features:** Dynamic building labels (P1), building label revert to RPG names (P1), long project name truncation (P2), label crossfade animation (P2 stretch)

**Avoids pitfalls:** BitmapText visibility bug (#11294) -- keep labels always visible, only change text; BitmapFont character set gaps -- expand before any dynamic text; label overflow -- truncate with `setLabel()` method

**Files modified:** `building.ts`, `bitmap-font.ts`, `world.ts`, `constants.ts`

### Phase 2: Speech Bubble Trigger Expansion and Project-Based Routing

**Rationale:** The speech bubble auto-fade mechanism is already fully implemented. The entire "feature" is adding 2-3 `bubble.show()` calls at correct trigger points in World.manageAgents(). This phase also addresses the critical routing decision: switching from activity-based to project-based building assignment. These two concerns are grouped because both modify `manageAgents()` and because the routing change determines how labels behave (which building gets which project name). The routing change is the single largest refactor in v1.2 and benefits from being tackled in its own focused phase before the more stateful fade-out work.

**Delivers:** Speech bubbles appear when agents first leave Guild Hall, when activity changes within the same building, and on building transitions (existing); project-based routing where each active project gets a dedicated building; "max 4 projects" overflow handling (5th project agents stay at Guild Hall).

**Addresses features:** Speech bubble on initial assignment (P1), speech bubble on same-building activity change (P1), project-based building routing (architectural prerequisite for accurate labels)

**Avoids pitfalls:** Over-triggering bubbles by resetting fadeTimer on every poll -- only trigger on meaningful activity changes; label revert timing races with session polling -- define clear "session is dead" heuristic; stale activity text after fade -- keep bubbles as change notifications, not persistent status

**Files modified:** `world.ts`, `speech-bubble.ts` (minor), `constants.ts` (if timing needs adjustment)

### Phase 3: Agent Fade-Out Lifecycle

**Rationale:** Most complex feature. Adds a 6th state to the agent FSM, requires timer-based transitions, cleanup of 7+ Maps, edge case handling for session reactivation, deferred removal during tick iteration, and coordination with the SessionStore's never-remove policy. Should be implemented last so the implementer has already worked through World modifications in Phases 1-2 and understands the agent lifecycle intimately.

**Delivers:** Agents that complete celebration and walk back to Guild Hall linger briefly then fade out smoothly; faded agents are fully destroyed and cleaned from all tracking structures; dismissed sessions do not get resurrected by stale IPC data; fading agents can be reactivated if their session becomes active again; tick rate stays at 30fps during fade animations.

**Addresses features:** Agent fade-out state (P1), agent cleanup after fade (P1), dismissed session reactivation guard (P1), graceful linger timing (P2 stretch), agent count in building label (P2 stretch)

**Avoids pitfalls:** Memory leak from undestroyed agents -- single `removeAgent()` method cleans all maps; resurrection by stale IPC -- `fadingOut` guard + `dismissedSessions` Set; concurrent modification during tick -- deferred removal pattern; double-fade on speech bubble -- deactivate bubble when agent enters fade-out; alpha writer conflicts -- fading_out state is dominant and exclusive, skips breathing/tint/shake

**Files modified:** `agent.ts`, `world.ts`, `constants.ts`, `types.ts` (if adding fading_out to AgentState union)

### Phase 4: Polish and Verification (Optional)

**Rationale:** Additive polish that is safe only after all three core features are verified working. These items improve visual quality but are not required for milestone sign-off.

**Delivers:** Label crossfade animation on text change, agent count suffix in building labels, final timing tuning for fade duration and linger period, end-to-end testing with multiple simultaneous Claude Code sessions.

**Files modified:** `building.ts` (crossfade), `world.ts` (agent count), `constants.ts` (timing)

### Phase Ordering Rationale

- **Labels before routing/bubbles**: Building label infrastructure (setLabel/resetLabel, BitmapFont expansion) must exist before the routing change that determines which labels to show. Also the simplest change, building confidence before larger refactors.
- **Routing + bubbles before fade-out**: The routing refactor in manageAgents() restructures how agents are assigned to buildings. The fade-out lifecycle also modifies manageAgents() for the fadingOut guard. Doing routing first means the fade-out code is written against the final routing logic, not the soon-to-be-replaced activity-based routing.
- **Fade-out last**: It touches the most code, has the most edge cases (reactivation, concurrent modification, alpha conflicts, cleanup of 7+ maps), and benefits from the implementer's familiarity with World internals gained in Phases 1-2.
- **All three features are fully independent in terms of code dependencies**: This ordering is a recommendation based on complexity gradient and practical implementation flow, not a hard dependency chain.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (routing change):** The switch from activity-based to project-based routing is the largest architectural change in v1.2. The exact assignment strategy (first-come-first-served building slots, project-to-building mapping lifecycle, overflow handling for 5+ projects) needs detailed design during phase planning. Consider `/gsd:research-phase` to validate the routing replacement strategy.

Phases with standard patterns (skip research-phase):
- **Phase 1 (dynamic labels):** Straightforward property addition to Building and data aggregation in World. All PixiJS APIs documented with code examples in STACK.md.
- **Phase 3 (agent fade-out):** Timer-based state transitions, deferred removal, alpha fade -- all patterns already exist in the codebase (celebration timer, speech bubble fade, breathing alpha). The implementation mirrors existing code patterns.
- **Phase 4 (polish):** Purely additive visual improvements using established patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies needed. All PixiJS 8 APIs verified against official documentation. BitmapText.text setter, Container.alpha, Container.destroy() are stable core APIs. Known BitmapText visibility bug (#11294) documented with workaround. |
| Features | HIGH | All features derived from direct codebase analysis of 22 source files. SessionInfo already carries all needed data (projectName, activityType, status). Feature dependencies and anti-features clearly identified with rationale. |
| Architecture | HIGH | Comprehensive component modification plan grounded in existing code patterns. Timer-based state transitions, Map-per-concern tracking, and World-owns-lifecycle patterns are all established in the codebase. No new architectural patterns introduced. |
| Pitfalls | HIGH | Critical pitfalls sourced from PixiJS 8 GitHub issues (#11294, #11877, #11373), official documentation (garbage collection, performance tips), and direct codebase inspection. Memory leak, resurrection, and alpha conflict pitfalls have concrete prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Project-based routing strategy**: The research identifies the need to switch from activity-based to project-based building routing but does not fully design the assignment algorithm. Questions remain: What happens when a project's activity type changes -- does the agent stay at the same building or move? How are building slots reclaimed when all of a project's sessions end? What is the visual treatment for the 5th+ project that overflows the 4-building limit? These need resolution during Phase 2 planning.

- **Session "ended" detection heuristic**: The SessionStore never removes sessions, and there is no explicit "session ended" signal. The research proposes three options (time-based idle threshold, process-based PID check, explicit `ended` status). The choice affects when building labels revert and when agent fade-out triggers. This needs a design decision during Phase 2-3 planning. The simplest viable approach: treat any session that has been `idle` for more than N minutes (e.g., 5 minutes) as ended, triggering both label revert and agent fade-out.

- **Speech bubble scope clarification**: The v1.2 spec says "speech bubbles show current activity text" but the current implementation shows activity icons, not text. The research recommends keeping icons (readable at 28x24px bubble size; text would be illegible) and treating the "feature" as expanding trigger points rather than changing content. This interpretation should be validated against the original specification intent.

- **Concurrent multiple-project-per-building display**: When multiple distinct projects route to the same building (possible if routing stays activity-based, or if project count exceeds 4), the label strategy needs a policy: show first project, show most recently active, cycle, or show with count suffix. The research recommends "primary name (+N)" format. Confirm this during Phase 1-2 implementation.

## Sources

### Primary (HIGH confidence)

- [PixiJS 8.x BitmapText API](https://pixijs.download/dev/docs/scene.BitmapText.html) -- text property setter, dynamic updates
- [PixiJS 8.x Container API](https://pixijs.download/dev/docs/scene.Container.html) -- alpha, destroy, removeChild
- [PixiJS 8.x Bitmap Text Guide](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap) -- BitmapText performance characteristics
- [PixiJS 8.x Container Guide](https://pixijs.com/8.x/guides/components/scene-objects/container) -- container lifecycle, scene graph management
- [PixiJS 8.x Garbage Collection](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- destroy best practices
- [PixiJS 8.x Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) -- optimization guidance
- [PixiJS Issue #11294](https://github.com/pixijs/pixijs/issues/11294) -- BitmapText not updating while invisible
- [PixiJS Issue #11877](https://github.com/pixijs/pixijs/issues/11877) -- Dynamic BitmapText style caching pitfalls
- [PixiJS Issue #11373](https://github.com/pixijs/pixijs/issues/11373) -- Destroying parent with children and render layers
- [PixiJS Issue #3955](https://github.com/pixijs/pixijs/issues/3955) -- visible vs renderable vs alpha performance differences
- Direct codebase analysis of all 22 source files in `src/` -- existing patterns verified

### Secondary (MEDIUM confidence)

- [PixiJS BitmapFont Dynamic Warnings - PR #10627](https://github.com/pixijs/pixijs/pull/10627) -- dynamic font texture warning threshold
- [PixiJS BitmapFont Space Corruption - Issue #11413](https://github.com/pixijs/pixijs/issues/11413) -- space character corruption (version-dependent)
- [PixiJS v8.11.0 Release](https://pixijs.com/blog/8.11.0) -- SplitBitmapText, breakWords for BitmapText (confirms active development)

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
