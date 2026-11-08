import React from 'react';
import type { NetworkMetrics } from '../types/network';
import { Activity, Wifi, Battery, AlertTriangle, Zap, Network, RefreshCw } from 'lucide-react';

interface MetricsDashboardProps {
  metrics: NetworkMetrics;
  syncStats?: {
    syncCount: number;
    lastDeviation: number;
    dynamicThreshold: number;
  };
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ metrics, syncStats }) => {
  const metricsCards = [
    {
      title: 'Total Packets',
      value: metrics.totalPackets,
      icon: Activity,
      color: 'blue',
      format: 'number',
    },
    {
      title: 'Successful Packets',
      value: metrics.successfulPackets,
      icon: Wifi,
      color: 'green',
      format: 'number',
    },
    {
      title: 'Failed Packets',
      value: metrics.failedPackets,
      icon: AlertTriangle,
      color: 'red',
      format: 'number',
    },
    {
      title: 'Average Latency',
      value: metrics.averageLatency,
      icon: Zap,
      color: 'yellow',
      format: 'ms',
    },
    {
      title: 'Throughput',
      value: metrics.throughput,
      icon: Network,
      color: 'purple',
      format: 'pps',
    },
    {
      title: 'Packet Loss Rate',
      value: metrics.packetLossRate,
      icon: AlertTriangle,
      color: 'orange',
      format: 'percent',
    },
    {
      title: 'Routing Overhead',
      value: metrics.routingOverhead,
      icon: Activity,
      color: 'cyan',
      format: 'percent',
    },
    {
      title: 'Average Energy',
      value: metrics.averageEnergy,
      icon: Battery,
      color: 'green',
      format: 'percent',
    },
    {
      title: 'Dead Nodes',
      value: metrics.deadNodes,
      icon: AlertTriangle,
      color: 'red',
      format: 'number',
    },
    {
      title: 'Active Routes',
      value: metrics.activeRoutes,
      icon: Network,
      color: 'blue',
      format: 'number',
    },
  ];

  const syncCards = syncStats ? [
    {
      title: 'Sync Count',
      value: syncStats.syncCount,
      icon: RefreshCw,
      color: 'cyan',
      format: 'number',
    },
    {
      title: 'Sync Threshold',
      value: syncStats.dynamicThreshold * 100,
      icon: Activity,
      color: 'purple',
      format: 'percent',
    },
  ] : [];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      red: 'from-red-500 to-red-600',
      yellow: 'from-yellow-500 to-yellow-600',
      purple: 'from-purple-500 to-purple-600',
      orange: 'from-orange-500 to-orange-600',
      cyan: 'from-cyan-500 to-cyan-600',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const formatValue = (value: number, format: string): string => {
    if (typeof value !== 'number' || isNaN(value)) {
      return '0';
    }
    switch (format) {
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'ms':
        return `${value.toFixed(2)} ms`;
      case 'pps':
        return `${value.toFixed(2)} pps`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="metrics-dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {metricsCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${getColorClasses(card.color)}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {card.title}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatValue(card.value, card.format)}
              </div>
            </div>
          );
        })}
      </div>
      {syncStats && syncCards.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {syncCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={`sync-${index}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${getColorClasses(card.color)}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {card.title}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatValue(card.value, card.format)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
