# Phase 2: Visual World - Research

**Researched:** 2026-02-25
**Domain:** PixiJS 8 programmatic pixel art, animation state machines, dynamic world layout, activity detection from JSONL
**Confidence:** HIGH

## Summary

Phase 2 transforms the placeholder agent silhouettes from Phase 1 into a living 2D pixel art spy world. The primary technical domains are: (1) programmatic 48x48 pixel art character drawing using PixiJS 8 Graphics primitives with GraphicsContext frame-swapping for animation, (2) dynamic compound layout algorithm that positions project-specific mission compounds radially around a central HQ, (3) movement and animation state machines for agent walking/driving/working transitions, and (4) activity type detection by parsing tool_use entries from JSONL progress data.

The key architectural insight is that PixiJS 8's GraphicsContext sharing pattern is ideal for this use case. Each animation frame (idle-1, idle-2, walking-1, walking-2, working-1, working-2, etc.) can be pre-built as a GraphicsContext at startup, then swapped onto a Graphics object each frame -- zero geometry rebuilding per tick. This is far more performant than clearing and redrawing Graphics objects each frame. For static world elements (compounds, fences, signposts, roads), draw once and cache via the same pattern.

Activity detection requires enhancing the JSONL reader to extract the most recent `tool_use` name from `progress` entries, then mapping tool names to activity categories: Read/Grep/Glob -> reading (bookshelf), Write/Edit -> coding (workbench), Bash -> testing/running (server rack), WebSearch/WebFetch -> research (antenna/comms). This requires reading slightly more JSONL data (scan backward for the nearest progress entry with tool_use content), but the existing 4KB tail buffer should suffice since progress entries are the most frequent type during active sessions.

**Primary recommendation:** Pre-build all GraphicsContext frames at init time, organize the world as HQ Container + N compound Containers with sub-location children, use simple linear interpolation for movement, and extend SessionInfo with an `activityType` field derived from the last tool_use in JSONL progress entries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 48x48 pixel sprite resolution
- Drawn programmatically with PixiJS Graphics primitives (no external sprite sheets)
- Each agent distinguished by BOTH color-coded outfit AND unique accessories
- 8-color palette for agent differentiation (supports up to 8 unique agents)
- Beyond 8 agents: recycle colors with number badges
- Accessories vary per agent slot (e.g., sunglasses, briefcase, hat, scarf, goggles, earpiece, badge, tie)
- **Locations ARE projects** -- each detected project gets its own mission compound on the map
- HQ is the central hub; project compounds radiate outward from center
- Compounds spawn dynamically when a project is detected, despawn when no sessions remain for that project
- Each compound is a small fenced mission compound with a signpost showing the project name
- Sub-locations inside each compound for activity types (workbench for coding, antenna/comms for API calls, bookshelf for reading, server rack for tests)
- Agents at HQ are idle/completed -- waiting for their next mission
- Agents travel between HQ and project compounds via vehicles (driving animation along roads/paths)
- Mix of vehicle types as another agent distinguishing trait: car, motorcycle, van, helicopter (assigned per agent slot)
- Agents walk between sub-locations within their project compound when activity type changes
- Active working animations at each sub-location (typing at workbench, adjusting antenna, flipping pages, monitoring server) -- 3-4 frame loops
- Vehicle parks at compound entrance while agent works inside
- Project name displayed on a signpost/marquee at each compound entrance
- Pixel bitmap font for signpost text (matches art style)
- Speech bubbles use minimal icons instead of text (wrench for editing, magnifying glass for reading, gear for running, etc.)
- Bubbles flash on activity change (appear for 3-5 seconds then fade) -- not persistent
- No label above individual agents (compound signpost handles project identification)

