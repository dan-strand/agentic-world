import { Container, Graphics, GraphicsContext } from 'pixi.js';
import type { VehicleType } from '../shared/types';
import { ANIMATION_FRAME_MS } from '../shared/constants';

/**
 * Vehicle -- Container with driving animation for agent transit.
 *
 * Each vehicle type is drawn programmatically using Graphics primitives.
 * Vehicle body color matches the agent's color.
 * Animation uses GraphicsContext frame-swapping (no graphics.clear() in tick).
 *
 * Vehicle types:
 * - car: Rectangle body with roof, two circle wheels (~30x16px)
 * - motorcycle: Narrow body, single rider silhouette, two wheels (~24x14px)
 * - van: Taller rectangle body, larger back section (~34x18px)
 * - helicopter: Oval body with rotor line on top (~32x20px)
 */
export class Vehicle extends Container {
  private body: Graphics;
  private frames: GraphicsContext[];
  private frameIndex = 0;
  private frameTimer = 0;

  constructor(vehicleType: VehicleType, color: number) {
    super();

    this.frames = Vehicle.buildFrames(vehicleType, color);

    this.body = new Graphics(this.frames[0]);
    this.addChild(this.body);

    // Vehicle is hidden by default (shown during driving states)
    this.visible = false;
  }

  /**
   * Build driving animation frames for a given vehicle type and color.
   * Returns 3 GraphicsContext objects per vehicle type.
   */
  private static buildFrames(type: VehicleType, color: number): GraphicsContext[] {
    switch (type) {
      case 'car':
        return Vehicle.buildCarFrames(color);
      case 'motorcycle':
        return Vehicle.buildMotorcycleFrames(color);
      case 'van':
        return Vehicle.buildVanFrames(color);
      case 'helicopter':
        return Vehicle.buildHelicopterFrames(color);
    }
  }

  /**
   * Car: Rectangle body with roof, two circle wheels (~30x16px).
   */
  private static buildCarFrames(color: number): GraphicsContext[] {
    const frames: GraphicsContext[] = [];
    const wheelPositions = [
      [0, 1],   // frame 0: normal
      [1, 0],   // frame 1: rotated slightly
      [0, 1],   // frame 2: back to normal
    ];

    for (let i = 0; i < 3; i++) {
      const ctx = new GraphicsContext();

      // Body
      ctx.rect(-15, -8, 30, 10).fill(color);

      // Roof (smaller rect on top)
      ctx.rect(-8, -14, 16, 7).fill(color);

      // Windows
      ctx.rect(-6, -13, 5, 5).fill(0x88bbdd);
      ctx.rect(1, -13, 5, 5).fill(0x88bbdd);

      // Wheels - subtle rotation effect via small position shift
      const [wOff1, wOff2] = wheelPositions[i];
      ctx.circle(-9, 3 + wOff1, 3).fill(0x222222);
      ctx.circle(9, 3 + wOff2, 3).fill(0x222222);

      // Wheel hub caps
      ctx.circle(-9, 3 + wOff1, 1).fill(0x666666);
      ctx.circle(9, 3 + wOff2, 1).fill(0x666666);

      frames.push(ctx);
    }
    return frames;
  }

  /**
   * Motorcycle: Narrow body, rider silhouette, two wheels (~24x14px).
   */
  private static buildMotorcycleFrames(color: number): GraphicsContext[] {
    const frames: GraphicsContext[] = [];

    for (let i = 0; i < 3; i++) {
      const ctx = new GraphicsContext();

      // Frame/body - narrow
      ctx.rect(-8, -4, 16, 5).fill(color);

      // Seat/rider silhouette
      ctx.rect(-3, -9, 6, 6).fill(0x333344);

      // Handlebars
      ctx.rect(5, -7, 4, 2).fill(0x888888);

      // Wheels - slight bounce per frame
      const bounce = (i === 1) ? -1 : 0;
      ctx.circle(-8, 3 + bounce, 3).fill(0x222222);
      ctx.circle(8, 3 + bounce, 3).fill(0x222222);

      // Spokes (rotation illusion)
      const spokeAngle = (i / 3) * Math.PI;
      ctx.circle(-8, 3 + bounce, 1).fill(0x555555);
      ctx.circle(8, 3 + bounce, 1).fill(0x555555);

      frames.push(ctx);
    }
    return frames;
  }

