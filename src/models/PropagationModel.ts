import type { Position } from '../types/network';
import { getSeededRandom, isSeeded } from '../utils/seededRandom';

export class PropagationModel {
  private frequency: number; // MHz
  private pathLossExponent: number;
  private shadowingVariance: number;
  private referenceDistance: number;

  constructor(
    frequency: number = 2400, // 2.4 GHz
    pathLossExponent: number = 2.7,
    shadowingVariance: number = 4.0
  ) {
    this.frequency = frequency;
    this.pathLossExponent = pathLossExponent;
    this.shadowingVariance = shadowingVariance;
    this.referenceDistance = 1.0; // meters
  }

  calculateDistance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = (pos1.z || 0) - (pos2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  calculateFreeSpacePathLoss(distance: number): number {
    if (distance < this.referenceDistance) {
      return 0;
    }
    const wavelength = 300 / this.frequency; // meters
    return 20 * Math.log10(4 * Math.PI * distance / wavelength);
  }

  calculateTwoRayPathLoss(distance: number, txHeight: number = 1.5, rxHeight: number = 1.5): number {
    if (distance < this.referenceDistance) {
      return 0;
    }
    const wavelength = 300 / this.frequency;
    const d_cross = (4 * Math.PI * txHeight * rxHeight) / wavelength;
    
    if (distance <= d_cross) {
      return this.calculateFreeSpacePathLoss(distance);
    }
    
    return 40 * Math.log10(distance) - 10 * Math.log10(txHeight * rxHeight) - 20 * Math.log10(wavelength);
  }

  calculateRSSI(
    txPower: number,
    distance: number,
    model: 'free-space' | 'two-ray' | 'shadowing' | 'rayleigh' | 'rician' = 'two-ray'
  ): number {
    let pathLoss: number;

    switch (model) {
      case 'free-space':
        pathLoss = this.calculateFreeSpacePathLoss(distance);
        break;
      case 'two-ray':
        pathLoss = this.calculateTwoRayPathLoss(distance);
        break;
      case 'shadowing':
        pathLoss = this.calculateShadowingPathLoss(distance);
        break;
      case 'rayleigh':
        pathLoss = this.calculateRayleighPathLoss(distance);
        break;
      case 'rician':
        pathLoss = this.calculateRicianPathLoss(distance);
        break;
      default:
        pathLoss = this.calculateTwoRayPathLoss(distance);
    }

    const rssi = txPower - pathLoss;
    return rssi;
  }

  private calculateShadowingPathLoss(distance: number): number {
    const referenceLoss = this.calculateFreeSpacePathLoss(this.referenceDistance);
    const distanceLoss = 10 * this.pathLossExponent * Math.log10(distance / this.referenceDistance);
    const shadowingComponent = this.generateGaussianNoise(0, this.shadowingVariance);
    return referenceLoss + distanceLoss + shadowingComponent;
  }

  private generateGaussianNoise(mean: number, stdDev: number): number {
    // Use seeded random if available for reproducibility
    if (isSeeded()) {
      const rng = getSeededRandom();
      return rng.gaussian(mean, stdDev);
    }
    
    // Fall back to Math.random
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + stdDev * z0;
  }

  /**
   * Raw Box-Muller transform for generating Gaussian random numbers
   * Used internally to avoid circular dependencies
   */
  private boxMullerGaussian(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Rayleigh Fading Model
   * Models non-line-of-sight (NLOS) conditions with multipath propagation
   * Path loss = basic path loss + Rayleigh fading component
   */
  private calculateRayleighPathLoss(distance: number): number {
    const baseLoss = this.calculateTwoRayPathLoss(distance);
    
    // Rayleigh fading follows Rayleigh distribution
    // Using the inverse transform method to generate Rayleigh-distributed values
    const rng = isSeeded() ? getSeededRandom() : null;
    const u = rng ? rng.next() : Math.random();
    const rayleighFading = -10 * Math.log10(-Math.log(1 - u)); // Convert to dB
    
    // Scale fading (typical values: 6-10 dB standard deviation)
    const fadingScale = 8.0;
    
    return baseLoss + rayleighFading * fadingScale;
  }

  /**
   * Rician Fading Model
   * Models line-of-sight (LOS) conditions with dominant component and multipath
   * Path loss = basic path loss + Rician fading component
   * K-factor represents the ratio of LOS power to multipath power
   */
  private calculateRicianPathLoss(distance: number, kFactor: number = 3.0): number {
    const baseLoss = this.calculateTwoRayPathLoss(distance);
    
    // Rician fading based on K-factor
    // Higher K-factor = stronger LOS component (less fading)
    const ricianComponent = this.generateRicianFading(kFactor);
    
    // Scale based on K-factor (higher K = less variance)
    const fadingScale = 4.0 / Math.sqrt(kFactor);
    
    return baseLoss + ricianComponent * fadingScale;
  }

  /**
   * Generate Rician fading component
   * Uses the property that Rician distribution can be generated from Gaussian
   */
  private generateRicianFading(kFactor: number): number {
    const rng = isSeeded() ? getSeededRandom() : null;
    
    // Generate two independent Gaussian random variables using Box-Muller
    let x, y;
    if (rng) {
      x = rng.gaussian(0, 1);
      y = rng.gaussian(0, 1);
    } else {
      x = this.boxMullerGaussian();
      y = this.boxMullerGaussian();
    }
    
    // Rician: sqrt((x + sqrt(K))^2 + y^2)
    const sqrtK = Math.sqrt(kFactor);
    const rician = Math.sqrt((x + sqrtK) ** 2 + y ** 2);
    
    // Convert to dB and normalize
    return 10 * Math.log10(rician);
  }

  calculateLinkQuality(rssi: number): number {
    // Convert RSSI to link quality (0-1)
    // Assuming RSSI range from -100 dBm (poor) to -30 dBm (excellent)
    const minRSSI = -100;
    const maxRSSI = -30;
    const normalized = (rssi - minRSSI) / (maxRSSI - minRSSI);
    return Math.max(0, Math.min(1, normalized));
  }

  calculateTransmissionDelay(distance: number, speedOfLight: number = 3e8): number {
    return distance / speedOfLight; // seconds
  }

  canCommunicate(txPower: number, rxSensitivity: number, distance: number, model: 'free-space' | 'two-ray' | 'shadowing' | 'rayleigh' | 'rician' = 'two-ray'): boolean {
    const rssi = this.calculateRSSI(txPower, distance, model);
    return rssi >= rxSensitivity;
  }
}