### Claude's Discretion
- Exact compound layout algorithm (how to arrange compounds around central HQ as count changes)
- Sub-location positioning within compounds
- Vehicle animation frame count and speed
- Specific icon designs for activity types
- Road/path visual style between HQ and compounds
- How compound spawn/despawn animates (fade in? build animation?)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORLD-01 | App renders a 2D pixel art world with an HQ building and distinct mission locations | PixiJS 8 Graphics API for programmatic drawing. HQ as central Container with sub-location Graphics children. Dynamic compound layout using radial positioning algorithm. Signposts via BitmapFont.install() with nearest-neighbor scaleMode. |
| WORLD-02 | Each detected session appears as a unique animated pixel art spy agent character | 48x48 Graphics-drawn agents with 8-color palette + accessories. GraphicsContext pre-built frames for each color/accessory combination. Agent slot system maps sessionId to consistent visual identity. |
| WORLD-03 | Agents animate through states: idle stance, walking between locations, working at a location | State machine pattern: IDLE -> DRIVING -> WALKING -> WORKING -> (repeat). GraphicsContext frame-swapping for animation. Linear interpolation for movement between positions. 3-4 frame loops per animation state. |
| WORLD-04 | Each agent displays its project name as a label | Project name on compound signpost using BitmapFont.install() with pixel-art style font. No per-agent labels (compounds own the project identity). |
| WORLD-05 | Agents show speech bubbles indicating current activity type | Icon-based speech bubbles (wrench, magnifying glass, gear) drawn as small Graphics objects. Flash on activity change with alpha tween (3-5 sec then fade). Activity type derived from JSONL tool_use entries. |
| WORLD-06 | Agents work at different locations based on activity type | Tool-to-activity mapping: Read/Grep/Glob -> bookshelf, Write/Edit -> workbench, Bash -> server rack, WebSearch/WebFetch -> antenna. SessionInfo extended with activityType field. Agents walk to corresponding sub-location within compound. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | ^8.16.0 | 2D WebGL rendering, Graphics primitives, GraphicsContext, BitmapText | Already installed from Phase 1. Graphics API supports all programmatic drawing needs. GraphicsContext sharing is the key optimization for frame-based animation. |
| electron | 40.6.1 | Desktop shell | Already installed. No changes needed for Phase 2. |
| typescript | ~5.7 | Type safety | Already installed. Strict mode continues. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | Phase 2 requires no new dependencies. All rendering is via PixiJS Graphics primitives already installed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GraphicsContext frame-swapping | AnimatedSprite with spritesheet textures | AnimatedSprite requires pre-rendered texture atlases. Programmatic Graphics with context swapping is the user's locked decision and avoids asset pipeline complexity. |
| Manual lerp movement | GSAP PixiPlugin or pixi-actions | Third-party tween libraries add bundle size for simple A->B movement. Manual lerp in the ticker callback is 5 lines of code and fully sufficient. |
| BitmapFont.install() | Regular Text objects | BitmapText renders from a pre-generated texture atlas, making text changes cheap. Regular Text re-rasterizes on every change. BitmapFont.install() generates the atlas programmatically -- no external .fnt files needed. |

**Installation:**
```bash
# No new packages needed -- pixi.js ^8.16.0 already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/renderer/
├── index.ts                  # Entry point (exists, minor updates)
├── world.ts                  # World class (major rewrite from Phase 1 placeholder)
├── game-loop.ts              # Adaptive ticker (exists, no changes needed)
├── hq.ts                     # HQ building: central hub Container + sub-graphics
├── compound.ts               # Project compound: fence, signpost, sub-locations, parked vehicles
├── compound-layout.ts        # Radial layout algorithm for compound positioning
├── agent.ts                  # Spy agent: Container with state machine, animation, movement
├── agent-factory.ts          # Maps agent slot -> color + accessory + vehicle type
├── agent-sprites.ts          # Pre-built GraphicsContext frames for all agent variants
├── vehicle.ts                # Vehicle Container with driving animation
├── speech-bubble.ts          # Icon-based activity bubble with fade animation
├── activity-icons.ts         # GraphicsContext for each activity icon (wrench, gear, etc.)
├── bitmap-font.ts            # BitmapFont.install() setup for pixel art signpost text
├── placeholder-agent.ts      # (REMOVE -- replaced by agent.ts)
├── agent-layout.ts           # (REMOVE -- replaced by compound-layout.ts)
src/shared/
├── types.ts                  # Extended with ActivityType, AgentSlot, CompoundInfo
├── constants.ts              # Extended with animation speeds, compound sizes, colors
src/main/
├── jsonl-reader.ts           # Enhanced to extract last tool_use name
├── session-detector.ts       # Extended to populate activityType from tool_use
├── session-store.ts          # No changes (already pushes SessionInfo updates)
```

