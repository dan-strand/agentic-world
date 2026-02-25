# Architecture Research

**Domain:** Local desktop 2D animated visualizer with real-time process monitoring
**Researched:** 2026-02-25
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
+------------------------------------------------------------------+
|                     Electron Main Process                         |
|                                                                   |
|  +------------------+    +------------------+                     |
|  | Session Detector |    | Session Store    |                     |
|  | (polling loop)   |--->| (canonical state)|                     |
|  +------------------+    +--------+---------+                     |
|         |                         |                               |
|    reads from:               IPC push                             |
|    - process list            (webContents.send)                   |
|    - ~/.claude/ files             |                               |
|                                   v                               |
+-----------------------------------+------------------------------+
                                    |
                         IPC Channel: 'sessions-update'
                                    |
+-----------------------------------+------------------------------+
|                    Electron Renderer Process                      |
|                                                                   |
|  +------------------+    +------------------+                     |
|  | Session Bridge   |    | World State      |                     |
|  | (receives IPC)   |--->| Manager          |                     |
|  +------------------+    +--------+---------+                     |
|                                   |                               |
|                          maps sessions to                         |
|                          agent entities                           |
|                                   |                               |
|                                   v                               |
|  +------------------+    +------------------+    +---------------+|
|  | Animation System |--->| Scene Graph      |--->| PixiJS        ||
|  | (state machines) |    | (world + agents) |    | Renderer      ||
|  +------------------+    +------------------+    +---------------+|
|                                                                   |
|  +------------------+                                             |
|  | Game Loop        |  requestAnimationFrame - drives all above   |
|  | (fixed timestep) |                                             |
|  +------------------+                                             |
+------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Session Detector** | Poll OS process list and Claude filesystem artifacts to discover/track sessions | Node.js `child_process.execFile` calling `wmic`/`tasklist` on Windows; `fs.watch` + periodic `fs.readdir` on `~/.claude/projects/` |
| **Session Store** | Maintain canonical list of sessions with status, metadata, timestamps | Plain TypeScript class with EventEmitter; array of `SessionInfo` objects |
| **IPC Bridge** | Push session state changes from main to renderer process | `webContents.send('sessions-update', data)` from main; `ipcRenderer.on` in preload script |
| **World State Manager** | Map session data to agent entities; decide agent positions, assignments, transitions | Pure logic layer -- no rendering. Owns the "which agent is where doing what" state |
| **Animation System** | Drive sprite frame selection, walk cycles, idle animations, celebration sequences | Per-agent finite state machine (FSM): `idle -> walking -> working -> celebrating -> walking-home` |
| **Scene Graph** | Own the visual tree: background tilemap, buildings, agent sprites, speech bubbles, labels | PixiJS `Container` hierarchy. Static background + dynamic agent layer + UI overlay layer |
| **Game Loop** | Fixed-timestep update with variable-rate rendering | `requestAnimationFrame` with accumulator pattern; update at 10-15 Hz logic, render at display refresh rate |
| **PixiJS Renderer** | Hardware-accelerated 2D rendering to canvas | PixiJS `Application` with WebGL backend, automatic fallback to Canvas2D |

## Recommended Project Structure

