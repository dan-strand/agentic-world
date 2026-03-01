export type ActivityType = 'coding' | 'reading' | 'testing' | 'comms' | 'idle';

export type CharacterClass = 'mage' | 'warrior' | 'ranger' | 'rogue';

export interface AgentSlot {
  colorIndex: number;
  color: number;
  characterClass: CharacterClass;
}

export type SessionStatus = 'active' | 'waiting' | 'idle' | 'error';

export interface SessionInfo {
  sessionId: string;
  projectPath: string;       // Full path: C:\Users\dlaws\Projects\Agent World
  projectName: string;       // Display name: Agent World
  status: SessionStatus;
  lastModified: number;      // mtime epoch ms
  lastEntryType: string;     // 'user' | 'assistant' | 'progress' | 'system' | etc
  activityType: ActivityType;
  lastToolName: string;      // Most recent tool name from JSONL (e.g., "Edit", "Bash", "Read")
}

// IPC channel names -- single source of truth
export const IPC_CHANNELS = {
  SESSIONS_UPDATE: 'sessions-update',
  GET_INITIAL_SESSIONS: 'get-initial-sessions',
} as const;

// Type-safe API exposed via contextBridge
export interface IAgentWorldAPI {
  onSessionsUpdate: (callback: (sessions: SessionInfo[]) => void) => void;
  getInitialSessions: () => Promise<SessionInfo[]>;
  minimizeWindow: () => void;
  closeWindow: () => void;
  startDrag: () => void;
  endDrag: () => void;
}

// Token usage from a single JSONL assistant entry's message.usage
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

// Aggregated usage for one session (accumulated across all assistant entries)
export interface SessionUsage {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string;
  turnCount: number;
}

// Extend Window for renderer access
declare global {
  interface Window {
    agentWorld: IAgentWorldAPI;
  }
}
