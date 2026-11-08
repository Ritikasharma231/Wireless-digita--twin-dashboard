/**
 * Seeded Random Number Generator
 * Provides reproducible random numbers for research experiments
 * Uses Mulberry32 algorithm for fast, quality random numbers
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number | string = Date.now()) {
    // Convert string seed to number if needed
    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      this.seed = Math.abs(hash);
    } else {
      this.seed = Math.abs(seed);
    }
  }

  /**
   * Get next random number in [0, 1)
   */
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /**
   * Get random number in [min, max)
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Get random integer in [min, max]
   */
  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Get random element from array
   */
  choice<T>(array: T[]): T {
    return array[this.rangeInt(0, array.length - 1)];
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.rangeInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Generate Gaussian random number (Box-Muller transform)
   */
  gaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + stdDev * z0;
  }

  /**
   * Reset seed to initial value
   */
  reset(seed?: number | string): void {
    if (seed !== undefined) {
      if (typeof seed === 'string') {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          const char = seed.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        this.seed = Math.abs(hash);
      } else {
        this.seed = Math.abs(seed);
      }
    }
  }

  /**
   * Get current seed value
   */
  getSeed(): number {
    return this.seed;
  }
}

// Global seeded random instance (can be set for reproducibility)
let globalSeededRandom: SeededRandom | null = null;

/**
 * Set global seeded random generator
 */
export function setGlobalSeed(seed: number | string): void {
  globalSeededRandom = new SeededRandom(seed);
}

/**
 * Get global seeded random generator (or create unseeded one)
 */
export function getSeededRandom(): SeededRandom {
  if (!globalSeededRandom) {
    globalSeededRandom = new SeededRandom();
  }
  return globalSeededRandom;
}

/**
 * Check if using seeded random
 */
export function isSeeded(): boolean {
  return globalSeededRandom !== null;
}

/**
 * Clear global seeded random (revert to Math.random)
 */
export function clearGlobalSeed(): void {
  globalSeededRandom = null;
}
