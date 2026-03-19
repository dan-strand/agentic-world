# Agent World

## What This Is

A locally-run animated 2D visualizer that shows your active Claude Code sessions as Fantasy RPG adventurers in a living pixel-art world with a day/night cycle, usage dashboard, and distinct character identities. Each agent represents a running Claude session — mages, warriors, rangers, and rogues with unique color palettes and gear walk into detailed workspace interiors (Wizard Tower, Training Grounds, Ancient Library, Tavern) and work at themed stations. The world breathes with a 10-minute day/night cycle: warm golden daylight shifts to cool blue night, lanterns and torches glow, chimney smoke intensifies, and atmospheric particles (fireflies, sparks, dust motes, drifting leaves) create ambience. Below the RPG world, a live dashboard shows session details, token breakdowns, cost estimates, and 30-day historical trends. Buildings display current tool info, agents wander around their stations, and the world shows at a glance which sessions are active, idle, or waiting for input. When sessions complete, agents celebrate with class-specific animations and a golden light column before returning to the central campfire.

## Core Value

Instantly see the status of all Claude Code sessions so you know which one needs attention next.

## Requirements

### Validated

- ✓ Auto-detect running Claude Code sessions — v1.0 Phase 1
- ✓ Display each session as an animated character in a 2D world — v1.0 Phase 2
- ✓ Status visual differentiation (active/waiting/idle/error) — v1.0 Phase 3
- ✓ Celebration animation on task completion — v1.0 Phase 3
- ✓ Walk-back-to-Guild-Hall lifecycle — v1.0 Phase 3, updated v1.1 Phase 5
- ✓ Always-on lightweight desktop application — v1.0 Phase 1
- ✓ Fantasy RPG theme: adventurers, guild hall, quest zones — v1.1 Phases 4-7
- ✓ 32x32 pixel art sprite sheets (pngjs-generated, replacing code-drawn primitives) — v1.1 Phase 6
- ✓ Tilemap ground with grass tiles and dirt paths — v1.1 Phase 4
- ✓ Quest zone buildings: Wizard Tower, Training Grounds, Ancient Library, Tavern — v1.1 Phase 5
- ✓ Level-up celebration effect (golden light column, sparkles, GlowFilter) — v1.1 Phase 7
- ✓ Vehicle system removed — adventurers walk everywhere — v1.1 Phase 6
- ✓ Fixed 1024x768 window, hidden title bar with minimize/close only — v1.1 Phase 4
- ✓ Ambient lighting (warm tint) and particle effects (fireflies) — v1.1 Phase 7
- ✓ Dynamic building labels with project names — v1.2 Phase 8
- ✓ Speech bubbles on activity changes — v1.2 Phase 9
- ✓ Agent fade-out lifecycle — v1.2 Phase 10
- ✓ Job completion sound effect — v1.2 Quick Task 3
- ✓ Ready-to-work reminder sound — v1.2 Quick Task 5
- ✓ Volume slider and mute button — v1.2 Quick Task 3
- ✓ RPG-themed work spots per building — v1.2 Quick Task 4
- ✓ Idle timeout agent fadeout (5 min) — v1.2 Quick Task 2
- ✓ Accurate status transitions (active/waiting/idle) from JSONL files — v1.3 Phase 11
- ✓ Status debounce commits transitions without dropping state changes — v1.3 Phase 11
- ✓ Reactivated sessions after fade-out properly reappear as agents — v1.3 Phase 11
- ✓ All active/waiting sessions always have a visible agent on screen — v1.3 Phase 11
- ✓ Tool_use detection prevents false "job's done" during active execution — v1.3 Phase 11
- ✓ Stale session filter preserves actively-working sessions — v1.3 Phase 11
- ✓ Per-session waiting reminder from "waiting" status (not idle) — v1.3 Phase 13
- ✓ Reminder sounds throttled with ~30s minimum gap — v1.3 Phase 13
- ✓ Reminder requires active-cycle before repeating — v1.3 Phase 13
- ✓ World layout reorganized with 464x336 buildings in 2x2 grid — v1.4 Phase 14
- ✓ Guild Hall replaced with compact campfire waypoint — v1.4 Phase 14
- ✓ Star-pattern footpaths connecting campfire to all buildings — v1.4 Phase 14
- ✓ Detailed top-down workspace interiors for all four buildings — v1.4 Phase 15
- ✓ Agents positioned at themed stations inside workspace interiors — v1.4 Phase 16
- ✓ Tool name overlay banners on each active workspace — v1.4 Phase 16
- ✓ Agent z-ordering and reparenting between global/building containers — v1.4 Phase 16
- ✓ Agent wander behavior around station centers (~40px radius) — v1.4 Phase 16
- ✓ Expanded window height (1024x1080) with dashboard panel below RPG world — v1.5 Phase 17
- ✓ Streaming JSONL parser with mtime-cached aggregator — v1.5 Phase 17
- ✓ Dashboard panel with live session list (compact rows, expandable detail) — v1.5 Phase 18
- ✓ Token tracking from JSONL `message.usage` (input, output, cache read/write) — v1.5 Phase 17-18
- ✓ Cost estimation with auto-detected model pricing (Opus, Sonnet, Haiku) — v1.5 Phase 18
- ✓ Today's aggregate totals bar with cache savings display — v1.5 Phase 18
- ✓ 30-day historical persistence with atomic JSON writes — v1.5 Phase 19
- ✓ Outdoor scenery with 96 placed sprites (trees, bushes, flowers, props, fences, lanterns) — v2.0 Phase 20
- ✓ Building exterior enhancements (roof shingles, chimneys with smoke, hanging signs, glowing windows) — v2.0 Phase 20
- ✓ Enhanced tilemap with wider paths, border transitions, and pond — v2.0 Phase 20
- ✓ Unique agent color palettes (25 palettes, session-hash-derived) — v2.0 Phase 21
- ✓ Gear overlay sprites (hats, helms, hoods per class) — v2.0 Phase 21
- ✓ Class-specific celebrate animations (mage staff burst, warrior fist pump, ranger salute, rogue dagger flip) — v2.0 Phase 21
- ✓ 10-minute day/night cycle with smooth sine-wave color temperature transitions — v2.0 Phase 22
- ✓ Night glow halos at lanterns, torches, windows, and campfire — v2.0 Phase 22
- ✓ Enhanced atmospheric particles (forge sparks, dust motes, drifting leaves) — v2.0 Phase 22
- ✓ Night-modulated chimney smoke and firefly brightness — v2.0 Phase 22
- ✓ Async non-blocking session discovery via fs.promises — v2.2 Phase 26
- ✓ Combined JSONL tail read (single file open per session per poll) — v2.2 Phase 26
- ✓ Incremental offset-based JSONL usage parsing — v2.2 Phase 26
- ✓ Adaptive poll backoff (3s → 30s when idle, instant reset) — v2.2 Phase 26
- ✓ Container.tint replaces ColorMatrixFilter (eliminates double GPU render pass) — v2.2 Phase 27
- ✓ Threshold-gated day/night tint updates (~99.7% skip rate) — v2.2 Phase 27
- ✓ Static layer GPU texture caching (cacheAsTexture on tilemap/scenery) — v2.2 Phase 27
- ✓ Night glow alpha threshold guard (~98% skip rate) — v2.2 Phase 27
- ✓ Particle idle throttling (smoke/sparks skip at 5fps) — v2.2 Phase 28
- ✓ O(1) swap-and-pop particle removal — v2.2 Phase 28
- ✓ Dirty-flag building highlight tints — v2.2 Phase 28
- ✓ State-driven agent reparenting (not per-frame polling) — v2.2 Phase 28
- ✓ In-place dashboard DOM diffing (no innerHTML rebuild) — v2.2 Phase 28
- ✓ Zero-allocation tick loop (reusable buffers/Sets) — v2.2 Phase 28
- ✓ AgentTrackingState: 14 per-agent Maps consolidated into single Map — v2.2 Phase 29

