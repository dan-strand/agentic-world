import type { ActivityType, CharacterClass, AgentSlot, SessionStatus } from './types';

export const POLL_INTERVAL_MS = 3000;       // 3 seconds per user decision (3-5s range)
export const IDLE_THRESHOLD_MS = 30_000;     // 30 seconds per user decision
export const STALE_SESSION_MS = 30 * 60 * 1000; // 30 minutes -- sessions older than this are not shown

export const STATUS_COLORS = {
  active:  0x00d4aa,  // Teal -- mission go
  waiting: 0xf0a030,  // Amber -- standby
  idle:    0x444466,  // Dark/muted -- off duty
  error:   0xcc3333,  // Red -- compromised
} as const;

export const DEFAULT_WINDOW_WIDTH = 1024;
export const DEFAULT_WINDOW_HEIGHT = 768;
export const BACKGROUND_COLOR = 0x1a1a2e;

export const DASHBOARD_HEIGHT = 312;        // Dashboard panel height in pixels (1080 - 768)
export const WINDOW_HEIGHT = 1080;           // Total window height (768 world + 312 dashboard)

// Tilemap
export const TILE_SIZE = 32;
export const WORLD_COLS = 32;  // 1024 / 32
export const WORLD_ROWS = 24;  // 768 / 32
export const WORLD_WIDTH = 1024;
export const WORLD_HEIGHT = 768;

// 2x2 grid layout constants
// Buildings fill most of the 1024x768 window with a center gap for the campfire crossroads
export const GRID_MARGIN = 16;       // Edge margin on all sides
export const GRID_GAP = 64;          // Center gap between buildings (campfire area)
export const CAMPFIRE_SIZE = 64;     // Campfire waypoint sprite size

// Building sizes (pixels) -- landscape rectangles filling 2x2 grid quadrants
export const BUILDING_WIDTH = 464;   // floor((1024 - 64 - 32) / 2)
export const BUILDING_HEIGHT = 336;  // floor((768 - 64 - 32) / 2)

// Campfire position at world center (replaces Guild Hall)
export const CAMPFIRE_POS = { x: 512, y: 384 };  // center of 1024x768
// Legacy alias -- Plan 02 will remove references to this
export const GUILD_HALL_POS = CAMPFIRE_POS;

// Quest zone positions -- center of each building in the 2x2 grid
export const QUEST_ZONE_POSITIONS = {
  coding:  { x: 248, y: 184 },   // top-left quadrant -- Wizard Tower
  testing: { x: 776, y: 184 },   // top-right quadrant -- Training Grounds
  reading: { x: 248, y: 584 },   // bottom-left quadrant -- Ancient Library
  comms:   { x: 776, y: 584 },   // bottom-right quadrant -- Tavern
} as const;

// Adaptive frame rate
export const FPS_ACTIVE = 30;
export const FPS_IDLE = 5;

// JSONL reading
export const JSONL_TAIL_BUFFER_SIZE = 65536; // 64KB -- assistant entries with code can be very large

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

export const CHARACTER_CLASSES: CharacterClass[] = ['mage', 'warrior', 'ranger', 'rogue'];

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
  const colorIndex = hash % 8;
  const classIndex = hash % 4;
  return {
    colorIndex,
    color: AGENT_COLORS[colorIndex],
    characterClass: CHARACTER_CLASSES[classIndex],
  };
}

// Animation speeds
export const AGENT_WALK_SPEED = 100;    // pixels per second
export const ANIMATION_FRAME_MS = 200;  // ms per animation frame (5fps animation)

// Agent interior behavior constants (Phase 16)
export const AGENT_INTERIOR_SCALE = 1.5;       // Scale agents to ~48x48 inside buildings (1.5x of 32x32)
export const AGENT_WANDER_RADIUS = 40;          // Pixels agents wander around their station center
export const AGENT_WANDER_INTERVAL_MS = 2000;   // Time between wander direction changes
export const AGENT_INTERIOR_WALK_SPEED = 60;    // Slower walk speed inside buildings (pixels/sec)
export const SPEECH_BUBBLE_DURATION = 4000;  // ms visible before fade
export const SPEECH_BUBBLE_FADE_MS = 1000;   // ms fade-out duration

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

// Level-up celebration effect constants
export const LEVEL_UP_DURATION_MS = 2500;       // Total effect duration (matches CELEBRATION_DURATION_MS)
export const LEVEL_UP_COLUMN_WIDTH = 20;         // Light column width in pixels
export const LEVEL_UP_COLUMN_HEIGHT = 100;       // Light column height in pixels
export const LEVEL_UP_SPARKLE_COUNT = 25;        // Number of sparkle particles
export const LEVEL_UP_SPARKLE_COLORS = [0xFFD700, 0xFFAA00, 0xFFFFAA] as const; // Gold palette
export const LEVEL_UP_GLOW_DISTANCE = 15;        // GlowFilter distance (baked at construction)
export const LEVEL_UP_GLOW_OUTER_STRENGTH = 2;   // GlowFilter outer strength
export const LEVEL_UP_GLOW_COLOR = 0xFFD700;     // GlowFilter gold color
export const LEVEL_UP_GLOW_QUALITY = 0.3;        // GlowFilter quality (low for pixel art)

