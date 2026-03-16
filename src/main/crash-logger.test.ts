import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CrashLogger } from './crash-logger';

// electron-log writes async via file transport -- helper to wait for flush
function waitForFlush(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('CrashLogger', () => {
  let tmpDir: string;
  let logger: CrashLogger;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `crash-logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    logger = new CrashLogger(tmpDir);
  });

  after(() => {
    // Clean up all temp directories created during tests
    const entries = fs.readdirSync(os.tmpdir());
    for (const entry of entries) {
      if (entry.startsWith('crash-logger-test-')) {
        try {
          fs.rmSync(path.join(os.tmpdir(), entry), { recursive: true });
        } catch { /* ignore */ }
      }
    }
  });

  it('creates the log file in the specified directory', async () => {
    logger.logCrash('test', 'test crash');
    await waitForFlush();
    const logPath = logger.getLogPath();
    assert.equal(path.dirname(logPath), tmpDir);
    assert.equal(path.basename(logPath), 'crash.log');
    assert.ok(fs.existsSync(logPath), 'crash.log should exist after writing');
  });

  it('logCrash writes an entry containing [CRASH], the source, and the reason', async () => {
    logger.logCrash('render-process-gone', 'killed', 'exitCode=1');
    await waitForFlush();
    const content = fs.readFileSync(logger.getLogPath(), 'utf-8');
    assert.ok(content.includes('[CRASH]'), 'should contain [CRASH] prefix');
    assert.ok(content.includes('render-process-gone'), 'should contain the source');
    assert.ok(content.includes('killed'), 'should contain the reason');
    assert.ok(content.includes('exitCode=1'), 'should contain details');
  });

  it('logError writes [ERROR] with stack trace when given an Error object', async () => {
    const err = new Error('something failed');
    logger.logError('main-uncaughtException', err);
    await waitForFlush();
    const content = fs.readFileSync(logger.getLogPath(), 'utf-8');
    assert.ok(content.includes('[ERROR]'), 'should contain [ERROR] prefix');
    assert.ok(content.includes('main-uncaughtException'), 'should contain the source');
    assert.ok(content.includes('something failed'), 'should contain the error message');
    assert.ok(content.includes('crash-logger.test.ts'), 'should contain stack trace pointing to this test file');
  });

  it('logError writes [ERROR] with string message', async () => {
    logger.logError('renderer', 'a plain string error');
    await waitForFlush();
    const content = fs.readFileSync(logger.getLogPath(), 'utf-8');
    assert.ok(content.includes('[ERROR]'), 'should contain [ERROR] prefix');
    assert.ok(content.includes('a plain string error'), 'should contain the string message');
  });

  it('logMemoryStats writes [MEMORY] with formatted heap/rss values', async () => {
    logger.logMemoryStats({ heapUsedMB: 45.3, rssMB: 120.7 });
    await waitForFlush();
    const content = fs.readFileSync(logger.getLogPath(), 'utf-8');
    assert.ok(content.includes('[MEMORY]'), 'should contain [MEMORY] prefix');
    assert.ok(content.includes('heap=45.3MB'), 'should contain formatted heap value');
    assert.ok(content.includes('rss=120.7MB'), 'should contain formatted rss value');
  });

  it('logMemoryWarning writes [MEMORY] at warn level', async () => {
    logger.logMemoryWarning('Heap grew 55.2MB over 10 minutes');
    await waitForFlush();
    const content = fs.readFileSync(logger.getLogPath(), 'utf-8');
    assert.ok(content.includes('[MEMORY]'), 'should contain [MEMORY] prefix');
    assert.ok(content.includes('[warn]'), 'should be logged at warn level');
    assert.ok(content.includes('Heap grew 55.2MB'), 'should contain the warning message');
  });

  it('logCritical writes [CRITICAL]', async () => {
    logger.logCritical('game-loop', 'Ticker stopped: 5+ errors in 10 seconds');
    await waitForFlush();
    const content = fs.readFileSync(logger.getLogPath(), 'utf-8');
    assert.ok(content.includes('[CRITICAL]'), 'should contain [CRITICAL] prefix');
    assert.ok(content.includes('game-loop'), 'should contain the source');
    assert.ok(content.includes('Ticker stopped'), 'should contain the message');
  });

  it('log entries contain ISO-style timestamps', async () => {
    logger.logCrash('test', 'timestamp check');
    await waitForFlush();
    const content = fs.readFileSync(logger.getLogPath(), 'utf-8');
    // electron-log format: [YYYY-MM-DD HH:mm:ss.SSS]
    const timestampPattern = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/;
    assert.ok(timestampPattern.test(content), `should contain ISO-style timestamp, got: ${content.trim()}`);
  });

  it('checkPreviousCrash detects existing crash entries', () => {
    // Pre-create a crash.log with a [CRASH] entry
    const logPath = path.join(tmpDir, 'crash.log');
    fs.writeFileSync(logPath, '[2026-03-16 10:00:00.000] [error] [CRASH] test: previous crash\n');

    const messages: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { messages.push(args.join(' ')); };

    try {
      const freshLogger = new CrashLogger(tmpDir);
      freshLogger.checkPreviousCrash();
      assert.ok(
        messages.some(m => m.includes('Previous crash detected')),
        `should log previous crash detection, got: ${JSON.stringify(messages)}`
      );
    } finally {
      console.log = origLog;
    }
  });

  it('checkPreviousCrash does not log when no crash entries exist', () => {
    // Pre-create a crash.log with only info entries
    const logPath = path.join(tmpDir, 'crash.log');
    fs.writeFileSync(logPath, '[2026-03-16 10:00:00.000] [info] [MEMORY] heap=30.0MB rss=80.0MB\n');

    const messages: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { messages.push(args.join(' ')); };

    try {
      const freshLogger = new CrashLogger(tmpDir);
      freshLogger.checkPreviousCrash();
      assert.ok(
        !messages.some(m => m.includes('Previous crash detected')),
        `should NOT log previous crash detection when no crash entries exist`
      );
    } finally {
      console.log = origLog;
    }
  });

  it('getLogPath returns the correct path', () => {
    const expected = path.join(tmpDir, 'crash.log');
    assert.equal(logger.getLogPath(), expected);
  });
});
