# Phase 9: Speech Bubbles and Project Routing - Research

**Researched:** 2026-02-26
**Domain:** Speech bubble trigger expansion, activity text display, and auto-fade behavior in PixiJS 8 + Electron visualizer
**Confidence:** HIGH

## Summary

Phase 9 focuses on making speech bubbles useful. The current implementation has the complete auto-fade mechanism (4s display + 1s fade) but under-triggers it -- bubbles only appear when an agent's `activityType` changes while it is in the `working` state. This means no bubble appears when an agent first leaves Guild Hall, and with project-based routing (where the same project always goes to the same building), activity type changes no longer cause building changes, so the only trigger point rarely fires. The requirements ask for bubbles that display the current activity as text, appear on all meaningful changes, and fade automatically.

The project-based routing described in success criterion 4 is already fully implemented by Phase 8. The `projectToBuilding` Map, `getProjectBuilding()`, `buildingSlots`, and `releaseInactiveProjectSlots()` are all in place in `world.ts`. No routing work is needed for Phase 9.

The concrete work for Phase 9 is: (1) add activity text to the speech bubble (currently icon-only), with the bubble resized to accommodate text; (2) add a trigger when an agent first leaves Guild Hall (`idle_at_hq` -> `walking_to_building`); (3) add a trigger when activity type changes while at the same building (which is now the common case under project-based routing). The SpeechBubble class needs modification to support text content, and World.manageAgents() needs 2-3 additional `bubble.show()` calls at the right trigger points.

**Primary recommendation:** Add BitmapText to SpeechBubble with auto-sizing, then add two new trigger points in World.manageAgents() (initial departure from Guild Hall + same-building activity change). The auto-fade mechanism is already complete and correct.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUBBLE-01 | Speech bubbles display the agent's current activity as text | SpeechBubble needs BitmapText child showing capitalized activityType ("Coding", "Reading", etc.); bubble background auto-sizes to fit text width; existing icon can be kept alongside text or replaced |
| BUBBLE-02 | Speech bubbles auto-fade after a few seconds | Already implemented: `SpeechBubble.tick()` fades after `SPEECH_BUBBLE_DURATION` (4000ms) over `SPEECH_BUBBLE_FADE_MS` (1000ms). Verify it still works correctly after adding text content |
| BUBBLE-03 | Speech bubbles re-appear on any activity change, not just building transitions | Add `bubble.show()` calls at two new trigger points: (1) initial departure from Guild Hall, (2) same-building activity type change. Currently only triggers on activity change while working at a building |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PixiJS | 8.16.0 | BitmapText for bubble text, Graphics for bubble background, Container for composition | Already in use. BitmapText.text setter is cheap (no texture regeneration). Graphics.roundRect for bubble background |
| PixelSignpost BitmapFont | N/A (custom) | Renders bubble text labels | Already installed via `installPixelFont()` with full ASCII 32-126 chars |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new dependencies | - | - | All work uses existing PixiJS primitives already imported |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BitmapText for bubble text | PixiJS Text (canvas-rendered) | Text regenerates canvas texture on every change. BitmapText is cheaper because it uses pre-generated atlas glyphs. Use BitmapText. |
| Manual bubble sizing | Nine-slice sprite | Overkill for 5 possible text strings. Manual Graphics.roundRect is simpler and already used for the current bubble |
| Activity text strings | Keep icon-only, expand triggers | Would technically satisfy BUBBLE-02 and BUBBLE-03 but NOT BUBBLE-01 which says "display the agent's current activity as text" |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Current SpeechBubble Architecture
```
SpeechBubble (Container)
+-- bubble (Graphics: roundRect 28x24 + triangle pointer)
+-- icon (Graphics: context-swapped per activity)
```

### Target SpeechBubble Architecture
```
SpeechBubble (Container)
+-- bubble (Graphics: roundRect AUTO-SIZED + triangle pointer)
+-- icon (Graphics: context-swapped per activity)
+-- label (BitmapText: activity name text, e.g. "Coding")
```

### Recommended File Changes
```
src/
+-- renderer/
|   +-- speech-bubble.ts    # MODIFY: add BitmapText label, auto-size bubble, update show()
|   +-- world.ts            # MODIFY: add 2 new bubble.show() trigger points in manageAgents()
+-- shared/
    +-- constants.ts        # POSSIBLY MODIFY: activity display names map (optional)
```

