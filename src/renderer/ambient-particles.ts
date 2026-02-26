import { Container, Graphics } from 'pixi.js';
import {
  AMBIENT_PARTICLE_COUNT,
  AMBIENT_PARTICLE_SIZE_MIN,
  AMBIENT_PARTICLE_SIZE_MAX,
  AMBIENT_PARTICLE_COLOR,
  AMBIENT_PARTICLE_DRIFT_MIN,
  AMBIENT_PARTICLE_DRIFT_MAX,
  AMBIENT_PARTICLE_BOB_AMP_MIN,
  AMBIENT_PARTICLE_BOB_AMP_MAX,
  AMBIENT_PARTICLE_ALPHA_MIN,
  AMBIENT_PARTICLE_ALPHA_RANGE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '../shared/constants';

interface AmbientParticle {
  gfx: Graphics;
  baseY: number;
  driftSpeed: number;
  bobSpeed: number;
  bobAmplitude: number;
  alphaSpeed: number;
  phase: number;
}

/**
 * AmbientParticles -- Persistent floating firefly/magic dust particles.
 *
 * Creates 25 small glowing particles that drift horizontally with sine-wave
 * vertical oscillation and cycling alpha, creating an atmospheric firefly effect.
 *
 * Particles wrap around from right to left (offscreen) to avoid pop-in artifacts.
 *
 * Usage:
 *   const particles = new AmbientParticles();
 *   worldContainer.addChild(particles);
 *   // In tick: particles.tick(deltaMs);
 *
 * This effect runs continuously -- it has no isDone() method.
 */
export class AmbientParticles extends Container {
  private particles: AmbientParticle[] = [];

  constructor() {
    super();

    for (let i = 0; i < AMBIENT_PARTICLE_COUNT; i++) {
      const gfx = new Graphics();
      const radius = AMBIENT_PARTICLE_SIZE_MIN +
        Math.random() * (AMBIENT_PARTICLE_SIZE_MAX - AMBIENT_PARTICLE_SIZE_MIN);
      gfx.circle(0, 0, radius).fill(AMBIENT_PARTICLE_COLOR);

      // Random initial position across the world
      gfx.x = Math.random() * WORLD_WIDTH;
      gfx.y = Math.random() * WORLD_HEIGHT;

      // Staggered initial alpha
      gfx.alpha = Math.random();

      this.addChild(gfx);

      this.particles.push({
        gfx,
        baseY: gfx.y,
        driftSpeed: AMBIENT_PARTICLE_DRIFT_MIN +
          Math.random() * (AMBIENT_PARTICLE_DRIFT_MAX - AMBIENT_PARTICLE_DRIFT_MIN),
        bobSpeed: 0.5 + Math.random(),
        bobAmplitude: AMBIENT_PARTICLE_BOB_AMP_MIN +
          Math.random() * (AMBIENT_PARTICLE_BOB_AMP_MAX - AMBIENT_PARTICLE_BOB_AMP_MIN),
        alphaSpeed: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Advance the ambient particle simulation.
   * @param deltaMs - Milliseconds since last tick
   */
  tick(deltaMs: number): void {
    const dt = deltaMs / 1000;

    for (const p of this.particles) {
      p.phase += dt;

      // Horizontal drift
      p.gfx.x += p.driftSpeed * dt;

      // Sine-wave vertical bob
      p.gfx.y = p.baseY + Math.sin(p.phase * p.bobSpeed) * p.bobAmplitude;

      // Alpha cycling (firefly glow)
      p.gfx.alpha = AMBIENT_PARTICLE_ALPHA_MIN +
        AMBIENT_PARTICLE_ALPHA_RANGE * ((Math.sin(p.phase * p.alphaSpeed) + 1) / 2);

      // Wrap around world edges (offscreen to avoid pop-in)
      if (p.gfx.x > WORLD_WIDTH + 10) {
        p.gfx.x = -10;
        p.baseY = Math.random() * WORLD_HEIGHT;
      }
    }
  }
}
