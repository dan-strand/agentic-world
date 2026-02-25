import { GraphicsContext } from 'pixi.js';
import type { ActivityType } from '../shared/types';

const iconContexts = new Map<ActivityType, GraphicsContext>();

/**
 * Pre-build all activity icon GraphicsContexts at init time.
 * Each icon is ~14x14px drawn with simple Graphics primitives.
 * These contexts are swapped onto the speech bubble icon Graphics.
 */
export function initActivityIcons(): void {
  // coding icon -- wrench shape
  const coding = new GraphicsContext();
  // Wrench handle (diagonal)
  coding.moveTo(2, 12).lineTo(8, 6).stroke({ color: 0x333333, width: 2 });
  // Wrench head (open-end shape)
  coding.moveTo(8, 6).lineTo(10, 3).stroke({ color: 0x333333, width: 2 });
  coding.moveTo(8, 6).lineTo(12, 5).stroke({ color: 0x333333, width: 2 });
  // Second wrench crossing
  coding.moveTo(12, 12).lineTo(6, 6).stroke({ color: 0x555555, width: 2 });
  coding.moveTo(6, 6).lineTo(4, 3).stroke({ color: 0x555555, width: 2 });
  coding.moveTo(6, 6).lineTo(2, 5).stroke({ color: 0x555555, width: 2 });
  iconContexts.set('coding', coding);

  // reading icon -- magnifying glass
  const reading = new GraphicsContext();
  // Glass circle
  reading.circle(6, 5, 4).stroke({ color: 0x333333, width: 2 });
  // Handle
  reading.moveTo(9, 8).lineTo(13, 13).stroke({ color: 0x333333, width: 2.5 });
  iconContexts.set('reading', reading);

  // testing icon -- gear/cog
  const testing = new GraphicsContext();
  // Center circle
  testing.circle(7, 7, 2.5).fill(0x333333);
  // Outer ring
  testing.circle(7, 7, 5).stroke({ color: 0x333333, width: 1.5 });
  // Cog teeth (4 small rects at cardinal directions)
  testing.rect(5.5, 0, 3, 2.5).fill(0x333333);    // top
  testing.rect(5.5, 11.5, 3, 2.5).fill(0x333333);  // bottom
  testing.rect(0, 5.5, 2.5, 3).fill(0x333333);     // left
  testing.rect(11.5, 5.5, 2.5, 3).fill(0x333333);  // right
  iconContexts.set('testing', testing);

  // comms icon -- antenna with signal arcs
  const comms = new GraphicsContext();
  // Antenna base triangle/mast
  comms.moveTo(7, 13).lineTo(7, 5).stroke({ color: 0x333333, width: 2 });
  // Antenna tip
  comms.circle(7, 4, 1.5).fill(0x333333);
  // Signal arcs (left)
  comms.arc(7, 4, 5, -Math.PI * 0.8, -Math.PI * 0.55).stroke({ color: 0x555555, width: 1.2 });
  // Signal arcs (right)
  comms.arc(7, 4, 5, -Math.PI * 0.45, -Math.PI * 0.2).stroke({ color: 0x555555, width: 1.2 });
  // Wider arcs
  comms.arc(7, 4, 8, -Math.PI * 0.75, -Math.PI * 0.58).stroke({ color: 0x777777, width: 1 });
  comms.arc(7, 4, 8, -Math.PI * 0.42, -Math.PI * 0.25).stroke({ color: 0x777777, width: 1 });
  iconContexts.set('comms', comms);

  // idle icon -- pause bars (two vertical parallel bars)
  const idle = new GraphicsContext();
  idle.roundRect(3, 2, 3, 10, 1).fill(0x888888);
  idle.roundRect(8, 2, 3, 10, 1).fill(0x888888);
  iconContexts.set('idle', idle);
}

/**
 * Get pre-built GraphicsContext for the given activity type.
 * Returns undefined if initActivityIcons() has not been called.
 */
export function getActivityIcon(activity: ActivityType): GraphicsContext | undefined {
  return iconContexts.get(activity);
}