### Pattern 1: Auto-Sizing Bubble Background
**What:** Rebuild the bubble Graphics when `show()` is called (not per-frame), sizing it to fit the text content.
**When to use:** Every `show()` call, since text content changes.
**Example:**
```typescript
// In SpeechBubble.show()
show(activity: ActivityType): void {
  // Update icon
  const iconCtx = getActivityIcon(activity);
  if (iconCtx) {
    this.icon.context = iconCtx;
  }

  // Update text label
  const displayName = ACTIVITY_DISPLAY_NAMES[activity]; // "Coding", "Reading", etc.
  this.label.text = displayName;

  // Auto-size bubble background to fit icon + text
  const textWidth = this.label.width;
  const bubbleWidth = 7 + 14 + 4 + textWidth + 6; // leftPad + iconWidth + gap + text + rightPad
  const bubbleHeight = 24;

  this.bubble.clear();
  this.bubble.roundRect(0, 0, bubbleWidth, bubbleHeight, 4).fill(0xffffff);
  // Triangle pointer at bottom-center
  const cx = bubbleWidth / 2;
  this.bubble.moveTo(cx - 4, bubbleHeight).lineTo(cx, bubbleHeight + 6).lineTo(cx + 4, bubbleHeight).fill(0xffffff);

  // Reposition icon and text within bubble
  this.icon.position.set(7, 5);
  this.label.position.set(7 + 14 + 4, 4); // after icon + gap

  // Re-center bubble above agent (anchor-like centering)
  this.position.set(-bubbleWidth / 2, -60 - bubbleHeight);

  // Reset fade
  this.alpha = 1;
  this.visible = true;
  this.fadeTimer = 0;
  this.isActive = true;
}
```

### Pattern 2: Trigger Points in manageAgents()
**What:** Show speech bubble at the right moments -- not every poll, but on meaningful state changes.
**When to use:** When agent transitions from idle to active, or when activity type changes.
**Example:**
```typescript
// In World.manageAgents(), after determining activityType and before tracking it:

// Trigger 1: Initial departure from Guild Hall
if (agentState === 'idle_at_hq' && activityType !== 'idle') {
  // Agent leaving guild hall for first time -- show bubble
  const bubble = this.speechBubbles.get(session.sessionId);
  if (bubble) bubble.show(activityType);
}

// Trigger 2: Activity change while at same building (already working)
if (agentState === 'working') {
  const prevActivity = this.lastActivity.get(session.sessionId);
  if (prevActivity && prevActivity !== activityType) {
    const bubble = this.speechBubbles.get(session.sessionId);
    if (bubble) bubble.show(activityType);
  }
}
```

### Anti-Patterns to Avoid

- **Rebuilding Graphics every frame:** Only rebuild bubble background in `show()`, not in `tick()`. The bubble size is static between show() calls. Rebuilding Graphics per-frame is expensive in PixiJS 8.

- **Triggering show() on every poll cycle:** If `show()` is called every 3-second poll (because any session data changed), the `fadeTimer` resets to 0 and the bubble never fades. Only trigger on `activityType` changes, not on `lastModified` changes.

- **Changing bubble position without centering:** The current bubble position is `(-14, -60)` which centers a 28px-wide bubble over the agent. When the bubble width changes dynamically, the x-position must be recalculated as `(-bubbleWidth / 2, ...)`.

- **Forgetting to handle the 'idle' activity type:** When activity is 'idle', don't show a bubble. The agent is heading to Guild Hall, not starting new work. Only show bubbles for non-idle activities.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text measurement | Manual character counting for width | `BitmapText.width` after setting text | BitmapText computes width from atlas glyph metrics; manual measurement is wrong for non-monospace glyphs |
| Fade animation | Custom tween library or GSAP import | Existing `SpeechBubble.tick()` timer + alpha pattern | The fade is already implemented. Adding a tween library for one more fade is inconsistent with the codebase pattern |
| Activity display names | Inline string formatting | A const map: `{ coding: "Coding", reading: "Reading", ... }` | Centralizes display text, easy to update later |

**Key insight:** The SpeechBubble auto-fade is ALREADY COMPLETE. The implementation work is (1) adding text content and (2) adding trigger points. Do not rewrite the fade logic.

## Common Pitfalls