### Pattern 1: GraphicsContext Pre-Built Animation Frames
**What:** Pre-build all animation frame variants at application init, then swap contexts on Graphics objects each tick instead of clearing and redrawing.
**When to use:** All agent animations (idle, walking, working), all vehicle animations.
**Example:**
```typescript
// Source: PixiJS 8 GraphicsContext docs (pixijs.com/8.x/guides/components/scene-objects/graphics)
import { Graphics, GraphicsContext } from 'pixi.js';

// Build frames once at init
function buildIdleFrames(color: number): GraphicsContext[] {
  const frames: GraphicsContext[] = [];
  for (let i = 0; i < 4; i++) {
    const ctx = new GraphicsContext();
    // 48x48 pixel art agent -- offset slightly per frame for bobbing
    const yOff = Math.sin((i / 4) * Math.PI * 2) * 2;
    // Head
    ctx.circle(24, 12 + yOff, 6).fill(0xffd9b3); // skin
    // Hat (accessory varies per slot)
    ctx.rect(18, 4 + yOff, 12, 4).fill(color);
    // Body/trenchcoat
    ctx.rect(16, 18 + yOff, 16, 20).fill(color);
    // Legs
    ctx.rect(18, 38 + yOff, 4, 8).fill(0x333344);
    ctx.rect(26, 38 + yOff, 4, 8).fill(0x333344);
    frames.push(ctx);
  }
  return frames;
}

// In agent tick:
class Agent {
  private body: Graphics;
  private idleFrames: GraphicsContext[];
  private frameIndex = 0;
  private frameTimer = 0;

  tick(deltaMs: number): void {
    this.frameTimer += deltaMs;
    if (this.frameTimer > 200) { // 200ms per frame = 5fps animation
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % this.idleFrames.length;
      this.body.context = this.idleFrames[this.frameIndex]; // Swap -- no redraw!
    }
  }
}
```

### Pattern 2: Agent State Machine
**What:** Finite state machine governing agent behavior: IDLE_AT_HQ, DRIVING_TO_COMPOUND, WALKING_TO_SUBLOCATION, WORKING, WALKING_TO_ENTRANCE, DRIVING_TO_HQ.
**When to use:** Every agent tick -- the state determines which animation plays and whether the agent moves.
**Example:**
```typescript
type AgentState =
  | 'idle_at_hq'
  | 'driving_to_compound'
  | 'walking_to_sublocation'
  | 'working'
  | 'walking_to_entrance'
  | 'driving_to_hq';

class Agent {
  private state: AgentState = 'idle_at_hq';
  private targetX = 0;
  private targetY = 0;
  private moveSpeed = 100; // pixels per second (walking)
  private driveSpeed = 250; // pixels per second (driving)

  tick(deltaMs: number): void {
    switch (this.state) {
      case 'driving_to_compound':
      case 'driving_to_hq':
        this.moveToward(this.targetX, this.targetY, this.driveSpeed, deltaMs);
        if (this.hasArrived()) this.onArrival();
        break;
      case 'walking_to_sublocation':
      case 'walking_to_entrance':
        this.moveToward(this.targetX, this.targetY, this.moveSpeed, deltaMs);
        if (this.hasArrived()) this.onArrival();
        break;
      case 'working':
        this.playWorkAnimation(deltaMs);
        break;
      case 'idle_at_hq':
        this.playIdleAnimation(deltaMs);
        break;
    }
  }

  private moveToward(tx: number, ty: number, speed: number, dt: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = speed * (dt / 1000);
    if (dist <= step) {
      this.x = tx;
      this.y = ty;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  private hasArrived(): boolean {
    return this.x === this.targetX && this.y === this.targetY;
  }
}
```

