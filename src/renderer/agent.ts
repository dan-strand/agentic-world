import { Container, AnimatedSprite } from 'pixi.js';
import type { AgentSlot, SessionStatus, CharacterClass } from '../shared/types';
import {
  AGENT_WALK_SPEED,
  ANIMATION_FRAME_MS,
  STATUS_TINTS,
  STATUS_ANIM_SPEED,
  STATUS_CROSSFADE_MS,
  SHAKE_DURATION_MS,
  SHAKE_AMPLITUDE,
  BREATH_CYCLE_SPEED,
  BREATH_ALPHA_MIN,
  BREATH_ALPHA_MAX,
  CELEBRATION_DURATION_MS,
  lerpColor,
  hashSessionId,
} from '../shared/constants';
import { getCharacterAnimation } from './agent-sprites';
import { LevelUpEffect } from './level-up-effect';

/**
 * Agent states form a walk-only cycle (no vehicle/driving):
 *   idle_at_hq -> walking_to_building -> walking_to_workspot -> working
 *                                                                  |
 *   idle_at_hq <- walking_to_building (to HQ) <--- celebrating ---+
 */
export type AgentState =
  | 'idle_at_hq'
  | 'walking_to_building'
  | 'walking_to_workspot'
  | 'working'
  | 'celebrating';

/**
 * Agent -- The main visual entity for each Claude Code session.
 *
 * Extends PixiJS Container with:
 * - 5-state walk-only state machine (no vehicle/driving states)
 * - AnimatedSprite from character atlas (mage/warrior/ranger/rogue)
 * - Linear interpolation movement (frame-rate independent via deltaMs)
 * - Staggered frame offsets via session hash for non-lockstep animation
 * - Status visual effects: tint crossfade, breathing alpha, error shake, animation speed
 * - Celebration state with LevelUpEffect golden column + sparkle shower
 */
export class Agent extends Container {
  readonly sessionId: string;
  private state: AgentState = 'idle_at_hq';
  private sprite: AnimatedSprite;
  private characterClass: CharacterClass;
  private currentAnimState: 'idle' | 'walk' | 'work' = 'idle';

  // Movement
  private targetX = 0;
  private targetY = 0;

  // Animation frame timing (for manual update)
  private frameTimer = 0;

  // Position references (set by world when assigning to building/HQ)
  private hqPosition: { x: number; y: number } = { x: 0, y: 0 };
  private buildingEntrance: { x: number; y: number } | null = null;
  private workSpotTarget: { x: number; y: number } | null = null;

  // Status visuals
  private visualStatus: SessionStatus = 'active';
  private currentTint: number = 0xffffff;
  private targetTint: number = 0xffffff;
  private tintTimer = 0;

  // Waiting breathing effect
  private breathTimer = 0;
  private isBreathing = false;

  // Error shake effect
  private isShaking = false;
  private shakeTimer = 0;
  private shakeOriginX = 0;

  // Celebration
  private levelUpEffect: LevelUpEffect | null = null;
  private celebrationTimer = 0;

  constructor(sessionId: string, slot: AgentSlot) {
    super();
    this.sessionId = sessionId;
    this.characterClass = slot.characterClass;

    // Create AnimatedSprite from idle animation
    const idleTextures = getCharacterAnimation(this.characterClass, 'idle');
    this.sprite = new AnimatedSprite(idleTextures);
    this.sprite.anchor.set(0.5, 1.0); // Bottom-center for ground placement
    this.sprite.autoUpdate = false;    // Manual tick control -- CRITICAL to avoid double-speed
    this.sprite.animationSpeed = 0.15; // ~4.5fps at 30fps ticker
    this.sprite.loop = true;

    // Staggered frame offset (AGENT-03 requirement)
    const startFrame = hashSessionId(sessionId) % this.sprite.totalFrames;
    this.sprite.gotoAndPlay(startFrame);

    this.addChild(this.sprite);
  }

