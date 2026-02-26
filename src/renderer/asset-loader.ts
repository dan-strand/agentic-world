import { Assets } from 'pixi.js';

/**
 * Load all sprite atlases. Must be called after TextureStyle.defaultOptions
 * is configured and before any World/Sprite creation.
 *
 * Atlas files are served from assets/ via CopyWebpackPlugin.
 */
export async function loadAllAssets(): Promise<void> {
  await Assets.load([
    { alias: 'tiles', src: 'assets/sprites/tiles.json' },
    // Future phases will add:
    // { alias: 'buildings', src: 'assets/sprites/buildings.json' },
    // { alias: 'characters', src: 'assets/sprites/characters.json' },
  ]);
}
