---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - assets/sounds/jobs-done.mp3
  - src/renderer/sound-manager.ts
  - src/renderer/world.ts
  - src/renderer/index.html
  - src/renderer/index.ts
autonomous: true
requirements: [QUICK-3]

must_haves:
  truths:
    - "Sound plays when an agent completes a job (active->idle celebration)"
    - "Volume slider controls the sound volume in real time"
    - "Mute button silences the sound, unmute restores previous volume"
    - "Volume/mute settings persist visually (slider position reflects volume)"
  artifacts:
    - path: "assets/sounds/jobs-done.mp3"
      provides: "Sound file in bundled assets directory"
    - path: "src/renderer/sound-manager.ts"
      provides: "Singleton audio manager with play/volume/mute API"
      exports: ["SoundManager"]
    - path: "src/renderer/index.html"
      provides: "Volume slider and mute button UI overlay"
      contains: "audio-controls"
    - path: "src/renderer/world.ts"
      provides: "Sound trigger on celebration"
      contains: "SoundManager"
  key_links:
    - from: "src/renderer/world.ts"
      to: "src/renderer/sound-manager.ts"
      via: "SoundManager.getInstance().play() at celebration trigger"
      pattern: "SoundManager\\.getInstance\\(\\)\\.play"
    - from: "src/renderer/index.ts"
      to: "src/renderer/sound-manager.ts"
      via: "Wire volume slider and mute button to SoundManager"
      pattern: "SoundManager\\.getInstance\\(\\)"
---

<objective>
Add a "job's done" sound effect that plays when agents celebrate (active->idle completion), plus a small volume slider and mute toggle button overlaid on the app window.

Purpose: Audio feedback makes job completions more noticeable, especially when the app is in peripheral vision. Volume controls let the user tune it to their preference or silence it entirely.
Output: Sound plays on celebration, UI controls volume/mute.
</objective>

<execution_context>
@C:/Users/dlaws/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/dlaws/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/renderer/world.ts (celebration trigger at line 197 — agent.startCelebration())
@src/renderer/index.ts (renderer entry — wire UI controls here)
@src/renderer/index.html (HTML template — add overlay controls)
@webpack.renderer.config.ts (CopyWebpackPlugin copies assets/ to build)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Copy sound file to assets and create SoundManager</name>
  <files>
    assets/sounds/jobs-done.mp3
    src/renderer/sound-manager.ts
  </files>
  <action>
1. Copy the sound file from the project root into the assets directory so webpack bundles it:
   - Create `assets/sounds/` directory
   - Copy `jobs-done_1-made-with-Voicemod.mp3` to `assets/sounds/jobs-done.mp3`

2. Create `src/renderer/sound-manager.ts` — a singleton class managing HTML Audio playback:

```typescript
/**
 * SoundManager -- Singleton for playing sound effects with volume/mute control.
 * Uses HTML5 Audio API (simple, sufficient for single sound effects).
 */
export class SoundManager {
  private static instance: SoundManager;
  private audio: HTMLAudioElement;
  private _volume = 0.5;   // 0..1, default 50%
  private _muted = false;

  private constructor() {
    // Webpack CopyWebpackPlugin copies assets/ into the renderer output directory.
    // The renderer runs from .webpack/renderer/main_window/ so the sound is at assets/sounds/jobs-done.mp3
    // relative to the HTML file's location.
    this.audio = new Audio('assets/sounds/jobs-done.mp3');
    this.audio.volume = this._volume;
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /** Play the job completion sound. Restarts if already playing. */
  play(): void {
    if (this._muted) return;
    this.audio.currentTime = 0;
    this.audio.play().catch(() => {
      // Ignore autoplay policy errors — user interaction will have occurred by this point
    });
  }

  /** Set volume (0..1). Updates audio element immediately. */
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.audio.volume = this._volume;
  }

  get volume(): number {
    return this._volume;
  }

  /** Toggle mute state. When unmuting, restores previous volume. */
  toggleMute(): void {
    this._muted = !this._muted;
    this.audio.muted = this._muted;
  }

  get muted(): boolean {
    return this._muted;
  }
}
```

Key decisions:
- HTML5 Audio API, not Web Audio API — simpler, sufficient for a single sound effect
- Singleton pattern matches how World and index.ts both need access
- `play()` resets currentTime so rapid celebrations don't queue up silence
- Mute uses `audio.muted` (preserves volume slider position separate from mute state)
  </action>
  <verify>
    Verify file copied: `ls assets/sounds/jobs-done.mp3` exists.
    Verify TypeScript compiles: `npx tsc --noEmit src/renderer/sound-manager.ts` (or full build check).
  </verify>
  <done>Sound file exists at assets/sounds/jobs-done.mp3. SoundManager class exports singleton with play(), volume, muted, toggleMute() API.</done>
</task>

