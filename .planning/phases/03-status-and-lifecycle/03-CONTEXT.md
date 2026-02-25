# Phase 3: Status and Lifecycle - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add visual status differentiation so users can distinguish agent states at a glance, celebration animations when sessions complete tasks, and the drive-back-to-HQ lifecycle flow. Builds on Phase 2's agent sprite system and state machine. No new detection capabilities or world layout changes.

</domain>

<decisions>
## Implementation Decisions

### Status Visual Differentiation
- **Active** (Claude working): Bright/vivid saturated colors, working animation at normal speed. The energetic, default "alive" look.
- **Waiting** (needs user input): Amber-tinted pulsing/breathing effect — slow scale or alpha oscillation. Gentle but noticeable "I'm waiting on you" signal.
- **Idle** (30+ seconds no activity): Desaturated/grayish colors, animation slowed to near-still. Agent looks dormant/sleepy. Clear contrast with active.
- **Error**: Red tint + brief shake/jitter animation on initial transition, then settles to a red-tinted idle pose. Alarming but not overwhelming.

### Celebration Animation
- Fireworks above the agent — small pixel firework explosions above their head
- Multi-color burst palette (gold, red, blue, green sparks) — not agent-colored
- Duration: 2-3 seconds before agent starts heading back to HQ
- Multiple simultaneous completions: celebrations overlap independently (no queuing)
- Each active→idle transition triggers a celebration (multiple per session allowed)

### Walk-back-to-HQ Lifecycle
- After fireworks, agent drives back to HQ in their vehicle (same travel mechanic as deployment)
- At HQ: agent parks, stands idle near the HQ entrance. Visible as "available."
- When last agent leaves a project compound: compound fades out over 2-3 seconds and despawns
- If agent at HQ gets a new task: immediately redeploy (hop in vehicle, drive to compound). No delay.

### Status Transition Timing
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

</decisions>

<specifics>
## Specific Ideas

- The pulsing effect for "waiting" should feel like breathing — slow, rhythmic, not frantic
- Desaturation for idle should be noticeable even at a glance — not subtle
- Fireworks should feel celebratory and rewarding, like a mini achievement unlocked
- The full lifecycle loop should feel satisfying: deploy → work → celebrate → drive home → redeploy

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-status-and-lifecycle*
*Context gathered: 2026-02-25*
