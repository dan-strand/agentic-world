# Phase 8: Dynamic Building Labels - Research

**Researched:** 2026-02-26
**Domain:** PixiJS 8 BitmapText dynamic label updates, project-to-building mapping, BitmapFont character expansion
**Confidence:** HIGH

## Summary

Phase 8 adds dynamic building labels that show active project folder names when sessions are working at a building and revert to RPG names when vacant. This is a focused, renderer-only feature touching four files (`building.ts`, `world.ts`, `bitmap-font.ts`, `constants.ts`) with no IPC or main-process changes needed. The `SessionInfo.projectName` field already flows through IPC and is available in the renderer -- the data exists, the display just does not use it yet.

The key architectural decision in this phase is the introduction of **project-based building assignment** to replace activity-based routing. Currently, agents route to buildings by `activityType` (coding -> Wizard Tower, testing -> Training Grounds). This means two agents from the same project doing different activities go to different buildings, making project-name labels misleading. Phase 8 must introduce a `projectToBuilding` mapping in World that assigns each active project to one of four buildings. The roadmap confirms Phase 9 depends on Phase 8's "building label infrastructure, project-to-building mapping," so this routing change is expected here.

The implementation is straightforward: Building needs a stored label reference with `setLabel()`/`resetLabel()` methods (currently the BitmapText is an unreachable anonymous child), the BitmapFont character set needs expansion to cover all printable ASCII (currently limited to alphanumeric + a few symbols), World needs project-to-building tracking with label updates in `tick()`, and names longer than ~15 characters need truncation. No new npm dependencies. All PixiJS APIs involved are already used in the codebase.

