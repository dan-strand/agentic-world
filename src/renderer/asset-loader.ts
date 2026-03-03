import { Assets, Spritesheet, Texture } from 'pixi.js';

/** Tile textures loaded from the spritesheet, keyed by frame name */
export const tileTextures: Record<string, Texture> = {};

/** Building textures loaded from the spritesheet, keyed by frame name */
export const buildingTextures: Record<string, Texture> = {};

/** Campfire texture loaded from the spritesheet, keyed by frame name */
export const campfireTexture: Record<string, Texture> = {};

/** Character animation texture arrays loaded from spritesheet, keyed by animation name */
export const characterAnimations: Record<string, Texture[]> = {};

/** Scenery textures loaded from the spritesheet, keyed by frame name */
export const sceneryTextures: Record<string, Texture> = {};

/**
 * Load all sprite atlases. Must be called after TextureStyle.defaultOptions
 * is configured and before any World/Sprite creation.
 *
 * Atlas files are served from assets/ via CopyWebpackPlugin.
 */
export async function loadAllAssets(): Promise<void> {
  const [tileSheet, buildingSheet, campfireSheet, characterSheet, scenerySheet] = await Promise.all([
    Assets.load('../assets/sprites/tiles.json') as Promise<Spritesheet>,
    Assets.load('../assets/sprites/buildings.json') as Promise<Spritesheet>,
    Assets.load('../assets/sprites/campfire.json') as Promise<Spritesheet>,
    Assets.load('../assets/sprites/characters.json') as Promise<Spritesheet>,
    Assets.load('../assets/sprites/scenery.json') as Promise<Spritesheet>,
  ]);

  // Store texture references for direct use by tilemap builder.
  // Avoids reliance on PixiJS Cache string lookups which can be unreliable
  // when @pixi/tilemap's Texture.from() runs through the webpack bundle.
  for (const [name, texture] of Object.entries(tileSheet.textures)) {
    tileTextures[name] = texture;
  }

  for (const [name, texture] of Object.entries(buildingSheet.textures)) {
    buildingTextures[name] = texture;
  }

  for (const [name, texture] of Object.entries(campfireSheet.textures)) {
    campfireTexture[name] = texture;
  }

  // Store character animation texture arrays for AnimatedSprite creation
  for (const [name, textures] of Object.entries(characterSheet.animations)) {
    characterAnimations[name] = textures;
  }

  // Store scenery textures for world population (trees, props, lanterns, fences)
  for (const [name, texture] of Object.entries(scenerySheet.textures)) {
    sceneryTextures[name] = texture;
  }
}
