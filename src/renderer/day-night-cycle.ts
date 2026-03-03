import {
  DAY_NIGHT_CYCLE_MS,
  DAY_TINT_R, DAY_TINT_G, DAY_TINT_B,
  NIGHT_TINT_R, NIGHT_TINT_G, NIGHT_TINT_B,
} from '../shared/constants';

/**
 * DayNightCycle -- Manages time-of-day progression for the world.
 *
 * Uses a sine-wave-based progression to create smooth, natural-feeling transitions
 * between day and night. The cycle runs continuously regardless of session activity.
 *
 * Key outputs consumed by world.ts:
 *   - getNightIntensity(): 0..1 (0=full day, 1=full night) for glow alpha
 *   - getTintRGB(): [r,g,b] multipliers (0..1) for stage ColorMatrixFilter
 *
 * Cycle shape (10 min):
 *   0:00 - 1:30  Dawn (warming up)
 *   1:30 - 5:00  Daytime (warm golden)
 *   5:00 - 6:30  Dusk (cooling down)
 *   6:30 - 8:30  Night (cool blue)
 *   8:30 - 10:00 Late night -> dawn (warming up)
 */
export class DayNightCycle {
  private elapsed = 0;

  /**
   * Advance the cycle clock.
   * @param deltaMs - Milliseconds since last tick
   */
  tick(deltaMs: number): void {
    this.elapsed += deltaMs;
  }

  /**
   * Get the current cycle progress as 0..1 (wrapping).
   * 0 = cycle start (dawn), 0.5 = dusk, 1.0 = wraps to 0.
   */
  getProgress(): number {
    return (this.elapsed % DAY_NIGHT_CYCLE_MS) / DAY_NIGHT_CYCLE_MS;
  }

  /**
   * Get night intensity (0 = full day, 1 = full night).
   * Uses a smoothed sine-wave shape for natural transitions:
   *   - Progress 0.0-0.15: Day (intensity 0)
   *   - Progress 0.15-0.5: Rising toward night
   *   - Progress 0.5-0.85: Night peak and sustain
   *   - Progress 0.85-1.0: Falling back toward day
   *
   * The sine curve is raised and clamped to produce a pleasing
   * day-dominant cycle: about 50% daylight, 30% night, 20% transition.
   */
  getNightIntensity(): number {
    const p = this.getProgress();
    // Sine wave: sin(2*PI*p - PI/2) gives:
    //   p=0 -> -1 (min), p=0.25 -> 0, p=0.5 -> 1 (max), p=0.75 -> 0, p=1.0 -> -1
    // Normalize to 0..1:
    //   p=0 -> 0, p=0.25 -> 0.5, p=0.5 -> 1.0, p=0.75 -> 0.5, p=1.0 -> 0
    const raw = (Math.sin(2 * Math.PI * p - Math.PI / 2) + 1) / 2;
    // Sharpen: apply a power curve to make day longer and night more distinct
    // pow(raw, 1.5) compresses low values (longer day) and steepens transitions
    return Math.pow(raw, 1.5);
  }

  /**
   * Get the current tint RGB multipliers (each 0..1) for the stage ColorMatrixFilter.
   * Interpolates between day tint and night tint based on night intensity.
   */
  getTintRGB(): [number, number, number] {
    const t = this.getNightIntensity();
    return [
      DAY_TINT_R + (NIGHT_TINT_R - DAY_TINT_R) * t,
      DAY_TINT_G + (NIGHT_TINT_G - DAY_TINT_G) * t,
      DAY_TINT_B + (NIGHT_TINT_B - DAY_TINT_B) * t,
    ];
  }
}