### Pattern 3: Radial Compound Layout
**What:** Position project compounds in a circle around the central HQ. Each compound gets an angular slot. When compounds are added/removed, recalculate all positions with smooth transitions.
**When to use:** Whenever the set of active projects changes.
**Example:**
```typescript
interface CompoundPosition {
  x: number;
  y: number;
  angle: number; // radians from center
}

function calculateCompoundPositions(
  count: number,
  centerX: number,
  centerY: number,
  radius: number
): CompoundPosition[] {
  const positions: CompoundPosition[] = [];
  // Start from top (-PI/2) and distribute evenly
  const startAngle = -Math.PI / 2;
  const angleStep = (Math.PI * 2) / Math.max(count, 1);

  for (let i = 0; i < count; i++) {
    const angle = startAngle + i * angleStep;
    positions.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      angle,
    });
  }
  return positions;
}

// For many compounds (>6), use two concentric rings:
function calculateMultiRingPositions(
  count: number,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number
): CompoundPosition[] {
  if (count <= 6) {
    return calculateCompoundPositions(count, centerX, centerY, innerRadius);
  }
  // Inner ring: first 6, outer ring: remainder
  const inner = calculateCompoundPositions(6, centerX, centerY, innerRadius);
  const outer = calculateCompoundPositions(count - 6, centerX, centerY, outerRadius);
  return [...inner, ...outer];
}
```

### Pattern 4: Activity Type from JSONL Tool Use
**What:** Extract the most recent tool_use name from JSONL progress entries and map it to an activity category.
**When to use:** During session detection poll cycle -- populate activityType field.
**Example:**
```typescript
type ActivityType = 'coding' | 'reading' | 'testing' | 'comms' | 'idle';

// Map Claude Code tool names to activity categories
const TOOL_TO_ACTIVITY: Record<string, ActivityType> = {
  // Reading/searching
  Read: 'reading',
  Grep: 'reading',
  Glob: 'reading',
  // Coding/editing
  Write: 'coding',
  Edit: 'coding',
  // Running/testing
  Bash: 'testing',
  Task: 'testing',
  TaskCreate: 'testing',
  TaskUpdate: 'testing',
  TaskOutput: 'testing',
  TaskStop: 'testing',
  // Research/communication
  WebSearch: 'comms',
  WebFetch: 'comms',
  AskUserQuestion: 'comms',
  // Notebook
  NotebookEdit: 'coding',
};

function toolNameToActivity(toolName: string): ActivityType {
  return TOOL_TO_ACTIVITY[toolName] ?? 'coding'; // default to coding
}
```

### Pattern 5: BitmapFont for Pixel Art Signposts
**What:** Install a bitmap font programmatically at init time for crisp pixel-art text on compound signposts.
**When to use:** World initialization, before any BitmapText objects are created.
**Example:**
```typescript
// Source: PixiJS 8 BitmapFont docs (pixijs.download/release/docs/text.BitmapFont.html)
import { BitmapFont, BitmapText } from 'pixi.js';

function installPixelFont(): void {
  BitmapFont.install({
    name: 'PixelSignpost',
    style: {
      fontFamily: 'monospace',
      fontSize: 16,
      fill: '#ffffff',
    },
    chars: [
      ['a', 'z'],
      ['A', 'Z'],
      ['0', '9'],
      [' ', ' '],
      ['-', '-'],
      ['.', '.'],
    ],
    textureStyle: {
      scaleMode: 'nearest', // crisp pixels, no interpolation
    },
  });
}

// Usage on signpost:
const signpostText = new BitmapText({
  text: 'Agent World',
  style: {
    fontFamily: 'PixelSignpost',
    fontSize: 16,
  },
});
signpostText.anchor.set(0.5, 0.5);
```

### Pattern 6: Speech Bubble with Fade
**What:** Icon-only speech bubble that appears on activity change and fades after 3-5 seconds.
**When to use:** When an agent's activity type changes.
**Example:**
```typescript
import { Container, Graphics, GraphicsContext } from 'pixi.js';

class SpeechBubble extends Container {
  private fadeTimer = 0;
  private fadeDuration = 4000; // 4 seconds visible
  private fadeOutDuration = 1000; // 1 second fade
  private isActive = false;

  show(iconContext: GraphicsContext): void {
    // Swap icon
    this.icon.context = iconContext;
    this.alpha = 1;
    this.visible = true;
    this.fadeTimer = 0;
    this.isActive = true;
  }

  tick(deltaMs: number): void {
    if (!this.isActive) return;
    this.fadeTimer += deltaMs;
    if (this.fadeTimer > this.fadeDuration) {
      // Fade out
      const fadeProgress = (this.fadeTimer - this.fadeDuration) / this.fadeOutDuration;
      this.alpha = Math.max(0, 1 - fadeProgress);
      if (this.alpha <= 0) {
        this.visible = false;
        this.isActive = false;
      }
    }
  }
}
```

