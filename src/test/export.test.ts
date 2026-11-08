import { describe, it, expect } from 'vitest';
import { DataExporter } from '../utils/export';

describe('DataExporter', () => {
  describe('exportMetricsToJSON', () => {
    it('should export metrics to JSON format', () => {
      const metrics = {
        totalPackets: 100,
        successfulPackets: 95,
        failedPackets: 5,
        averageLatency: 10,
        throughput: 10,
        packetLossRate: 5,
        routingOverhead: 10,
        networkLifetime: 1000,
        averageEnergy: 95,
        deadNodes: 0,
        activeRoutes: 5,
      };

      const json = DataExporter.exportMetricsToJSON(metrics);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed.metrics.totalPackets).toBe(100);
    });
  });

  describe('exportMetricsToCSV', () => {
    it('should export metrics to CSV format', () => {
      const metrics = {
        totalPackets: 100,
        successfulPackets: 95,
        failedPackets: 5,
        averageLatency: 10,
        throughput: 10,
        packetLossRate: 5,
        routingOverhead: 10,
        networkLifetime: 1000,
        averageEnergy: 95,
        deadNodes: 0,
        activeRoutes: 5,
      };

      const csv = DataExporter.exportMetricsToCSV(metrics);

      expect(csv).toContain('Metric,Value');
      expect(csv).toContain('Total Packets,100');
      expect(csv).toContain('Successful Packets,95');
    });
  });

  describe('exportMetricsTimeSeries', () => {
    it('should export metrics time series to CSV', () => {
      const metricsHistory = [
        {
          totalPackets: 100,
          successfulPackets: 95,
          failedPackets: 5,
          averageLatency: 10,
          throughput: 10,
          packetLossRate: 5,
          routingOverhead: 10,
          networkLifetime: 1000,
          averageEnergy: 95,
          deadNodes: 0,
          activeRoutes: 5,
        },
        {
          totalPackets: 200,
          successfulPackets: 190,
          failedPackets: 10,
          averageLatency: 11,
          throughput: 11,
          packetLossRate: 5,
          routingOverhead: 10,
          networkLifetime: 2000,
          averageEnergy: 90,
          deadNodes: 0,
          activeRoutes: 6,
        },
      ];

      const csv = DataExporter.exportMetricsTimeSeries(metricsHistory);

      expect(csv).toContain('Timestamp,TotalPackets');
      expect(csv).toContain('0,100');
      expect(csv).toContain('1,200');
    });
  });
});
