import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// --- Pure helper functions (exported for testing) ---

const TOOL_NAMES = ['Edit', 'Read', 'Bash', 'Write', 'Grep'];
const ENTRY_TYPES = ['assistant', 'user', 'progress'];

/**
 * Generate a valid JSONL entry string for a simulated session.
 */
export function generateJsonlEntry(type: string, toolName?: string): string {
  const timestamp = new Date().toISOString();

  if (type === 'user') {
    return JSON.stringify({
      type: 'user',
      message: 'soak test prompt',
      timestamp,
    });
  }

  if (type === 'assistant') {
    return JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'soak test response' }],
        usage: {
          input_tokens: Math.floor(Math.random() * 500) + 50,
          output_tokens: Math.floor(Math.random() * 200) + 10,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
      timestamp,
    });
  }

  if (type === 'progress') {
    return JSON.stringify({
      type: 'progress',
      tool_name: toolName ?? TOOL_NAMES[Math.floor(Math.random() * TOOL_NAMES.length)],
      timestamp,
    });
  }

  // Fallback for unknown types
  return JSON.stringify({ type, timestamp });
}

/**
 * Generate a UUID v4-format session ID.
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Parse CLI arguments into configuration.
 */
export function parseArgs(argv: string[]): { dir: string; duration: number; sessions: number } {
  const defaultDir = path.join(os.homedir(), '.claude', 'projects');
  let dir = defaultDir;
  let duration = 8;
  let sessions = 4;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir' && i + 1 < argv.length) {
      dir = argv[++i];
    } else if (argv[i] === '--duration' && i + 1 < argv.length) {
      duration = parseFloat(argv[++i]);
    } else if (argv[i] === '--sessions' && i + 1 < argv.length) {
      sessions = parseInt(argv[++i], 10);
    }
  }

  return { dir, duration, sessions };
}

// --- Main simulation logic (runs only when executed directly) ---

interface SimSession {
  id: string;
  filePath: string;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const durationMs = config.duration * 3600 * 1000;

  // Create temp project directory under the Claude projects dir
  const timestamp = Date.now();
  const soakDir = path.join(config.dir, `soak-test-${timestamp}`);
  fs.mkdirSync(soakDir, { recursive: true });

  console.log(`[soak] Starting soak test`);
  console.log(`[soak] Dir: ${soakDir}`);
  console.log(`[soak] Duration: ${config.duration}h | Max sessions: ${config.sessions}`);

  const activeSessions: SimSession[] = [];
  let totalActions = 0;
  const startTime = Date.now();
  let lastHeartbeat = startTime;
  let running = true;

  // Cleanup handler
  function cleanup(): void {
    running = false;
    console.log(`\n[soak] Cleaning up...`);
    for (const session of activeSessions) {
      try {
        fs.unlinkSync(session.filePath);
      } catch { /* already gone */ }
    }
    try {
      fs.rmdirSync(soakDir);
    } catch { /* may not be empty or already gone */ }
    const elapsed = Date.now() - startTime;
    console.log(`[soak] Done. ${totalActions} actions over ${formatElapsed(elapsed)}`);
  }

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  while (running && (Date.now() - startTime) < durationMs) {
    // Pick a random action
    const actions: string[] = [];
    if (activeSessions.length < config.sessions) {
      actions.push('add');
    }
    if (activeSessions.length > 0) {
      actions.push('update');
      actions.push('remove');
    }
    // Bias toward updates if sessions exist (weight: add=1, update=3, remove=1)
    const weighted: string[] = [];
    for (const a of actions) {
      if (a === 'update') {
        weighted.push(a, a, a);
      } else {
        weighted.push(a);
      }
    }

    if (weighted.length === 0) {
      // No sessions and at max -- just add
      weighted.push('add');
    }

    const action = weighted[Math.floor(Math.random() * weighted.length)];

    if (action === 'add') {
      const id = generateSessionId();
      const filePath = path.join(soakDir, `${id}.jsonl`);
      const entry = generateJsonlEntry('user');
      fs.writeFileSync(filePath, entry + '\n');
      activeSessions.push({ id, filePath });
      totalActions++;
      console.log(`[soak] +session ${id}`);
    } else if (action === 'update' && activeSessions.length > 0) {
      const idx = randomInt(0, activeSessions.length - 1);
      const session = activeSessions[idx];
      const type = ENTRY_TYPES[Math.floor(Math.random() * ENTRY_TYPES.length)];
      const toolName = type === 'progress'
        ? TOOL_NAMES[Math.floor(Math.random() * TOOL_NAMES.length)]
        : undefined;
      const entry = generateJsonlEntry(type, toolName);
      fs.appendFileSync(session.filePath, entry + '\n');
      totalActions++;
      console.log(`[soak] ~update ${session.id} (${type}${toolName ? '/' + toolName : ''})`);
    } else if (action === 'remove' && activeSessions.length > 0) {
      const idx = randomInt(0, activeSessions.length - 1);
      const session = activeSessions[idx];
      try {
        fs.unlinkSync(session.filePath);
      } catch { /* already gone */ }
      activeSessions.splice(idx, 1);
      totalActions++;
      console.log(`[soak] -session ${session.id}`);
    }

    // Heartbeat every 60 seconds
    const now = Date.now();
    if (now - lastHeartbeat >= 60_000) {
      const elapsed = now - startTime;
      console.log(`[soak] heartbeat: ${activeSessions.length} active sessions, ${totalActions} total actions, elapsed ${formatElapsed(elapsed)}`);
      lastHeartbeat = now;
    }

    // Wait 5-15 seconds before next action
    const delay = randomInt(5000, 15000);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delay);
      // Allow early exit
      if (!running) {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  // Duration complete -- cleanup
  cleanup();
}

// Run main when executed directly
// With tsx and CommonJS, check if this is the entry module
if (require.main === module) {
  main().catch((err) => {
    console.error('[soak] Fatal error:', err);
    process.exit(1);
  });
}
