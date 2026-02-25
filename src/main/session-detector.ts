import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionInfo, SessionStatus } from '../shared/types';
import { IDLE_THRESHOLD_MS } from '../shared/constants';
import { readLastJsonlLine, JsonlEntry } from './jsonl-reader';

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

  // Cache: sessionId -> { mtimeMs, sessionInfo } for unchanged sessions
  private mtimeCache: Map<string, { mtimeMs: number; sessionInfo: SessionInfo }> = new Map();

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

      // Check if mtime is unchanged -- reuse cached result (just update status)
      const cached = this.mtimeCache.get(sessionId);
      if (cached && cached.mtimeMs === stat.mtimeMs) {
        // Mtime unchanged but status may change due to time passing (idle threshold)
        const updatedStatus = this.determineStatus(
          cached.sessionInfo.lastEntryType,
          stat.mtimeMs,
          now
        );
        if (updatedStatus !== cached.sessionInfo.status) {
          const updated: SessionInfo = { ...cached.sessionInfo, status: updatedStatus };
          this.mtimeCache.set(sessionId, { mtimeMs: stat.mtimeMs, sessionInfo: updated });
          return updated;
        }
        return cached.sessionInfo;
      }

      // Mtime changed or new session -- read JSONL last line
      const lastEntry = readLastJsonlLine(filePath);
      const lastEntryType = lastEntry?.type ?? 'unknown';
      const status = this.determineStatus(lastEntryType, stat.mtimeMs, now);

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
          // Last resort: use directory name (not ideal -- may have encoding artifacts)
          projectPath = dirName;
          projectName = dirName;
          console.warn(`[session-detector] No cwd found for session ${sessionId}, using dir name as fallback`);
        }
      }

      const sessionInfo: SessionInfo = {
        sessionId,
        projectPath,
        projectName,
        status,
        lastModified: stat.mtimeMs,
        lastEntryType,
      };

      // Update mtime cache
      this.mtimeCache.set(sessionId, { mtimeMs: stat.mtimeMs, sessionInfo });

      return sessionInfo;
    } catch (err) {
      // File may have been deleted between listing and stat
      console.warn(`[session-detector] Error processing ${filePath}:`, (err as Error).message);
      return null;
    }
  }

  /**
   * Determine session status from last JSONL entry type and file modification time.
   *
   * Algorithm:
   * - If file not modified in 30+ seconds: idle
   * - Otherwise, based on last entry type:
   *   - 'assistant': active if <2s ago (streaming), waiting otherwise
   *   - 'user' | 'progress' | 'queue-operation': active
   *   - 'system': active if <5s ago, idle otherwise
   *   - default: active (optimistic per user decision)
   */
  determineStatus(lastEntryType: string, mtimeMs: number, now: number): SessionStatus {
    const timeSinceModified = now - mtimeMs;

    // Idle threshold: 30 seconds
    if (timeSinceModified > IDLE_THRESHOLD_MS) {
      return 'idle';
    }

    // File was recently modified -- determine active vs waiting
    switch (lastEntryType) {
      case 'assistant':
        // Claude just responded -- if very recent, still streaming (active)
        // Otherwise likely waiting for user input
        return timeSinceModified < 2000 ? 'active' : 'waiting';

      case 'user':
      case 'progress':
      case 'queue-operation':
        // User sent input or agent is making progress
        return 'active';

      case 'system':
        // System entries (e.g., turn_duration) indicate task boundaries
        return timeSinceModified < 5000 ? 'active' : 'idle';

      default:
        // Optimistic default per user decision
        return 'active';
    }
  }
}
