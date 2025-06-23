import React, { useState, useEffect } from 'react';
import { ArrowLeft, Activity, AlertTriangle, CheckCircle, RefreshCw, Server, HardDrive, Zap } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import './KubernetesWorkloadHealth.css';

interface WorkloadHealthData {
  containerRestarts: {
    total: number;
    byPod: Array<{
      name: string;
      namespace: string;
      restartCount: number;
      lastRestartTime?: string;
    }>;
  };
  unhealthyPods: {
    total: number;
    pods: Array<{
      name: string;
      namespace: string;
      status: string;
      reason?: string;
      message?: string;
      node?: string;
    }>;
  };
  pendingPods: {
    total: number;
    pods: Array<{
      name: string;
      namespace: string;
      reason?: string;
      message?: string;
      pendingSince?: string;
    }>;
  };
  unhealthyNodes: {
    total: number;
    nodes: Array<{
      name: string;
      status: string;
      reason?: string;
      message?: string;
      lastHeartbeatTime?: string;
    }>;
  };
  unhealthyVolumes: {
    total: number;
    volumes: Array<{
      name: string;
      namespace: string;
      pod: string;
      status: string;
      reason?: string;
    }>;
  };
  failedPods: {
    total: number;
    pods: Array<{
      name: string;
      namespace: string;
      reason?: string;
      message?: string;
      failedSince?: string;
      node?: string;
    }>;
  };
}

