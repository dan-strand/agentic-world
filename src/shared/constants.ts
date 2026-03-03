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

// ── Color Palette Definitions ─────────────────────────────────────────────────
// 25 palettes for visual identity -- each defines replacement colors for 3 character regions.
// These get swapped onto the base sprite at render time to differentiate agents.

export interface PaletteDef {
  robe: [number, number, number];    // RGB for primary body/clothing
  hair: [number, number, number];    // RGB for secondary accent/hair
  accent: [number, number, number];  // RGB for tertiary detail (belt, trim, glow)
}

export const PALETTE_DEFS: PaletteDef[] = [
  // --- Neutral (default) ---
  { robe: [120, 120, 135], hair: [180, 160, 130], accent: [200, 180, 80] },   // 0: steel gray / sandy / gold
  // --- Warm ---
  { robe: [180, 40, 40],   hair: [255, 200, 100], accent: [255, 255, 200] },  // 1: crimson / gold / ivory
  { robe: [200, 100, 30],  hair: [60, 40, 30],    accent: [255, 220, 100] },  // 2: burnt orange / dark brown / gold
  { robe: [220, 60, 80],   hair: [255, 180, 160], accent: [200, 180, 80] },   // 3: rose / peach / gold
  { robe: [180, 80, 30],   hair: [240, 200, 140], accent: [120, 80, 40] },    // 4: amber / wheat / dark leather
  { robe: [200, 50, 50],   hair: [80, 60, 50],    accent: [255, 200, 50] },   // 5: flame red / dark mocha / sunflower
  // --- Cool ---
  { robe: [40, 80, 180],   hair: [200, 210, 220], accent: [100, 200, 220] },  // 6: ocean blue / silver / teal
  { robe: [30, 120, 140],  hair: [180, 220, 240], accent: [200, 180, 80] },   // 7: deep teal / sky blue / gold
  { robe: [50, 60, 160],   hair: [160, 170, 220], accent: [100, 180, 255] },  // 8: navy / lavender / bright blue
  { robe: [40, 150, 150],  hair: [200, 230, 230], accent: [80, 200, 180] },   // 9: cyan / frost / mint
  { robe: [60, 100, 200],  hair: [220, 220, 240], accent: [180, 200, 255] },  // 10: royal blue / pearl / ice
  // --- Earth ---
  { robe: [60, 120, 50],   hair: [160, 120, 70],  accent: [200, 180, 80] },   // 11: forest green / brown / gold
  { robe: [100, 80, 50],   hair: [200, 180, 140], accent: [80, 60, 40] },     // 12: earth brown / tan / dark
  { robe: [80, 130, 60],   hair: [180, 150, 100], accent: [140, 180, 80] },   // 13: olive green / sandy / lime
  { robe: [110, 90, 60],   hair: [220, 200, 160], accent: [160, 120, 60] },   // 14: sienna / cream / ochre
  { robe: [50, 90, 50],    hair: [140, 100, 60],  accent: [100, 160, 60] },   // 15: dark moss / walnut / spring
  // --- Jewel ---
  { robe: [120, 40, 160],  hair: [200, 180, 220], accent: [200, 180, 80] },   // 16: royal purple / lavender / gold
  { robe: [160, 40, 120],  hair: [255, 180, 200], accent: [200, 160, 60] },   // 17: magenta / rose / old gold
  { robe: [30, 140, 80],   hair: [180, 240, 200], accent: [80, 200, 120] },   // 18: emerald / mint / jade
  { robe: [140, 50, 50],   hair: [200, 120, 120], accent: [180, 40, 40] },    // 19: garnet / dusty rose / ruby
  { robe: [80, 50, 140],   hair: [180, 160, 220], accent: [140, 100, 200] },  // 20: amethyst / wisteria / violet
  // --- Neutral/Dramatic ---
  { robe: [40, 40, 50],    hair: [200, 60, 60],   accent: [180, 180, 190] },  // 21: obsidian / red / silver
  { robe: [200, 200, 210], hair: [80, 80, 100],   accent: [200, 180, 80] },   // 22: white marble / slate / gold
  { robe: [60, 60, 70],    hair: [180, 180, 190], accent: [200, 180, 80] },   // 23: charcoal / silver / gold
  { robe: [180, 170, 150], hair: [100, 80, 60],   accent: [160, 140, 100] },  // 24: ivory / umber / khaki
];

