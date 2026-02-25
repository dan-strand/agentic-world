# Project Research Summary

**Project:** Agent World
**Domain:** Animated 2D pixel-art desktop process visualizer (Windows, always-on)
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

Agent World is an always-on desktop companion app that transforms abstract Claude Code session data into a living, spatial world of animated spy agents. The product sits at the intersection of three established domains -- system process monitors, desktop pet apps, and gamified productivity tools -- but no existing product combines all three. The recommended approach is a thin Electron shell housing a PixiJS WebGL renderer, driven by a main-process polling loop that reads Claude Code session state from the filesystem and pushes it to the renderer via IPC. This is a well-understood architecture for desktop data visualization apps with one unique complication: the data source (Claude Code session files) has no public API and can break silently on any Claude Code update.

The core technical bet is Electron over Tauri. Tauri has documented GPU/canvas hardware acceleration failures on Windows WebView2 (GitHub issues #4891, #5037) that are fatal for an always-on animated app. Electron's bundled Chromium guarantees WebGL acceleration. PixiJS is the clear rendering choice: purpose-built for 2D sprites, handles 1000+ elements at 60fps via WebGL batching, and has native spritesheet animation support. The entire rendering stack (Electron + PixiJS + TypeScript) is high-confidence with stable, current versions available.

The biggest risk is not technical complexity but resource discipline. An Electron app running continuous canvas animation can idle at 10-15% CPU and 150-300MB RAM, which will cause users to close it permanently. The architecture must build adaptive frame rate and dirty-flag rendering from day one -- it cannot be retrofitted. The second risk is session detection fragility: Claude Code's internal file format is not a public API. The detection layer must be abstracted behind an interface from the start so it can be swapped when the format changes. If these two concerns are addressed in the foundation phase, the remaining work is well-understood game development and UI polish.

## Key Findings

### Recommended Stack

The stack is decisive. Electron ^40.0.0 (bundled with Chromium 144 and Node.js 24.13.1) is the only viable desktop shell for this project given Windows WebGL requirements. PixiJS ^8.16.0 handles 2D rendering with hardware acceleration, native AnimatedSprite support, and pixel-art-friendly nearest-neighbor scaling via `SCALE_MODES.NEAREST`. Session detection uses two complementary mechanisms: chokidar ^4.0.3 watches `~/.claude/projects/` for new/modified JSONL files, and systeminformation ^5.31.1 enumerates `claude.exe` processes with PIDs and command-line args. No frontend framework (React/Vue) is needed or wanted -- this is a view-only canvas app, and DOM frameworks add overhead for zero benefit. Build tooling is Electron Forge ^7.11.1 with the TypeScript-Webpack template.

**Core technologies:**
- **Electron ^40.0.0**: Desktop shell — only option with guaranteed WebGL acceleration on Windows (Tauri's WebView2 has known canvas GPU bugs)
- **PixiJS ^8.16.0**: 2D WebGL renderer — industry standard for sprite animation, handles 1000+ sprites at 60fps, native spritesheet support
- **TypeScript ^5.7**: Type safety — essential for multiple system boundaries (process monitoring, IPC, rendering)
- **chokidar ^4.0.3**: File watching — normalizes Windows `fs.watch` quirks; use v4 (not v5, which is ESM-only and complicates Electron main process)
- **systeminformation ^5.31.1**: Process enumeration — lists `claude.exe` processes with PIDs; Windows support is labeled "partial" but works in practice
- **electron-store ^10.0.0**: Persistent config — user preferences (window position, animation speed) with schema validation
- **Electron Forge ^7.11.1**: Build tooling — officially recommended, handles Electron's dual-process webpack configuration correctly

### Expected Features

No existing product combines session monitoring with animated character visualization. The feature set is validated by analogy: system monitors (detection/status), desktop pets (animation/always-on), and gamified productivity tools (theming/celebration). The spy/secret agent theme is the core identity differentiator.

**Must have (table stakes):**
- Auto-detect running Claude Code sessions — hands-free, no user registration required
- Display each session as a distinct animated agent — 1:1 session-to-agent mapping
- Show session status (active/waiting/idle/error) — the primary glanceable information
- Show project name above each agent — essential for distinguishing multiple sessions
- Always-on-top opaque window — desktop companion behavior; skip transparency to avoid Windows bugs
- Smooth sprite animation (idle, walking, working) — 8-12 frames at 10-20 FPS, nearest-neighbor scaling
- Lightweight resource usage — target under 100MB RAM and under 2% CPU at idle

**Should have (differentiators):**
- Spy/secret agent theming — custom pixel art; what makes this "Agent World" vs "Session Monitor v2"
- Location-based activity mapping — agents work at different locations (Lab, Server Room, Library) based on current tool usage
- Needs-attention visual alarm — flashing/bouncing agent when waiting on permission prompt; this is the "killer utility" feature
- Celebration animation on completion — visual closure when a session finishes
- Walk-back-to-HQ on completion — spatial meaning to session lifecycle
- Speech bubbles with current activity — "Writing src/index.ts", "Running tests..." (activity type, never actual content)
- Session duration display — elapsed time badge per agent
- Multiple distinguishable agent sprites — different spy characters so agents are visually distinguishable

**Defer (v2+):**
- Day/night ambient cycle — cosmetic, no functional value
- Scaling for 6+ agents (scrollable/zoomable world)
- Custom themes beyond spy
- System tray icon integration
- Tooltip with session details (token count, files changed)

**Hard anti-features (never build):**
- Click-to-interact/terminal switching — window management APIs differ per terminal emulator; massive scope increase
- Audio/sound effects — annoying in always-on apps; users close apps that make noise
- Token/cost tracking overlay — duplicates existing tools; distracts from visual status purpose
- Session control (start/stop/restart) — transforms visualizer into session manager; different product

### Architecture Approach

The architecture follows Electron's enforced process boundary: the main process owns all system access (process detection, file watching, Claude session parsing) and the renderer process owns all visualization (PixiJS, game loop, agent entities). These communicate via IPC push -- the main process polls on a 3-second timer, diffs state, and pushes `SessionsUpdate` objects to the renderer via `webContents.send()`. The renderer never requests data; it reacts to pushes. This separation is not optional -- it prevents the renderer from having filesystem access (security boundary) and keeps animations smooth even during detection polling.

**Major components:**
1. **Session Detector (main process)** — polls `wmic`/`tasklist` + `~/.claude/projects/` JSONL file modification times; reconciles into `SessionInfo[]`; housed behind an abstraction interface for future format changes
2. **Session Store (main process)** — canonical state of all sessions; fires IPC push on any change; diffs to send only `added`, `removed`, `changed` session IDs
3. **IPC Bridge (preload)** — strict contextBridge API: `onSessionsUpdate(callback)` and `getInitialSessions()`; no raw filesystem access exposed to renderer
4. **World State Manager (renderer)** — maps sessions to agent entities; spawns agents on new sessions, triggers FSM transitions on status changes, despawns on session end
5. **Agent FSM + Sprite (renderer)** — per-agent finite state machine driving animation state selection and position interpolation; states: `idle-at-hq`, `walking-to-mission`, `working`, `waiting-for-input`, `celebrating`, `walking-to-hq`
6. **PixiJS Scene Graph (renderer)** — four explicit z-ordered layers: background, buildings, agents (y-sorted for depth), UI overlay (labels, bubbles)
7. **Game Loop (renderer)** — fixed-timestep at 10 Hz logic with display-rate rendering and position interpolation; adaptive: drops to 2-5 FPS when all agents are idle

**Build order (enforced by dependencies):**
1. Electron shell + window (everything requires this)
2. PixiJS renderer + static scene (prove pixel art renders in Electron)
3. Game loop (fixed-timestep, adaptive frame rate -- must be built correctly from day one)
4. Agent entity + FSM + animation (mock data, no real sessions yet)
5. Session detector in main process (independent, testable in isolation)
6. IPC bridge (connect the two halves)
7. World state manager (map live sessions to agents)
8. Polish (speech bubbles, locations, celebration, multiple building sites)

### Critical Pitfalls

1. **Idle CPU/Memory burn destroys always-on viability** — A naive 60fps canvas loop consumes 5-15% CPU even when nothing changes. Build adaptive frame rate and dirty-flag rendering into the game loop from day one. When all agents are idle, drop to 2-5 FPS or pause entirely. Retrofitting this is a near-rewrite. Recovery cost: HIGH.

2. **Session detection fragility** — Claude Code's JSONL format and `~/.claude/projects/` directory structure are internal, undocumented, and can change without notice. The feature request for session lock files (#19364) is stale. Abstract the detection layer behind a `SessionDetector` interface immediately. Use file modification time as the primary signal (most stable heuristic). Layer process detection + file watching + JSONL tail-reading for cross-validation. Recovery cost: MEDIUM if abstracted; HIGH if scattered.

3. **Blurry pixel art from anti-aliasing** — Canvas uses bilinear interpolation by default; high-DPI Windows scaling compounds this. Set `imageSmoothingEnabled = false`, apply CSS `image-rendering: pixelated`, use `Math.floor()` for all sprite positions, and use only integer scale factors. This must be set up correctly in a shared utility from the first draw call. Recovery cost: LOW once identified.

4. **Spawning `wmic`/`tasklist` blocks or stalls** — Windows process creation is 100-200x slower than macOS/Linux (documented Node.js issue #21632). `wmic` initializes a WMI connection on each invocation. Use `tasklist` (faster), always async, cache results aggressively, poll at 5-10 second intervals. Detection poll must complete in under 100ms. Recovery cost: MEDIUM.

5. **Transparent window bugs on Windows** — Combining `transparent: true`, `alwaysOnTop: true`, and `frame: false` triggers documented Electron bugs on Windows (#9357, #23042). Skip transparency entirely for v1. Use an opaque, frameless window with a themed dark background. The view-only nature means click-through is not needed. Recovery cost: LOW to remove transparency, but time-consuming to debug if already integrated.

## Implications for Roadmap

The ARCHITECTURE.md build order and PITFALLS.md phase warnings strongly align on a 4-phase structure. Phases 1 and 2 do the heavy lifting; Phases 3 and 4 are polish and expansion.

### Phase 1: Foundation and Core Detection

**Rationale:** Session detection is the highest-risk component and the root of the entire feature dependency tree. Nothing can be built without it. Simultaneously, the Electron window and game loop must establish resource-safe patterns before any visual work begins -- the idle CPU pitfall is near-impossible to retrofit.

**Delivers:** A working Electron app that detects active Claude Code sessions, displays agent placeholders (even as colored rectangles), and runs a resource-efficient game loop under 2% CPU idle.

**Addresses (from FEATURES.md):** Auto-detect sessions, always-on window, lightweight resource usage, clean startup/shutdown.

**Avoids (from PITFALLS.md):** Idle CPU burn (adaptive game loop built here), session detection fragility (abstraction layer built here), file watcher exhaustion (polling strategy decided here), transparent window bugs (opaque window decision made here), process spawn blocking (async detection with caching built here).

**Research flag:** NEEDS RESEARCH -- Claude Code session file format details and Windows process detection reliability need validation against the actual filesystem before committing to an implementation.

### Phase 2: Visual Core and Sprite Rendering

**Rationale:** With session data flowing reliably, the next dependency is a working visual system: PixiJS scene graph, sprite animation, agent FSM, and HQ world. This is where pixel art must be set up correctly -- blurry sprites are caught and fixed here, not in Phase 3. Mock data can drive this phase before full IPC integration.

**Delivers:** Animated agents moving across a spy HQ background, with correct pixel art rendering at all Windows DPI settings, driven by agent FSMs responding to session status changes.

**Addresses (from FEATURES.md):** Display each session as a distinct animated agent, smooth sprite animation (idle/walking/working), basic 2D world with HQ and mission locations, project name labels.

**Avoids (from PITFALLS.md):** Blurry pixel art (canvas setup utility built here), sprite re-creation each frame (pooling strategy built here), agent flicker on poll boundaries (debounce logic built here).

**Uses (from STACK.md):** PixiJS ^8.16.0 with `SCALE_MODES.NEAREST`, spritesheet atlas JSON+PNG, Electron Forge webpack for asset bundling.

**Research flag:** STANDARD PATTERNS -- PixiJS sprite animation and game loop patterns are well-documented in official sources; no additional research needed.

### Phase 3: Session Status and Differentiating Polish

**Rationale:** With the foundation and visual core working, this phase layers in all the features that distinguish Agent World from "just another session monitor." Status is the core utility; spy theming and activity mapping create the identity.

**Delivers:** Full status display (active/waiting/idle/error with visual states), needs-attention alarm for waiting agents, speech bubbles showing current activity type, location-based activity mapping (agents at Lab/Server Room/Library based on tool usage), celebration animation, walk-back-to-HQ on completion, session duration badges.

**Addresses (from FEATURES.md):** Status display, needs-attention alarm, speech bubbles, location mapping, celebration animation, walk-back animation, session duration, spy theming.

**Avoids (from PITFALLS.md):** Exposing session content in speech bubbles (show activity type, never raw JSONL content), stale agent cleanup (timeout logic added here).

**Research flag:** STANDARD PATTERNS -- Hook event parsing and FSM transition patterns are well-established; Claude Code hooks documentation is official and stable.

### Phase 4: Hardening and Long-Running Stability

**Rationale:** Always-on apps have failure modes that only appear after hours of continuous use: memory leaks from uncleaned event listeners, detection breaking after Claude Code updates, edge cases with 4+ simultaneous sessions. This phase validates long-running stability and adds missing robustness before any wider use.

**Delivers:** Clean 8-hour soak test passing (stable memory, CPU under 1%), correct behavior with 4+ simultaneous sessions across different projects, graceful degradation when detection fails, verified behavior after sleep/wake and monitor disconnect/reconnect, correct path encoding for unusual project directory names.

**Addresses (from PITFALLS.md):** Memory leaks from timers/listeners, multiple session edge cases, sub-agent detection, path encoding for special characters, cleanup on exit.

**Avoids:** All items on PITFALLS.md "Looks Done But Isn't" checklist.

**Research flag:** STANDARD PATTERNS -- Memory profiling and Electron lifecycle patterns are well-documented.

### Phase Ordering Rationale

- Detection before rendering: The feature dependency tree roots in session detection. Nothing else makes sense without it.
- Resource safety before visual richness: The idle CPU pitfall has the highest recovery cost. It must be designed correctly in the game loop before adding rendering complexity.
- Mock data enables parallel development: Phases 1 and 2 can share development time because the game loop and agent FSM can run on hardcoded mock sessions before real IPC is connected.
- Polish after validation: Phase 3 features (theming, speech bubbles, celebration) are cosmetic enhancements to a working core. They should not block the core from being usable.
- Hardening last: Long-running stability issues only become visible after the core works. Soak testing requires a functioning app to soak.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** Claude Code session file format and Windows process detection need verification against the live filesystem before implementation decisions are locked in. The JSONL field schema, sub-agent directory structure, and `wmic`/`tasklist` output format on the target machine should be inspected and documented before writing parser code.

Phases with standard patterns (skip research-phase):
- **Phase 2:** PixiJS sprite animation and fixed-timestep game loops are thoroughly documented in official sources and canonical references (Fix Your Timestep!, PixiJS guides).
- **Phase 3:** Claude Code hooks documentation is official and stable. FSM patterns and IPC event handling are well-understood.
- **Phase 4:** Memory profiling with Chrome DevTools, Electron lifecycle events, and long-running app stability patterns are well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Electron and PixiJS are verified current versions. Tauri exclusion is backed by multiple GitHub issues. chokidar and systeminformation are verified. The only medium-confidence item is systeminformation Windows "partial" support for process listing, which requires local verification. |
| Features | MEDIUM-HIGH | Table stakes and anti-features are well-reasoned from adjacent product domains. Differentiators are validated by competitor analysis. Feature dependency tree is sound. Primary uncertainty: whether Claude Code hooks provide reliable enough events (vs. file-polling fallback) to drive agent state transitions. |
| Architecture | HIGH | Electron main/renderer separation is mandated by the platform. IPC patterns, game loop structure, FSM per agent, and layered scene graph are all canonical patterns with official documentation. Build order is logically sound. |
| Pitfalls | HIGH | Most pitfalls are backed by official Electron GitHub issues, MDN documentation, and Node.js issues with issue numbers. Session detection fragility is verified via direct filesystem inspection and the open/stale GitHub feature request #19364. |

**Overall confidence:** HIGH

### Gaps to Address

- **Claude Code hooks vs. filesystem-polling reliability for status transitions:** FEATURES.md recommends hooks as primary detection; ARCHITECTURE.md recommends filesystem polling as primary. These need reconciliation. During Phase 1 planning, decide: do hooks write to a shared JSON file, do we poll JSONL files directly, or both? The STACK.md notes suggest a layered approach but the implementation details need a decision.

- **systeminformation Windows process listing accuracy:** STACK.md rates this MEDIUM confidence. Before committing to it as a required dependency, run a local test: does `systeminformation.processes()` reliably return `claude.exe` with the working directory? If not, fall back to `tasklist` / `wmic` parsed directly via `child_process.exec`.

- **Pixel art asset source:** Research notes Aseprite ($20) or Piskel (free) for sprite creation and TexturePacker for spritesheet packing. Neither is a code dependency -- but the asset pipeline needs a decision before Phase 2. Who creates the sprites, at what resolution (16x16 vs 32x32), and in how many animation states? This is a design/art decision that blocks Phase 2.

- **Electron transparent window final decision:** PITFALLS.md strongly recommends skipping transparency for v1. The always-on-top opaque window is a deliberate downgrade from the "ideal" desktop pet aesthetic. This should be explicitly accepted in requirements so it doesn't become a scope argument later.

## Sources

### Primary (HIGH confidence)

- [Electron releases page](https://releases.electronjs.org/) — Electron 40.6.1, Node.js 24 bundled
- [PixiJS blog: v8.16.0](https://pixijs.com/blog/8.16.0) — latest version, canvas fallback renderer
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) — main/renderer separation
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) — push vs. pull IPC patterns
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance) — CPU/memory optimization
- [Tauri GitHub issue #4891](https://github.com/tauri-apps/tauri/issues/4891) — canvas hardware acceleration failure on WebView2
- [Tauri GitHub issue #5037](https://github.com/tauri-apps/tauri/issues/5037) — GPU canvas acceleration bug
- [Electron GitHub Issue #9357](https://github.com/electron/electron/issues/9357) — alwaysOnTop + transparent bugs
- [Electron GitHub Issue #23042](https://github.com/electron/electron/issues/23042) — click-through transparent regression
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — hook events (SessionStart/Stop/Notification)
- [Claude Code Issue #19364](https://github.com/anthropics/claude-code/issues/19364) — session lock file request, stale/no response
- [Node.js Issue #21632](https://github.com/nodejs/node/issues/21632) — child_process slower on Windows
- [MDN: Crisp Pixel Art](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look) — image-rendering: pixelated
- [Fix Your Timestep!](https://www.gafferongames.com/post/fix_your_timestep/) — canonical fixed-timestep game loop
- [Electron Forge: Why Electron Forge](https://www.electronforge.io/core-concepts/why-electron-forge) — official recommendation
- Direct filesystem inspection of `~/.claude/projects/` and `~/.claude/history.jsonl` — session file structure verified on target machine

### Secondary (MEDIUM confidence)

- [systeminformation npm](https://www.npmjs.com/package/systeminformation) — v5.31.1, Windows "partial" process support
- [Building a Real-Time Dashboard for Claude Code Sessions](https://www.ksred.com/managing-multiple-claude-code-sessions-building-a-real-time-dashboard/) — session detection implementation patterns
- [PixiJS performance tips](https://pixijs.com/7.x/guides/production/performance-tips) — sprite rendering guidance
- [WindowPet GitHub](https://github.com/SeakMengs/WindowPet) — desktop pet implementation reference
- [On-Together Steam Page](https://store.steampowered.com/app/3707400/OnTogether_Virtual_CoWorking/) — adjacent product, focus timer + character animations
- [Claude Code Session File Format](https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b) — JSONL format details
- [DoltHub: Electron vs Tauri](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — comparison context

### Tertiary (LOW confidence, needs validation)

- [~/.claude directory structure Gist](https://gist.github.com/samkeen/dc6a9771a78d1ecee7eb9ec1307f1b52) — community gist, verify against actual filesystem
- [Claude Code Session Management](https://stevekinney.com/courses/ai-development/claude-code-session-management) — session file structure info, community source

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
