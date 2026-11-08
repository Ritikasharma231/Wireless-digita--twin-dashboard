import React, { useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { NetworkTopology as NetworkTopologyType, Node as NodeType } from '../types/network';

interface NetworkTopologyProps {
  topology: NetworkTopologyType;
  onNodeClick?: (node: NodeType) => void;
  onLinkClick?: (link: any) => void;
  width?: number;
  height?: number;
}

export const NetworkTopologyComponent: React.FC<NetworkTopologyProps> = ({
  topology,
  onNodeClick,
  onLinkClick,
  width = 800,
  height = 600,
}) => {
  const graphRef = useRef<any>(null);

  const nodes = Array.from(topology.nodes.values()).map(node => ({
    id: node.id,
    ...node.position,
    energy: node.energy,
    maxEnergy: node.maxEnergy,
    isGateway: node.isGateway,
    isActive: node.isActive,
    neighbors: node.neighbors.length,
  }));

  const links = Array.from(topology.links.values()).map(link => ({
    source: link.source,
    target: link.target,
    rssi: link.rssi,
    distance: link.distance,
    reliability: link.reliability,
  }));

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge').strength(-200);
      graphRef.current.d3Force('link').distance(100);
    }
  }, []);

  const getNodeColor = (node: any): string => {
    if (!node.isActive) return '#6b7280';
    if (node.isGateway) return '#10b981';
    const energyRatio = node.energy / node.maxEnergy;
    if (energyRatio > 0.7) return '#3b82f6';
    if (energyRatio > 0.4) return '#f59e0b';
    return '#ef4444';
  };

  const getNodeSize = (node: any): number => {
    if (node.isGateway) return 20;
    return 10 + (node.neighbors * 0.5);
  };

  const getLinkColor = (link: any): string => {
    const reliability = link.reliability;
    if (reliability > 0.8) return '#10b981';
    if (reliability > 0.5) return '#f59e0b';
    return '#ef4444';
  };

  const getLinkWidth = (link: any): number => {
    return 1 + (link.reliability * 2);
  };

  return (
    <div className="network-topology">
      <ForceGraph2D
        ref={graphRef}
        graphData={{ nodes, links }}
        width={width}
        height={height}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const size = getNodeSize(node) / globalScale;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
          ctx.fillStyle = getNodeColor(node);
          ctx.fill();
          
          // Draw node border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();

          // Draw gateway indicator
          if (node.isGateway) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size * 0.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }

          // Draw node label
          if (globalScale > 1.5) {
            ctx.font = `${12 / globalScale}px Arial`;
            ctx.fillStyle = '#1f2937';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.id, node.x, node.y + size + 12 / globalScale);
          }
        }}
        linkCanvasObject={(link, ctx, globalScale) => {
          const width = getLinkWidth(link) / globalScale;
          ctx.beginPath();
          const source = link.source as any;
          const target = link.target as any;
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = getLinkColor(link);
          ctx.lineWidth = width;
          ctx.stroke();
        }}
        onNodeClick={(node) => {
          const nodeData = topology.nodes.get(node.id);
          if (nodeData && onNodeClick) {
            onNodeClick(nodeData);
          }
        }}
        onLinkClick={(link) => {
          if (onLinkClick) {
            onLinkClick(link);
          }
        }}
        nodeLabel="id"
        linkLabel={(link) => `RSSI: ${link.rssi.toFixed(1)} dBm`}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.1}
      />
    </div>
  );
};

export default NetworkTopologyComponent;
