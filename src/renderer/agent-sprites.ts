import { GraphicsContext } from 'pixi.js';
import type { AccessoryType } from '../shared/types';
import { AGENT_COLORS, ANIMATION_FRAME_MS } from '../shared/constants';

/**
 * AgentSprites -- Pre-built GraphicsContext animation frames for all agent variants.
 *
 * Uses composited approach: body frames (color-dependent) and accessory frames
 * are separate layers, combined at render time via child Graphics on the Agent Container.
 *
 * Body frames: 8 colors * 3 states * 4 frames = 96 GraphicsContext objects
 * Accessory frames: 8 AccessoryType-specific contexts
 * Total: 104 pre-built GraphicsContext objects
 *
 * CRITICAL: Never call graphics.clear() in animation loops.
 * Swap context via `graphics.context = frames[index]` instead.
 */

type AnimState = 'idle' | 'walking' | 'working';

// Module-level cache
const bodyFrameCache: Map<string, GraphicsContext[]> = new Map();
const accessoryCache: Map<AccessoryType, GraphicsContext> = new Map();
let initialized = false;

// Skin tone for all agents
const SKIN_TONE = 0xffd9b3;
const LEG_COLOR = 0x333344;

/**
 * Build 4 idle animation frames for a given agent color.
 * Subtle vertical bobbing (2px sinusoidal offset per frame).
 */
function buildIdleFrames(color: number): GraphicsContext[] {
  const frames: GraphicsContext[] = [];
  for (let i = 0; i < 4; i++) {
    const ctx = new GraphicsContext();
    const yOff = Math.sin((i / 4) * Math.PI * 2) * 2;

    // Head - circle at ~(24, 12)
    ctx.circle(24, 12 + yOff, 6).fill(SKIN_TONE);

    // Hat/hair area - rect at top
    ctx.rect(18, 4 + yOff, 12, 5).fill(color);

    // Body/trenchcoat
    ctx.rect(16, 18 + yOff, 16, 20).fill(color);

    // Arms at sides (relaxed)
    ctx.rect(12, 20 + yOff, 4, 14).fill(color);
    ctx.rect(32, 20 + yOff, 4, 14).fill(color);

    // Legs - two rects, stable for idle
    ctx.rect(18, 38 + yOff, 5, 8).fill(LEG_COLOR);
    ctx.rect(25, 38 + yOff, 5, 8).fill(LEG_COLOR);

    frames.push(ctx);
  }
  return frames;
}

/**
 * Build 4 walking animation frames for a given agent color.
 * Alternating leg positions to simulate walking, slight body lean.
 */
function buildWalkingFrames(color: number): GraphicsContext[] {
  const frames: GraphicsContext[] = [];
  // Leg offsets for walking cycle: [leftLegY, rightLegY]
  const legOffsets: [number, number][] = [
    [0, 3],   // frame 0: left forward
    [1, 1],   // frame 1: both centered (passing)
    [3, 0],   // frame 2: right forward
    [1, 1],   // frame 3: both centered (passing back)
  ];

  for (let i = 0; i < 4; i++) {
    const ctx = new GraphicsContext();
    const lean = (i === 0 || i === 2) ? 1 : 0; // slight lean when striding

    // Head
    ctx.circle(24 + lean, 12, 6).fill(SKIN_TONE);

    // Hat/hair area
    ctx.rect(18 + lean, 4, 12, 5).fill(color);

    // Body/trenchcoat
    ctx.rect(16 + lean, 18, 16, 20).fill(color);

    // Arms swinging (opposite to legs)
    const armSwing = (i === 0) ? -2 : (i === 2) ? 2 : 0;
    ctx.rect(12 + lean, 20 - armSwing, 4, 14).fill(color);
    ctx.rect(32 + lean, 20 + armSwing, 4, 14).fill(color);

    // Legs with offset
    const [leftOff, rightOff] = legOffsets[i];
    ctx.rect(18 + lean, 38 - leftOff, 5, 8 + leftOff).fill(LEG_COLOR);
    ctx.rect(25 + lean, 38 - rightOff, 5, 8 + rightOff).fill(LEG_COLOR);

    frames.push(ctx);
  }
  return frames;
}

/**
 * Build 4 working animation frames for a given agent color.
 * Arm movement (typing/adjusting), character leans forward slightly.
 */
function buildWorkingFrames(color: number): GraphicsContext[] {
  const frames: GraphicsContext[] = [];
  // Arm positions for working cycle
  const armYOffsets = [0, -2, -4, -2]; // arms move up/down (typing motion)

  for (let i = 0; i < 4; i++) {
    const ctx = new GraphicsContext();
    const lean = 2; // constant forward lean

    // Head (leaning forward)
    ctx.circle(24 + lean, 12, 6).fill(SKIN_TONE);

    // Hat/hair area
    ctx.rect(18 + lean, 4, 12, 5).fill(color);

    // Body/trenchcoat (leaning forward)
    ctx.rect(16 + lean, 18, 16, 20).fill(color);

    // Arms extended forward with typing motion
    const armOff = armYOffsets[i];
    ctx.rect(12 + lean, 22 + armOff, 4, 12).fill(color);
    ctx.rect(32 + lean, 22 - armOff, 4, 12).fill(color); // opposite arm

    // Legs stable while working
    ctx.rect(18, 38, 5, 8).fill(LEG_COLOR);
    ctx.rect(25, 38, 5, 8).fill(LEG_COLOR);

    frames.push(ctx);
  }
  return frames;
}

