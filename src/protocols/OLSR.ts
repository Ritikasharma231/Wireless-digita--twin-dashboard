import { NetworkNode } from '../models/Node';
import type { Packet } from '../types/network';

/**
 * OLSR (Optimized Link State Routing) Protocol
 * 
 * OLSR is a proactive routing protocol that periodically exchanges topology information.
 * Key optimizations:
 * - MPR (Multi-Point Relay): Only selected nodes rebroadcast topology control messages
 * - TC (Topology Control): Only links to MPR selectors are advertised
 * - Hello messages: Local link sensing and MPR selection
 * 
 * This is a simplified implementation focusing on core OLSR concepts.
 */
export class OLSRProtocol {
  private nodes: Map<string, NetworkNode>;
  private helloInterval: number = 2000; // ms
  private tcInterval: number = 5000; // ms
  private topologySet: Map<string, Set<string>>; // destination -> last hop
  private mprSet: Map<string, Set<string>>; // node -> its MPRs
  private mprSelectorSet: Map<string, Set<string>>; // node -> nodes that selected it as MPR

  constructor(nodes: Map<string, NetworkNode>) {
    this.nodes = nodes;
    this.topologySet = new Map();
    this.mprSet = new Map();
    this.mprSelectorSet = new Map();
  }

  /**
   * Send Hello message for local link sensing
   */
  sendHelloPacket(nodeId: string): Packet | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return null;
    }

    const helloPacket: Packet = {
      id: `HELLO-${nodeId}-${Date.now()}`,
      source: nodeId,
      destination: 'broadcast',
      type: 'hello',
      payload: {
        sequenceNumber: node.sequenceNumber,
        neighbors: node.neighbors,
      },
      hopCount: 0,
      maxHops: 1,
      timestamp: Date.now(),
      path: [nodeId],
      size: 64,
    };

    node.packetsSent++;
    return helloPacket;
  }

  /**
   * Process Hello message and update link information
   */
  processHelloPacket(packet: Packet, nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return;
    }

    node.packetsReceived++;

    // Update neighbor information
    const { neighbors } = packet.payload;
    if (Array.isArray(neighbors)) {
      neighbors.forEach((neighborId: string) => {
        if (!node.neighbors.includes(neighborId)) {
          node.neighbors.push(neighborId);
        }
      });
    }

    // Update link state (simplified - bidirectional link assumed)
    const sourceNode = this.nodes.get(packet.source);
    if (sourceNode && !sourceNode.neighbors.includes(nodeId)) {
      sourceNode.neighbors.push(nodeId);
    }
  }

  /**
   * Select Multi-Point Relays (MPRs) for a node
   * MPRs are nodes that will rebroadcast topology control messages
   */
  selectMPRs(nodeId: string): string[] {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return [];
    }

    const twoHopNeighbors = this.getTwoHopNeighbors(nodeId);
    const mprs: string[] = [];

    // Greedy MPR selection algorithm
    const uncovered = new Set(twoHopNeighbors);
    
    while (uncovered.size > 0) {
      let bestNode = '';
      let maxCoverage = 0;

      // Find neighbor that covers most uncovered two-hop neighbors
      node.neighbors.forEach(neighborId => {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor || !neighbor.isActive) return;

        const coverage = neighbor.neighbors.filter(n => uncovered.has(n)).length;
        if (coverage > maxCoverage) {
          maxCoverage = coverage;
          bestNode = neighborId;
        }
      });

      if (bestNode) {
        mprs.push(bestNode);
        const bestNodeObj = this.nodes.get(bestNode);
        if (bestNodeObj) {
          bestNodeObj.neighbors.forEach(n => uncovered.delete(n));
        }
      } else {
        break;
      }
    }

    // Store MPR selection
    this.mprSet.set(nodeId, new Set(mprs));
    
    // Update MPR selector sets
    mprs.forEach(mprId => {
      if (!this.mprSelectorSet.has(mprId)) {
        this.mprSelectorSet.set(mprId, new Set());
      }
      this.mprSelectorSet.get(mprId)!.add(nodeId);
    });

    return mprs;
  }

  /**
   * Get two-hop neighbors of a node
   */
  private getTwoHopNeighbors(nodeId: string): string[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    const twoHop = new Set<string>();
    
    node.neighbors.forEach(neighborId => {
      const neighbor = this.nodes.get(neighborId);
      if (neighbor) {
        neighbor.neighbors.forEach(twoHopId => {
          if (twoHopId !== nodeId && !node.neighbors.includes(twoHopId)) {
            twoHop.add(twoHopId);
          }
        });
      }
    });

    return Array.from(twoHop);
  }

  /**
   * Send Topology Control (TC) message
   * Only MPR nodes send TC messages
   */
  sendTCPacket(nodeId: string): Packet | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return null;
    }

    // Only MPR selectors send TC messages
    const mprSelectors = this.mprSelectorSet.get(nodeId);
    if (!mprSelectors || mprSelectors.size === 0) {
      return null;
    }

    const tcPacket: Packet = {
      id: `TC-${nodeId}-${Date.now()}`,
      source: nodeId,
      destination: 'broadcast',
      type: 'hello', // Reusing hello type for TC in this simplified implementation
      payload: {
        type: 'TC',
        sequenceNumber: node.sequenceNumber,
        mprSelectors: Array.from(mprSelectors),
      },
      hopCount: 0,
      maxHops: 10,
      timestamp: Date.now(),
      path: [nodeId],
      size: 128,
    };

    node.packetsSent++;
    return tcPacket;
  }

  /**
   * Process Topology Control message
   */
  processTCPacket(packet: Packet, nodeId: string): Packet | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return null;
    }

    node.packetsReceived++;

    const { type, mprSelectors } = packet.payload;
    
    if (type === 'TC' && Array.isArray(mprSelectors)) {
      // Update topology set
      if (!this.topologySet.has(packet.source)) {
        this.topologySet.set(packet.source, new Set());
      }
      
      mprSelectors.forEach(selectorId => {
        this.topologySet.get(packet.source)!.add(selectorId);
      });

      // Only MPR nodes forward TC messages
      const isMPR = this.isMPR(nodeId);
      if (isMPR && packet.hopCount < packet.maxHops) {
        const newPacket = { ...packet };
        newPacket.hopCount++;
        newPacket.path = [...packet.path, nodeId];
        node.packetsForwarded++;
        return newPacket;
      }
    }

    return null;
  }

  /**
   * Check if a node is an MPR
   */
  private isMPR(nodeId: string): boolean {
    for (const [_, mprs] of this.mprSet) {
      if (mprs.has(nodeId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Build routing table from topology information
   */
  buildRoutingTable(): void {
    this.nodes.forEach(node => {
      if (!node.isActive) return;

      // Clear existing routing table
      node.routingTable = [];

      // Add direct neighbors
      node.neighbors.forEach(neighborId => {
        node.routingTable.push({
          destination: neighborId,
          nextHop: neighborId,
          hopCount: 1,
          sequenceNumber: 0,
          lifetime: Date.now() + this.tcInterval * 2,
          isValid: true,
        });
      });

      // Add routes from topology set
      this.topologySet.forEach((selectors, sourceId) => {
        if (sourceId === node.id) return; // Skip self

        // Check if we can reach sourceId via MPR
        selectors.forEach(selectorId => {
          if (node.neighbors.includes(selectorId)) {
            // Found route via MPR
            const existing = node.routingTable.find(
              e => e.destination === sourceId
            );
            
            if (!existing || existing.hopCount > 2) {
              node.routingTable.push({
                destination: sourceId,
                nextHop: selectorId,
                hopCount: 2,
                sequenceNumber: 0,
                lifetime: Date.now() + this.tcInterval * 2,
                isValid: true,
              });
            }
          }
        });
      });
    });
  }

  /**
   * Send data packet using OLSR routing
   */
  sendDataPacket(sourceId: string, destinationId: string, data: any): Packet | null {
    const sourceNode = this.nodes.get(sourceId);
    if (!sourceNode || !sourceNode.isActive) {
      return null;
    }

    const route = sourceNode.getRoutingEntry(destinationId);
    if (!route) {
      // Build routing table and try again
      this.buildRoutingTable();
      const newRoute = sourceNode.getRoutingEntry(destinationId);
      if (!newRoute) {
        return null; // No route available
      }
    }

    const packet: Packet = {
      id: `DATA-${sourceId}-${destinationId}-${Date.now()}`,
      source: sourceId,
      destination: destinationId,
      type: 'data',
      payload: data,
      hopCount: 0,
      maxHops: 10,
      timestamp: Date.now(),
      path: [sourceId],
      size: 128,
    };

    sourceNode.packetsSent++;
    return packet;
  }

  /**
   * Process data packet using OLSR routing
   */
  processDataPacket(packet: Packet, nodeId: string): Packet | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return null;
    }

    node.packetsReceived++;

    // Check if we are the destination
    if (nodeId === packet.destination) {
      return null; // Packet delivered
    }

    // Forward to next hop
    const route = node.getRoutingEntry(packet.destination);
    if (route && route.isValid) {
      const newPacket = { ...packet };
      newPacket.hopCount++;
      newPacket.path = [...packet.path, nodeId];
      
      if (newPacket.hopCount < newPacket.maxHops) {
        node.packetsForwarded++;
        return newPacket;
      }
    }

    return null;
  }

  /**
   * Periodic OLSR maintenance
   */
  performMaintenance(): void {
    const now = Date.now();

    this.nodes.forEach(node => {
      if (!node.isActive) return;

      // Periodically select MPRs
      if (now % this.helloInterval < this.config.updateInterval) {
        this.selectMPRs(node.id);
      }

      // Clean up expired routing entries
      node.routingTable = node.routingTable.filter(entry => {
        return entry.lifetime > now;
      });
    });
  }

  /**
   * Cleanup expired topology information
   */
  cleanup(): void {
    // In a full implementation, this would expire old TC messages
    // For simplicity, we keep the topology set current
  }

  private get config() {
    return {
      updateInterval: 1000,
    };
  }

  /**
   * Clear all protocol state
   */
  clear(): void {
    this.topologySet.clear();
    this.mprSet.clear();
    this.mprSelectorSet.clear();
  }
}
