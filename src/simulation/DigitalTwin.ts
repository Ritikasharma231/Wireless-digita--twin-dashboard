import { NetworkSimulation } from './NetworkSimulation';
import type { DigitalTwinState, SimulationConfig } from '../types/network';

export class DigitalTwin {
  private physicalSimulation: NetworkSimulation;
  private virtualSimulation: NetworkSimulation;
  private state: DigitalTwinState;
  private syncInterval: number;
  private predictionAccuracy: number;
  private syncTimer: number | null;
  private dynamicThreshold: number;
  private lastDeviation: number;
  private syncCount: number;

  constructor(config: SimulationConfig, syncInterval: number = 1000) {
    this.physicalSimulation = new NetworkSimulation(config);
    this.virtualSimulation = new NetworkSimulation(config);
    this.syncInterval = syncInterval;
    this.predictionAccuracy = 0.95;
    this.syncTimer = null;
    this.dynamicThreshold = 0.1; // Initial threshold
    this.lastDeviation = 0;
    this.syncCount = 0;

    this.state = {
      physicalTopology: this.physicalSimulation.getTopology(),
      virtualTopology: this.virtualSimulation.getTopology(),
      syncStatus: 'synced',
      lastSyncTime: Date.now(),
      predictionAccuracy: this.predictionAccuracy,
      dynamicThreshold: this.dynamicThreshold,
      syncCount: 0,
    };
  }

  // Sync physical topology to virtual twin (with event-triggered logic)
  syncPhysicalToVirtual(eventTriggered: boolean = false): void {
    // Calculate state deviation
    const deviation = this.calculateStateDeviation();
    this.lastDeviation = deviation;

    // Only sync if event-triggered or deviation exceeds dynamic threshold
    if (!eventTriggered && deviation < this.dynamicThreshold) {
      // Skip sync - no significant change
      return;
    }

    this.state.syncStatus = 'syncing';
    this.syncCount++;

    const physicalTopology = this.physicalSimulation.getTopology();
    
    // Update virtual simulation to match physical
    this.virtualSimulation.reset();

    physicalTopology.nodes.forEach((node) => {
      this.virtualSimulation.addNode(node);
    });

    this.state.physicalTopology = physicalTopology;
    this.state.virtualTopology = this.virtualSimulation.getTopology();
    this.state.lastSyncTime = Date.now();
    this.state.syncStatus = 'synced';
    this.state.dynamicThreshold = this.dynamicThreshold;
    this.state.syncCount = this.syncCount;

    // Adjust dynamic threshold based on network conditions
    this.updateDynamicThreshold(physicalTopology);
  }

  // Sync virtual topology to physical (for applying what-if scenarios)
  syncVirtualToPhysical(): void {
    this.state.syncStatus = 'syncing';

    const virtualTopology = this.virtualSimulation.getTopology();
    
    // Update physical simulation to match virtual
    this.physicalSimulation.reset();

    virtualTopology.nodes.forEach((node) => {
      this.physicalSimulation.addNode(node);
    });

    this.state.virtualTopology = virtualTopology;
    this.state.physicalTopology = this.physicalSimulation.getTopology();
    this.state.lastSyncTime = Date.now();
    this.state.syncStatus = 'synced';
  }

  // Compare physical and virtual topologies
  compareTopologies(): {
    nodesMatch: boolean;
    linksMatch: boolean;
    metricsDiff: any;
    accuracy: number;
  } {
    const physical = this.state.physicalTopology;
    const virtual = this.state.virtualTopology;

    const nodesMatch = physical.nodes.size === virtual.nodes.size;
    const linksMatch = physical.links.size === virtual.links.size;

    const metricsDiff = {
      totalPackets: Math.abs(physical.metrics.totalPackets - virtual.metrics.totalPackets),
      successfulPackets: Math.abs(physical.metrics.successfulPackets - virtual.metrics.successfulPackets),
      averageLatency: Math.abs(physical.metrics.averageLatency - virtual.metrics.averageLatency),
      throughput: Math.abs(physical.metrics.throughput - virtual.metrics.throughput),
      packetLossRate: Math.abs(physical.metrics.packetLossRate - virtual.metrics.packetLossRate),
    };

    // Calculate overall accuracy
    const maxPackets = Math.max(physical.metrics.totalPackets, virtual.metrics.totalPackets) || 1;
    const packetAccuracy = 1 - (metricsDiff.totalPackets / maxPackets);
    const metricsAccuracy = 1 - (
      (metricsDiff.averageLatency / 1000) +
      (metricsDiff.packetLossRate / 100) +
      (metricsDiff.throughput / 100)
    ) / 3;

    const accuracy = (packetAccuracy + metricsAccuracy) / 2;
    this.state.predictionAccuracy = accuracy;

    return {
      nodesMatch,
      linksMatch,
      metricsDiff,
      accuracy,
    };
  }

  // Calculate state deviation between physical and virtual
  private calculateStateDeviation(): number {
    const physical = this.state.physicalTopology;
    const virtual = this.state.virtualTopology;

    // Calculate deviation based on metrics
    const packetDeviation = Math.abs(physical.metrics.totalPackets - virtual.metrics.totalPackets) / (Math.max(physical.metrics.totalPackets, 1));
    const latencyDeviation = Math.abs(physical.metrics.averageLatency - virtual.metrics.averageLatency) / 1000;
    const energyDeviation = Math.abs(physical.metrics.averageEnergy - virtual.metrics.averageEnergy) / 100;

    return (packetDeviation + latencyDeviation + energyDeviation) / 3;
  }

  // Update dynamic threshold based on network conditions
  private updateDynamicThreshold(topology: any): void {
    // Calculate network volatility (how fast topology changes)
    const volatility = this.calculateNetworkVolatility(topology);
    
    // Higher volatility = higher threshold (reduce sync frequency)
    // Lower volatility = lower threshold (increase sync accuracy)
    const baseThreshold = 0.1;
    const adjustedThreshold = baseThreshold * (1 + volatility);
    
    // Clamp threshold between 0.05 and 0.3
    this.dynamicThreshold = Math.max(0.05, Math.min(0.3, adjustedThreshold));
  }

  // Calculate network volatility (rate of change)
  private calculateNetworkVolatility(topology: any): number {
    // Simple volatility metric based on mobility and node changes
    const numMovingNodes = Array.from(topology.nodes.values()).filter((node: any) => 
      node.mobilityPattern && node.mobilityPattern !== 'static'
    ).length;
    
    const totalNodes = topology.nodes.size;
    const mobilityRatio = totalNodes > 0 ? numMovingNodes / totalNodes : 0;
    
    return mobilityRatio * 0.5; // Scale to 0-0.5 range
  }

  // Get current dynamic threshold
  getDynamicThreshold(): number {
    return this.dynamicThreshold;
  }

  // Get sync statistics
  getSyncStats(): {
    syncCount: number;
    lastDeviation: number;
    dynamicThreshold: number;
  } {
    return {
      syncCount: this.syncCount,
      lastDeviation: this.lastDeviation,
      dynamicThreshold: this.dynamicThreshold,
    };
  }

  // Run what-if scenario in virtual twin
  runWhatIfScenario(
    scenarioConfig: Partial<SimulationConfig>,
    duration: number = 10000
  ): Promise<{
    physicalMetrics: any;
    virtualMetrics: any;
    comparison: any;
  }> {
    return new Promise((resolve) => {
      // Save current virtual state
      const originalVirtualTopology = this.virtualSimulation.getTopology();

      // Apply scenario to virtual simulation
      this.virtualSimulation.updateConfig(scenarioConfig);
      this.virtualSimulation.start();

      const steps = duration / this.syncInterval;
      let currentStep = 0;

      const interval = setInterval(() => {
        this.virtualSimulation.step();
        currentStep++;

        if (currentStep >= steps) {
          clearInterval(interval);
          this.virtualSimulation.stop();

          const physicalMetrics = this.physicalSimulation.getMetrics();
          const virtualMetrics = this.virtualSimulation.getMetrics();
          const comparison = this.compareTopologies();

          // Restore original virtual state
          this.virtualSimulation.reset();
          originalVirtualTopology.nodes.forEach((node) => {
            this.virtualSimulation.addNode(node);
          });

          resolve({
            physicalMetrics,
            virtualMetrics,
            comparison,
          });
        }
      }, this.syncInterval);
    });
  }

