import { Texture, ImageSource, Rectangle } from 'pixi.js';
import type { CharacterClass } from '../shared/types';
import { PALETTE_DEFS, TEMPLATE_COLORS } from '../shared/constants';
import type { PaletteDef } from '../shared/constants';

/**
 * Cache of palette-swapped texture arrays.
 * Key: `${characterClass}_${paletteIndex}_${firstTextureUid}` -> Texture[]
 * Prevents re-creating textures for same class+palette+animation combo.
 */
const swapCache: Map<string, Texture[]> = new Map();

/** Color match tolerance per channel (handles shading variants in atlas) */
const TOLERANCE = 15;

/**
 * Create palette-swapped animation textures for a specific character class and palette.
 * Takes the base animation textures and replaces template colors with palette colors.
 *
 * Uses an offscreen canvas to read/modify pixel data. Template colors (the base RGB
 * values baked into the atlas by generate-characters.js) are replaced with the palette
 * colors, preserving brightness deltas so shading/highlight detail is maintained.
 *
 * @param baseTextures - Original animation texture array from characterAnimations
 * @param characterClass - The character class (determines which template colors to replace)
 * @param paletteIndex - Index into PALETTE_DEFS
 * @returns New Texture[] with palette-swapped colors
 */
export function createPaletteSwappedTextures(
  baseTextures: Texture[],
  characterClass: CharacterClass,
  paletteIndex: number,
): Texture[] {
  // Build cache key from class + palette + first texture UID
  const firstUid = baseTextures[0]?.uid ?? 0;
  const cacheKey = `${characterClass}_${paletteIndex}_${firstUid}`;

  const cached = swapCache.get(cacheKey);
  if (cached) return cached;

  const template = TEMPLATE_COLORS[characterClass];
  const palette = PALETTE_DEFS[paletteIndex];

  // Template/palette region pairs for matching
  const regions: Array<{ tmpl: [number, number, number]; repl: [number, number, number] }> = [
    { tmpl: template.robe, repl: palette.robe },
    { tmpl: template.hair, repl: palette.hair },
    { tmpl: template.accent, repl: palette.accent },
  ];

  // Determine frame dimensions from the first base texture
  const firstFrame = baseTextures[0].frame;
  const fw = Math.round(firstFrame.width);
  const fh = Math.round(firstFrame.height);
  const frameCount = baseTextures.length;

  // Create ONE atlas canvas sized (frameCount * frameWidth) x frameHeight
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = fw * frameCount;
  atlasCanvas.height = fh;
  const atlasCtx = atlasCanvas.getContext('2d')!;

  // Process each frame and draw into the atlas at the correct x offset
  for (let idx = 0; idx < frameCount; idx++) {
    const tex = baseTextures[idx];
    const source = tex.source;
    const resource = source.resource as HTMLImageElement | HTMLCanvasElement | ImageBitmap;

    // Determine frame bounds within the original atlas
    const frame = tex.frame;
    const fx = Math.round(frame.x);
    const fy = Math.round(frame.y);

    // Use a temporary canvas at frame size for pixel manipulation
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = fw;
    tmpCanvas.height = fh;
    const tmpCtx = tmpCanvas.getContext('2d')!;

    // Draw just the frame region from the atlas source
    tmpCtx.drawImage(resource as CanvasImageSource, fx, fy, fw, fh, 0, 0, fw, fh);

    // Read pixel data
    const imageData = tmpCtx.getImageData(0, 0, fw, fh);
    const data = imageData.data;

    // Swap colors pixel by pixel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip fully transparent pixels
      if (a === 0) continue;

      // Check each template region for a match
      for (const region of regions) {
        const dr = r - region.tmpl[0];
        const dg = g - region.tmpl[1];
        const db = b - region.tmpl[2];

        if (Math.abs(dr) <= TOLERANCE && Math.abs(dg) <= TOLERANCE && Math.abs(db) <= TOLERANCE) {
          // Match found -- replace with palette color, preserving brightness delta
          data[i] = Math.max(0, Math.min(255, region.repl[0] + dr));
          data[i + 1] = Math.max(0, Math.min(255, region.repl[1] + dg));
          data[i + 2] = Math.max(0, Math.min(255, region.repl[2] + db));
          break; // First match wins (regions don't overlap)
        }
      }
    }

    // Write swapped pixels into the atlas at the correct x offset
    atlasCtx.putImageData(imageData, idx * fw, 0);
  }

  // Create ONE ImageSource from the consolidated atlas canvas
  const atlasSource = new ImageSource({ resource: atlasCanvas });

  // Create individual Texture wrappers with frame rectangles into the shared atlas
  const swapped: Texture[] = [];
  for (let idx = 0; idx < frameCount; idx++) {
    const newTex = new Texture({
      source: atlasSource,
      frame: new Rectangle(idx * fw, 0, fw, fh),
    });
    swapped.push(newTex);
  }

  swapCache.set(cacheKey, swapped);
  return swapped;
}

/**
 * Destroy all cached palette-swapped textures for a specific class+palette combo.
 * Call when an agent is removed and no other active agent shares the same combo.
 *
 * Destroys both the ImageSource (GPU texture) and the Texture wrapper for each entry.
 * Multiple cache entries may match (one per animation state with different firstTextureUid).
 */
export function destroyCachedTextures(characterClass: CharacterClass, paletteIndex: number): void {
  const prefix = `${characterClass}_${paletteIndex}_`;
  for (const [key, textures] of swapCache) {
    if (key.startsWith(prefix)) {
      // All textures share a single atlas ImageSource -- destroy it once via the first texture
      const sharedSource = textures[0]?.source;
      if (sharedSource) sharedSource.destroy();
      // Destroy individual Texture wrappers (does not re-destroy the source)
      for (const tex of textures) {
        tex.destroy();
      }
      swapCache.delete(key);
    }
  }
}

/**
 * Get the current number of entries in the swap cache.
 * Useful for monitoring cache growth and verifying cleanup.
 */
export function getSwapCacheSize(): number {
  return swapCache.size;
}

/**
 * Expose the swap cache for testing purposes only.
 * @internal
 */
export function _getSwapCacheForTesting(): Map<string, Texture[]> {
  return swapCache;
}
