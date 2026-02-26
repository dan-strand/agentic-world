import { Assets, Spritesheet, Texture } from 'pixi.js';

/** Tile textures loaded from the spritesheet, keyed by frame name */
export const tileTextures: Record<string, Texture> = {};

/**
 * Load all sprite atlases. Must be called after TextureStyle.defaultOptions
 * is configured and before any World/Sprite creation.
 *
 * Atlas files are served from assets/ via CopyWebpackPlugin.
 */
export async function loadAllAssets(): Promise<void> {
  const sheet: Spritesheet = await Assets.load('../assets/sprites/tiles.json');

  // Store texture references for direct use by tilemap builder.
  // Avoids reliance on PixiJS Cache string lookups which can be unreliable
  // when @pixi/tilemap's Texture.from() runs through the webpack bundle.
  for (const [name, texture] of Object.entries(sheet.textures)) {
    tileTextures[name] = texture;
  }
}
