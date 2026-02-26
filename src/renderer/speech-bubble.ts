import { Container, Graphics, BitmapText } from 'pixi.js';
import type { ActivityType } from '../shared/types';
import { SPEECH_BUBBLE_DURATION, SPEECH_BUBBLE_FADE_MS, ACTIVITY_DISPLAY_NAMES } from '../shared/constants';
import { getActivityIcon } from './activity-icons';

/**
 * Speech bubble with activity icon and text label that appears above an agent.
 * Shows a white rounded-rect bubble with a triangle pointer,
 * containing an activity icon and a BitmapText label (e.g., "Coding").
 * Auto-sizes to fit content. Flashes on activity change and
 * auto-fades after SPEECH_BUBBLE_DURATION ms.
 */
export class SpeechBubble extends Container {
  private bubble: Graphics;
  private icon: Graphics;
  private bubbleLabel: BitmapText;
  private fadeTimer = 0;
  private isActive = false;

  constructor() {
    super();

    // White rounded rect background (initial size -- resized dynamically in show())
    this.bubble = new Graphics();
    this.bubble.roundRect(0, 0, 28, 24, 4).fill(0xffffff);
    // Triangle pointer at bottom-center
    this.bubble.moveTo(10, 24).lineTo(14, 30).lineTo(18, 24).fill(0xffffff);
    this.addChild(this.bubble);

    // Icon placeholder -- context swapped on show()
    this.icon = new Graphics();
    this.icon.position.set(7, 5); // Centered in bubble
    this.addChild(this.icon);

    // BitmapText label for activity name
    this.bubbleLabel = new BitmapText({
      text: '',
      style: { fontFamily: 'PixelSignpost', fontSize: 16 },
    });
    this.bubbleLabel.tint = 0x333333; // Dark text on white bubble
    this.addChild(this.bubbleLabel);

    // Start hidden
    this.visible = false;

    // Position above agent head (adjusted by parent)
    this.position.set(-14, -60);
  }

  /**
   * Show the bubble with the given activity icon and text label.
   * Dynamically resizes the bubble background to fit icon + text.
   * Resets fade timer and makes bubble fully visible.
   */
  show(activity: ActivityType): void {
    // Update icon
    const iconCtx = getActivityIcon(activity);
    if (iconCtx) {
      this.icon.context = iconCtx;
    }

    // Update text label
    this.bubbleLabel.text = ACTIVITY_DISPLAY_NAMES[activity];

    // Calculate dynamic bubble width: padLeft(7) + iconWidth(14) + gap(4) + textWidth + padRight(6)
    const bubbleWidth = 7 + 14 + 4 + this.bubbleLabel.width + 6;
    const bubbleHeight = 24;

    // Redraw bubble background at new size
    this.bubble.clear();
    this.bubble.roundRect(0, 0, bubbleWidth, bubbleHeight, 4).fill(0xffffff);
    // Triangle pointer at bottom-center
    const cx = bubbleWidth / 2;
    this.bubble.moveTo(cx - 4, bubbleHeight).lineTo(cx, bubbleHeight + 6).lineTo(cx + 4, bubbleHeight).fill(0xffffff);

    // Reposition icon and label within bubble
    this.icon.position.set(7, 5);
    this.bubbleLabel.position.set(25, 5); // 7 + 14 + 4 = 25

    // Re-center the entire SpeechBubble container above the agent
    this.position.set(-bubbleWidth / 2, -60);

    // Reset fade state
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
