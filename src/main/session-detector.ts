import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionInfo, SessionStatus, ActivityType } from '../shared/types';
import { IDLE_THRESHOLD_MS, STALE_SESSION_MS, TOOL_TO_ACTIVITY } from '../shared/constants';
import { readLastJsonlLine, readLastToolUse, JsonlEntry } from './jsonl-reader';

/**
 * Abstract interface for session detection.
 * Allows future implementations (e.g., API-based detection) without changing consumers.
 */
export interface SessionDetector {
  discoverSessions(): SessionInfo[];
}

// UUID pattern for session JSONL files
const UUID_JSONL_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

/**
 * Filesystem-based session detector.
 * Scans ~/.claude/projects/ for JSONL session files and determines their status.
 *
 * Caches the cwd mapping per sessionId so completed/unchanged sessions
 * don't require re-reading JSONL content on every poll.
 */
export class FilesystemSessionDetector implements SessionDetector {
  private readonly claudeProjectsDir: string;

  // Cache: sessionId -> { cwd, projectPath, projectName }
  private cwdCache: Map<string, { projectPath: string; projectName: string }> = new Map();

  // Cache: sessionId -> { mtimeMs, sessionInfo, hasToolUse } for unchanged sessions
  private mtimeCache: Map<string, { mtimeMs: number; sessionInfo: SessionInfo; hasToolUse: boolean }> = new Map();

