# Pitfalls Research

**Domain:** Local desktop 2D animated process visualizer (Electron + Canvas + Claude Code session detection)
**Researched:** 2026-02-25
**Confidence:** HIGH (verified via Electron official docs, GitHub issues, local filesystem inspection, and community sources)

## Critical Pitfalls

### Pitfall 1: Electron Idle CPU/Memory Burn Kills "Always-On" Viability

**What goes wrong:**
An Electron app running a continuous canvas animation loop at 60fps consumes 5-15% CPU and 150-300MB RAM permanently. On an always-on widget that users keep running all day, this is unacceptable. Users will notice their fans spinning, laptop battery draining, and eventually close the app or uninstall it. The entire value proposition ("glanceable dashboard") is destroyed if the app is a resource hog.

**Why it happens:**
`requestAnimationFrame` runs at display refresh rate (60fps or higher on modern monitors). Each frame redraws the full canvas. Electron's Chromium renderer keeps the GPU process active. Even when nothing changes visually (all agents idle, no state transitions), the app still burns through full render cycles. Combined with Electron's baseline 100-150MB RAM overhead, this creates a persistent resource drain.

**How to avoid:**
1. **Adaptive frame rate:** Only run rAF at full speed during active animations (agent walking, celebration). When all agents are idle, drop to 2-5fps or pause entirely and re-render only on state change.
2. **Dirty flag rendering:** Track whether any visual state changed since last frame. Skip canvas redraw entirely if nothing moved.
3. **Reduce canvas operations:** Use `clearRect` on only the changed regions, not the entire canvas. Pre-render sprites to offscreen canvases.
4. **Use `powerMonitor` API:** Detect when system is on battery or in power-saver mode and reduce animation quality/frequency.
5. **Target:** Idle CPU should be under 1%, active animation under 5%. RAM under 200MB total.

**Warning signs:**
- Task Manager shows sustained CPU usage above 2% when app is idle
- Laptop fans activate when app is running
- GPU process consuming memory even when nothing is animating
- Battery life noticeably shorter with app running

**Phase to address:**
Phase 1 (foundation). The animation loop architecture must be built with adaptive frame rates from day one. Retrofitting this is a near-rewrite of the render system.

---

### Pitfall 2: Claude Code Session Detection is Fragile -- No Official API Exists

