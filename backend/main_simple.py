"""
Simplified FastAPI Backend for Deployment
Supports basic RL agent operations without heavy ML dependencies
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os

app = FastAPI(title="Wireless Digital Twin API")

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://wireless-digital-twin.vercel.app",
    os.getenv("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Wireless Digital Twin API",
        "status": "running",
        "version": "simplified"
    }

# Simple in-memory storage for demo purposes
agents: Dict[str, Dict[str, Any]] = {}
transitions: Dict[str, list] = {}

class AgentConfig(BaseModel):
    num_nodes: int
    state_dim: int
    action_dim: int
    hidden_dim: Optional[int] = 256
    lr: Optional[float] = 0.001
    gamma: Optional[float] = 0.99

class RLState(BaseModel):
    energy_matrix: list
    lqi_matrix: list
    buffer_matrix: list
    topology_adjacency: list
    congestion_vector: list

class RLAction(BaseModel):
    node_id: str
    next_hop: Optional[str]
    transmission_power: float
    action_type: str

class Transition(BaseModel):
    agent_id: str
    state: RLState
    action: RLAction
    reward: float
    next_state: RLState
    done: bool

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "device": "cpu",
        "agents_loaded": len(agents),
        "st_gcn_loaded": False,  # Simplified version
        "version": "simplified"
    }

@app.post("/agents/create")
async def create_agent(config: AgentConfig, agent_id: str = "default"):
    """Create a new RL agent (simplified)"""
    agents[agent_id] = {
        "config": config.dict(),
        "created_at": "now",
        "transitions": 0,
        "episodes": 0
    }
    transitions[agent_id] = []
    
    return {
        "agent_id": agent_id,
        "status": "created",
        "config": config.dict(),
        "message": f"Agent {agent_id} created with {config.num_nodes} nodes"
    }

@app.get("/agents")
async def list_agents():
    """List all agents"""
    return {
        "agents": list(agents.keys()),
        "count": len(agents)
    }

@app.get("/agents/{agent_id}/stats")
async def get_agent_stats(agent_id: str):
    """Get agent statistics"""
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {
        "agent_id": agent_id,
        "stats": agents[agent_id],
        "transition_count": len(transitions.get(agent_id, []))
    }

@app.post("/agents/{agent_id}/action")
async def select_action(agent_id: str, state: RLState, deterministic: bool = False):
    """Select action (simplified - returns heuristic action)"""
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Return a simple action for demo purposes
    return {
        "action": {
            "node_id": "node-1",
            "next_hop": "node-2",
            "transmission_power": 20.0,
            "action_type": "forward"
        },
        "log_probability": 0.5
    }

@app.post("/agents/{agent_id}/train")
async def train_agent(agent_id: str, epochs: int = 10, batch_size: int = 64):
    """Train agent (simplified)"""
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent_transitions = transitions.get(agent_id, [])
    
    if len(agent_transitions) == 0:
        return {
            "message": "No transitions to train on",
            "metrics": {
                "actor_loss": 0.0,
                "critic_loss": 0.0,
                "entropy": 0.0
            }
        }
    
    agents[agent_id]["episodes"] += 1
    agents[agent_id]["transitions"] = len(agent_transitions)
    
    return {
        "message": f"Training completed with {len(agent_transitions)} transitions",
        "metrics": {
            "actor_loss": 0.1,
            "critic_loss": 0.2,
            "entropy": 0.3
        }
    }

@app.post("/agents/{agent_id}/transition")
async def store_transition(transition: Transition):
    """Store a transition"""
    agent_id = transition.agent_id
    
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent_id not in transitions:
        transitions[agent_id] = []
    
    transitions[agent_id].append(transition.dict())
    
    return {
        "status": "stored",
        "agent_id": agent_id,
        "total_transitions": len(transitions[agent_id])
    }

@app.post("/agents/{agent_id}/save")
async def save_agent(agent_id: str, path: Optional[str] = None):
    """Save agent model (simplified)"""
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {
        "status": "saved",
        "agent_id": agent_id,
        "path": path or f"/models/{agent_id}.pt"
    }

@app.post("/agents/{agent_id}/load")
async def load_agent(agent_id: str, path: Optional[str] = None):
    """Load agent model (simplified)"""
    return {
        "status": "loaded",
        "agent_id": agent_id,
        "path": path or f"/models/{agent_id}.pt"
    }

@app.post("/embedding")
async def compute_embedding(
    energy_matrix: list,
    lqi_matrix: list,
    buffer_matrix: list,
    adjacency_matrix: list
):
    """Compute topology embedding (simplified)"""
    # Return a simple embedding for demo
    return {
        "embedding": [0.1, 0.2, 0.3, 0.4, 0.5],
        "shape": [5]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
