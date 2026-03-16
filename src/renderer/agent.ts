import { Container, AnimatedSprite, Sprite } from 'pixi.js';
import type { AgentSlot, SessionStatus, CharacterClass } from '../shared/types';
import {
  AGENT_WALK_SPEED,
  AGENT_INTERIOR_SCALE,
  AGENT_WANDER_RADIUS,
  AGENT_WANDER_INTERVAL_MS,
  AGENT_INTERIOR_WALK_SPEED,
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
  AGENT_FADEOUT_DELAY_MS,
  AGENT_FADEOUT_DURATION_MS,
  lerpColor,
  hashSessionId,
} from '../shared/constants';
import { getCharacterAnimation, type AnimState } from './agent-sprites';
import { gearTextures } from './asset-loader';
import { createPaletteSwappedTextures } from './palette-swap';
import { LevelUpEffect } from './level-up-effect';

/**
 * Agent states form a walk-only cycle (no vehicle/driving):
 *   idle_at_hq -> walking_to_building -> walking_to_workspot -> working
 *        |                                                        |
 *   fading_out <- idle_at_hq <- walking_to_building <- celebrating
 *   (terminal)   (if hasCompletedTask)
 */
export type AgentState =
  | 'idle_at_hq'
  | 'walking_to_building'
  | 'walking_to_workspot'
  | 'working'
  | 'celebrating'
  | 'fading_out';