const KubernetesWorkloadHealth: React.FC = () => {
  const { dispatch } = useApp();
  const [healthData, setHealthData] = useState<WorkloadHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState('all');

  const handleBackToDashboard = () => {
    dispatch({ type: 'ROUTE_CHANGE', payload: 'dashboard' });
  };

  useEffect(() => {
    fetchWorkloadHealth();
    const interval = setInterval(fetchWorkloadHealth, 30000);
    return () => clearInterval(interval);
  }, [selectedNamespace]);

  const fetchWorkloadHealth = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedNamespace !== 'all') params.append('namespace', selectedNamespace);
      
      const response = await fetch(`/api/platform/k8s/workload-health?${params}`);
      
      if (!response.ok) throw new Error('Failed to fetch workload health data');
      
      const data = await response.json();
      setHealthData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const namespaces = healthData ? 
    Array.from(new Set([
      ...healthData.unhealthyPods.pods.map(p => p.namespace),
      ...healthData.pendingPods.pods.map(p => p.namespace),
      ...healthData.failedPods.pods.map(p => p.namespace)
    ])).sort() : [];

  const getHealthStatus = () => {
    if (!healthData) return 'unknown';
    
    const totalIssues = 
      healthData.unhealthyPods.total +
      healthData.pendingPods.total +
      healthData.unhealthyNodes.total +
      healthData.unhealthyVolumes.total +
      healthData.failedPods.total;
    
    if (totalIssues === 0) return 'healthy';
    if (totalIssues <= 5) return 'warning';
    return 'critical';
  };

  const healthStatus = getHealthStatus();

  if (loading) {
    return (
      <div className="k8s-workload-health">
        <div className="loading-spinner">Loading workload health data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="k8s-workload-health">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="k8s-workload-health">
        <div className="error-message">No workload health data available</div>
      </div>
    );
  }

  return (
    <div className="k8s-workload-health">
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
              Kubernetes Workload Health
            </h1>
            <p>Monitor workload health indicators and system status</p>
          </div>
        </div>
        <div className="header-controls">
          <button 
            className="refresh-button"
            onClick={fetchWorkloadHealth}
            disabled={loading}
            title="Refresh health data"
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
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="health-grid">
        {/* Container Restarts */}
        <div className="overview-card card-orange">
          <div className="card-background">
            <div className="card-glow"></div>
            <div className="card-pattern"></div>
          </div>
          <div className="card-content">
            <div className="card-header">
              <div className="card-icon">
                <Zap size={20} />
              </div>
              <div className="card-trend">
                <div className={`trend-indicator ${healthData.containerRestarts.total > 0 ? 'negative' : 'positive'}`}>
                  {healthData.containerRestarts.total > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <span>{healthData.containerRestarts.total}</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Container Restarts</div>
              <div className="card-subtitle">Recent container restart activity</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {healthData.containerRestarts.total === 0 ? (
                  <div className="no-issues">No container restarts</div>
                ) : (
                  <div className="restart-list">
                    {healthData.containerRestarts.byPod
                      .filter(pod => selectedNamespace === 'all' || pod.namespace === selectedNamespace)
                      .sort((a, b) => b.restartCount - a.restartCount)
                      .slice(0, 10)
                      .map((pod, index) => (
                        <div key={`${pod.namespace}-${pod.name}`} className="restart-item">
                          <div className="pod-info">
                            <span className="pod-name">{pod.name}</span>
                            <span className="pod-namespace">{pod.namespace}</span>
                          </div>
                          <div className="restart-info">
                            <span className="restart-count">{pod.restartCount} restarts</span>
                            {pod.lastRestartTime && (
                              <span className="last-restart">
                                {new Date(pod.lastRestartTime).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
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
                <div className={`trend-indicator ${healthData.unhealthyPods.total > 0 ? 'negative' : 'positive'}`}>
                  {healthData.unhealthyPods.total > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <span>{healthData.unhealthyPods.total}</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Unhealthy Pods</div>
              <div className="card-subtitle">Pods in non-running states</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {healthData.unhealthyPods.total === 0 ? (
                  <div className="no-issues">All pods are healthy</div>
                ) : (
                  <div className="pod-list">
                    {healthData.unhealthyPods.pods
                      .filter(pod => selectedNamespace === 'all' || pod.namespace === selectedNamespace)
                      .map((pod, index) => (
                        <div key={`${pod.namespace}-${pod.name}`} className="unhealthy-item">
                          <div className="pod-info">
                            <span className="pod-name">{pod.name}</span>
                            <span className="pod-namespace">{pod.namespace}</span>
                            {pod.node && <span className="pod-node">on {pod.node}</span>}
                          </div>
                          <div className="status-info">
                            <span className={`status-badge ${pod.status.toLowerCase()}`}>
                              {pod.status}
                            </span>
                            {pod.reason && (
                              <span className="status-reason">{pod.reason}</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Pending Pods */}
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
                <div className={`trend-indicator ${healthData.pendingPods.total > 0 ? 'negative' : 'positive'}`}>
                  {healthData.pendingPods.total > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <span>{healthData.pendingPods.total}</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Pending Pods</div>
              <div className="card-subtitle">Pods waiting to be scheduled</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {healthData.pendingPods.total === 0 ? (
                  <div className="no-issues">No pending pods</div>
                ) : (
                  <div className="pod-list">
                    {healthData.pendingPods.pods
                      .filter(pod => selectedNamespace === 'all' || pod.namespace === selectedNamespace)
                      .map((pod, index) => (
                        <div key={`${pod.namespace}-${pod.name}`} className="pending-item">
                          <div className="pod-info">
                            <span className="pod-name">{pod.name}</span>
                            <span className="pod-namespace">{pod.namespace}</span>
                          </div>
                          <div className="pending-info">
                            {pod.reason && (
                              <span className="pending-reason">{pod.reason}</span>
                            )}
                            {pod.pendingSince && (
                              <span className="pending-duration">
                                Pending since {new Date(pod.pendingSince).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Unhealthy Nodes */}
        <div className="overview-card card-purple">
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
                <div className={`trend-indicator ${healthData.unhealthyNodes.total > 0 ? 'negative' : 'positive'}`}>
                  {healthData.unhealthyNodes.total > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <span>{healthData.unhealthyNodes.total}</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Unhealthy Nodes</div>
              <div className="card-subtitle">Cluster nodes with issues</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {healthData.unhealthyNodes.total === 0 ? (
                  <div className="no-issues">All nodes are healthy</div>
                ) : (
                  <div className="node-list">
                    {healthData.unhealthyNodes.nodes.map((node, index) => (
                      <div key={node.name} className="unhealthy-node-item">
                        <div className="node-info">
                          <span className="node-name">{node.name}</span>
                          <span className={`node-status ${node.status.toLowerCase()}`}>
                            {node.status}
                          </span>
                        </div>
                        <div className="node-details">
                          {node.reason && (
                            <span className="node-reason">{node.reason}</span>
                          )}
                          {node.lastHeartbeatTime && (
                            <span className="last-heartbeat">
                              Last heartbeat: {new Date(node.lastHeartbeatTime).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Unhealthy Volumes */}
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
                <div className={`trend-indicator ${healthData.unhealthyVolumes.total > 0 ? 'negative' : 'positive'}`}>
                  {healthData.unhealthyVolumes.total > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <span>{healthData.unhealthyVolumes.total}</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Unhealthy Volumes</div>
              <div className="card-subtitle">Storage volumes with issues</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {healthData.unhealthyVolumes.total === 0 ? (
                  <div className="no-issues">All volumes are healthy</div>
                ) : (
                  <div className="volume-list">
                    {healthData.unhealthyVolumes.volumes
                      .filter(vol => selectedNamespace === 'all' || vol.namespace === selectedNamespace)
                      .map((volume, index) => (
                        <div key={`${volume.namespace}-${volume.pod}-${volume.name}`} className="volume-item">
                          <div className="volume-info">
                            <span className="volume-name">{volume.name}</span>
                            <span className="volume-pod">Pod: {volume.pod}</span>
                            <span className="volume-namespace">{volume.namespace}</span>
                          </div>
                          <div className="volume-status">
                            <span className={`status-badge ${volume.status.toLowerCase()}`}>
                              {volume.status}
                            </span>
                            {volume.reason && (
                              <span className="volume-reason">{volume.reason}</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>

        {/* Failed Pods */}
        <div className="overview-card card-orange">
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
                <div className={`trend-indicator ${healthData.failedPods.total > 0 ? 'negative' : 'positive'}`}>
                  {healthData.failedPods.total > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <span>{healthData.failedPods.total}</span>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="card-title">Failed Pods</div>
              <div className="card-subtitle">Pods that have failed completely</div>
            </div>
            <div className="card-footer">
              <div className="chart-container">
                {healthData.failedPods.total === 0 ? (
                  <div className="no-issues">No failed pods</div>
                ) : (
                  <div className="pod-list">
                    {healthData.failedPods.pods
                      .filter(pod => selectedNamespace === 'all' || pod.namespace === selectedNamespace)
                      .map((pod, index) => (
                        <div key={`${pod.namespace}-${pod.name}`} className="failed-item">
                          <div className="pod-info">
                            <span className="pod-name">{pod.name}</span>
                            <span className="pod-namespace">{pod.namespace}</span>
                            {pod.node && <span className="pod-node">on {pod.node}</span>}
                          </div>
                          <div className="failure-info">
                            {pod.reason && (
                              <span className="failure-reason">{pod.reason}</span>
                            )}
                            {pod.failedSince && (
                              <span className="failure-duration">
                                Failed since {new Date(pod.failedSince).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card-hover-effect"></div>
        </div>
      </div>
    </div>
  );
};

export default KubernetesWorkloadHealth;