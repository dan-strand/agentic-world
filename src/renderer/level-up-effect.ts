import { Container, Graphics, FillGradient, Filter } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import {
  LEVEL_UP_DURATION_MS,
  LEVEL_UP_COLUMN_WIDTH,
  LEVEL_UP_COLUMN_HEIGHT,
  LEVEL_UP_SPARKLE_COUNT,
  LEVEL_UP_SPARKLE_COLORS,
  LEVEL_UP_GLOW_DISTANCE,
  LEVEL_UP_GLOW_OUTER_STRENGTH,
  LEVEL_UP_GLOW_COLOR,
  LEVEL_UP_GLOW_QUALITY,
} from '../shared/constants';

interface Sparkle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/**
 * LevelUpEffect -- A golden light column + sparkle shower celebration effect.
 *
 * Replaces the old Fireworks class with an RPG-themed level-up visual.
 * Creates a vertical gradient light column with a shower of gold sparkle
 * particles and a GlowFilter halo around the entire effect.
 *
 * Usage:
 *   const fx = new LevelUpEffect(x, y);
 *   parent.addChild(fx);
 *   // In tick: fx.tick(deltaMs);
 *   // When fx.isDone(): parent.removeChild(fx); fx.destroy({ children: true });
 *
 * Same lifecycle pattern as Fireworks: constructor, tick(deltaMs), isDone().
 */
export class LevelUpEffect extends Container {
  private sparkles: Sparkle[] = [];
  private column: Graphics;
  private elapsed = 0;
  private done = false;

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);

    // Golden light column (vertical gradient rectangle)
    this.column = this.createColumn();
    this.addChild(this.column);

    // Sparkle shower
    this.createSparkles();

    // GlowFilter halo (FX-02)
    this.filters = [new GlowFilter({
      distance: LEVEL_UP_GLOW_DISTANCE,
      outerStrength: LEVEL_UP_GLOW_OUTER_STRENGTH,
      innerStrength: 0.5,
      color: LEVEL_UP_GLOW_COLOR,
      quality: LEVEL_UP_GLOW_QUALITY,
    })];
  }

  private createColumn(): Graphics {
    const column = new Graphics();
    const halfWidth = LEVEL_UP_COLUMN_WIDTH / 2;

    // Try FillGradient with rgba color stops for vertical fade
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: -LEVEL_UP_COLUMN_HEIGHT },
      end: { x: 0, y: 0 },
      colorStops: [
        { offset: 0, color: 'rgba(255, 215, 0, 0)' },       // transparent at top
        { offset: 0.3, color: 'rgba(255, 215, 0, 0.3)' },   // fade in
        { offset: 1, color: 'rgba(255, 215, 0, 0.9)' },     // bright at bottom
      ],
      textureSpace: 'global',
    });

    column.rect(-halfWidth, -LEVEL_UP_COLUMN_HEIGHT, LEVEL_UP_COLUMN_WIDTH, LEVEL_UP_COLUMN_HEIGHT);
    column.fill(gradient);

    return column;
  }

  private createSparkles(): void {
    for (let i = 0; i < LEVEL_UP_SPARKLE_COUNT; i++) {
      const gfx = new Graphics();
      const color = LEVEL_UP_SPARKLE_COLORS[
        Math.floor(Math.random() * LEVEL_UP_SPARKLE_COLORS.length)
      ];
      const radius = 1.5 + Math.random() * 1.5;
      gfx.circle(0, 0, radius).fill(color);

      this.addChild(gfx);
      this.sparkles.push({
        gfx,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 + Math.random() * 40, // mostly downward shower
        life: 0,
        maxLife: 1200 + Math.random() * 800,
      });
    }
  }

  /**
   * Advance the level-up effect simulation.
   * @param deltaMs - Milliseconds since last tick
   */
  tick(deltaMs: number): void {
    if (this.done) return;
    this.elapsed += deltaMs;

    const dt = deltaMs / 1000; // seconds

    // Fade out column in the last 30% of duration
    if (this.elapsed < LEVEL_UP_DURATION_MS * 0.7) {
      this.column.alpha = 1;
    } else {
      const fadeProgress = (this.elapsed - LEVEL_UP_DURATION_MS * 0.7) / (LEVEL_UP_DURATION_MS * 0.3);
      this.column.alpha = Math.max(0, 1 - fadeProgress);
    }

    // Update sparkles
    for (const sparkle of this.sparkles) {
      sparkle.life += deltaMs;

      // Apply gravity (sparkles fall)
      sparkle.vy += 40 * dt;
      sparkle.gfx.x += sparkle.vx * dt;
      sparkle.gfx.y += sparkle.vy * dt;

      // Fade out based on life progress
      const lifeRatio = sparkle.life / sparkle.maxLife;
      if (sparkle.life > sparkle.maxLife) {
        sparkle.gfx.visible = false;
      } else {
        sparkle.gfx.alpha = Math.max(0, 1 - lifeRatio);
      }
    }

    if (this.elapsed >= LEVEL_UP_DURATION_MS) {
      this.done = true;
    }
  }

  /**
   * Whether the level-up effect has completed.
   */
  isDone(): boolean {
    return this.done;
  }

  /**
   * Explicitly destroy GPU resources for all filters (GlowFilter shader programs).
   * Must be called BEFORE container.destroy() since Container.destroy() does NOT
   * destroy filters -- they must be cleaned up manually.
   */
  cleanupFilters(): void {
    if (this.filters) {
      for (const f of this.filters) {
        (f as Filter).destroy();
      }
      this.filters = [];
    }
  }
}