  /**
   * Main tick -- drives state machine, movement, and animation.
   * @param deltaMs - Milliseconds since last tick (frame-rate independent)
   */
  tick(deltaMs: number): void {
    // Status visual effects (independent of state machine)
    this.updateTint(deltaMs);
    this.updateBreathing(deltaMs);
    this.updateShake(deltaMs);

    // Advance AnimatedSprite animation manually
    // Convert deltaMs to frame-relative units and apply status speed multiplier
    const speedMultiplier = STATUS_ANIM_SPEED[this.visualStatus];
    this.frameTimer += deltaMs * speedMultiplier;
    if (this.frameTimer >= ANIMATION_FRAME_MS) {
      this.frameTimer -= ANIMATION_FRAME_MS;
      this.sprite.currentFrame = (this.sprite.currentFrame + 1) % this.sprite.totalFrames;
    }

    switch (this.state) {
      case 'idle_at_hq':
        this.setAnimation('idle');
        break;

      case 'walking_to_building': {
        if (!this.buildingEntrance) break;
        this.setAnimation('walk');
        this.moveToward(this.buildingEntrance.x, this.buildingEntrance.y, AGENT_WALK_SPEED, deltaMs);
        if (this.hasArrived(this.buildingEntrance.x, this.buildingEntrance.y)) {
          if (this.workSpotTarget) {
            this.state = 'walking_to_workspot';
          } else {
            // No work spot means we're heading to HQ (from celebration or assignToHQ)
            this.state = 'idle_at_hq';
            this.setAnimation('idle');
          }
        }
        break;
      }

      case 'walking_to_workspot': {
        if (!this.workSpotTarget) break;
        this.setAnimation('walk');
        this.moveToward(this.workSpotTarget.x, this.workSpotTarget.y, AGENT_WALK_SPEED, deltaMs);
        if (this.hasArrived(this.workSpotTarget.x, this.workSpotTarget.y)) {
          this.state = 'working';
          this.setAnimation('work');
        }
        break;
      }

      case 'working':
        this.setAnimation('work');
        break;

      case 'celebrating': {
        this.celebrationTimer += deltaMs;
        if (this.levelUpEffect) {
          this.levelUpEffect.tick(deltaMs);
        }
        this.setAnimation('idle'); // Stand still during celebration
        if (this.celebrationTimer >= CELEBRATION_DURATION_MS) {
          // Clean up level-up effect
          if (this.levelUpEffect) {
            this.removeChild(this.levelUpEffect);
            this.levelUpEffect.destroy({ children: true });
            this.levelUpEffect = null;
          }
          // Walk directly to HQ (no vehicle)
          this.state = 'walking_to_building';
          this.buildingEntrance = this.hqPosition;
          this.workSpotTarget = null; // null signals "going to HQ" in walking_to_building handler
          this.setAnimation('walk');
        }
        break;
      }
    }
  }

  // --- Animation ---

  /**
   * Switch AnimatedSprite textures when animation state changes.
   * Only swaps textures when the state actually changes to avoid unnecessary work.
   */
  private setAnimation(state: 'idle' | 'walk' | 'work'): void {
    if (this.currentAnimState === state) return; // Only switch when state changes
    this.currentAnimState = state;
    const textures = getCharacterAnimation(this.characterClass, state);
    this.sprite.textures = textures;
    this.sprite.play();
    // Preserve staggered offset -- don't reset to frame 0
  }

  // --- Movement ---

