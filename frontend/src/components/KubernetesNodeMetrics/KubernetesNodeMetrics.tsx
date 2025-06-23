import React, { useState, useEffect } from 'react';
import { ArrowLeft, Server, Cpu, HardDrive, Network, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import './KubernetesNodeMetrics.css';

interface NodeMetric {
  nodeName: string;
  cpuUsage: number;
  memoryUtilization: number;
  networkIORate: number;
  filesystemUtilization: number;
  networkErrors: number;
  podCount: number;
  containerCount: number;
  status: 'healthy' | 'unhealthy';
}

interface NetworkStats {
  timestamp: string;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

const KubernetesNodeMetrics: React.FC = () => {
  const { dispatch } = useApp();
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetric[]>([]);
  const [networkHistory, setNetworkHistory] = useState<NetworkStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');

  const handleBackToDashboard = () => {
    dispatch({ type: 'ROUTE_CHANGE', payload: 'dashboard' });
  };

  useEffect(() => {
    fetchNodeMetrics();
    const interval = setInterval(fetchNodeMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const fetchNodeMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/platform/k8s/nodes/enhanced?range=${selectedTimeRange}`);
      if (!response.ok) throw new Error('Failed to fetch node metrics');
      
      const data = await response.json();
      setNodeMetrics(data.nodes || []);
      setNetworkHistory(data.networkHistory || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const unhealthyNodes = nodeMetrics.filter(node => node.status === 'unhealthy');
  const totalPods = nodeMetrics.reduce((sum, node) => sum + node.podCount, 0);
  const totalContainers = nodeMetrics.reduce((sum, node) => sum + node.containerCount, 0);

  if (loading) {
    return (
      <div className="k8s-node-metrics">
        <div className="loading-spinner">Loading node metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="k8s-node-metrics">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="k8s-node-metrics">
      <div className="page-header">
        <div className="header-left">
          <button 
            className="back-button"
            onClick={handleBackToDashboard}
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="header-title">
            <h1>
              <Server size={24} />
              Kubernetes Node Metrics
            </h1>
            <p>Monitor node resources, health, and performance metrics</p>
          </div>
        </div>
        <div className="header-controls">
          <button 
            className="refresh-button"
            onClick={fetchNodeMetrics}
            disabled={loading}
            title="Refresh metrics"
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
          <select 
            className="time-range-selector"
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value)}
          >
            <option value="15m">15 minutes</option>
            <option value="1h">1 hour</option>
            <option value="6h">6 hours</option>
            <option value="24h">24 hours</option>
          </select>
        </div>
      </div>

      <div className="metrics-grid">
        {/* Node CPU Usage */}
        <div className="overview-card card-blue">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <Cpu size={20} />
              </div>
              <div className="card-trend">
                <div className="trend-indicator positive">
                  <CheckCircle size={12} />
                  <span>{(nodeMetrics.reduce((sum, node) => sum + node.cpuUsage, 0) / nodeMetrics.length || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Node CPU Usage</div>
              <div className="card-subtitle">Average CPU utilization across all nodes</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {nodeMetrics.map((node, index) => (
                  <div key={node.nodeName} className="node-bar">
                    <div className="node-label">{node.nodeName}</div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill cpu"
                        style={{ width: `${node.cpuUsage}%` }}
                      ></div>
                    </div>
                    <span className="value">{node.cpuUsage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Node Memory Utilization */}
        <div className="overview-card card-green">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <HardDrive size={20} />
              </div>
              <div className="card-trend">
                <div className="trend-indicator positive">
                  <CheckCircle size={12} />
                  <span>{(nodeMetrics.reduce((sum, node) => sum + node.memoryUtilization, 0) / nodeMetrics.length || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Node Memory Utilization</div>
              <div className="card-subtitle">Average memory usage across all nodes</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {nodeMetrics.map((node) => (
                  <div key={node.nodeName} className="node-bar">
                    <div className="node-label">{node.nodeName}</div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill memory"
                        style={{ width: `${node.memoryUtilization}%` }}
                      ></div>
                    </div>
                    <span className="value">{node.memoryUtilization.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Node Network IO Rates */}
        <div className="overview-card card-purple">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <Network size={20} />
              </div>
              <div className="card-trend">
                <div className="trend-indicator positive">
                  <CheckCircle size={12} />
                  <span>{(nodeMetrics.reduce((sum, node) => sum + node.networkIORate, 0) / 1024 / 1024).toFixed(1)} MB/s</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Node Network IO Rates</div>
              <div className="card-subtitle">Network throughput across cluster nodes</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {nodeMetrics.map((node) => (
                  <div key={node.nodeName} className="network-item">
                    <div className="node-label">{node.nodeName}</div>
                    <div className="network-stats">
                      <div className="io-stat">
                        <span className="label">I/O Rate:</span>
                        <span className="value">{(node.networkIORate / 1024 / 1024).toFixed(2)} MB/s</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Unhealthy Nodes */}
        <div className="overview-card card-red">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <AlertTriangle size={20} />
              </div>
              <div className="card-trend">
                <div className={`trend-indicator ${unhealthyNodes.length > 0 ? 'negative' : 'positive'}`}>
                  {unhealthyNodes.length > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <span>{unhealthyNodes.length}</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Unhealthy Nodes</div>
              <div className="card-subtitle">Cluster nodes with health issues</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {unhealthyNodes.length === 0 ? (
                  <div className="no-issues">All nodes are healthy</div>
                ) : (
                  unhealthyNodes.map((node) => (
                    <div key={node.nodeName} className="unhealthy-item">
                      <span className="node-name">{node.nodeName}</span>
                      <span className="status-badge unhealthy">Unhealthy</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Node Filesystem Utilization */}
        <div className="overview-card card-orange">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <HardDrive size={20} />
              </div>
              <div className="card-trend">
                <div className="trend-indicator positive">
                  <CheckCircle size={12} />
                  <span>{(nodeMetrics.reduce((sum, node) => sum + node.filesystemUtilization, 0) / nodeMetrics.length || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Node Filesystem Utilization</div>
              <div className="card-subtitle">Storage usage across cluster nodes</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {nodeMetrics.map((node) => (
                  <div key={node.nodeName} className="node-bar">
                    <div className="node-label">{node.nodeName}</div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill filesystem"
                        style={{ width: `${node.filesystemUtilization}%` }}
                      ></div>
                    </div>
                    <span className="value">{node.filesystemUtilization.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Node Network Errors */}
        <div className="overview-card card-blue">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <AlertTriangle size={20} />
              </div>
              <div className="card-trend">
                <div className={`trend-indicator ${nodeMetrics.reduce((sum, node) => sum + node.networkErrors, 0) > 0 ? 'negative' : 'positive'}`}>
                  {nodeMetrics.reduce((sum, node) => sum + node.networkErrors, 0) > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <span>{nodeMetrics.reduce((sum, node) => sum + node.networkErrors, 0)}</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Node Network Errors</div>
              <div className="card-subtitle">Network errors across cluster nodes</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {nodeMetrics.map((node) => (
                  <div key={node.nodeName} className="error-item">
                    <div className="node-label">{node.nodeName}</div>
                    <div className="error-count">
                      <span className={`value ${node.networkErrors > 0 ? 'warning' : 'healthy'}`}>
                        {node.networkErrors} errors
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pods and Containers Per Node */}
        <div className="overview-card card-indigo">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <Server size={20} />
              </div>
              <div className="card-trend">
                <div className="trend-indicator positive">
                  <CheckCircle size={12} />
                  <span>{totalPods} pods / {totalContainers} containers</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Pods and Containers Per Node</div>
              <div className="card-subtitle">Pod and container distribution</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {nodeMetrics.map((node) => (
                  <div key={node.nodeName} className="pod-container-item">
                    <div className="node-label">{node.nodeName}</div>
                    <div className="counts">
                      <div className="count-item">
                        <span className="label">Pods:</span>
                        <span className="value">{node.podCount}</span>
                      </div>
                      <div className="count-item">
                        <span className="label">Containers:</span>
                        <span className="value">{node.containerCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>
      </div>
    </div>
  );
};

export default KubernetesNodeMetrics;