### Pitfall 1: Over-Triggering Bubbles (Infinite Fade Reset)
**What goes wrong:** Bubble `show()` is called on every 3-second poll because session `lastModified` changed. The `fadeTimer` resets to 0 each time, so the bubble never fades out.
**Why it happens:** Comparing raw session data (which includes timestamps) instead of comparing only `activityType`.
**How to avoid:** Only call `bubble.show()` when `activityType` differs from `lastActivity`. The existing `lastActivity` Map in World already tracks this -- use the same comparison pattern.
**Warning signs:** Bubble stays visible permanently during active sessions.

### Pitfall 2: Bubble Position Drift After Resize
**What goes wrong:** When the bubble width changes (e.g., "Coding" vs "Reading" have different text widths), the bubble appears off-center above the agent.
**Why it happens:** The x-position of the SpeechBubble container is hardcoded to `-14` (half of 28px static width). After dynamic sizing, the x must be `-bubbleWidth / 2`.
**How to avoid:** Recalculate `this.position.x = -bubbleWidth / 2` in every `show()` call.
**Warning signs:** Bubble appears shifted left or right relative to the agent.

### Pitfall 3: Bubble Text Illegible at Small Font Size
**What goes wrong:** BitmapText at 16px font size within a 24px-high bubble is hard to read, especially with an icon taking up space.
**Why it happens:** Trying to fit too much content in a small space.
**How to avoid:** Keep text short -- single word ("Coding", "Reading", "Testing", "Comms"). Do NOT try to show tool names, file paths, or descriptions. The activity type name is the right abstraction level. Consider whether font size 12 works better for text within the bubble, or keep 16 if the bubble is enlarged enough.
**Warning signs:** Text looks cramped or overlaps icon.

### Pitfall 4: Missing Trigger for Same-Building Activity Change
**What goes wrong:** With project-based routing, when an agent switches from "coding" to "testing", it stays at the same building. The existing trigger (which only fires on building transition) never fires. No bubble appears.
**Why it happens:** The existing bubble trigger is inside the `if (prevActivity && prevActivity !== activityType)` block, but that block also reassigns the agent to a building. With project-based routing, the building is always the same, so the reassignment is unnecessary -- but the bubble trigger is buried in that code path.
**How to avoid:** Separate the bubble trigger from the building assignment logic. Check for activity changes independently of building changes.
**Warning signs:** Agent works at building for extended periods with no bubble appearing on activity switches.

### Pitfall 5: Icon GraphicsContext Not Updating When Bubble Resizes
**What goes wrong:** After calling `this.bubble.clear()` and redrawing, the icon's `GraphicsContext` may need re-rendering.
**Why it happens:** In PixiJS 8, `Graphics.context` swap should trigger a re-render, but clearing the parent bubble Graphics and rebuilding could affect child render order.
**How to avoid:** Icon and label are separate children of SpeechBubble Container. Clearing the bubble Graphics (which is one child) should not affect the icon Graphics (a sibling child). Verify this during implementation.
**Warning signs:** Icon disappears or renders behind the bubble background after a resize.

## Code Examples

### Current Speech Bubble Show (source: codebase `speech-bubble.ts`)
```typescript
show(activity: ActivityType): void {
  const iconCtx = getActivityIcon(activity);
  if (iconCtx) {
    this.icon.context = iconCtx;
  }
  this.alpha = 1;
  this.visible = true;
  this.fadeTimer = 0;
  this.isActive = true;
}
```

### Current Bubble Trigger in World (source: codebase `world.ts` lines 292-301)
```typescript
// Inside manageAgents(), when agentState === 'working':
const prevActivity = this.lastActivity.get(session.sessionId);
if (prevActivity && prevActivity !== activityType) {
  const entrance = this.getBuildingEntrance(building);
  const workPos = this.getBuildingWorkPosition(building, session.sessionId);
  agent.assignToCompound(entrance, workPos);
  this.agentBuilding.set(session.sessionId, building);
  // Show speech bubble on activity change
  const bubble = this.speechBubbles.get(session.sessionId);
  if (bubble) {
    bubble.show(activityType);
  }
}
```

### Activity Display Name Map (new constant)
```typescript
// In constants.ts -- centralizes display text for bubble labels
export const ACTIVITY_DISPLAY_NAMES: Record<ActivityType, string> = {
  coding:  'Coding',
  reading: 'Reading',
  testing: 'Testing',
  comms:   'Comms',
  idle:    'Idle',
};
```

