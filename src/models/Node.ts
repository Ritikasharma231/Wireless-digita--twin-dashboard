import type { Node, Position, MobilityPattern, RoutingTableEntry, BufferState, LinkDiagnosticValues } from '../types/network';
import { getSeededRandom, isSeeded } from '../utils/seededRandom';

export class NetworkNode implements Node {
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
  packetQueue: any[];
  congestionLevel: 'low' | 'medium' | 'high';

  // Internal state for mobility models
  private previousDirection?: Position;
  private targetPosition?: Position;
  private isPaused: boolean = false;
  private pauseStartTime: number = 0;

  constructor(config: Partial<Node> & { id: string }) {
    this.id = config.id;
    this.position = config.position || { x: 0, y: 0 };
    this.energy = config.energy || 100;
    this.maxEnergy = config.maxEnergy || 100;
    this.transmissionPower = config.transmissionPower || 20; // dBm
    this.receptionSensitivity = config.receptionSensitivity || -90; // dBm
    this.isGateway = config.isGateway || false;
    this.isActive = config.isActive !== false;
    this.neighbors = config.neighbors || [];
    this.routingTable = config.routingTable || [];
    this.sequenceNumber = config.sequenceNumber || 0;
    this.lastHopCount = config.lastHopCount || 0;
    this.broadcastId = config.broadcastId || 0;
    this.packetsSent = config.packetsSent || 0;
    this.packetsReceived = config.packetsReceived || 0;
    this.packetsForwarded = config.packetsForwarded || 0;
    this.mobilityPattern = config.mobilityPattern;
    
    // Initialize RL features
    this.bufferState = config.bufferState || {
      occupancy: 0,
      capacity: 50,
      dropRate: 0,
      averageQueueDelay: 0,
    };
    this.ldv = config.ldv || {
      snr: 0,
      ber: 0,
      per: 0,
      lqi: 255,
      channelUtilization: 0,
    };
    this.packetQueue = [];
    this.congestionLevel = 'low';
  }

  consumeEnergy(amount: number): void {
    this.energy = Math.max(0, this.energy - amount);
    if (this.energy <= 0) {
      this.isActive = false;
    }
  }

  updatePosition(deltaTime: number): void {
    if (!this.mobilityPattern || this.mobilityPattern.type === 'static') {
      return;
    }

    const speed = this.mobilityPattern.speed * deltaTime;

    switch (this.mobilityPattern.type) {
      case 'random':
        if (isSeeded()) {
          const rng = getSeededRandom();
          this.position.x += (rng.next() - 0.5) * speed * 2;
          this.position.y += (rng.next() - 0.5) * speed * 2;
        } else {
          this.position.x += (Math.random() - 0.5) * speed * 2;
          this.position.y += (Math.random() - 0.5) * speed * 2;
        }
        break;
      case 'linear':
        if (this.mobilityPattern.direction) {
          this.position.x += this.mobilityPattern.direction.x * speed;
          this.position.y += this.mobilityPattern.direction.y * speed;
        }
        break;
      case 'circular':
        if (this.mobilityPattern.center && this.mobilityPattern.radius) {
          const angle = (Date.now() / 1000) * speed;
          this.position.x = this.mobilityPattern.center.x + 
            this.mobilityPattern.radius * Math.cos(angle);
          this.position.y = this.mobilityPattern.center.y + 
            this.mobilityPattern.radius * Math.sin(angle);
        }
        break;
      case 'gauss-markov':
        this.updateGaussMarkovPosition(speed);
        break;
      case 'random-waypoint':
        this.updateRandomWaypointPosition(deltaTime);
        break;
    }
  }

  private updateGaussMarkovPosition(speed: number): void {
    const alpha = this.mobilityPattern?.alpha || 0.75; // Default temporal correlation
    const rng = isSeeded() ? getSeededRandom() : null;
    
    // Initialize previous direction if not set
    if (!this.previousDirection) {
      const randX = rng ? rng.next() : Math.random();
      const randY = rng ? rng.next() : Math.random();
      this.previousDirection = {
        x: (randX - 0.5) * 2,
        y: (randY - 0.5) * 2,
      };
    }

    // Generate random direction component
    const randX = rng ? rng.next() : Math.random();
    const randY = rng ? rng.next() : Math.random();
    const randomDirection = {
      x: (randX - 0.5) * 2,
      y: (randY - 0.5) * 2,
    };

    // Apply Gauss-Markov formula: newDirection = α * oldDirection + (1-α) * randomDirection
    const newDirection = {
      x: alpha * this.previousDirection.x + (1 - alpha) * randomDirection.x,
      y: alpha * this.previousDirection.y + (1 - alpha) * randomDirection.y,
    };

    // Normalize direction
    const magnitude = Math.sqrt(newDirection.x ** 2 + newDirection.y ** 2);
    if (magnitude > 0) {
      newDirection.x /= magnitude;
      newDirection.y /= magnitude;
    }

    // Update position
    this.position.x += newDirection.x * speed;
    this.position.y += newDirection.y * speed;

    // Store for next iteration
    this.previousDirection = newDirection;

    // Clamp to bounds if specified
    if (this.mobilityPattern?.bounds) {
      const { minX, maxX, minY, maxY } = this.mobilityPattern.bounds;
      this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
      this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
    }
  }

