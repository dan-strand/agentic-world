import { Container, Graphics } from 'pixi.js';
import { GraphicsPool } from './graphics-pool';
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
  FIREFLY_NIGHT_ALPHA_BOOST,
  SPARK_COUNT,
  SPARK_SPAWN_MS,
  SPARK_COLOR,
  SPARK_RISE_SPEED,
  SPARK_DRIFT_SPEED,
  SPARK_LIFETIME_MS,
  SPARK_SIZE,
  SPARK_ORIGIN,
  DUST_MOTE_COUNT,
  DUST_MOTE_SIZE_MIN,
  DUST_MOTE_SIZE_MAX,
  DUST_MOTE_COLOR,
  DUST_MOTE_DRIFT_MIN,
  DUST_MOTE_DRIFT_MAX,
  DUST_MOTE_BOB_AMP,
  LEAF_COUNT,
  LEAF_SIZE,
  LEAF_COLORS,
  LEAF_DRIFT_SPEED,
  LEAF_FALL_SPEED,
  LEAF_BOB_AMP,
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

interface SparkParticle {
  gfx: Graphics;
  age: number;
  vx: number;
  vy: number;
}

interface DustMote {
  gfx: Graphics;
  baseY: number;
  driftSpeed: number;
  bobSpeed: number;
  phase: number;
  baseAlpha: number;
}

interface LeafParticle {
  gfx: Graphics;
  driftSpeed: number;
  fallSpeed: number;
  bobSpeed: number;
  phase: number;
}

/**
 * AmbientParticles -- Persistent floating firefly/magic dust particles,
 * forge sparks, dust motes, and drifting leaves.
 *
 * Creates multiple particle types that create an atmospheric world effect:
 * - 25 fireflies: drift horizontally with sine-wave bob and alpha cycling
 * - 8 sparks: rise from Training Grounds with short lifetime
 * - 15 dust motes: drift during daytime, fade at night
 * - 6 leaves: fall slowly with horizontal sway
 *
 * All particles are modulated by nightIntensity from the day/night cycle.
 *
 * Usage:
 *   const particles = new AmbientParticles();
 *   worldContainer.addChild(particles);
 *   // In tick: particles.tick(deltaMs, nightIntensity);
 *
 * This effect runs continuously -- it has no isDone() method.
 */
export class AmbientParticles extends Container {
  private particles: AmbientParticle[] = [];
  private sparkParticles: SparkParticle[] = [];
  private sparkTimer = 0;
  private sparkPool: GraphicsPool;
  private dustMotes: DustMote[] = [];
  private leafParticles: LeafParticle[] = [];

