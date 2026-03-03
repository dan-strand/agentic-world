import { Texture } from 'pixi.js';
import type { CharacterClass } from '../shared/types';
import { characterAnimations } from './asset-loader';

export type AnimState = 'idle' | 'walk' | 'work' | 'celebrate';

/**
 * Get character animation texture array for a given class and state.
 * Returns Texture[] suitable for AnimatedSprite constructor or texture swap.
 *
 * Animation names follow the pattern: `{class}_{state}` (e.g., "mage_idle", "warrior_walk").
 * These map to the "animations" field in characters.json loaded by asset-loader.ts.
 *
 * @throws if characterAnimations has not been loaded (loadAllAssets not called)
 */
export function getCharacterAnimation(characterClass: CharacterClass, state: AnimState): Texture[] {
  const key = `${characterClass}_${state}`;
  const textures = characterAnimations[key];
  if (!textures) {
    throw new Error(`No character animation for key="${key}". Was loadAllAssets() called?`);
  }
  return textures;
}