### Anti-Patterns to Avoid
- **Clearing and redrawing Graphics every frame:** Rebuilds GPU geometry every tick. Use pre-built GraphicsContext swapping instead. Graphics.clear() should only be called for one-time redraws (like window resize).
- **Creating new Graphics objects for animation frames:** Allocates containers and GPU resources. Reuse a single Graphics object and swap its .context property.
- **Drawing all 48x48 pixels individually:** Graphics.rect() for individual pixels is extremely slow. Use larger shape primitives (rect for body, circle for head) to approximate pixel art at the 48x48 resolution.
- **Using Text instead of BitmapText for signposts:** Text re-rasterizes on every text change. BitmapText draws from a cached glyph atlas. With dynamic compounds spawning/despawning, BitmapText is essential.
- **Polling for layout changes on every tick:** Only recalculate compound positions when the set of active projects changes. Cache positions and only update on project count/set changes.
- **Hard-coding compound positions:** The number of projects is dynamic (0-8+). Positions must be calculated algorithmically, not hard-coded.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frame-based animation | Custom texture atlas loader | GraphicsContext[] with .context swapping | User locked decision: programmatic Graphics, not sprite sheets. Context swapping is PixiJS 8's built-in optimization for this. |
| Pixel art font rendering | Canvas 2D text with nearest-neighbor | BitmapFont.install() + BitmapText | BitmapFont generates the glyph atlas programmatically. Handles kerning, alignment, and batch rendering. |
| Position interpolation | Full tween library (GSAP, pixi-actions) | Simple `moveToward()` with deltaMs | Movement is always point-to-point at constant speed. A full tween library is overkill for linear interpolation. |
| Agent color/accessory assignment | Random assignment per session | Deterministic slot system based on sessionId hash | Agents must look the same across app restarts. Hash sessionId to a stable slot index. |
| Activity icon sprites | External PNG icon assets | Small GraphicsContext drawings (wrench, gear, magnifying glass) | Keeps the all-programmatic constraint. Icons are 12-16px and can be drawn with a few Graphics primitives each. |

**Key insight:** The biggest "don't hand-roll" for this phase is the animation system. PixiJS 8's GraphicsContext is purpose-built for swapping pre-computed geometry onto Graphics objects. Rolling a custom frame-caching system would duplicate what GraphicsContext already provides.

## Common Pitfalls

### Pitfall 1: Graphics.clear() in Animation Loop
**What goes wrong:** Calling `graphics.clear()` followed by drawing commands every tick causes GPU geometry to be rebuilt from scratch each frame.
**Why it happens:** Natural instinct from Canvas 2D programming where you clear and redraw each frame.
**How to avoid:** Pre-build all animation frames as GraphicsContext objects at init time. In the tick, only assign `graphics.context = frames[currentFrame]`. This is a pointer swap, not a geometry rebuild.
**Warning signs:** Frame rate drops with more than 3-4 agents on screen. GPU usage spikes during animation.

### Pitfall 2: Compound Layout Overlapping at High Count
**What goes wrong:** With 5+ project compounds, radial layout places compounds too close together, causing visual overlap.
**Why it happens:** Fixed radius with increasing angular density.
**How to avoid:** Use adaptive radius that grows with compound count. For 1-6 compounds, use a single ring. For 7+, use two concentric rings (inner ring of 6, outer ring for remainder). Calculate minimum spacing based on compound width (~120px) and ensure angular separation provides adequate clearance.
**Warning signs:** Compound signpost text overlapping, fence graphics intersecting, agents walking through adjacent compounds.

### Pitfall 3: Agent Identity Instability
**What goes wrong:** An agent changes color/accessory/vehicle between app sessions because the slot assignment is random.
**Why it happens:** Using `Math.random()` or array index (which changes when sessions appear/disappear) for color assignment.
**How to avoid:** Hash the sessionId string to a stable integer and use modulo 8 for the color slot. This ensures the same session always gets the same visual identity. Use a simple string hash (djb2 or similar) -- no crypto needed.
**Warning signs:** Agents "flickering" identity when new sessions appear. User unable to visually track a specific agent across polls.