```
src/
+-- main/                    # Electron main process
|   +-- index.ts             # App entry, window creation, lifecycle
|   +-- session-detector.ts  # Discovers Claude Code sessions
|   +-- session-store.ts     # Canonical session state + change events
|   +-- ipc-handlers.ts      # IPC channel registration
|   +-- process-utils.ts     # Windows process list utilities
|
+-- preload/                 # Electron preload script
|   +-- index.ts             # contextBridge exposing IPC to renderer
|
+-- renderer/                # Electron renderer process (the game)
|   +-- index.ts             # Entry: init PixiJS app, start game loop
|   +-- game-loop.ts         # Fixed-timestep loop controller
|   +-- world/               # World/scene management
|   |   +-- world-manager.ts # Maps sessions to agents, owns world state
|   |   +-- scene.ts         # PixiJS scene graph setup (layers, camera)
|   |   +-- buildings.ts     # HQ, mission locations, decorations
|   |   +-- background.ts    # Tilemap or static background
|   |
|   +-- agents/              # Agent entity system
|   |   +-- agent.ts         # Single agent entity: state + sprite
|   |   +-- agent-fsm.ts     # Finite state machine for agent behavior
|   |   +-- agent-renderer.ts # Sprite selection, animation frames
|   |   +-- speech-bubble.ts # Floating text/label display
|   |
|   +-- animation/           # Animation utilities
|   |   +-- sprite-sheet.ts  # Sprite sheet loading + frame definitions
|   |   +-- animator.ts      # Frame-based animation player
|   |   +-- transitions.ts   # Easing functions, lerp utilities
|   |
|   +-- types/               # Shared type definitions
|       +-- session.ts       # SessionInfo, SessionStatus types
|       +-- agent.ts         # AgentState, AgentAction types
|       +-- world.ts         # WorldConfig, Position types
|
+-- assets/                  # Static assets
|   +-- sprites/             # Pixel art sprite sheets (PNG + JSON atlas)
|   +-- tiles/               # Background tiles
|   +-- fonts/               # Pixel fonts (if any)
|
+-- shared/                  # Types/utils shared between main + renderer
    +-- constants.ts         # Polling intervals, animation speeds, layout
    +-- session-types.ts     # Session data types (used across IPC boundary)
```

### Structure Rationale

- **main/ vs renderer/:** Enforced by Electron's process model. Main has Node.js access (filesystem, processes). Renderer has PixiJS and the game loop. They communicate only through IPC.
- **agents/:** Self-contained entity system. Each agent bundles its own state machine, sprite, and behavior. This is the core unit of the visualizer.
- **world/:** Scene-level concerns. Maps the abstract "sessions" data into spatial positions and manages the shared visual environment.
- **animation/:** Reusable animation utilities separate from agent-specific logic. Sprite sheet loading, frame timing, and math functions used by any animated element.
- **shared/:** Type definitions that cross the IPC boundary. Both main and renderer need to agree on `SessionInfo` shape.

## Architectural Patterns

### Pattern 1: Main-Process Polling with Push to Renderer

**What:** The main process polls for session changes on a timer (every 2-5 seconds), diffs against stored state, and pushes only changes to the renderer via IPC.

**When to use:** Always -- this is the core data pipeline.

**Trade-offs:** Polling adds slight latency (2-5s) but is far simpler than filesystem watchers (which are unreliable on Windows for JSONL files being actively written). The renderer never reaches back to ask for data; it receives pushes and reacts.

**Example:**
```typescript
// main/session-detector.ts
class SessionDetector {
  private store: SessionStore;
  private pollInterval: NodeJS.Timeout | null = null;

  start(intervalMs: number = 3000) {
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
  }

  private async poll() {
    const processes = await this.getClaudeProcesses();
    const sessionFiles = await this.scanSessionDirectory();
    const sessions = this.reconcile(processes, sessionFiles);
    this.store.update(sessions); // triggers IPC push if changed
  }

  private async getClaudeProcesses(): Promise<ProcessInfo[]> {
    // Windows: wmic process where "name='claude.exe'" get ProcessId,CommandLine
    // Parse output into structured data
  }

  private async scanSessionDirectory(): Promise<SessionFileInfo[]> {
    // Read ~/.claude/projects/*/  for recent .jsonl files
    // Check file modification times to detect activity
  }
}
```

### Pattern 2: Fixed-Timestep Game Loop with Interpolation

