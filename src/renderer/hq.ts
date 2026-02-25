import { Container, Graphics, BitmapText } from 'pixi.js';
import { HQ_WIDTH, HQ_HEIGHT } from '../shared/constants';

/**
 * Central HQ building -- the hub of the spy world.
 * Drawn with Graphics primitives: main building, roof accent, door,
 * windows, antenna, guard booth, and "HQ" BitmapText label.
 *
 * Anchor point is at bottom-center so the door/entrance is at origin.
 */
export class HQ extends Container {
  constructor() {
    super();

    const W = HQ_WIDTH;   // 200
    const H = HQ_HEIGHT;  // 120

    // All drawing offset so bottom-center is at (0, 0)
    const left = -W / 2;
    const top = -H;

    const building = new Graphics();

    // Main building body (dark blue-gray)
    building.rect(left, top, W, H).fill(0x3a3a5a);

    // Roof accent strip (lighter blue at the very top)
    building.rect(left, top, W, 8).fill(0x5a5a8a);

    // Antenna on roof (left side)
    building.moveTo(left + 30, top).lineTo(left + 30, top - 18).stroke({ color: 0x888888, width: 2 });
    building.circle(left + 30, top - 20, 3).fill(0xff4444); // antenna tip (red light)

    // Windows -- 2 rows of 3 (lighter rects)
    const windowColor = 0x7799bb;
    const windowW = 24;
    const windowH = 16;
    // Top row of windows
    for (let i = 0; i < 3; i++) {
      const wx = left + 20 + i * 60;
      building.rect(wx, top + 20, windowW, windowH).fill(windowColor);
    }
    // Bottom row of windows (skip center for door area)
    building.rect(left + 20, top + 56, windowW, windowH).fill(windowColor);
    building.rect(left + 140, top + 56, windowW, windowH).fill(windowColor);

    // Door opening at bottom-center (dark opening)
    const doorW = 24;
    const doorH = 32;
    building.rect(-doorW / 2, -doorH, doorW, doorH).fill(0x1a1a2e);
    // Door frame accent
    building.rect(-doorW / 2 - 2, -doorH - 2, doorW + 4, 4).fill(0x5a5a8a);

    // Guard booth near entrance (right side, small)
    const boothX = 40;
    building.rect(boothX, -24, 20, 24).fill(0x4a4a6a);
    building.rect(boothX + 4, -20, 12, 10).fill(windowColor); // booth window

    this.addChild(building);

    // "HQ" BitmapText label on the building facade
    const label = new BitmapText({
      text: 'HQ',
      style: {
        fontFamily: 'PixelSignpost',
        fontSize: 16,
      },
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(0, top + 48); // Center of building facade
    this.addChild(label);
  }

  /**
   * Get idle position for agents waiting at HQ.
   * Fans agents out in a row in front of the HQ entrance.
   *
   * @param index - Agent's index in the idle queue
   * @param totalIdle - Total number of idle agents
   * @returns Position in HQ-local coordinates
   */
  getIdlePosition(index: number, totalIdle: number): { x: number; y: number } {
    // Fan out horizontally in front of the door, spaced 30px apart
    const spacing = 30;
    const totalWidth = (totalIdle - 1) * spacing;
    const startX = -totalWidth / 2;

    return {
      x: startX + index * spacing,
      y: 30, // 30px in front of the door
    };
  }
}
