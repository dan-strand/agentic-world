import { Container, Graphics } from 'pixi.js';
import { LIGHT_SOURCE_POSITIONS } from './scenery-layer';
import {
  GLOW_LANTERN_RADIUS, GLOW_TORCH_RADIUS, GLOW_CAMPFIRE_RADIUS, GLOW_WINDOW_RADIUS,
  GLOW_COLOR_WARM, GLOW_COLOR_WINDOW, GLOW_MAX_ALPHA,
} from '../shared/constants';

interface GlowSprite {
  gfx: Graphics;
  maxAlpha: number;
}

/**
 * Build a Container of glow sprites at all light source positions.
 * Returns the container and an array of glow sprites for alpha updates.
 */
export function buildNightGlowLayer(): { container: Container; glows: GlowSprite[] } {
  const container = new Container();
  container.eventMode = 'none';
  container.interactiveChildren = false;
  const glows: GlowSprite[] = [];

  for (const src of LIGHT_SOURCE_POSITIONS) {
    const gfx = new Graphics();
    let radius: number;
    let color: number;

    switch (src.type) {
      case 'lantern':
        radius = GLOW_LANTERN_RADIUS;
        color = GLOW_COLOR_WARM;
        break;
      case 'torch':
        radius = GLOW_TORCH_RADIUS;
        color = GLOW_COLOR_WARM;
        break;
      case 'campfire':
        radius = GLOW_CAMPFIRE_RADIUS;
        color = GLOW_COLOR_WARM;
        break;
      case 'window':
        radius = GLOW_WINDOW_RADIUS;
        color = GLOW_COLOR_WINDOW;
        break;
    }

    // Draw a filled circle with additive-blend feel using alpha gradient
    // Center bright, edges transparent -- achieved via concentric circles with decreasing alpha
    const steps = 4;
    for (let i = steps; i >= 1; i--) {
      const stepRadius = radius * (i / steps);
      const stepAlpha = (1 - (i - 1) / steps) * 0.4;
      gfx.circle(0, 0, stepRadius);
      gfx.fill({ color, alpha: stepAlpha });
    }

    gfx.position.set(src.x, src.y);
    gfx.alpha = 0; // Start invisible (daytime)

    container.addChild(gfx);
    glows.push({ gfx, maxAlpha: GLOW_MAX_ALPHA });
  }

  return { container, glows };
}

/**
 * Update glow sprite alphas based on current night intensity.
 * @param glows - Array of glow sprites from buildNightGlowLayer()
 * @param nightIntensity - 0 (day) to 1 (full night) from DayNightCycle
 */
export function updateNightGlowLayer(glows: GlowSprite[], nightIntensity: number): void {
  for (const glow of glows) {
    glow.gfx.alpha = glow.maxAlpha * nightIntensity;
  }
}