### Active

## Current Milestone: v2.3 Performance Polish

**Goal:** Address remaining LOW-priority performance audit items that have measurable benefit — GPU texture consolidation, night-gated smoke, cached DOM helpers, async startup, and minor allocation cleanup.

**Target features:**
- Atlas palette-swapped animation frames into single GPU texture per agent
- Replace night glow concentric circle Graphics with radial gradient sprites
- Gate building smoke baseAlpha on nightIntensity threshold
- Cache escapeHtml div element, throttle console.warn
- Pass mtime from SessionDetector to eliminate redundant statSync
- Replace spread in removeAgent with for-of loop
- Move module-level sync constructors after app.ready

### Out of Scope

- Web hosting or remote access — local only
- Click-to-interact or session control from the visualizer
- 3D graphics — strictly 2D pixel art
- Mobile support — desktop-only tool
- Custom/hand-drawn pixel art — pngjs-generated or best-fit approach per feature
- Per-session sound selection — over-engineering for current use case
- Global "all-waiting" sound — user prefers per-session sounds
- Daily breakdown bar chart — deferred to future milestone (Chart.js)
- Real-time token streaming counter — JSONL files only written at message boundaries
- Per-project historical view — project-to-session mapping is fuzzy
- Budget alerts — requires settings system that doesn't exist yet

