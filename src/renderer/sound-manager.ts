/**
 * SoundManager -- Singleton for playing sound effects with volume/mute control.
 * Uses HTML5 Audio API (simple, sufficient for single sound effects).
 */
export class SoundManager {
  private static instance: SoundManager;
  private jobsDoneAudio: HTMLAudioElement;
  private reminderAudio: HTMLAudioElement;
  private _volume = 0.5;   // 0..1, default 50%
  private _muted = false;

  private constructor() {
    // Webpack CopyWebpackPlugin copies assets/ into the renderer output directory.
    // The renderer runs from .webpack/renderer/main_window/ so sounds are at assets/sounds/
    // relative to the HTML file's location.
    this.jobsDoneAudio = new Audio('assets/sounds/jobs-done.mp3');
    this.jobsDoneAudio.volume = this._volume;

    this.reminderAudio = new Audio('assets/sounds/ready-to-work.mp3');
    this.reminderAudio.volume = this._volume;
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
    this.jobsDoneAudio.currentTime = 0;
    this.jobsDoneAudio.play().catch(() => {
      // Ignore autoplay policy errors -- user interaction will have occurred by this point
    });
  }

  /** Play the ready-to-work reminder sound. Restarts if already playing. */
  playReminder(): void {
    if (this._muted) return;
    this.reminderAudio.currentTime = 0;
    this.reminderAudio.play().catch(() => {
      // Ignore autoplay policy errors
    });
  }

  /** Set volume (0..1). Updates audio elements immediately. */
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.jobsDoneAudio.volume = this._volume;
    this.reminderAudio.volume = this._volume;
  }

  get volume(): number {
    return this._volume;
  }

  /** Toggle mute state. When unmuting, restores previous volume. */
  toggleMute(): void {
    this._muted = !this._muted;
    this.jobsDoneAudio.muted = this._muted;
    this.reminderAudio.muted = this._muted;
  }

  get muted(): boolean {
    return this._muted;
  }
}
