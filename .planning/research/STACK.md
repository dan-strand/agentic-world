# Stack Research

**Domain:** Animated 2D pixel-art desktop process visualizer (always-on, Windows)
**Researched:** 2026-02-26
**Confidence:** HIGH

---

## v1.2 Activity Monitoring & Labeling -- Stack Additions Only

This document covers stack needs for three v1.2 features: dynamic building labels, auto-fading speech bubbles, and agent fade-out lifecycle. The validated core (Electron 40.6.1, PixiJS 8.16.0, TypeScript 5.7, pixi-filters 6.1.5, Webpack/Electron Forge, pngjs sprite generation, atlas-first asset pipeline) is NOT re-researched.

**Bottom line: No new npm dependencies are needed.** All three features are achievable with PixiJS 8 APIs already in the codebase. The work is purely code-level changes to existing modules.

---

## Recommended Stack

### Core Technologies (Validated -- Do Not Change)

| Technology | Version | Purpose | Status for v1.2 |
|------------|---------|---------|------------------|
| Electron | ^40.6.1 | Desktop app shell | No changes needed |
| PixiJS | ^8.16.0 | 2D rendering engine | Already has all APIs needed for v1.2 features |
| TypeScript | ^5.7 | Type safety | No changes needed |
| pixi-filters | ^6.1.5 | GlowFilter for celebrations | No changes needed (not involved in v1.2) |
| pngjs | ^7.0.0 | Atlas generation | No changes needed |
| chokidar | ^4.0.3 | File watching | No changes needed |

### NO New Libraries Required

All three v1.2 features use PixiJS primitives already imported in the codebase:

| Feature | PixiJS API | Already Used In |
|---------|-----------|-----------------|
| Dynamic building labels | `BitmapText.text` setter | `building.ts` (creates BitmapText with `PixelSignpost` font) |
| Speech bubble auto-fade | `Container.alpha` + timer | `speech-bubble.ts` (already implements fade via `SPEECH_BUBBLE_DURATION`) |
| Agent fade-out | `Container.alpha` + `Container.destroy()` | `agent.ts` (uses alpha for breathing), `world.ts` (removes agents) |

---

## Feature 1: Dynamic Building Labels

### What Exists

`Building` constructor creates a `BitmapText` label using `BUILDING_LABELS[buildingType]` -- a static string like "Wizard Tower". The label is added as a child but no reference is stored for later updates.

### What Changes

Store a reference to the BitmapText label child so the text can be updated dynamically. Use `BitmapText.text` setter to swap between project name and RPG name.

**PixiJS 8 API (verified):** Setting `bitmapText.text = 'New Value'` is cheap -- BitmapText renders from pre-generated texture atlas glyphs, so text changes have no performance implications. No texture regeneration occurs.

**Pattern:**
```typescript
// In Building class -- store label reference
private label: BitmapText;

// Dynamic update method
setLabel(text: string): void {
  this.label.text = text;
}

// Revert to default
resetLabel(): void {
  this.label.text = BUILDING_LABELS[this.buildingType];
}
```

### BitmapFont Character Set Gap

The existing `PixelSignpost` font in `bitmap-font.ts` covers `a-z`, `A-Z`, `0-9`, space, `-`, `.`, `_`, `/`, `\`. Project folder names on Windows can contain additional characters. The character set needs expansion:

| Current | Missing for Project Names | Action |
|---------|--------------------------|--------|
| `a-z`, `A-Z`, `0-9` | Sufficient for most names | Keep |
| `-`, `.`, `_` | Common in folder names | Keep |
| `/`, `\` | Path separators | Keep |
| -- | `(`, `)` | Add -- some projects use parens |
| -- | `'` (apostrophe) | Add -- e.g. "Dan's Project" |
| -- | `!`, `@`, `#`, `+` | Add -- uncommon but possible |

**Recommendation:** Expand chars array to include `!` through `~` (ASCII 33-126, the full printable ASCII range). This covers all possible folder name characters with one range instead of individual entries. Cost is negligible -- BitmapFont generates one texture atlas at init time.

```typescript
chars: [
  [' ', '~'],  // ASCII 32-126: all printable characters
],
```

### Label Truncation

Building labels sit above 96px-wide buildings. Project names like "my-very-long-project-name" will overflow. Truncate to a max character count with ellipsis.

**No new library needed.** Simple string truncation:
```typescript
function truncateLabel(name: string, maxChars: number = 14): string {
  return name.length > maxChars ? name.slice(0, maxChars - 2) + '..' : name;
}
```

Use `..` instead of the Unicode ellipsis character to stay within ASCII BitmapFont range.

---

## Feature 2: Speech Bubble Auto-Fade (Already Implemented)

### What Exists

`SpeechBubble` class already implements auto-fade:
- Shows activity icon on `show(activity)`
- Fades after `SPEECH_BUBBLE_DURATION` (4000ms)
- Fades over `SPEECH_BUBBLE_FADE_MS` (1000ms)
- Hides when alpha reaches 0

