import { describe, it, expect } from 'vitest';
import { PropagationModel } from '../models/PropagationModel';

describe('PropagationModel', () => {
  describe('calculateDistance', () => {
    it('should calculate Euclidean distance correctly', () => {
      const model = new PropagationModel();
      const pos1 = { x: 0, y: 0 };
      const pos2 = { x: 3, y: 4 };

      const distance = model.calculateDistance(pos1, pos2);

      expect(distance).toBe(5);
    });

    it('should handle 3D positions', () => {
      const model = new PropagationModel();
      const pos1 = { x: 0, y: 0, z: 0 };
      const pos2 = { x: 3, y: 4, z: 12 };

      const distance = model.calculateDistance(pos1, pos2);

      expect(distance).toBe(13);
    });
  });

  describe('calculateFreeSpacePathLoss', () => {
    it('should return 0 for distances less than reference distance', () => {
      const model = new PropagationModel();
      const loss = model.calculateFreeSpacePathLoss(0.5);

      expect(loss).toBe(0);
    });

    it('should calculate path loss for valid distances', () => {
      const model = new PropagationModel();
      const loss = model.calculateFreeSpacePathLoss(100);

      expect(loss).toBeGreaterThan(0);
    });
  });

  describe('calculateRSSI', () => {
    it('should calculate RSSI from TX power and path loss', () => {
      const model = new PropagationModel();
      const rssi = model.calculateRSSI(20, 100, 'free-space');

      expect(rssi).toBeLessThan(20); // RSSI should be less than TX power
    });

    it('should support different propagation models', () => {
      const model = new PropagationModel();
      const rssiFreeSpace = model.calculateRSSI(20, 100, 'free-space');
      const rssiTwoRay = model.calculateRSSI(20, 100, 'two-ray');

      expect(rssiFreeSpace).toBeDefined();
      expect(rssiTwoRay).toBeDefined();
    });
  });

  describe('calculateLinkQuality', () => {
    it('should return 0 for very low RSSI', () => {
      const model = new PropagationModel();
      const quality = model.calculateLinkQuality(-110);

      expect(quality).toBe(0);
    });

    it('should return 1 for very high RSSI', () => {
      const model = new PropagationModel();
      const quality = model.calculateLinkQuality(-20);

      expect(quality).toBe(1);
    });

    it('should return value between 0 and 1 for normal RSSI', () => {
      const model = new PropagationModel();
      const quality = model.calculateLinkQuality(-65);

      expect(quality).toBeGreaterThan(0);
      expect(quality).toBeLessThan(1);
    });
  });

  describe('canCommunicate', () => {
    it('should return true when RSSI >= reception sensitivity', () => {
      const model = new PropagationModel();
      const canComm = model.canCommunicate(20, -90, 50, 'two-ray');

      expect(canComm).toBe(true);
    });

    it('should return false when RSSI < reception sensitivity', () => {
      const model = new PropagationModel();
      const canComm = model.canCommunicate(10, -30, 1000, 'two-ray');

      expect(canComm).toBe(false);
    });
  });
});
