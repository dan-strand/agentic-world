import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// --- Pure helper functions (exported for testing) ---

/**
 * Parse a [MEMORY] heap=XX.XMB rss=YY.YMB log line.
 * Returns null for non-matching lines.
 */
export function parseMemoryLine(
  line: string
): { timestamp: string; heapMB: number; rssMB: number } | null {
  const match = line.match(
    /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\] \[info\]\s+\[MEMORY\] heap=([\d.]+)MB rss=([\d.]+)MB/
  );
  if (!match) return null;
  return {
    timestamp: match[1],
    heapMB: parseFloat(match[2]),
    rssMB: parseFloat(match[3]),
  };
}

/**
 * Analyze memory growth from a series of heap samples.
 */
export function analyzeGrowth(
  samples: { heapMB: number }[],
  thresholdMB: number
): {
  firstHeap: number;
  lastHeap: number;
  delta: number;
  min: number;
  max: number;
  pass: boolean;
} {
  if (samples.length === 0) {
    return { firstHeap: 0, lastHeap: 0, delta: 0, min: 0, max: 0, pass: true };
  }

  const firstHeap = samples[0].heapMB;
  const lastHeap = samples[samples.length - 1].heapMB;
  const delta = lastHeap - firstHeap;
  const heapValues = samples.map((s) => s.heapMB);
  const min = Math.min(...heapValues);
  const max = Math.max(...heapValues);
  const pass = delta < thresholdMB;

  return { firstHeap, lastHeap, delta, min, max, pass };
}

/**
 * Detect if a series of values shows a monotonically increasing trend.
 * "Monotonic" = 80%+ of consecutive pairs show growth (allows for GC dips).
 */
export function detectMonotonicTrend(
  values: number[]
): { isMonotonic: boolean; increasingPct: number; longestRun: number } {
  if (values.length < 2) {
    return { isMonotonic: false, increasingPct: 0, longestRun: 0 };
  }

  let increasingPairs = 0;
  let longestRun = 0;
  let currentRun = 0;
  const totalPairs = values.length - 1;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) {
      increasingPairs++;
      currentRun++;
      if (currentRun > longestRun) {
        longestRun = currentRun;
      }
    } else {
      currentRun = 0;
    }
  }

  const increasingPct = Math.round((increasingPairs / totalPairs) * 100);
  const isMonotonic = increasingPct >= 80;

  return { isMonotonic, increasingPct, longestRun };
}

/**
 * Count [CRASH], [CRITICAL], and [ERROR] entries in log lines.
 */
export function countCrashEntries(
  lines: string[]
): { crashes: number; criticals: number; errors: number } {
  let crashes = 0;
  let criticals = 0;
  let errors = 0;

  for (const line of lines) {
    if (line.includes('[CRASH]')) {
      crashes++;
    } else if (line.includes('[CRITICAL]')) {
      criticals++;
    } else if (line.includes('[ERROR]')) {
      errors++;
    }
  }

  return { crashes, criticals, errors };
}

/**
 * Parse CLI arguments for the analyzer.
 */
export function parseAnalyzerArgs(
  argv: string[]
): { logPath: string; thresholdMB: number } {
  // Default crash.log path varies by platform
  const platform = os.platform();
  let defaultLogPath: string;
  if (platform === 'win32') {
    defaultLogPath = path.join(
      process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
      'Agent World',
      'crash.log'
    );
  } else if (platform === 'darwin') {
    defaultLogPath = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Agent World',
      'crash.log'
    );
  } else {
    defaultLogPath = path.join(
      os.homedir(),
      '.config',
      'Agent World',
      'crash.log'
    );
  }

  let logPath = defaultLogPath;
  let thresholdMB = 50;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--log' && i + 1 < argv.length) {
      logPath = argv[++i];
    } else if (argv[i] === '--threshold' && i + 1 < argv.length) {
      thresholdMB = parseFloat(argv[++i]);
    }
  }

  return { logPath, thresholdMB };
}

// --- Report generation and main logic ---