  constructor() {
    super();

    // --- Fireflies ---
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

    // --- Dust Motes (pre-created like fireflies) ---
    for (let i = 0; i < DUST_MOTE_COUNT; i++) {
      const gfx = new Graphics();
      const radius = DUST_MOTE_SIZE_MIN +
        Math.random() * (DUST_MOTE_SIZE_MAX - DUST_MOTE_SIZE_MIN);
      gfx.circle(0, 0, radius).fill(DUST_MOTE_COLOR);

      gfx.x = Math.random() * WORLD_WIDTH;
      gfx.y = Math.random() * WORLD_HEIGHT;
      gfx.alpha = 0.3 + Math.random() * 0.3;

      this.addChild(gfx);

      this.dustMotes.push({
        gfx,
        baseY: gfx.y,
        driftSpeed: DUST_MOTE_DRIFT_MIN +
          Math.random() * (DUST_MOTE_DRIFT_MAX - DUST_MOTE_DRIFT_MIN),
        bobSpeed: 0.3 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        baseAlpha: 0.3 + Math.random() * 0.3,
      });
    }

    // --- Drifting Leaves (pre-created, fixed count) ---
    for (let i = 0; i < LEAF_COUNT; i++) {
      const gfx = new Graphics();
      const color = LEAF_COLORS[i % LEAF_COLORS.length];
      // Slightly elongated rectangle for leaf feel (2.5 x 1.5)
      gfx.rect(-LEAF_SIZE / 2, -LEAF_SIZE * 0.3, LEAF_SIZE, LEAF_SIZE * 0.6).fill(color);

      gfx.x = Math.random() * WORLD_WIDTH;
      gfx.y = Math.random() * WORLD_HEIGHT;
      gfx.alpha = 0.5 + Math.random() * 0.3;

      this.addChild(gfx);

      this.leafParticles.push({
        gfx,
        driftSpeed: LEAF_DRIFT_SPEED * (0.7 + Math.random() * 0.6),
        fallSpeed: LEAF_FALL_SPEED * (0.8 + Math.random() * 0.4),
        bobSpeed: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // --- Spark pool (pre-allocated, no create/destroy churn in tick) ---
    this.sparkPool = new GraphicsPool(
      () => {
        const g = new Graphics();
        g.circle(0, 0, SPARK_SIZE).fill({ color: SPARK_COLOR, alpha: 1.0 });
        return g;
      },
      SPARK_COUNT,
      this,
    );
  }

  /**
   * Advance the ambient particle simulation.
   * @param deltaMs - Milliseconds since last tick
   * @param nightIntensity - 0 = day, 1 = full night (from DayNightCycle)
   */
  tick(deltaMs: number, nightIntensity: number = 0): void {
    const dt = deltaMs / 1000;

    // --- Fireflies (night-boosted alpha) ---
    const nightBoost = FIREFLY_NIGHT_ALPHA_BOOST * nightIntensity;

    for (const p of this.particles) {
      p.phase += dt;

      // Horizontal drift
      p.gfx.x += p.driftSpeed * dt;

      // Sine-wave vertical bob
      p.gfx.y = p.baseY + Math.sin(p.phase * p.bobSpeed) * p.bobAmplitude;

      // Alpha cycling (firefly glow) with night boost
      p.gfx.alpha = Math.min(1.0,
        AMBIENT_PARTICLE_ALPHA_MIN + nightBoost +
        AMBIENT_PARTICLE_ALPHA_RANGE * ((Math.sin(p.phase * p.alphaSpeed) + 1) / 2));

      // Wrap around world edges (offscreen to avoid pop-in)
      if (p.gfx.x > WORLD_WIDTH + 10) {
        p.gfx.x = -10;
        p.baseY = Math.random() * WORLD_HEIGHT;
      }
    }

    // --- Sparks (near Training Grounds forge, pooled Phase 24) ---
    this.sparkTimer += deltaMs;
    if (this.sparkTimer >= SPARK_SPAWN_MS && this.sparkParticles.length < SPARK_COUNT) {
      this.sparkTimer -= SPARK_SPAWN_MS;
      // Borrow a pre-allocated spark Graphics from pool (no new Graphics())
      const gfx = this.sparkPool.borrow();
      if (gfx) {
        gfx.position.set(
          SPARK_ORIGIN.x + (Math.random() - 0.5) * 20,
          SPARK_ORIGIN.y,
        );
        this.sparkParticles.push({
          gfx,
          age: 0,
          vx: (Math.random() - 0.5) * SPARK_DRIFT_SPEED * 2,
          vy: -SPARK_RISE_SPEED * (0.8 + Math.random() * 0.4),
        });
      }
    }
    // Update existing sparks
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const s = this.sparkParticles[i];
      s.age += deltaMs;
      s.gfx.x += s.vx * dt;
      s.gfx.y += s.vy * dt;
      const lifeT = s.age / SPARK_LIFETIME_MS;
      s.gfx.alpha = Math.max(0, 1 - lifeT);
      if (s.age >= SPARK_LIFETIME_MS) {
        this.sparkPool.return(s.gfx);
        this.sparkParticles.splice(i, 1);
      }
    }

    // --- Dust Motes (daytime visible, fade at night) ---
    for (const m of this.dustMotes) {
      m.phase += dt;

      // Horizontal drift
      m.gfx.x += m.driftSpeed * dt;

      // Gentle vertical bob
      m.gfx.y = m.baseY + Math.sin(m.phase * m.bobSpeed) * DUST_MOTE_BOB_AMP;

      // Alpha modulated by daytime (inverse of nightIntensity) -- fade at night
      m.gfx.alpha = m.baseAlpha * (1 - nightIntensity * 0.8);

      // Wrap around world edges
      if (m.gfx.x > WORLD_WIDTH + 10) {
        m.gfx.x = -10;
        m.baseY = Math.random() * WORLD_HEIGHT;
      }
    }

    // --- Drifting Leaves ---
    for (const l of this.leafParticles) {
      l.phase += dt;

      // Horizontal drift with sine-wave bob (gentle sway)
      l.gfx.x += l.driftSpeed * dt + Math.sin(l.phase * l.bobSpeed) * LEAF_BOB_AMP * dt;

      // Slow downward fall
      l.gfx.y += l.fallSpeed * dt;

      // Wrap around: when below world, return to top
      if (l.gfx.y > WORLD_HEIGHT + 10) {
        l.gfx.y = -10;
        l.gfx.x = Math.random() * WORLD_WIDTH;
      }
      // Wrap horizontally
      if (l.gfx.x > WORLD_WIDTH + 10) {
        l.gfx.x = -10;
      }
    }
  }
}
