# Wireless Digital Twin for Adhoc WSN

A professional-grade digital twin simulation platform for adhoc wireless sensor networks (WSN). This project implements real routing protocols (AODV, DSR, and OLSR), realistic signal propagation models, advanced mobility patterns, and provides a complete digital twin framework for analyzing and predicting network behavior.

## Features

### Core Simulation Engine
- **Realistic Node Models**: Energy consumption, mobility patterns, transmission power, reception sensitivity
- **Signal Propagation Models**: Free-space, Two-ray ground reflection, Shadowing, Rayleigh fading, and Rician fading
- **Dynamic Topology**: Real-time neighbor discovery based on RSSI calculations and link quality assessment
- **Advanced Mobility**: Static, Random Walk, Linear, Circular, Gauss-Markov, and Random Waypoint models

### Routing Protocols
- **AODV (Ad-hoc On-Demand Distance Vector)**: 
  - Route discovery with RREQ/RREP/RERR messages
  - Sequence numbers for loop-free routing
  - Route maintenance and expiration
  - Hello packets for local connectivity

- **DSR (Dynamic Source Routing)**:
  - Source routing with complete path in packet headers
  - Route discovery and maintenance
  - Route caching for improved performance
  - Loop detection and route error handling

- **OLSR (Optimized Link State Routing)**:
  - Proactive routing with periodic topology control messages
  - Multi-Point Relay (MPR) optimization for reduced flooding
  - Topology control (TC) messages for link state advertisement
  - Better for low-mobility, dense networks

### Digital Twin Capabilities
- **Physical-Virtual Synchronization**: Bidirectional sync between physical and virtual networks
- **What-If Scenarios**: Test different configurations in the virtual twin before applying to physical
- **Anomaly Detection**: Automatic detection of discrepancies between physical and virtual states
- **Predictive Analysis**: Predict network behavior using the virtual twin

### Visualization & Analytics
- **Real-time Network Topology**: Interactive force-directed graph visualization
- **Performance Metrics Dashboard**: Throughput, latency, packet loss, energy consumption, routing overhead
- **Event Logging**: Comprehensive logging of all network events with filtering capabilities
- **Node Management**: Add, remove, and configure nodes in real-time
- **Data Export**: Export topology, metrics, and events in JSON or CSV format for analysis

### Research Features
- **Reproducibility**: Seeded random number generator for reproducible experiments
- **Metrics Time Series**: Capture metrics over time for trend analysis
- **Unit Tests**: Comprehensive test coverage for core components

### Professional UI
- **Responsive Design**: Works on desktop and tablet devices
- **Dark Mode Support**: Automatic dark mode based on system preferences
- **Modern Interface**: Clean, professional design with Tailwind CSS

## Technology Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Visualization**: react-force-graph-2d
- **Icons**: Lucide React
- **Testing**: Vitest + Testing Library

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test
```

## Usage

### Starting the Simulation

1. Open the application in your browser
2. Click "Start" in the Control Panel to begin the simulation
3. The network will automatically generate and route data packets

### Managing Nodes

1. Click "Add Node" in the Control Panel
2. Enter node ID, position (X, Y), and whether it's a gateway
3. Click "Add Node" to add it to the network
4. Remove nodes using the trash icon in the node list

### Configuring Simulation

- **Routing Protocol**: Choose between AODV, DSR, or OLSR
- **Signal Propagation Model**: Free-space, Two-ray, Shadowing, Rayleigh, or Rician
- **Update Interval**: Simulation step duration in milliseconds
- **Max Hops**: Maximum number of hops for packet routing
- **Enable Mobility**: Allow nodes to move according to mobility patterns
- **Enable Energy Depletion**: Simulate energy consumption over time

### Reproducibility

1. In the Control Panel, find the "Reproducibility" section
2. Enter a seed value (number or string)
3. Click "Set Seed" to enable seeded random
4. All random operations will now be reproducible
5. Click "Clear Seed" to revert to non-deterministic behavior

### Data Export

1. In the Export Panel, select JSON or CSV format
2. Click "Export Network Topology" to download topology data
3. Click "Export Network Metrics" to download current metrics
4. Click "Export Event Log" to download event history
5. Click "Export Metrics Time Series" to download metrics over time

### What-If Scenarios

1. Select a scenario type (High Mobility, Energy Depletion, Protocol Comparison, High Density)
2. Set the duration for the scenario
3. Click "Run Scenario" to execute in the virtual twin
4. View results comparing physical vs virtual performance

### Viewing Network Details

- Click on any node in the topology visualization to see detailed information
- Switch between Physical Network, Virtual Twin, and Comparison views
- Monitor real-time metrics in the dashboard
- Filter event log by event type

## Architecture

### Core Components

- **NetworkSimulation**: Main simulation engine handling node updates, packet processing, and topology management
- **DigitalTwin**: Manages synchronization between physical and virtual networks, what-if scenarios, and anomaly detection
- **NetworkNode**: Represents a sensor node with energy, mobility, and routing capabilities
- **PropagationModel**: Calculates RSSI, link quality, and communication feasibility
- **AODVProtocol/DSRProtocol/OLSRProtocol**: Implement the respective routing protocols

### Data Flow

```
Physical Network → Digital Twin Sync → Virtual Twin
     ↓                    ↓                    ↓
  Real-time           Synchronization      What-If
  Simulation         & Comparison         Scenarios
     ↓                    ↓                    ↓
  Metrics → Dashboard ← Comparison ← Predictions
