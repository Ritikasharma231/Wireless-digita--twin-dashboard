import type { NetworkTopology, NetworkMetrics, NetworkEvent } from '../types/network';

export class DataExporter {
  /**
   * Export network topology to JSON format
   */
  static exportTopologyToJSON(topology: NetworkTopology): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      nodes: Array.from(topology.nodes.values()),
      links: Array.from(topology.links.values()),
      metrics: topology.metrics,
      lastUpdated: topology.lastUpdated,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export network metrics to JSON format
   */
  static exportMetricsToJSON(metrics: NetworkMetrics): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      metrics,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export network events to JSON format
   */
  static exportEventsToJSON(events: NetworkEvent[]): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      eventCount: events.length,
      events,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export network topology to CSV format
   */
  static exportTopologyToCSV(topology: NetworkTopology): string {
    const nodes = Array.from(topology.nodes.values());
    const links = Array.from(topology.links.values());

    // Nodes CSV
    const nodesCSV = [
      'NodeID,PositionX,PositionY,PositionZ,Energy,MaxEnergy,TXPower,RXSensitivity,IsGateway,IsActive,NeighborCount,SequenceNumber',
      ...nodes.map(node => 
        `${node.id},${node.position.x},${node.position.y},${node.position.z || 0},${node.energy},${node.maxEnergy},${node.transmissionPower},${node.receptionSensitivity},${node.isGateway},${node.isActive},${node.neighbors.length},${node.sequenceNumber}`
      ),
    ].join('\n');

    // Links CSV
    const linksCSV = [
      'Source,Target,RSSI,Distance,Bandwidth,Delay,Reliability',
      ...links.map(link => 
        `${link.source},${link.target},${link.rssi.toFixed(2)},${link.distance.toFixed(2)},${link.bandwidth},${link.delay.toFixed(6)},${link.reliability.toFixed(3)}`
      ),
    ].join('\n');

    return `=== NODES ===\n${nodesCSV}\n\n=== LINKS ===\n${linksCSV}`;
  }

  /**
   * Export network metrics to CSV format
   */
  static exportMetricsToCSV(metrics: NetworkMetrics): string {
    const csv = [
      'Metric,Value',
      `Total Packets,${metrics.totalPackets}`,
      `Successful Packets,${metrics.successfulPackets}`,
      `Failed Packets,${metrics.failedPackets}`,
      `Average Latency (ms),${metrics.averageLatency.toFixed(2)}`,
      `Throughput (pps),${metrics.throughput.toFixed(2)}`,
      `Packet Loss Rate (%),${metrics.packetLossRate.toFixed(2)}`,
      `Routing Overhead (%),${metrics.routingOverhead.toFixed(2)}`,
      `Network Lifetime (ms),${metrics.networkLifetime}`,
      `Average Energy (%),${metrics.averageEnergy.toFixed(2)}`,
      `Dead Nodes,${metrics.deadNodes}`,
      `Active Routes,${metrics.activeRoutes}`,
    ].join('\n');

    return csv;
  }

  /**
   * Export network events to CSV format
   */
  static exportEventsToCSV(events: NetworkEvent[]): string {
    const csv = [
      'EventID,Timestamp,Type,Source,Destination,Details',
      ...events.map(event => 
        `${event.id},${event.timestamp},${event.type},${event.source},${event.destination || ''},"${JSON.stringify(event.details).replace(/"/g, '""')}"`
      ),
    ].join('\n');

    return csv;
  }

  /**
   * Export metrics time series (for plotting)
   */
  static exportMetricsTimeSeries(metricsHistory: NetworkMetrics[]): string {
    const csv = [
      'Timestamp,TotalPackets,SuccessfulPackets,FailedPackets,AverageLatency,Throughput,PacketLossRate,RoutingOverhead,AverageEnergy,DeadNodes,ActiveRoutes',
      ...metricsHistory.map((metrics, index) => 
        `${index},${metrics.totalPackets},${metrics.successfulPackets},${metrics.failedPackets},${metrics.averageLatency.toFixed(2)},${metrics.throughput.toFixed(2)},${metrics.packetLossRate.toFixed(2)},${metrics.routingOverhead.toFixed(2)},${metrics.averageEnergy.toFixed(2)},${metrics.deadNodes},${metrics.activeRoutes}`
      ),
    ].join('\n');

    return csv;
  }

  /**
   * Download data as file
   */
  static downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download topology
   */
  static exportTopology(topology: NetworkTopology, format: 'json' | 'csv' = 'json'): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `network-topology-${timestamp}.${format}`;
    
    if (format === 'json') {
      const content = this.exportTopologyToJSON(topology);
      this.downloadFile(content, filename, 'application/json');
    } else {
      const content = this.exportTopologyToCSV(topology);
      this.downloadFile(content, filename, 'text/csv');
    }
  }

  /**
   * Export and download metrics
   */
  static exportMetrics(metrics: NetworkMetrics, format: 'json' | 'csv' = 'json'): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `network-metrics-${timestamp}.${format}`;
    
    if (format === 'json') {
      const content = this.exportMetricsToJSON(metrics);
      this.downloadFile(content, filename, 'application/json');
    } else {
      const content = this.exportMetricsToCSV(metrics);
      this.downloadFile(content, filename, 'text/csv');
    }
  }

  /**
   * Export and download events
   */
  static exportEvents(events: NetworkEvent[], format: 'json' | 'csv' = 'json'): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `network-events-${timestamp}.${format}`;
    
    if (format === 'json') {
      const content = this.exportEventsToJSON(events);
      this.downloadFile(content, filename, 'application/json');
    } else {
      const content = this.exportEventsToCSV(events);
      this.downloadFile(content, filename, 'text/csv');
    }
  }

  /**
   * Export metrics time series
   */
  static exportMetricsHistory(metricsHistory: NetworkMetrics[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `metrics-timeseries-${timestamp}.csv`;
    const content = this.exportMetricsTimeSeries(metricsHistory);
    this.downloadFile(content, filename, 'text/csv');
  }
}