### Enhanced SpeechBubble with Text (target implementation)
```typescript
import { Container, Graphics, BitmapText } from 'pixi.js';
import type { ActivityType } from '../shared/types';
import {
  SPEECH_BUBBLE_DURATION,
  SPEECH_BUBBLE_FADE_MS,
  ACTIVITY_DISPLAY_NAMES,
} from '../shared/constants';
import { getActivityIcon } from './activity-icons';

export class SpeechBubble extends Container {
  private bubble: Graphics;
  private icon: Graphics;
  private label: BitmapText;
  private fadeTimer = 0;
  private isActive = false;

  constructor() {
    super();

    // White rounded rect background (initial size, rebuilt on show)
    this.bubble = new Graphics();
    this.bubble.roundRect(0, 0, 28, 24, 4).fill(0xffffff);
    this.bubble.moveTo(10, 24).lineTo(14, 30).lineTo(18, 24).fill(0xffffff);
    this.addChild(this.bubble);

    // Icon
    this.icon = new Graphics();
    this.icon.position.set(7, 5);
    this.addChild(this.icon);

    // Activity name text
    this.label = new BitmapText({
      text: '',
      style: { fontFamily: 'PixelSignpost', fontSize: 16 },
    });
    this.label.tint = 0x333333; // Dark text on white bubble
    this.addChild(this.label);

    this.visible = false;
    this.position.set(-14, -60);
  }

  show(activity: ActivityType): void {
    // Update icon
    const iconCtx = getActivityIcon(activity);
    if (iconCtx) this.icon.context = iconCtx;

    // Update text
    const displayName = ACTIVITY_DISPLAY_NAMES[activity];
    this.label.text = displayName;

    // Calculate bubble size based on content
    const iconWidth = 14;
    const gap = 4;
    const padLeft = 7;
    const padRight = 6;
    const textWidth = this.label.width;
    const bubbleWidth = padLeft + iconWidth + gap + textWidth + padRight;
    const bubbleHeight = 24;

    // Rebuild bubble background
    this.bubble.clear();
    this.bubble.roundRect(0, 0, bubbleWidth, bubbleHeight, 4).fill(0xffffff);
    const cx = bubbleWidth / 2;
    this.bubble
      .moveTo(cx - 4, bubbleHeight)
      .lineTo(cx, bubbleHeight + 6)
      .lineTo(cx + 4, bubbleHeight)
      .fill(0xffffff);

    // Position icon and text inside bubble
    this.icon.position.set(padLeft, 5);
    this.label.position.set(padLeft + iconWidth + gap, 4);

    // Re-center bubble above agent head
    this.position.set(-bubbleWidth / 2, -60 - bubbleHeight + 24);

    // Reset fade
    this.alpha = 1;
    this.visible = true;
    this.fadeTimer = 0;
    this.isActive = true;
  }

  tick(deltaMs: number): void {
    if (!this.isActive) return;
    this.fadeTimer += deltaMs;
    if (this.fadeTimer > SPEECH_BUBBLE_DURATION) {
      const fadeProgress =
        (this.fadeTimer - SPEECH_BUBBLE_DURATION) / SPEECH_BUBBLE_FADE_MS;
      this.alpha = Math.max(0, 1 - fadeProgress);
      if (this.alpha <= 0) {
        this.visible = false;
        this.isActive = false;
      }
    }
  }
}
```