### What May Change

The v1.2 spec says "speech bubbles show current activity text." The current implementation shows an activity **icon** (wrench, magnifying glass, gear, antenna, pause bars), not text. If the spec means adding text alongside or instead of icons, that involves:

**Option A -- Keep icons only (recommended):** Icons are already implemented and readable at the 28x24px bubble size. Text at this scale would be illegible. No changes needed.

**Option B -- Add text label below bubble:** A second, smaller BitmapText below the speech bubble showing a short activity word ("coding", "reading", etc.). This uses the existing `PixelSignpost` font at a smaller size.

**No new dependencies either way.** Both options use existing PixiJS APIs.

### Potential Timing Tuning

The current 4-second display + 1-second fade may need adjustment based on how frequently activity changes occur. These are constants in `constants.ts` and trivially tunable. No stack implications.

---

## Feature 3: Agent Fade-Out Lifecycle

### What Exists

The agent state machine currently has this lifecycle for completed sessions:
```
working -> celebrating (2.5s level-up effect) -> walking_to_building (to HQ) -> idle_at_hq
```

Agents reaching `idle_at_hq` stay there forever. Dead sessions accumulate at the Guild Hall.

### What Changes

Add a new state `fading_out` after `idle_at_hq` (or after walking back to HQ). The agent's alpha decreases from 1.0 to 0.0 over a configurable duration, then the agent is removed from the scene and destroyed.

**PixiJS 8 API (verified):**
- `Container.alpha` setter -- already used for breathing effect in `agent.ts`
- `parent.removeChild(child)` -- standard PixiJS scene graph removal
- `container.destroy({ children: true })` -- full cleanup including child sprites, textures are NOT destroyed (they are shared atlas textures)

**Cleanup protocol (from PixiJS 8 docs):**
```typescript
// 1. Remove from parent container
this.agentsContainer.removeChild(agent);
// 2. Destroy the agent and all its children (AnimatedSprite, SpeechBubble, etc.)
agent.destroy({ children: true });
// 3. Clean up Map references
this.agents.delete(sessionId);
this.speechBubbles.delete(sessionId);
this.statusDebounce.delete(sessionId);
this.lastActivity.delete(sessionId);
this.lastCommittedStatus.delete(sessionId);
this.lastRawStatus.delete(sessionId);
```

**Important:** Do NOT pass `{ texture: true }` to `destroy()`. The agent's AnimatedSprite textures come from shared atlas spritesheets -- destroying the texture would break other agents using the same character class.

### State Machine Addition

```
// Current:
celebrating -> walking_to_building (HQ) -> idle_at_hq (forever)

// New:
celebrating -> walking_to_building (HQ) -> fading_out -> [removed]
```

The `fading_out` state is a simple timer-driven alpha fade. Pattern already exists in the codebase -- `LevelUpEffect` uses an elapsed timer with alpha interpolation, and `SpeechBubble` uses the same pattern.

```typescript
case 'fading_out': {
  this.fadeTimer += deltaMs;
  const progress = this.fadeTimer / AGENT_FADEOUT_MS;
  this.alpha = Math.max(0, 1 - progress);
  if (this.alpha <= 0) {
    // Signal to World for cleanup
    this.fadeComplete = true;
  }
  break;
}
```

### When to Trigger Fade-Out

Two options for when a completed agent should start fading:

**Option A -- Fade immediately upon arrival at HQ:** Agent walks back, starts fading as soon as it reaches `idle_at_hq`. Simplest implementation.

**Option B -- Brief pause then fade:** Agent arrives at HQ, stays visible for 1-2 seconds, then starts fading. Gives the user a moment to see the agent has returned.

Both are purely timer logic -- no stack implications.

### Session Removal vs. Agent Removal

Currently, agents are only removed from the scene when the corresponding session disappears from the IPC `sessions-update` data. The v1.2 change adds a second removal path: agents that have completed their celebration and walked back to HQ fade out regardless of whether the session still appears in the process list.

This requires the `World` to check for `fadeComplete` agents in its `tick()` loop and clean them up. No new APIs or patterns -- this mirrors how `LevelUpEffect.isDone()` triggers cleanup in the agent's celebration handler.

---

## No New Installation Required

