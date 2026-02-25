import { Container, Graphics } from 'pixi.js';
import {
  FIREWORK_COLORS,
  FIREWORK_SPARK_COUNT_MIN,
  FIREWORK_SPARK_COUNT_MAX,
  FIREWORK_DURATION_MS,
  FIREWORK_GRAVITY,
  FIREWORK_SPARK_SPEED_MIN,
  FIREWORK_SPARK_SPEED_MAX,
  FIREWORK_UPWARD_BIAS,
  FIREWORK_SPARK_LIFE_MIN,
  FIREWORK_SPARK_LIFE_MAX,
  FIREWORK_SPARK_SIZE_MIN,
  FIREWORK_SPARK_SIZE_MAX,
} from '../shared/constants';

interface Spark {
  gfx: Graphics;
  vx: number;     // velocity x (px/s)
  vy: number;     // velocity y (px/s)
  life: number;   // elapsed life (ms)
  maxLife: number; // total lifespan (ms)
}

/**
 * Fireworks -- A celebratory particle burst effect.
 *
 * Creates 25-35 small Graphics spark objects that explode outward
 * from the origin with gravity, then fade and are cleaned up.
 *
 * Usage:
 *   const fw = new Fireworks(x, y);
 *   parent.addChild(fw);
 *   // In tick: fw.tick(deltaMs);
 *   // When fw.isDone(): parent.removeChild(fw); fw.destroy({ children: true });
 *
 * Multi-color burst palette: gold, red, blue, green (not agent-colored).
 * Per user decision: 2-3 second duration, multiple simultaneous celebrations overlap independently.
 */
export class Fireworks extends Container {
  private sparks: Spark[] = [];
  private elapsed = 0;
  private done = false;

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);
    this.createBurst();
  }

  private createBurst(): void {
    const count = FIREWORK_SPARK_COUNT_MIN +
      Math.floor(Math.random() * (FIREWORK_SPARK_COUNT_MAX - FIREWORK_SPARK_COUNT_MIN + 1));

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = FIREWORK_SPARK_SPEED_MIN +
        Math.random() * (FIREWORK_SPARK_SPEED_MAX - FIREWORK_SPARK_SPEED_MIN);
      const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      const size = FIREWORK_SPARK_SIZE_MIN +
        Math.random() * (FIREWORK_SPARK_SIZE_MAX - FIREWORK_SPARK_SIZE_MIN);
      const maxLife = FIREWORK_SPARK_LIFE_MIN +
        Math.random() * (FIREWORK_SPARK_LIFE_MAX - FIREWORK_SPARK_LIFE_MIN);

      const gfx = new Graphics();
      gfx.circle(0, 0, size).fill(color);

      this.addChild(gfx);
      this.sparks.push({
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - FIREWORK_UPWARD_BIAS, // upward bias
        life: 0,
        maxLife,
      });
    }
  }

  /**
   * Advance the firework simulation.
   * @param deltaMs - Milliseconds since last tick
   */
  tick(deltaMs: number): void {
    if (this.done) return;
    this.elapsed += deltaMs;

    const dt = deltaMs / 1000; // seconds

    for (const spark of this.sparks) {
      spark.life += deltaMs;

      // Physics: gravity pulls sparks downward
      spark.vy += FIREWORK_GRAVITY * dt;
      spark.gfx.x += spark.vx * dt;
      spark.gfx.y += spark.vy * dt;

      // Fade out based on life progress
      const lifeRatio = spark.life / spark.maxLife;
      spark.gfx.alpha = Math.max(0, 1 - lifeRatio);
    }

    if (this.elapsed >= FIREWORK_DURATION_MS) {
      this.done = true;
    }
  }

  /**
   * Whether the firework display has completed.
   */
  isDone(): boolean {
    return this.done;
  }
}
