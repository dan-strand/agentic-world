import { Container, Graphics } from 'pixi.js';
import type { ActivityType } from '../shared/types';
import { SPEECH_BUBBLE_DURATION, SPEECH_BUBBLE_FADE_MS } from '../shared/constants';
import { getActivityIcon } from './activity-icons';

/**
 * Speech bubble with activity icon that appears above an agent.
 * Shows a small white rounded-rect bubble with a triangle pointer,
 * containing an activity icon. Flashes on activity change and
 * auto-fades after SPEECH_BUBBLE_DURATION ms.
 */
export class SpeechBubble extends Container {
  private bubble: Graphics;
  private icon: Graphics;
  private fadeTimer = 0;
  private isActive = false;

  constructor() {
    super();

    // White rounded rect background
    this.bubble = new Graphics();
    this.bubble.roundRect(0, 0, 28, 24, 4).fill(0xffffff);
    // Triangle pointer at bottom-center
    this.bubble.moveTo(10, 24).lineTo(14, 30).lineTo(18, 24).fill(0xffffff);
    this.addChild(this.bubble);

    // Icon placeholder -- context swapped on show()
    this.icon = new Graphics();
    this.icon.position.set(7, 5); // Centered in bubble
    this.addChild(this.icon);

    // Start hidden
    this.visible = false;

    // Position above agent head (adjusted by parent)
    this.position.set(-14, -60);
  }

  /**
   * Show the bubble with the given activity icon.
   * Resets fade timer and makes bubble fully visible.
   */
  show(activity: ActivityType): void {
    const iconCtx = getActivityIcon(activity);
    if (iconCtx) {
      this.icon.context = iconCtx;
    }
    this.alpha = 1;
    this.visible = true;
    this.fadeTimer = 0;
    this.isActive = true;
  }

  /**
   * Update fade timer. Call every tick with deltaMs.
   * After SPEECH_BUBBLE_DURATION ms, begins fading out over SPEECH_BUBBLE_FADE_MS.
   */
  tick(deltaMs: number): void {
    if (!this.isActive) return;

    this.fadeTimer += deltaMs;

    if (this.fadeTimer > SPEECH_BUBBLE_DURATION) {
      const fadeProgress = (this.fadeTimer - SPEECH_BUBBLE_DURATION) / SPEECH_BUBBLE_FADE_MS;
      this.alpha = Math.max(0, 1 - fadeProgress);
      if (this.alpha <= 0) {
        this.visible = false;
        this.isActive = false;
      }
    }
  }
}
