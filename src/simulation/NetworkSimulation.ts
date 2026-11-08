import { NetworkNode } from '../models/Node';
import { PropagationModel } from '../models/PropagationModel';
import { AODVProtocol } from '../protocols/AODV';
import { DSRProtocol } from '../protocols/DSR';
import { OLSRProtocol } from '../protocols/OLSR';
import { RLAgentWrapper } from './RLAgentWrapper';
import { RLRoutingHelper } from './RLRoutingHelper';
import type { Node, Packet, NetworkTopology, NetworkMetrics, Link, SimulationConfig, NetworkEvent } from '../types/network';

export class NetworkSimulation {
  private nodes: Map<string, NetworkNode>;
  private propagationModel: PropagationModel;
  private aodvProtocol: AODVProtocol;
  private dsrProtocol: DSRProtocol;
  private olsrProtocol: OLSRProtocol;
  private rlAgent: RLAgentWrapper | null;
  private config: SimulationConfig;
  private packetQueue: Packet[];
  private eventLog: NetworkEvent[];
  private metrics: NetworkMetrics;
  private simulationTime: number;
  private packetLatencies: Map<string, number>;
  private currentEpisodeReward: number;
  private episodeStepCount: number;
  private rlTransitions: Array<{
    state: any;
    action: any;
    reward: number;
    nextState: any;
    done: boolean;
  }>;
  private lastRLState: any;

  constructor(config: SimulationConfig) {
    this.nodes = new Map();
    this.propagationModel = new PropagationModel(
      2400,
      2.7,
      config.shadowingVariance
    );
    this.config = config;
    this.packetQueue = [];
    this.eventLog = [];
    this.metrics = this.initializeMetrics();
    this.simulationTime = 0;
    this.packetLatencies = new Map();
    this.currentEpisodeReward = 0;
    this.episodeStepCount = 0;
    this.rlTransitions = [];
    this.lastRLState = null;

    this.aodvProtocol = new AODVProtocol(this.nodes);
    this.dsrProtocol = new DSRProtocol(this.nodes);
    this.olsrProtocol = new OLSRProtocol(this.nodes);
    
    // Initialize RL agent if enabled
    this.rlAgent = config.rlEnabled ? new RLAgentWrapper() : null;
  }

  private initializeMetrics(): NetworkMetrics {
    return {
      totalPackets: 0,
      successfulPackets: 0,
      failedPackets: 0,
      averageLatency: 0,
      throughput: 0,
      packetLossRate: 0,
      routingOverhead: 0,
      networkLifetime: 0,
      averageEnergy: 100,
      deadNodes: 0,
      activeRoutes: 0,
    };
  }