### Pitfall 4: Vehicle Driving Through Buildings
**What goes wrong:** Agents drive in a straight line from HQ to compound, passing through other compounds along the way.
**Why it happens:** Simple point-to-point linear interpolation without pathfinding.
**How to avoid:** Use a simple 2-segment path: HQ entrance -> road junction near center -> compound entrance. The "road" is a radial spoke from center to each compound. Agents follow the road, not a direct line. This naturally avoids crossing through other compounds.
**Warning signs:** Vehicles visually overlapping with buildings/compounds during transit.

### Pitfall 5: JSONL Tail Buffer Missing Tool Use Data
**What goes wrong:** The 4KB tail buffer only contains `progress` entries with `normalizedMessages: []`, giving no tool_use data.
**Why it happens:** Progress entries vary in size. During rapid tool use, many small progress entries may stack up at the file tail, and the one containing tool_use content may be outside the buffer.
**How to avoid:** Increase tail buffer to 8KB for the activity detection read (or scan backward through the buffer for the first progress entry that contains a tool_use in its data.message.message.content array). The existing 4KB buffer is fine for basic status detection but may need expansion for reliable activity type extraction.
**Warning signs:** activityType always returning the default fallback, agents never moving to different sub-locations.

### Pitfall 6: Too Many GraphicsContext Objects
**What goes wrong:** Creating unique pre-built frames for every combination of color * accessory * animation state * frame count exhausts memory.
**Why it happens:** 8 colors * 8 accessories * 4 states * 4 frames = 1024 GraphicsContext objects.
**How to avoid:** Use a composited approach: draw the base body (color-dependent) as one Graphics layer and the accessory as a separate child Graphics with its own context. This reduces to (8 colors * 4 states * 4 frames) + (8 accessories * 4 states * 4 frames) = 128 + 128 = 256 contexts. Much more manageable.
**Warning signs:** Long init time, high memory usage at startup.

## Code Examples

### Agent Slot Assignment (Stable Identity)
```typescript
// Source: Standard djb2 hash algorithm
function hashSessionId(sessionId: string): number {
  let hash = 5381;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) + hash + sessionId.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

const AGENT_COLORS = [
  0x00d4aa, // teal
  0xf0a030, // amber
  0x6088ff, // blue
  0xff6060, // coral
  0xaa66ff, // purple
  0x44cc44, // green
  0xff88cc, // pink
  0xcccc44, // yellow
] as const;

type VehicleType = 'car' | 'motorcycle' | 'van' | 'helicopter';
const VEHICLE_TYPES: VehicleType[] = ['car', 'motorcycle', 'van', 'helicopter', 'car', 'motorcycle', 'van', 'helicopter'];

type AccessoryType = 'sunglasses' | 'briefcase' | 'hat' | 'scarf' | 'goggles' | 'earpiece' | 'badge' | 'tie';
const ACCESSORIES: AccessoryType[] = ['sunglasses', 'briefcase', 'hat', 'scarf', 'goggles', 'earpiece', 'badge', 'tie'];

interface AgentSlot {
  colorIndex: number;
  color: number;
  accessory: AccessoryType;
  vehicleType: VehicleType;
}

function getAgentSlot(sessionId: string): AgentSlot {
  const hash = hashSessionId(sessionId);
  const index = hash % 8;
  return {
    colorIndex: index,
    color: AGENT_COLORS[index],
    accessory: ACCESSORIES[index],
    vehicleType: VEHICLE_TYPES[index],
  };
}
```

### Extended SessionInfo for Activity
```typescript
// Source: Existing shared/types.ts + Phase 2 extension
export type ActivityType = 'coding' | 'reading' | 'testing' | 'comms' | 'idle';

export interface SessionInfo {
  sessionId: string;
  projectPath: string;
  projectName: string;
  status: SessionStatus;
  lastModified: number;
  lastEntryType: string;
  activityType: ActivityType;  // NEW: derived from last tool_use
}
```

