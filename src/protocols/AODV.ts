import { NetworkNode } from '../models/Node';
import type { Packet, RoutingTableEntry } from '../types/network';

export class AODVProtocol {
  private nodes: Map<string, NetworkNode>;
  private rreqCache: Map<string, number>; // broadcastId -> timestamp
  private activeRouteTimeout: number = 3000; // ms
  private routeDiscoveryTimeout: number = 2000; // ms;

  constructor(nodes: Map<string, NetworkNode>) {
    this.nodes = nodes;
    this.rreqCache = new Map();
  }

  discoverRoute(sourceId: string, destinationId: string): Packet | null {
    const sourceNode = this.nodes.get(sourceId);
    if (!sourceNode || !sourceNode.isActive) {
      return null;
    }

    const broadcastId = sourceNode.incrementBroadcastId();
    const sequenceNumber = sourceNode.incrementSequenceNumber();

    const rreqPacket: Packet = {
      id: `RREQ-${sourceId}-${broadcastId}-${Date.now()}`,
      source: sourceId,
      destination: destinationId,
      type: 'rreq',
      payload: {
        broadcastId,
        sourceSequence: sequenceNumber,
        destinationSequence: 0,
        hopCount: 0,
      },
      hopCount: 0,
      maxHops: 10,
      timestamp: Date.now(),
      path: [sourceId],
      size: 64,
    };

    sourceNode.packetsSent++;
    return rreqPacket;
  }

  processRREQ(packet: Packet, nodeId: string): Packet | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return null;
    }

    node.packetsReceived++;

    const { broadcastId, sourceSequence, destinationSequence } = packet.payload;

    // Check if this RREQ has already been processed
    const rreqKey = `${packet.source}-${broadcastId}`;
    if (node.routingTable.some(e => e.destination === rreqKey)) {
      return null;
    }

    // Record reverse path
    const reverseEntry: RoutingTableEntry = {
      destination: packet.source,
      nextHop: packet.path[packet.path.length - 2] || packet.source,
      hopCount: packet.hopCount,
      sequenceNumber: sourceSequence,
      lifetime: Date.now() + this.activeRouteTimeout,
      isValid: true,
    };
    node.addRoutingEntry(reverseEntry);

    // Mark RREQ as processed to prevent reprocessing
    this.rreqCache.set(rreqKey, Date.now());

    // Check if we are the destination
    if (nodeId === packet.destination) {
      const destSequence = node.incrementSequenceNumber();
      return this.createRREP(packet, nodeId, destSequence);
    }

    // Check if we have a fresh route to destination
    const existingRoute = node.getRoutingEntry(packet.destination);
    if (existingRoute && existingRoute.sequenceNumber >= destinationSequence) {
      return this.createRREP(packet, nodeId, existingRoute.sequenceNumber);
    }

    // Broadcast RREQ to neighbors
    const newPacket = { ...packet };
    newPacket.hopCount++;
    newPacket.path = [...packet.path, nodeId];
    newPacket.payload.hopCount = packet.hopCount + 1;

    if (newPacket.hopCount < newPacket.maxHops) {
      node.packetsForwarded++;
      return newPacket;
    }

    return null;
  }

  private createRREP(rreqPacket: Packet, nodeId: string, destSequence: number): Packet {
    const rrepPacket: Packet = {
      id: `RREP-${nodeId}-${rreqPacket.id}-${Date.now()}`,
      source: nodeId,
      destination: rreqPacket.source,
      type: 'rrep',
      payload: {
        destination: rreqPacket.destination,
        destinationSequence: destSequence,
        hopCount: rreqPacket.hopCount,
        lifetime: this.activeRouteTimeout,
      },
      hopCount: 0,
      maxHops: 10,
      timestamp: Date.now(),
      path: [nodeId],
      size: 64,
    };

    return rrepPacket;
  }

  processRREP(packet: Packet, nodeId: string): Packet | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return null;
    }

    node.packetsReceived++;

    const { destination, destinationSequence, hopCount, lifetime } = packet.payload;

    // Record forward path
    const forwardEntry: RoutingTableEntry = {
      destination: destination,
      nextHop: packet.path[packet.path.length - 2] || packet.source,
      hopCount: hopCount,
      sequenceNumber: destinationSequence,
      lifetime: Date.now() + lifetime,
      isValid: true,
    };
    node.addRoutingEntry(forwardEntry);

    // Check if we are the source (RREP destination)
    if (nodeId === packet.source) {
      return null; // Route discovery complete
    }

    // Forward RREP towards source using reverse path
    const reverseRoute = node.getRoutingEntry(packet.source);
    if (reverseRoute) {
      const newPacket = { ...packet };
      newPacket.hopCount++;
      newPacket.path = [...packet.path, nodeId];
      newPacket.payload.hopCount = hopCount + 1;
      
      node.packetsForwarded++;
      return newPacket;
    }

    return null;
  }

  sendDataPacket(sourceId: string, destinationId: string, data: any): Packet | null {
    const sourceNode = this.nodes.get(sourceId);
    if (!sourceNode || !sourceNode.isActive) {
      return null;
    }

    const route = sourceNode.getRoutingEntry(destinationId);
    if (!route) {
      // Initiate route discovery
      return this.discoverRoute(sourceId, destinationId);
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

    // Route not found, send RERR
    return this.createRERR(packet, nodeId);
  }

  private createRERR(dataPacket: Packet, nodeId: string): Packet {
    const rerrPacket: Packet = {
      id: `RERR-${nodeId}-${Date.now()}`,
      source: nodeId,
      destination: dataPacket.source,
      type: 'rerr',
      payload: {
        unreachableDestinations: [dataPacket.destination],
        destinationSequence: 0,
      },
      hopCount: 0,
      maxHops: 10,
      timestamp: Date.now(),
      path: [nodeId],
      size: 32,
    };

    return rerrPacket;
  }

  processRERR(packet: Packet, nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return;
    }

    node.packetsReceived++;

    const { unreachableDestinations } = packet.payload;

    // Invalidate routes to unreachable destinations
    unreachableDestinations.forEach((dest: string) => {
      const entry = node.routingTable.find(e => e.destination === dest);
      if (entry) {
        entry.isValid = false;
      }
    });
  }

  cleanupExpiredRoutes(): void {
    const now = Date.now();
    this.nodes.forEach(node => {
      node.routingTable = node.routingTable.filter(entry => {
        // Remove expired routes
        if (entry.lifetime < now) {
          return false;
        }
        // Cleanup cache entries (rreqKey entries with isValid: false)
        if (!entry.isValid) {
          return false;
        }
        return true;
      });
    });
    
    // Cleanup RREQ cache entries older than route discovery timeout
    for (const [key, timestamp] of this.rreqCache) {
      if (now - timestamp > this.routeDiscoveryTimeout) {
        this.rreqCache.delete(key);
      }
    }
  }

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
      },
      hopCount: 0,
      maxHops: 1,
      timestamp: Date.now(),
      path: [nodeId],
      size: 32,
    };

    node.packetsSent++;
    return helloPacket;
  }

  processHelloPacket(packet: Packet, nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return;
    }

    node.packetsReceived++;

    // Update neighbor information
    if (!node.neighbors.includes(packet.source)) {
      node.neighbors.push(packet.source);
    }
  }
}
