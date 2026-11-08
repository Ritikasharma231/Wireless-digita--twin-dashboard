/**
 * API Client for Wireless Digital Twin RL Backend
 * Handles communication with FastAPI backend for RL agent interaction
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface RLState {
  energy_matrix: number[];
  lqi_matrix: number[][];
  buffer_matrix: number[];
  topology_adjacency: number[][];
  congestion_vector: number[];
}

export interface RLAction {
  node_id: string;
  next_hop: string | null;
  transmission_power: number;
  action_type: string;
}

export interface AgentConfig {
  num_nodes: number;
  state_dim: number;
  action_dim: number;
  hidden_dim?: number;
  lr?: number;
  gamma?: number;
}

export interface Transition {
  agent_id: string;
  state: RLState;
  action: RLAction;
  reward: number;
  next_state: RLState;
  done: boolean;
}

export interface TrainingMetrics {
  actor_loss: number;
  critic_loss: number;
  entropy: number;
}

/**
 * Create a new PPO agent
 */
export async function createAgent(config: AgentConfig, agentId: string = 'default'): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/agents/create?agent_id=${agentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Failed to create agent: ${response.statusText}`);
  }

  return response.json();
}

/**
 * List all agents
 */
export async function listAgents(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/agents`);

  if (!response.ok) {
    throw new Error(`Failed to list agents: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Select action using RL agent
 */
export async function selectAction(
  agentId: string,
  state: RLState,
  deterministic: boolean = false
): Promise<{ action: RLAction; log_probability: number }> {
  const response = await fetch(`${API_BASE_URL}/agents/${agentId}/action?deterministic=${deterministic}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    throw new Error(`Failed to select action: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Train the agent on stored transitions
 */
export async function trainAgent(
  agentId: string,
  epochs: number = 10,
  batchSize: number = 64
): Promise<{ message: string; metrics: TrainingMetrics }> {
  const response = await fetch(`${API_BASE_URL}/agents/${agentId}/train?epochs=${epochs}&batch_size=${batchSize}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to train agent: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Store a transition for training
 */
export async function storeTransition(transition: Transition): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/agents/${transition.agent_id}/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(transition),
  });

  if (!response.ok) {
    throw new Error(`Failed to store transition: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Save agent model
 */
export async function saveAgent(agentId: string, path?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/agents/${agentId}/save${path ? `?path=${path}` : ''}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to save agent: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Load agent model
 */
export async function loadAgent(agentId: string, path?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/agents/${agentId}/load${path ? `?path=${path}` : ''}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to load agent: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Compute topology embedding using ST-GCN
 */
export async function computeEmbedding(
  energyMatrix: number[][],
  lqiMatrix: number[][][],
  bufferMatrix: number[][],
  adjacencyMatrix: number[][][]
): Promise<{ embedding: number[]; shape: number[] }> {
  const response = await fetch(`${API_BASE_URL}/embedding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      energy_matrix: energyMatrix,
      lqi_matrix: lqiMatrix,
      buffer_matrix: bufferMatrix,
      adjacency_matrix: adjacencyMatrix,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to compute embedding: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}
