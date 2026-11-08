import { NetworkNode } from '../models/Node';
import type { Packet } from '../types/network';

export class DSRProtocol {
  private nodes: Map<string, NetworkNode>;
  private routeCache: Map<string, string[][]>; // destination -> array of routes
  private requestTable: Map<string, Set<string>>; // source -> set of request IDs seen
  private routeCacheTimeout: number = 10000; // ms

  constructor(nodes: Map<string, NetworkNode>) {
    this.nodes = nodes;
    this.routeCache = new Map();
    this.requestTable = new Map();
  }

  discoverRoute(sourceId: string, destinationId: string): Packet | null {
    const sourceNode = this.nodes.get(sourceId);
    if (!sourceNode || !sourceNode.isActive) {
      return null;
    }

    // Check if we have a cached route
    const cachedRoutes = this.routeCache.get(destinationId);
    if (cachedRoutes && cachedRoutes.length > 0) {
      // Use the shortest cached route
      const bestRoute = cachedRoutes.reduce((a, b) => 
        a.length < b.length ? a : b
      );
      return this.createDataPacket(sourceId, destinationId, bestRoute);
    }

    // No cached route, initiate route discovery
    const requestId = `${sourceId}-${destinationId}-${Date.now()}`;
    
    const rreqPacket: Packet = {
      id: `RREQ-${requestId}`,
      source: sourceId,
      destination: destinationId,
      type: 'route_discovery',
      payload: {
        requestId,
        accumulatedRoute: [sourceId],
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

  processRouteDiscovery(packet: Packet, nodeId: string): Packet | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return null;
    }

    node.packetsReceived++;

    const { requestId, accumulatedRoute } = packet.payload;

    // Check if we've already seen this request
    const seenRequests = this.requestTable.get(nodeId) || new Set();
    if (seenRequests.has(requestId)) {
      return null; // Drop duplicate request
    }
    seenRequests.add(requestId);
    this.requestTable.set(nodeId, seenRequests);

    // Check if we are the destination
    if (nodeId === packet.destination) {
      // Send route reply with the accumulated route
      return this.createRouteReply(packet, accumulatedRoute);
    }

    // Check if we are already in the route (loop detection)
    if (accumulatedRoute.includes(nodeId)) {
      return null;
    }

    // Add ourselves to the route
    const newRoute = [...accumulatedRoute, nodeId];

    // Check if we have a cached route to destination
    const cachedRoutes = this.routeCache.get(packet.destination);
    if (cachedRoutes && cachedRoutes.length > 0) {
      // Send route reply with concatenated route
      const bestCachedRoute = cachedRoutes.reduce((a, b) => 
        a.length < b.length ? a : b
      );
      const fullRoute = [...newRoute, ...bestCachedRoute.slice(1)];
      return this.createRouteReply(packet, fullRoute);
    }

    // Broadcast to neighbors
    const newPacket = { ...packet };
    newPacket.hopCount++;
    newPacket.path = newRoute;
    newPacket.payload.accumulatedRoute = newRoute;

    if (newPacket.hopCount < newPacket.maxHops) {
      node.packetsForwarded++;
      return newPacket;
    }

    return null;
  }

  private createRouteReply(rreqPacket: Packet, route: string[]): Packet {
    const rrepPacket: Packet = {
      id: `RREP-${rreqPacket.id}-${Date.now()}`,
      source: rreqPacket.destination,
      destination: rreqPacket.source,
      type: 'route_maintenance',
      payload: {
        route,
      },
      hopCount: 0,
      maxHops: 10,
      timestamp: Date.now(),
      path: [...route].reverse(),
      size: 64,
    };

    return rrepPacket;
  }

  processRouteReply(packet: Packet, nodeId: string): Packet | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return null;
    }

    node.packetsReceived++;

    const { route } = packet.payload;

    // Cache the route
    this.cacheRoute(packet.source, route);

    // Check if we are the original source
    if (nodeId === packet.destination) {
      // Route discovery complete, we can now send data
      return this.createDataPacket(nodeId, packet.source, route);
    }

    // Forward route reply towards source
    const newPacket = { ...packet };
    newPacket.hopCount++;
    
