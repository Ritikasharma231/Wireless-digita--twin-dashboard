"""
Spatial-Temporal Graph Convolutional Network (ST-GCN)
for Wireless Network Topology Feature Extraction

This module implements ST-GCN to extract spatial-temporal features
from dynamic network topologies for use in DRL agents.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv, GATConv
from typing import Tuple, Optional
import numpy as np


class TemporalConv(nn.Module):
    """Temporal convolution using 1D convolutions"""
    
    def __init__(self, in_channels: int, out_channels: int, kernel_size: int = 3):
        super().__init__()
        padding = (kernel_size - 1) // 2
        self.conv = nn.Conv1d(in_channels, out_channels, kernel_size, padding=padding)
        self.bn = nn.BatchNorm1d(out_channels)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Tensor of shape (batch, channels, time)
        Returns:
            Tensor of shape (batch, out_channels, time)
        """
        out = self.conv(x)
        out = self.bn(out)
        return F.relu(out)


class SpatialConv(nn.Module):
    """Spatial convolution using Graph Convolution"""
    
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.gcn = GCNConv(in_channels, out_channels)
        self.bn = nn.BatchNorm1d(out_channels)
        
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Node features of shape (num_nodes, in_channels)
            edge_index: Graph connectivity of shape (2, num_edges)
        Returns:
            Node features of shape (num_nodes, out_channels)
        """
        out = self.gcn(x, edge_index)
        out = self.bn(out)
        return F.relu(out)


class STGCNBlock(nn.Module):
    """ST-GCN block combining spatial and temporal convolutions"""
    
    def __init__(self, in_channels: int, out_channels: int, temporal_kernel: int = 3):
        super().__init__()
        self.temporal_conv = TemporalConv(in_channels, out_channels, temporal_kernel)
        self.spatial_conv = SpatialConv(out_channels, out_channels)
        self.residual = nn.Conv1d(in_channels, out_channels, kernel_size=1) if in_channels != out_channels else nn.Identity()
        
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Spatio-temporal input of shape (batch, channels, time, nodes)
            edge_index: Graph connectivity
        Returns:
            Processed features of shape (batch, out_channels, time, nodes)
        """
        batch, channels, time, nodes = x.shape
        
        # Reshape for temporal convolution
        x_temporal = x.permute(0, 3, 1, 2).reshape(batch * nodes, channels, time)
        x_temporal = self.temporal_conv(x_temporal)
        x_temporal = x_temporal.reshape(batch, nodes, -1, time).permute(0, 2, 3, 1)
        
        # Residual connection
        residual = self.residual(x.permute(0, 3, 1, 2).reshape(batch * nodes, channels, time))
        residual = residual.reshape(batch, nodes, -1, time).permute(0, 2, 3, 1)
        
        # Apply spatial convolution for each time step
        batch_size, out_channels, num_timesteps, num_nodes = x_temporal.shape
        spatial_out = []
        
        for t in range(num_timesteps):
            x_t = x_temporal[:, :, t, :]  # (batch, out_channels, nodes)
            residual_t = residual[:, :, t, :]
            
            # Reshape for GCN: (batch * nodes, out_channels)
            x_t_flat = x_t.permute(0, 2, 1).reshape(batch_size * num_nodes, -1)
            residual_t_flat = residual_t.permute(0, 2, 1).reshape(batch_size * num_nodes, -1)
            
            # Apply GCN
            spatial_t = self.spatial_conv(x_t_flat, edge_index)
            spatial_t = spatial_t.reshape(batch_size, num_nodes, -1).permute(0, 2, 1)
            
            # Add residual
            spatial_t = spatial_t + residual_t_flat.reshape(batch_size, num_nodes, -1).permute(0, 2, 1)
            spatial_out.append(spatial_t)
        
        return torch.stack(spatial_out, dim=2)


