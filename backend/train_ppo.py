"""
Training Script for PPO Agent on Wireless Routing Environment
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from simulation.wireless_env import create_env
from rl.ppo_agent import PPOAgent, RLState, RLAction
import numpy as np
import torch
from typing import Dict, List
import argparse


class PPOTrainer:
    """Trainer for PPO agent on wireless routing environment"""
    
    def __init__(
        self,
        num_nodes: int = 10,
        max_steps: int = 1000,
        num_episodes: int = 100,
        update_interval: int = 10,
        save_interval: int = 50,
        device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
    ):
        self.num_nodes = num_nodes
        self.max_steps = max_steps
        self.num_episodes = num_episodes
        self.update_interval = update_interval
        self.save_interval = save_interval
        self.device = device
        
        # Create environment
        self.env = create_env(num_nodes=num_nodes, max_steps=max_steps)
        
        # Calculate state and action dimensions
        state_dim = self.env.observation_space.shape[0]
        action_dim = self.env.action_space.n
        
        # Create PPO agent
        self.agent = PPOAgent(
            num_nodes=num_nodes,
            state_dim=state_dim,
            action_dim=action_dim,
            hidden_dim=256,
            lr=3e-4,
            gamma=0.99,
            device=device
        )
        
        # Training metrics
        self.episode_rewards: List[float] = []
        self.episode_lengths: List[int] = []
        self.pdr_history: List[float] = []
        
    def train(self):
        """Main training loop"""
        print(f"Starting training for {self.num_episodes} episodes...")
        print(f"Device: {self.device}")
        print(f"State dim: {self.env.observation_space.shape[0]}")
        print(f"Action dim: {self.env.action_space.n}")
        print("-" * 60)
        
        for episode in range(self.num_episodes):
            episode_reward = self._run_episode()
            
            self.episode_rewards.append(episode_reward)
            self.episode_lengths.append(self.env.current_step)
            
            # Calculate PDR
            total_packets = self.env.packets_delivered + self.env.packets_failed
            pdr = self.env.packets_delivered / max(1, total_packets)
            self.pdr_history.append(pdr)
            
            # Print progress
            if (episode + 1) % 10 == 0:
                avg_reward = np.mean(self.episode_rewards[-10:])
                avg_pdr = np.mean(self.pdr_history[-10:])
                print(f"Episode {episode + 1}/{self.num_episodes} | "
                      f"Avg Reward: {avg_reward:.4f} | "
                      f"Avg PDR: {avg_pdr:.4f} | "
                      f"Last Reward: {episode_reward:.4f}")
            
            # Update agent
            if (episode + 1) % self.update_interval == 0:
                self.agent.update(epochs=10, batch_size=64)
            
            # Save model
            if (episode + 1) % self.save_interval == 0:
                self.save_model(f"models/ppo_agent_ep{episode + 1}.pt")
                print(f"Model saved at episode {episode + 1}")
        
        print("\nTraining completed!")
        self._print_final_stats()
        
        # Save final model
        self.save_model("models/ppo_agent_final.pt")
    
    def _run_episode(self) -> float:
        """Run a single episode"""
        obs, info = self.env.reset()
        episode_reward = 0.0
        done = False
        truncated = False
        
        while not (done or truncated):
            # Convert observation to RLState
            state = self._obs_to_rlstate(obs)
            
            # Select action
            action, log_prob = self.agent.select_action(state, deterministic=False)
            
            # Convert action to action index
            action_idx = self._action_to_index(action)
            
            # Step environment
            next_obs, reward, done, truncated, info = self.env.step(action_idx)
            
            # Store transition
            next_state = self._obs_to_rlstate(next_obs)
            value = self.agent.critic(self.agent.state_to_tensor(state))
            
            self.agent.states.append(self.agent.state_to_tensor(state))
            self.agent.actions.append(torch.tensor([action_idx]).to(self.device))
            self.agent.log_probs.append(log_prob)
            self.agent.rewards.append(reward)
            self.agent.values.append(value)
            self.agent.dones.append(done or truncated)
            
            episode_reward += reward
            obs = next_obs
        
        return episode_reward
    
    def _obs_to_rlstate(self, obs: np.ndarray) -> RLState:
        """Convert environment observation to RLState"""
        num_nodes = self.num_nodes
        
        # Extract features from flattened observation
        idx = 0
        
        # Energy: num_nodes
        energy = obs[idx:idx + num_nodes]
        idx += num_nodes
        
        # LQI: num_nodes * num_nodes
        lqi = obs[idx:idx + num_nodes * num_nodes].reshape(num_nodes, num_nodes)
        idx += num_nodes * num_nodes
        
        # Buffer: num_nodes
        buffer = obs[idx:idx + num_nodes]
        idx += num_nodes
        
        # Adjacency: num_nodes * num_nodes
        adjacency = obs[idx:idx + num_nodes * num_nodes].reshape(num_nodes, num_nodes)
        idx += num_nodes * num_nodes
        
        # Congestion: num_nodes
        congestion = obs[idx:idx + num_nodes]
        
        return RLState(
            energy_matrix=energy,
            lqi_matrix=lqi,
            buffer_matrix=buffer,
            topology_adjacency=adjacency,
            congestion_vector=congestion,
        )
    
    def _action_to_index(self, action: RLAction) -> int:
        """Convert RLAction to action index"""
        power_levels = 5
        power_level = int(action.transmission_power / 5)
        
        if action.action_type == 'drop':
            return self.agent.action_dim - 1
        
        # Extract node index from node_id
        node_idx = int(action.node_id.split('-')[1]) - 1 if action.node_id else 0
        
        return node_idx * power_levels + power_level
    
    def save_model(self, path: str):
        """Save the trained model"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.agent.save(path)
    
    def load_model(self, path: str):
        """Load a trained model"""
        self.agent.load(path)
    
    def _print_final_stats(self):
        """Print final training statistics"""
        avg_reward = np.mean(self.episode_rewards)
        std_reward = np.std(self.episode_rewards)
        avg_pdr = np.mean(self.pdr_history)
        avg_length = np.mean(self.episode_lengths)
        
        print("\n" + "=" * 60)
        print("FINAL TRAINING STATISTICS")
        print("=" * 60)
        print(f"Average Reward: {avg_reward:.4f} ± {std_reward:.4f}")
        print(f"Average PDR: {avg_pdr:.4f}")
        print(f"Average Episode Length: {avg_length:.2f}")
        print(f"Total Episodes: {len(self.episode_rewards)}")
        print(f"Best Episode Reward: {max(self.episode_rewards):.4f}")
        print(f"Worst Episode Reward: {min(self.episode_rewards):.4f}")
        print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Train PPO agent on wireless routing")
    parser.add_argument("--num_nodes", type=int, default=10, help="Number of nodes")
    parser.add_argument("--max_steps", type=int, default=1000, help="Max steps per episode")
    parser.add_argument("--num_episodes", type=int, default=100, help="Number of training episodes")
    parser.add_argument("--update_interval", type=int, default=10, help="PPO update interval")
    parser.add_argument("--save_interval", type=int, default=50, help="Model save interval")
    parser.add_argument("--device", type=str, default="auto", help="Device (auto/cpu/cuda)")
    
    args = parser.parse_args()
    
    # Determine device
    if args.device == "auto":
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    else:
        device = args.device
    
    # Create trainer
    trainer = PPOTrainer(
        num_nodes=args.num_nodes,
        max_steps=args.max_steps,
        num_episodes=args.num_episodes,
        update_interval=args.update_interval,
        save_interval=args.save_interval,
        device=device
    )
    
    # Train
    trainer.train()


if __name__ == "__main__":
    main()
