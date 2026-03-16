import log from 'electron-log/main';
import * as path from 'path';
import * as fs from 'fs';

export class CrashLogger {
  private logPath: string;

  constructor(userDataPath: string) {
    this.logPath = path.join(userDataPath, 'crash.log');

    // Configure electron-log file transport
    log.transports.file.resolvePathFn = () => this.logPath;
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    log.transports.file.maxSize = 1048576; // 1MB rotation

    // Disable console transport -- crash log is file-only
    log.transports.console.level = false;
  }

  logCrash(source: string, reason: string, details?: string): void {
    log.error(`[CRASH] ${source}: ${reason}${details ? ' -- ' + details : ''}`);
  }

  logError(source: string, error: Error | string): void {
    const msg = error instanceof Error
      ? `${error.message}\n${error.stack}`
      : error;
    log.error(`[ERROR] ${source}: ${msg}`);
  }

  logMemoryWarning(message: string): void {
    log.warn(`[MEMORY] ${message}`);
  }

  logMemoryStats(stats: { heapUsedMB: number; rssMB: number }): void {
    log.info(`[MEMORY] heap=${stats.heapUsedMB.toFixed(1)}MB rss=${stats.rssMB.toFixed(1)}MB`);
  }

  logCritical(source: string, message: string): void {
    log.error(`[CRITICAL] ${source}: ${message}`);
  }

  getLogPath(): string {
    return this.logPath;
  }

  checkPreviousCrash(): void {
    try {
      if (fs.existsSync(this.logPath)) {
        const content = fs.readFileSync(this.logPath, 'utf-8');
        if (content.includes('[CRASH]') || content.includes('[CRITICAL]')) {
          console.log('[main] Previous crash detected -- see crash.log');
        }
      }
    } catch {
      // Silently ignore errors reading the log file
    }
  }
}
