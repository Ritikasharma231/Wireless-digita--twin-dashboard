import React, { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Database } from 'lucide-react';
import { DataExporter } from '../utils/export';
import type { NetworkTopology, NetworkMetrics, NetworkEvent } from '../types/network';

interface ExportPanelProps {
  topology: NetworkTopology;
  metrics: NetworkMetrics;
  events: NetworkEvent[];
  metricsHistory?: NetworkMetrics[];
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  topology,
  metrics,
  events,
  metricsHistory = [],
}) => {
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const handleExportTopology = () => {
    DataExporter.exportTopology(topology, exportFormat);
  };

  const handleExportMetrics = () => {
    DataExporter.exportMetrics(metrics, exportFormat);
  };

  const handleExportEvents = () => {
    DataExporter.exportEvents(events, exportFormat);
  };

  const handleExportMetricsHistory = () => {
    if (metricsHistory.length > 0) {
      DataExporter.exportMetricsHistory(metricsHistory);
    }
  };

  return (
    <div className="export-panel bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <Download className="w-5 h-5 text-blue-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Data Export
        </h2>
      </div>

      <div className="space-y-4">
        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Export Format
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setExportFormat('json')}
              className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                exportFormat === 'json'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <FileJson className="w-4 h-4" />
              JSON
            </button>
            <button
              onClick={() => setExportFormat('csv')}
              className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                exportFormat === 'csv'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {/* Export Options */}
        <div className="space-y-3">
          <button
            onClick={handleExportTopology}
            className="w-full px-4 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center gap-2 font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Network Topology
          </button>

          <button
            onClick={handleExportMetrics}
            className="w-full px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center gap-2 font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Network Metrics
          </button>

          <button
            onClick={handleExportEvents}
            className="w-full px-4 py-3 rounded-lg bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center gap-2 font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Event Log
          </button>

          {metricsHistory.length > 0 && (
            <button
              onClick={handleExportMetricsHistory}
              className="w-full px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Database className="w-4 h-4" />
              Export Metrics Time Series ({metricsHistory.length} samples)
            </button>
          )}
        </div>

        {/* Info */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <strong>JSON:</strong> Best for programmatic processing and preserving all data structure
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            <strong>CSV:</strong> Best for spreadsheet analysis and plotting tools
          </p>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {topology.nodes.size}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Nodes</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {topology.links.size}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Links</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {events.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Events</div>
          </div>
        </div>
      </div>
    </div>
  );
};