// Ambient particle constants
export const AMBIENT_PARTICLE_COUNT = 25;         // Number of floating firefly particles
export const AMBIENT_PARTICLE_SIZE_MIN = 1.5;     // Minimum particle radius in pixels
export const AMBIENT_PARTICLE_SIZE_MAX = 2.5;     // Maximum particle radius in pixels
export const AMBIENT_PARTICLE_COLOR = 0xFFFFAA;   // Warm yellow-white
export const AMBIENT_PARTICLE_DRIFT_MIN = 5;      // Minimum horizontal drift speed (px/s)
export const AMBIENT_PARTICLE_DRIFT_MAX = 15;     // Maximum horizontal drift speed (px/s)
export const AMBIENT_PARTICLE_BOB_AMP_MIN = 8;    // Minimum vertical bob amplitude (px)
export const AMBIENT_PARTICLE_BOB_AMP_MAX = 24;   // Maximum vertical bob amplitude (px)
export const AMBIENT_PARTICLE_ALPHA_MIN = 0.2;    // Minimum alpha in fade cycle
export const AMBIENT_PARTICLE_ALPHA_RANGE = 0.6;  // Alpha range above minimum

export const CELEBRATION_DURATION_MS = 2500;  // How long agent stays in celebrating state before heading to HQ
export const AGENT_FADEOUT_DELAY_MS = 2000;   // Linger at Guild Hall before fade begins
export const AGENT_FADEOUT_DURATION_MS = 2000; // Duration of alpha fade from 1 to 0
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutes of continuous idle before fade-out
export const IDLE_REMINDER_MS = 60 * 1000;       // 1 minute of idle before "ready to work" reminder sound
export const WAITING_REMINDER_MS = 60 * 1000;    // 1 minute of continuous waiting before reminder sound
export const REMINDER_THROTTLE_MS = 30 * 1000;   // Minimum 30s gap between any two reminder sound plays

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

export const MAX_LABEL_CHARS = 15;  // Truncation threshold for building labels

// Building type identifiers matching atlas frame names
// 'campfire' replaces 'guild_hall' -- the central waypoint is now a small campfire, not a building
export type BuildingType = 'campfire' | 'wizard_tower' | 'training_grounds' | 'ancient_library' | 'tavern';

// Activity type -> building type mapping (idle -> campfire, work activities -> quest zones)
export const ACTIVITY_BUILDING: Record<ActivityType, BuildingType> = {
  coding:  'wizard_tower',
  testing: 'training_grounds',
  reading: 'ancient_library',
  comms:   'tavern',
  idle:    'campfire',
};

// Activity display names for speech bubble text labels
export const ACTIVITY_DISPLAY_NAMES: Record<ActivityType, string> = {
  coding:  'Coding',
  reading: 'Reading',
  testing: 'Testing',
  comms:   'Comms',
  idle:    'Idle',
};

// Building display labels for BitmapText signposts
export const BUILDING_LABELS: Record<BuildingType, string> = {
  campfire:         'Campfire',
  wizard_tower:     'Wizard Tower',
  training_grounds: 'Training Grounds',
  ancient_library:  'Ancient Library',
  tavern:           'Tavern',
};

// Work spots -- named positions within each building where agents perform tasks
export interface WorkSpot {
  name: string;
  x: number;    // local offset from building container origin
  y: number;    // local offset (negative = up into building, positive = below base)
  color: number; // prop indicator color
}

export const BUILDING_WORK_SPOTS: Record<BuildingType, WorkSpot[]> = {
  wizard_tower: [
    { name: 'Enchanting Table', x: -150, y: -260, color: 0x8844ff },  // top-left area
    { name: 'Scroll Desk',     x: 100,  y: -170, color: 0xddcc88 },  // center-right
    { name: 'Rune Bench',      x: -20,  y: -80,  color: 0x44aaff },  // bottom-center
  ],
  training_grounds: [
    { name: 'Target Dummy',    x: 130,  y: -260, color: 0xaa6633 },  // top-right area
    { name: 'Obstacle Course', x: -20,  y: -170, color: 0x888888 },  // center
    { name: 'Potion Station',  x: -140, y: -80,  color: 0x44dd44 },  // bottom-left
  ],
  ancient_library: [
    { name: 'Crystal Ball',    x: -140, y: -260, color: 0xaaccff },  // top-left area
    { name: 'Ancient Bookshelf', x: 120, y: -170, color: 0x885522 }, // center-right
    { name: 'Map Table',       x: -10,  y: -80,  color: 0xddddaa },  // bottom-center
  ],
  tavern: [
    { name: 'Bar Counter',     x: -60,  y: -270, color: 0x664422 },  // top area (L-shaped bar)
    { name: 'Notice Board',    x: -10,  y: -160, color: 0xccaa66 },  // center
    { name: 'Pigeon Roost',    x: 140,  y: -80,  color: 0xcccccc },  // bottom-right
  ],
  campfire: [], // Campfire has no work spots (agents idle here)
};
