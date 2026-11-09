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
    updateInterval: 5000,
    maxHops: 10,
    routingProtocol: 'AODV',
    mobilityEnabled: false,
    energyDepletionEnabled: false,
    packetGenerationRate: 1,
    signalPropagationModel: 'free-space',
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
    // Initialize with some default nodes (closer positions for better connectivity)
    const initialNodes: Array<Partial<Node> & { id: string }> = [
      { id: 'node-1', position: { x: 100, y: 100 }, isGateway: true },
      { id: 'node-2', position: { x: 200, y: 100 } },
      { id: 'node-3', position: { x: 300, y: 100 } },
      { id: 'node-4', position: { x: 400, y: 100 } },
      { id: 'node-5', position: { x: 150, y: 200 } },
      { id: 'node-6', position: { x: 250, y: 200 } },
      { id: 'node-7', position: { x: 350, y: 200 } },
      { id: 'node-8', position: { x: 450, y: 200 } },
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

        // Capture metrics for history (every 20 steps to reduce updates)
        stepCount++;
        if (stepCount % 20 === 0) {
          setMetricsHistory(prev => {
            const newHistory = [...prev, { ...newPhysicalTopology.metrics }];
            // Keep only last 20 entries to prevent memory issues
            return newHistory.slice(-20);
          });
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
  }, [isRunning, config.updateInterval, config.packetGenerationRate, digitalTwin]);

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

  // Update RL stats periodically to show current episode reward (much less frequent)
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
      }, 5000); // Increased from 2000ms to 5000ms

      return () => clearInterval(interval);
    }
  }, [isRunning, config.rlEnabled, digitalTwin.getPhysicalSimulation()]);

  const currentTopology = activeTab === 'physical' ? physicalTopology : virtualTopology;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-950 via-blue-950 to-indigo-950">
      {/* Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-b border-white/20 dark:border-slate-700/20 sticky top-0 z-50">
        <div className="container mx-auto px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-2xl shadow-2xl shadow-purple-500/30">
                <GitCompare className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
                  Wireless Digital Twin
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium tracking-wide uppercase">
                  Adhoc Wireless Sensor Network Simulation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-5 py-2.5 rounded-full text-sm font-bold shadow-lg tracking-wide ${
                isRunning 
                  ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-white shadow-emerald-500/40' 
                  : 'bg-gradient-to-r from-slate-400 to-gray-500 text-white shadow-slate-500/40'
              }`}>
                {isRunning ? '● Running' : '○ Stopped'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-8 py-10">
        <div className="grid grid-cols-1 gap-10">
          {/* Network Topology Section - Full Width */}
          <div className="space-y-8">
            {/* Tab Navigation */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30 dark:border-slate-700/30">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('physical')}
                  className={`px-8 py-4 rounded-2xl font-bold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 ${
                    activeTab === 'physical'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/50 ring-4 ring-blue-500/30'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border-2 border-gray-200 dark:border-slate-600'
                  }`}
                >
                  <Activity className="w-6 h-6 inline mr-3" />
                  Physical Network
                </button>
                <button
                  onClick={() => setActiveTab('virtual')}
                  className={`px-8 py-4 rounded-2xl font-bold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 ${
                    activeTab === 'virtual'
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-500/50 ring-4 ring-purple-500/30'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border-2 border-gray-200 dark:border-slate-600'
                  }`}
                >
                  <GitCompare className="w-6 h-6 inline mr-3" />
                  Virtual Twin
                </button>
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`px-8 py-4 rounded-2xl font-bold transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 ${
                    activeTab === 'comparison'
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-500/50 ring-4 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border-2 border-gray-200 dark:border-slate-600'
                  }`}
                >
                  <BarChart3 className="w-6 h-6 inline mr-3" />
                  Comparison
                </button>
              </div>
            </div>

            {/* Network Topology Visualization */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-4 border border-white/30 dark:border-slate-700/30">
              <h2 className="text-2xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-4">
                {activeTab === 'physical' ? 'Physical Network Topology' : 
                 activeTab === 'virtual' ? 'Virtual Twin Topology' : 'Network Comparison'}
              </h2>
              {activeTab !== 'comparison' ? (
                <div className="w-full overflow-hidden rounded-2xl shadow-inner">
                  <NetworkTopologyComponent
                    topology={currentTopology}
                    onNodeClick={setSelectedNode}
                    width={800}
                    height={300}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Physical</h3>
                    <div className="w-full overflow-hidden rounded-2xl shadow-inner border-2 border-gray-200 dark:border-slate-700">
                      <NetworkTopologyComponent
                        topology={physicalTopology}
                        onNodeClick={setSelectedNode}
                        width={400}
                        height={200}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Virtual</h3>
                    <div className="w-full overflow-hidden rounded-2xl shadow-inner border-2 border-gray-200 dark:border-slate-700">
                      <NetworkTopologyComponent
                        topology={virtualTopology}
                        onNodeClick={setSelectedNode}
                        width={400}
                        height={200}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel - Full Width at Bottom */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30 dark:border-slate-700/30">
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
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30 dark:border-slate-700/30">
            <h2 className="text-2xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-8">
              Network Metrics
            </h2>
            <MetricsDashboard metrics={currentTopology.metrics} syncStats={syncStats} />
          </div>

          {/* Event Log - Full Width */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30 dark:border-slate-700/30">
            <h2 className="text-2xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-8">
              Event Log
            </h2>
            <EventLog events={digitalTwin.getPhysicalSimulation().getEventLog()} />
          </div>

          {/* What-If Scenarios - Full Width */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30 dark:border-slate-700/30">
            <h2 className="text-2xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-8">
              What-If Scenarios
            </h2>
            <WhatIfScenario
              onRunScenario={handleRunScenario}
              config={config}
            />
          </div>

          {/* Export Panel - Full Width */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30 dark:border-slate-700/30">
            <h2 className="text-2xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-8">
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
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/30 dark:border-slate-700/30">
              <h2 className="text-2xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-8">
                Node Details: {selectedNode.id}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-blue-200 dark:border-slate-600">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">Energy</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white mt-2">
                    {selectedNode.energy.toFixed(1)}%
                  </span>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-green-200 dark:border-slate-600">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">Status</span>
                  <span className={`text-xl font-bold mt-2 ${
                    selectedNode.isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {selectedNode.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-purple-200 dark:border-slate-600">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">Gateway</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white mt-2">
                    {selectedNode.isGateway ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-orange-200 dark:border-slate-600">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">Neighbors</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white mt-2">
                    {selectedNode.neighbors.length}
                  </span>
                </div>
                <div className="p-4 bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-cyan-200 dark:border-slate-600">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">Position</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white mt-2">
                    ({selectedNode.position.x.toFixed(0)}, {selectedNode.position.y.toFixed(0)})
                  </span>
                </div>
                <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-pink-200 dark:border-slate-600">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">TX Power</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white mt-2">
                    {selectedNode.transmissionPower} dBm
                  </span>
                </div>
                <div className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-teal-200 dark:border-slate-600">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">RX Sensitivity</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white mt-2">
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