  /**
   * Linear interpolation movement toward a target point.
   * Frame-rate independent via deltaMs.
   */
  private moveToward(tx: number, ty: number, speed: number, dt: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = speed * (dt / 1000);

    if (dist <= step) {
      this.x = tx;
      this.y = ty;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  /**
   * Check if agent has arrived at target position (within 1px tolerance).
   */
  private hasArrived(tx: number, ty: number): boolean {
    return Math.abs(this.x - tx) < 1 && Math.abs(this.y - ty) < 1;
  }

  // --- Status Visuals ---

  /**
   * Apply visual status differentiation. Called by World after debouncing.
   * Triggers tint crossfade, breathing for waiting, shake on error transition.
   */
  applyStatusVisuals(status: SessionStatus): void {
    const prevStatus = this.visualStatus;
    this.visualStatus = status;

    // Set target tint for crossfade
    this.targetTint = STATUS_TINTS[status];
    this.tintTimer = 0; // restart crossfade

    // Breathing: only when waiting
    this.isBreathing = (status === 'waiting');
    if (!this.isBreathing) {
      this.alpha = 1; // Reset alpha when not breathing
    }

    // Shake: only on initial transition TO error
    if (status === 'error' && prevStatus !== 'error') {
      this.triggerShake();
    }
  }

  /**
   * Smoothly crossfade tint between current and target color.
   */
  private updateTint(deltaMs: number): void {
    if (this.currentTint === this.targetTint) return;
    this.tintTimer += deltaMs;
    const t = Math.min(1, this.tintTimer / STATUS_CROSSFADE_MS);
    this.tint = lerpColor(this.currentTint, this.targetTint, t);
    if (t >= 1) {
      this.currentTint = this.targetTint;
      this.tint = this.targetTint;
    }
  }

  /**
   * Slow alpha oscillation for waiting status (breathing effect).
   */
  private updateBreathing(deltaMs: number): void {
    if (!this.isBreathing) return;
    this.breathTimer += deltaMs * BREATH_CYCLE_SPEED;
    const t = (Math.sin(this.breathTimer) + 1) / 2; // 0..1
    this.alpha = BREATH_ALPHA_MIN + t * (BREATH_ALPHA_MAX - BREATH_ALPHA_MIN);
  }

  /**
   * Trigger error shake animation.
   */
  private triggerShake(): void {
    this.isShaking = true;
    this.shakeTimer = 0;
    this.shakeOriginX = this.x;
  }

  /**
   * Damped sinusoidal shake for error status transition.
   */
  private updateShake(deltaMs: number): void {
    if (!this.isShaking) return;
    this.shakeTimer += deltaMs;
    const progress = this.shakeTimer / SHAKE_DURATION_MS;
    if (progress >= 1) {
      this.isShaking = false;
      this.x = this.shakeOriginX;
      return;
    }
    const dampedAmplitude = SHAKE_AMPLITUDE * (1 - progress);
    const frequency = 20;
    this.x = this.shakeOriginX + Math.sin(progress * frequency) * dampedAmplitude;
  }

  /**
   * Begin celebration: play golden level-up effect above agent, then transition to HQ.
   * Called by World when a session completes successfully.
   */
  startCelebration(): void {
    this.state = 'celebrating';
    this.celebrationTimer = 0;
    // Position level-up effect above agent head
    this.levelUpEffect = new LevelUpEffect(0, -40);
    this.addChild(this.levelUpEffect);
  }

  // --- Public API (called by World) ---

  /**
   * Trigger transition from Guild Hall to a quest zone building.
   * Agent walks directly to building entrance, then to work spot.
   */
  assignToCompound(entrance: { x: number; y: number }, subLocation: { x: number; y: number }): void {
    if (this.state === 'celebrating') return;

    this.buildingEntrance = entrance;
    this.workSpotTarget = subLocation;
    this.state = 'walking_to_building';
    this.setAnimation('walk');
    // No vehicle visibility toggling -- agent is always visible as AnimatedSprite
  }

  /**
   * Trigger transition from quest zone back to Guild Hall.
   * Agent walks directly to HQ position (no vehicle intermediary).
   */
  assignToHQ(position: { x: number; y: number }): void {
    // Don't interrupt celebration -- agent will head to HQ after fireworks finish
    if (this.state === 'celebrating') {
      this.hqPosition = position;
      return;
    }

    this.hqPosition = position;

    if (this.state === 'idle_at_hq') {
      // Already at HQ, just update position
      this.x = position.x;
      this.y = position.y;
      return;
    }

    // Walk directly to HQ (no vehicle intermediary)
    this.buildingEntrance = position;
    this.workSpotTarget = null; // null signals "going to HQ" in walking_to_building handler
    this.state = 'walking_to_building';
    this.setAnimation('walk');
  }

  /**
   * Update the agent's activity by moving to a new work spot within the building.
   * Only applies when agent is already at a building (working or walking).
   */
  updateActivity(subLocation: { x: number; y: number }): void {
    this.workSpotTarget = subLocation;
    if (this.state === 'working' || this.state === 'walking_to_workspot') {
      this.state = 'walking_to_workspot';
      this.setAnimation('walk');
    }
  }

  /**
   * Set the HQ home position for this agent.
   */
  setHQPosition(pos: { x: number; y: number }): void {
    this.hqPosition = pos;

    // If idle at HQ, move to new position
    if (this.state === 'idle_at_hq') {
      this.x = pos.x;
      this.y = pos.y;
    }
  }

  /**
   * Get the current agent state for external queries.
   */
  getState(): AgentState {
    return this.state;
  }
}