    node.packetsForwarded++;
    return newPacket;
  }

  private cacheRoute(destination: string, route: string[]): void {
    const cachedRoutes = this.routeCache.get(destination) || [];
    
    // Check if this route already exists
    const routeExists = cachedRoutes.some(r => 
      r.length === route.length && r.every((node, i) => node === route[i])
    );
    
    if (!routeExists) {
      cachedRoutes.push(route);
      this.routeCache.set(destination, cachedRoutes);
      
      // Set timeout to expire this route
      setTimeout(() => {
        const routes = this.routeCache.get(destination) || [];
        const index = routes.findIndex(r => 
          r.length === route.length && r.every((node, i) => node === route[i])
        );
        if (index >= 0) {
          routes.splice(index, 1);
          this.routeCache.set(destination, routes);
        }
      }, this.routeCacheTimeout);
    }
  }

  sendDataPacket(sourceId: string, destinationId: string, data: any): Packet | null {
    const sourceNode = this.nodes.get(sourceId);
    if (!sourceNode || !sourceNode.isActive) {
      return null;
    }

    // Check for cached route
    const cachedRoutes = this.routeCache.get(destinationId);
    if (cachedRoutes && cachedRoutes.length > 0) {
      const bestRoute = cachedRoutes.reduce((a, b) => 
        a.length < b.length ? a : b
      );
      return this.createDataPacket(sourceId, destinationId, bestRoute, data);
    }

    // No route, initiate discovery
    return this.discoverRoute(sourceId, destinationId);
  }

  private createDataPacket(sourceId: string, destinationId: string, route: string[], data: any = {}): Packet {
    const packet: Packet = {
      id: `DATA-${sourceId}-${destinationId}-${Date.now()}`,
      source: sourceId,
      destination: destinationId,
      type: 'data',
      payload: data,
      hopCount: 0,
      maxHops: route.length,
      timestamp: Date.now(),
      path: route,
      size: 128,
    };

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

    // Check if we are the next hop in the route
    const routeIndex = packet.path.indexOf(nodeId);
    if (routeIndex === -1 || routeIndex === packet.path.length - 1) {
      // Not on route or at end, packet should be dropped
      return this.createRouteError(packet, nodeId);
    }

    // Forward to next hop
    const nextHop = packet.path[routeIndex + 1];
    const nextHopNode = this.nodes.get(nextHop);
    
    if (!nextHopNode || !nextHopNode.isActive) {
      // Next hop is unreachable, send route error
      return this.createRouteError(packet, nodeId);
    }

    const newPacket = { ...packet };
    newPacket.hopCount++;
    
    node.packetsForwarded++;
    return newPacket;
  }

  private createRouteError(dataPacket: Packet, nodeId: string): Packet {
    const rerrPacket: Packet = {
      id: `RERR-${nodeId}-${Date.now()}`,
      source: nodeId,
      destination: dataPacket.source,
      type: 'rerr',
      payload: {
        unreachableNode: dataPacket.path[dataPacket.path.indexOf(nodeId) + 1] || dataPacket.destination,
        originalPacketId: dataPacket.id,
      },
      hopCount: 0,
      maxHops: 10,
      timestamp: Date.now(),
      path: [nodeId],
      size: 32,
    };

    return rerrPacket;
  }

  processRouteError(packet: Packet, nodeId: string): Packet | null {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isActive) {
      return null;
    }

    node.packetsReceived++;

    const { unreachableNode } = packet.payload;

    // Remove all cached routes containing the unreachable node
    this.routeCache.forEach((routes, destination) => {
      const filteredRoutes = routes.filter(route => 
        !route.includes(unreachableNode)
      );
      this.routeCache.set(destination, filteredRoutes);
    });

    // Forward error towards source
    if (nodeId !== packet.destination) {
      const newPacket = { ...packet };
      newPacket.hopCount++;
      
      node.packetsForwarded++;
      return newPacket;
    }

    return null;
  }

  getRouteCache(destination: string): string[][] {
    return this.routeCache.get(destination) || [];
  }

  clearRouteCache(): void {
    this.routeCache.clear();
    this.requestTable.clear();
  }
}
