import React, { useState } from 'react';
import type { SimulationConfig } from '../types/network';
import { Play, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface WhatIfScenarioProps {
  onRunScenario: (config: Partial<SimulationConfig>, duration: number) => Promise<any>;
  config: SimulationConfig;
}

export const WhatIfScenario: React.FC<WhatIfScenarioProps> = ({
  onRunScenario,
  config,
}) => {
  const [scenarioType, setScenarioType] = useState<'mobility' | 'energy' | 'protocol' | 'density'>('mobility');
  const [duration, setDuration] = useState(10000);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const scenarios = [
    {
      id: 'mobility',
      name: 'High Mobility',
      description: 'Simulate network with high node mobility',
      getConfig: () => ({
        mobilityEnabled: true,
        updateInterval: 500,
      }),
    },
    {
      id: 'energy',
      name: 'Energy Depletion',
      description: 'Simulate network with rapid energy depletion',
      getConfig: () => ({
        energyDepletionEnabled: true,
        updateInterval: 1000,
      }),
    },
    {
      id: 'protocol',
      name: 'Protocol Comparison',
      description: 'Compare AODV vs DSR performance',
      getConfig: () => ({
        routingProtocol: (config.routingProtocol === 'AODV' ? 'DSR' : 'AODV') as 'AODV' | 'DSR' | 'OLSR',
      }),
    },
    {
      id: 'density',
      name: 'High Density',
      description: 'Simulate network with increased node density',
      getConfig: () => ({
        updateInterval: 200,
        maxHops: 15,
      }),
    },
  ];

  const handleRunScenario = async () => {
    setIsRunning(true);
    setResults(null);

    const scenario = scenarios.find(s => s.id === scenarioType);
    if (scenario) {
      const scenarioConfig = scenario.getConfig();
      try {
        const result = await onRunScenario(scenarioConfig, duration);
        setResults(result);
      } catch (error) {
        console.error('Scenario execution failed:', error);
      }
    }

    setIsRunning(false);
  };

  return (
    <div className="what-if-scenario bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-purple-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          What-If Scenarios
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Scenario Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => setScenarioType(scenario.id as any)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  scenarioType === scenario.id
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {scenario.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {scenario.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Duration (ms)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <button
          onClick={handleRunScenario}
          disabled={isRunning}
          className="w-full px-4 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white flex items-center justify-center gap-2 font-medium"
        >
          {isRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running Scenario...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Scenario
            </>
          )}
        </button>

        {results && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Scenario Results
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Physical Throughput
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {results.physicalMetrics.throughput.toFixed(2)} pps
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Virtual Throughput
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {results.virtualMetrics.throughput.toFixed(2)} pps
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Physical Packet Loss
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {results.physicalMetrics.packetLossRate.toFixed(1)}%
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Virtual Packet Loss
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {results.virtualMetrics.packetLossRate.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
              {results.comparison.accuracy > 0.8 ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              <div className="text-sm text-gray-900 dark:text-white">
                Prediction Accuracy: {(results.comparison.accuracy * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
