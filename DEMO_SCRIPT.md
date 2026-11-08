# Wireless Digital Twin - Demo Script for Evaluation

## Demo Overview

This script provides a step-by-step guide for demonstrating the Wireless Digital Twin platform during evaluation.

**Demo Duration:** 10-15 minutes  
**Target Audience:** Evaluators, stakeholders, technical reviewers

---

## Pre-Demo Checklist

**Before starting:**
- [ ] Frontend running at `http://localhost:5173`
- [ ] Backend running at `http://localhost:8000`
- [ ] Backend health check passing
- [ ] Browser with JavaScript enabled
- [ ] Stable internet connection (for loading libraries)

**Start the system:**

```bash
# Terminal 1 - Frontend
cd frontend
npm start

# Terminal 2 - Backend (Windows)
cd backend
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Backend (macOS/Linux)
cd backend
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Demo Script

### Section 1: Introduction (1 minute)

**Presenter Notes:**
- Welcome and brief introduction
- Overview of the system
- Technology stack summary

**Script:**
> "Welcome to the Wireless Digital Twin platform for Ad-hoc and Wireless Sensor Networks. This system provides real-time simulation, digital twin synchronization, and deep reinforcement learning for optimizing network routing decisions."

**Key Points to Highlight:**
- Professional UI with 3D visualization
- Multiple routing protocols (AODV, DSR, OLSR, DRL)
- RL agent with ST-GCN and PPO
- Real-time metrics and event logging
- Digital twin synchronization with event-triggered logic

---

### Section 2: Basic Simulation (3 minutes)

**Step 2.1: Add Nodes**

**Action:**
1. Click "Add Node" button 5-8 times
2. Observe nodes appearing in the topology visualization
3. Note the 3D force-directed graph layout

**Presenter Script:**
> "I'll start by adding nodes to create a network topology. The system uses a 3D force-directed graph for intuitive visualization. Each node represents a wireless sensor with energy, buffer, and routing capabilities."

**What to Show:**
- Nodes appear with different colors based on energy levels
- Links form automatically based on signal strength
- Real-time topology updates

---

**Step 2.2: Start Simulation with AODV**

**Action:**
1. Select "AODV" from Routing Protocol dropdown
2. Click "Start" button
3. Enable "Packet Generation" checkbox
4. Observe metrics updating in real-time

**Presenter Script:**
> "Now I'll start the simulation using AODV (Ad-hoc On-Demand Distance Vector) routing. AODV is a reactive protocol that establishes routes on-demand. Watch the metrics dashboard update in real-time as packets are generated and routed."

**What to Show:**
- Total packets increasing
- Successful packets increasing
- Average latency displaying
- Event log showing routing events
- Throughput and packet loss rate

---

**Step 2.3: Switch to DSR**

**Action:**
1. Click "Stop" button
2. Select "DSR" from Routing Protocol dropdown
3. Click "Start" button
4. Observe different routing behavior

**Presenter Script:**
> "Now I'll switch to DSR (Dynamic Source Routing). DSR uses source routing where the entire path is included in the packet header. Notice how the routing overhead and latency differ from AODV."

**What to Show:**
- Different routing overhead metrics
- Different latency patterns
- Event log showing source routing paths

---

**Step 2.4: Switch to OLSR**

**Action:**
1. Click "Stop" button
2. Select "OLSR" from Routing Protocol dropdown
3. Click "Start" button
4. Observe proactive routing behavior

**Presenter Script:**
> "OLSR (Optimized Link State Routing) is a proactive protocol that maintains routes at all times. Notice the higher routing overhead but faster packet delivery since routes are pre-established."

**What to Show:**
- Higher routing overhead
- Lower latency
- Continuous route discovery in event log

---

### Section 3: RL Agent Demonstration (4 minutes)

**Step 3.1: Initialize RL Agent**

**Action:**
1. Click "Stop" button
2. Select "DRL" from Routing Protocol dropdown
3. Enable "RL Agent" checkbox
4. Select "Training" from RL Mode dropdown
5. Click "Initialize Agent" button
6. Wait for success message

**Presenter Script:**
> "Now I'll demonstrate the Deep Reinforcement Learning routing agent. The agent uses ST-GCN (Spatial-Temporal Graph Convolution) for state extraction and PPO (Proximal Policy Optimization) for training. Let me initialize the agent."

**What to Show:**
- Success popup message
- RL statistics updating (Agent: Ready, Episodes: 0)
- Backend logs showing agent creation

---

**Step 3.2: Run Simulation with DRL**

**Action:**
1. Click "Start" button
2. Enable "Packet Generation" checkbox
3. Let simulation run for 10-15 seconds
4. Observe transitions accumulating

**Presenter Script:**
> "The DRL agent is now making routing decisions based on network state including energy levels, link quality, buffer occupancy, and topology. The system stores state-action-reward transitions for training."

**What to Show:**
- Transitions count increasing
- Episode reward updating
- Event log showing RL-based routing decisions
- Energy-aware routing behavior

---

**Step 3.3: Train the Agent**

**Action:**
1. Click "Train Agent" button
2. Wait for training completion
3. Observe episode count increasing

**Presenter Script:**
> "After collecting enough transitions, I'll train the agent using the PPO algorithm. The agent learns to optimize routing decisions based on throughput, energy consumption, and latency."

**What to Show:**
- Training completion message
- Episode count increasing
- Average reward statistics
- Backend logs showing training progress

---

### Section 4: Advanced Features (3 minutes)

**Step 4.1: Digital Twin Synchronization**

**Action:**
1. Click "Virtual Twin" tab
2. Show virtual topology identical to physical
3. Show sync statistics in dashboard

**Presenter Script:**
> "The system implements digital twin synchronization between physical and virtual topologies. The sync uses event-triggered logic with dynamic thresholds to optimize bandwidth usage while maintaining accuracy."

**What to Show:**
- Virtual topology matching physical
- Sync Count metric in dashboard
- Sync Threshold (dynamic)
- Sync status indicator

---

**Step 4.2: Propagation Models**

**Action:**
1. Click "Stop" button
2. Change propagation model to "Rayleigh"
3. Click "Start" button
4. Observe link quality changes

**Presenter Script:**
> "The system supports multiple realistic propagation models including free-space, two-ray ground, shadowing, Rayleigh fading, and Rician fading. Let me switch to Rayleigh fading to simulate multipath effects."

**What to Show:**
- Links appearing/disappearing based on fading
- Packet loss rate changing
- Event log showing link quality variations

---

**Step 4.3: Mobility Patterns**

**Action:**
1. Enable "Mobility" checkbox
2. Select "Random Waypoint" from mobility dropdown
3. Observe nodes moving in visualization
4. Observe topology changes

**Presenter Script:**
> "The system simulates realistic node mobility patterns including random walk, linear, circular, Gauss-Markov, and random waypoint. Watch as nodes move and the topology dynamically adapts."

**What to Show:**
- Nodes moving in 3D space
- Links forming/breaking as nodes move
- Route discovery events in log
- Dynamic threshold adjustment

---

**Step 4.4: Data Export**

**Action:**
1. Click "Export" button
2. Select "JSON" format
3. Download the file
4. (Optional) Show file contents

**Presenter Script:**
> "The system supports data export for analysis and reproducibility. You can export simulation data in JSON or CSV format for further analysis, benchmarking, or publication."

**What to Show:**
- Export dialog
- Downloaded file with network state, metrics, and events
- Data format includes topology, node states, routing tables

---

### Section 5: What-If Scenarios (2 minutes)

**Step 5.1: Create What-If Scenario**

**Action:**
1. Click "What-If Scenario" tab
2. Enable scenario mode
3. Change routing protocol in virtual twin
4. Click "Run Scenario" button
5. Compare physical vs virtual metrics

**Presenter Script:**
> "The digital twin enables what-if scenario testing. I can simulate different routing protocols, propagation models, or mobility patterns in the virtual twin without affecting the physical network. This allows safe experimentation and optimization."

**What to Show:**
- Virtual topology with different configuration
- Side-by-side metrics comparison
- Prediction accuracy
- Difference analysis

---

### Section 6: Conclusion (1 minute)

**Presenter Script:**
> "The Wireless Digital Twin platform provides a comprehensive simulation environment for ad-hoc and wireless sensor networks. Key features include:

- Professional 3D visualization
- Multiple routing protocols with RL optimization
- Realistic propagation and mobility models
- Digital twin synchronization with event-triggered logic
- What-if scenario testing
- Data export for analysis

The system is ready for further development including MQTT-SN telemetry, SDN actuation, NS-3 integration, and hardware-in-the-loop validation."

**Key Takeaways:**
- End-to-end simulation platform
- RL agent with ST-GCN and PPO
- Event-triggered sync with dynamic thresholds
- Professional UI and real-time metrics
- Extensible architecture for future enhancements

---

## Fallback Options

### If Backend Fails

**Backup Plan:**
- Continue with frontend-only demo
- Show simulation with heuristic routing
- Emphasize UI and visualization features
- Skip RL agent training

**Script:**
> "The backend is experiencing connectivity issues, but I can demonstrate the simulation engine with traditional routing protocols. The RL features require the backend for training, but the simulation logic is fully functional."

---

### If Browser Compatibility Issues

**Backup Plan:**
- Try Chrome or Firefox
- Disable extensions
- Use incognito mode
- If still fails, take screenshots and walk through features

---

### If Simulation Crashes

**Backup Plan:**
- Refresh the page
- Start fresh with fewer nodes
- Disable packet generation
- Show individual features one at a time

---

## Technical Notes for Presenter

**Key Metrics to Monitor:**
- CPU usage: Should be < 80%
- Memory usage: Should be < 2GB
- Browser console: Should have no errors
- Backend logs: Should show successful requests

**Keyboard Shortcuts:**
- `F12`: Open browser console for debugging
- `Ctrl+R`: Refresh page
- `Ctrl+Shift+R`: Hard refresh (clear cache)

**Common Issues:**
- "RL agent not enabled": Initialize agent first
- "CORS error": Check backend CORS configuration
- "Transitions: 0": Run simulation with packet generation
- Buttons disabled: Check simulation state

---

## Evaluation Criteria

The system will be evaluated on:

1. **Functionality** (40%)
   - All routing protocols working
   - RL agent operational
   - Metrics accurate
   - No critical bugs

2. **User Experience** (30%)
   - Intuitive UI
   - Real-time updates
   - Clear visualization
   - Responsive controls

3. **Technical Quality** (20%)
   - Code quality
   - Architecture
   - Performance
   - Error handling

4. **Documentation** (10%)
   - Deployment guide
   - API documentation
   - Code comments
   - README

---

## Contact Information

**Questions during demo:**
- Answer technical questions honestly
- If uncertain, note question for follow-up
- Emphasize current scope and future work

**Technical support:**
- Email: [Your Email]
- Repository: [GitHub URL]
- Documentation: `DEPLOYMENT.md`

---

## Demo Success Checklist

**Before demo:**
- [ ] System running without errors
- [ ] All features tested
- [ ] Browser console clean
- [ ] Backend healthy
- [ ] Demo script reviewed

**During demo:**
- [ ] All sections covered
- [ ] No critical errors
- [ ] Questions answered
- [ ] Key features demonstrated

**After demo:**
- [ ] Collect feedback
- [ ] Note questions for follow-up
- [ ] Document any issues found
- [ ] Plan improvements

---

**Good luck with your evaluation!**
