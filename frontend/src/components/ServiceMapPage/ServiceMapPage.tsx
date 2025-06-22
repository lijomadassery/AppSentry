import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, ZoomIn, ZoomOut, Maximize, Download,
  Server, Database, Globe, Cloud, HardDrive,
  AlertCircle, CheckCircle, Clock
} from 'lucide-react';
import './ServiceMapPage.css';

interface ServiceNode {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'cache' | 'external';
  status: 'healthy' | 'warning' | 'error';
  metrics: {
    requestRate: number;
    errorRate: number;
    avgLatency: number;
  };
  x?: number;
  y?: number;
}

interface ServiceEdge {
  source: string;
  target: string;
  requestRate: number;
  errorRate: number;
  avgLatency: number;
}

interface ServiceMapData {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
}

const ServiceMapPage: React.FC = () => {
  const [mapData, setMapData] = useState<ServiceMapData>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<ServiceNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ServiceEdge | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Generate mock service map data
  const generateMockData = (): ServiceMapData => {
    const nodes: ServiceNode[] = [
      {
        id: 'frontend',
        name: 'AppSentry Frontend',
        type: 'frontend',
        status: 'healthy',
        metrics: {
          requestRate: 1250,
          errorRate: 0.5,
          avgLatency: 45,
        },
        x: 200,
        y: 200,
      },
      {
        id: 'backend',
        name: 'AppSentry Backend',
        type: 'backend',
        status: 'healthy',
        metrics: {
          requestRate: 2500,
          errorRate: 1.2,
          avgLatency: 120,
        },
        x: 500,
        y: 200,
      },
      {
        id: 'database',
        name: 'MySQL Database',
        type: 'database',
        status: 'warning',
        metrics: {
          requestRate: 3200,
          errorRate: 0.1,
          avgLatency: 25,
        },
        x: 800,
        y: 200,
      },
      {
        id: 'redis',
        name: 'Redis Cache',
        type: 'cache',
        status: 'healthy',
        metrics: {
          requestRate: 5000,
          errorRate: 0.01,
          avgLatency: 2,
        },
        x: 650,
        y: 350,
      },
      {
        id: 'auth-service',
        name: 'Auth Service',
        type: 'external',
        status: 'healthy',
        metrics: {
          requestRate: 500,
          errorRate: 0.2,
          avgLatency: 150,
        },
        x: 500,
        y: 50,
      },
      {
        id: 'monitoring',
        name: 'Monitoring Service',
        type: 'external',
        status: 'error',
        metrics: {
          requestRate: 100,
          errorRate: 15.5,
          avgLatency: 500,
        },
        x: 350,
        y: 350,
      },
    ];

    const edges: ServiceEdge[] = [
      {
        source: 'frontend',
        target: 'backend',
        requestRate: 1250,
        errorRate: 0.5,
        avgLatency: 120,
      },
      {
        source: 'backend',
        target: 'database',
        requestRate: 2000,
        errorRate: 0.1,
        avgLatency: 25,
      },
      {
        source: 'backend',
        target: 'redis',
        requestRate: 3000,
        errorRate: 0.01,
        avgLatency: 2,
      },
      {
        source: 'backend',
        target: 'auth-service',
        requestRate: 500,
        errorRate: 0.2,
        avgLatency: 150,
      },
      {
        source: 'backend',
        target: 'monitoring',
        requestRate: 100,
        errorRate: 15.5,
        avgLatency: 500,
      },
    ];

    return { nodes, edges };
  };

  // Load service map data
  const loadServiceMap = async () => {
    setLoading(true);
    
    // Mock data - in production, fetch from backend
    setTimeout(() => {
      setMapData(generateMockData());
      setLoading(false);
    }, 1000);
  };

  useEffect(() => {
    loadServiceMap();
  }, []);

  // Get node icon based on type
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'frontend':
        return <Globe size={24} />;
      case 'backend':
        return <Server size={24} />;
      case 'database':
        return <Database size={24} />;
      case 'cache':
        return <HardDrive size={24} />;
      case 'external':
        return <Cloud size={24} />;
      default:
        return <Server size={24} />;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={16} className="status-healthy" />;
      case 'warning':
        return <Clock size={16} className="status-warning" />;
      case 'error':
        return <AlertCircle size={16} className="status-error" />;
      default:
        return null;
    }
  };

  // Get node color based on status
  const getNodeColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  // Get edge color based on error rate
  const getEdgeColor = (errorRate: number) => {
    if (errorRate > 10) return '#ef4444';
    if (errorRate > 5) return '#f59e0b';
    return '#10b981';
  };

  // Handle zoom
  const handleZoomIn = () => setZoom(Math.min(zoom + 0.2, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.2, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Handle pan
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Export as SVG
  const exportSVG = () => {
    if (svgRef.current) {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `service-map-${new Date().toISOString()}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="service-map-page">
      <div className="service-map-header">
        <h1>Service Map</h1>
        <div className="service-map-controls">
          <button className="zoom-btn" onClick={handleZoomOut}>
            <ZoomOut size={16} />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={handleZoomIn}>
            <ZoomIn size={16} />
          </button>
          <button className="reset-zoom-btn" onClick={handleResetZoom}>
            <Maximize size={16} />
            Reset
          </button>
          <button className="refresh-btn" onClick={loadServiceMap} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
          <button className="export-btn" onClick={exportSVG}>
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="service-map-container">
        <div 
          className="service-map-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox="0 0 1000 600"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#6b7280"
                />
              </marker>
            </defs>

            {/* Render edges */}
            {mapData.edges.map((edge, index) => {
              const sourceNode = mapData.nodes.find(n => n.id === edge.source);
              const targetNode = mapData.nodes.find(n => n.id === edge.target);
              
              if (!sourceNode || !targetNode) return null;

              const edgeColor = getEdgeColor(edge.errorRate);
              const isSelected = selectedEdge?.source === edge.source && selectedEdge?.target === edge.target;

              return (
                <g key={index}>
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={edgeColor}
                    strokeWidth={isSelected ? 4 : 2}
                    markerEnd="url(#arrowhead)"
                    opacity={0.7}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedEdge(edge)}
                  />
                  <text
                    x={(sourceNode.x! + targetNode.x!) / 2}
                    y={(sourceNode.y! + targetNode.y!) / 2 - 10}
                    textAnchor="middle"
                    fill="var(--text-secondary)"
                    fontSize="12"
                  >
                    {edge.requestRate} req/s
                  </text>
                </g>
              );
            })}

            {/* Render nodes */}
            {mapData.nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const nodeColor = getNodeColor(node.status);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedNode(node)}
                >
                  <circle
                    r={isSelected ? 45 : 40}
                    fill="var(--surface-primary)"
                    stroke={nodeColor}
                    strokeWidth={isSelected ? 4 : 3}
                  />
                  <g transform="translate(-12, -12)">
                    {React.cloneElement(getNodeIcon(node.type), {
                      color: nodeColor,
                    })}
                  </g>
                  <text
                    y={60}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="14"
                    fontWeight="500"
                  >
                    {node.name}
                  </text>
                  <g transform="translate(25, -25)">
                    {getStatusIcon(node.status)}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="service-map-sidebar">
          {selectedNode && (
            <div className="service-details">
              <h3>Service Details</h3>
              <div className="service-info">
                <div className="info-row">
                  <span className="info-label">Name:</span>
                  <span className="info-value">{selectedNode.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Type:</span>
                  <span className="info-value">{selectedNode.type}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Status:</span>
                  <span className={`info-value status-${selectedNode.status}`}>
                    {selectedNode.status}
                  </span>
                </div>
              </div>

              <h4>Metrics</h4>
              <div className="service-metrics">
                <div className="metric-item">
                  <span className="metric-label">Request Rate</span>
                  <span className="metric-value">{selectedNode.metrics.requestRate} req/s</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Error Rate</span>
                  <span className="metric-value error">{selectedNode.metrics.errorRate}%</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Avg Latency</span>
                  <span className="metric-value">{selectedNode.metrics.avgLatency}ms</span>
                </div>
              </div>
            </div>
          )}

          {selectedEdge && (
            <div className="edge-details">
              <h3>Connection Details</h3>
              <div className="edge-info">
                <div className="info-row">
                  <span className="info-label">From:</span>
                  <span className="info-value">{selectedEdge.source}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">To:</span>
                  <span className="info-value">{selectedEdge.target}</span>
                </div>
              </div>

              <h4>Traffic Metrics</h4>
              <div className="service-metrics">
                <div className="metric-item">
                  <span className="metric-label">Request Rate</span>
                  <span className="metric-value">{selectedEdge.requestRate} req/s</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Error Rate</span>
                  <span className="metric-value error">{selectedEdge.errorRate}%</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Avg Latency</span>
                  <span className="metric-value">{selectedEdge.avgLatency}ms</span>
                </div>
              </div>
            </div>
          )}

          {!selectedNode && !selectedEdge && (
            <div className="sidebar-placeholder">
              <p>Click on a service or connection to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceMapPage;