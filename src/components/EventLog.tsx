import React, { useState, useEffect } from 'react';
import type { NetworkEvent } from '../types/network';
import { ScrollText, Filter, Clock } from 'lucide-react';

interface EventLogProps {
  events: NetworkEvent[];
  maxEvents?: number;
}

export const EventLog: React.FC<EventLogProps> = ({ events, maxEvents = 100 }) => {
  const [filter, setFilter] = useState<string>('all');
  const [filteredEvents, setFilteredEvents] = useState<NetworkEvent[]>([]);

  useEffect(() => {
    let filtered = events;
    
    if (filter !== 'all') {
      filtered = events.filter(event => event.type === filter);
    }

    setFilteredEvents(filtered.slice(-maxEvents));
  }, [events, filter, maxEvents]);

  const eventTypes = [
    { value: 'all', label: 'All Events' },
    { value: 'node_added', label: 'Node Added' },
    { value: 'node_removed', label: 'Node Removed' },
    { value: 'link_created', label: 'Link Created' },
    { value: 'link_broken', label: 'Link Broken' },
    { value: 'packet_sent', label: 'Packet Sent' },
    { value: 'packet_received', label: 'Packet Received' },
    { value: 'packet_dropped', label: 'Packet Dropped' },
    { value: 'route_discovered', label: 'Route Discovered' },
    { value: 'node_failure', label: 'Node Failure' },
  ];

  const getEventColor = (type: string): string => {
    const colors: Record<string, string> = {
      node_added: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      node_removed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      link_created: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      link_broken: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      packet_sent: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      packet_received: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      packet_dropped: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      route_discovered: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      node_failure: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const formatTimestamp = (timestamp: number): string => {
    const seconds = Math.floor(timestamp / 1000);
    const ms = timestamp % 1000;
    return `${seconds}.${ms.toString().padStart(3, '0')}s`;
  };

  return (
    <div className="event-log bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-gray-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Event Log
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
          >
            {eventTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No events to display
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getEventColor(
                      event.type
                    )}`}
                  >
                    {event.type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(event.timestamp)}
                  </div>
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  <span className="font-medium">Source:</span> {event.source}
                  {event.destination && (
                    <span className="ml-2">
                      <span className="font-medium">Destination:</span> {event.destination}
                    </span>
                  )}
                </div>
                {event.details && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        Showing {filteredEvents.length} of {events.length} events
      </div>
    </div>
  );
};