```bash
# Nothing to install for v1.2
# All features use existing PixiJS 8.16.0 APIs:
#   - BitmapText.text setter (dynamic labels)
#   - Container.alpha (fade effects)
#   - Container.destroy() (cleanup)
#   - Existing timer patterns (auto-fade timing)
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Manual alpha fade in tick() | GSAP tween library | Project already uses manual timer-based animation for tint crossfade, breathing, shake, sparkles, speech bubble fade. Adding GSAP for one more fade effect is inconsistent and adds a 30KB dependency. |
| Manual alpha fade in tick() | PixiJS 8.11.0 SplitText animations | SplitText is for text character-level animation (letter-by-letter reveals). Not relevant for fading entire agent containers. |
| BitmapText.text setter | Recreating BitmapText on label change | Wasteful. BitmapText is designed for cheap text updates -- setter just rearranges pre-rendered glyph positions. |
| Single BitmapFont with full ASCII range | Separate font for labels vs. project names | Unnecessary complexity. One font with full printable ASCII serves both use cases. |
| Container.alpha fade | Container.visible toggle (instant disappear) | Abrupt disappearance looks jarring. Fade-out gives the user visual closure that a session completed. |
| destroy({ children: true }) | Just removeChild (no destroy) | Memory leak. PixiJS display objects hold internal references and GPU state that must be explicitly released. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| GSAP / any tween library | Adds dependency for functionality already patterned throughout codebase. Every animation in the project (tint crossfade, breathing alpha, shake, sparkle physics, speech bubble fade) uses manual timer + linear interpolation in tick(). | Manual alpha interpolation in the agent's tick() method |
| PixiJS Text (canvas-rendered) | Heavier than BitmapText -- generates a canvas texture on every text change. BitmapText uses pre-rendered atlas glyphs. For frequently-updating labels, BitmapText is the correct choice. | BitmapText with PixelSignpost font (already in use) |
| Object pooling for agents | Premature optimization. The project has max 4 active sessions at a time. Agent creation/destruction is rare (minutes apart). Pooling adds complexity for no measurable benefit. | Direct create/destroy lifecycle |
| pixi-filters for fade effects | GlowFilter and other filters are for visual effects, not opacity transitions. Container.alpha is the correct and simpler mechanism. | Container.alpha property |

---

## Version Compatibility

| Existing Package | v1.2 Feature Used | Compatibility Notes |
|-----------------|-------------------|---------------------|
| pixi.js ^8.16.0 | BitmapText.text setter | Stable API since PixiJS 8.0. Note: BitmapText text won't visually update if `.visible = false` when set (known issue #11294) -- set text while visible or set visible before rendering. |
| pixi.js ^8.16.0 | Container.alpha for fade | Core property since PixiJS inception. When alpha reaches 0, rendering is automatically skipped (performance optimization). |
| pixi.js ^8.16.0 | Container.destroy({ children: true }) | Standard cleanup. Do NOT pass `{ texture: true }` for shared atlas textures. |
| pixi.js ^8.16.0 | BitmapFont.install with expanded chars | Expanded char range generates a slightly larger atlas texture at init. Negligible memory impact (one-time). |

---

## Integration Points (Existing Files Affected)

These are the files that will need modifications, not new files:

| File | Change | Reason |
|------|--------|--------|
| `src/renderer/building.ts` | Store BitmapText label reference, add `setLabel()`/`resetLabel()` methods | Dynamic building labels |
| `src/renderer/bitmap-font.ts` | Expand chars to full printable ASCII range | Support project folder name characters |
| `src/renderer/agent.ts` | Add `fading_out` state to state machine, fade timer, `fadeComplete` flag | Agent fade-out lifecycle |
| `src/shared/types.ts` | No changes needed (SessionInfo already has `projectName`) | Data already flows correctly |
| `src/shared/constants.ts` | Add `AGENT_FADEOUT_MS` constant, possibly `MAX_LABEL_CHARS` | Tuning values for new features |
| `src/renderer/world.ts` | Map projects to buildings for label updates, check fadeComplete in tick(), cleanup faded agents | Orchestration of all three features |

**No new files are expected.** All features integrate into existing class structure.

---

## Sources

- [PixiJS 8.x BitmapText API](https://pixijs.download/dev/docs/scene.BitmapText.html) -- text property setter, dynamic updates (HIGH confidence)
- [PixiJS 8.x Bitmap Text Guide](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap) -- BitmapText performance characteristics, pre-rendered atlas glyphs (HIGH confidence)
- [PixiJS 8.x Container API](https://pixijs.download/dev/docs/scene.Container.html) -- alpha, destroy, removeChild (HIGH confidence)
- [PixiJS 8.x Container Guide](https://pixijs.com/8.x/guides/components/scene-objects/container) -- container lifecycle, scene graph management (HIGH confidence)
- [PixiJS 8.x Garbage Collection](https://pixijs.com/8.x/guides/concepts/garbage-collection) -- destroy best practices, TextureGCSystem (HIGH confidence)
- [PixiJS Issue #11294](https://github.com/pixijs/pixijs/issues/11294) -- BitmapText not updating while invisible (HIGH confidence, known limitation)
- [PixiJS v8.11.0 Release](https://pixijs.com/blog/8.11.0) -- SplitBitmapText, breakWords for BitmapText (HIGH confidence, confirms active BitmapText development)
- Codebase analysis: `building.ts`, `speech-bubble.ts`, `agent.ts`, `world.ts`, `bitmap-font.ts`, `constants.ts` -- existing patterns verified (HIGH confidence)

---

*Stack research for: Agent World v1.2 -- Activity Monitoring & Labeling*
*Researched: 2026-02-26*