  addNode(nodeConfig: Partial<Node> & { id: string }): void {
    const node = new NetworkNode(nodeConfig);
    this.nodes.set(node.id, node);
    this.logEvent('node_added', node.id, undefined, { position: node.position });
  }

  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.nodes.delete(nodeId);
      this.logEvent('node_removed', nodeId, undefined, { position: node.position });
    }
  }

  updateTopology(): void {
    // Update node positions if mobility is enabled
    if (this.config.mobilityEnabled) {
      this.nodes.forEach(node => {
        if (node.isActive) {
          node.updatePosition(this.config.updateInterval / 1000);
        }
      });
    }

    // Update neighbor relationships based on signal propagation
    this.nodes.forEach(node => {
      if (!node.isActive) {
        node.neighbors = [];
        return;
      }

      node.neighbors = [];
      this.nodes.forEach(neighbor => {
        if (node.id === neighbor.id || !neighbor.isActive) {
          return;
        }

        const distance = this.propagationModel.calculateDistance(
          node.position,
          neighbor.position
        );

        const canCommunicate = this.propagationModel.canCommunicate(
          node.transmissionPower,
          neighbor.receptionSensitivity,
          distance,
          this.config.signalPropagationModel
        );

        if (canCommunicate) {
          node.neighbors.push(neighbor.id);
          
          // Update LDV for this link
          const rssi = this.propagationModel.calculateRSSI(
            node.transmissionPower,
            distance,
            this.config.signalPropagationModel
          );
          node.updateLDV(rssi);
        }
      });
    });

    // Update node energy if depletion is enabled
    if (this.config.energyDepletionEnabled) {
      this.nodes.forEach(node => {
        if (node.isActive) {
          const energyCost = this.calculateEnergyCost(node);
          node.consumeEnergy(energyCost);
          
          if (node.isDead()) {
            this.logEvent('node_failure', node.id, undefined, { 
              energy: node.energy,
              position: node.position 
            });
          }
        }
      });
    }
  }

  private calculateEnergyCost(node: NetworkNode): number {
    // Base energy cost for being active
    let cost = 0.01;

    // Energy cost for transmissions
    cost += node.packetsSent * 0.1;
    cost += node.packetsForwarded * 0.05;
    cost += node.packetsReceived * 0.02;

    // Reset counters for next interval
    node.packetsSent = 0;
    node.packetsReceived = 0;
    node.packetsForwarded = 0;

    return cost;
  }

  processPacket(packet: Packet, currentNodeId: string): Packet | null {
    this.metrics.totalPackets++;
    const startTime = this.simulationTime;

    let processedPacket: Packet | null = null;

    switch (packet.type) {
      case 'rreq':
        processedPacket = this.aodvProtocol.processRREQ(packet, currentNodeId);
        break;
      case 'rrep':
        processedPacket = this.aodvProtocol.processRREP(packet, currentNodeId);
        break;
      case 'rerr':
        this.aodvProtocol.processRERR(packet, currentNodeId);
        break;
      case 'hello':
        if (this.config.routingProtocol === 'OLSR') {
          // OLSR processes hello packets
          if (packet.payload.type === 'TC') {
            processedPacket = this.olsrProtocol.processTCPacket(packet, currentNodeId);
          } else {
            this.olsrProtocol.processHelloPacket(packet, currentNodeId);
          }
        } else {
          this.aodvProtocol.processHelloPacket(packet, currentNodeId);
        }
        break;
      case 'route_discovery':
        processedPacket = this.dsrProtocol.processRouteDiscovery(packet, currentNodeId);
        break;
      case 'route_maintenance':
        processedPacket = this.dsrProtocol.processRouteReply(packet, currentNodeId);
        break;
      case 'data':
        processedPacket = this.processDataPacket(packet, currentNodeId);
        break;
      default:
        break;
    }

    // Track latency for data packets using simulation time
    if (packet.type === 'data') {
      const latency = this.simulationTime - startTime;
      this.packetLatencies.set(packet.id, latency);
    }

    return processedPacket;
  }

  private processDataPacket(packet: Packet, currentNodeId: string): Packet | null {
    let processedPacket: Packet | null = null;

    if (this.config.routingProtocol === 'DRL' && this.rlAgent && this.rlAgent.isReady()) {
      // Use RL agent for routing decision
      processedPacket = this.processPacketWithRL(packet, currentNodeId);
    } else if (this.config.routingProtocol === 'AODV') {
      processedPacket = this.aodvProtocol.processDataPacket(packet, currentNodeId);
    } else if (this.config.routingProtocol === 'DSR') {
      processedPacket = this.dsrProtocol.processDataPacket(packet, currentNodeId);
    } else if (this.config.routingProtocol === 'OLSR') {
      processedPacket = this.olsrProtocol.processDataPacket(packet, currentNodeId);
    }

    // Check if packet was delivered
    if (currentNodeId === packet.destination && processedPacket === null) {
      this.metrics.successfulPackets++;
      const latency = this.packetLatencies.get(packet.id) || 0;
      this.updateAverageLatency(latency);
      this.logEvent('packet_received', packet.source, packet.destination, {
        packetId: packet.id,
        latency,
      });
    }

    return processedPacket;
  }

  private processPacketWithRL(packet: Packet, currentNodeId: string): Packet | null {
    const currentNode = this.nodes.get(currentNodeId);
    if (!currentNode || !currentNode.isActive) {
      // Drop packet if current node is dead
      this.metrics.failedPackets++;
      this.logEvent('packet_dropped', currentNodeId, packet.destination, {
        reason: 'node_dead',
        packetId: packet.id,
      });
      
      // Store transition if we have a previous state (store in both modes for data collection)
      if (this.lastRLState && this.rlAgent) {
        this.storeRLTransitionInternal(this.lastRLState, { action_type: 'drop' }, -1.0, null, false);
        this.lastRLState = null;
      }
      
      return null;
    }

    // If we're at the destination, packet is delivered
    if (currentNodeId === packet.destination) {
      // Positive reward for successful delivery (store in both modes for data collection)
      if (this.lastRLState && this.rlAgent) {
        const latency = this.packetLatencies.get(packet.id) || 0;
        const reward = this.computeDeliveryReward(latency, currentNode.energy);
        this.storeRLTransitionInternal(this.lastRLState, { action_type: 'forward' }, reward, null, true);
        this.lastRLState = null;
      }
      return null; // Packet delivered
    }

    // Capture current state
    const currentState = this.getTopology();
    const currentStateRL = this.rlAgent ? this.rlAgent.extractState(currentState) : null;

    // Get action from RL agent or heuristic fallback
    let rlAction;

    // For now, always use heuristic in synchronous context
    // Full async RL integration would require architectural changes
    if (this.rlAgent && this.rlAgent.isReady() && this.config.rlMode === 'inference') {
      // Try to get action from actual RL agent (simplified - use heuristic for now)
      rlAction = RLRoutingHelper.getHeuristicAction(currentNode, packet.destination, this.nodes);
    } else {
      rlAction = RLRoutingHelper.getHeuristicAction(currentNode, packet.destination, this.nodes);
    }

    // Validate action
    if (!RLRoutingHelper.isActionValid(rlAction, currentNodeId, currentNode)) {
      this.metrics.failedPackets++;
      this.logEvent('packet_dropped', currentNodeId, packet.destination, {
        reason: 'invalid_action',
        packetId: packet.id,
      });
      
      // Store transition with negative reward (store in both modes for data collection)
      if (currentStateRL && this.rlAgent) {
        this.storeRLTransitionInternal(currentStateRL, rlAction, -0.5, null, false);
      }
      
      return null;
    }

    // Apply RL action
    let packetDropped = false;
    
    switch (rlAction.action_type) {
      case 'drop':
        // Drop the packet
        this.metrics.failedPackets++;
        this.logEvent('packet_dropped', currentNodeId, packet.destination, {
          reason: 'rl_decision',
          packetId: packet.id,
        });
        packetDropped = true;
        break;

      case 'sleep':
        // Put node to sleep (do not forward)
        this.logEvent('node_sleep', currentNodeId, undefined, {
          packetId: packet.id,
        });
        packetDropped = true;
        break;

      case 'broadcast':
        // Broadcast to all neighbors
        const broadcastResult = this.broadcastPacket(packet, currentNodeId);
        if (currentStateRL && this.rlAgent) {
          const nextState = this.getTopology();
          const nextStateRL = this.rlAgent ? this.rlAgent.extractState(nextState) : null;
          const reward = this.computeForwardReward(broadcastResult !== null, currentNode.energy);
          this.storeRLTransitionInternal(currentStateRL, rlAction, reward, nextStateRL, false);
        }
        return broadcastResult;

      case 'forward':
      default:
        // Forward to specific next hop
        if (rlAction.next_hop && rlAction.next_hop !== currentNodeId) {
          // Apply transmission power
          currentNode.transmissionPower = rlAction.transmissionPower;

          // Create forward packet
          const forwardPacket: Packet = {
            ...packet,
            hopCount: packet.hopCount + 1,
            path: [...packet.path, currentNodeId],
          };

          forwardPacket.path.push(rlAction.next_hop);

          // Check if next hop is a neighbor
          if (currentNode.neighbors.includes(rlAction.next_hop)) {
            this.logEvent('packet_forwarded', currentNodeId, rlAction.next_hop, {
              packetId: packet.id,
              hopCount: forwardPacket.hopCount,
              transmissionPower: rlAction.transmissionPower,
            });
            
            // Store transition (store in both modes for data collection)
            if (currentStateRL && this.rlAgent) {
              const nextState = this.getTopology();
              const nextStateRL = this.rlAgent ? this.rlAgent.extractState(nextState) : null;
              const reward = this.computeForwardReward(true, currentNode.energy);
              this.storeRLTransitionInternal(currentStateRL, rlAction, reward, nextStateRL, false);
              this.lastRLState = nextStateRL;
            }
            
            return forwardPacket;
          } else {
            // Next hop not in range, drop packet
            this.metrics.failedPackets++;
            this.logEvent('packet_dropped', currentNodeId, rlAction.next_hop, {
              reason: 'next_hop_out_of_range',
              packetId: packet.id,
            });
            packetDropped = true;
          }
        } else {
          // Invalid next hop, drop packet
          this.metrics.failedPackets++;
          this.logEvent('packet_dropped', currentNodeId, packet.destination, {
            reason: 'invalid_next_hop',
            packetId: packet.id,
          });
          packetDropped = true;
        }
    }

    // Store transition for dropped packets (store in both modes for data collection)
    if (packetDropped && currentStateRL && this.rlAgent) {
      const nextState = this.getTopology();
      const nextStateRL = this.rlAgent ? this.rlAgent.extractState(nextState) : null;
      const reward = this.computeForwardReward(false, currentNode.energy);
      this.storeRLTransitionInternal(currentStateRL, rlAction, reward, nextStateRL, false);
    }

    return null;
  }

  /**
   * Compute reward for successful packet delivery
   */
  private computeDeliveryReward(latency: number, nodeEnergy: number): number {
    // Higher reward for low latency, penalize high energy use
    const latencyPenalty = Math.min(latency / 1000.0, 1.0); // Normalize to 0-1
    const energyPenalty = (100 - nodeEnergy) / 100.0; // Energy percentage penalty
    return 1.0 - latencyPenalty - energyPenalty * 0.5;
  }

  /**
   * Compute reward for forwarding decision
   */
  private computeForwardReward(success: boolean, nodeEnergy: number): number {
    if (!success) return -0.5;
    const energyPenalty = (100 - nodeEnergy) / 100.0;
    return 0.2 - energyPenalty * 0.1;
  }

  /**
   * Store transition internally
   */
  private storeRLTransitionInternal(
    state: any,
    action: any,
    reward: number,
    nextState: any,
    done: boolean
  ): void {
    this.rlTransitions.push({ state, action, reward, nextState, done });
    
    // Limit transition buffer size
    if (this.rlTransitions.length > 10000) {
      this.rlTransitions.shift();
    }
  }

  private broadcastPacket(packet: Packet, currentNodeId: string): Packet | null {
    const currentNode = this.nodes.get(currentNodeId);
    if (!currentNode || !currentNode.isActive) {
      return null;
    }

    // Create copies for each neighbor
    const packets: Packet[] = [];
    
    for (const neighborId of currentNode.neighbors) {
      if (neighborId === packet.source) continue; // Don't send back to source
      
      const forwardPacket: Packet = {
        ...packet,
        hopCount: packet.hopCount + 1,
        path: [...packet.path, currentNodeId],
      };
      
      forwardPacket.path.push(neighborId);
      packets.push(forwardPacket);
    }

    // Add all packets to queue
    for (const p of packets) {
      this.packetQueue.push(p);
    }

    this.logEvent('packet_broadcast', currentNodeId, undefined, {
      packetId: packet.id,
      neighbors: currentNode.neighbors.length,
    });

    return null; // Original packet consumed
  }

  private updateAverageLatency(newLatency: number): void {
    const totalLatency = this.metrics.averageLatency * (this.metrics.successfulPackets - 1);
    this.metrics.averageLatency = (totalLatency + newLatency) / this.metrics.successfulPackets;
  }

  sendPacket(sourceId: string, destinationId: string, data: any = {}): void {
    let packet: Packet | null = null;

    if (this.config.routingProtocol === 'DRL' && this.rlAgent && this.rlAgent.isReady()) {
      // Use RL agent for routing decision
      // For now, use AODV structure but could be replaced with RL-generated packets
      packet = this.aodvProtocol.sendDataPacket(sourceId, destinationId, data);
    } else if (this.config.routingProtocol === 'AODV') {
      packet = this.aodvProtocol.sendDataPacket(sourceId, destinationId, data);
    } else if (this.config.routingProtocol === 'DSR') {
      packet = this.dsrProtocol.sendDataPacket(sourceId, destinationId, data);
    } else if (this.config.routingProtocol === 'OLSR') {
      packet = this.olsrProtocol.sendDataPacket(sourceId, destinationId, data);
    }

    if (packet) {
      this.packetQueue.push(packet);
      this.logEvent('packet_sent', sourceId, destinationId, { packetId: packet.id });
    }
  }

  step(): void {
    this.simulationTime += this.config.updateInterval;
    this.updateTopology();

    // Process packets in queue
    const newQueue: Packet[] = [];
    
    for (const packet of this.packetQueue) {
      const currentNodeId = packet.path[packet.path.length - 1];
      const nextHops = this.getNextHops(packet, currentNodeId);

      if (nextHops.length > 0) {
        // For each next hop, create a copy of the packet
        for (const nextHop of nextHops) {
          const nextHopNode = this.nodes.get(nextHop);
          if (nextHopNode && nextHopNode.isActive) {
            const packetCopy = { ...packet, path: [...packet.path] };
            const processedPacket = this.processPacket(packetCopy, nextHop);
            if (processedPacket) {
              newQueue.push(processedPacket);
            }
          } else {
            this.metrics.failedPackets++;
            this.logEvent('packet_dropped', currentNodeId, packet.destination, {
              packetId: packet.id,
              reason: 'next_hop_unreachable',
              nextHop,
            });
          }
        }
      } else {
        this.metrics.failedPackets++;
        this.logEvent('packet_dropped', currentNodeId, packet.destination, {
          packetId: packet.id,
          reason: 'no_route',
        });
      }
    }

    this.packetQueue = newQueue;

    // Cleanup expired routes and perform protocol maintenance
    if (this.config.routingProtocol === 'AODV') {
      this.aodvProtocol.cleanupExpiredRoutes();
    } else if (this.config.routingProtocol === 'OLSR') {
      this.olsrProtocol.performMaintenance();
    }

    // Update metrics
    this.updateMetrics();
  }

  private getNextHops(packet: Packet, currentNodeId: string): string[] {
    if (packet.type === 'data' || packet.type === 'rrep' || packet.type === 'route_maintenance') {
      const node = this.nodes.get(currentNodeId);
      if (!node) return [];

      if (this.config.routingProtocol === 'AODV' || this.config.routingProtocol === 'OLSR') {
        const route = node.getRoutingEntry(packet.destination);
        return route?.nextHop ? [route.nextHop] : [];
      } else {
        // DSR uses source routing, next hop is in the path
        const routeIndex = packet.path.indexOf(currentNodeId);
        if (routeIndex >= 0 && routeIndex < packet.path.length - 1) {
          return [packet.path[routeIndex + 1]];
        }
      }
    }

    // For broadcast packets (RREQ, hello), send to ALL neighbors
    if (packet.type === 'rreq' || packet.type === 'hello' || packet.type === 'route_discovery') {
      const node = this.nodes.get(currentNodeId);
      if (node && node.neighbors.length > 0) {
        return node.neighbors;
      }
    }

    return [];
  }

  private updateMetrics(): void {
    this.metrics.packetLossRate = 
      this.metrics.totalPackets > 0 
        ? (this.metrics.failedPackets / this.metrics.totalPackets) * 100 
        : 0;

    let totalEnergy = 0;
    let deadCount = 0;
    let activeRoutes = 0;

    this.nodes.forEach(node => {
      totalEnergy += node.energy;
      if (node.isDead()) {
        deadCount++;
      }
      activeRoutes += node.routingTable.filter(e => e.isValid).length;
    });

    this.metrics.averageEnergy = this.nodes.size > 0 ? totalEnergy / this.nodes.size : 100;
    this.metrics.deadNodes = deadCount;
    this.metrics.activeRoutes = activeRoutes;
    this.metrics.networkLifetime = this.simulationTime;
    
    // Calculate throughput (packets per second)
    const simulationSeconds = this.simulationTime / 1000;
    this.metrics.throughput = simulationSeconds > 0 
      ? (this.metrics.successfulPackets / simulationSeconds) 
      : 0;

    // Calculate routing overhead (control packets / total packets)
    // Control packets: rreq, rrep, rerr, hello, route_discovery, route_maintenance
    // Data packets: data
    const controlPackets = this.metrics.totalPackets - this.metrics.successfulPackets - this.metrics.failedPackets;
    this.metrics.routingOverhead = 
      this.metrics.totalPackets > 0 
        ? (controlPackets / this.metrics.totalPackets) * 100 
        : 0;
  }

  getTopology(): NetworkTopology {
    const nodesMap = new Map<string, Node>();
    const linksMap = new Map<string, Link>();

    this.nodes.forEach(node => {
      nodesMap.set(node.id, node.toJSON());

      node.neighbors.forEach(neighborId => {
        const neighbor = this.nodes.get(neighborId);
        if (neighbor) {
          const distance = this.propagationModel.calculateDistance(
            node.position,
            neighbor.position
          );
          const rssi = this.propagationModel.calculateRSSI(
            node.transmissionPower,
            distance,
            this.config.signalPropagationModel
          );

          const linkId = `${node.id}-${neighborId}`;
          if (!linksMap.has(linkId)) {
            linksMap.set(linkId, {
              source: node.id,
              target: neighborId,
              rssi,
              distance,
              bandwidth: 2, // Mbps
              delay: this.propagationModel.calculateTransmissionDelay(distance),
              reliability: this.propagationModel.calculateLinkQuality(rssi),
            });
          }
        }
      });
    });

    // Force new object creation for React state updates
    return {
      nodes: nodesMap,
      links: linksMap,
      metrics: {
        totalPackets: this.metrics.totalPackets,
        successfulPackets: this.metrics.successfulPackets,
        failedPackets: this.metrics.failedPackets,
        averageLatency: this.metrics.averageLatency,
        throughput: this.metrics.throughput,
        packetLossRate: this.metrics.packetLossRate,
        routingOverhead: this.metrics.routingOverhead,
        networkLifetime: this.metrics.networkLifetime,
        averageEnergy: this.metrics.averageEnergy,
        deadNodes: this.metrics.deadNodes,
        activeRoutes: this.metrics.activeRoutes,
      },
      lastUpdated: this.simulationTime,
    };
  }

  getMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }

  getEventLog(): NetworkEvent[] {
    return [...this.eventLog];
  }

  // RL Agent Integration Methods
  
  async initializeRLAgent(): Promise<void> {
    // Create RL agent if it doesn't exist
    if (!this.rlAgent) {
      this.rlAgent = new RLAgentWrapper();
    }

    const topology = this.getTopology();
    await this.rlAgent.initialize(topology);
  }

  async selectRLAction(): Promise<any> {
    if (!this.rlAgent || !this.rlAgent.isReady()) {
      return null;
    }

    const topology = this.getTopology();
    const deterministic = this.config.rlMode === 'inference';
    
    return await this.rlAgent.selectAction(topology, deterministic);
  }

  async storeRLTransition(
    state: any,
    action: any,
    reward: number,
    nextState: any,
    done: boolean
  ): Promise<void> {
    if (!this.rlAgent) {
      return;
    }

    await this.rlAgent.storeTransition(state, action, reward, nextState, done);
  }

  async trainRLAgent(epochs: number = 10): Promise<any> {
    // Auto-initialize agent if not exists
    if (!this.rlAgent) {
      this.rlAgent = new RLAgentWrapper();
      const topology = this.getTopology();
      await this.rlAgent.initialize(topology);
    }

    // Send all stored transitions to backend
    for (const transition of this.rlTransitions) {
      await this.rlAgent.storeTransition(
        transition.state,
        transition.action,
        transition.reward,
        transition.nextState,
        transition.done
      );
    }

    // Clear local transitions after sending
    this.rlTransitions = [];

    // Train the agent
    const result = await this.rlAgent.train(epochs);
    
    return result;
  }

  getRLAgentStats() {
    if (!this.rlAgent) {
      return null;
    }

    const stats = this.rlAgent.getTrainingStats();
    return {
      ...stats,
      transitionCount: this.rlTransitions.length + stats.transitionCount,
      currentEpisodeReward: this.currentEpisodeReward,
      episodeStepCount: this.episodeStepCount,
    };
  }

  private logEvent(
    type: NetworkEvent['type'],
    source: string,
    destination: string | undefined,
    details: any
  ): void {
    const event: NetworkEvent = {
      id: `EVENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: this.simulationTime,
      type,
      source,
      destination,
      details,
    };
    this.eventLog.push(event);

    // Keep only last 1000 events
    if (this.eventLog.length > 1000) {
      this.eventLog.shift();
    }
  }

  start(): void {
    // No-op - running state is managed externally
  }

  stop(): void {
    // No-op - running state is managed externally
  }

  reset(): void {
    this.nodes.clear();
    this.packetQueue = [];
    this.eventLog = [];
    this.metrics = this.initializeMetrics();
    this.simulationTime = 0;
    this.packetLatencies.clear();
    this.dsrProtocol.clearRouteCache();
    this.olsrProtocol.clear();
    this.currentEpisodeReward = 0;
    this.episodeStepCount = 0;
    this.rlTransitions = [];
    this.lastRLState = null;
    
    // Reset RL agent episode
    if (this.rlAgent) {
      this.rlAgent.resetEpisode();
    }
  }

  updateConfig(newConfig: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Accept external reward from physical world or evaluation system
   */
  receiveExternalReward(reward: number): void {
    if (this.config.rlMode === 'training' && this.rlAgent) {
      this.currentEpisodeReward += reward;
      this.episodeStepCount++;
    }
  }

  /**
   * Get current episode reward
   */
  getEpisodeReward(): number {
    return this.currentEpisodeReward;
  }

  /**
   * Get episode step count
   */
  getEpisodeStepCount(): number {
    return this.episodeStepCount;
  }
}
