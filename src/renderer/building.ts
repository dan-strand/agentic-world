import { Container, Sprite, BitmapText, Texture } from 'pixi.js';
import type { BuildingType } from '../shared/constants';
import { BUILDING_LABELS } from '../shared/constants';

/**
 * Building -- A static world entity wrapping a Sprite from the building atlas
 * with a BitmapText label displayed above.
 *
 * Sprite anchor is at (0.5, 1.0) -- bottom-center for ground placement.
 * The Container position represents the ground-center point of the building.
 *
 * Provides agent positioning methods:
 * - getIdlePosition(index, total): fans agents horizontally below the building
 * - getWorkPosition(index, total): fans agents horizontally near building center
 * - getEntrancePosition(): building base, slightly below
 */
export class Building extends Container {
  readonly buildingType: BuildingType;

  constructor(buildingType: BuildingType, texture: Texture) {
    super();
    this.buildingType = buildingType;

    // Sprite from atlas with bottom-center anchor for ground placement
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1.0);
    this.addChild(sprite);

    // Label above building using BitmapText with pixel signpost font
    const label = new BitmapText({
      text: BUILDING_LABELS[buildingType],
      style: {
        fontFamily: 'PixelSignpost',
        fontSize: 16,
      },
    });
    label.anchor.set(0.5, 1);
    // Position label above the sprite top (sprite extends upward from anchor)
    label.position.set(0, -texture.height - 4);
    this.addChild(label);
  }

  /**
   * Get idle position for agents waiting at this building.
   * Fans agents horizontally below the building (y offset +20 from container origin,
   * which is below the sprite since anchor is bottom-center).
   *
   * @param index - Agent's index in the idle queue
   * @param total - Total number of idle agents
   * @returns Position in building-local coordinates
   */
  getIdlePosition(index: number, total: number): { x: number; y: number } {
    const spacing = 30;
    const totalWidth = (total - 1) * spacing;
    const startX = -totalWidth / 2;
    return {
      x: startX + index * spacing,
      y: 20, // Below the building base
    };
  }

  /**
   * Get work position for agents working at this building.
   * Fans agents horizontally near the building center (y offset -16,
   * partway up the building).
   *
   * @param index - Agent's index among workers at this building
   * @param total - Total workers at this building
   * @returns Position in building-local coordinates
   */
  getWorkPosition(index: number, total: number): { x: number; y: number } {
    const spacing = 24;
    const totalWidth = (total - 1) * spacing;
    const startX = -totalWidth / 2;
    return {
      x: startX + index * spacing,
      y: -16, // Partway up the building
    };
  }

  /**
   * Get the entrance position in local coordinates.
   * At the building base, slightly below.
   */
  getEntrancePosition(): { x: number; y: number } {
    return { x: 0, y: 10 };
  }
}