**What:** Logic updates run at a fixed rate (e.g., 10 Hz for this app -- agents don't need 60 Hz physics). Rendering runs at display refresh rate with interpolation for smooth movement.

**When to use:** Always -- this is the animation driver.

**Trade-offs:** A 10 Hz logic tick is generous for a monitoring dashboard. Agent position updates are infrequent. The interpolation step makes movement appear smooth despite low-frequency updates. This keeps CPU usage very low for an always-on app.

**Example:**
```typescript
// renderer/game-loop.ts
const LOGIC_RATE = 1 / 10; // 10 Hz logic updates
let accumulator = 0;
let lastTime = 0;

function gameLoop(currentTime: number) {
  const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.25); // clamp
  lastTime = currentTime;
  accumulator += deltaTime;

  while (accumulator >= LOGIC_RATE) {
    updateWorld(LOGIC_RATE);  // move agents, check transitions
    accumulator -= LOGIC_RATE;
  }

  const alpha = accumulator / LOGIC_RATE;
  renderWorld(alpha);         // interpolated positions for smooth display

  requestAnimationFrame(gameLoop);
}
```

### Pattern 3: Agent Finite State Machine (FSM)

**What:** Each agent has a state machine governing its visual behavior. States: `arriving`, `walking-to-mission`, `working`, `waiting-for-input`, `celebrating`, `walking-to-hq`, `idle-at-hq`. Transitions triggered by session status changes.

**When to use:** For every agent entity. The FSM determines which animation plays, where the agent moves, and what label/bubble to show.

**Trade-offs:** Simple and debuggable. For 2-8 agents, a full ECS (Entity Component System) is overkill. FSMs per agent give clear, readable behavior without framework overhead.

**Example:**
```typescript
// renderer/agents/agent-fsm.ts
type AgentState =
  | 'idle-at-hq'
  | 'walking-to-mission'
  | 'working'
  | 'waiting-for-input'
  | 'error'
  | 'celebrating'
  | 'walking-to-hq';

interface AgentFSM {
  currentState: AgentState;
  transition(event: SessionEvent): void;
}

// Transition table:
// 'idle-at-hq'         + session_started    -> 'walking-to-mission'
// 'walking-to-mission' + arrived_at_dest    -> 'working'
// 'working'            + needs_input        -> 'waiting-for-input'
// 'waiting-for-input'  + input_received     -> 'working'
// 'working'            + task_completed     -> 'celebrating'
// 'celebrating'        + celebration_done   -> 'walking-to-hq'
// 'walking-to-hq'      + arrived_at_hq     -> 'idle-at-hq'
// any                  + session_ended      -> 'walking-to-hq'
// any                  + session_error      -> 'error'
```

### Pattern 4: Layered Scene Graph

**What:** The PixiJS scene is organized into explicit z-ordered layers: background (tilemap), buildings, agents (sorted by y-position for depth), and UI overlay (labels, bubbles).

**When to use:** Always. This prevents z-fighting and makes it easy to add/remove agents without disturbing static elements.

**Trade-offs:** Slightly more setup than dumping everything into one container, but dramatically simpler to maintain and debug.

```typescript
// renderer/world/scene.ts
class GameScene {
  readonly backgroundLayer: PIXI.Container;  // z: 0 - tiles, ground
  readonly buildingLayer: PIXI.Container;     // z: 1 - HQ, mission buildings
  readonly agentLayer: PIXI.Container;        // z: 2 - agents (y-sorted)
  readonly uiLayer: PIXI.Container;           // z: 3 - labels, bubbles

  constructor(stage: PIXI.Container) {
    this.backgroundLayer = new PIXI.Container();
    this.buildingLayer = new PIXI.Container();
    this.agentLayer = new PIXI.Container();
    this.uiLayer = new PIXI.Container();

    stage.addChild(
      this.backgroundLayer,
      this.buildingLayer,
      this.agentLayer,
      this.uiLayer
    );
  }
}
```

## Data Flow

### Primary Data Flow: Session Discovery to Visual Display

```
[OS Process List]                [Claude ~/.claude/ filesystem]
       |                                    |
       v                                    v
+------------------+              +--------------------+
| Process Scanner  |              | Session File       |
| (wmic/tasklist)  |              | Scanner (readdir)  |
+--------+---------+              +---------+----------+
         |                                  |
         +---------------+  +--------------+
                          |  |
                          v  v
                 +------------------+
                 | Session Detector |
                 | (reconcile)     |
                 +--------+--------+
                          |
                    diff against
                    previous state
                          |
                          v
                 +------------------+
                 | Session Store    |  <-- canonical state lives here
                 | (main process)  |
                 +--------+--------+
                          |
                   IPC push on change
                   'sessions-update'
                          |
                          v
                 +------------------+
                 | World State Mgr  |
                 | (renderer)       |
                 +--------+--------+
                          |
                 map sessions to agents:
                 - new session? spawn agent
                 - status changed? trigger FSM transition
                 - session gone? agent walks to HQ, despawn
                          |
                          v
                 +------------------+
                 | Agent Entities   |
                 | (FSM + Sprite)   |
                 +--------+--------+
                          |
                  game loop tick:
                  - FSM updates behavior
                  - position interpolation
                  - animation frame selection
                          |
                          v
                 +------------------+
                 | PixiJS Renderer  |
                 | (Canvas/WebGL)   |
                 +------------------+
                          |
                          v
                    [Screen Output]
```

### Session Detection Strategy (Multi-Signal)

The detector uses multiple signals to build a complete picture:

1. **Process list** (`wmic process where "name='claude.exe'"`) -- tells us which sessions are actively running right now. The command line includes flags and the process ID.
2. **Session JSONL files** (`~/.claude/projects/<encoded-path>/<session-uuid>.jsonl`) -- file modification time indicates activity. A file being written to means the session is active.
3. **History file** (`~/.claude/history.jsonl`) -- contains display text, timestamp, and project path for all sessions. Useful for extracting the "what is this session doing" label.
4. **Session subdirectories** (`<session-uuid>/subagents/`, `<session-uuid>/tool-results/`) -- presence of active subagent directories indicates spawned sub-tasks.

**Reconciliation logic:** Cross-reference process list (what's running) with recent file modifications (what's active) to produce a list of `SessionInfo` objects with status, project name, activity description, and duration.

### Key Data Types

```typescript
// shared/session-types.ts

interface SessionInfo {
  id: string;           // session UUID
  projectPath: string;  // e.g., "C:\Users\dlaws\Projects\Agent World"
  projectName: string;  // extracted: "Agent World"
  status: SessionStatus;
  lastActivity: string; // human-readable description from history/JSONL
  startTime: number;    // timestamp
  lastUpdateTime: number;
  pid?: number;         // OS process ID if currently running
}

type SessionStatus =
  | 'active'           // process running, JSONL recently modified
  | 'waiting'          // process running, but awaiting user input
  | 'idle'             // process running, no recent JSONL writes
  | 'completed'        // process not running, session ended normally
  | 'error';           // process died unexpectedly

interface SessionsUpdate {
  sessions: SessionInfo[];
  added: string[];     // session IDs that are new
  removed: string[];   // session IDs that disappeared
  changed: string[];   // session IDs with status changes
}
```

## Scaling Considerations

This app is not a web service; "scaling" means handling more simultaneous Claude Code sessions and maintaining smooth performance.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 2-4 sessions | Default design. Simple array of agents. No optimization needed. |
| 5-10 sessions | Add agent pooling (reuse sprite objects). Increase world size or use scrolling/zooming. Space out buildings more. |
| 10-20 sessions | Virtualize off-screen agents (skip rendering for agents not visible). Reduce polling frequency to 5s. Consider paging the world into zones. |
| 20+ sessions | Likely never needed, but: switch from individual sprites to instanced rendering. Aggregate similar-status agents visually. |

### Performance Budget (Always-On App)

| Metric | Target | Rationale |
|--------|--------|-----------|
| CPU idle | < 2% | Must not drain battery or compete with Claude Code |
| Memory | < 100 MB | Electron baseline is ~80 MB; keep overhead under 20 MB |
| Logic tick rate | 10 Hz | Agents move slowly; no need for 60 Hz updates |
| Render rate | 30-60 FPS | Match display refresh, but PixiJS handles this automatically |
| Poll interval | 3 seconds | Good balance between responsiveness and system impact |

### Scaling Priorities

1. **First bottleneck: Polling cost.** `wmic` calls on Windows are relatively expensive (~50-100ms each). Cache results aggressively. If the process list hasn't changed, skip filesystem scanning.
2. **Second bottleneck: Sprite count.** PixiJS handles hundreds of sprites easily. This won't be a real concern until 50+ agents, which is far beyond scope.

## Anti-Patterns

### Anti-Pattern 1: Renderer Polls Main Process

**What people do:** Use `ipcRenderer.invoke` on a timer in the renderer to ask the main process for session data.

**Why it's wrong:** Inverts the data flow. The main process knows when data changes; the renderer does not. Polling from the renderer adds unnecessary IPC round-trips and makes the renderer responsible for timing that belongs in the main process.

**Do this instead:** Main process pushes via `webContents.send()` whenever the session store changes. Renderer simply reacts.

### Anti-Pattern 2: Full ECS Framework for 4-8 Entities

**What people do:** Import a full Entity-Component-System framework (like bitECS, ECSY) for managing a handful of agents.

**Why it's wrong:** ECS shines at scale (thousands of entities with shared component pools). For 4-8 agents with distinct identities, it adds complexity without benefit. Each agent already has a clear 1:1 mapping to a session.

**Do this instead:** Simple Agent class with embedded FSM. Direct object references. No component lookups needed.

### Anti-Pattern 3: Synchronous IPC

**What people do:** Use `ipcRenderer.sendSync()` to get session data, blocking the renderer's UI thread.

**Why it's wrong:** Blocks the entire rendering pipeline. If the main process is mid-poll (calling wmic), the renderer freezes until the response comes back.

**Do this instead:** All IPC is asynchronous. Push from main, listen in renderer. If renderer needs to request data, use `ipcRenderer.invoke()` (async, returns a Promise).

### Anti-Pattern 4: Reading Session Files from Renderer

**What people do:** Expose `fs` access to the renderer via a loose preload script and read `~/.claude/` files directly from the rendering process.

**Why it's wrong:** Security violation (renderer should not have filesystem access). Also mixes concerns -- the renderer's job is visualization, not data collection.

**Do this instead:** All filesystem access stays in the main process. Data crosses the boundary only as serialized `SessionInfo` objects via IPC.

### Anti-Pattern 5: Re-creating Sprites Every Frame

**What people do:** Destroy and recreate PixiJS sprite objects when agent state changes.

**Why it's wrong:** Creates garbage collection pressure and texture re-binding. Sprites are lightweight display objects that can be reused by changing their texture, position, and visibility.

**Do this instead:** Create agent sprites once. Update their texture reference when animation frame changes. Toggle visibility when agents appear/disappear.

## Integration Points

### External Systems

| System | Integration Pattern | Notes |
|--------|---------------------|-------|
| **Windows Process List** | `child_process.execFile('wmic', ...)` from main process on a 3s timer | Parse CSV output. Filter for `claude.exe`. Extract PID and command line args. |
| **Claude Code Filesystem** | `fs.readdir` + `fs.stat` on `~/.claude/projects/` and `~/.claude/history.jsonl` | Read-only. Never write to Claude's directory. Use file modification time as activity signal. |
| **PixiJS Rendering Engine** | Imported in renderer process. Creates `PIXI.Application` attached to a canvas in the Electron window | Use WebGL mode for best performance. Set `backgroundAlpha: 1` for opaque background (no compositing overhead). |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Main Process <-> Renderer Process | Electron IPC via `contextBridge` preload | Strict API surface: `onSessionsUpdate(callback)`, `getInitialSessions()`. No raw IPC access exposed. |
| World State Manager <-> Agent Entities | Direct method calls (same process) | WorldManager owns Agent instances. Calls `agent.onSessionUpdate(info)` which triggers FSM transitions. |
| Agent FSM <-> Agent Renderer | Direct property reads (same object) | FSM sets `currentState` and `targetPosition`. Renderer reads these to select animation and interpolate position. |
| Game Loop <-> All Systems | Callback invocation | Game loop calls `world.update(dt)` then `world.render(alpha)`. World delegates to agents. Clean top-down call hierarchy. |

### Session Detection Signal Correlation

```
Signal 1: Process alive?     YES ──────────────┐
                              |                 |
Signal 2: JSONL recently     YES ──> 'active'   |
          modified? (<10s)    NO ──> 'idle'     |
                                                |
Signal 1: Process alive?      NO ───────────────┤
                                                |
Signal 3: JSONL has recent   YES ──> 'completed'|
          completion record?  NO ──> 'error'    |
                                                |
Signal 4: Last JSONL message  Contains user     |
          type?               prompt? ──> 'waiting'
```

## Build Order (Dependency Chain)

The following order reflects true technical dependencies -- each phase requires the previous to be functional:

1. **Electron Shell + Window** -- Everything runs inside this. Must exist first.
2. **PixiJS Renderer + Static Scene** -- Prove we can render pixel art in the Electron window. Background + buildings with no animation.
3. **Game Loop** -- Add the fixed-timestep loop driving the renderer. Prove smooth animation with a test sprite.
4. **Agent Entity + FSM + Animation** -- Build one agent that can walk, work, celebrate with sprite animations driven by the FSM.
5. **Session Detector (Main Process)** -- Build the polling system that reads process list and Claude files. Output `SessionInfo[]`.
6. **IPC Bridge** -- Connect detector output to renderer. Push session updates across the process boundary.
7. **World State Manager** -- Map live session data to agent entities. Spawn/despawn agents based on sessions appearing/disappearing.
8. **Polish** -- Speech bubbles, labels, status indicators, celebration effects, multiple building locations.

**Why this order:**
- Steps 1-4 can be developed with mock data (no real session detection needed).
- Step 5 is independent of rendering and can be tested in isolation.
- Step 6-7 integrate the two halves.
- Step 8 is visual polish that doesn't affect architecture.

## Sources

- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) -- Official docs on main/renderer separation (HIGH confidence)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) -- Official IPC patterns (HIGH confidence)
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance) -- Official performance recommendations (HIGH confidence)
- [PixiJS Spritesheets Guide](https://pixijs.io/guides/basics/sprite-sheets.html) -- Official sprite sheet docs (HIGH confidence)
- [Fix Your Timestep!](https://www.gafferongames.com/post/fix_your_timestep/) -- Canonical game loop reference by Glenn Fiedler (HIGH confidence)
- [Performant Game Loops in JavaScript](https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/) -- Fixed timestep pattern in JS (MEDIUM confidence)
- [PixiJS vs Canvas comparison](https://aircada.com/blog/pixijs-vs-canvas) -- WebGL acceleration benefits (MEDIUM confidence)
- [Claude Code Session Management](https://stevekinney.com/courses/ai-development/claude-code-session-management) -- Session file structure info (MEDIUM confidence)
- [Claude Code Session File Format](https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b) -- JSONL format details (MEDIUM confidence)
- [node-processlist npm](https://www.npmjs.com/package/node-processlist) -- Windows process detection (LOW confidence -- verify still maintained)
- Local filesystem verification of `~/.claude/` directory structure -- confirmed on this machine (HIGH confidence)

---
*Architecture research for: Agent World - local desktop 2D animated visualizer*
*Researched: 2026-02-25*
