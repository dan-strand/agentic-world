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
  filePath: string;          // JSONL file path (main process only, renderer ignores)
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
  DASHBOARD_UPDATE: 'dashboard-update',
  GET_HISTORY: 'get-history',
} as const;

// Type-safe API exposed via contextBridge
export interface DashboardSession {
  sessionId: string;
  projectName: string;
  status: SessionStatus;
  lastToolName: string;
  lastModified: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
  cacheSavingsUsd: number;
  model: string;
  modelDisplayName: string;
  isEstimate: boolean;
  turnCount: number;
}

export interface TodayTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
  cacheSavingsUsd: number;
  sessionCount: number;
}

export interface DashboardData {
  sessions: DashboardSession[];
  todayTotals: TodayTotals;
}

export interface DailyAggregate {
  date: string;           // YYYY-MM-DD (local time)
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
  cacheSavingsUsd: number;
  sessionCount: number;
}

export interface IAgentWorldAPI {
  onSessionsUpdate: (callback: (sessions: SessionInfo[]) => void) => void;
  getInitialSessions: () => Promise<SessionInfo[]>;
  onDashboardUpdate: (callback: (data: DashboardData) => void) => void;
  getHistory: () => Promise<DailyAggregate[]>;
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
