# Stack Research

**Domain:** Animated 2D pixel-art desktop process visualizer (always-on, Windows)
**Researched:** 2026-02-25
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Electron | ^40.0.0 (latest stable: 40.6.1) | Desktop app shell | Only viable option for this project. Tauri has documented GPU/canvas hardware acceleration issues on Windows WebView2 (GitHub issues #4891, #5037), making it unsuitable for always-on animated rendering. Electron bundles Chromium with full GPU acceleration, guaranteeing consistent canvas/WebGL performance. Bundles Node.js 24 for native process access. |
| PixiJS | ^8.16.0 | 2D rendering engine (WebGL/WebGPU) | The standard 2D rendering engine for sprite-based animation. Handles 1000+ sprites at 60fps via WebGL hardware acceleration. Native AnimatedSprite class with spritesheet support. Pixel-art rendering with `SCALE_MODES.NEAREST` for crisp scaling. Active development -- v8.16.0 released Feb 2026 with canvas fallback renderer. |
| TypeScript | ^5.7 | Type safety, DX | Electron + PixiJS both have first-class TypeScript support. Essential for a project with multiple system boundaries (process monitoring, file watching, rendering). Catches integration bugs at compile time. |
| Node.js | 24.x (bundled with Electron 40) | Runtime (built into Electron) | Not installed separately. Electron 40 bundles Node.js 24.13.1. Provides `child_process`, `fs`, and `os` modules for system access. |

### Session Detection & Process Monitoring

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| chokidar | ^4.0.3 | File system watcher | Watches `~/.claude/projects/` for JSONL file changes to detect active sessions. v4 is CommonJS+ESM compatible (v5 is ESM-only which complicates Electron main process). Reduced dependencies from 13 to 1. Uses native `fs.watch` under the hood -- no polling, low CPU. |
| systeminformation | ^5.31.1 | Process enumeration | Lists running `claude.exe` processes with PIDs and command-line args. 50+ system info functions, Windows support, 20M downloads/month. Used as a fallback/supplemental detection alongside file watching. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electron-forge/cli | ^7.11.1 | Build tooling, packaging | Project scaffolding, dev server, Windows packaging. Officially recommended by Electron team. First-party tool integration. |
| electron-store | ^10.0.0 | Persistent config storage | User preferences (window position, animation speed, theme). Simple key-value JSON store with schema validation. |
| jsonlines (or readline) | built-in | JSONL parsing | Parsing Claude Code session `.jsonl` files. Use Node.js built-in `readline` with `createInterface` -- no dependency needed. |
| @pixi/spritesheet | included in pixi.js | Spritesheet loading | Part of PixiJS core. Loads sprite atlas JSON + PNG for agent animations (walk, work, celebrate, idle). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Electron Forge | Dev server + hot reload | `npx create-electron-app agent-world --template=typescript-webpack` for scaffolding with TypeScript + Webpack |
| Aseprite (or Piskel) | Pixel art sprite creation | Aseprite ($20) is the industry standard for pixel art animation. Piskel is free. Both export spritesheet JSON+PNG compatible with PixiJS. |
| TexturePacker | Spritesheet packing | Packs individual frames into optimized atlas. Free tier sufficient. Exports PixiJS-native JSON format. |

## Installation

```bash
# Scaffold project with Electron Forge + TypeScript + Webpack
npx create-electron-app agent-world --template=typescript-webpack

# Core rendering
npm install pixi.js

# Session detection & monitoring
npm install chokidar systeminformation

# Persistent config
npm install electron-store

# Dev dependencies (most included by Electron Forge template)
npm install -D typescript @types/node
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Electron | Tauri v2 | Only if app size (<10MB) matters more than rendering reliability. Tauri's WebView2 on Windows has known GPU acceleration issues with canvas (GitHub #4891, #5037). For an always-on animated visualizer, this is a dealbreaker. |
| Electron | Neutralino.js | Never for this project. ~2MB app size is attractive but lacks Node.js runtime, meaning no native process enumeration or filesystem access without workarounds. |
| PixiJS | Phaser 3 | Only if building a full game with physics, tilemaps, input handling. Phaser is a game framework built ON TOP of PixiJS. We need a renderer, not a game engine. Phaser adds ~500KB of unnecessary game logic. |
| PixiJS | HTML Canvas API | Never for this project. Raw Canvas 2D struggles with 100+ moving elements. PixiJS uses WebGL batching to handle 1000+ at 60fps. The performance difference is 10x+. |
| PixiJS | Konva.js | Only for UI/diagram apps. Konva is optimized for interactive shapes and hit detection, not sprite animation. Wrong tool for pixel art. |
| chokidar | Node.js fs.watch (built-in) | Only if you want zero dependencies. Raw fs.watch has cross-platform quirks (duplicate events, missing events on some OS). Chokidar normalizes these. Worth the single dependency. |
| systeminformation | ps-list | If you only need process names. ps-list is lighter but returns less data on Windows (no CPU, memory, path). systeminformation provides richer data for monitoring. |
| systeminformation | node-processlist | If targeting Windows exclusively. Uses `tasklist` command directly. Simpler but less maintained. systeminformation is safer long-term. |
| Electron Forge | electron-builder | If you need advanced installer customization (MSI, NSIS scripting). electron-builder has higher npm downloads but uses custom build logic. Forge is officially recommended by Electron team and uses first-party tools. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Tauri v2 for this project | Documented canvas/CSS hardware acceleration issues on Windows WebView2. GPU rendering falls back to CPU, causing stuttery animations. Multiple open GitHub issues (#4891, #5037, #5761). Fatal for an always-on animated app. | Electron (full Chromium, guaranteed GPU acceleration) |
| Three.js | Massive overkill. Three.js is a 3D engine. Adding it for 2D sprites wastes ~600KB+ and adds complexity. PixiJS is purpose-built for 2D. | PixiJS |
| React / Vue / Svelte for rendering | DOM frameworks add overhead between your code and the canvas. PixiJS renders directly to WebGL canvas. Adding React means fighting the framework for animation control. | Vanilla TypeScript + PixiJS |
| React for Electron UI layer | This is a view-only dashboard with no interactive UI controls. No forms, no buttons, no state management needed. React adds ~40KB+ for zero benefit. | Plain HTML/CSS for any overlay text, PixiJS for everything visual |
| Webpack (standalone) | Don't configure Webpack manually for Electron. Electron Forge's webpack template handles main/renderer process bundling, dev server, and hot reload correctly. | @electron-forge/plugin-webpack (included in template) |
| PM2 | PM2 is for managing Node.js server processes. We're monitoring external processes (claude.exe), not managing our own. | systeminformation + chokidar |
| OpenTelemetry | Claude Code has OTel support, but it requires environment variable setup per session. We want zero-config detection -- just launch the visualizer and it finds sessions. Filesystem watching is simpler and works without user configuration. | chokidar watching ~/.claude/ |

## Stack Patterns by Variant

**If prioritizing minimal memory footprint:**
- Use `backgroundThrottling: false` in BrowserWindow options sparingly
- Set `show: false` initially, only show when rendering is ready
- Use `powerSaveBlocker` only when animations are actively running
- Target ~80-120MB RAM (Electron baseline ~60-80MB + PixiJS ~20-40MB)

**If adding future interactivity (clicking agents, etc.):**
- Still use PixiJS for hit testing (`sprite.interactive = true`, `sprite.on('pointerdown', ...)`)
- Do NOT add React/Vue. PixiJS has built-in event handling sufficient for sprite clicks.
- Consider adding a minimal HTML overlay for tooltips only

**If Claude Code changes session file format:**
- The JSONL format in `~/.claude/projects/<path>/<uuid>.jsonl` is not a public API
- Build a session detection abstraction layer that can swap implementations
- Fallback: process enumeration via `systeminformation` (detects `claude.exe` processes)
- Fallback: Watch `~/.claude/history.jsonl` for new entries (records prompts with project and timestamp)

## Session Detection Architecture (Critical Stack Decision)

Claude Code sessions are detectable via two complementary methods:

### Primary: Filesystem Watching
- **Path:** `~/.claude/projects/<project-dir-encoded>/` (e.g., `C--Users-dlaws-Projects-Agent-World`)
- **Session files:** `<uuid>.jsonl` -- actively written to during sessions
- **Subagents:** `<uuid>/subagents/agent-<id>.jsonl` -- spawned agent threads
- **Detection:** Watch for new `.jsonl` files (session start), monitor file modification times (activity), detect file staleness (session end)
- **Project name:** Decoded from directory name (replace `--` with path separators)

### Secondary: Process Enumeration
- **Target:** `claude.exe` processes via `systeminformation.processes()`
- **Data:** PID, command line args, CPU usage, memory usage
- **Use:** Confirm session is truly active (file may exist but process died), get resource usage data

### History File (Supplemental)
- **Path:** `~/.claude/history.jsonl`
- **Format:** `{"display":"prompt text","pastedContents":{},"timestamp":1759251384183,"project":"C:\\Users\\dlaws\\..."}`
- **Use:** Correlate prompts to projects, detect which project a session belongs to

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Electron ^40.0.0 | Node.js 24.x (bundled) | Node 24 is bundled, not system Node. All npm packages must support Node 24. |
| Electron ^40.0.0 | Chromium 144 | Full WebGL2 + WebGPU support. PixiJS 8 auto-detects best renderer. |
| PixiJS ^8.16.0 | Electron ^40.0.0 | PixiJS detects WebGL/WebGPU from Chromium. No compatibility issues known. |
| chokidar ^4.0.3 | Node.js 14+ | v4 supports Node 14+, well within Electron 40's Node 24. Use v4 not v5 (v5 is ESM-only, complicates Electron main process). |
| systeminformation ^5.31.1 | Node.js 14+ | Windows support labeled "partial" but process listing works reliably. v6 (TypeScript rewrite) is in beta -- stick with v5 for stability. |
| electron-store ^10.0.0 | Electron ^26+ | Uses Electron's `app.getPath('userData')` for storage. |
| @electron-forge/cli ^7.11.1 | Electron ^28+ | Current version fully supports Electron 40. |

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| Electron over Tauri | HIGH | Tauri GPU issues verified via multiple GitHub issues (#4891, #5037). Electron Chromium GPU acceleration confirmed via official docs. |
| PixiJS for rendering | HIGH | Industry standard for 2D web rendering. Official docs confirm AnimatedSprite, spritesheet support. 60fps with 1000+ sprites verified. |
| chokidar for file watching | HIGH | 4.0.3 verified on GitHub releases page. CommonJS support confirmed. Standard choice for Node.js file watching. |
| systeminformation for processes | MEDIUM | v5.31.1 verified. Windows process support labeled "partial" in official docs. Tested locally: `claude.exe` visible via `tasklist`/`wmic`. |
| Session file structure | MEDIUM | Verified by direct filesystem inspection of `~/.claude/`. Not a documented public API -- could change between Claude Code versions. |
| Electron memory baseline | MEDIUM | Multiple sources cite 60-80MB idle. Actual measurement needed during development. |
| No React/Vue | HIGH | View-only dashboard with zero interactive UI. PixiJS renders everything. Adding a framework adds complexity for zero benefit. |

## Sources

- [Electron releases page](https://releases.electronjs.org/) -- Electron 40.6.1 confirmed (HIGH confidence)
- [PixiJS blog: v8.16.0](https://pixijs.com/blog/8.16.0) -- latest version confirmed (HIGH confidence)
- [PixiJS performance tips](https://pixijs.com/7.x/guides/production/performance-tips) -- sprite rendering guidance (HIGH confidence)
- [Tauri GitHub issue #4891](https://github.com/tauri-apps/tauri/issues/4891) -- no hardware acceleration for canvas (HIGH confidence)
- [Tauri GitHub issue #5037](https://github.com/tauri-apps/tauri/issues/5037) -- GPU canvas acceleration bug (HIGH confidence)
- [DoltHub: Electron vs Tauri](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) -- comparison context (MEDIUM confidence)
- [systeminformation npm](https://www.npmjs.com/package/systeminformation) -- v5.31.1, Windows process support (MEDIUM confidence)
- [chokidar GitHub releases](https://github.com/paulmillr/chokidar) -- v4.0.3 / v5.0.0 versions (HIGH confidence)
- [Electron Forge: Why Electron Forge](https://www.electronforge.io/core-concepts/why-electron-forge) -- official recommendation (HIGH confidence)
- [Electron performance guide](https://www.electronjs.org/docs/latest/tutorial/performance) -- optimization strategies (HIGH confidence)
- [Claude Code monitoring docs](https://code.claude.com/docs/en/monitoring-usage) -- OTel support, session data (HIGH confidence)
- [Building a Real-Time Dashboard for Claude Code Sessions](https://www.ksred.com/managing-multiple-claude-code-sessions-building-a-real-time-dashboard/) -- session detection patterns (MEDIUM confidence)
- [PixiJS spritesheet tutorial](https://www.codeandweb.com/texturepacker/tutorials/how-to-create-sprite-sheets-and-animations-with-pixijs) -- sprite animation workflow (HIGH confidence)
- Direct filesystem inspection of `~/.claude/` directory on user's machine -- session file structure (HIGH confidence for current structure, MEDIUM confidence for stability over time)

---
*Stack research for: Agent World -- Animated 2D pixel-art desktop process visualizer*
*Researched: 2026-02-25*
