import React, { useState, useEffect } from 'react';
import { ArrowLeft, Activity, Server, HardDrive, AlertTriangle, CheckCircle, RefreshCw, Network } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import './KubernetesPodMetrics.css';

interface PodMetric {
  name: string;
  namespace: string;
  nodeName: string;
  status: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  cpuUsage: number;
  memoryUsage: number;
  cpuLimit: number;
  cpuRequest: number;
  memoryLimit: number;
  memoryRequest: number;
  networkIORate: number;
  filesystemUsage: number;
  restartCount: number;
  deployment?: string;
}

interface DeploymentStats {
  name: string;
  namespace: string;
  podCount: number;
  replicas: number;
  availableReplicas: number;
}

interface NodeStats {
  nodeName: string;
  podCount: number;
}

const KubernetesPodMetrics: React.FC = () => {
  const { dispatch } = useApp();
  const [podMetrics, setPodMetrics] = useState<PodMetric[]>([]);
  const [deploymentStats, setDeploymentStats] = useState<DeploymentStats[]>([]);
  const [nodeStats, setNodeStats] = useState<NodeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([]);
  
  // Individual card namespace filters
  const [cardNamespaces, setCardNamespaces] = useState({
    cpuUsage: 'all',
    memoryUsage: 'all',
    cpuVsLimit: 'all',
    cpuVsRequest: 'all',
    unhealthyPods: 'all',
    memoryVsRequest: 'all',
    networkIO: 'all',
    filesystem: 'all',
    podsPerNode: 'all',
    podsPerDeployment: 'all'
  });

  const handleBackToDashboard = () => {
    dispatch({ type: 'ROUTE_CHANGE', payload: 'dashboard' });
  };

  // Update available namespaces when pod metrics change
  useEffect(() => {
    if (podMetrics.length > 0) {
      const uniqueNamespaces = Array.from(new Set(podMetrics.map(pod => pod.namespace))).sort();
      setAvailableNamespaces(uniqueNamespaces);
    }
  }, [podMetrics]);

  useEffect(() => {
    fetchPodMetrics();
    const interval = setInterval(fetchPodMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedNamespace, selectedTimeRange]);

  const fetchPodMetrics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedNamespace !== 'all') params.append('namespace', selectedNamespace);
      params.append('range', selectedTimeRange);
      
      const response = await fetch(`/api/platform/k8s/pods/enhanced?${params}`);
      
      if (!response.ok) throw new Error('Failed to fetch pod metrics');
      
      const data = await response.json();
      setPodMetrics(data.pods || []);
      setDeploymentStats(data.deployments || []);
      setNodeStats(data.nodeStats || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Filter functions for individual cards
  const getFilteredPods = (cardType: string) => {
    const namespace = cardNamespaces[cardType as keyof typeof cardNamespaces];
    return namespace === 'all' 
      ? podMetrics 
      : podMetrics.filter(pod => pod.namespace === namespace);
  };

  const filteredPods = selectedNamespace === 'all' 
    ? podMetrics 
    : podMetrics.filter(pod => pod.namespace === selectedNamespace);

  // Handler for individual card namespace changes
  const handleCardNamespaceChange = (cardType: string, namespace: string) => {
    setCardNamespaces(prev => ({
      ...prev,
      [cardType]: namespace
    }));
  };

  // Namespace dropdown component for individual cards
  const CardNamespaceSelector: React.FC<{ cardType: string; label?: string }> = ({ cardType, label }) => (
    <div className="card-namespace-selector">
      <label>{label || 'Namespace:'}</label>
      <select 
        value={cardNamespaces[cardType as keyof typeof cardNamespaces]}
        onChange={(e) => handleCardNamespaceChange(cardType, e.target.value)}
        className="mini-namespace-selector"
      >
        <option value="all">All</option>
        {availableNamespaces.map(ns => (
          <option key={ns} value={ns}>{ns}</option>
        ))}
      </select>
    </div>
  );

  const getUnhealthyPods = (cardType: string) => {
    return getFilteredPods(cardType).filter(pod => 
      pod.status !== 'Running' && pod.status !== 'Succeeded'
    );
  };

  const calculateUtilizationVsLimit = (usage: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((usage / limit) * 100, 100);
  };

  const calculateUtilizationVsRequest = (usage: number, request: number) => {
    if (request === 0) return 0;
    return (usage / request) * 100;
  };

  if (loading) {
    return (
      <div className="k8s-pod-metrics">
        <div className="loading-spinner">Loading pod metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="k8s-pod-metrics">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="k8s-pod-metrics">
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
              <Activity size={24} />
              Kubernetes Pod Metrics
            </h1>
            <p>Monitor pod resources, performance, and utilization metrics</p>
          </div>
        </div>
        <div className="header-controls">
          <button 
            className="refresh-button"
            onClick={fetchPodMetrics}
            disabled={loading}
            title="Refresh metrics"
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
          <select 
            className="namespace-selector"
            value={selectedNamespace} 
            onChange={(e) => setSelectedNamespace(e.target.value)}
            title="Filter by namespace"
          >
            <option value="all">All Namespaces</option>
            {availableNamespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
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
        {/* Pod CPU Usage */}
        <div className="overview-card card-blue">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <Activity size={20} />
              </div>
              <div className="card-trend">
                <div className="trend-indicator positive">
                  <CheckCircle size={12} />
                  <span>{(getFilteredPods('cpuUsage').reduce((sum, pod) => sum + pod.cpuUsage, 0) / getFilteredPods('cpuUsage').length || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Pod CPU Usage
                <CardNamespaceSelector cardType="cpuUsage" />
              </div>
              <div className="card-subtitle">Average CPU utilization across filtered pods</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {getFilteredPods('cpuUsage').slice(0, 10).map((pod) => (
                  <div key={`${pod.namespace}-${pod.name}`} className="pod-bar">
                    <div className="pod-label">
                      <span className="pod-name">{pod.name}</span>
                      <span className="pod-namespace">{pod.namespace}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill cpu"
                        style={{ width: `${Math.min(pod.cpuUsage, 100)}%` }}
                      ></div>
                    </div>
                    <span className="value">{pod.cpuUsage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pod Memory Usage */}
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
                  <span>{(getFilteredPods('memoryUsage').reduce((sum, pod) => sum + pod.memoryUsage, 0) / getFilteredPods('memoryUsage').length || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Pod Memory Usage
                <CardNamespaceSelector cardType="memoryUsage" />
              </div>
              <div className="card-subtitle">Average memory utilization across filtered pods</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {getFilteredPods('memoryUsage').slice(0, 10).map((pod) => (
                  <div key={`${pod.namespace}-${pod.name}`} className="pod-bar">
                    <div className="pod-label">
                      <span className="pod-name">{pod.name}</span>
                      <span className="pod-namespace">{pod.namespace}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill memory"
                        style={{ width: `${Math.min(pod.memoryUsage, 100)}%` }}
                      ></div>
                    </div>
                    <span className="value">{pod.memoryUsage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pod CPU Utilization Vs Limit */}
        <div className="overview-card card-purple">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <Activity size={20} />
              </div>
              <div className="card-trend">
                <div className="trend-indicator positive">
                  <CheckCircle size={12} />
                  <span>{(getFilteredPods('cpuVsLimit').reduce((sum, pod) => sum + calculateUtilizationVsLimit(pod.cpuUsage, pod.cpuLimit), 0) / getFilteredPods('cpuVsLimit').length || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Pod CPU Utilization vs Limit
                <CardNamespaceSelector cardType="cpuVsLimit" />
              </div>
              <div className="card-subtitle">CPU usage compared to resource limits</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {getFilteredPods('cpuVsLimit').filter(pod => pod.cpuLimit > 0).slice(0, 10).map((pod) => {
                  const utilization = calculateUtilizationVsLimit(pod.cpuUsage, pod.cpuLimit);
                  return (
                    <div key={`${pod.namespace}-${pod.name}`} className="comparison-bar">
                      <div className="pod-label">
                        <span className="pod-name">{pod.name}</span>
                        <span className="pod-namespace">{pod.namespace}</span>
                      </div>
                      <div className="comparison-chart">
                        <div className="limit-bar">
                          <div 
                            className="usage-fill"
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          ></div>
                        </div>
                        <span className="comparison-value">{utilization.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pod CPU Utilization Vs Request */}
        <div className="overview-card card-orange">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <Activity size={20} />
              </div>
              <div className="card-trend">
                <div className="trend-indicator positive">
                  <CheckCircle size={12} />
                  <span>{(getFilteredPods('cpuVsRequest').reduce((sum, pod) => sum + calculateUtilizationVsRequest(pod.cpuUsage, pod.cpuRequest), 0) / getFilteredPods('cpuVsRequest').length || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Pod CPU Utilization vs Request
                <CardNamespaceSelector cardType="cpuVsRequest" />
              </div>
              <div className="card-subtitle">CPU usage compared to resource requests</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {getFilteredPods('cpuVsRequest').filter(pod => pod.cpuRequest > 0).slice(0, 10).map((pod) => {
                  const utilization = calculateUtilizationVsRequest(pod.cpuUsage, pod.cpuRequest);
                  return (
                    <div key={`${pod.namespace}-${pod.name}`} className="comparison-bar">
                      <div className="pod-label">
                        <span className="pod-name">{pod.name}</span>
                        <span className="pod-namespace">{pod.namespace}</span>
                      </div>
                      <div className="comparison-chart">
                        <div className="request-bar">
                          <div 
                            className="usage-fill"
                            style={{ 
                              width: `${Math.min(utilization, 200)}%`,
                              backgroundColor: utilization > 100 ? '#ef4444' : '#3b82f6'
                            }}
                          ></div>
                        </div>
                        <span className={`comparison-value ${utilization > 100 ? 'over-request' : ''}`}>
                          {utilization.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Unhealthy Pods */}
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
                <div className={`trend-indicator ${getUnhealthyPods('unhealthyPods').length > 0 ? 'negative' : 'positive'}`}>
                  {getUnhealthyPods('unhealthyPods').length > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <span>{getUnhealthyPods('unhealthyPods').length}</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Unhealthy Pods
                <CardNamespaceSelector cardType="unhealthyPods" />
              </div>
              <div className="card-subtitle">Pods not in running or succeeded state</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {getUnhealthyPods('unhealthyPods').length === 0 ? (
                  <div className="no-issues">All pods are healthy</div>
                ) : (
                  getUnhealthyPods('unhealthyPods').map((pod) => (
                    <div key={`${pod.namespace}-${pod.name}`} className="unhealthy-item">
                      <div className="pod-info">
                        <span className="pod-name">{pod.name}</span>
                        <span className="pod-namespace">{pod.namespace}</span>
                      </div>
                      <div className="status-info">
                        <span className={`status-badge ${pod.status.toLowerCase()}`}>
                          {pod.status}
                        </span>
                        {pod.restartCount > 0 && (
                          <span className="restart-count">{pod.restartCount} restarts</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pod Memory Utilization Vs Request */}
        <div className="overview-card card-blue">
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
                  <span>{(getFilteredPods('memoryVsRequest').reduce((sum, pod) => sum + calculateUtilizationVsRequest(pod.memoryUsage, pod.memoryRequest), 0) / getFilteredPods('memoryVsRequest').length || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Pod Memory Utilization vs Request
                <CardNamespaceSelector cardType="memoryVsRequest" />
              </div>
              <div className="card-subtitle">Memory usage compared to resource requests</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {getFilteredPods('memoryVsRequest').filter(pod => pod.memoryRequest > 0).slice(0, 10).map((pod) => {
                  const utilization = calculateUtilizationVsRequest(pod.memoryUsage, pod.memoryRequest);
                  return (
                    <div key={`${pod.namespace}-${pod.name}`} className="comparison-bar">
                      <div className="pod-label">
                        <span className="pod-name">{pod.name}</span>
                        <span className="pod-namespace">{pod.namespace}</span>
                      </div>
                      <div className="comparison-chart">
                        <div className="request-bar">
                          <div 
                            className="usage-fill memory"
                            style={{ 
                              width: `${Math.min(utilization, 200)}%`,
                              backgroundColor: utilization > 100 ? '#ef4444' : '#10b981'
                            }}
                          ></div>
                        </div>
                        <span className={`comparison-value ${utilization > 100 ? 'over-request' : ''}`}>
                          {utilization.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pod Network IO Rates */}
        <div className="overview-card card-green">
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
                  <span>{(getFilteredPods('networkIO').reduce((sum, pod) => sum + pod.networkIORate, 0) / 1024 / 1024).toFixed(1)} MB/s</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Pod Network IO Rates
                <CardNamespaceSelector cardType="networkIO" />
              </div>
              <div className="card-subtitle">Network throughput across pods</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {getFilteredPods('networkIO').slice(0, 10).map((pod) => (
                  <div key={`${pod.namespace}-${pod.name}`} className="network-item">
                    <div className="pod-label">
                      <span className="pod-name">{pod.name}</span>
                      <span className="pod-namespace">{pod.namespace}</span>
                    </div>
                    <div className="network-value">
                      {(pod.networkIORate / 1024 / 1024).toFixed(2)} MB/s
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pod Filesystem Usage */}
        <div className="overview-card card-purple">
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
                  <span>{(getFilteredPods('filesystem').reduce((sum, pod) => sum + pod.filesystemUsage, 0) / getFilteredPods('filesystem').length || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Pod Filesystem Usage
                <CardNamespaceSelector cardType="filesystem" />
              </div>
              <div className="card-subtitle">Storage utilization across pods</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {getFilteredPods('filesystem').slice(0, 10).map((pod) => (
                  <div key={`${pod.namespace}-${pod.name}`} className="pod-bar">
                    <div className="pod-label">
                      <span className="pod-name">{pod.name}</span>
                      <span className="pod-namespace">{pod.namespace}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill filesystem"
                        style={{ width: `${pod.filesystemUsage}%` }}
                      ></div>
                    </div>
                    <span className="value">{pod.filesystemUsage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pods Per Node */}
        <div className="overview-card card-orange">
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
                  <span>{nodeStats.reduce((sum, node) => sum + node.podCount, 0)} total</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Pods Per Node
                <CardNamespaceSelector cardType="podsPerNode" />
              </div>
              <div className="card-subtitle">Pod distribution across cluster nodes</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {nodeStats.map((node) => (
                  <div key={node.nodeName} className="node-item">
                    <div className="node-label">{node.nodeName}</div>
                    <div className="pod-count-bar">
                      <div 
                        className="count-fill"
                        style={{ width: `${(node.podCount / Math.max(...nodeStats.map(n => n.podCount))) * 100}%` }}
                      ></div>
                    </div>
                    <span className="count-value">{node.podCount} pods</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pods Per Deployment */}
        <div className="overview-card card-red">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <Activity size={20} />
              </div>
              <div className="card-trend">
                <div className="trend-indicator positive">
                  <CheckCircle size={12} />
                  <span>{deploymentStats.length} deployments</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">
                Pods Per Deployment
                <CardNamespaceSelector cardType="podsPerDeployment" />
              </div>
              <div className="card-subtitle">Replica status and pod counts</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {deploymentStats.map((deployment) => (
                  <div key={`${deployment.namespace}-${deployment.name}`} className="deployment-item">
                    <div className="deployment-label">
                      <span className="deployment-name">{deployment.name}</span>
                      <span className="deployment-namespace">{deployment.namespace}</span>
                    </div>
                    <div className="replica-info">
                      <span className="replica-count">
                        {deployment.availableReplicas}/{deployment.replicas} replicas
                      </span>
                      <span className={`health-indicator ${deployment.availableReplicas === deployment.replicas ? 'healthy' : 'warning'}`}>
                        {deployment.podCount} pods
                      </span>
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

export default KubernetesPodMetrics;