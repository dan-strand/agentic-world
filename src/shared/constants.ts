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
