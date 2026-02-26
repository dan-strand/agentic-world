---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - assets/sounds/ready-to-work.mp3
  - src/shared/constants.ts
  - src/renderer/sound-manager.ts
  - src/renderer/world.ts
autonomous: true
requirements: [QUICK-5]

must_haves:
  truths:
    - "After a session is idle for 1 minute, the ready-to-work sound plays once"
    - "The sound does NOT repeat every minute -- it plays exactly once per idle period"
    - "If the session becomes active and then goes idle again, the sound plays again after a fresh 1-minute wait"
    - "The sound respects existing mute and volume controls"
  artifacts:
    - path: "assets/sounds/ready-to-work.mp3"
      provides: "Ready-to-work reminder sound file"
    - path: "src/shared/constants.ts"
      provides: "IDLE_REMINDER_MS constant (60000)"
      contains: "IDLE_REMINDER_MS"
    - path: "src/renderer/sound-manager.ts"
      provides: "playReminder() method using separate Audio element"
      exports: ["playReminder"]
    - path: "src/renderer/world.ts"
      provides: "Reminder tracking with hasPlayedReminder Map and timer integration in tick()"
      contains: "hasPlayedReminder"
  key_links:
    - from: "src/renderer/world.ts"
      to: "src/renderer/sound-manager.ts"
      via: "SoundManager.getInstance().playReminder() call in tick()"
      pattern: "playReminder"
    - from: "src/renderer/world.ts"
      to: "src/shared/constants.ts"
      via: "IDLE_REMINDER_MS import"
      pattern: "IDLE_REMINDER_MS"
---

<objective>
Play a "ready to work" reminder sound when a session has been idle (waiting for user input) for 1 minute. The sound plays once per idle period, resets when the session becomes active, and respects existing volume/mute controls.

Purpose: Audible notification so the user knows a Claude session needs attention without constantly watching the world.
Output: Sound file bundled, SoundManager extended, idle reminder tracking in World tick loop.
</objective>

<execution_context>
@C:/Users/dlaws/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/dlaws/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/renderer/sound-manager.ts
@src/renderer/world.ts
@src/shared/constants.ts

<interfaces>
<!-- Existing interfaces the executor needs -->

From src/shared/constants.ts:
```typescript
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutes -- existing fade-out timeout
```

From src/renderer/sound-manager.ts:
```typescript
export class SoundManager {
  private static instance: SoundManager;
  private audio: HTMLAudioElement;         // Currently only jobs-done.mp3
  private _volume: number;                 // 0..1
  private _muted: boolean;
  static getInstance(): SoundManager;
  play(): void;                            // Plays jobs-done sound
  set volume(v: number);
  get volume(): number;
  toggleMute(): void;
  get muted(): boolean;
}
```

