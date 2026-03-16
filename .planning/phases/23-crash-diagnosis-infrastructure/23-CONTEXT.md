# Phase 23: Crash Diagnosis Infrastructure - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add crash event handlers, error boundaries, persistent logging, and memory health monitoring so that no failure is ever silent again. This phase is purely diagnostic infrastructure — it captures and logs problems but does not fix the underlying leaks (that's Phase 24).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User delegated all implementation decisions to Claude. The following are Claude's recommended approaches based on codebase analysis and research findings:

**Log file behavior:**
- Log to `~/.agent-world/crash.log` (follows existing `~/.agent-world/` pattern from HistoryStore)
- Use `electron-log` (^5.4) for persistent file logging — replaces console.log in main process
- Append-only format with ISO timestamps and stack traces
- Rotate/truncate at reasonable size to prevent unbounded growth
- Both main process and renderer crashes logged to same file

**Error recovery in game loop:**
- Wrap `world.tick()` in try/catch — log exception, continue ticking
- If same error repeats rapidly (e.g., 5x in 10 seconds), stop the ticker and log a critical error rather than spam
- No UI indicator for caught exceptions — just log silently. Dashboard indicators are a future concern.

**Memory monitoring:**
- Sample heap stats every 60 seconds using `process.memoryUsage()` (renderer) and `process.getHeapStatistics()` (main)
- Log a warning entry when heap grows >50MB over a 10-minute window (sustained trend, not spike)
- Memory stats appended to the crash log file
- No dashboard visibility — just logged for post-crash diagnosis

**Crash-on-restart behavior:**
- On startup, check if crash.log has entries from the last run
- Log a console message noting the previous crash (developer convenience)
- No user-facing notification — keep it simple, this is diagnostic infrastructure

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Research identified `electron-log` and `electron-unhandled` as the two npm additions needed. Built-in Electron APIs (`crashReporter`, `render-process-gone`, `process.memoryUsage()`) cover the rest.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HistoryStore` (`src/main/history-store.ts`): Established `~/.agent-world/` data directory pattern with atomic writes and Windows-safe fallback
- `app.getPath('userData')` already used for HistoryStore — consistent path resolution

### Established Patterns
- `console.log('[main]')` / `console.log('[renderer]')` prefix pattern for process identification
- `mainWindow.webContents.on('console-message')` bridges renderer logs to main stdout
- `app.on('before-quit')` cleanup handler exists — can be extended for log flushing

### Integration Points
- `src/main/index.ts`: Add `render-process-gone` handler on `mainWindow.webContents`, add `process.on('uncaughtException')`, initialize crash logging
- `src/renderer/game-loop.ts:28`: Wrap `this.world.tick(ticker.deltaMS)` in try/catch error boundary
- `src/renderer/index.ts`: Add `window.onerror` and `window.onunhandledrejection` handlers
- Preload script: Bridge renderer errors to main process via IPC for centralized logging

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-crash-diagnosis-infrastructure*
*Context gathered: 2026-03-16*
