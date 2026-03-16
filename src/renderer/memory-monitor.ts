/**
 * MemoryMonitor -- Periodic heap sampling with sliding window trend detection.
 * Samples memory every 60 seconds, warns when heap grows >50MB over the window.
 * Uses performance.memory (Chromium-specific) since renderer runs in sandboxed context.
 */

export const SAMPLE_INTERVAL_MS = 60_000;
export const WINDOW_SIZE = 10;
export const GROWTH_THRESHOLD_MB = 50;

export interface MemoryMonitorCallbacks {
  onStats: (stats: { heapUsedMB: number; rssMB: number }) => void;
  onWarning: (message: string) => void;
}

/**
 * Pure function: check if the sliding window of heap samples shows
 * growth exceeding the threshold. Returns a warning message or null.
 */
export function checkTrend(samples: number[], thresholdMB: number): string | null {
  if (samples.length < WINDOW_SIZE) return null;
  const oldest = samples[0];
  const newest = samples[samples.length - 1];
  const growthMB = newest - oldest;
  if (growthMB > thresholdMB) {
    return `Heap grew ${growthMB.toFixed(1)}MB over ${samples.length} samples (${(samples.length * SAMPLE_INTERVAL_MS / 60_000).toFixed(0)} min window)`;
  }
  return null;
}

// Chromium-specific performance.memory typing
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export class MemoryMonitor {
  private samples: number[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: MemoryMonitorCallbacks;

  constructor(callbacks: MemoryMonitorCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
  }

  sample(): void {
    const perf = performance as PerformanceWithMemory;
    if (!perf.memory) return; // Not available in non-Chromium environments

    const heapUsedMB = perf.memory.usedJSHeapSize / (1024 * 1024);
    const rssMB = perf.memory.totalJSHeapSize / (1024 * 1024);

    // Sliding window: keep exactly WINDOW_SIZE samples
    this.samples.push(heapUsedMB);
    if (this.samples.length > WINDOW_SIZE) {
      this.samples.shift();
    }

    // Report stats
    this.callbacks.onStats({
      heapUsedMB: Math.round(heapUsedMB * 10) / 10,
      rssMB: Math.round(rssMB * 10) / 10,
    });

    // Check trend
    const warning = checkTrend(this.samples, GROWTH_THRESHOLD_MB);
    if (warning) {
      this.callbacks.onWarning(warning);
    }
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