// Template colors -- the base RGB values in the atlas that palette swap replaces.
// One set per class, matching the actual colors used in generate-characters.js.
export const TEMPLATE_COLORS: Record<CharacterClass, { robe: [number, number, number]; hair: [number, number, number]; accent: [number, number, number] }> = {
  mage:    { robe: [90, 50, 160],  hair: [255, 217, 179], accent: [200, 180, 80] },
  warrior: { robe: [160, 160, 175], hair: [180, 40, 40],  accent: [200, 180, 80] },
  ranger:  { robe: [60, 100, 50],  hair: [130, 90, 50],   accent: [100, 70, 35] },
  rogue:   { robe: [50, 50, 60],   hair: [255, 217, 179], accent: [100, 80, 50] },
};

// ── Fantasy Name Pool ─────────────────────────────────────────────────────────
// ~80 names for deterministic assignment via session hash
export const FANTASY_NAMES: string[] = [
  'Eldric', 'Thessa', 'Kael', 'Lyra', 'Dorn', 'Mira', 'Voss', 'Sera',
  'Bram', 'Faye', 'Thane', 'Nyx', 'Cade', 'Isla', 'Rook', 'Wren',
  'Ash', 'Vale', 'Finn', 'Zara', 'Pike', 'Luna', 'Grim', 'Sage',
  'Reed', 'Opal', 'Storm', 'Ember', 'Flint', 'Jade', 'Hawk', 'Coral',
  'Birch', 'Rowan', 'Slate', 'Brynn', 'Thorn', 'Ivy', 'Drake', 'Fern',
  'Knox', 'Aria', 'Bolt', 'Dawn', 'Crest', 'Dusk', 'Frost', 'Blaze',
  'Sable', 'Russet', 'Onyx', 'Garnet', 'Cobalt', 'Sienna', 'Ivory', 'Raven',
  'Cedar', 'Lark', 'Moss', 'Hazel', 'Glen', 'Bay', 'Heath', 'Clay',
  'Pyre', 'Shale', 'Cinder', 'Dew', 'Ridge', 'Brook', 'Teal', 'Quill',
  'Bramble', 'Maple', 'Umber', 'Flax', 'Stone', 'Echo', 'Drift', 'Spark',
];

// ── Gear Definitions ──────────────────────────────────────────────────────────
export const GEAR_VARIANTS_PER_CLASS = 4;

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
  // Use different bit ranges of hash for independent distribution
  const paletteIndex = (hash >>> 4) % PALETTE_DEFS.length;
  const gearIndex = (hash >>> 8) % GEAR_VARIANTS_PER_CLASS;
  const nameIndex = (hash >>> 12) % FANTASY_NAMES.length;
  return {
    colorIndex,
    color: AGENT_COLORS[colorIndex],
    characterClass: CHARACTER_CLASSES[classIndex],
    paletteIndex,
    gearIndex,
    agentName: FANTASY_NAMES[nameIndex],
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
// Ambient idle agents -- decorative agents sitting at campfire when no sessions are active
export const AMBIENT_AGENT_COUNT = 2;
export const AMBIENT_AGENT_IDS = ['ambient-agent-0', 'ambient-agent-1'] as const;
export const AMBIENT_WANDER_RADIUS = 20;          // Smaller wander radius for relaxed campfire vibe
export const AMBIENT_WANDER_INTERVAL_MS = 4000;   // Slower wander cycle for ambient agents

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

// ── Chimney Smoke Particle Constants (Phase 20) ─────────────────────────────
export const CHIMNEY_SMOKE_COUNT = 5;           // Max simultaneous smoke particles per building
export const CHIMNEY_SMOKE_SPAWN_MS = 800;      // Time between new smoke particle spawns
export const CHIMNEY_SMOKE_RISE_SPEED = 12;     // Pixels per second upward drift
export const CHIMNEY_SMOKE_DRIFT_SPEED = 4;     // Pixels per second horizontal drift
export const CHIMNEY_SMOKE_LIFETIME_MS = 3000;  // How long each puff lives
export const CHIMNEY_SMOKE_SIZE_MIN = 2;        // Starting radius of smoke puff
export const CHIMNEY_SMOKE_SIZE_MAX = 5;        // Max radius as smoke puff grows
export const CHIMNEY_SMOKE_COLOR = 0x999999;    // Gray smoke color

// Chimney position offset per building type (relative to building container origin at bottom-center anchor 0.5, 1.0)
export const CHIMNEY_POSITIONS: Record<BuildingType, { x: number; y: number }> = {
  wizard_tower:     { x: -102, y: -330 },  // Top-left area of building (chimneyX=130 in atlas)
  training_grounds: { x: 118,  y: -330 },  // Top-right area (chimneyX=350 in atlas)
  ancient_library:  { x: -82,  y: -330 },  // Top-left area (chimneyX=150 in atlas)
  tavern:           { x: 58,   y: -334 },  // Near center, slightly higher (larger chimney, chimneyX=290)
  campfire:         { x: 0,    y: 0 },     // Not used
};

// ── Model Pricing ──────────────────────────────────────────────────────────────
// Verified against platform.claude.com/docs/en/about-claude/pricing (2026-03-01)
// Cache write = 1.25x input, cache read = 0.1x input

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  cacheWritePer1M: number;
  cacheReadPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6':   { inputPer1M: 5.00,  outputPer1M: 25.00, cacheWritePer1M: 6.25,  cacheReadPer1M: 0.50 },
  'claude-opus-4-5':   { inputPer1M: 5.00,  outputPer1M: 25.00, cacheWritePer1M: 6.25,  cacheReadPer1M: 0.50 },
  'claude-opus-4-1':   { inputPer1M: 15.00, outputPer1M: 75.00, cacheWritePer1M: 18.75, cacheReadPer1M: 1.50 },
  'claude-opus-4':     { inputPer1M: 15.00, outputPer1M: 75.00, cacheWritePer1M: 18.75, cacheReadPer1M: 1.50 },
  'claude-sonnet-4':   { inputPer1M: 3.00,  outputPer1M: 15.00, cacheWritePer1M: 3.75,  cacheReadPer1M: 0.30 },
  'claude-sonnet-3':   { inputPer1M: 3.00,  outputPer1M: 15.00, cacheWritePer1M: 3.75,  cacheReadPer1M: 0.30 },
  'claude-haiku-4':    { inputPer1M: 1.00,  outputPer1M: 5.00,  cacheWritePer1M: 1.25,  cacheReadPer1M: 0.10 },
  'claude-haiku-3-5':  { inputPer1M: 0.80,  outputPer1M: 4.00,  cacheWritePer1M: 1.00,  cacheReadPer1M: 0.08 },
  'claude-opus-3':     { inputPer1M: 15.00, outputPer1M: 75.00, cacheWritePer1M: 18.75, cacheReadPer1M: 1.50 },
  'claude-haiku-3':    { inputPer1M: 0.25,  outputPer1M: 1.25,  cacheWritePer1M: 0.30,  cacheReadPer1M: 0.03 },
};

