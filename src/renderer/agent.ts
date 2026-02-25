import { Container, Graphics } from 'pixi.js';
import type { AgentSlot } from '../shared/types';
import {
  AGENT_WALK_SPEED,
  AGENT_DRIVE_SPEED,
  ANIMATION_FRAME_MS,
} from '../shared/constants';
import { getBodyFrames, getAccessoryContext } from './agent-sprites';
import { Vehicle } from './vehicle';
import type { GraphicsContext } from 'pixi.js';

/**
 * Agent states form a cycle:
 *   idle_at_hq -> driving_to_compound -> walking_to_sublocation -> working
 *                                                                     |
 *   idle_at_hq <- driving_to_hq <- walking_to_entrance <-------------+
 */
export type AgentState =
  | 'idle_at_hq'
  | 'driving_to_compound'
  | 'walking_to_sublocation'
  | 'working'
  | 'walking_to_entrance'
  | 'driving_to_hq';

/**
 * Agent -- The main visual entity for each Claude Code session.
 *
 * Extends PixiJS Container with:
 * - 6-state state machine governing behavior
 * - Linear interpolation movement (frame-rate independent via deltaMs)
 * - GraphicsContext frame-swapping animation (never graphics.clear() in tick)
 * - Vehicle child container for driving states
 * - Composited body + accessory layers
 */
export class Agent extends Container {
  readonly sessionId: string;
  private state: AgentState = 'idle_at_hq';
  private bodyGfx: Graphics;
  private accessoryGfx: Graphics;
  private vehicle: Vehicle;
  private slot: AgentSlot;

  // Movement
  private targetX = 0;
  private targetY = 0;

  // Animation
  private frameIndex = 0;
  private frameTimer = 0;
  private currentBodyFrames: GraphicsContext[] = [];

  // Position references (set by world when assigning to compound/HQ)
  private hqPosition: { x: number; y: number } = { x: 0, y: 0 };
  private compoundEntrance: { x: number; y: number } | null = null;
  private subLocationTarget: { x: number; y: number } | null = null;

  constructor(sessionId: string, slot: AgentSlot) {
    super();
    this.sessionId = sessionId;
    this.slot = slot;

    // Body graphics - composited layer 1
    const idleFrames = getBodyFrames(slot.colorIndex, 'idle');
    this.currentBodyFrames = idleFrames;
    this.bodyGfx = new Graphics(idleFrames[0]);
    this.addChild(this.bodyGfx);

    // Accessory graphics - composited layer 2 (rendered on top of body)
    const accCtx = getAccessoryContext(slot.accessory);
    this.accessoryGfx = new Graphics(accCtx);
    this.addChild(this.accessoryGfx);

    // Vehicle (hidden by default, shown during driving states)
    this.vehicle = new Vehicle(slot.vehicleType, slot.color);
    this.addChild(this.vehicle);
  }

  /**
   * Main tick -- drives state machine, movement, and animation.
   * @param deltaMs - Milliseconds since last tick (frame-rate independent)
   */
  tick(deltaMs: number): void {
    switch (this.state) {
      case 'idle_at_hq':
        this.animateFrames(deltaMs, 'idle');
        break;

      case 'driving_to_compound': {
        if (!this.compoundEntrance) break;
        const dx1 = this.compoundEntrance.x - this.x;
        const dy1 = this.compoundEntrance.y - this.y;
        this.vehicle.setDirection(dx1, dy1);
        this.moveToward(this.compoundEntrance.x, this.compoundEntrance.y, AGENT_DRIVE_SPEED, deltaMs);
        this.vehicle.tick(deltaMs);
        if (this.hasArrived(this.compoundEntrance.x, this.compoundEntrance.y)) {
          this.onArrivedAtCompound();
        }
        break;
      }

      case 'walking_to_sublocation': {
        if (!this.subLocationTarget) break;
        this.moveToward(this.subLocationTarget.x, this.subLocationTarget.y, AGENT_WALK_SPEED, deltaMs);
        this.animateFrames(deltaMs, 'walking');
        if (this.hasArrived(this.subLocationTarget.x, this.subLocationTarget.y)) {
          this.onArrivedAtSubLocation();
        }
        break;
      }

      case 'working':
        this.animateFrames(deltaMs, 'working');
        break;

      case 'walking_to_entrance': {
        if (!this.compoundEntrance) break;
        this.moveToward(this.compoundEntrance.x, this.compoundEntrance.y, AGENT_WALK_SPEED, deltaMs);
        this.animateFrames(deltaMs, 'walking');
        if (this.hasArrived(this.compoundEntrance.x, this.compoundEntrance.y)) {
          this.onArrivedAtEntrance();
        }
        break;
      }

      case 'driving_to_hq': {
        const dx2 = this.hqPosition.x - this.x;
        const dy2 = this.hqPosition.y - this.y;
        this.vehicle.setDirection(dx2, dy2);
        this.moveToward(this.hqPosition.x, this.hqPosition.y, AGENT_DRIVE_SPEED, deltaMs);
        this.vehicle.tick(deltaMs);
        if (this.hasArrived(this.hqPosition.x, this.hqPosition.y)) {
          this.onArrivedAtHQ();
        }
        break;
      }
    }
  }