  /**
   * Van: Taller rectangle body, larger back section (~34x18px).
   */
  private static buildVanFrames(color: number): GraphicsContext[] {
    const frames: GraphicsContext[] = [];

    for (let i = 0; i < 3; i++) {
      const ctx = new GraphicsContext();

      // Main body - taller
      ctx.rect(-17, -12, 34, 14).fill(color);

      // Cab window (front)
      ctx.rect(10, -11, 6, 5).fill(0x88bbdd);

      // Back section (slightly darker)
      ctx.rect(-17, -12, 20, 14).fill(
        ((color >> 16) & 0xff) * 0.8 << 16 |
        ((color >> 8) & 0xff) * 0.8 << 8 |
        (color & 0xff) * 0.8
      );

      // Wheels
      const wOff = (i === 1) ? 1 : 0;
      ctx.circle(-11, 4 + wOff, 3).fill(0x222222);
      ctx.circle(11, 4, 3).fill(0x222222);

      // Hub caps
      ctx.circle(-11, 4 + wOff, 1).fill(0x666666);
      ctx.circle(11, 4, 1).fill(0x666666);

      frames.push(ctx);
    }
    return frames;
  }

  /**
   * Helicopter: Oval body with spinning rotor on top (~32x20px).
   */
  private static buildHelicopterFrames(color: number): GraphicsContext[] {
    const frames: GraphicsContext[] = [];

    for (let i = 0; i < 3; i++) {
      const ctx = new GraphicsContext();

      // Body - oval shape approximated with rounded rect
      ctx.roundRect(-14, -5, 28, 14, 6).fill(color);

      // Cockpit window
      ctx.roundRect(6, -3, 7, 8, 3).fill(0x88bbdd);

      // Tail boom
      ctx.rect(-18, -2, 6, 4).fill(color);

      // Tail rotor (small)
      ctx.rect(-20, -5, 2, 10).fill(0xaaaaaa);

      // Skids
      ctx.rect(-12, 10, 24, 2).fill(0x666666);

      // Main rotor - rotates between frames
      const rotorAngle = (i / 3) * Math.PI;
      const rotorLen = 16;
      const rx1 = Math.cos(rotorAngle) * rotorLen;
      const ry1 = Math.sin(rotorAngle) * 3; // flattened perspective
      ctx.moveTo(-rx1, -8 - ry1).lineTo(rx1, -8 + ry1).stroke({ color: 0xaaaaaa, width: 2 });

      // Second rotor blade (perpendicular)
      const rx2 = Math.cos(rotorAngle + Math.PI / 2) * rotorLen;
      const ry2 = Math.sin(rotorAngle + Math.PI / 2) * 3;
      ctx.moveTo(-rx2, -8 - ry2).lineTo(rx2, -8 + ry2).stroke({ color: 0xaaaaaa, width: 2 });

      // Rotor hub
      ctx.circle(0, -8, 2).fill(0x888888);

      frames.push(ctx);
    }
    return frames;
  }

  /**
   * Animate driving frames. Call every tick.
   * Uses GraphicsContext frame-swapping (no graphics.clear()).
   */
  tick(deltaMs: number): void {
    this.frameTimer += deltaMs;
    if (this.frameTimer >= ANIMATION_FRAME_MS) {
      this.frameTimer -= ANIMATION_FRAME_MS;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.body.context = this.frames[this.frameIndex];
    }
  }

  /**
   * Orient vehicle based on movement direction.
   * Flips horizontally when moving left.
   */
  setDirection(dx: number, _dy: number): void {
    if (dx < 0) {
      this.scale.x = -1;
    } else if (dx > 0) {
      this.scale.x = 1;
    }
    // If dx === 0, keep current direction
  }
}
