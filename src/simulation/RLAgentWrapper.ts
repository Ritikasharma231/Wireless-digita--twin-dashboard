/**
 * RL Agent Wrapper
 * Bridges NetworkSimulation with Python RL backend
 */

import type { NetworkTopology } from '../types/network';
import {
  createAgent,
  selectAction,
  storeTransition,
  trainAgent,
  type RLState,
  type RLAction,
  type AgentConfig,
} from '../utils/api';

export class RLAgentWrapper {
  private agentId: string;
  private agentCreated: boolean = false;
  private isTraining: boolean = false;
  private transitionCount: number = 0;
  private episodeRewards: number[] = [];
  private currentEpisodeReward: number = 0;
  private expectedStateDim: number = 0;

  constructor(agentId: string = 'default') {
    this.agentId = agentId;
  }

  /**
   * Initialize the RL agent
   */
  async initialize(topology: NetworkTopology): Promise<void> {
    const numNodes = topology.nodes.size;
    const stateDim = this.calculateStateDim(numNodes);
    const actionDim = numNodes * 5; // numNodes * power_levels

    // Re-initialize if dimensions don't match
    if (this.agentCreated && this.expectedStateDim !== stateDim) {
      console.log(`Re-initializing agent: expected ${this.expectedStateDim}, got ${stateDim}`);
      this.agentCreated = false;
    }

    const config: AgentConfig = {
      num_nodes: numNodes,
      state_dim: stateDim,
      action_dim: actionDim,
      hidden_dim: 256,
      lr: 3e-4,
      gamma: 0.99,
    };

    try {
      await createAgent(config, this.agentId);
      this.agentCreated = true;
      this.expectedStateDim = stateDim;
      console.log(`RL Agent ${this.agentId} initialized successfully with ${numNodes} nodes, state_dim=${stateDim}, action_dim=${actionDim}`);
    } catch (error) {
      console.error('Failed to initialize RL agent:', error);
      throw error;
    }
  }

  /**
   * Extract RL state from network topology
   */
  extractState(topology: NetworkTopology): RLState {
    const nodes = Array.from(topology.nodes.values());

    // Energy matrix (normalized)
    const energyMatrix = nodes.map(node => node.energy / node.maxEnergy);

    // LQI matrix
    const lqiMatrix = nodes.map(() => {
      return nodes.map(neighbor => {
        // Use LDV.lqi if available, otherwise default
        const neighborNode = topology.nodes.get(neighbor.id);
        return neighborNode?.ldv?.lqi || 255;
      });
    });

    // Buffer matrix (normalized)
    const bufferMatrix = nodes.map(node => 
      node.bufferState ? node.bufferState.occupancy / node.bufferState.capacity : 0
    );

    // Topology adjacency matrix
    const adjacencyMatrix = nodes.map(node => {
      return nodes.map(neighbor => {
        return node.neighbors.includes(neighbor.id) ? 1 : 0;
      });
    });

    // Congestion vector (encoded as numbers: low=0, medium=1, high=2)
    const congestionVector = nodes.map(node => {
      if (node.congestionLevel === 'medium') return 1;
      if (node.congestionLevel === 'high') return 2;
      return 0;
    });

    return {
      energy_matrix: energyMatrix,
      lqi_matrix: lqiMatrix,
      buffer_matrix: bufferMatrix,
      topology_adjacency: adjacencyMatrix,
      congestion_vector: congestionVector,
    };
  }

  /**
   * Select action for routing using RL agent
   */
  async selectAction(
    topology: NetworkTopology,
    deterministic: boolean = false
  ): Promise<RLAction | null> {
    if (!this.agentCreated) {
      console.warn('RL agent not initialized, falling back to traditional routing');
      return null;
    }

    try {
      const state = this.extractState(topology);
      const result = await selectAction(this.agentId, state, deterministic);
      
      console.log(`RL Action selected: ${result.action.action_type} for node ${result.action.node_id}`);
      return result.action;
    } catch (error) {
      console.error('Failed to select RL action:', error);
      return null;
    }
  }

  /**
   * Store transition for training
   */
  async storeTransition(
    state: NetworkTopology,
    action: RLAction,
    reward: number,
    nextState: NetworkTopology,
    done: boolean
  ): Promise<void> {
    if (!this.agentCreated) {
      return;
    }

    try {
      const rlState = this.extractState(state);
      const rlNextState = this.extractState(nextState);

      const transition = {
        agent_id: this.agentId,
        state: rlState,
        action: action,
        reward: reward,
        next_state: rlNextState,
        done,
      };

      await storeTransition(transition);
      this.transitionCount++;
      this.currentEpisodeReward += reward;

      console.log(`Transition stored (total: ${this.transitionCount})`);
    } catch (error) {
      console.error('Failed to store transition:', error);
    }
  }

  /**
   * Train the agent on stored transitions
   */
  async train(epochs: number = 10, batchSize: number = 64): Promise<any> {
    if (!this.agentCreated) {
      throw new Error('RL agent not initialized');
    }

    try {
      this.isTraining = true;
      const result = await trainAgent(this.agentId, epochs, batchSize);
      this.isTraining = false;

      // Episode completed
      this.episodeRewards.push(this.currentEpisodeReward);
      this.currentEpisodeReward = 0;

      console.log('Agent training completed:', result);
      return result;
    } catch (error) {
      this.isTraining = false;
      console.error('Failed to train agent:', error);
      throw error;
    }
  }

  /**
   * Calculate state dimension
   */
  private calculateStateDim(numNodes: number): number {
    // energy: numNodes
    // lqi: numNodes * numNodes
    // buffer: numNodes
    // adjacency: numNodes * numNodes
    // congestion: numNodes
    return numNodes * 3 + numNodes * numNodes + numNodes;
  }

  /**
   * Get training statistics
   */
  getTrainingStats() {
    return {
      agentCreated: this.agentCreated,
      isTraining: this.isTraining,
      transitionCount: this.transitionCount,
      episodeRewards: this.episodeRewards,
      averageReward: this.episodeRewards.length > 0
        ? this.episodeRewards.reduce((a, b) => a + b, 0) / this.episodeRewards.length
        : 0,
      currentEpisodeReward: this.currentEpisodeReward,
      episodeStepCount: 0, // This would be tracked in NetworkSimulation
    };
  }

  /**
   * Set current episode reward (called from NetworkSimulation)
   */
  setCurrentEpisodeReward(reward: number): void {
    this.currentEpisodeReward = reward;
  }

  /**
   * Reset episode
   */
  resetEpisode(): void {
    this.currentEpisodeReward = 0;
  }

  /**
   * Check if agent is ready
   */
  isReady(): boolean {
    return this.agentCreated && !this.isTraining;
  }
}
