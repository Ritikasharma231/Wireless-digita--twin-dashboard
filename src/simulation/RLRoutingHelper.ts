/**
 * RL Routing Helper
 * Implements DRL-based routing decisions for wireless networks
 */

import type { Packet, Node } from '../types/network';

export interface RLAction {
  action_type: 'forward' | 'broadcast' | 'drop' | 'sleep';
  next_hop: string | null;
  transmissionPower: number;
}

export class RLRoutingHelper {
  /**
   * Get routing action using heuristic (fallback when RL agent unavailable)
   * This implements energy-aware routing as a baseline
   */
  static getHeuristicAction(
    currentNode: Node,
    destinationId: string,
    allNodes: Map<string, Node>
  ): RLAction {
    // If no neighbors, drop packet
    if (currentNode.neighbors.length === 0) {
      return {
        action_type: 'drop',
        next_hop: null,
        transmissionPower: 0,
      };
    }

    // If destination is a direct neighbor, forward directly
    if (currentNode.neighbors.includes(destinationId)) {
      return {
        action_type: 'forward',
        next_hop: destinationId,
        transmissionPower: 10, // Medium power
      };
    }

    // Find neighbor with highest energy (energy-aware routing)
    let bestNeighbor = currentNode.neighbors[0];
    let maxEnergy = 0;

    for (const neighborId of currentNode.neighbors) {
      const neighbor = allNodes.get(neighborId);
      if (neighbor && neighbor.isActive && neighbor.energy > maxEnergy) {
        maxEnergy = neighbor.energy;
        bestNeighbor = neighborId;
      }
    }

    // If all neighbors are dead, drop packet
    if (maxEnergy === 0) {
      return {
        action_type: 'drop',
        next_hop: null,
        transmissionPower: 0,
      };
    }

    // Forward to best neighbor
    return {
      action_type: 'forward',
      next_hop: bestNeighbor,
      transmissionPower: 20, // Max power for reliability
    };
  }

  /**
   * Compute reward for a routing decision
   * R = α·T_thr - β·(E_tx + E_rx) - γ·D_e2e
   */
  static computeReward(
    packetDelivered: boolean,
    energyConsumed: number,
    delay: number,
    alpha: number = 1.0,
    beta: number = 0.5,
    gamma: number = 0.3
  ): number {
    const throughput = packetDelivered ? 1.0 : 0.0;
    const throughputReward = alpha * throughput;
    const energyPenalty = beta * energyConsumed;
    const delayPenalty = gamma * (delay / 1000.0); // Normalize delay to seconds

    return throughputReward - energyPenalty - delayPenalty;
  }

  /**
   * Estimate energy consumption for a transmission
   */
  static estimateEnergyConsumption(
    transmissionPower: number, // dBm
    transmissionTime: number = 0.001 // seconds
  ): number {
    // Convert dBm to mW
    const powerMw = Math.pow(10, transmissionPower / 10);
    
    // Energy = Power × Time
    const energyJoules = powerMw * transmissionTime * 0.001; // mW to J
    
    return energyJoules;
  }

  /**
   * Apply routing action to a packet
   */
  static applyAction(
    packet: Packet,
    currentNodeId: string,
    action: RLAction,
    currentNode: Node
  ): Packet | null {
    // Update transmission power
    currentNode.transmissionPower = action.transmissionPower;

    switch (action.action_type) {
      case 'drop':
        return null; // Drop packet

      case 'sleep':
        return null; // Do not forward

      case 'broadcast':
        // Broadcast creates multiple packets (handled by caller)
        return this.createForwardPacket(packet, currentNodeId, null);

      case 'forward':
      default:
        if (action.next_hop && action.next_hop !== currentNodeId) {
          return this.createForwardPacket(packet, currentNodeId, action.next_hop);
        }
        return null; // Invalid next hop
    }
  }

  /**
   * Create a forward packet
   */
  private static createForwardPacket(
    packet: Packet,
    currentNodeId: string,
    nextHop: string | null
  ): Packet {
    const forwardPacket: Packet = {
      ...packet,
      hopCount: packet.hopCount + 1,
      path: [...packet.path, currentNodeId],
    };

    if (nextHop) {
      forwardPacket.path.push(nextHop);
    }

    return forwardPacket;
  }

  /**
   * Check if action is valid given current topology
   */
  static isActionValid(
    action: RLAction,
    currentNodeId: string,
    currentNode: Node
  ): boolean {
    if (action.action_type === 'drop' || action.action_type === 'sleep') {
      return true; // Always valid
    }

    if (action.action_type === 'forward') {
      if (!action.next_hop) {
        return false; // Must have next hop
      }
      if (action.next_hop === currentNodeId) {
        return false; // Can't forward to self
      }
      if (!currentNode.neighbors.includes(action.next_hop)) {
        return false; // Must be neighbor
      }
      return true;
    }

    if (action.action_type === 'broadcast') {
      return currentNode.neighbors.length > 0;
    }

    return false;
  }
}