From src/renderer/world.ts (relevant tracking Maps):
```typescript
private idleTimers: Map<string, number> = new Map();           // existing 5-min fade-out tracking
private lastCommittedStatus: Map<string, SessionStatus> = new Map();
// These are the patterns to follow for the new reminder tracking
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Copy sound file and add constant</name>
  <files>
    assets/sounds/ready-to-work.mp3
    src/shared/constants.ts
  </files>
  <action>
    1. Copy `ready-to-work.mp3` from the project root to `assets/sounds/ready-to-work.mp3`. The CopyWebpackPlugin in webpack.renderer.config.ts copies the entire `assets/` directory to the renderer output, so placing it here is sufficient for bundling (same pattern as jobs-done.mp3).

    2. In `src/shared/constants.ts`, add a new constant near the existing `IDLE_TIMEOUT_MS` line (line 155):
    ```typescript
    export const IDLE_REMINDER_MS = 60 * 1000;      // 1 minute of idle before "ready to work" reminder sound
    ```
  </action>
  <verify>
    ls assets/sounds/ready-to-work.mp3 && grep "IDLE_REMINDER_MS" src/shared/constants.ts
  </verify>
  <done>Sound file exists at assets/sounds/ready-to-work.mp3. IDLE_REMINDER_MS constant exported from constants.ts with value 60000.</done>
</task>

<task type="auto">
  <name>Task 2: Extend SoundManager with playReminder() and add idle reminder tracking to World</name>
  <files>
    src/renderer/sound-manager.ts
    src/renderer/world.ts
  </files>
  <action>
    **SoundManager changes (src/renderer/sound-manager.ts):**

    Add a second HTMLAudioElement for the reminder sound. The SoundManager currently has a single `audio` field for jobs-done.mp3. Rename it for clarity and add the new one:

    1. Rename `private audio` to `private jobsDoneAudio` (update all references in constructor, play(), volume setter, toggleMute()).
    2. Add `private reminderAudio: HTMLAudioElement;` field.
    3. In constructor, initialize: `this.reminderAudio = new Audio('assets/sounds/ready-to-work.mp3');` and set `this.reminderAudio.volume = this._volume;`.
    4. Add method:
    ```typescript
    /** Play the ready-to-work reminder sound. Restarts if already playing. */
    playReminder(): void {
      if (this._muted) return;
      this.reminderAudio.currentTime = 0;
      this.reminderAudio.play().catch(() => {
        // Ignore autoplay policy errors
      });
    }
    ```
    5. Update `set volume(v: number)` to also set `this.reminderAudio.volume = this._volume;`.
    6. Update `toggleMute()` to also set `this.reminderAudio.muted = this._muted;`.

    **World changes (src/renderer/world.ts):**

    1. Add import: `IDLE_REMINDER_MS` to the existing import from `'../shared/constants'` (line 7-13).

    2. Add a new tracking Map alongside the existing `idleTimers` (around line 84):
    ```typescript
    // Track whether the idle reminder sound has already played for each agent's current idle period
    private hasPlayedReminder: Map<string, boolean> = new Map();
    ```

    3. In the `tick()` method, inside the existing idle timeout block (lines 208-221), add the reminder check BEFORE the existing fade-out check. The logic goes inside the `if (committed === 'idle' && agent.getState() !== 'fading_out')` block, after updating `idleTimers` but before the fade-out threshold check:

    The existing block (lines 209-221) currently reads:
    ```typescript
    if (committed === 'idle' && agent.getState() !== 'fading_out') {
      const prev = this.idleTimers.get(agent.sessionId) ?? 0;
      const next = prev + deltaMs;
      this.idleTimers.set(agent.sessionId, next);
      if (next >= IDLE_TIMEOUT_MS) {
        agent.startFadeOut();
        this.idleTimers.delete(agent.sessionId);
      }
    } else {
      // Not idle or already fading -- reset timer
      this.idleTimers.delete(agent.sessionId);
    }
    ```

    Modify it to:
    ```typescript
    if (committed === 'idle' && agent.getState() !== 'fading_out') {
      const prev = this.idleTimers.get(agent.sessionId) ?? 0;
      const next = prev + deltaMs;
      this.idleTimers.set(agent.sessionId, next);

      // Play reminder sound once after 1 minute of continuous idle
      if (next >= IDLE_REMINDER_MS && !this.hasPlayedReminder.get(agent.sessionId)) {
        SoundManager.getInstance().playReminder();
        this.hasPlayedReminder.set(agent.sessionId, true);
      }

      if (next >= IDLE_TIMEOUT_MS) {
        agent.startFadeOut();
        this.idleTimers.delete(agent.sessionId);
        this.hasPlayedReminder.delete(agent.sessionId);
      }
    } else {
      // Not idle or already fading -- reset timer and reminder flag
      this.idleTimers.delete(agent.sessionId);
      this.hasPlayedReminder.delete(agent.sessionId);
    }
    ```

    The key behavior:
    - `hasPlayedReminder` starts as absent/false for each agent.
    - When idleTimers reaches 1 minute AND hasPlayedReminder is not true, play the sound and set the flag.
    - The flag prevents repeated plays during the same idle period.
    - When the agent becomes active (else branch), BOTH the timer and flag reset, allowing the sound to play again on the next idle period.

    4. Clean up `hasPlayedReminder` in the `removeAgent()` method (add after line 318, alongside other Map deletions):
    ```typescript
    this.hasPlayedReminder.delete(sessionId);
    ```

    5. Clean up `hasPlayedReminder` in the `manageAgents()` cleanup loop (around line 469, alongside other Map deletions for removed sessions):
    ```typescript
    this.hasPlayedReminder.delete(sessionId);
    ```
  </action>
  <verify>
    Run `npx tsc --noEmit` to confirm no type errors. Then grep for key patterns:
    - `grep "playReminder" src/renderer/sound-manager.ts` shows method definition
    - `grep "hasPlayedReminder" src/renderer/world.ts` shows Map declaration, set/get/delete calls
    - `grep "IDLE_REMINDER_MS" src/renderer/world.ts` shows import and usage
  </verify>
  <done>
    SoundManager has playReminder() method with separate Audio element for ready-to-work.mp3. Volume and mute controls apply to both sounds. World tracks hasPlayedReminder per agent, plays sound once at 1-minute idle threshold, resets flag when agent becomes active. All cleanup paths (removeAgent, manageAgents session cleanup) delete the hasPlayedReminder entry. TypeScript compiles cleanly.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` -- zero type errors
2. `ls assets/sounds/ready-to-work.mp3` -- file exists
3. `grep -c "playReminder" src/renderer/sound-manager.ts` -- at least 2 (declaration + body)
4. `grep -c "hasPlayedReminder" src/renderer/world.ts` -- at least 5 (declaration, set true, get check, delete in else, delete in removeAgent, delete in cleanup)
5. `grep "IDLE_REMINDER_MS" src/shared/constants.ts` -- constant defined
</verification>

<success_criteria>
- ready-to-work.mp3 is bundled in assets/sounds/ (webpack copies it automatically)
- After 1 minute of continuous committed-idle status, SoundManager.playReminder() fires exactly once
- Sound does NOT repeat during the same idle period (hasPlayedReminder flag prevents it)
- When agent becomes active (idle timer resets), the flag clears -- enabling the sound on the next idle period
- Volume slider and mute toggle affect the reminder sound identically to the jobs-done sound
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/5-play-ready-to-work-sound-after-session-i/5-SUMMARY.md`
</output>
