import { useEffect, useState, useCallback } from 'react';
import { DigitalTwin } from './simulation/DigitalTwin';
import NetworkTopologyComponent from './components/NetworkTopology';
import { MetricsDashboard } from './components/MetricsDashboard';
import { ControlPanel } from './components/ControlPanel';
import { WhatIfScenario } from './components/WhatIfScenario';
import { EventLog } from './components/EventLog';
import { ExportPanel } from './components/ExportPanel';
import type { SimulationConfig, Node, NetworkTopology as NetworkTopologyType, NetworkMetrics } from './types/network';
import { Activity, GitCompare, BarChart3 } from 'lucide-react';

function App() {
  const [config, setConfig] = useState<SimulationConfig>({
    updateInterval: 1000,
    maxHops: 10,
    routingProtocol: 'AODV',
    mobilityEnabled: false,
    energyDepletionEnabled: false,
    packetGenerationRate: 1,
    signalPropagationModel: 'two-ray',
    shadowingVariance: 4.0,
    rlEnabled: false,
    rlMode: 'inference',
    csiCalibrationEnabled: false,
    eventTriggeredSync: false,
    syncThreshold: 0.1,
  });

  const [digitalTwin] = useState<DigitalTwin>(
    new DigitalTwin(config, 1000)
  );

  const [physicalTopology, setPhysicalTopology] = useState<NetworkTopologyType>(
    digitalTwin.getPhysicalSimulation().getTopology()
  );
  const [virtualTopology, setVirtualTopology] = useState<NetworkTopologyType>(
    digitalTwin.getVirtualSimulation().getTopology()
  );
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'physical' | 'virtual' | 'comparison'>('physical');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<NetworkMetrics[]>([]);
  const [syncStats, setSyncStats] = useState<{syncCount: number; lastDeviation: number; dynamicThreshold: number}>({syncCount: 0, lastDeviation: 0, dynamicThreshold: 0.1});

  // Load saved metrics from localStorage on mount
  useEffect(() => {
    const savedMetrics = localStorage.getItem('wirelessTwin_metrics');
    if (savedMetrics) {
      try {
        const parsed = JSON.parse(savedMetrics);
        setMetricsHistory(parsed);
      } catch (e) {
        console.error('Failed to load saved metrics:', e);
      }
    }
  }, []);

  // Save metrics to localStorage whenever it changes
  useEffect(() => {
    if (metricsHistory.length > 0) {
      localStorage.setItem('wirelessTwin_metrics', JSON.stringify(metricsHistory));
    }
  }, [metricsHistory]);

  useEffect(() => {
    // Initialize with some default nodes
    const initialNodes: Array<Partial<Node> & { id: string }> = [
      { id: 'node-1', position: { x: 100, y: 100 }, isGateway: true },
      { id: 'node-2', position: { x: 200, y: 150 } },
      { id: 'node-3', position: { x: 150, y: 250 } },
      { id: 'node-4', position: { x: 300, y: 200 } },
      { id: 'node-5', position: { x: 250, y: 300 } },
      { id: 'node-6', position: { x: 400, y: 150 } },
      { id: 'node-7', position: { x: 350, y: 350 } },
      { id: 'node-8', position: { x: 500, y: 250 } },
    ];

    initialNodes.forEach(node => {
      digitalTwin.getPhysicalSimulation().addNode(node);
    });

    // Sync to virtual to ensure both have the same nodes
    digitalTwin.syncPhysicalToVirtual();
    
    // Get topologies and ensure they have nodes
    const physTopo = digitalTwin.getPhysicalSimulation().getTopology();
    const virtTopo = digitalTwin.getVirtualSimulation().getTopology();
    
    // If virtual is empty, add nodes manually
    if (virtTopo.nodes.size === 0) {
      physTopo.nodes.forEach((node) => {
        digitalTwin.getVirtualSimulation().addNode(node);
      });
    }
    
    setPhysicalTopology(physTopo);
    setVirtualTopology(digitalTwin.getVirtualSimulation().getTopology());
    setSyncStats(digitalTwin.getSyncStats());
  }, [digitalTwin]);

  useEffect(() => {
    let interval: number | null = null;
    let stepCount = 0;

    if (isRunning) {
      interval = window.setInterval(() => {
        digitalTwin.getPhysicalSimulation().step();
        digitalTwin.syncPhysicalToVirtual(true); // Event-triggered sync during simulation
        
        const newPhysicalTopology = digitalTwin.getPhysicalSimulation().getTopology();
        setPhysicalTopology(newPhysicalTopology);
        setVirtualTopology(digitalTwin.getVirtualSimulation().getTopology());
        setSyncStats(digitalTwin.getSyncStats());

        // Capture metrics for history (every 5 steps to avoid too much data)
        stepCount++;
        if (stepCount % 5 === 0) {
          setMetricsHistory(prev => [...prev, { ...newPhysicalTopology.metrics }]);
        }

        // Generate traffic based on packet generation rate
        const nodes = Array.from(digitalTwin.getPhysicalSimulation().getTopology().nodes.keys());
        if (nodes.length >= 2 && config.packetGenerationRate > 0) {
          // Generate packets according to the rate
          const packetsToGenerate = Math.ceil(config.packetGenerationRate);
          for (let i = 0; i < packetsToGenerate; i++) {
            const sourceIndex = Math.floor(Math.random() * nodes.length);
            let destIndex = Math.floor(Math.random() * nodes.length);
            while (destIndex === sourceIndex && nodes.length > 1) {
              destIndex = Math.floor(Math.random() * nodes.length);
            }
            const source = nodes[sourceIndex];
            const dest = nodes[destIndex];
            digitalTwin.getPhysicalSimulation().sendPacket(source, dest, { 
              data: `packet-${Date.now()}-${i}`,
              sequence: i,
            });
          }
        }
      }, config.updateInterval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, config, digitalTwin]);

  const handleConfigChange = useCallback((newConfig: Partial<SimulationConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    digitalTwin.getPhysicalSimulation().updateConfig(newConfig);
    digitalTwin.getVirtualSimulation().updateConfig(newConfig);
  }, [digitalTwin]);

  const handleAddNode = useCallback((node: Partial<Node> & { id: string }) => {
    digitalTwin.getPhysicalSimulation().addNode(node);
    digitalTwin.syncPhysicalToVirtual();
    setPhysicalTopology(digitalTwin.getPhysicalSimulation().getTopology());
    setVirtualTopology(digitalTwin.getVirtualSimulation().getTopology());
  }, [digitalTwin]);

  const handleRemoveNode = useCallback((nodeId: string) => {
    digitalTwin.getPhysicalSimulation().removeNode(nodeId);
    digitalTwin.syncPhysicalToVirtual();
    setPhysicalTopology(digitalTwin.getPhysicalSimulation().getTopology());
    setVirtualTopology(digitalTwin.getVirtualSimulation().getTopology());
  }, [digitalTwin]);

  const handleStart = useCallback(() => {
    setIsRunning(true);
    digitalTwin.getPhysicalSimulation().start();
  }, [digitalTwin]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    digitalTwin.getPhysicalSimulation().stop();
  }, [digitalTwin]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    digitalTwin.reset();
    setPhysicalTopology(digitalTwin.getPhysicalSimulation().getTopology());
    setVirtualTopology(digitalTwin.getVirtualSimulation().getTopology());
  }, [digitalTwin]);

  const handleRunScenario = useCallback(async (scenarioConfig: Partial<SimulationConfig>, duration: number) => {
    return await digitalTwin.runWhatIfScenario(scenarioConfig, duration);
  }, [digitalTwin]);

  const [rlAgentStats, setRlAgentStats] = useState<any>(null);

  const handleInitializeRL = useCallback(async () => {
    try {
      // Enable RL in config before initializing
      handleConfigChange({ rlEnabled: true });
      await digitalTwin.getPhysicalSimulation().initializeRLAgent();
      const stats = digitalTwin.getPhysicalSimulation().getRLAgentStats();
      setRlAgentStats(stats);
    } catch (error) {
      console.error('Failed to initialize RL agent:', error);
      alert('Failed to initialize RL agent. Check that the backend is running at http://localhost:8000');
    }
  }, [digitalTwin, handleConfigChange]);

  const handleTrainRL = useCallback(async () => {
    try {
      const result = await digitalTwin.getPhysicalSimulation().trainRLAgent(10);
      const stats = digitalTwin.getPhysicalSimulation().getRLAgentStats();
      setRlAgentStats(stats);
      console.log('Training completed:', result);
    } catch (error) {
      console.error('Failed to train RL agent:', error);
      alert('Failed to train RL agent. Check that the backend is running and has stored transitions.');
    }
  }, [digitalTwin]);

  // Update RL stats periodically to show current episode reward
  useEffect(() => {
    if (isRunning && config.rlEnabled) {
      const interval = setInterval(() => {
        const stats = digitalTwin.getPhysicalSimulation().getRLAgentStats();
        if (stats) {
          // Update episode reward from simulation
          const simEpisodeReward = digitalTwin.getPhysicalSimulation().getEpisodeReward();
          const simStepCount = digitalTwin.getPhysicalSimulation().getEpisodeStepCount();
          stats.currentEpisodeReward = simEpisodeReward;
          stats.episodeStepCount = simStepCount;
          setRlAgentStats({ ...stats });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isRunning, config.rlEnabled, digitalTwin.getPhysicalSimulation()]);

  const currentTopology = activeTab === 'physical' ? physicalTopology : virtualTopology;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-xl border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <GitCompare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Wireless Digital Twin
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Adhoc Wireless Sensor Network Simulation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold shadow-md ${
                isRunning 
                  ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' 
                  : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
              }`}>
                {isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8">
          {/* Network Topology Section - Full Width */}
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex gap-3">
                <button
                  onClick={() => setActiveTab('physical')}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg ${
                    activeTab === 'physical'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/50'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <Activity className="w-5 h-5 inline mr-2" />
                  Physical Network
                </button>
                <button
                  onClick={() => setActiveTab('virtual')}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg ${
                    activeTab === 'virtual'
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-500/50'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <GitCompare className="w-5 h-5 inline mr-2" />
                  Virtual Twin
                </button>
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg ${
                    activeTab === 'comparison'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-green-500/50'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <BarChart3 className="w-5 h-5 inline mr-2" />
                  Comparison
                </button>
              </div>
            </div>

            {/* Network Topology Visualization */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-6">
                {activeTab === 'physical' ? 'Physical Network Topology' : 
                 activeTab === 'virtual' ? 'Virtual Twin Topology' : 'Network Comparison'}
              </h2>
              {activeTab !== 'comparison' ? (
                <div className="w-full overflow-hidden rounded-xl shadow-inner">
                  <NetworkTopologyComponent
                    topology={currentTopology}
                    onNodeClick={setSelectedNode}
                    width={1200}
                    height={600}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Physical</h3>
                    <div className="w-full overflow-hidden rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                      <NetworkTopologyComponent
                        topology={physicalTopology}
                        onNodeClick={setSelectedNode}
                        width={600}
                        height={400}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Virtual</h3>
                    <div className="w-full overflow-hidden rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                      <NetworkTopologyComponent
                        topology={virtualTopology}
                        onNodeClick={setSelectedNode}
                        width={600}
                        height={400}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel - Full Width at Bottom */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <ControlPanel
              config={config}
              onConfigChange={handleConfigChange}
              onAddNode={handleAddNode}
              onRemoveNode={handleRemoveNode}
              onStart={handleStart}
              onStop={handleStop}
              onReset={handleReset}
              isRunning={isRunning}
              nodes={physicalTopology.nodes}
              onInitializeRL={handleInitializeRL}
              onTrainRL={handleTrainRL}
              rlAgentStats={rlAgentStats}
            />
          </div>

          {/* Metrics Dashboard - Full Width */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-6">
              Network Metrics
            </h2>
            <MetricsDashboard metrics={currentTopology.metrics} syncStats={syncStats} />
          </div>

          {/* Event Log - Full Width */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-6">
              Event Log
            </h2>
            <EventLog events={digitalTwin.getPhysicalSimulation().getEventLog()} />
          </div>

          {/* What-If Scenarios - Full Width */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-6">
              What-If Scenarios
            </h2>
            <WhatIfScenario
              onRunScenario={handleRunScenario}
              config={config}
            />
          </div>

          {/* Export Panel - Full Width */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-6">
              Export Data
            </h2>
            <ExportPanel
              topology={currentTopology}
              metrics={currentTopology.metrics}
              events={digitalTwin.getPhysicalSimulation().getEventLog()}
              metricsHistory={metricsHistory}
            />
          </div>

          {/* Selected Node Details - Full Width */}
          {selectedNode && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-6">
                Node Details: {selectedNode.id}
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Energy:</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedNode.energy.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Status:</span>
                  <span className={`text-sm font-bold ${
                    selectedNode.isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {selectedNode.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Gateway:</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedNode.isGateway ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Neighbors:</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedNode.neighbors.length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Position:</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    ({selectedNode.position.x.toFixed(0)}, {selectedNode.position.y.toFixed(0)})
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">TX Power:</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedNode.transmissionPower} dBm
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">RX Sensitivity:</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {selectedNode.receptionSensitivity} dBm
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