  constructor(claudeProjectsDir?: string) {
    this.claudeProjectsDir = claudeProjectsDir ??
      path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * Discover all Claude Code sessions from the filesystem.
   * Never throws -- always returns a (possibly empty) array.
   */
  discoverSessions(): SessionInfo[] {
    const sessions: SessionInfo[] = [];

    try {
      if (!fs.existsSync(this.claudeProjectsDir)) {
        console.warn(`[session-detector] Claude projects directory not found: ${this.claudeProjectsDir}`);
        return [];
      }

      const projectDirs = fs.readdirSync(this.claudeProjectsDir, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const dir of projectDirs) {
        const dirPath = path.join(this.claudeProjectsDir, dir.name);
        this.scanProjectDirectory(dirPath, dir.name, sessions);
      }
    } catch (err) {
      console.warn('[session-detector] Error scanning projects directory:', (err as Error).message);
    }

    return sessions;
  }

  /**
   * Scan a single project directory for UUID-named JSONL files.
   * Skips subdirectories (subagent files are out of scope for Phase 1).
   */
  private scanProjectDirectory(
    dirPath: string,
    dirName: string,
    sessions: SessionInfo[]
  ): void {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Only process files matching UUID.jsonl pattern -- skip subdirectories
        if (!entry.isFile() || !UUID_JSONL_REGEX.test(entry.name)) {
          continue;
        }

        const filePath = path.join(dirPath, entry.name);
        const sessionId = entry.name.replace('.jsonl', '');

        const sessionInfo = this.processSessionFile(filePath, sessionId, dirName);
        if (sessionInfo) {
          sessions.push(sessionInfo);
        }
      }
    } catch (err) {
      // Directory may have been removed between listing and access
      console.warn(`[session-detector] Error reading directory ${dirPath}:`, (err as Error).message);
    }
  }

  /**
   * Process a single JSONL session file into a SessionInfo.
   * Uses caching to avoid re-reading unchanged files.
   */
  private processSessionFile(
    filePath: string,
    sessionId: string,
    dirName: string
  ): SessionInfo | null {
    try {
      const stat = fs.statSync(filePath);
      const now = Date.now();

      // Skip stale sessions (not modified in over 30 minutes)
      if (now - stat.mtimeMs > STALE_SESSION_MS) {
        // Preserve sessions that were actively waiting -- user may not have responded yet.
        // Only filter truly stale sessions (last known status was idle or unknown).
        const cached = this.mtimeCache.get(sessionId);
        if (cached && (cached.sessionInfo.status === 'waiting' || cached.sessionInfo.status === 'active')) {
          // Session was waiting/active when last checked -- keep it visible.
          // Update status to waiting (file hasn't changed, so it's definitely waiting now).
          const preserved: SessionInfo = { ...cached.sessionInfo, status: 'waiting' };
          return preserved;
        }
        return null;
      }

      // Check if mtime is unchanged -- reuse cached result (just update status)
      const cached = this.mtimeCache.get(sessionId);
      if (cached && cached.mtimeMs === stat.mtimeMs) {
        // Mtime unchanged but status may change due to time passing (idle threshold)
        const updatedStatus = this.determineStatus(
          cached.sessionInfo.lastEntryType,
          stat.mtimeMs,
          now,
          cached.hasToolUse
        );
        if (updatedStatus !== cached.sessionInfo.status) {
          const updated: SessionInfo = { ...cached.sessionInfo, status: updatedStatus };
          this.mtimeCache.set(sessionId, { mtimeMs: stat.mtimeMs, sessionInfo: updated, hasToolUse: cached.hasToolUse });
          return updated;
        }
        return cached.sessionInfo;
      }

      // Mtime changed or new session -- read JSONL last line
      const lastEntry = readLastJsonlLine(filePath);
      const lastEntryType = lastEntry?.type ?? 'unknown';
      const hasToolUse = this.hasToolUseContent(lastEntry);
      const status = this.determineStatus(lastEntryType, stat.mtimeMs, now, hasToolUse);

      // Extract activity type from last tool_use in JSONL progress entries.
      // Force idle when session has been idle long enough to be stale -- prevents
      // ancient sessions from claiming building slots over active projects.
      // Default to 'coding' for active/waiting sessions when tool detection fails
      // (large JSONL files may not have tool_use in the tail buffer).
      const lastToolName = readLastToolUse(filePath);
      const timeSinceModified = now - stat.mtimeMs;
      const fallbackActivity: ActivityType = (status === 'active' || status === 'waiting') ? 'coding' : 'idle';
      const activityType: ActivityType =
        (status === 'idle' && timeSinceModified > STALE_SESSION_MS)
          ? 'idle'
          : (lastToolName ? (TOOL_TO_ACTIVITY[lastToolName] ?? 'coding') : fallbackActivity);

      // Extract project path from JSONL cwd field, or use cached value, or fall back to dir name
      let projectPath: string;
      let projectName: string;

      if (lastEntry?.cwd && typeof lastEntry.cwd === 'string') {
        projectPath = lastEntry.cwd;
        projectName = path.basename(projectPath);
        // Update cwd cache
        this.cwdCache.set(sessionId, { projectPath, projectName });
      } else {
        // Try cached cwd
        const cwdCached = this.cwdCache.get(sessionId);
        if (cwdCached) {
          projectPath = cwdCached.projectPath;
          projectName = cwdCached.projectName;
        } else {
          // Last resort: extract project name from Claude's mangled directory name
          // e.g. "C--Users-dlaws-Projects-freeflow" → "freeflow"
          const segments = dirName.split('-').filter(s => s.length > 0);
          projectPath = dirName;
          projectName = segments.length > 0 ? segments[segments.length - 1] : dirName;
          console.warn(`[session-detector] No cwd found for session ${sessionId}, using dir name fallback: ${projectName}`);
        }
      }

      const sessionInfo: SessionInfo = {
        sessionId,
        projectPath,
        projectName,
        status,
        lastModified: stat.mtimeMs,
        lastEntryType,
        activityType,
        lastToolName: lastToolName ?? '',
      };

      // Update mtime cache
      this.mtimeCache.set(sessionId, { mtimeMs: stat.mtimeMs, sessionInfo, hasToolUse });

      return sessionInfo;
    } catch (err) {
      // File may have been deleted between listing and stat
      console.warn(`[session-detector] Error processing ${filePath}:`, (err as Error).message);
      return null;
    }
  }

  /**
   * Check if a JSONL entry is an assistant message containing a tool_use request.
   * When true, the tool is actively executing and the session should remain 'active'
   * even though the file mtime has aged (no JSONL writes during tool execution).
   */
  private hasToolUseContent(entry: JsonlEntry | null): boolean {
    if (!entry || entry.type !== 'assistant') return false;
    const message = entry.message as { content?: unknown[] } | undefined;
    if (!message?.content || !Array.isArray(message.content)) return false;
    return message.content.some(
      (block: unknown) => typeof block === 'object' && block !== null && (block as { type?: string }).type === 'tool_use'
    );
  }

  /**
   * Determine session status from last JSONL entry type and file modification time.
   *
   * Algorithm:
   * - If file not modified in 30+ seconds: idle
   * - Otherwise, based on last entry type:
   *   - 'assistant': active if <2s ago (streaming), waiting otherwise
   *   - 'user' | 'progress' | 'queue-operation': active
   *   - 'system': active if <5s ago, waiting otherwise (task completed, awaiting user input)
   *   - default: active (optimistic per user decision)
   */
  determineStatus(lastEntryType: string, mtimeMs: number, now: number, hasToolUse: boolean = false): SessionStatus {
    const timeSinceModified = now - mtimeMs;

    // Idle threshold: 30 seconds
    if (timeSinceModified > IDLE_THRESHOLD_MS) {
      return 'idle';
    }

    // File was recently modified -- determine active vs waiting
    switch (lastEntryType) {
      case 'assistant':
        // Claude just responded -- if very recent, still streaming (active)
        if (timeSinceModified < 2000) return 'active';
        // If the assistant entry contains a tool_use request, the tool is actively
        // executing. No JSONL writes happen during tool execution (gaps of 3-109s+),
        // so mtime ages but the session is NOT waiting for user input.
        if (hasToolUse) return 'active';
        // Otherwise, assistant finished responding with text -- waiting for user input
        return 'waiting';

      case 'user':
      case 'progress':
      case 'queue-operation':
        // User sent input or agent is making progress
        return 'active';

      case 'system':
        // System entries (e.g., turn_duration) mark task completion boundaries.
        // After completion, the session is waiting for user input, not idle.
        // Only report idle after the full IDLE_THRESHOLD_MS has passed (handled above).
        return timeSinceModified < 5000 ? 'active' : 'waiting';

      default:
        // Optimistic default per user decision
        return 'active';
    }
  }
}