**Primary recommendation:** Implement project-to-building assignment as the foundation, then layer Building label methods and font expansion on top. Keep labels always visible (never toggle `visible`) to avoid the known PixiJS BitmapText visibility bug (#11294).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LABEL-01 | Buildings display the active project's folder name instead of the RPG building name | Building.setLabel() method using BitmapText.text setter; World tracks projectToBuilding mapping and updates labels when sessions are working at a building; BitmapFont expanded to full printable ASCII for project name characters |
| LABEL-02 | Building label reverts to its RPG name when all sessions for that project end | Building.resetLabel() method restores `BUILDING_LABELS[buildingType]` default; World detects when no active sessions target a building and calls resetLabel(); project-to-building slot is released for reuse |
| LIFE-03 | Only 4 projects are visualized with buildings; additional projects are not shown | World maintains a 4-slot `projectToBuilding` Map; 5th+ project sessions remain at Guild Hall without a dedicated building; building slots are first-come-first-served and released when a project has no active sessions |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | ^8.16.0 | BitmapText.text setter for dynamic label updates | Already in codebase; setting text is cheap (pre-rendered atlas glyphs, no texture regeneration) |
| pixi.js | ^8.16.0 | BitmapFont.install with expanded chars | Already in codebase; one-time atlas generation at init, negligible cost |

### Supporting

No new libraries needed. All features use existing PixiJS APIs already imported.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BitmapText.text setter | Destroy + recreate BitmapText on label change | Wasteful; BitmapText is designed for cheap text updates via setter |
| Manual string truncation | PixiJS 8.11.0 SplitBitmapText | SplitBitmapText is for character-level animation, not simple truncation |
| Expanded BitmapFont chars | Dynamic font generation (on-demand) | Triggers PixiJS warnings at 50+ dynamic chars, worse performance |

**Installation:**
```bash
# Nothing to install -- all features use existing PixiJS 8.16.0 APIs
```

## Architecture Patterns

### Recommended Project Structure

No new files needed. All changes go into existing files:

```
src/
  renderer/
    building.ts      # MODIFY: store label ref, add setLabel/resetLabel
    world.ts         # MODIFY: project-to-building mapping, label updates in tick()
    bitmap-font.ts   # MODIFY: expand chars to full printable ASCII
  shared/
    constants.ts     # MODIFY: add MAX_LABEL_CHARS, building slot constants
```

### Pattern 1: Project-to-Building Assignment (First-Come-First-Served Slots)

**What:** Replace activity-based routing (`ACTIVITY_BUILDING`) with a dynamic project-based assignment where each active project claims one of 4 building slots.

**When to use:** When `manageAgents()` processes sessions and needs to determine which building an agent goes to.

**Design:**

```typescript
// World class additions

// Map from project name to quest zone building (max 4 entries)
private projectToBuilding: Map<string, Building> = new Map();

// Ordered list of quest zone buildings available for assignment
private buildingSlots: Building[] = []; // populated from questZones in init()

// Track the RPG-name-keyed quest zones for building slot order
// buildingSlots[0] = Wizard Tower position, [1] = Training Grounds, etc.
```

**Assignment algorithm:**
1. On each `updateSessions()`, collect distinct project names from sessions with `activityType !== 'idle'`
2. For each active project not yet in `projectToBuilding`, assign the next available building slot
3. For each project in `projectToBuilding` that has NO active sessions, release the slot and call `building.resetLabel()`
4. Sessions whose project has no building slot (5th+ project) stay at Guild Hall
5. Building label is set to `truncateLabel(projectName)` when a project is assigned

**Key detail:** "Active" for building assignment means the session has `activityType !== 'idle'`. An idle session does not release a building slot immediately -- the slot is released when ALL sessions for that project are idle (or the project has no sessions at all). This prevents label flicker during brief idle periods.

```typescript
// In manageAgents() -- project-based routing
private getProjectBuilding(projectName: string): Building | null {
  // Already assigned?
  const existing = this.projectToBuilding.get(projectName);
  if (existing) return existing;

  // Find an unoccupied slot
  for (const building of this.buildingSlots) {
    const isOccupied = [...this.projectToBuilding.values()].includes(building);
    if (!isOccupied) {
      this.projectToBuilding.set(projectName, building);
      building.setLabel(truncateLabel(projectName));
      return building;
    }
  }

  // All 4 slots full -- this project overflows to Guild Hall
  return null;
}
```

### Pattern 2: Building Label Mutation via Stored Reference

**What:** Store the BitmapText label as a class property and expose `setLabel()`/`resetLabel()` methods.

**When to use:** When Building needs to update its label text dynamically.

```typescript
// Building class modifications
export class Building extends Container {
  readonly buildingType: BuildingType;
  private label: BitmapText;
  private readonly defaultLabel: string;

  constructor(buildingType: BuildingType, texture: Texture) {
    super();
    this.buildingType = buildingType;
    this.defaultLabel = BUILDING_LABELS[buildingType];

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1.0);
    this.addChild(sprite);

    this.label = new BitmapText({
      text: this.defaultLabel,
      style: { fontFamily: 'PixelSignpost', fontSize: 16 },
    });
    this.label.anchor.set(0.5, 1);
    this.label.position.set(0, -texture.height - 4);
    this.addChild(this.label);
  }

  setLabel(text: string): void {
    const truncated = text.length > MAX_LABEL_CHARS
      ? text.slice(0, MAX_LABEL_CHARS - 2) + '..'
      : text;
    if (this.label.text !== truncated) {
      this.label.text = truncated;
    }
  }

  resetLabel(): void {
    if (this.label.text !== this.defaultLabel) {
      this.label.text = this.defaultLabel;
    }
  }
}
```

**Important:** Compare before setting to avoid unnecessary BitmapText layout recalculation. Use `..` (two dots) instead of unicode ellipsis to stay within ASCII BitmapFont range.

### Pattern 3: BitmapFont Full Printable ASCII

**What:** Expand the installed BitmapFont character set from the current limited range to all printable ASCII.

**When to use:** Must be done before any dynamic project name text is rendered.

```typescript
// bitmap-font.ts -- expand chars
export function installPixelFont(): void {
  BitmapFont.install({
    name: 'PixelSignpost',
    style: {
      fontFamily: 'monospace',
      fontSize: 16,
      fill: '#ffffff',
    },
    chars: [
      [' ', '~'],  // ASCII 32-126: all printable characters
    ],
    textureStyle: {
      scaleMode: 'nearest',
    },
  });
}
```

This is a one-line change (replace the 9 char ranges with a single `[' ', '~']` range). The atlas texture will be slightly larger but is generated once at init. Negligible memory impact.

### Pattern 4: Project Slot Release and Label Revert

**What:** When all sessions for a project become idle (or disappear), release the building slot and revert the label.

**When to use:** On each `updateSessions()` call.

```typescript
// In updateSessions() -- after processing all sessions
private releaseInactiveProjectSlots(sessions: SessionInfo[]): void {
  // Collect projects that still have active (non-idle) sessions
  const activeProjects = new Set<string>();
  for (const s of sessions) {
    if (s.activityType !== 'idle') {
      activeProjects.add(s.projectName);
    }
  }

  // Release slots for projects with no active sessions
  for (const [projectName, building] of this.projectToBuilding) {
    if (!activeProjects.has(projectName)) {
      building.resetLabel();
      this.projectToBuilding.delete(projectName);
    }
  }
}
```

### Anti-Patterns to Avoid

- **Toggling BitmapText visible for label changes:** PixiJS 8 has a known bug (#11294) where setting `text` while `visible = false` causes stale rendering. Keep labels always visible, only change the `text` property.
- **Setting label text every frame:** Only set `label.text` when the value actually changes. BitmapText layout recalculation is cheap but unnecessary work is still waste.
- **Activity-based routing with project labels:** Routing agents by activity type while labeling buildings with project names creates contradictions (same project at different buildings). Use project-based routing.
- **Hard-coding font characters for known project names:** Project names are user-controlled filesystem paths. Expand the font to full printable ASCII instead of guessing which characters are needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text truncation | Complex width-measurement-based truncation | Simple character count + `..` suffix | BitmapFont is monospace; character count is a reliable proxy for pixel width |
| Dynamic text rendering | Canvas-based Text objects | BitmapText.text setter | BitmapText uses pre-rendered atlas glyphs; Text regenerates a canvas texture on every change |
| Font character expansion | Per-character dynamic generation | BitmapFont.install with `[' ', '~']` range | Dynamic generation triggers PixiJS warnings and per-character texture creation |

**Key insight:** PixiJS BitmapText was designed for exactly this use case -- frequently-updated text from a pre-installed font atlas. The infrastructure already exists in the codebase.

## Common Pitfalls

### Pitfall 1: BitmapFont Character Set Gaps

**What goes wrong:** Building labels show blank spaces or missing characters for project names with characters like `(`, `)`, `+`, `@`, `#`.
**Why it happens:** Current `installPixelFont()` only covers `a-z`, `A-Z`, `0-9`, space, `-`, `.`, `_`, `/`, `\`. Project folder names can contain any OS-allowed character.
**How to avoid:** Expand chars to `[' ', '~']` (ASCII 32-126) in `installPixelFont()` before any dynamic text is rendered.
**Warning signs:** Labels render with gaps; console warning about dynamically created textures.

### Pitfall 2: BitmapText Visibility Bug (#11294)

**What goes wrong:** Label text set while `visible = false` does not render the update when made visible again.
**Why it happens:** PixiJS 8 BitmapText `didViewUpdate` flag stays stale when text changes on an invisible object.
**How to avoid:** Never toggle `visible` on building labels. Keep them always visible, only change the `text` property. Since building labels should always show something (either project name or RPG name), there is no reason to hide them.
**Warning signs:** Labels stuck on old values after session changes; intermittent rendering.

### Pitfall 3: Activity-Based Routing Conflicts with Project Labels

**What goes wrong:** Building labeled "Agent World" has agents from multiple unrelated projects because routing is still activity-based.
**Why it happens:** `ACTIVITY_BUILDING` maps activity type to building, not project to building. Two projects both doing "coding" both go to Wizard Tower.
**How to avoid:** Replace activity-based routing in `manageAgents()` with project-based assignment using a `projectToBuilding` Map.
**Warning signs:** Same project's agents scattered across buildings; two buildings showing the same project name.

### Pitfall 4: Label Revert Race with Session Polling

**What goes wrong:** Building label flickers between project name and RPG name on a 3-second cycle.
**Why it happens:** SessionStore never removes sessions. An idle session and a truly-ended session are indistinguishable. On one poll cycle the session appears idle (label reverts), on the next it's still there (label re-assigned).
**How to avoid:** Use a clear definition of "project still active": any session with `activityType !== 'idle'` keeps the project's building slot. Only release when ALL sessions for a project are idle. This is stable because idle sessions stay idle (they do not flip back to active unless the user genuinely resumes work).
**Warning signs:** Labels oscillating every 3 seconds; labels that never revert even after terminals are closed.

### Pitfall 5: Label Overflow for Long Project Names

**What goes wrong:** Project names like "my-incredibly-long-project-name" extend far beyond building width, overlapping adjacent buildings.
**Why it happens:** At 16px monospace BitmapFont, each character is ~8-10px wide. A 96px building supports ~10-12 characters. Dynamic names have no length constraint.
**How to avoid:** Truncate in `Building.setLabel()` with a constant `MAX_LABEL_CHARS` (recommended: 14-15 characters). Use `..` (two ASCII dots) as ellipsis.
**Warning signs:** Labels overlapping neighboring buildings; text extending off-screen for corner buildings.

### Pitfall 6: 5th+ Project Has Nowhere to Go

**What goes wrong:** User runs 5 simultaneous projects. The 5th project's sessions have no building assignment, and the code either crashes, overwrites an existing assignment, or leaves agents stuck with undefined targets.
**Why it happens:** Only 4 quest zone buildings exist. If the assignment code does not handle overflow, the 5th project falls through.
**How to avoid:** `getProjectBuilding()` returns `null` when all 4 slots are full. Agents for overflow projects stay at Guild Hall with idle positioning. The Guild Hall label remains "Guild Hall" (never shows a project name).
**Warning signs:** Errors when > 4 projects are active; agents walking to undefined positions.

## Code Examples

### Complete Building Class Modification

```typescript
// Source: Codebase analysis of building.ts + PixiJS 8 BitmapText docs
import { Container, Sprite, BitmapText, Texture } from 'pixi.js';
import type { BuildingType } from '../shared/constants';
import { BUILDING_LABELS, MAX_LABEL_CHARS } from '../shared/constants';

export class Building extends Container {
  readonly buildingType: BuildingType;
  private label: BitmapText;
  private readonly defaultLabel: string;

  constructor(buildingType: BuildingType, texture: Texture) {
    super();
    this.buildingType = buildingType;
    this.defaultLabel = BUILDING_LABELS[buildingType];

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1.0);
    this.addChild(sprite);

    this.label = new BitmapText({
      text: this.defaultLabel,
      style: { fontFamily: 'PixelSignpost', fontSize: 16 },
    });
    this.label.anchor.set(0.5, 1);
    this.label.position.set(0, -texture.height - 4);
    this.addChild(this.label);
  }

  /** Update label to show a project name (truncated if needed). */
  setLabel(text: string): void {
    const display = text.length > MAX_LABEL_CHARS
      ? text.slice(0, MAX_LABEL_CHARS - 2) + '..'
      : text;
    if (this.label.text !== display) {
      this.label.text = display;
    }
  }

  /** Revert label to the default RPG building name. */
  resetLabel(): void {
    if (this.label.text !== this.defaultLabel) {
      this.label.text = this.defaultLabel;
    }
  }

  // ... existing getIdlePosition, getWorkPosition, getEntrancePosition unchanged
}
```

### BitmapFont Expansion

```typescript
// Source: bitmap-font.ts + PixiJS 8 BitmapFont.install docs
export function installPixelFont(): void {
  BitmapFont.install({
    name: 'PixelSignpost',
    style: {
      fontFamily: 'monospace',
      fontSize: 16,
      fill: '#ffffff',
    },
    chars: [
      [' ', '~'],  // ASCII 32-126: all printable characters
    ],
    textureStyle: {
      scaleMode: 'nearest',
    },
  });
}
```

### World Project-to-Building Tracking

```typescript
// Source: Codebase analysis of world.ts + architecture research
// New properties in World class:
private projectToBuilding: Map<string, Building> = new Map();
private buildingSlots: Building[] = [];  // ordered list of quest zone buildings

// In init(), after creating quest zone buildings:
// Populate buildingSlots in a stable order
const slotOrder: ActivityType[] = ['coding', 'testing', 'reading', 'comms'];
for (const activity of slotOrder) {
  const building = this.questZones.get(activity);
  if (building) this.buildingSlots.push(building);
}

// In manageAgents(), replace activity-based routing:
for (const session of sessions) {
  // ... existing agent creation code ...

  if (session.activityType !== 'idle') {
    const building = this.getProjectBuilding(session.projectName);
    if (building) {
      // Route agent to project's building
      // ... same entrance/workPos logic as current, but using project building
    } else {
      // 5th+ project overflow: stay at Guild Hall
    }
  }
}

// After processing all sessions:
this.releaseInactiveProjectSlots(sessions);
```

### Constants Addition

```typescript
// Source: constants.ts
export const MAX_LABEL_CHARS = 15;  // Truncation threshold for building labels
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static building labels | Dynamic BitmapText.text setter | Phase 8 | Labels reflect active projects |
| Activity-based routing (`ACTIVITY_BUILDING`) | Project-based routing (`projectToBuilding` Map) | Phase 8 | Agents from same project go to same building |
| Limited BitmapFont chars (a-z, A-Z, 0-9, few symbols) | Full printable ASCII (32-126) | Phase 8 | All project name characters render correctly |

**Preserved from v1.1:**
- Building construction, positioning, sprite handling -- unchanged
- BitmapText font family (`PixelSignpost`), size (16px), anchor (0.5, 1) -- unchanged
- Building label position above sprite -- unchanged
- Scene hierarchy (buildings in `buildingsContainer`) -- unchanged

## Open Questions

1. **Should slots be released immediately when all sessions go idle, or after a delay?**
   - What we know: SessionStore never removes sessions. An idle session may become active again.
   - What's unclear: How long to wait before considering a project "gone." Immediate release causes label flicker if a session briefly goes idle between tools.
   - Recommendation: Release immediately when all sessions for a project have `activityType === 'idle'`. This is simple and correct -- if the session becomes active again, it will reclaim a slot (possibly a different building). The roadmap's Phase 9 will add the routing refinement. For Phase 8, keep it simple.

2. **What if a project's building slot is released and reclaimed by a different project, then the original project becomes active again?**
   - What we know: There are 4 slots and the user confirmed max 4 projects is sufficient.
   - What's unclear: Edge case when 4+ projects cycle rapidly.
   - Recommendation: Accept that a project may get a different building on re-assignment. The label updates correctly regardless. This is a cosmetic edge case, not a functional issue.

3. **Should Guild Hall label ever change?**
   - What we know: Guild Hall is for idle agents and overflow projects.
   - What's unclear: Whether to show overflow project names on Guild Hall.
   - Recommendation: Keep Guild Hall label as "Guild Hall" always. It serves a different role (idle/overflow area) and changing its label would be confusing.

4. **Should the quest zone glow highlight (ENV-04) use project-based or activity-based detection?**
   - What we know: Current glow logic in `tick()` uses `activeBuildingTypes` based on `ACTIVITY_BUILDING[activity]`. With project-based routing, this needs updating.
   - What's unclear: Whether glow should follow the new routing.
   - Recommendation: Update the glow highlight to use `projectToBuilding` instead of `ACTIVITY_BUILDING`. A building glows when any agent assigned to it is in `working` or `walking_to_workspot` state.

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: `building.ts`, `world.ts`, `bitmap-font.ts`, `constants.ts`, `types.ts`, `agent.ts`, `speech-bubble.ts`, `session-store.ts` -- all source code read and analyzed
- PixiJS 8.x BitmapText API -- text property setter for dynamic updates (verified in existing codebase usage)
- PixiJS 8.x BitmapFont.install -- chars parameter accepts range arrays like `[' ', '~']` (verified from existing `bitmap-font.ts` pattern)
- PixiJS Issue #11294 -- BitmapText not updating while invisible (confirmed bug, workaround: keep visible)

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` -- verified no new dependencies needed, BitmapText.text setter is cheap
- `.planning/research/ARCHITECTURE.md` -- component modification plan for Building and World
- `.planning/research/PITFALLS.md` -- comprehensive pitfall catalog with prevention strategies
- `.planning/research/FEATURES.md` -- feature dependency analysis and prioritization

### Tertiary (LOW confidence)

- None -- all findings verified against codebase and official PixiJS documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; all APIs already used in codebase and verified
- Architecture: HIGH - Building label mutation is a straightforward property storage + setter pattern; project-to-building mapping is a simple Map with 4 slots; all patterns already exist in the codebase (Map tracking, tick-based updates)
- Pitfalls: HIGH - BitmapFont character gaps verified by reading current chars array; BitmapText visibility bug documented in PixiJS GitHub issues; routing conflict identified from direct codebase analysis of ACTIVITY_BUILDING usage

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (stable -- no moving parts, all APIs are established PixiJS 8 features)
