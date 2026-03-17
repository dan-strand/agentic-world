---
phase: quick-8
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/main/index.ts
  - src/preload/preload.ts
  - src/shared/types.ts
  - src/renderer/index.ts
autonomous: true
requirements: [QUICK-8]
must_haves:
  truths:
    - "Audio sounds play when the window is behind other windows (not focused but not minimized)"
    - "Audio sounds play when the window is minimized"
    - "Ticker continues running when window loses focus but is not minimized"
    - "Ticker stops when window is actually minimized (CPU savings preserved)"
    - "No audio plays when muted, regardless of window focus state"
  artifacts:
    - path: "src/main/index.ts"
      provides: "backgroundThrottling: false in webPreferences, IPC forwarding of minimize/restore events"
      contains: "backgroundThrottling"
    - path: "src/shared/types.ts"
      provides: "IPC channel constants for window-minimized and window-restored"
    - path: "src/preload/preload.ts"
      provides: "onWindowMinimized and onWindowRestored callbacks exposed to renderer"
    - path: "src/renderer/index.ts"
      provides: "Uses IPC minimize/restore events instead of visibilitychange"
  key_links:
    - from: "src/main/index.ts"
      to: "src/preload/preload.ts"
      via: "IPC send on BrowserWindow minimize/restore events"
      pattern: "mainWindow\\.on.*minimize"
    - from: "src/preload/preload.ts"
      to: "src/renderer/index.ts"
      via: "onWindowMinimized/onWindowRestored callbacks"
      pattern: "onWindowMinimized|onWindowRestored"
---

<objective>
Fix audio not playing when the Agent World window does not have focus.

Purpose: The app is a monitoring tool meant to run in the background. Sound notifications for session completion and idle reminders are core functionality that must work regardless of window focus state. Currently, two issues prevent this: (1) Chromium's backgroundThrottling suppresses audio playback when the window is not visible, and (2) the visibilitychange API stops the game ticker on focus loss (not just minimize), preventing status transitions that trigger sounds.

Output: Audio plays reliably when window is unfocused or minimized. Ticker only stops on actual minimize, not on focus loss.
</objective>

<execution_context>
@C:/Users/dlaws/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/dlaws/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/main/index.ts
@src/preload/preload.ts
@src/shared/types.ts
@src/renderer/index.ts
@src/renderer/game-loop.ts
@src/renderer/sound-manager.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Disable background throttling and add IPC minimize/restore events</name>
  <files>src/main/index.ts, src/shared/types.ts, src/preload/preload.ts</files>
  <action>
Three changes across three files:

1. **src/main/index.ts** -- In the `createWindow` function, add `backgroundThrottling: false` to the `webPreferences` object (alongside `contextIsolation`, `nodeIntegration`, etc.). This prevents Chromium from throttling timers and audio when the window is not visible.

   After `mainWindow.loadURL(...)`, add event listeners on the BrowserWindow for native minimize/restore events that forward to the renderer via IPC:
   ```
   mainWindow.on('minimize', () => {
     mainWindow.webContents.send('window-minimized');
   });
   mainWindow.on('restore', () => {
     mainWindow.webContents.send('window-restored');
   });
   ```

2. **src/shared/types.ts** -- Add two new constants to the `IPC_CHANNELS` object:
   ```
   WINDOW_MINIMIZED: 'window-minimized',
   WINDOW_RESTORED: 'window-restored',
   ```
   Add two new methods to the `IAgentWorldAPI` interface:
   ```
   onWindowMinimized: (callback: () => void) => void;
   onWindowRestored: (callback: () => void) => void;
   ```

3. **src/preload/preload.ts** -- Add two new methods to the contextBridge exposed API:
   ```
   onWindowMinimized: (callback: () => void): void => {
     ipcRenderer.on(IPC_CHANNELS.WINDOW_MINIMIZED, () => callback());
   },
   onWindowRestored: (callback: () => void): void => {
     ipcRenderer.on(IPC_CHANNELS.WINDOW_RESTORED, () => callback());
   },
   ```

   Also update the IPC channel references in `mainWindow.on` handlers in index.ts to use `IPC_CHANNELS.WINDOW_MINIMIZED` and `IPC_CHANNELS.WINDOW_RESTORED` instead of raw strings.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>backgroundThrottling is false in webPreferences. BrowserWindow emits IPC events on minimize/restore. Preload exposes callbacks to renderer. Types are consistent across all three files. TypeScript compiles cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Switch renderer from visibilitychange to IPC minimize/restore</name>
  <files>src/renderer/index.ts</files>
  <action>
In `src/renderer/index.ts`, replace the `visibilitychange` event listener block (lines 95-102):

```typescript
// 5. Handle minimize/restore for adaptive frame rate (window is fixed-size, no resize handler needed)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    gameLoop.onWindowMinimized();
  } else {
    gameLoop.onWindowRestored();
  }
});
```

With IPC-based listeners that only fire on actual minimize/restore, NOT on focus loss:

```typescript
// 5. Handle minimize/restore for adaptive frame rate
// Uses Electron IPC (not visibilitychange) so the ticker keeps running when
// window loses focus but is NOT minimized -- critical for background audio.
window.agentWorld.onWindowMinimized(() => {
  gameLoop.onWindowMinimized();
});
window.agentWorld.onWindowRestored(() => {
  gameLoop.onWindowRestored();
});
```

This ensures:
- When window is behind other windows (unfocused): ticker keeps running, status transitions fire, sounds play (backgroundThrottling: false allows audio).
- When window is actually minimized: ticker stops for CPU savings (same as before).
- When window is restored from minimized: ticker resumes (same as before).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>visibilitychange listener is removed. IPC-based minimize/restore listeners are wired. Ticker only pauses on actual minimize. Window losing focus (going behind another window) does NOT stop the ticker or suppress audio.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` compiles without errors
2. Manual test: Start the app, trigger a session completion sound, then put another window in front of Agent World. The completion/idle sounds should still play when a session transitions status.
3. Manual test: Minimize Agent World to taskbar. When restored, the world should resume rendering normally.
</verification>

<success_criteria>
- Audio notification sounds play when the window is behind other windows (unfocused but not minimized)
- Audio notification sounds play when the window is minimized (backgroundThrottling disabled)
- The game ticker continues running when the window loses focus (not minimized) so status transitions and sound triggers process
- The game ticker stops when the window is actually minimized (CPU savings preserved)
- Mute control still prevents audio regardless of focus state
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/8-when-the-window-doesn-t-have-focus-it-no/8-SUMMARY.md`
</output>
