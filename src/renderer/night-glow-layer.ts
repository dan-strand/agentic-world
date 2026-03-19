import { Container, Sprite, Texture, ImageSource } from 'pixi.js';
import { LIGHT_SOURCE_POSITIONS } from './scenery-layer';
import {
  GLOW_LANTERN_RADIUS, GLOW_TORCH_RADIUS, GLOW_CAMPFIRE_RADIUS, GLOW_WINDOW_RADIUS,
  GLOW_COLOR_WARM, GLOW_COLOR_WINDOW, GLOW_MAX_ALPHA,
} from '../shared/constants';

interface GlowSprite {
  gfx: Sprite;
  maxAlpha: number;
}

/**
 * Cache of pre-rendered gradient textures keyed by `${radius}_${color}`.
 * Each glow type (lantern, torch, campfire, window) gets ONE shared texture.
 */
const gradientTextureCache: Map<string, Texture> = new Map();

/**
 * Create a radial gradient texture for a glow effect.
 * Uses an offscreen canvas with a radial gradient that replicates
 * the 4-step concentric circle alpha pattern from the previous Graphics approach.
 *
 * Cached by radius + color so the same texture is reused for all glows of the same type.
 */
function createGradientTexture(radius: number, color: number): Texture {
  const key = `${radius}_${color}`;
  const cached = gradientTextureCache.get(key);
  if (cached) return cached;

  const size = radius * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Extract RGB components from hex color
  const r = (color >> 16) & 0xFF;
  const g = (color >> 8) & 0xFF;
  const b = color & 0xFF;

  // Create radial gradient replicating the 4-step concentric circle pattern:
  // Steps were: alpha 0.4 at center, 0.3 at 25%, 0.2 at 50%, 0.1 at 75%, 0 at edge
  const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  gradient.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
  gradient.addColorStop(0.25, `rgba(${r},${g},${b},0.3)`);
  gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.2)`);
  gradient.addColorStop(0.75, `rgba(${r},${g},${b},0.1)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new Texture({ source: new ImageSource({ resource: canvas }) });
  gradientTextureCache.set(key, texture);
  return texture;
}

/**
 * Build a Container of glow sprites at all light source positions.
 * Returns the container and an array of glow sprites for alpha updates.
 *
 * Uses pre-rendered gradient Sprite objects instead of Graphics with concentric
 * circle fills. Each glow type shares a single cached gradient texture.
 */
export function buildNightGlowLayer(): { container: Container; glows: GlowSprite[] } {
  const container = new Container();
  container.eventMode = 'none';
  container.interactiveChildren = false;
  const glows: GlowSprite[] = [];

  for (const src of LIGHT_SOURCE_POSITIONS) {
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

    // Create a Sprite using the cached gradient texture for this glow type
    const gradientTexture = createGradientTexture(radius, color);
    const gfx = new Sprite(gradientTexture);
    gfx.anchor.set(0.5, 0.5); // Center positioning (same as Graphics origin)

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

/**
 * Expose the gradient texture cache for testing purposes only.
 * @internal
 */
export function _getGradientCacheForTesting(): Map<string, Texture> {
  return gradientTextureCache;
}