class STGCN(nn.Module):
    """
    Complete ST-GCN model for wireless network topology embedding
    
    Architecture:
    - Input: (batch, node_features, time_steps, num_nodes)
    - Multiple ST-GCN blocks
    - Temporal LSTM for sequence modeling
    - Output: (batch, embedding_dim)
    """
    
    def __init__(
        self,
        node_features: int = 3,  # energy, LQI, buffer
        hidden_dim: int = 64,
        num_layers: int = 2,
        lstm_layers: int = 2,
        output_dim: int = 128,
        temporal_kernel: int = 3
    ):
        super().__init__()
        
        self.input_proj = nn.Linear(node_features, hidden_dim)
        
        # ST-GCN blocks
        self.stgcn_blocks = nn.ModuleList([
            STGCNBlock(hidden_dim, hidden_dim, temporal_kernel)
            for _ in range(num_layers)
        ])
        
        # Temporal LSTM
        self.lstm = nn.LSTM(
            hidden_dim,
            hidden_dim,
            num_layers=lstm_layers,
            batch_first=True
        )
        
        # Output projection
        self.output_proj = nn.Linear(hidden_dim, output_dim)
        
    def forward(
        self,
        node_features: torch.Tensor,
        adjacency_matrix: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            node_features: Tensor of shape (batch, time, nodes, features)
            adjacency_matrix: Tensor of shape (batch, time, nodes, nodes) or (nodes, nodes)
        Returns:
            Embedded representation of shape (batch, output_dim)
        """
        batch, time, nodes, features = node_features.shape
        
        # Project input features
        x = self.input_proj(node_features)  # (batch, time, nodes, hidden_dim)
        
        # Convert adjacency to edge index format for PyG
        if adjacency_matrix.dim() == 4:
            # (batch, time, nodes, nodes) -> use first batch/time
            adj = adjacency_matrix[0, 0]
        else:
            adj = adjacency_matrix
        
        edge_index = self.adj_to_edge_index(adj)
        
        # Reshape for ST-GCN: (batch, channels, time, nodes)
        x = x.permute(0, 3, 1, 2)
        
        # Apply ST-GCN blocks
        for block in self.stgcn_blocks:
            x = block(x, edge_index)
        
        # Reshape for LSTM: (batch, time, nodes, hidden_dim) -> (batch * nodes, time, hidden_dim)
        x = x.permute(0, 2, 3, 1)
        x = x.reshape(batch * nodes, time, -1)
        
        # Apply LSTM
        lstm_out, _ = self.lstm(x)  # (batch * nodes, time, hidden_dim)
        
        # Take last time step
        x = lstm_out[:, -1, :]  # (batch * nodes, hidden_dim)
        
        # Reshape and aggregate across nodes
        x = x.reshape(batch, nodes, -1)
        x = x.mean(dim=1)  # Global average pooling
        
        # Final projection
        x = self.output_proj(x)
        
        return x
    
    @staticmethod
    def adj_to_edge_index(adj: torch.Tensor) -> torch.Tensor:
        """Convert adjacency matrix to edge index format"""
        edge_index = adj.nonzero().t()
        return edge_index


class AttentionPooling(nn.Module):
    """Attention-based pooling for node aggregation"""
    
    def __init__(self, input_dim: int):
        super().__init__()
        self.attention = nn.Sequential(
            nn.Linear(input_dim, input_dim // 2),
            nn.Tanh(),
            nn.Linear(input_dim // 2, 1)
        )
        
    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Args:
            x: Tensor of shape (batch, nodes, features)
            mask: Optional mask of shape (batch, nodes)
        Returns:
            Pooled tensor of shape (batch, features)
        """
        attention_weights = self.attention(x).squeeze(-1)  # (batch, nodes)
        
        if mask is not None:
            attention_weights = attention_weights.masked_fill(mask == 0, -1e9)
        
        attention_weights = F.softmax(attention_weights, dim=-1)
        
        # Weighted sum
        pooled = torch.sum(x * attention_weights.unsqueeze(-1), dim=1)
        return pooled


def create_topology_embedding(
    energy_matrix: np.ndarray,
    lqi_matrix: np.ndarray,
    buffer_matrix: np.ndarray,
    adjacency_matrix: np.ndarray
) -> np.ndarray:
    """
    Create topology embedding using ST-GCN
    
    Args:
        energy_matrix: (time, nodes) normalized energy values
        lqi_matrix: (time, nodes, nodes) LQI values
        buffer_matrix: (time, nodes) buffer occupancy
        adjacency_matrix: (time, nodes, nodes) adjacency matrices
    
    Returns:
        Embedding vector of shape (embedding_dim,)
    """
    # Stack features: (time, nodes, 3)
    node_features = np.stack([energy_matrix, buffer_matrix], axis=-1)
    
    # Add LQI as node feature (average over neighbors)
    avg_lqi = np.mean(lqi_matrix, axis=2)  # (time, nodes)
    node_features = np.concatenate([node_features, avg_lqi[..., np.newaxis]], axis=-1)
    
    # Convert to tensors
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    node_features_tensor = torch.FloatTensor(node_features).unsqueeze(0).to(device)  # Add batch dim
    adjacency_tensor = torch.FloatTensor(adjacency_matrix).to(device)
    
    # Create ST-GCN model
    model = STGCN(
        node_features=3,
        hidden_dim=64,
        num_layers=2,
        lstm_layers=2,
        output_dim=128
    ).to(device)
    
    model.eval()
    with torch.no_grad():
        embedding = model(node_features_tensor, adjacency_tensor)
    
    return embedding.cpu().numpy().squeeze()


if __name__ == "__main__":
    # Test the ST-GCN
    num_nodes = 10
    time_steps = 20
    
    # Generate synthetic data
    energy = np.random.rand(time_steps, num_nodes)
    lqi = np.random.rand(time_steps, num_nodes, num_nodes) * 255
    buffer = np.random.rand(time_steps, num_nodes)
    adjacency = (np.random.rand(time_steps, num_nodes, num_nodes) > 0.7).astype(float)
    
    # Create embedding
    embedding = create_topology_embedding(energy, lqi, buffer, adjacency)
    print(f"Embedding shape: {embedding.shape}")
    print(f"Embedding norm: {np.linalg.norm(embedding):.4f}")