/**
 * Build accessory GraphicsContext for a given accessory type.
 * These are drawn as overlays, positioned relative to the 48x48 body.
 */
function buildAccessory(accessory: AccessoryType): GraphicsContext {
  const ctx = new GraphicsContext();

  switch (accessory) {
    case 'sunglasses':
      // Dark rect across eye area
      ctx.rect(19, 10, 10, 3).fill(0x111111);
      // Lens frames
      ctx.rect(19, 10, 4, 3).stroke({ color: 0x222222, width: 0.5 });
      ctx.rect(25, 10, 4, 3).stroke({ color: 0x222222, width: 0.5 });
      break;

    case 'briefcase':
      // Small rectangle at hand level, brown
      ctx.rect(34, 32, 8, 6).fill(0x8B5A2B);
      ctx.rect(36, 30, 4, 2).fill(0x8B5A2B); // handle
      break;

    case 'hat':
      // Wide brim hat above head (fedora-style)
      ctx.rect(15, 2, 18, 3).fill(0x555555); // brim
      ctx.rect(18, 0, 12, 4).fill(0x444444); // crown
      break;

    case 'scarf':
      // Wavy rect at neck level
      ctx.rect(18, 16, 12, 3).fill(0xcc8888);
      ctx.rect(16, 17, 4, 5).fill(0xcc8888); // dangling end
      break;

    case 'goggles':
      // Two small circles at eye area with strap
      ctx.circle(21, 11, 3).stroke({ color: 0xddbb33, width: 1 });
      ctx.circle(27, 11, 3).stroke({ color: 0xddbb33, width: 1 });
      // Strap line
      ctx.moveTo(18, 11).lineTo(30, 11).stroke({ color: 0xddbb33, width: 0.5 });
      break;

    case 'earpiece':
      // Small dot near ear area
      ctx.circle(30, 11, 2).fill(0x33cc33);
      // Thin wire down
      ctx.moveTo(30, 13).lineTo(30, 16).stroke({ color: 0x33cc33, width: 0.5 });
      break;

    case 'badge':
      // Small rect on chest area, metallic
      ctx.rect(20, 22, 6, 6).fill(0xccaa44);
      ctx.rect(21, 23, 4, 4).fill(0xddcc66); // inner shine
      break;

    case 'tie':
      // Thin vertical rect from neck down
      ctx.rect(23, 17, 3, 12).fill(0xcc3333);
      // Knot
      ctx.rect(22, 16, 5, 2).fill(0xaa2222);
      break;
  }

  return ctx;
}

/**
 * Initialize all pre-built GraphicsContext frames.
 * Call once at application startup before creating any Agent objects.
 *
 * Builds:
 * - 96 body GraphicsContext objects (8 colors * 3 states * 4 frames)
 * - 8 accessory GraphicsContext objects (one per AccessoryType)
 */
export function initAgentSprites(): void {
  if (initialized) return;

  // Build body frames for each color and state
  for (let colorIdx = 0; colorIdx < AGENT_COLORS.length; colorIdx++) {
    const color = AGENT_COLORS[colorIdx];
    bodyFrameCache.set(`${colorIdx}-idle`, buildIdleFrames(color));
    bodyFrameCache.set(`${colorIdx}-walking`, buildWalkingFrames(color));
    bodyFrameCache.set(`${colorIdx}-working`, buildWorkingFrames(color));
  }

  // Build accessory contexts
  const accessories: AccessoryType[] = [
    'sunglasses', 'briefcase', 'hat', 'scarf',
    'goggles', 'earpiece', 'badge', 'tie',
  ];
  for (const acc of accessories) {
    accessoryCache.set(acc, buildAccessory(acc));
  }

  initialized = true;
}

/**
 * Get pre-built body animation frames for a given color index and animation state.
 * Returns array of 4 GraphicsContext objects for frame-swapping.
 *
 * @throws if initAgentSprites() has not been called
 */
export function getBodyFrames(colorIndex: number, state: AnimState): GraphicsContext[] {
  if (!initialized) {
    throw new Error('AgentSprites not initialized. Call initAgentSprites() first.');
  }
  const key = `${colorIndex}-${state}`;
  const frames = bodyFrameCache.get(key);
  if (!frames) {
    throw new Error(`No body frames for colorIndex=${colorIndex}, state=${state}`);
  }
  return frames;
}

/**
 * Get pre-built accessory GraphicsContext for a given accessory type.
 * Returns a single GraphicsContext (accessories follow body offset, don't animate independently).
 *
 * @throws if initAgentSprites() has not been called
 */
export function getAccessoryContext(accessory: AccessoryType): GraphicsContext {
  if (!initialized) {
    throw new Error('AgentSprites not initialized. Call initAgentSprites() first.');
  }
  const ctx = accessoryCache.get(accessory);
  if (!ctx) {
    throw new Error(`No accessory context for type=${accessory}`);
  }
  return ctx;
}

export { buildIdleFrames as buildBodyFrames, buildAccessory as buildAccessoryFrames };
