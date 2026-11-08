"""
MDP Environment for Wireless Network Routing
Gymnasium-compatible environment for training RL agents on WSN routing
"""

import numpy as np
import gymnasium as gym
from gymnasium import spaces
from typing import Tuple, Dict, Any, Optional
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class WirelessRoutingEnv(gym.Env):
    """
    Markov Decision Process Environment for Wireless Network Routing
    
    State Space:
        - Energy matrix (num_nodes,): Normalized residual energy
        - LQI matrix (num_nodes, num_nodes): Link Quality Indicators
        - Buffer matrix (num_nodes,): Buffer occupancy
        - Topology adjacency (num_nodes, num_nodes): Connectivity
        - Congestion vector (num_nodes,): Congestion levels
    
    Action Space:
        - Discrete action: (next_hop_idx * power_levels) + power_level
        - next_hop_idx: 0 to num_nodes-1
        - power_level: 0 to 4 (0, 5, 10, 15, 20 dBm)
    
    Reward Function:
        R(s_t, a_t) = α·T_thr - β·(E_tx + E_rx) - γ·D_e2e
    """
    
    metadata = {"render_modes": ["human"]}
    
    def __init__(
        self,
        num_nodes: int = 10,
        max_hops: int = 10,
        alpha: float = 1.0,
        beta: float = 0.5,
        gamma_reward: float = 0.3,
        power_levels: int = 5,
        max_steps: int = 1000,
    ):
        super().__init__()
        
        self.num_nodes = num_nodes
        self.max_hops = max_hops
        self.alpha = alpha  # Throughput weight
        self.beta = beta    # Energy weight
        self.gamma_reward = gamma_reward  # Delay weight
        self.power_levels = power_levels
        self.max_steps = max_steps
        
        # Action space: discrete actions (next_hop * power_levels + power_level)
        self.action_space = spaces.Discrete(num_nodes * power_levels)
        
        # State space: flattened concatenated features
        # energy: num_nodes
        # lqi: num_nodes * num_nodes
        # buffer: num_nodes
        # adjacency: num_nodes * num_nodes
        # congestion: num_nodes
        state_dim = num_nodes * 3 + num_nodes * num_nodes + num_nodes
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(state_dim,),
            dtype=np.float32
        )
        
        # State tracking
        self.current_step = 0
        self.current_topology = None
        self.total_reward = 0.0
        self.packets_delivered = 0
        self.packets_failed = 0
        self.total_energy_consumed = 0.0
        self.total_latency = 0.0
        
    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Reset the environment to initial state
        
        Args:
            seed: Random seed for reproducibility
            options: Additional options (topology, initial_state)
        
        Returns:
            observation: Initial state
            info: Additional information
        """
        super().reset(seed=seed)
        
        if seed is not None:
            np.random.seed(seed)
        
        # Reset tracking
        self.current_step = 0
        self.total_reward = 0.0
        self.packets_delivered = 0
        self.packets_failed = 0
        self.total_energy_consumed = 0.0
        self.total_latency = 0.0
        
        # Initialize topology (will be set from external simulation)
        if options and 'topology' in options:
            self.current_topology = options['topology']
        else:
            self.current_topology = self._generate_random_topology()
        
        observation = self._get_observation()
        info = {"topology": self.current_topology}
        
        return observation, info
    
    def step(
        self,
        action: int
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """
        Execute one step in the environment
        
        Args:
            action: Discrete action index
        
        Returns:
            observation: Next state
            reward: Reward for this step
            terminated: Episode terminated (natural end)
            truncated: Episode truncated (max steps reached)
            info: Additional information
        """
        self.current_step += 1
        
        # Decode action
        next_hop_idx, power_level = self._decode_action(action)
        
        # Apply action and get metrics
        throughput, energy_cost, delay, success = self._apply_action(
            next_hop_idx, power_level
        )
        
        # Compute reward
        reward = self._compute_reward(throughput, energy_cost, delay)
        
        # Update tracking
        self.total_reward += reward
        self.total_energy_consumed += energy_cost
        self.total_latency += delay
        
        if success:
            self.packets_delivered += 1
        else:
            self.packets_failed += 1
        
        # Update topology (simulated node movement, energy depletion)
        self._update_topology()
        
        # Get new observation
        observation = self._get_observation()
        
        # Check termination conditions
        terminated = self._check_termination()
        truncated = self.current_step >= self.max_steps
        
        # Info dictionary
        info = {
            "throughput": throughput,
            "energy_cost": energy_cost,
            "delay": delay,
            "success": success,
            "packets_delivered": self.packets_delivered,
            "packets_failed": self.packets_failed,
            "total_reward": self.total_reward,
            "step": self.current_step,
        }
        
        return observation, reward, terminated, truncated, info
    
    def _decode_action(self, action: int) -> Tuple[int, int]:
        """
        Decode action index to (next_hop_idx, power_level)
        
        Args:
            action: Action index
        
        Returns:
            next_hop_idx: Index of next hop node
            power_level: Power level (0-4)
        """
        power_level = action % self.power_levels
        next_hop_idx = action // self.power_levels
        
        # Clamp to valid ranges
        next_hop_idx = min(next_hop_idx, self.num_nodes - 1)
        
        return next_hop_idx, power_level
    
    def _apply_action(
        self,
        next_hop_idx: int,
        power_level: int
    ) -> Tuple[float, float, float, bool]:
        """
        Apply routing action and return metrics
        
        Args:
            next_hop_idx: Index of next hop node
            power_level: Transmission power level
        
        Returns:
            throughput: Packets delivered per second
            energy_cost: Energy consumed (J)
            delay: End-to-end delay (ms)
            success: Whether packet was delivered
        """
        # Simulate routing decision
        # In production, this would interact with actual NetworkSimulation
        
        # Simulate success based on link quality
        if self.current_topology and 'lqi_matrix' in self.current_topology:
            source_idx = 0  # Assume source is node 0
            dest_idx = self.num_nodes - 1  # Assume destination is last node
            
            if source_idx < len(self.current_topology['lqi_matrix']):
                lqi = self.current_topology['lqi_matrix'][source_idx][next_hop_idx]
                # Higher LQI = higher success probability
                success_prob = lqi / 255.0
            else:
                success_prob = 0.5
        else:
            success_prob = 0.5
        
        success = np.random.random() < success_prob
        
        # Compute metrics
        if success:
            throughput = 1.0  # 1 packet delivered
            delay = np.random.uniform(10, 100)  # 10-100ms
        else:
            throughput = 0.0
            delay = 0.0
        
        # Energy cost based on power level
        power_dbm = power_level * 5  # 0, 5, 10, 15, 20 dBm
        power_mw = 10 ** (power_dbm / 10)
        energy_cost = power_mw * 0.001  # mW to J (simplified)
        
        return throughput, energy_cost, delay, success
    
    def _compute_reward(
        self,
        throughput: float,
        energy_cost: float,
        delay: float
    ) -> float:
        """
        Compute reward using the formula:
        R(s_t, a_t) = α·T_thr - β·(E_tx + E_rx) - γ·D_e2e
        
        Args:
            throughput: Throughput metric
            energy_cost: Energy consumption
            delay: End-to-end delay
        
        Returns:
            reward: Computed reward
        """
        throughput_reward = self.alpha * throughput
        energy_penalty = self.beta * energy_cost
        delay_penalty = self.gamma_reward * (delay / 1000.0)  # Normalize delay
        
        reward = throughput_reward - energy_penalty - delay_penalty
        
        return reward
    
    def _get_observation(self) -> np.ndarray:
        """
        Get current state observation
        
        Returns:
            observation: Flattened state vector
        """
        if self.current_topology is None:
            # Return zero observation if no topology
            state_dim = self.num_nodes * 3 + self.num_nodes * self.num_nodes + self.num_nodes
            return np.zeros(state_dim, dtype=np.float32)
        
        # Extract features from topology
        energy = self.current_topology.get('energy_matrix', np.ones(self.num_nodes))
        lqi = self.current_topology.get('lqi_matrix', np.ones((self.num_nodes, self.num_nodes)) * 255)
        buffer = self.current_topology.get('buffer_matrix', np.zeros(self.num_nodes))
        adjacency = self.current_topology.get('topology_adjacency', np.zeros((self.num_nodes, self.num_nodes)))
        congestion = self.current_topology.get('congestion_vector', np.zeros(self.num_nodes))
        
        # Flatten and concatenate
        observation = np.concatenate([
            energy.flatten(),
            lqi.flatten(),
            buffer.flatten(),
            adjacency.flatten(),
            congestion.flatten(),
        ]).astype(np.float32)
        
        return observation
    
    def _update_topology(self):
        """
        Update topology state (simulated)
        In production, this would update from NetworkSimulation
        """
        if self.current_topology is None:
            return
        
        # Simulate energy depletion
        if 'energy_matrix' in self.current_topology:
            energy_depletion = np.random.uniform(0.001, 0.01, self.num_nodes)
            self.current_topology['energy_matrix'] = np.maximum(
                0.0,
                self.current_topology['energy_matrix'] - energy_depletion
            )
        
        # Simulate mobility (random topology changes)
        if 'topology_adjacency' in self.current_topology:
            if np.random.random() < 0.1:  # 10% chance of topology change
                # Randomly flip some connections
                mask = np.random.random((self.num_nodes, self.num_nodes)) < 0.05
                self.current_topology['topology_adjacency'] = np.where(
                    mask,
                    1 - self.current_topology['topology_adjacency'],
                    self.current_topology['topology_adjacency']
                )
    
    def _check_termination(self) -> bool:
        """
        Check if episode should terminate naturally
        
        Returns:
            terminated: True if episode should terminate
        """
        if self.current_topology is None:
            return False
        
        # Terminate if all nodes are dead (energy = 0)
        if 'energy_matrix' in self.current_topology:
            if np.all(self.current_topology['energy_matrix'] <= 0.01):
                return True
        
        # Terminate if network is disconnected
        if 'topology_adjacency' in self.current_topology:
            if not self._is_connected():
                return True
        
        return False
    
    def _is_connected(self) -> bool:
        """
        Check if network is connected using BFS
        
        Returns:
            connected: True if network is connected
        """
        adjacency = self.current_topology['topology_adjacency']
        n = adjacency.shape[0]
        
        # Start BFS from node 0
        visited = [False] * n
        queue = [0]
        visited[0] = True
        
        while queue:
            node = queue.pop(0)
            for neighbor in range(n):
                if adjacency[node, neighbor] > 0 and not visited[neighbor]:
                    visited[neighbor] = True
                    queue.append(neighbor)
        
        return all(visited)
    
    def _generate_random_topology(self) -> Dict[str, np.ndarray]:
        """
        Generate a random topology for testing
        
        Returns:
            topology: Dictionary with topology features
        """
        # Random energy
        energy = np.random.uniform(0.5, 1.0, self.num_nodes)
        
        # Random LQI
        lqi = np.random.uniform(100, 255, (self.num_nodes, self.num_nodes))
        np.fill_diagonal(lqi, 255)  # Self has max LQI
        
        # Random buffer
        buffer = np.random.uniform(0.0, 0.5, self.num_nodes)
        
        # Random adjacency (ensure some connectivity)
        adjacency = np.random.random((self.num_nodes, self.num_nodes)) < 0.3
        np.fill_diagonal(adjacency, True)  # Self-connected
        # Ensure at least one connected component
        adjacency[0, 1] = True
        adjacency[1, 0] = True
        
        # Random congestion
        congestion = np.random.randint(0, 3, self.num_nodes)
        
        return {
            'energy_matrix': energy,
            'lqi_matrix': lqi,
            'buffer_matrix': buffer,
            'topology_adjacency': adjacency.astype(float),
            'congestion_vector': congestion,
        }
    
    def render(self, mode: str = "human"):
        """
        Render the environment
        
        Args:
            mode: Render mode (only 'human' supported)
        """
        if mode == "human":
            print(f"Step: {self.current_step}")
            print(f"Total Reward: {self.total_reward:.4f}")
            print(f"Packets Delivered: {self.packets_delivered}")
            print(f"Packets Failed: {self.packets_failed}")
            print(f"Total Energy: {self.total_energy_consumed:.4f} J")
            print(f"Average Latency: {self.total_latency / max(1, self.packets_delivered):.2f} ms")
            print("-" * 50)
    
    def close(self):
        """Clean up environment resources"""
        pass


def create_env(
    num_nodes: int = 10,
    max_hops: int = 10,
    alpha: float = 1.0,
    beta: float = 0.5,
    gamma_reward: float = 0.3,
    power_levels: int = 5,
    max_steps: int = 1000,
) -> gym.Env:
    """
    Factory function to create the environment
    
    Args:
        num_nodes: Number of nodes in the network
        max_hops: Maximum allowed hops
        alpha: Throughput reward weight
        beta: Energy penalty weight
        gamma_reward: Delay penalty weight
        power_levels: Number of transmission power levels
        max_steps: Maximum steps per episode
    
    Returns:
        env: Gymnasium environment
    """
    env = WirelessRoutingEnv(
        num_nodes=num_nodes,
        max_hops=max_hops,
        alpha=alpha,
        beta=beta,
        gamma_reward=gamma_reward,
        power_levels=power_levels,
        max_steps=max_steps,
    )
    
    return env


if __name__ == "__main__":
    # Test the environment
    print("Creating Wireless Routing Environment...")
    env = create_env(num_nodes=10, max_steps=100)
    
    print(f"Action space: {env.action_space}")
    print(f"Observation space: {env.observation_space}")
    
    print("\nResetting environment...")
    obs, info = env.reset(seed=42)
    print(f"Initial observation shape: {obs.shape}")
    
    print("\nRunning 10 steps...")
    for step in range(10):
        action = env.action_space.sample()
        obs, reward, terminated, truncated, info = env.step(action)
        env.render()
        
        if terminated or truncated:
            print("Episode ended!")
            break
    
    print("\nClosing environment...")
    env.close()
