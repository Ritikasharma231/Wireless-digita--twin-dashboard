export interface Position {
  x: number;
  y: number;
  z?: number;
}

export interface Node {
  id: string;
  position: Position;
  energy: number;
  maxEnergy: number;
  transmissionPower: number;
  receptionSensitivity: number;
  isGateway: boolean;
  isActive: boolean;
  neighbors: string[];
  routingTable: RoutingTableEntry[];
  sequenceNumber: number;
  lastHopCount: number;
  broadcastId: number;
  packetsSent: number;
  packetsReceived: number;
  packetsForwarded: number;
  mobilityPattern?: MobilityPattern;
  // RL-Enhanced features
  bufferState: BufferState;
  ldv: LinkDiagnosticValues;
  packetQueue: Packet[];
  congestionLevel: 'low' | 'medium' | 'high';
}

export interface BufferState {
  occupancy: number; // Current packets in buffer
  capacity: number; // Maximum buffer size
  dropRate: number; // Packets dropped per second
  averageQueueDelay: number; // Average time in queue (ms)
}

export interface LinkDiagnosticValues {
  snr: number; // Signal-to-Noise Ratio (dB)
  ber: number; // Bit Error Rate
  per: number; // Packet Error Rate
  lqi: number; // Link Quality Indicator (0-255)
  channelUtilization: number; // Channel utilization (0-1)
}

export interface MobilityPattern {
  type: 'static' | 'random' | 'linear' | 'circular' | 'gauss-markov' | 'random-waypoint';
  speed: number;
  direction?: Position;
  radius?: number;
  center?: Position;
  alpha?: number; // Temporal correlation for Gauss-Markov (0-1)
  pauseTime?: number; // Pause time for Random Waypoint (ms)
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }; // Movement bounds
}

export interface RoutingTableEntry {
  destination: string;
  nextHop: string;
  hopCount: number;
  sequenceNumber: number;
  lifetime: number;
  isValid: boolean;
}

export interface Packet {
  id: string;
  source: string;
  destination: string;
  type: PacketType;
  payload: any;
  hopCount: number;
  maxHops: number;
  timestamp: number;
  path: string[];
  size: number;
}

export type PacketType = 
  | 'data' 
  | 'rreq' 
  | 'rrep' 
  | 'rerr' 
  | 'hello' 
  | 'route_discovery'
  | 'route_maintenance';

export interface NetworkMetrics {
  totalPackets: number;
  successfulPackets: number;
  failedPackets: number;
  averageLatency: number;
  throughput: number;
  packetLossRate: number;
  routingOverhead: number;
  networkLifetime: number;
  averageEnergy: number;
  deadNodes: number;
  activeRoutes: number;
}

export interface Link {
  source: string;
  target: string;
  rssi: number;
  distance: number;
  bandwidth: number;
  delay: number;
  reliability: number;
}

export interface NetworkTopology {
  nodes: Map<string, Node>;
  links: Map<string, Link>;
  metrics: NetworkMetrics;
  lastUpdated: number;
}

export interface DigitalTwinState {
  physicalTopology: NetworkTopology;
  virtualTopology: NetworkTopology;
  syncStatus: 'synced' | 'syncing' | 'desynced';
  lastSyncTime: number;
  predictionAccuracy: number;
  dynamicThreshold: number;
  syncCount: number;
}

export interface SimulationConfig {
  updateInterval: number;
  maxHops: number;
  routingProtocol: 'AODV' | 'DSR' | 'OLSR' | 'DRL';
  mobilityEnabled: boolean;
  energyDepletionEnabled: boolean;
  packetGenerationRate: number;
  signalPropagationModel: 'free-space' | 'two-ray' | 'shadowing' | 'rayleigh' | 'rician';
  shadowingVariance: number;
  // RL Configuration
  rlEnabled: boolean;
  rlMode: 'training' | 'inference';
  ricianKFactor?: number; // For Rician fading
  csiCalibrationEnabled: boolean; // Continuous CSI calibration
  eventTriggeredSync: boolean; // Event-triggered synchronization
  syncThreshold: number; // State deviation threshold for sync
}

// RL-specific types
export interface RLState {
  energyMatrix: number[][]; // Normalized energy per node
  lqiMatrix: number[][]; // Link Quality Indicator matrix
  bufferMatrix: number[][]; // Buffer occupancy matrix
  topologyAdjacency: number[][]; // Adjacency matrix
  congestionVector: number[]; // Congestion levels
}

export interface RLAction {
  nodeId: string;
  nextHop: string | null; // null = broadcast/drop
  transmissionPower: number; // dBm
  actionType: 'forward' | 'broadcast' | 'drop' | 'sleep';
}

export interface RLReward {
  timestamp: number;
  throughput: number;
  energyCost: number;
  delay: number;
  packetDeliveryRatio: number;
  totalReward: number;
  components: {
    throughputReward: number;
    energyPenalty: number;
    delayPenalty: number;
  };
}

export interface RLTrainingEpisode {
  episodeId: number;
  startTime: number;
  endTime: number;
  totalSteps: number;
  totalReward: number;
  averageReward: number;
  pdr: number;
  energyConsumption: number;
  averageLatency: number;
}

export interface NetworkEvent {
  id: string;
  timestamp: number;
  type: 'node_added' | 'node_removed' | 'link_created' | 'link_broken' | 'packet_sent' | 'packet_received' | 'packet_dropped' | 'route_discovered' | 'node_failure' | 'node_sleep' | 'packet_forwarded' | 'packet_broadcast';
  source: string;
  destination?: string;
  details: any;
}