function formatDuration(firstTimestamp: string, lastTimestamp: string): string {
  const first = new Date(firstTimestamp.replace(' ', 'T') + 'Z');
  const last = new Date(lastTimestamp.replace(' ', 'T') + 'Z');
  const diffMs = last.getTime() - first.getTime();
  const hours = Math.floor(diffMs / (3600 * 1000));
  const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function generateReport(
  lines: string[],
  thresholdMB: number
): { report: string; pass: boolean } {
  // Parse memory samples
  const memorySamples: { timestamp: string; heapMB: number; rssMB: number }[] = [];
  for (const line of lines) {
    const parsed = parseMemoryLine(line);
    if (parsed) {
      memorySamples.push(parsed);
    }
  }

  // Count crash entries
  const crashCounts = countCrashEntries(lines);

  // Count memory warnings
  let memoryWarnings = 0;
  for (const line of lines) {
    if (line.includes('[warn]') && line.includes('[MEMORY]')) {
      memoryWarnings++;
    }
  }

  const parts: string[] = [];
  const failures: string[] = [];

  parts.push('=== SOAK TEST REPORT ===');
  parts.push('');

  if (memorySamples.length === 0) {
    parts.push('Duration: N/A (0 samples)');
    parts.push('');
    parts.push('No [MEMORY] samples found in log.');
    parts.push('');

    // Still check crash entries
    const crashPass = crashCounts.crashes === 0 && crashCounts.criticals === 0;
    parts.push('--- Crash Events ---');
    parts.push(`[CRASH] entries:    ${crashCounts.crashes}`);
    parts.push(`[CRITICAL] entries: ${crashCounts.criticals}`);
    parts.push(`[ERROR] entries:    ${crashCounts.errors} (non-blocking)`);
    parts.push(`Result:     ${crashPass ? 'PASS' : 'FAIL'}`);
    if (!crashPass) failures.push(`${crashCounts.crashes} crash and ${crashCounts.criticals} critical entries found`);

    parts.push('');
    const overallPass = failures.length === 0;
    if (overallPass) {
      parts.push('=== OVERALL: PASS ===');
    } else {
      parts.push('=== OVERALL: FAIL ===');
      parts.push('Failed criteria:');
      for (const f of failures) {
        parts.push(`  - ${f}`);
      }
    }

    return { report: parts.join('\n'), pass: overallPass };
  }

  // We have memory samples -- full report
  const duration = formatDuration(memorySamples[0].timestamp, memorySamples[memorySamples.length - 1].timestamp);
  parts.push(`Duration: ${duration} (${memorySamples.length} samples at 60s intervals)`);
  parts.push('');

  // Memory growth analysis
  const growth = analyzeGrowth(memorySamples, thresholdMB);
  parts.push('--- Memory Growth ---');
  parts.push(`First heap: ${growth.firstHeap.toFixed(1)} MB`);
  parts.push(`Last heap:  ${growth.lastHeap.toFixed(1)} MB`);
  parts.push(`Growth:     ${growth.delta.toFixed(1)} MB (threshold: ${thresholdMB} MB)`);
  parts.push(`Min heap:   ${growth.min.toFixed(1)} MB | Max heap: ${growth.max.toFixed(1)} MB`);
  parts.push(`Result:     ${growth.pass ? 'PASS' : 'FAIL'}`);
  if (!growth.pass) {
    failures.push(`Memory growth ${growth.delta.toFixed(1)} MB exceeds ${thresholdMB} MB threshold`);
  }
  parts.push('');

  // Monotonic trend detection
  const heapValues = memorySamples.map((s) => s.heapMB);
  const rssValues = memorySamples.map((s) => s.rssMB);
  const heapTrend = detectMonotonicTrend(heapValues);
  const rssTrend = detectMonotonicTrend(rssValues);

  parts.push('--- Monotonic Trend ---');
  parts.push(`Heap:  ${heapTrend.increasingPct}% increasing pairs (longest run: ${heapTrend.longestRun}) -- ${heapTrend.isMonotonic ? 'FAIL' : 'PASS'}`);
  parts.push(`RSS:   ${rssTrend.increasingPct}% increasing pairs (longest run: ${rssTrend.longestRun}) -- ${rssTrend.isMonotonic ? 'FAIL' : 'PASS'}`);
  const trendPass = !heapTrend.isMonotonic && !rssTrend.isMonotonic;
  parts.push(`Result: ${trendPass ? 'PASS' : 'FAIL'}`);
  if (!trendPass) {
    if (heapTrend.isMonotonic) failures.push(`Heap shows monotonically increasing trend (${heapTrend.increasingPct}% increasing pairs)`);
    if (rssTrend.isMonotonic) failures.push(`RSS shows monotonically increasing trend (${rssTrend.increasingPct}% increasing pairs)`);
  }
  parts.push('');

  // Crash events
  const crashPass = crashCounts.crashes === 0 && crashCounts.criticals === 0;
  parts.push('--- Crash Events ---');
  parts.push(`[CRASH] entries:    ${crashCounts.crashes}`);
  parts.push(`[CRITICAL] entries: ${crashCounts.criticals}`);
  parts.push(`[ERROR] entries:    ${crashCounts.errors} (non-blocking)`);
  parts.push(`Result:     ${crashPass ? 'PASS' : 'FAIL'}`);
  if (!crashPass) {
    failures.push(`${crashCounts.crashes} crash and ${crashCounts.criticals} critical entries found`);
  }
  parts.push('');

  // Memory warnings
  parts.push('--- Memory Warnings ---');
  parts.push(`Trend warnings: ${memoryWarnings}`);
  parts.push('');

  // Overall verdict
  const overallPass = failures.length === 0;
  if (overallPass) {
    parts.push('=== OVERALL: PASS ===');
  } else {
    parts.push('=== OVERALL: FAIL ===');
    parts.push('Failed criteria:');
    for (const f of failures) {
      parts.push(`  - ${f}`);
    }
  }

  return { report: parts.join('\n'), pass: overallPass };
}

// --- Main ---

function main(): void {
  const config = parseAnalyzerArgs(process.argv.slice(2));

  let content = '';
  try {
    content = fs.readFileSync(config.logPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`No crash.log found at ${config.logPath}`);
      console.log('');
      console.log('=== SOAK TEST REPORT ===');
      console.log('');
      console.log('No log file found. Run the soak test first.');
      process.exit(1);
    }
    throw err;
  }

  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const { report, pass } = generateReport(lines, config.thresholdMB);

  console.log(report);
  process.exit(pass ? 0 : 1);
}

if (require.main === module) {
  main();
}