## Context

- User runs multiple Claude Code sessions simultaneously in different bash terminals on Windows (MINGW64/Git Bash)
- Shipped v1.0 through v2.0 in 7 days (2026-02-25 → 2026-03-03)
- Codebase: 8,494 LOC TypeScript (source), ~30 source files, 4 pngjs generator scripts
- JSONL logs at `~/.claude/projects/{encoded-path}/{session-uuid}.jsonl` contain `message.usage` with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, and `message.model`
- Tech stack: Electron 40.6.1, PixiJS 8.16.0, TypeScript 5.7, pixi-filters 6.1.5, Webpack (Electron Forge)
- Atlas-first asset pipeline: pngjs generates PNG atlases, JSON descriptors, loadAllAssets() with Promise.all
- 6-state agent machine: idle_at_hq, walking_to_building, walking_to_workspot, working, celebrating, fading_out
- Agent interior mode: 1.5x scale inside buildings, wander behavior, z-ordered reparenting between containers
- Canvas-rendered static tilemap ground, static Building instances with agentsLayer, AnimatedSprite agents with palette-swapped textures
- Scenery layer with 96 placed sprites (trees, bushes, flowers, props, lanterns, torches) using seeded random placement
- Night glow layer with 19+ concentric circle Graphics glows synced to day/night cycle
- DayNightCycle manager: 10-min sine-wave cycle, Container.tint on worldContainer for color temperature (ColorMatrixFilter removed v2.2)
- Buildings: 464x336 landscape in 2x2 grid, detailed top-down interiors, station tracking, tool name banners
- SoundManager singleton with HTML5 Audio API for jobs-done and ready-to-work sounds
- Status debounce (2.5s) prevents visual flickering; dual-gate completion detection (status transition + system entry)
- Session status lifecycle: active → waiting → idle (waiting = task done, idle = dormant)
- tool_use content inspection keeps sessions active during multi-tool execution
- Per-session waiting reminders (60s timer, 30s global throttle, active-cycle guard)
- Dashboard panel (312px) below RPG world (768px) in 1024x1080 window with flex column layout
- Async session discovery (fs.promises) with combined single-pass JSONL tail read and incremental offset-based usage parsing
- Adaptive poll backoff (3s → 30s idle, instant reset on activity)
- MODEL_PRICING table with 10 Claude model entries and 4-step resolution (bare alias → exact → prefix → fallback)
- DashboardPanel renders session rows with click-to-expand token breakdowns and cost estimates
- HistoryStore persists daily aggregates to `~/.agent-world/history.json` with atomic writes and 30-day pruning
- Separate dashboard-update IPC channel from sessions-update for concern isolation

## Constraints