  // --- State transition handlers ---

  private onArrivedAtCompound(): void {
    // Park vehicle at entrance, show agent, start walking to sub-location
    this.vehicle.visible = false;
    this.bodyGfx.visible = true;
    this.accessoryGfx.visible = true;

    if (this.subLocationTarget) {
      this.state = 'walking_to_sublocation';
      this.setBodyFrames('walking');
    } else {
      // No sub-location assigned; go straight to working at entrance
      this.state = 'working';
      this.setBodyFrames('working');
    }
  }

  private onArrivedAtSubLocation(): void {
    this.state = 'working';
    this.setBodyFrames('working');
  }

  private onArrivedAtEntrance(): void {
    // Hide agent, show vehicle, start driving to HQ
    this.bodyGfx.visible = false;
    this.accessoryGfx.visible = false;
    this.vehicle.visible = true;
    this.state = 'driving_to_hq';
  }

  private onArrivedAtHQ(): void {
    // Park vehicle, show agent idle at HQ
    this.vehicle.visible = false;
    this.bodyGfx.visible = true;
    this.accessoryGfx.visible = true;
    this.state = 'idle_at_hq';
    this.setBodyFrames('idle');
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

  // --- Animation ---

  /**
   * Animate body frames using GraphicsContext swapping.
   * Advances frame index based on accumulated time.
   */
  private animateFrames(deltaMs: number, state: 'idle' | 'walking' | 'working'): void {
    // Switch frame set if state changed
    const targetFrames = getBodyFrames(this.slot.colorIndex, state);
    if (this.currentBodyFrames !== targetFrames) {
      this.setBodyFrames(state);
    }

    this.frameTimer += deltaMs;
    if (this.frameTimer >= ANIMATION_FRAME_MS) {
      this.frameTimer -= ANIMATION_FRAME_MS;
      this.frameIndex = (this.frameIndex + 1) % this.currentBodyFrames.length;
      this.bodyGfx.context = this.currentBodyFrames[this.frameIndex];
    }
  }

  /**
   * Switch to a different animation state's frame set.
   */
  private setBodyFrames(state: 'idle' | 'walking' | 'working'): void {
    this.currentBodyFrames = getBodyFrames(this.slot.colorIndex, state);
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.bodyGfx.context = this.currentBodyFrames[0];
  }

  // --- Public API (called by World) ---

  /**
   * Trigger transition from HQ to a compound.
   * Agent gets in vehicle and drives to compound entrance,
   * then walks to sub-location and starts working.
   */
  assignToCompound(entrance: { x: number; y: number }, subLocation: { x: number; y: number }): void {
    this.compoundEntrance = entrance;
    this.subLocationTarget = subLocation;

    // Hide agent body, show vehicle
    this.bodyGfx.visible = false;
    this.accessoryGfx.visible = false;
    this.vehicle.visible = true;

    this.state = 'driving_to_compound';
  }

  /**
   * Trigger transition from compound back to HQ.
   * Agent walks to compound entrance, gets in vehicle, drives to HQ.
   */
  assignToHQ(position: { x: number; y: number }): void {
    this.hqPosition = position;

    if (this.state === 'idle_at_hq') {
      // Already at HQ, just update position
      this.x = position.x;
      this.y = position.y;
      return;
    }

    if (this.state === 'working' || this.state === 'walking_to_sublocation') {
      // Walk to entrance first
      if (this.compoundEntrance) {
        this.state = 'walking_to_entrance';
        this.setBodyFrames('walking');
      } else {
        // No compound entrance known, teleport to HQ
        this.x = position.x;
        this.y = position.y;
        this.state = 'idle_at_hq';
        this.setBodyFrames('idle');
        this.bodyGfx.visible = true;
        this.accessoryGfx.visible = true;
        this.vehicle.visible = false;
      }
    }
    // If already driving, let current drive complete
  }

  /**
   * Update the agent's activity by moving to a new sub-location within the compound.
   * Only applies when agent is already at a compound (working or walking).
   */
  updateActivity(subLocation: { x: number; y: number }): void {
    this.subLocationTarget = subLocation;

    if (this.state === 'working' || this.state === 'walking_to_sublocation') {
      this.state = 'walking_to_sublocation';
      this.setBodyFrames('walking');
    }
    // If not at compound yet, the sub-location will be used when agent arrives
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
