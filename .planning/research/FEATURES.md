# Feature Research

**Domain:** Animated 2D desktop process visualizer for Claude Code sessions
**Researched:** 2026-02-25
**Confidence:** MEDIUM-HIGH

## Context

Agent World is a local desktop app that visualizes active Claude Code sessions as animated pixel-art spy agents in a 2D world. The feature landscape draws from three adjacent domains: (1) system/process monitoring dashboards, (2) desktop pet/companion apps (Shimeji, WindowPet, DPET), and (3) gamified productivity tools (Habitica, Focumon, On-Together). No existing product combines all three in the way Agent World does, which means the "table stakes" below are derived from what users expect within each domain, not from direct competitors.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Auto-detect running Claude Code sessions** | Core purpose -- if you can't see sessions, the app is useless. Users expect hands-free detection with no manual registration. | HIGH | Two viable approaches: (1) Claude Code hooks (SessionStart/Stop/Notification) writing state to a shared JSON file, or (2) polling `~/.claude/projects/` directory for active JSONL session files. Hooks approach is more reliable and event-driven. |
| **Display each session as a distinct animated agent** | The entire value proposition. Each running session must map 1:1 to a visible agent character on screen. | MEDIUM | Requires sprite rendering engine, agent entity management, and session-to-agent mapping. |
| **Show session status (active / waiting / idle / error)** | Monitoring dashboards always show status. This is the primary information the user needs at a glance. Without it, the visualizer is decoration, not a tool. | MEDIUM | Claude Code hooks provide `Notification` events for `permission_prompt` (waiting for input) and `idle_prompt` (idle). `Stop` event signals completion. Active state can be inferred from process presence + no notification. |
| **Show project name / working directory** | Users need to know WHICH session is which. With 2-4+ sessions, unlabeled agents are useless. | LOW | Available from hook `cwd` field or session JSONL file metadata. Display as label above agent or in tooltip. |
| **Always-on-top transparent desktop window** | Desktop companion apps (Shimeji, WindowPet, On-Together) all run as always-on-top overlays. Users expect the app to sit on their desktop without needing to alt-tab to find it. | MEDIUM | Both Electron and Tauri support `alwaysOnTop: true`, `transparent: true`, `decorations: false`. Click-through on transparent areas is well-supported in Electron, still evolving in Tauri (open issue #13070). |
| **Smooth sprite animation (idle, walking, working)** | Desktop pets set the expectation: characters must move fluidly. Static icons would feel like a system tray notification, not a "world." | MEDIUM | Standard sprite sheet animation with frame cycling. Minimum states: idle (breathing), walking, working. 8-12 frames per animation at 10-20 FPS is the standard for pixel art. |
| **Lightweight / low resource usage** | Always-on apps that eat CPU/RAM get closed. Users will not tolerate a status visualizer that slows their machine while Claude Code is doing actual work. | MEDIUM | Canvas/WebGL rendering (not DOM animation). Polling intervals of 2-5 seconds, not continuous. Minimize process overhead. Target < 100MB RAM, < 2% CPU. |
| **Clean startup and shutdown** | App must start reliably, handle zero sessions gracefully (show empty HQ), and close without leaving orphan processes. | LOW | Standard desktop app lifecycle management. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Spy/secret agent theming** | What makes this "Agent World" instead of "Session Monitor v2." The trenchcoats, briefcases, sunglasses, and spy HQ create personality and delight. This is the reason someone uses THIS instead of claude-code-monitor's terminal TUI. | MEDIUM | Requires custom pixel art assets: agent sprites (4+ animation states x 4 directions), HQ building, mission locations, background tilemap. Can be hand-drawn or AI-generated sprite sheets. |
| **Location-based activity mapping** | Agents work at different locations (Lab, Server Room, Library, etc.) based on what Claude is doing (writing code, reading files, running tests). Transforms a flat status list into a spatial, scannable scene. | MEDIUM | Map Claude Code tool usage (from hooks or transcript) to themed locations. E.g., Bash tool = Server Room, Read/Grep = Library, Write/Edit = Lab. |
| **Celebration animation on task completion** | Provides immediate visual feedback when a session finishes. Comparable to Habitica's level-up animations or Focumon's monster collection rewards. Emotionally satisfying closure. | LOW | Single animation sequence triggered by `Stop` hook event. Agent does a brief celebration (fist pump, confetti, etc.) then walks back to HQ. |
| **"Needs attention" visual alarm for waiting sessions** | The killer utility feature. When Claude is waiting for user input (permission prompt), the agent should visually stand out -- flashing, waving, exclamation mark, etc. This is the "which terminal do I go to next?" answer. | LOW | Triggered by `Notification` hook with `permission_prompt` or `idle_prompt` type. Simple visual overlay on the agent sprite. |
| **Walk-back-to-HQ animation on completion** | Agents physically walk from their mission location back to headquarters when done. Gives spatial meaning to session lifecycle. Borrowed from RTS game patterns (units returning to base). | MEDIUM | Requires pathfinding (simple A* or waypoint-based) on the 2D map. Agent transitions from "working at location" to "walking" to "idle at HQ." |
| **Speech bubbles / activity labels** | Show what the agent is currently doing: "Running tests...", "Writing src/index.ts", "Waiting for approval." Converts opaque session status into human-readable narrative. | MEDIUM | Parse tool names and file paths from hooks or transcript data. Truncate long paths. Show as pixel-art speech bubble near agent. |
| **Session duration display** | Show how long each session has been running. Helps user prioritize which long-running session to check on. | LOW | Track session start time (from `SessionStart` hook or JSONL file creation timestamp). Display as "2h 15m" badge. |
| **Graceful scaling for many agents** | Support 2-4 agents comfortably but handle 6-8+ without breaking layout. Agents should find open locations, not stack on top of each other. | MEDIUM | Dynamic position assignment. Overflow agents queue at HQ or use secondary locations. Map should scroll or zoom if many agents exist. |
| **Day/night cycle or ambient world animation** | Background subtly animates -- clouds move, lights flicker, time-of-day changes. Makes the "world" feel alive even when agents are static. | LOW | Parallax scrolling background layers. Optional cosmetic feature. Easy to implement but adds significant polish. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Click-to-interact with sessions** | "I should be able to click an agent to switch to that terminal" | Massively increases scope -- requires terminal identification, window management APIs, cross-process communication. Also, different terminal emulators have different APIs (iTerm2 uses AppleScript, Windows Terminal has no standard API). PROJECT.md explicitly marks this out of scope. | Keep view-only. Users already know which terminal to switch to once they see the status. The visualizer's job is to SHOW, not CONTROL. |
| **Sound effects and audio** | "A ding when a session finishes would be nice" | Annoying in always-on apps. Users will mute it immediately, or worse, close the app. Audio management across OS is complex. PROJECT.md explicitly excludes audio. | Visual-only notifications (celebration animation, flashing agent) are sufficient. Users who want audio can use Claude Code's own notification hooks with OS notification systems. |
| **3D graphics or complex rendering** | "Make it look like a real game" | Dramatically increases asset creation time, rendering complexity, and resource usage. 3D is unnecessary for a status dashboard. PROJECT.md explicitly scopes to 2D pixel art. | Pixel art is charming, performant, and fast to create. Lean into it as an aesthetic choice, not a limitation. |
| **Real-time token/cost tracking overlay** | "Show me how many tokens each session has used" | Requires parsing JSONL transcripts continuously, adds complexity, and duplicates functionality of existing tools (Claude-Code-Usage-Monitor). Cost data is approximate and distracting for a visual status tool. | Show duration and status only. Users who want token tracking should use dedicated monitoring tools. Consider adding as a tooltip in v2 if demand exists. |
| **Session control (start/stop/restart)** | "Let me spawn new Claude Code sessions from the visualizer" | Transforms a simple visualizer into a session manager. Requires shell spawning, PTY management, and deep OS integration. Completely different product. | Keep view-only. The visualizer watches; the user controls sessions from their terminals. |
| **Plugin/extension system** | "Let users add custom themes and agents" | Premature abstraction. The app has no users yet. Plugin systems add enormous maintenance burden and API surface. | Ship one great theme (spy/agent). Consider themes in v2+ only after validating that people actually use the core product. |
| **Web-hosted or remote access** | "Access my agent world from my phone" | Adds server infrastructure, authentication, networking -- all for a local-only tool. Several Claude Code dashboards (claude-code-monitor) already serve this niche. PROJECT.md explicitly excludes this. | Local desktop app only. If remote viewing is needed later, a simple screenshot-based approach would be far simpler than a web server. |
| **Persistent history / session replay** | "Show me what agents did yesterday" | Requires a database, historical data management, and a completely different UI mode. The app is a real-time dashboard, not an analytics tool. | Show only currently active sessions. Past sessions disappear when agents walk back to HQ and eventually despawn. |

## Feature Dependencies

```
[Session Detection (hooks/filesystem)]
    |
    +--requires--> [Agent Spawning/Despawning]
    |                  |
    |                  +--requires--> [Agent Animation System]
    |                  |                  |
    |                  |                  +--enhances--> [Celebration Animation]
    |                  |                  +--enhances--> [Walk-back-to-HQ]
    |                  |
    |                  +--requires--> [Status Display (active/waiting/idle)]
    |                                     |
    |                                     +--enhances--> [Needs-Attention Visual Alarm]
    |                                     +--enhances--> [Speech Bubbles]
    |
    +--requires--> [Project Name Labels]
    +--enhances--> [Session Duration Display]

[Desktop Window (always-on-top, transparent)]
    |
    +--requires--> [Canvas/WebGL Renderer]
    |                  |
    |                  +--requires--> [Sprite Sheet Loading]
    |                  +--requires--> [Tilemap / World Rendering]
    |                                     |
    |                                     +--enhances--> [Location-based Activity Mapping]
    |                                     +--enhances--> [Day/Night Cycle]
    |
    +--requires--> [Lightweight Resource Usage]

[Spy Theme Assets]
    +--enhances--> [Agent Animation System]
    +--enhances--> [Location-based Activity Mapping]
    +--enhances--> [Celebration Animation]
```

### Dependency Notes

- **Session Detection requires Agent Spawning**: Cannot display agents without detecting sessions first. This is the foundational data pipeline.
- **Agent Spawning requires Animation System**: An agent without animation is just a static icon. The animation system makes it "alive."
- **Desktop Window requires Canvas Renderer**: The transparent overlay window needs a performant rendering surface for smooth animation.
- **Spy Theme enhances everything visual**: Theme assets are applied on top of the rendering and animation systems. They are cosmetic but define the product identity.
- **Status Display requires Session Detection**: Status (active/waiting/idle) comes from hook events or process polling. Without detection, there is no status.
- **Location Mapping enhances World Rendering**: Agents moving to different map locations requires the world/tilemap to exist first.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept.

- [ ] **Session detection via Claude Code hooks** -- Register SessionStart/Stop/Notification hooks that write session state to a shared JSON file. This is the data backbone.
- [ ] **Desktop window (always-on-top, transparent)** -- Electron or Tauri app with frameless transparent window, always on top. Click-through on transparent areas.
- [ ] **Canvas renderer with sprite animation** -- HTML5 Canvas rendering loop. Load sprite sheets, animate at 10-15 FPS. No need for WebGL initially.
- [ ] **Basic 2D world with HQ building** -- Simple tilemap background with one "HQ" area and 2-3 mission locations.
- [ ] **Agent spawning per session** -- Each detected session creates an agent at HQ that walks to a location.
- [ ] **Status display (active/waiting/done)** -- Color-coded or visually distinct states. Waiting-for-input agents must be immediately obvious.
- [ ] **Project name labels** -- Text label above each agent showing project/directory name.
- [ ] **Basic spy-themed pixel art** -- Agent character with idle, walk, and work animations. Does not need to be polished -- functional pixel art is fine for MVP.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Celebration animation on completion** -- Trigger when `Stop` hook fires. Quick victory animation before walk-back.
- [ ] **Walk-back-to-HQ pathfinding** -- Agents walk from mission location back to HQ on session end.
- [ ] **Speech bubbles with current activity** -- Parse tool names from hooks to show "Running tests...", "Editing file...", etc.
- [ ] **Location-based activity mapping** -- Assign agents to locations based on current tool usage (Bash = Server Room, Write = Lab, etc.).
- [ ] **Session duration badges** -- Show elapsed time per session.
- [ ] **Needs-attention alarm animation** -- Flashing/bouncing animation for agents waiting on permission prompts.
- [ ] **Multiple agent sprites** -- Different spy characters so agents are visually distinguishable.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Day/night ambient cycle** -- Cosmetic world animation tied to system clock.
- [ ] **Scaling for 6+ agents** -- Scrollable or zoomable world, dynamic location assignment.
- [ ] **Mini-map or agent list sidebar** -- For when there are too many agents to see at once.
- [ ] **Custom themes beyond spy** -- Other visual themes (space station, medieval castle, etc.).
- [ ] **Tooltip with session details** -- Hover for expanded info (token count, files changed, etc.).
- [ ] **Tray icon with quick status** -- System tray integration showing active session count.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Session detection (hooks) | HIGH | HIGH | P1 |
| Desktop window (transparent, always-on-top) | HIGH | MEDIUM | P1 |
| Canvas renderer + sprite animation | HIGH | MEDIUM | P1 |
| Basic 2D world + HQ | HIGH | MEDIUM | P1 |
| Agent spawn/despawn per session | HIGH | MEDIUM | P1 |
| Status display (active/waiting/done) | HIGH | LOW | P1 |
| Project name labels | HIGH | LOW | P1 |
| Spy-themed pixel art (basic) | MEDIUM | MEDIUM | P1 |
| Needs-attention alarm | HIGH | LOW | P2 |
| Speech bubbles / activity text | MEDIUM | MEDIUM | P2 |
| Celebration animation | MEDIUM | LOW | P2 |
| Walk-back-to-HQ | MEDIUM | MEDIUM | P2 |
| Location-based activity mapping | MEDIUM | MEDIUM | P2 |
| Session duration display | MEDIUM | LOW | P2 |
| Multiple distinguishable agents | LOW | MEDIUM | P2 |
| Day/night cycle | LOW | LOW | P3 |
| Scaling for 6+ agents | LOW | MEDIUM | P3 |
| Custom themes | LOW | HIGH | P3 |
| Tray icon | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch -- the app is not usable without these
- P2: Should have, add when possible -- makes the app delightful and useful
- P3: Nice to have, future consideration -- polish and expansion

## Competitor / Adjacent Product Analysis

| Feature | claude-code-monitor (CLI) | Claude-Code-Usage-Monitor | On-Together (Steam) | Shimeji/WindowPet | Agent World (Ours) |
|---------|---------------------------|---------------------------|---------------------|--------------------|--------------------|
| Session detection | Hooks + file-based state | Usage polling + ML analysis | N/A (manual) | N/A | Hooks + file-based state |
| Multi-session view | Terminal TUI, status icons | Single session focus | N/A | N/A | 2D animated world |
| Status visualization | Text-based (icons) | Progress bars, color coding | Focus timer states | Animation states | Animated agents with distinct states |
| Always-on desktop | No (terminal app) | No (terminal app) | Yes (transparent sticker mode) | Yes (desktop overlay) | Yes (transparent overlay) |
| Character animation | None | None | Yes (pixel avatars with focus animations) | Yes (walking, climbing, sitting) | Yes (idle, walk, work, celebrate) |
| Activity context | Latest message, session dir | Token/cost metrics | Timer-based only | None (decorative) | Tool-based speech bubbles |
| Theming | Terminal colors | Terminal colors | Cozy/casual | Various character skins | Spy/secret agent |
| Platform | macOS only | Cross-platform CLI | Windows/Mac (Steam) | Cross-platform | Windows (primary) |
| View vs Control | View + terminal focus switching | View only | Interactive (timer control) | Interactive (drag/drop) | View only |

### Key Differentiators vs Adjacent Products

1. **No existing product combines session monitoring with animated character visualization.** claude-code-monitor shows status as text; Shimeji shows characters without data. Agent World bridges both.
2. **Spy theming creates identity.** On-Together uses cozy/casual vibes; Habitica uses RPG. The spy/agent theme is uniquely fitting for "AI agents on missions."
3. **View-only simplicity.** By deliberately NOT adding interaction, the app stays lightweight and focused on its core value: "which session needs attention."

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - HIGH confidence (official documentation)
- [Claude Code Monitoring/Usage](https://code.claude.com/docs/en/monitoring-usage) - HIGH confidence (official documentation)
- [claude-code-monitor GitHub](https://github.com/onikan27/claude-code-monitor) - MEDIUM confidence (third-party tool)
- [Claude-Code-Usage-Monitor GitHub](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) - MEDIUM confidence (third-party tool)
- [Building a Desktop Pet with Tauri](https://crabnebula.dev/blog/building-a-desktop-pet-with-tauri/) - MEDIUM confidence (technical blog)
- [WindowPet GitHub](https://github.com/SeakMengs/WindowPet) - MEDIUM confidence (open source reference)
- [Tauri Window Customization](https://v2.tauri.app/learn/window-customization/) - HIGH confidence (official docs)
- [On-Together Steam Page](https://store.steampowered.com/app/3707400/OnTogether_Virtual_CoWorking/) - MEDIUM confidence (product page)
- [Focumon](https://www.focumon.com/landing) - MEDIUM confidence (product page)
- [Habitica](https://habitica.com/) - MEDIUM confidence (established product)
- [~/.claude directory structure Gist](https://gist.github.com/samkeen/dc6a9771a78d1ecee7eb9ec1307f1b52) - LOW confidence (community gist, verify against actual filesystem)
- [Shimeji-ee](https://kilkakon.com/shimeji/) - MEDIUM confidence (established desktop pet platform)
- [Claude Code Session File Format](https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b) - LOW confidence (community article, verify)
- [KSRED Claude Code Dashboard](https://www.ksred.com/managing-multiple-claude-code-sessions-building-a-real-time-dashboard/) - MEDIUM confidence (developer blog with working implementation)

---
*Feature research for: Animated 2D desktop process visualizer (Agent World)*
*Researched: 2026-02-25*