**What goes wrong:**
There is no official, stable API or documented contract for detecting active Claude Code sessions. The session file format (JSONL in `~/.claude/projects/`) is an internal implementation detail that can change between versions. There are no lock files (feature request #19364 is open but stale with no Anthropic response). The process name `claude.exe` exists but tells you nothing about which project or session it belongs to. Building session detection on any of these mechanisms means the app can break silently on any Claude Code update.

**Why it happens:**
Claude Code is a fast-moving product. Its internal file structure (`~/.claude/projects/{encoded-path}/{session-uuid}.jsonl`) is not a public API. The JSONL format includes fields like `type`, `parentUuid`, `sessionId`, `cwd`, `version`, `gitBranch`, and `timestamp`, but these are internal. Session sub-agents live in `{session-uuid}/subagents/agent-{shortId}.jsonl`. None of this is documented as stable. The feature request for session lock files (#19364) was marked stale, suggesting Anthropic hasn't prioritized external tooling hooks.

**How to avoid:**
1. **Layer the detection approach:** Use multiple signals cross-referenced, not a single mechanism:
   - **Process detection:** `tasklist` or `wmic` to find `claude.exe` processes with their PIDs and command lines
   - **File system watching:** Watch `~/.claude/projects/` for new/modified `.jsonl` files (new writes = active session)
   - **JSONL tail reading:** Read last few lines of session files to get latest timestamp and message type
2. **Abstract the detection layer:** Build a `SessionDetector` interface so the implementation can be swapped when Claude Code changes. Never scatter file-path assumptions across the codebase.
3. **Graceful degradation:** If detection fails, show agents in "unknown" state rather than crashing. Display "session detection unavailable" with instructions.
4. **Version-pin awareness:** Log the Claude Code `version` field from JSONL files. When it changes, flag potential detection issues.
5. **File modification time as primary signal:** The simplest, most stable heuristic: if a `.jsonl` file was modified in the last N seconds, that session is active. This survives format changes.

**Warning signs:**
- Session detection stops working after a Claude Code update
- Agents appear/disappear erratically
- Detection reports sessions that ended minutes ago
- Sub-agent sessions not being tracked

**Phase to address:**
Phase 1 (core detection) with a dedicated abstraction layer. This is the highest-risk component of the entire project. Build it first, test it manually, and design for replacement.

---

### Pitfall 3: Blurry Pixel Art from Anti-Aliasing and Non-Integer Scaling

**What goes wrong:**
Pixel art looks blurry, smeared, or has visible sub-pixel artifacts when rendered on canvas. Characters lose their crisp, retro appearance. The entire visual identity of the app is ruined because the spy agents look like smudged blobs instead of sharp pixel art.

**Why it happens:**
Canvas uses bilinear interpolation by default when scaling images. If sprites are drawn at non-integer coordinates (e.g., x=10.5) or scaled to non-integer multiples (e.g., 3.7x), the browser blends adjacent pixels. High-DPI displays (`window.devicePixelRatio > 1`) compound this because the canvas backing store doesn't match CSS pixels unless explicitly handled. CSS `image-rendering` defaults also smooth everything.

**How to avoid:**
1. **Set `imageSmoothingEnabled = false`** on the canvas context before any drawImage call. This forces nearest-neighbor scaling.
2. **CSS `image-rendering: pixelated`** on the canvas element as a fallback.
3. **Integer-only coordinates:** Always `Math.floor()` or `Math.round()` sprite positions before drawing. Never use fractional pixel positions.
4. **Integer scale factors only:** Design sprites at a base size (e.g., 16x16 or 32x32) and scale to exact multiples (2x, 3x, 4x). Calculate the best integer multiple for the window size.
5. **Handle DPI scaling:** Set canvas width/height to `clientWidth * devicePixelRatio` and scale the context, or render at CSS pixel dimensions and accept non-retina crispness.
6. **Sprite sheet alignment:** Ensure all sprites in the sheet are aligned to pixel boundaries with no sub-pixel offsets.

**Warning signs:**
- Sprites look soft or blurry at any zoom level
- Visible "shimmer" when agents walk (sub-pixel position changes)
- Sprites look fine at one window size but blur at another
- Lines between sprite frames visible (sheet misalignment)

**Phase to address:**
Phase 2 (sprite rendering). Must be correct from the first sprite draw call. Set up the canvas context properly in a utility function used everywhere.

---

### Pitfall 4: File Watcher Exhaustion on Windows

**What goes wrong:**
Watching `~/.claude/projects/` for session file changes with `fs.watch` or `chokidar` on Windows can hit file descriptor limits, behave inconsistently, or miss events. Windows `ReadDirectoryChangesW` (the underlying API) has known quirks: it can miss rapid successive changes, report phantom events, or fail silently on network-mapped drives.

**Why it happens:**
Node.js `fs.watch` on Windows uses `ReadDirectoryChangesW` which is event-based but not guaranteed reliable for rapid file writes. Claude Code JSONL files are appended to frequently during active sessions (every API response). If multiple sessions are active, that's multiple files being written to simultaneously. `chokidar` adds a polling fallback but that introduces its own latency and CPU overhead.

**How to avoid:**
1. **Don't watch individual session files for content changes.** Instead, poll file modification times at a reasonable interval (every 2-5 seconds).
2. **Watch the projects directory for new files only** (session creation/deletion), not for content changes within files.
3. **Use `fs.stat` polling** for "is this session still active" checks. It's cheap and reliable.
4. **Batch file operations:** Don't read session files on every change event. Debounce to at most once per second.
5. **Limit watch scope:** Only watch project directories that correspond to detected `claude.exe` processes, not the entire `~/.claude/projects/` tree.

**Warning signs:**
- EMFILE errors in logs
- Session state updates arriving seconds late
- High CPU usage from file watcher polling
- Missing session detection on Windows specifically

**Phase to address:**
Phase 1 (session detection). The file watching strategy must be decided before building the detection system.

---

### Pitfall 5: Electron Transparent/Always-On-Top Window Breaks on Windows

**What goes wrong:**
Combining `transparent: true`, `alwaysOnTop: true`, and `frame: false` in Electron BrowserWindow options triggers known platform bugs on Windows. The window may not render, may lose transparency, or may stop receiving mouse events. DWM (Desktop Window Manager) disabled configurations break transparency entirely.

**Why it happens:**
Electron's transparent window support on Windows depends on DWM composition. Multiple GitHub issues document failures when combining these options (#9357, #5124, #23042). The click-through behavior (`setIgnoreMouseEvents`) has a `forward` option on Windows that partially works but can cause the window to become un-interactable. Transparent windows also can't be resized.

**How to avoid:**
1. **Don't use transparent windows for v1.** Use a regular opaque window with a themed background color. This eliminates an entire class of platform bugs.
2. If transparency is needed later, test on multiple Windows versions and DPI settings before committing.
3. **For always-on-top:** Use `win.setAlwaysOnTop(true, 'screen-saver')` level for maximum stickiness, but provide a user toggle.
4. **For frameless:** Use `frame: false` with a custom title bar for drag behavior. This is well-supported.
5. **Avoid click-through:** The project is view-only anyway, so a normal always-on-top window is sufficient.

**Warning signs:**
- Window appears blank/black on some machines
- Transparency works on dev machine but not others
- Window becomes unresponsive to OS window management (can't alt-tab away, can't minimize)
- Visual artifacts on window edges

**Phase to address:**
Phase 1 (Electron window setup). Make the conscious decision to skip transparency early and avoid the rabbit hole entirely.

---

### Pitfall 6: Spawning `tasklist`/`wmic` Commands Blocks the Event Loop

**What goes wrong:**
Using `child_process.execSync` or even frequent `child_process.exec` calls to run `tasklist` or `wmic` for process detection creates performance problems. On Windows, `child_process.execFile` can be 100-200x slower than on macOS/Linux (documented Node.js issue #21632). Spawning a process every 2 seconds to check for Claude sessions can cause visible animation stutters.

**Why it happens:**
Windows process creation is inherently expensive (CreateProcess syscall). `wmic` has additional overhead as it initializes a WMI connection each invocation. `tasklist` is faster but still spawns a full process. The output parsing (stdout as text) adds garbage collection pressure. If done synchronously, the entire Electron main process and renderer freeze.

**How to avoid:**
1. **Never use synchronous process spawning.** Always use `child_process.exec` (async) and handle callbacks.
2. **Cache process results aggressively.** Poll at most every 5-10 seconds for process list changes. Sessions don't start/stop that frequently.
3. **Use `tasklist` over `wmic`:** It's significantly faster for simple process enumeration.
4. **Consider native addon:** A Node.js native addon using Windows API directly (`EnumProcesses`, `OpenProcess`) would be 10-100x faster than spawning CLI tools. But this adds build complexity. Only worth it if polling proves too slow.
5. **Run process detection in the main process, not the renderer.** Use IPC to send results to the renderer for display. This keeps animations smooth even during detection.

**Warning signs:**
- Animation stutters every N seconds (correlating with poll interval)
- High "shell" process count in Task Manager
- Noticeable delay between starting Claude Code and agent appearing
- `wmic` processes piling up if previous ones haven't finished

**Phase to address:**
Phase 1 (process detection). Must be async from the start. Set performance budget: detection poll should complete in under 100ms.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-coding `~/.claude/projects/` path | Quick session detection | Breaks if Claude Code changes storage location | MVP only -- abstract behind config constant by Phase 2 |
| Polling process list instead of file watching | Simpler, more reliable on Windows | Higher CPU usage than event-driven approach | Acceptable long-term if poll interval is >= 5s |
| Full canvas redraw every frame | Simple render loop | 5-10x more CPU than dirty-region rendering | Never -- build dirty flagging from the start |
| Single-file app architecture | Faster initial development | Impossible to maintain past 1000 lines | Never -- use module boundaries from Phase 1 |
| Embedding sprites as base64 in JS | No asset loading complexity | Bloated bundle, can't hot-swap assets | MVP only -- move to sprite sheet files by Phase 2 |
| Skipping Electron auto-updater | No update infrastructure needed | Users stuck on broken versions | Acceptable for personal tool, not for distribution |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code JSONL files | Parsing entire file on every check | Read only last N bytes (tail read) or check `fs.stat` mtime |
| Claude Code JSONL files | Assuming file is complete JSON | Files are JSONL (one JSON object per line). Incomplete last line during active write. Always try/catch JSON.parse per line |
| Claude Code JSONL files | Reading file while Claude is writing | Use shared-read file access flags. On Windows, `fs.open` with `r` flag should work since Claude appends. But handle EBUSY errors gracefully |
| Claude Code process detection | Matching process name only (`claude.exe`) | Also check command line args via WMIC to distinguish sessions. The `--dangerously-skip-permissions` flag and working directory vary per session |
| Claude Code sub-agents | Ignoring sub-agent JSONL files | Sub-agents live in `{session-uuid}/subagents/agent-{shortId}.jsonl`. A session with 4 sub-agents means 4 active "workers" you might want to visualize |
| Electron IPC | Sending large objects between main and renderer | Serialize to minimal data. Don't send raw JSONL content over IPC. Extract only: session ID, project name, status, last activity timestamp |
| Windows path encoding | Using forward slashes in fs operations | Claude Code uses hyphens as separators in encoded project paths (e.g., `C--Users-dlaws-Projects-Agent-World`). Use this encoding when looking up project directories |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 60fps canvas render with no dirty checking | Constant 10-15% CPU usage even when idle | Implement dirty flag system; only render on state change | Immediately -- this is noticeable from launch |
| Reading entire JSONL file to get session status | Disk I/O spike every poll, growing with session length | Read only last 1KB of file, or rely on `fs.stat` mtime | When sessions exceed ~1MB (about 30 minutes of active use) |
| Spawning `wmic` for each detection cycle | 200-500ms blocking per poll on Windows | Use `tasklist` (faster), cache results, poll at 5-10s interval | Immediately -- wmic is slow on first call |
| Creating new Image objects for sprites each frame | Memory churn, GC pauses causing frame drops | Pre-load all sprites once at startup into offscreen canvases | At 5+ agents with multiple animation frames |
| Watching all files in ~/.claude recursively | File descriptor exhaustion, high CPU from watcher | Watch only specific project directories, use polling for content | At 5+ active project directories |
| Unbounded event listener registration | Memory leak growing over hours/days | Use `removeListener` in cleanup. Track listener count in dev mode | After ~4 hours of continuous use |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Reading Claude Code credential files | Accidental exposure of API keys if app logs are shared | Only read `.jsonl` session files. Never touch `.credentials.json` or `settings.json`. Explicitly blocklist these paths |
| Exposing session content in UI | Someone screen-sharing could leak code/prompts shown in speech bubbles | Speech bubbles should show activity type ("Writing code", "Reading file"), never actual content from JSONL message fields |
| Electron nodeIntegration: true | Full system access from renderer, XSS-equivalent risk | Use `contextBridge` and `preload` scripts. Disable `nodeIntegration`. Only expose the specific IPC channels needed |
| Running with elevated privileges | App requests admin unnecessarily, creating attack surface | Never require admin. Process detection and file reading work fine as current user |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Agent pops in/out on every poll cycle | Flickering, unreliable visualization | Require 2 consecutive "absent" polls before removing an agent. Add fade-in/fade-out transitions (300ms) |
| No indication of detection status | User doesn't know if app is working or broken | Show subtle "monitoring..." indicator. Show last-detected timestamp. Flash indicator when a poll succeeds |
| Agents overlap when window is small | Unreadable when 4+ sessions are active | Implement basic layout algorithm with non-overlapping zones. Scale sprites down if needed |
| Animation too fast/distracting for peripheral vision | User's eye is constantly drawn to the widget instead of their work | Keep idle animations minimal (breathing, blinking). Reserve movement for status changes. Offer animation intensity setting |
| Session shows wrong project name | Confusion about which agent is which | Extract project name from the encoded directory path (e.g., `C--Users-dlaws-Projects-Agent-World` --> `Agent World`). Verify against JSONL cwd field |
| Stale agents after Claude Code crash | Dead agents remain "active" forever | Implement timeout: if no JSONL writes for 60+ seconds on an "active" session, transition to "stale" state. Auto-remove after 5 minutes |

## "Looks Done But Isn't" Checklist

- [ ] **Canvas rendering:** Sprites look crisp at default size but verify at 2x, 3x, and non-standard DPI (125%, 150%, 175% Windows scaling)
- [ ] **Session detection:** Works with 1 session but verify with 4+ simultaneous sessions across different projects
- [ ] **Memory stability:** App works for 5 minutes but verify after 4+ hours continuous run. Check Task Manager for steady memory growth (leak)
- [ ] **Process polling:** Works when Claude sessions are already running but verify detection of new sessions starting after the app is already open
- [ ] **Window management:** App displays correctly but verify it works after sleep/wake, monitor disconnect/reconnect, and resolution changes
- [ ] **File access:** JSONL reading works but verify it handles the file being written to simultaneously (shared access on Windows)
- [ ] **Sub-agent detection:** Main sessions are detected but verify sub-agent sessions in `{uuid}/subagents/` are also tracked
- [ ] **Path encoding:** Session lookup works for simple paths but verify with paths containing spaces, special characters, and deep nesting
- [ ] **Cleanup on exit:** App closes cleanly but verify no orphaned processes (Electron GPU process, file watchers) remain after closing

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Canvas rendering blurry | LOW | Add `imageSmoothingEnabled = false` and `image-rendering: pixelated`. Round all coordinates to integers. Can be fixed in a single commit |
| Session detection breaks after Claude update | MEDIUM | If abstracted properly, swap detection implementation. If hard-coded paths are scattered, requires audit of all file access points |
| Memory leak from timers/listeners | MEDIUM | Profile with Chrome DevTools heap snapshots. Find and clear leaked intervals/listeners. Add cleanup to component teardown |
| Always-on CPU burn | HIGH | Requires rewriting render loop with dirty flagging and adaptive frame rate. If built wrong initially, touches every animation and state update |
| Transparent window bugs on Windows | LOW | Remove transparency, use opaque themed background. Simple config change if not deeply integrated |
| Process detection too slow | MEDIUM | Switch from wmic to tasklist, increase poll interval, add caching layer. May require native addon if still too slow |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Idle CPU/Memory burn | Phase 1 (render loop architecture) | Run app for 1 hour idle, verify CPU < 1% and RAM stable |
| Session detection fragility | Phase 1 (core detection) | Manually test with 0, 1, 2, 4 sessions. Kill claude.exe and verify cleanup |
| Blurry pixel art | Phase 2 (sprite system) | Visual inspection at 100%, 125%, 150%, 200% Windows DPI |
| File watcher exhaustion | Phase 1 (file monitoring) | Run with 5+ project directories. Check file descriptor count |
| Transparent window bugs | Phase 1 (window setup) | Decision: skip transparency. Verify opaque window works on Windows 10 and 11 |
| Process spawn blocking | Phase 1 (process detection) | Measure detection poll duration. Must be < 100ms. Test with animation running |
| Memory leaks long-running | Phase 3 (polish) | 8-hour soak test. Heap snapshot comparison at 1h, 4h, 8h |
| JSONL parsing during active write | Phase 1 (session reading) | Start reading a session file while Claude is actively responding |
| Agent flicker on poll boundaries | Phase 2 (state management) | Rapidly start/stop Claude sessions, verify no visual flicker |
| Stale agent cleanup | Phase 2 (state management) | Kill claude.exe forcefully, verify agent transitions to stale then disappears |

## Sources

- [Electron Performance Documentation](https://www.electronjs.org/docs/latest/tutorial/performance) - Official performance guidelines (HIGH confidence)
- [Electron GitHub Issue #9567](https://github.com/electron/electron/issues/9567) - backgroundThrottling and requestAnimationFrame (HIGH confidence)
- [Electron GitHub Issue #11908](https://github.com/electron/electron/issues/11908) - High CPU while idling (HIGH confidence)
- [Electron GitHub Issue #9357](https://github.com/electron/electron/issues/9357) - alwaysOnTop + transparent window bugs (HIGH confidence)
- [Electron GitHub Issue #23042](https://github.com/electron/electron/issues/23042) - Click-through transparent window regression (HIGH confidence)
- [MDN Canvas Optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Canvas performance best practices (HIGH confidence)
- [MDN Crisp Pixel Art](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look) - image-rendering pixelated (HIGH confidence)
- [web.dev Canvas Performance](https://web.dev/canvas-performance/) - Offscreen canvas, dirty regions (HIGH confidence)
- [Claude Code Issue #19364](https://github.com/anthropics/claude-code/issues/19364) - Session lock file feature request (HIGH confidence - verified open/stale)
- [Claude Code Issue #11122](https://github.com/anthropics/claude-code/issues/11122) - Multiple CLI processes CPU accumulation (HIGH confidence)
- [Claude Code Process Exhaustion Bug](https://shivankaul.com/blog/claude-code-process-exhaustion) - Process forking cascade (MEDIUM confidence)
- [Node.js Issue #21632](https://github.com/nodejs/node/issues/21632) - child_process dramatically slower on Windows (HIGH confidence)
- [Chokidar Issue #1155](https://github.com/paulmillr/chokidar/issues/1155) - EMFILE too many open files (MEDIUM confidence)
- Local filesystem inspection of `~/.claude/projects/` structure (HIGH confidence - verified on this machine)
- Local `tasklist` and `wmic` output for `claude.exe` process detection (HIGH confidence - verified on this machine)

---
*Pitfalls research for: Agent World -- Local desktop 2D animated Claude Code session visualizer*
*Researched: 2026-02-25*