export const BARE_MODEL_ALIASES: Record<string, string> = {
  'opus': 'claude-opus-4-6',
  'sonnet': 'claude-sonnet-4',
  'haiku': 'claude-haiku-4',
};

export const DEFAULT_MODEL_PRICING: ModelPricing = MODEL_PRICING['claude-sonnet-4'];

export function resolveModelPricing(model: string): { pricing: ModelPricing; isEstimate: boolean } {
  // 1. Check bare aliases (opus, sonnet, haiku)
  if (BARE_MODEL_ALIASES[model]) {
    const key = BARE_MODEL_ALIASES[model];
    return { pricing: MODEL_PRICING[key] ?? DEFAULT_MODEL_PRICING, isEstimate: false };
  }
  // 2. Exact match
  if (MODEL_PRICING[model]) {
    return { pricing: MODEL_PRICING[model], isEstimate: false };
  }
  // 3. Prefix match (handles date-suffixed names)
  for (const prefix of Object.keys(MODEL_PRICING)) {
    if (model.startsWith(prefix)) {
      return { pricing: MODEL_PRICING[prefix], isEstimate: false };
    }
  }
  // 4. Default fallback -- flag as estimate
  return { pricing: DEFAULT_MODEL_PRICING, isEstimate: true };
}

export function calculateCost(usage: { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number }, pricing: ModelPricing): number {
  return (
    (usage.inputTokens * pricing.inputPer1M / 1_000_000) +
    (usage.outputTokens * pricing.outputPer1M / 1_000_000) +
    (usage.cacheCreationTokens * pricing.cacheWritePer1M / 1_000_000) +
    (usage.cacheReadTokens * pricing.cacheReadPer1M / 1_000_000)
  );
}

export function calculateCacheSavings(cacheReadTokens: number, pricing: ModelPricing): number {
  return cacheReadTokens * (pricing.inputPer1M - pricing.cacheReadPer1M) / 1_000_000;
}

export function getModelDisplayName(model: string): string {
  const lower = model.toLowerCase();
  if (lower === 'opus' || lower.includes('opus')) return 'Opus';
  if (lower === 'sonnet' || lower.includes('sonnet')) return 'Sonnet';
  if (lower === 'haiku' || lower.includes('haiku')) return 'Haiku';
  return model || 'Unknown';
}