  private updateRandomWaypointPosition(deltaTime: number): void {
    const pauseTime = this.mobilityPattern?.pauseTime || 1000; // Default 1 second pause
    const bounds = this.mobilityPattern?.bounds || { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
    const speed = this.mobilityPattern?.speed || 1;

    // Check if paused
    if (this.isPaused) {
      const now = Date.now();
      if (now - this.pauseStartTime >= pauseTime) {
        this.isPaused = false;
      } else {
        return; // Still paused
      }
    }

    // Initialize target if not set
    if (!this.targetPosition) {
      this.targetPosition = this.generateRandomWaypoint(bounds);
    }

    // Calculate distance to target
    const dx = this.targetPosition.x - this.position.x;
    const dy = this.targetPosition.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Move towards target
    if (distance > 0) {
      const moveDistance = speed * deltaTime;
      
      if (moveDistance >= distance) {
        // Reached target
        this.position.x = this.targetPosition.x;
        this.position.y = this.targetPosition.y;
        
        // Pause at waypoint
        this.isPaused = true;
        this.pauseStartTime = Date.now();
        this.targetPosition = undefined;
      } else {
        // Move towards target
        this.position.x += (dx / distance) * moveDistance;
        this.position.y += (dy / distance) * moveDistance;
      }
    }
  }

  private generateRandomWaypoint(bounds: { minX: number; maxX: number; minY: number; maxY: number }): Position {
    const rng = isSeeded() ? getSeededRandom() : null;
    const randX = rng ? rng.next() : Math.random();
    const randY = rng ? rng.next() : Math.random();
    
    return {
      x: bounds.minX + randX * (bounds.maxX - bounds.minX),
      y: bounds.minY + randY * (bounds.maxY - bounds.minY),
    };
  }

  addRoutingEntry(entry: RoutingTableEntry): void {
    const existingIndex = this.routingTable.findIndex(
      e => e.destination === entry.destination
    );

    if (existingIndex >= 0) {
      const existing = this.routingTable[existingIndex];
      if (entry.sequenceNumber > existing.sequenceNumber ||
          (entry.sequenceNumber === existing.sequenceNumber && entry.hopCount < existing.hopCount)) {
        this.routingTable[existingIndex] = entry;
      }
    } else {
      this.routingTable.push(entry);
    }
  }

  getRoutingEntry(destination: string): RoutingTableEntry | undefined {
    return this.routingTable.find(e => e.destination === destination && e.isValid);
  }

  incrementSequenceNumber(): number {
    this.sequenceNumber++;
    return this.sequenceNumber;
  }

  incrementBroadcastId(): number {
    this.broadcastId++;
    return this.broadcastId;
  }

  getEnergyPercentage(): number {
    return (this.energy / this.maxEnergy) * 100;
  }

  isDead(): boolean {
    return this.energy <= 0;
  }

  toJSON(): Node {
    return {
      id: this.id,
      position: this.position,
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      transmissionPower: this.transmissionPower,
      receptionSensitivity: this.receptionSensitivity,
      isGateway: this.isGateway,
      isActive: this.isActive,
      neighbors: this.neighbors,
      routingTable: this.routingTable,
      sequenceNumber: this.sequenceNumber,
      lastHopCount: this.lastHopCount,
      broadcastId: this.broadcastId,
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived,
      packetsForwarded: this.packetsForwarded,
      mobilityPattern: this.mobilityPattern,
      bufferState: this.bufferState,
      ldv: this.ldv,
      packetQueue: this.packetQueue,
      congestionLevel: this.congestionLevel,
    };
  }

  // RL-Enhanced methods
  enqueuePacket(packet: any): boolean {
    if (this.bufferState.occupancy >= this.bufferState.capacity) {
      this.bufferState.dropRate++;
      return false;
    }
    this.packetQueue.push({
      ...packet,
      queueTime: Date.now(),
    });
    this.bufferState.occupancy++;
    this.updateCongestionLevel();
    return true;
  }

  dequeuePacket(): any | null {
    if (this.packetQueue.length === 0) {
      return null;
    }
    const packet = this.packetQueue.shift();
    this.bufferState.occupancy--;
    
    // Calculate queue delay
    if (packet) {
      const queueDelay = Date.now() - packet.queueTime;
      this.bufferState.averageQueueDelay = 
        (this.bufferState.averageQueueDelay * 0.9) + (queueDelay * 0.1);
    }
    
    this.updateCongestionLevel();
    return packet;
  }

  updateCongestionLevel(): void {
    const utilization = this.bufferState.occupancy / this.bufferState.capacity;
    if (utilization > 0.8) {
      this.congestionLevel = 'high';
    } else if (utilization > 0.5) {
      this.congestionLevel = 'medium';
    } else {
      this.congestionLevel = 'low';
    }
  }

  updateLDV(rssi: number, noiseFloor: number = -95): void {
    // Calculate SNR
    this.ldv.snr = rssi - noiseFloor;
    
    // Calculate BER based on SNR (simplified model)
    this.ldv.ber = Math.exp(-this.ldv.snr / 10);
    
    // Calculate PER from BER (assuming 128-byte packets)
    this.ldv.per = 1 - Math.pow(1 - this.ldv.ber, 128 * 8);
    
    // Calculate LQI (0-255, inverse of PER)
    this.ldv.lqi = Math.floor(255 * (1 - this.ldv.per));
    
    // Calculate channel utilization
    this.ldv.channelUtilization = this.bufferState.occupancy / this.bufferState.capacity;
  }

  getNormalizedEnergy(): number {
    return this.energy / this.maxEnergy;
  }

  getNormalizedBuffer(): number {
    return this.bufferState.occupancy / this.bufferState.capacity;
  }

  static fromJSON(json: Node): NetworkNode {
    return new NetworkNode(json);
  }
}