  // Predict network behavior using virtual twin
  predictBehavior(horizon: number = 5000): {
    predictedMetrics: any;
    confidence: number;
  } {
    // Save current virtual state
    const originalVirtualTopology = this.virtualSimulation.getTopology();

    // Run virtual simulation for prediction horizon
    this.virtualSimulation.start();
    const steps = horizon / this.syncInterval;

    for (let i = 0; i < steps; i++) {
      this.virtualSimulation.step();
    }

    this.virtualSimulation.stop();

    const predictedMetrics = this.virtualSimulation.getMetrics();

    // Restore original virtual state
    this.virtualSimulation.reset();
    originalVirtualTopology.nodes.forEach((node) => {
      this.virtualSimulation.addNode(node);
    });

    // Calculate confidence based on historical accuracy
    const confidence = this.state.predictionAccuracy;

    return {
      predictedMetrics,
      confidence,
    };
  }

  // Detect anomalies between physical and virtual
  detectAnomalies(): {
    hasAnomalies: boolean;
    anomalies: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
    }>;
  } {
    const comparison = this.compareTopologies();
    const anomalies: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
    }> = [];

    if (!comparison.nodesMatch) {
      anomalies.push({
        type: 'topology_mismatch',
        severity: 'high',
        description: 'Node count mismatch between physical and virtual twins',
      });
    }

    if (!comparison.linksMatch) {
      anomalies.push({
        type: 'connectivity_mismatch',
        severity: 'medium',
        description: 'Link count mismatch between physical and virtual twins',
      });
    }

    if (comparison.metricsDiff.packetLossRate > 10) {
      anomalies.push({
        type: 'performance_anomaly',
        severity: 'high',
        description: `Significant packet loss rate difference: ${comparison.metricsDiff.packetLossRate.toFixed(2)}%`,
      });
    }

    if (comparison.metricsDiff.averageLatency > 100) {
      anomalies.push({
        type: 'latency_anomaly',
        severity: 'medium',
        description: `Significant latency difference: ${comparison.metricsDiff.averageLatency.toFixed(2)}ms`,
      });
    }

    if (comparison.accuracy < 0.8) {
      anomalies.push({
        type: 'prediction_accuracy',
        severity: 'high',
        description: `Low prediction accuracy: ${(comparison.accuracy * 100).toFixed(1)}%`,
      });
    }

    return {
      hasAnomalies: anomalies.length > 0,
      anomalies,
    };
  }

  // Start automatic synchronization
  startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = window.setInterval(() => {
      this.syncPhysicalToVirtual();
    }, this.syncInterval);
  }

  // Stop automatic synchronization
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // Get current digital twin state
  getState(): DigitalTwinState {
    return { ...this.state };
  }

  // Get physical simulation
  getPhysicalSimulation(): NetworkSimulation {
    return this.physicalSimulation;
  }

  // Get virtual simulation
  getVirtualSimulation(): NetworkSimulation {
    return this.virtualSimulation;
  }

  // Update sync interval
  setSyncInterval(interval: number): void {
    this.syncInterval = interval;
    if (this.syncTimer) {
      this.stopAutoSync();
      this.startAutoSync();
    }
  }

  // Reset digital twin
  reset(): void {
    this.stopAutoSync();
    this.physicalSimulation.reset();
    this.virtualSimulation.reset();
    this.syncCount = 0;
    this.dynamicThreshold = 0.1;
    this.state = {
      physicalTopology: this.physicalSimulation.getTopology(),
      virtualTopology: this.virtualSimulation.getTopology(),
      syncStatus: 'synced',
      lastSyncTime: Date.now(),
      predictionAccuracy: 0.95,
      dynamicThreshold: this.dynamicThreshold,
      syncCount: 0,
    };
  }
}