- **Platform**: Windows (MINGW64_NT) — must run natively on user's system
- **Runtime**: Local only — no server, no cloud, no browser hosting
- **Access**: Needs to read local process info and Claude session state
- **Performance**: Lightweight enough to run always-on without impacting system resources
- **Dependencies**: Minimize external dependencies — should be easy to install and run

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| View-only (no interaction) | Keeps scope manageable, user just needs visual status | ✓ Good |
| Local desktop app (not terminal UI) | Needed for rich 2D animation and pixel art rendering | ✓ Good |
| Auto-detect sessions | Hands-free operation, no manual registration | ✓ Good |
| Fantasy RPG theme (v1.1) | More engaging, better visual vocabulary for quest/mission metaphor | ✓ Good |
| pngjs-generated sprites (v1.1) | Deterministic, no external asset deps, consistent style | ✓ Good |
| Fixed 1024x768 window (v1.1) | Clean look, no resize complexity, fits as always-on dashboard | ✓ Good |
| Atlas-first asset pipeline (v1.1) | Avoids PixiJS Cache/Texture.from issues, single draw calls | ✓ Good |
| Canvas-rendered tilemap (v1.1) | @pixi/tilemap incompatible with Electron webpack; canvas equally efficient for static ground | ✓ Good |
| Walk-only movement (v1.1) | Simpler state machine, fits RPG theme, vehicles felt out of place | ✓ Good |
| pixi-filters GlowFilter (v1.1) | Only viable glow option for PixiJS 8; quality 0.3 matches pixel art | ✓ Good |
| Per-session sounds, not global (v1.3) | User explicitly prefers individual session sounds over all-waiting signal | ✓ Good |
| Status audit before audio (v1.3) | Audio logic depends on reliable status detection; fix pipeline first | ✓ Good |
| tool_use content inspection (v1.3) | Prevents false waiting during tool execution; uses existing JSONL structure | ✓ Good |
| Dual-gate completion detection (v1.3) | Requires both status transition AND system entry; defense-in-depth | ✓ Good |
| Reminder from waiting, not idle (v1.3) | "Waiting" is the actionable state; "idle" is dormant | ✓ Good |
| 30s reminder throttle (v1.3) | Prevents audio spam when multiple sessions finish close together | ✓ Good |
| Active-cycle guard for reminders (v1.3) | Session must go active before reminder can fire again; prevents nagging | ✓ Good |
| 2x2 grid layout with 464x336 buildings (v1.4) | Fill screen with workspace detail; symmetric, comfortable ~64px gaps | ✓ Good |
| Campfire replaces Guild Hall (v1.4) | Small 64x64 waypoint for transitions; buildings get the screen space | ✓ Good |
| Top-down detailed interiors (v1.4) | Well-furnished ~60-70%, themed lighting, identifiable stations | ✓ Good |
| Agent reparenting between containers (v1.4) | Z-ordering requires agents as building children; coordinate conversion at boundary | ✓ Good |
| Station wander behavior (v1.4) | Agents move ~40px around station center; makes interiors feel alive | ✓ Good |
| Activity-type station switching (v1.4) | Stations switch on activity category change, not per-tool-name; simpler | ✓ Good |
| HTML dashboard below PixiJS canvas (v1.5) | Dashboard as HTML div, not embedded in PixiJS scene; simpler, native DOM | ✓ Good |
| Streaming readline for JSONL parsing (v1.5) | Non-blocking, handles large files without stalling animation | ✓ Good |
| Mtime-based usage cache (v1.5) | Skip re-parsing unchanged files; mirrors session-detector pattern | ✓ Good |
| Separate dashboard-update IPC channel (v1.5) | Isolates dashboard data flow from session status updates | ✓ Good |
| Sonnet-rate fallback for unknown models (v1.5) | Conservative default with isEstimate flag; neither cheapest nor most expensive | ✓ Good |
| Vanilla DOM for dashboard (v1.5) | No framework; consistent with existing renderer pattern | ✓ Good |
| Atomic JSON writes with Windows fallback (v1.5) | tmp+rename with copyFile fallback for EPERM/EBUSY antivirus locks | ✓ Good |
| Local date keys for history (v1.5) | en-CA format matches user's calendar day, not UTC | ✓ Good |
| Non-blocking history load (v1.5) | .then()/.catch() so dashboard renders immediately without waiting | ✓ Good |
| Seeded random scenery placement (v2.0) | Reproducible layout, exclusion zones around buildings | ✓ Good |
| Overlay functions for building exteriors (v2.0) | Preserves existing interiors, adds detail without regenerating base art | ✓ Good |
| Offscreen canvas palette swap (v2.0) | Pixel-level color replacement with brightness delta preservation; cached | ✓ Good |
| Session hash bit-shifting for identity (v2.0) | Independent ranges for palette/gear/name from single hash; deterministic | ✓ Good |
| Fantasy name labels removed (v2.0) | User preference during verification; data layer retained for future | ✓ Good |
| Sine-wave day/night cycle (v2.0) | pow(1.5) sharpening for natural day-dominant feel; 10-min period | ✓ Good |
| Concentric circles for glow (v2.0) | Avoids expensive PixiJS blur filters; adequate visual quality | ✓ Good |
| nightIntensity as central signal (v2.0) | Single value threaded from cycle → glow, smoke, particles; no duplication | ✓ Good |
| Container.tint replaces ColorMatrixFilter (v2.2) | Eliminates full-scene double render pass; tint is multiplicative and inherited | ✓ Good |
| Hex integer comparison for tint threshold (v2.2) | Natural 1/255 quantization, ~99.7% skip rate, zero per-tick allocations | ✓ Good |
| cacheAsTexture on static layers (v2.2) | Tilemap and scenery render once to GPU texture; ~100 draw calls → 2 | ✓ Good |
| Async fs.promises for session discovery (v2.2) | Unblocks Electron main process event loop during polling | ✓ Good |
| Incremental offset-based JSONL parsing (v2.2) | Reads only new bytes; falls back on truncation/inode change | ✓ Good |
| setTimeout recursion for adaptive poll (v2.2) | Linear backoff 3s→30s; instant reset; no setInterval cleanup issues | ✓ Good |
| AgentTrackingState single Map (v2.2) | 14 Maps → 1; agent removal is one delete(); ~3000 fewer Map lookups/sec | ✓ Good |
| Dirty-flag building highlights (v2.2) | Recompute only on occupancy change, not every frame | ✓ Good |

---
*Last updated: 2026-03-19 after v2.3 milestone start*