### Enhanced Trigger Points in World.manageAgents() (target)
```typescript
// In the loop over sessions, after determining activityType and building:

if (activityType !== 'idle') {
  const building = this.getProjectBuilding(session.projectName);
  if (building) {
    if (agentState === 'idle_at_hq') {
      // Agent leaving Guild Hall -- assign to building AND show bubble
      const entrance = this.getBuildingEntrance(building);
      const workPos = this.getBuildingWorkPosition(building, session.sessionId);
      agent.assignToCompound(entrance, workPos);
      this.agentBuilding.set(session.sessionId, building);
      // BUBBLE-03: Show bubble on initial departure
      const bubble = this.speechBubbles.get(session.sessionId);
      if (bubble) bubble.show(activityType);
    } else if (agentState === 'working') {
      const prevActivity = this.lastActivity.get(session.sessionId);
      if (prevActivity && prevActivity !== activityType) {
        // BUBBLE-03: Show bubble on same-building activity change
        const bubble = this.speechBubbles.get(session.sessionId);
        if (bubble) bubble.show(activityType);
        // No need to reassign to building -- project routing keeps same building
      }
    }
  }
  // ... overflow handling unchanged
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Activity-based routing (agent goes to building matching activity type) | Project-based routing (agent goes to building assigned to its project) | Phase 8 (2026-02-26) | Activity changes no longer cause building changes, so speech bubble triggers need updating to fire on same-building activity changes |
| Icon-only speech bubbles | Icon + text speech bubbles | Phase 9 (this phase) | Bubbles become larger, need auto-sizing, and display readable activity names |
| Speech bubbles only on building transitions | Speech bubbles on all meaningful activity changes | Phase 9 (this phase) | Two new trigger points: initial departure, same-building activity change |

**Already implemented (no changes needed):**
- Speech bubble auto-fade timer and alpha animation (`SpeechBubble.tick()`)
- Project-to-building mapping and slot assignment (`World.getProjectBuilding()`)
- Building label dynamic updates (`Building.setLabel()` / `resetLabel()`)
- BitmapFont with full printable ASCII range (`installPixelFont()`)
- Activity icon GraphicsContexts (`initActivityIcons()`)

## Open Questions

1. **Should the icon be kept alongside text, or replaced by text-only?**
   - What we know: The current icon is 14x14px and recognizable. Adding text next to it makes the bubble wider (~80-100px vs current 28px).
   - What's unclear: Whether the wider bubble looks good visually at the small scale of the world. Two agents at the same building with wide bubbles might overlap.
   - Recommendation: Start with icon + text. If bubbles overlap badly, fall back to text-only (removing the icon saves ~18px width). This is a visual design call best made during implementation by looking at the result.

2. **Should font size be 16px (matching building labels) or smaller?**
   - What we know: Building labels at 16px are readable above buildings. But building labels sit against dark backgrounds, while bubble text is dark-on-white at a smaller apparent scale (closer to agent head, in a small container).
   - What's unclear: Whether 16px text looks right in a 24px-high bubble, or if 12px would be more proportional.
   - Recommendation: Start with 16px for consistency with the only other text in the world. Adjust if it looks too large in the bubble.

3. **Should the bubble trigger on the 'walking_to_building' start or the 'working' arrival?**
   - What we know: BUBBLE-01 says "when an agent first leaves Guild Hall." This implies the trigger should be at departure time (when agent starts walking), not at arrival time (when agent reaches the building).
   - What's unclear: Whether showing a bubble while the agent is walking looks good (the bubble trails along with the agent).
   - Recommendation: Trigger at departure (the `idle_at_hq` -> `walking_to_building` transition in `manageAgents()`). This matches the requirement wording and gives the user immediate feedback. The bubble travels with the agent as a child of the Agent container, which looks natural.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `src/renderer/speech-bubble.ts` -- complete auto-fade implementation verified
- Direct codebase analysis of `src/renderer/world.ts` -- current trigger points identified (line 292-301 only fires on activity type change while working)
- Direct codebase analysis of `src/renderer/agent.ts` -- 5-state FSM verified, no speech bubble integration in agent
- Direct codebase analysis of `src/shared/constants.ts` -- `SPEECH_BUBBLE_DURATION=4000`, `SPEECH_BUBBLE_FADE_MS=1000`
- Direct codebase analysis of `src/renderer/building.ts` -- `setLabel()`/`resetLabel()` already implemented in Phase 8
- Direct codebase analysis of `src/renderer/bitmap-font.ts` -- ASCII 32-126 range already installed
- Direct codebase analysis of `src/renderer/activity-icons.ts` -- 5 pre-built GraphicsContexts for all activity types
- PixiJS 8.x BitmapText API (verified via existing codebase usage in Building class)
- PixiJS 8.x Graphics.clear() and Graphics.roundRect() (verified via existing SpeechBubble implementation)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- component modification plan and data flow analysis
- `.planning/research/FEATURES.md` -- feature dependency analysis and anti-feature rationale
- `.planning/research/SUMMARY.md` -- pitfall synthesis (over-triggering, BitmapFont gaps already resolved)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all APIs already used in codebase
- Architecture: HIGH -- modifications are additive to existing SpeechBubble and World patterns
- Pitfalls: HIGH -- trigger over-firing and bubble positioning are well-understood from codebase analysis; auto-fade mechanism is verified working

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable -- no external dependency changes expected)
