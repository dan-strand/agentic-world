import type { ActivityType, VehicleType, AccessoryType, AgentSlot, SessionStatus } from './types';

export const POLL_INTERVAL_MS = 3000;       // 3 seconds per user decision (3-5s range)
export const IDLE_THRESHOLD_MS = 30_000;     // 30 seconds per user decision

export const STATUS_COLORS = {
  active:  0x00d4aa,  // Teal -- mission go
  waiting: 0xf0a030,  // Amber -- standby
  idle:    0x444466,  // Dark/muted -- off duty
  error:   0xcc3333,  // Red -- compromised
} as const;

export const DEFAULT_WINDOW_WIDTH = 1200;
export const DEFAULT_WINDOW_HEIGHT = 800;
export const BACKGROUND_COLOR = 0x1a1a2e;

// Adaptive frame rate
export const FPS_ACTIVE = 30;
export const FPS_IDLE = 5;

// JSONL reading
export const JSONL_TAIL_BUFFER_SIZE = 4096;

// Agent identity -- 8-color palette per user decision
export const AGENT_COLORS = [
  0x00d4aa, // teal
  0xf0a030, // amber
  0x6088ff, // blue
  0xff6060, // coral
  0xaa66ff, // purple
  0x44cc44, // green
  0xff88cc, // pink
  0xcccc44, // yellow
] as const;

export const VEHICLE_TYPES: VehicleType[] = ['car', 'motorcycle', 'van', 'helicopter', 'car', 'motorcycle', 'van', 'helicopter'];
export const ACCESSORIES: AccessoryType[] = ['sunglasses', 'briefcase', 'hat', 'scarf', 'goggles', 'earpiece', 'badge', 'tie'];

// Tool name -> activity category mapping (from research: verified against live JSONL files)
export const TOOL_TO_ACTIVITY: Record<string, ActivityType> = {
  Read: 'reading',
  Grep: 'reading',
  Glob: 'reading',
  Write: 'coding',
  Edit: 'coding',
  NotebookEdit: 'coding',
  Bash: 'testing',
  Task: 'testing',
  TaskCreate: 'testing',
  TaskUpdate: 'testing',
  TaskOutput: 'testing',
  TaskStop: 'testing',
  WebSearch: 'comms',
  WebFetch: 'comms',
  AskUserQuestion: 'comms',
};

// Agent slot assignment -- deterministic hash
export function hashSessionId(sessionId: string): number {
  let hash = 5381;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) + hash + sessionId.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

export function getAgentSlot(sessionId: string): AgentSlot {
  const hash = hashSessionId(sessionId);
  const index = hash % 8;
  return {
    colorIndex: index,
    color: AGENT_COLORS[index],
    accessory: ACCESSORIES[index],
    vehicleType: VEHICLE_TYPES[index],
  };
}

// Compound layout
export const COMPOUND_WIDTH = 160;
export const COMPOUND_HEIGHT = 120;
export const COMPOUND_INNER_RADIUS = 300;
export const COMPOUND_OUTER_RADIUS = 480;
export const HQ_WIDTH = 200;
export const HQ_HEIGHT = 120;

// Animation speeds
export const AGENT_WALK_SPEED = 100;    // pixels per second
export const AGENT_DRIVE_SPEED = 250;   // pixels per second
export const ANIMATION_FRAME_MS = 200;  // ms per animation frame (5fps animation)
export const SPEECH_BUBBLE_DURATION = 4000;  // ms visible before fade
export const SPEECH_BUBBLE_FADE_MS = 1000;   // ms fade-out duration

// JSONL tool detection buffer (larger than status detection)
export const JSONL_TOOL_BUFFER_SIZE = 8192;

// Status tint values (applied to agent container via Container.tint)
export const STATUS_TINTS: Record<SessionStatus, number> = {
  active:  0xffffff,  // No tint -- vivid original colors
  waiting: 0xffaa44,  // Amber tint
  idle:    0x888888,  // Gray/desaturated
  error:   0xff4444,  // Red tint
} as const;

// Animation speed multipliers (applied to frame timer in animateFrames)
export const STATUS_ANIM_SPEED: Record<SessionStatus, number> = {
  active:  1.0,
  waiting: 0.5,
  idle:    0.25,
  error:   0.0,
} as const;

// Status timing constants
export const STATUS_CROSSFADE_MS = 750;     // Tint transition duration (0.5-1s range)
export const STATUS_DEBOUNCE_MS = 2500;     // Only commit visual change if status holds this long
export const SHAKE_DURATION_MS = 600;       // Error shake animation duration
export const SHAKE_AMPLITUDE = 4;           // Error shake max displacement in pixels
export const BREATH_CYCLE_SPEED = 0.002;    // Waiting breathing oscillation speed (~3s full cycle)
export const BREATH_ALPHA_MIN = 0.5;        // Minimum alpha during breathing
export const BREATH_ALPHA_MAX = 1.0;        // Maximum alpha during breathing

// Firework constants
export const FIREWORK_SPARK_COUNT_MIN = 25;
export const FIREWORK_SPARK_COUNT_MAX = 35;
export const FIREWORK_DURATION_MS = 2500;     // Total firework display time
export const FIREWORK_COLORS = [0xffd700, 0xff4444, 0x4488ff, 0x44cc44] as const; // gold, red, blue, green
export const FIREWORK_GRAVITY = 80;           // px/s^2 downward
export const FIREWORK_SPARK_SPEED_MIN = 40;   // px/s minimum outward velocity
export const FIREWORK_SPARK_SPEED_MAX = 120;  // px/s maximum outward velocity
export const FIREWORK_UPWARD_BIAS = 60;       // px/s initial upward velocity bias
export const FIREWORK_SPARK_LIFE_MIN = 1500;  // ms minimum spark lifetime
export const FIREWORK_SPARK_LIFE_MAX = 2500;  // ms maximum spark lifetime
export const FIREWORK_SPARK_SIZE_MIN = 1.5;   // px minimum spark radius
export const FIREWORK_SPARK_SIZE_MAX = 3.5;   // px maximum spark radius
export const CELEBRATION_DURATION_MS = 2500;  // How long agent stays in celebrating state before heading to HQ

// Color utility for tint crossfade
export function lerpColor(from: number, to: number, t: number): number {
  const r1 = (from >> 16) & 0xff;
  const g1 = (from >> 8) & 0xff;
  const b1 = from & 0xff;
  const r2 = (to >> 16) & 0xff;
  const g2 = (to >> 8) & 0xff;
  const b2 = to & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}