<task type="auto">
  <name>Task 2: Wire sound to celebration trigger and add UI controls</name>
  <files>
    src/renderer/world.ts
    src/renderer/index.html
    src/renderer/index.ts
  </files>
  <action>
1. **world.ts** — Import SoundManager and play sound on celebration.

   At the top, add import:
   ```typescript
   import { SoundManager } from './sound-manager';
   ```

   In the `tick()` method, find the block around line 193-199 where `checkForCompletion` returns true and `agent.startCelebration()` is called. Right after `agent.startCelebration()` (line 197), add:
   ```typescript
   SoundManager.getInstance().play();
   ```

   This ensures sound plays exactly when the celebration visual begins. The sound should be inside the same `if` block as `startCelebration()`, NOT outside it — it must only play when celebration actually starts.

2. **index.html** — Add audio controls overlay. Place this right after the `#drag-region` div and before `#app`:

   ```html
   <div id="audio-controls">
     <button id="btn-mute" title="Mute/Unmute">&#x1F50A;</button>
     <input type="range" id="volume-slider" min="0" max="100" value="50" title="Volume" />
   </div>
   ```

   Add CSS for `#audio-controls` in the `<style>` block:
   ```css
   #audio-controls {
     position: fixed;
     bottom: 8px;
     right: 8px;
     z-index: 9999;
     display: flex;
     align-items: center;
     gap: 4px;
     background: rgba(0, 0, 0, 0.5);
     border-radius: 12px;
     padding: 4px 8px;
   }
   #btn-mute {
     -webkit-app-region: no-drag;
     width: 28px;
     height: 28px;
     border: none;
     background: transparent;
     color: #c9a96e;
     font-size: 16px;
     cursor: pointer;
     display: flex;
     align-items: center;
     justify-content: center;
     border-radius: 4px;
     padding: 0;
     line-height: 1;
   }
   #btn-mute:hover { background: rgba(255, 255, 255, 0.1); }
   #volume-slider {
     -webkit-app-region: no-drag;
     width: 60px;
     height: 4px;
     accent-color: #c9a96e;
     cursor: pointer;
   }
   ```

   The mute button uses Unicode speaker icons:
   - Unmuted: `&#x1F50A;` (speaker with sound waves)
   - Muted: `&#x1F507;` (speaker with X / muted)

   Note: The controls use the same gold color (#c9a96e) as the existing window buttons for visual consistency.

3. **index.ts** — Wire UI controls to SoundManager. Add at the end of the `main()` function, after the visibility change listener (around line 75), before the final console.log:

   ```typescript
   import { SoundManager } from './sound-manager';
   ```
   (Add import at top of file with other imports)

   Then in main(), wire the controls:
   ```typescript
   // 6. Wire audio controls
   const soundManager = SoundManager.getInstance();
   const muteBtn = document.getElementById('btn-mute');
   const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement | null;

   if (muteBtn) {
     muteBtn.addEventListener('click', () => {
       soundManager.toggleMute();
       muteBtn.innerHTML = soundManager.muted ? '&#x1F507;' : '&#x1F50A;';
     });
   }

   if (volumeSlider) {
     volumeSlider.addEventListener('input', () => {
       soundManager.volume = parseInt(volumeSlider.value, 10) / 100;
     });
   }
   ```

   IMPORTANT: The volume slider `input` event fires on every drag movement for real-time feedback. Use `parseInt / 100` to convert 0-100 range to 0-1 float.
  </action>
  <verify>
    Run `npm run build` (or `npm start`) and verify:
    1. App launches without errors in console
    2. Volume slider and mute button visible in bottom-right corner
    3. When an agent celebrates (active->idle transition), sound plays
    4. Moving volume slider changes sound volume
    5. Clicking mute button silences sound and changes icon
  </verify>
  <done>
    Sound plays on every agent celebration. Volume slider adjusts playback volume 0-100%. Mute button toggles sound on/off with icon feedback. Controls styled consistently with existing window chrome (gold on dark).
  </done>
</task>

</tasks>

<verification>
1. `npm start` launches without errors
2. Audio controls overlay visible at bottom-right of window
3. Trigger a celebration (have a Claude session go active then idle) — "job's done" sound plays
4. Adjust volume slider — next celebration plays at new volume
5. Click mute — icon changes to muted speaker, celebrations are silent
6. Click unmute — icon changes back, celebrations play at slider volume
</verification>

<success_criteria>
- Sound file bundled via existing CopyWebpackPlugin asset pipeline
- SoundManager singleton created with play/volume/mute API
- Sound triggers exactly when agent.startCelebration() is called in world.ts tick()
- Volume slider (0-100) and mute toggle button visible in bottom-right overlay
- Controls styled with #c9a96e gold to match existing window chrome
- No console errors on startup or during playback
</success_criteria>

<output>
After completion, create `.planning/quick/3-add-job-completion-sound-effect-with-vol/3-SUMMARY.md`
</output>