/**
 * Agent -- The main visual entity for each Claude Code session.
 *
 * Extends PixiJS Container with:
 * - 6-state walk-only state machine (no vehicle/driving states; fading_out is terminal)
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
  readonly characterClass: CharacterClass;
  private currentAnimState: AnimState = 'idle';

  // Character identity (palette swap, gear overlay, name label)
  readonly paletteIndex: number;
  private gearIndex: number;
  private gearSprite: Sprite | null = null;

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

  // Interior mode (when working inside a building)
  private interiorMode = false;
  private wanderCenterX = 0;
  private wanderCenterY = 0;
  private wanderTimer = 0;
  private wanderTargetX = 0;
  private wanderTargetY = 0;

  // Fade-out lifecycle (terminal state, triggered by World when session disappears)
  private fadeOutTimer = 0;

  constructor(sessionId: string, slot: AgentSlot) {
    super();
    this.sessionId = sessionId;
    this.characterClass = slot.characterClass;
    this.paletteIndex = slot.paletteIndex;
    this.gearIndex = slot.gearIndex;

    // Create AnimatedSprite from palette-swapped idle animation
    const baseIdleTextures = getCharacterAnimation(this.characterClass, 'idle');
    const swappedIdleTextures = createPaletteSwappedTextures(baseIdleTextures, this.characterClass, this.paletteIndex);
    this.sprite = new AnimatedSprite(swappedIdleTextures);
    this.sprite.anchor.set(0.5, 1.0); // Bottom-center for ground placement
    this.sprite.autoUpdate = false;    // Manual tick control -- CRITICAL to avoid double-speed
    this.sprite.animationSpeed = 0.15; // ~4.5fps at 30fps ticker
    this.sprite.loop = true;

    // Staggered frame offset (AGENT-03 requirement)
    const startFrame = hashSessionId(sessionId) % this.sprite.totalFrames;
    this.sprite.gotoAndPlay(startFrame);

    this.addChild(this.sprite);

    // Gear overlay sprite (hat/helm/hood positioned over character head)
    const gearKey = `${this.characterClass}_gear_${this.gearIndex}`;
    const gearTex = gearTextures[gearKey];
    if (gearTex) {
      this.gearSprite = new Sprite(gearTex);
      this.gearSprite.anchor.set(0.5, 1.0); // Same anchor as character sprite
      this.addChild(this.gearSprite);
    }

  }

  /**
   * Main tick -- drives state machine, movement, and animation.
   * @param deltaMs - Milliseconds since last tick (frame-rate independent)
   */
  tick(deltaMs: number): void {
    // Skip ALL visual updates during fade-out to prevent alpha writer conflicts
    if (this.state !== 'fading_out') {
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
        const walkSpeed = this.interiorMode ? AGENT_INTERIOR_WALK_SPEED : AGENT_WALK_SPEED;
        this.moveToward(this.workSpotTarget.x, this.workSpotTarget.y, walkSpeed, deltaMs);
        if (this.hasArrived(this.workSpotTarget.x, this.workSpotTarget.y)) {
          this.state = 'working';
          // Initialize wander center at the work spot position
          this.wanderCenterX = this.workSpotTarget.x;
          this.wanderCenterY = this.workSpotTarget.y;
          this.wanderTargetX = this.wanderCenterX;
          this.wanderTargetY = this.wanderCenterY;
          this.wanderTimer = 0;
          this.setAnimation('work');
        }
        break;
      }

      case 'working':
        if (this.interiorMode) {
          // Wander behavior: periodically pick a new random target within radius
          this.wanderTimer += deltaMs;
          if (this.wanderTimer >= AGENT_WANDER_INTERVAL_MS) {
            this.wanderTimer = 0;
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * AGENT_WANDER_RADIUS;
            this.wanderTargetX = this.wanderCenterX + Math.cos(angle) * dist;
            this.wanderTargetY = this.wanderCenterY + Math.sin(angle) * dist;
          }
          // Move toward wander target at interior speed
          if (!this.hasArrived(this.wanderTargetX, this.wanderTargetY)) {
            this.setAnimation('walk');
            this.moveToward(this.wanderTargetX, this.wanderTargetY, AGENT_INTERIOR_WALK_SPEED, deltaMs);
          } else {
            this.setAnimation('work');
          }
        } else {
          this.setAnimation('work');
        }
        break;

      case 'celebrating': {
        this.celebrationTimer += deltaMs;
        if (this.levelUpEffect) {
          this.levelUpEffect.tick(deltaMs);
        }
        this.setAnimation('celebrate'); // Class-specific celebrate animation
        if (this.celebrationTimer >= CELEBRATION_DURATION_MS) {
          // Clean up level-up effect (destroys GlowFilter GPU resources)
          this.cleanupLevelUpEffect();
          // Walk directly to HQ (no vehicle)
          this.state = 'walking_to_building';
          this.buildingEntrance = this.hqPosition;
          this.workSpotTarget = null; // null signals "going to HQ" in walking_to_building handler
          this.setAnimation('walk');
        }
        break;
      }

      case 'fading_out': {
        this.fadeOutTimer += deltaMs;
        if (this.fadeOutTimer >= AGENT_FADEOUT_DELAY_MS) {
          const fadeElapsed = this.fadeOutTimer - AGENT_FADEOUT_DELAY_MS;
          const fadeProgress = Math.min(1, fadeElapsed / AGENT_FADEOUT_DURATION_MS);
          this.alpha = 1 - fadeProgress;
        }
        break;
      }
    }
  }

  // --- Animation ---

  /**
   * Switch AnimatedSprite textures when animation state changes.
   * Uses palette-swapped textures for unique agent colors.
   * Only swaps textures when the state actually changes to avoid unnecessary work.
   */
  private setAnimation(state: AnimState): void {
    if (this.currentAnimState === state) return; // Only switch when state changes
    this.currentAnimState = state;
    const baseTextures = getCharacterAnimation(this.characterClass, state);
    const swappedTextures = createPaletteSwappedTextures(baseTextures, this.characterClass, this.paletteIndex);
    this.sprite.textures = swappedTextures;
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
   * Returns true when the fade-out animation is fully complete
   * and the agent is ready for removal from the world.
   */
  isFadedOut(): boolean {
    return this.state === 'fading_out' &&
      this.fadeOutTimer >= AGENT_FADEOUT_DELAY_MS + AGENT_FADEOUT_DURATION_MS;
  }

  /**
   * Apply visual status differentiation. Called by World after debouncing.
   * Triggers tint crossfade, breathing for waiting, shake on error transition.
   */
  applyStatusVisuals(status: SessionStatus): void {
    if (this.state === 'fading_out') return;
    const prevStatus = this.visualStatus;
    this.visualStatus = status;

    // Set target tint for crossfade
    this.targetTint = STATUS_TINTS[status];
    this.tintTimer = 0; // restart crossfade

    // Breathing: only when waiting
    this.isBreathing = (status === 'waiting');
    if (!this.isBreathing) {
      this.alpha = 1; // Force alpha=1 to clear any breathing oscillation residue
      this.breathTimer = 0; // Reset timer so next waiting period starts from consistent state
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
   * Trigger fade-out from any state. Called by World when a session
   * disappears from the IPC session list (truly closed, not just idle).
   */
  startFadeOut(): void {
    if (this.state === 'fading_out') return;
    // Clean up celebration effect if mid-celebration (destroys GlowFilter GPU resources)
    this.cleanupLevelUpEffect();
    this.state = 'fading_out';
    this.fadeOutTimer = 0;
  }

  /**
   * Cancel an in-progress fade-out and return to idle_at_hq state.
   * Used when an idle-timeout fade is interrupted by session reactivation.
   * Fully resets all visual state to prevent stale effects from lingering.
   * No-op if agent is not currently fading out.
   */
  cancelFadeOut(): void {
    if (this.state !== 'fading_out') return;
    this.state = 'idle_at_hq';
    this.fadeOutTimer = 0;
    this.alpha = 1;
    // Reset interior mode (restores normal scale)
    this.setInteriorMode(false);
    // Reset breathing in case it was active before fade started
    this.isBreathing = false;
    this.breathTimer = 0;
    // Reset tint to default (active) since the agent is being reactivated
    this.currentTint = 0xffffff;
    this.targetTint = 0xffffff;
    this.tintTimer = 0;
    this.tint = 0xffffff;
    this.setAnimation('idle');
  }

  /**
   * Clean up the LevelUpEffect if present.
   * Destroys GlowFilter GPU resources before container destroy to prevent shader leaks.
   */
  private cleanupLevelUpEffect(): void {
    if (!this.levelUpEffect) return;
    this.levelUpEffect.cleanupFilters();
    this.removeChild(this.levelUpEffect);
    this.levelUpEffect.destroy({ children: true });
    this.levelUpEffect = null;
  }

  /**
   * Begin celebration: play golden level-up effect above agent, then transition to HQ.
   * Uses class-specific celebrate animation (mage staff burst, warrior fist pump, etc.)
   * Called by World when a session completes successfully.
   */
  startCelebration(): void {
    this.state = 'celebrating';
    this.celebrationTimer = 0;
    // Position level-up effect above agent head
    this.levelUpEffect = new LevelUpEffect(0, -40);
    this.addChild(this.levelUpEffect);
    this.setAnimation('celebrate'); // Class-specific celebrate animation
  }

  // --- Public API (called by World) ---

  /**
   * Enable or disable interior mode (when agent is working inside a building).
   * When enabled: scales agent to 1.5x for readability.
   * When disabled: restores normal 1x scale.
   */
  setInteriorMode(enabled: boolean): void {
    this.interiorMode = enabled;
    if (enabled) {
      this.scale.set(AGENT_INTERIOR_SCALE);
    } else {
      this.scale.set(1);
    }
  }

  /**
   * Trigger transition from Guild Hall to a quest zone building.
   * Agent walks directly to building entrance, then to work spot.
   */
  assignToCompound(entrance: { x: number; y: number }, subLocation: { x: number; y: number }): void {
    if (this.state === 'celebrating' || this.state === 'fading_out') return;

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
    // Don't interrupt celebration or fade-out
    if (this.state === 'fading_out') return;
    if (this.state === 'celebrating') {
      this.hqPosition = position;
      return;
    }

    // Leaving building -- disable interior mode (restores normal scale)
    this.setInteriorMode(false);
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
