import React, { useState } from 'react';
import type { SimulationConfig, Node } from '../types/network';
import { Plus, Trash2, Play, Pause, RotateCcw, Settings, RefreshCw, Brain } from 'lucide-react';
import { setGlobalSeed, clearGlobalSeed } from '../utils/seededRandom';

interface ControlPanelProps {
  config: SimulationConfig;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
  onAddNode: (node: Partial<Node> & { id: string }) => void;
  onRemoveNode: (nodeId: string) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  isRunning: boolean;
  nodes: Map<string, Node>;
  onInitializeRL?: () => void;
  onTrainRL?: () => void;
  rlAgentStats?: any;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  config,
  onConfigChange,
  onAddNode,
  onRemoveNode,
  onStart,
  onStop,
  onReset,
  isRunning,
  nodes,
  onInitializeRL,
  onTrainRL,
  rlAgentStats,
}) => {
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNodeId, setNewNodeId] = useState('');
  const [newNodeX, setNewNodeX] = useState('100');
  const [newNodeY, setNewNodeY] = useState('100');
  const [newNodeIsGateway, setNewNodeIsGateway] = useState(false);
  const [seedValue, setSeedValue] = useState('');
  const [isSeededEnabled, setIsSeededEnabled] = useState(false);

  const handleAddNode = () => {
    if (newNodeId) {
      onAddNode({
        id: newNodeId,
        position: {
          x: parseFloat(newNodeX) || 100,
          y: parseFloat(newNodeY) || 100,
        },
        isGateway: newNodeIsGateway,
      });
      setNewNodeId('');
      setNewNodeX('100');
      setNewNodeY('100');
      setNewNodeIsGateway(false);
      setShowAddNode(false);
    }
  };

  const handleSetSeed = () => {
    if (seedValue) {
      setGlobalSeed(seedValue);
      setIsSeededEnabled(true);
    }
  };

  const handleClearSeed = () => {
    clearGlobalSeed();
    setIsSeededEnabled(false);
    setSeedValue('');
  };

  const nodesArray = Array.from(nodes.values());

  return (
    <div className="control-panel bg-white dark:bg-gray-800 rounded-lg shadow-lg p-5 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Control Panel
        </h2>
        <div className="flex gap-2">
          <button
            onClick={isRunning ? onStop : onStart}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isRunning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start
              </>
            )}
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Simulation Configuration */}
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
          Simulation Configuration
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Routing Protocol
            </label>
            <select
              value={config.routingProtocol}
              onChange={(e) =>
                onConfigChange({ routingProtocol: e.target.value as 'AODV' | 'DSR' | 'OLSR' | 'DRL' })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="AODV">AODV (Reactive)</option>
              <option value="DSR">DSR (Source Routing)</option>
              <option value="OLSR">OLSR (Proactive)</option>
              <option value="DRL">DRL (Deep Reinforcement Learning)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Signal Propagation Model
            </label>
            <select
              value={config.signalPropagationModel}
              onChange={(e) =>
                onConfigChange({
                  signalPropagationModel: e.target.value as
                    | 'free-space'
                    | 'two-ray'
                    | 'shadowing'
                    | 'rayleigh'
                    | 'rician',
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="free-space">Free Space</option>
              <option value="two-ray">Two-Ray Ground</option>
              <option value="shadowing">Shadowing</option>
              <option value="rayleigh">Rayleigh Fading (NLOS)</option>
              <option value="rician">Rician Fading (LOS)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Update Interval (ms)
            </label>
            <input
              type="number"
              value={config.updateInterval}
              onChange={(e) =>
                onConfigChange({ updateInterval: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Hops
            </label>
            <input
              type="number"
              value={config.maxHops}
              onChange={(e) =>
                onConfigChange({ maxHops: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mobility"
              checked={config.mobilityEnabled}
              onChange={(e) =>
                onConfigChange({ mobilityEnabled: e.target.checked })
              }
              className="w-4 h-4"
            />
            <label
              htmlFor="mobility"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Enable Mobility
            </label>
          </div>

          {config.mobilityEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mobility Pattern
              </label>
              <select
                value="random"
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-sm"
              >
                <option value="random">Random Walk</option>
                <option value="linear">Linear</option>
                <option value="circular">Circular</option>
                <option value="gauss-markov">Gauss-Markov</option>
                <option value="random-waypoint">Random Waypoint</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Set mobility pattern when adding nodes
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="energy"
              checked={config.energyDepletionEnabled}
              onChange={(e) =>
                onConfigChange({ energyDepletionEnabled: e.target.checked })
              }
              className="w-4 h-4"
            />
            <label
              htmlFor="energy"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Enable Energy Depletion
            </label>
          </div>
        </div>
      </div>

      {/* Reproducibility Settings */}
      <div className="mt-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
          Reproducibility
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${isSeededEnabled ? 'text-green-500' : 'text-gray-400'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Seeded Random: {isSeededEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={seedValue}
              onChange={(e) => setSeedValue(e.target.value)}
              placeholder="Enter seed (number or string)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              disabled={isSeededEnabled}
            />
            {!isSeededEnabled ? (
              <button
                onClick={handleSetSeed}
                disabled={!seedValue}
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-sm"
              >
                Set Seed
              </button>
            ) : (
              <button
                onClick={handleClearSeed}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm"
              >
                Clear Seed
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Seeded random ensures reproducible simulation results for research experiments
          </p>
        </div>
      </div>

      {/* RL Controls */}
      <div className="mt-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Deep Reinforcement Learning
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rl-enabled"
              checked={config.rlEnabled}
              onChange={(e) =>
                onConfigChange({ rlEnabled: e.target.checked })
              }
              className="w-4 h-4"
            />
            <label
              htmlFor="rl-enabled"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Enable RL Agent
            </label>
          </div>

          {config.rlEnabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  RL Mode
                </label>
                <select
                  value={config.rlMode}
                  onChange={(e) =>
                    onConfigChange({ rlMode: e.target.value as 'training' | 'inference' })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="inference">Inference (Use Trained Model)</option>
                  <option value="training">Training (Learn from Experience)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onInitializeRL}
                  className="flex-1 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Initialize Agent
                </button>
                <button
                  onClick={onTrainRL}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Train Agent
                </button>
              </div>

              {rlAgentStats && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Transitions:</span>
                      <span className="ml-2 font-mono">{rlAgentStats.transitionCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Episodes:</span>
                      <span className="ml-2 font-mono">{rlAgentStats.episodeRewards.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Avg Reward:</span>
                      <span className="ml-2 font-mono">{rlAgentStats.averageReward.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Episode Reward:</span>
                      <span className="ml-2 font-mono">{rlAgentStats.currentEpisodeReward?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Steps:</span>
                      <span className="ml-2 font-mono">{rlAgentStats.episodeStepCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Status:</span>
                      <span className={`ml-2 font-mono ${rlAgentStats.isTraining ? 'text-yellow-600' : 'text-green-600'}`}>
                        {rlAgentStats.isTraining ? 'Training' : 'Ready'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Node Management */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Node Management ({nodesArray.length})
          </h3>
          <button
            onClick={() => setShowAddNode(!showAddNode)}
            className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Node
          </button>
        </div>

        {showAddNode && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Node ID
                </label>
                <input
                  type="text"
                  value={newNodeId}
                  onChange={(e) => setNewNodeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., node-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  X Position
                </label>
                <input
                  type="number"
                  value={newNodeX}
                  onChange={(e) => setNewNodeX(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Y Position
                </label>
                <input
                  type="number"
                  value={newNodeY}
                  onChange={(e) => setNewNodeY(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="gateway"
                  checked={newNodeIsGateway}
                  onChange={(e) => setNewNodeIsGateway(e.target.checked)}
                  className="w-4 h-4"
                />
                <label
                  htmlFor="gateway"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Gateway Node
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAddNode}
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white"
              >
                Add Node
              </button>
              <button
                onClick={() => setShowAddNode(false)}
                className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  ID
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  Energy
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  Gateway
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {nodesArray.map((node) => (
                <tr
                  key={node.id}
                  className="border-t border-gray-200 dark:border-gray-600"
                >
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                    {node.id}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                    {node.energy.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        node.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {node.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                    {node.isGateway ? 'Yes' : 'No'}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onRemoveNode(node.id)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