```

## Signal Propagation Models

### Free-Space Path Loss
Based on Friis transmission equation for ideal conditions without obstacles.

### Two-Ray Ground Reflection
Accounts for ground reflection, more accurate for longer distances and lower antenna heights.

### Shadowing Model
Includes log-normal shadowing to model environmental obstacles and multipath effects.

### Rayleigh Fading Model
Models non-line-of-sight (NLOS) conditions with multipath propagation using Rayleigh distribution. Suitable for indoor environments with no dominant signal path.

### Rician Fading Model
Models line-of-sight (LOS) conditions with dominant component and multipath using Rician distribution. Suitable for outdoor environments with a strong LOS signal.

## Mobility Models

### Static
No movement - nodes remain at fixed positions.

### Random Walk
Random direction changes with configurable speed.

### Linear
Constant velocity in a fixed direction.

### Circular
Orbital movement around a center point.

### Gauss-Markov
Temporal correlation in movement using Markov process. More realistic than random walk with configurable correlation factor (α).

### Random Waypoint
Random destination selection with pause times at waypoints. Common in MANET research.

## Routing Protocol Comparison

| Feature | AODV | DSR | OLSR |
|---------|------|-----|------|
| Type | Reactive | Reactive | Proactive |
| Route Discovery | On-demand | On-demand | Periodic |
| Routing | Next-hop table | Source routing | Next-hop table |
| Route Caching | Limited | Extensive | Full topology |
| Overhead | Periodic hello | Route discovery only | Periodic TC messages |
| Scalability | Better for large networks | Better for small networks | Better for low mobility |
| Loop Prevention | Sequence numbers | Source routing | Sequence numbers |
| Optimization | None | None | MPR optimization |

## Performance Metrics

- **Throughput**: Packets successfully delivered per second
- **Latency**: Average time for packet delivery
- **Packet Loss Rate**: Percentage of packets that failed to deliver
- **Routing Overhead**: Percentage of control packets vs data packets
- **Network Lifetime**: Time until first node failure
- **Average Energy**: Mean energy across all nodes
- **Active Routes**: Number of valid routing table entries

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui
```

## Future Enhancements

- Additional routing protocols (TORA, ZRP)
- Machine learning-based route optimization
- Integration with real hardware sensors (ESP32, Arduino)
- 3D topology visualization with Three.js
- Security analysis and attack simulation (blackhole, grayhole, wormhole)
- Energy harvesting models (solar, kinetic)
- Advanced group mobility models (RPGM)

## License

MIT License - Feel free to use this project for educational and research purposes.

## References

- RFC 3561: AODV Routing Protocol
- RFC 4728: DSR Protocol
- RFC 3626: OLSR Protocol
- "Digital Twin approach to estimating and utilizing the capacity region of wireless ad hoc networks" - Computer Networks, 2024
- "Communication-Aware Digital-Twin Reliability Budgeting for Fog-Assisted Wireless Sensor Ad Hoc Networks" - 2026
- "AMoND: Area-Controlled Mobile Ad-Hoc Networking With Digital Twin" - IEEE Access, 2023

## Contributing

This is a research and educational project. Contributions are welcome, especially in the areas of:
- Additional routing protocols
- Improved propagation models
- Machine learning integration
- Real hardware support
- Advanced mobility patterns