### Enhanced JSONL Reader for Tool Detection
```typescript
// Source: Existing jsonl-reader.ts + activity type extraction
export function readLastToolUse(
  filePath: string,
  bufferSize: number = 8192
): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);
    if (stat.size === 0) return null;

    const readSize = Math.min(bufferSize, stat.size);
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);

    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    // Scan backward for a progress entry with tool_use content
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        if (obj.type !== 'progress') continue;
        const content = obj.data?.message?.message?.content;
        if (!Array.isArray(content)) continue;
        for (const c of content) {
          if (c.type === 'tool_use' && c.name) {
            return c.name; // e.g., 'Read', 'Edit', 'Bash'
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}
```

### Compound Drawing
```typescript
// Source: PixiJS 8 Graphics API
import { Container, Graphics, BitmapText } from 'pixi.js';

class Compound extends Container {
  private fence: Graphics;
  private signpost: BitmapText;
  private subLocations: Map<ActivityType, { x: number; y: number }>;

  constructor(projectName: string) {
    super();
    const W = 160; // compound width
    const H = 120; // compound height

    // Fence
    this.fence = new Graphics();
    this.fence.rect(0, 0, W, H).stroke({ color: 0x888888, width: 2 });
    this.fence.rect(2, 2, W - 4, H - 4).fill(0x2a3a2a); // ground
    this.addChild(this.fence);

    // Gate opening at top-center
    this.fence.rect(W / 2 - 12, 0, 24, 4).fill(0x2a3a2a);

    // Signpost
    this.signpost = new BitmapText({
      text: projectName,
      style: { fontFamily: 'PixelSignpost', fontSize: 12 },
    });
    this.signpost.anchor.set(0.5, 1);
    this.signpost.position.set(W / 2, -4);
    this.addChild(this.signpost);

    // Sub-locations (relative to compound origin)
    this.subLocations = new Map([
      ['coding',  { x: 30,  y: 40 }],   // workbench - left
      ['reading', { x: 130, y: 40 }],   // bookshelf - right
      ['testing', { x: 30,  y: 90 }],   // server rack - bottom-left
      ['comms',   { x: 130, y: 90 }],   // antenna - bottom-right
    ]);

    // Draw sub-location furniture/equipment as small Graphics
    this.drawSubLocations();
  }

  getSubLocationPosition(activity: ActivityType): { x: number; y: number } {
    return this.subLocations.get(activity) ?? { x: 80, y: 60 }; // center fallback
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AnimatedSprite with spritesheet | GraphicsContext swapping for programmatic art | PixiJS 8.0.0 (2024) | Can animate programmatic Graphics without texture atlases. GraphicsContext does the GPU geometry once. |
| graphics.clear() + redraw per frame | Pre-built GraphicsContext[] + .context assignment | PixiJS 8.0.0 (2024) | Massive performance improvement for animated Graphics objects. |
| PIXI.BitmapFont.from() | BitmapFont.install() | PixiJS 8.0.0 (2024) | API renamed. install() generates glyph atlas programmatically with textureStyle options. |
| PIXI.Text for dynamic text | BitmapText for frequently changing/multiple text | PixiJS 8.0.0+ | BitmapText shares glyph textures, no re-rasterization. Text is fine for static, single-instance text. |
| graphics.lineStyle() before drawing | graphics.rect().stroke({ color, width }) | PixiJS 8.0.0 (2024) | v8 chain pattern: build shape first, then apply fill/stroke. Old lineStyle/beginFill removed. |

**Deprecated/outdated:**
- `graphics.beginFill()` / `graphics.endFill()`: Replaced by `.fill()` after shape in v8
- `graphics.lineStyle()`: Replaced by `.stroke({...})` after shape in v8
- `PIXI.BitmapFont.from()`: Renamed to `BitmapFont.install()` in v8
- `cacheAsBitmap`: Replaced by `cacheAsTexture` in PixiJS 8 (though not needed here -- GraphicsContext sharing is the better pattern for animated objects)

## Open Questions

1. **Exact compound dimensions and spacing**
   - What we know: Compounds need to fit sub-locations for 4 activity types plus a gate and signpost. At 48x48 agent size, a compound needs at least 160x120px.
   - What's unclear: Optimal dimensions that look good on the default 1200x800 window with 1-8 compounds.
   - Recommendation: Start with 160x120px compounds, 300px radius inner ring. Adjust during visual testing. This is Claude's discretion per CONTEXT.md.

2. **Road/path rendering between HQ and compounds**
   - What we know: Agents drive along roads. Roads connect HQ to each compound.
   - What's unclear: Whether roads should be straight radial spokes or curved paths.
   - Recommendation: Straight radial spokes from HQ center to each compound entrance. Simplest to implement and provides clear visual lanes. Draw as a 10px wide path strip (like Phase 1's existing path drawing). This is Claude's discretion per CONTEXT.md.

3. **Compound spawn/despawn animation**
   - What we know: Compounds appear when a project is detected and disappear when no sessions remain.
   - What's unclear: Whether to animate the transition or snap.
   - Recommendation: Simple alpha fade-in over 500ms when spawning, fade-out when despawning. No complex build animations. This keeps the implementation simple and is Claude's discretion per CONTEXT.md.

4. **Handling window resize with dynamic compounds**
   - What we know: Phase 1 redraws the background and repositions agents on resize. Phase 2 has a more complex scene.
   - What's unclear: Whether to redraw everything or use PixiJS Container scaling.
   - Recommendation: Recalculate compound positions (radial layout) on resize, keeping compound/agent sizes fixed. The world is a Container that gets repositioned, not scaled. This avoids blurry scaling of pixel art.

## Sources

### Primary (HIGH confidence)
- [PixiJS 8 Graphics API](https://pixijs.com/8.x/guides/components/scene-objects/graphics) - GraphicsContext sharing, drawing methods, performance recommendations
- [PixiJS 8 GraphicsContext API](https://pixijs.download/dev/docs/scene.GraphicsContext.html) - clone(), drawing methods, context assignment pattern
- [PixiJS 8 Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) - Graphics batching, sprite vs graphics performance
- [PixiJS 8 BitmapText](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap) - BitmapFont.install(), BitmapText usage, performance benefits
- [PixiJS 8 BitmapFont API](https://pixijs.download/release/docs/text.BitmapFont.html) - install() options, textureStyle, chars ranges
- [PixiJS 8 Render Loop](https://pixijs.com/8.x/guides/concepts/render-loop) - Ticker deltaTime, frame-rate-independent animation
- [PixiJS 8 Pixel Line](https://pixijs.com/8.x/guides/components/scene-objects/graphics/graphics-pixel-line) - pixelLine for crisp 1px rendering
- Live JSONL investigation on target machine (2026-02-25) - Entry types (user, assistant, system, progress, queue-operation, file-history-snapshot), tool names (Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch, AskUserQuestion, Task, TaskCreate, TaskUpdate, TaskOutput, TaskStop), progress entry structure with data.message.message.content[].tool_use

### Secondary (MEDIUM confidence)
- [PixiJS pixijs/pixijs Discussion #10521](https://github.com/pixijs/pixijs/discussions/10521) - Rendering many Graphics objects, RenderTexture optimization
- [PixiJS Performance Deep Dive (Medium)](https://medium.com/@turkmergin/maximising-performance-a-deep-dive-into-pixijs-optimization-6689688ead93) - Sprites 3-4x faster than Graphics, cacheAsTexture patterns
- [pixi-actions library](https://github.com/reececomo/pixijs-actions) - Lightweight animation composer for PixiJS (not needed, but validates that manual lerp is simpler)

### Tertiary (LOW confidence)
- None -- all critical findings verified against PixiJS 8 official docs and live filesystem data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- PixiJS 8 already installed and working from Phase 1. No new dependencies needed. All APIs verified against official docs.
- Architecture: HIGH -- GraphicsContext sharing pattern confirmed in official docs. State machine and radial layout are well-understood algorithms. JSONL structure verified on live data.
- Pitfalls: HIGH -- Graphics.clear() performance trap verified in official performance docs. Compound layout edge cases identified through mathematical analysis. JSONL buffer size verified against actual file content.
- Activity detection: HIGH -- Tool names verified against actual JSONL files on target machine. Progress entry structure confirmed with real data showing tool_use in data.message.message.content array.

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- PixiJS 8 API is settled, JSONL format could change with Claude Code updates)
