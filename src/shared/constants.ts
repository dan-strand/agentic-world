import type { ActivityType, VehicleType, AccessoryType, AgentSlot } from './types';

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
