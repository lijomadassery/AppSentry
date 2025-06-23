import React from 'react';
import { Server, HardDrive, Cpu, AlertTriangle, CheckCircle, XCircle, Clock, Activity, Shield } from 'lucide-react';
import { ClusterMetrics, KubernetesHealth } from '../../services/platformMetricsApi';
import './PlatformMetrics.css';

interface PlatformMetricsProps {
  clusterMetrics: ClusterMetrics | null;
  kubernetesHealth: KubernetesHealth | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNavigateToDetail?: (page: string) => void;
}

export const PlatformMetrics: React.FC<PlatformMetricsProps> = ({
  clusterMetrics,
  kubernetesHealth,
  loading,
  error,
  onRefresh,
  onNavigateToDetail
}) => {
  if (loading && !clusterMetrics) {
    return (
      <div className="platform-metrics loading">
        <div className="loading-spinner"></div>
        <p>Loading platform metrics...</p>
      </div>
    );
  }

  // Don't hide the entire component on error, show error state within the component
  const hasError = error && !clusterMetrics;

  const isK8sConnected = kubernetesHealth?.isConnected ?? false;

  return (
    <div className="platform-metrics">
      {/* Header with K8s connection status */}
      <div className="metrics-header">
        <div className="header-title">
          <Server size={20} />
          <h3>Platform Infrastructure</h3>
        </div>
        <div className="connection-status">
          <div className={`status-indicator ${isK8sConnected ? 'connected' : 'disconnected'}`}>
            {isK8sConnected ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span>{isK8sConnected ? 'Kubernetes Connected' : 'Kubernetes Disconnected'}</span>
          </div>
          <button onClick={onRefresh} className="refresh-button" disabled={loading}>
            <Clock size={16} />
            Refresh
          </button>
        </div>
      </div>

      {hasError ? (
        <div className="metrics-unavailable">
          <AlertTriangle size={32} />
          <h4>Platform Metrics Unavailable</h4>
          <p>{error}</p>
          <button onClick={onRefresh} className="refresh-button" disabled={loading}>
            <Clock size={16} />
            Retry
          </button>
        </div>
      ) : !clusterMetrics || !isK8sConnected ? (
        <div className="metrics-unavailable">
          <AlertTriangle size={32} />
          <h4>Cluster Metrics Unavailable</h4>
          <p>
            {!isK8sConnected 
              ? 'Kubernetes API is not accessible. Please check your cluster connection.'
              : 'Failed to load cluster metrics. Please try refreshing.'
            }
          </p>
        </div>
      ) : (
        <div className="metrics-content">
          {/* Kubernetes Monitoring Cards - Navigate to Detail Pages */}
          <div className="k8s-monitoring-cards">
            <div 
              className="overview-card card-blue" 
              onClick={() => onNavigateToDetail?.('k8s-node-metrics')}
            >
              <div className="card-background">
                <div className="card-glow"></div>
                <div className="card-pattern"></div>
              </div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Server size={18} />
                  </div>
                  <div className="card-trend">
                    <div className={`trend-indicator ${clusterMetrics.nodes.ready === clusterMetrics.nodes.total ? 'positive' : 'negative'}`}>
                      <CheckCircle size={12} />
                      <span>{Math.round((clusterMetrics.nodes.ready / clusterMetrics.nodes.total) * 100)}%</span>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="card-value">{clusterMetrics.nodes.ready}/{clusterMetrics.nodes.total}</div>
                  <div className="card-title">Kubernetes Node Metrics</div>
                  <div className="card-subtitle">
                    Avg CPU: {clusterMetrics.nodes.metrics.length > 0 
                      ? Math.round(clusterMetrics.nodes.metrics.reduce((sum, node) => sum + node.cpu.percentage, 0) / clusterMetrics.nodes.metrics.length)
                      : 0}% • <span className="view-details-link">View detailed metrics →</span>
                  </div>
                </div>
              </div>
              <div className="card-hover-effect"></div>
            </div>

            <div 
              className="overview-card card-green" 
              onClick={() => onNavigateToDetail?.('k8s-pod-metrics')}
            >
              <div className="card-background">
                <div className="card-glow"></div>
                <div className="card-pattern"></div>
              </div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Activity size={18} />
                  </div>
                  <div className="card-trend">
                    <div className={`trend-indicator ${clusterMetrics.pods.failed === 0 ? 'positive' : 'negative'}`}>
                      {clusterMetrics.pods.failed === 0 ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      <span>{Math.round((clusterMetrics.pods.running / clusterMetrics.pods.total) * 100)}%</span>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="card-value">{clusterMetrics.pods.running}/{clusterMetrics.pods.total}</div>
                  <div className="card-title">Kubernetes Pod Metrics</div>
                  <div className="card-subtitle">
                    Failed: {clusterMetrics.pods.failed} • <span className="view-details-link">View detailed metrics →</span>
                  </div>
                </div>
              </div>
              <div className="card-hover-effect"></div>
            </div>

            <div 
              className="overview-card card-purple" 
              onClick={() => onNavigateToDetail?.('k8s-workload-health')}
            >
              <div className="card-background">
                <div className="card-glow"></div>
                <div className="card-pattern"></div>
              </div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Shield size={18} />
                  </div>
                  <div className="card-trend">
                    <div className={`trend-indicator ${clusterMetrics.deployments.available === clusterMetrics.deployments.total && clusterMetrics.pods.pending === 0 ? 'positive' : 'negative'}`}>
                      {clusterMetrics.deployments.available === clusterMetrics.deployments.total && clusterMetrics.pods.pending === 0 ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      <span>{Math.round((clusterMetrics.deployments.available / clusterMetrics.deployments.total) * 100)}%</span>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="card-value">{clusterMetrics.deployments.available}/{clusterMetrics.deployments.total}</div>
                  <div className="card-title">Kubernetes Workload Health</div>
                  <div className="card-subtitle">
                    Pending: {clusterMetrics.pods.pending} • <span className="view-details-link">View health details →</span>
                  </div>
                </div>
              </div>
              <div className="card-hover-effect"></div>
            </div>
          </div>

          {/* Cluster Overview Cards */}
          <div className="cluster-overview">
            <div className="overview-card card-orange">
              <div className="card-background">
                <div className="card-glow"></div>
                <div className="card-pattern"></div>
              </div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Server size={18} />
                  </div>
                  <div className="card-trend">
                    <div className={`trend-indicator ${clusterMetrics.nodes.ready === clusterMetrics.nodes.total ? 'positive' : 'negative'}`}>
                      {clusterMetrics.nodes.ready === clusterMetrics.nodes.total ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      <span>{Math.round((clusterMetrics.nodes.ready / clusterMetrics.nodes.total) * 100)}%</span>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="card-value">{clusterMetrics.nodes.ready}/{clusterMetrics.nodes.total}</div>
                  <div className="card-title">Ready Nodes</div>
                  <div className="card-subtitle">
                    {clusterMetrics.nodes.total - clusterMetrics.nodes.ready > 0 ? 
                      `${clusterMetrics.nodes.total - clusterMetrics.nodes.ready} not ready` : 
                      'All nodes healthy'
                    }
                  </div>
                </div>
              </div>
              <div className="card-hover-effect"></div>
            </div>

            <div className="overview-card card-indigo">
              <div className="card-background">
                <div className="card-glow"></div>
                <div className="card-pattern"></div>
              </div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <HardDrive size={18} />
                  </div>
                  <div className="card-trend">
                    <div className={`trend-indicator ${clusterMetrics.pods.failed === 0 && clusterMetrics.pods.pending === 0 ? 'positive' : 'negative'}`}>
                      {clusterMetrics.pods.failed === 0 && clusterMetrics.pods.pending === 0 ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      <span>{Math.round((clusterMetrics.pods.running / clusterMetrics.pods.total) * 100)}%</span>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="card-value">{clusterMetrics.pods.running}/{clusterMetrics.pods.total}</div>
                  <div className="card-title">Running Pods</div>
                  <div className="card-subtitle">
                    {clusterMetrics.pods.pending > 0 && `${clusterMetrics.pods.pending} pending`}
                    {clusterMetrics.pods.failed > 0 && `${clusterMetrics.pods.failed} failed`}
                    {clusterMetrics.pods.pending === 0 && clusterMetrics.pods.failed === 0 && 'All pods healthy'}
                  </div>
                </div>
              </div>
              <div className="card-hover-effect"></div>
            </div>

            <div className="overview-card card-red">
              <div className="card-background">
                <div className="card-glow"></div>
                <div className="card-pattern"></div>
              </div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Cpu size={18} />
                  </div>
                  <div className="card-trend">
                    <div className={`trend-indicator ${clusterMetrics.deployments.available === clusterMetrics.deployments.total ? 'positive' : 'negative'}`}>
                      {clusterMetrics.deployments.available === clusterMetrics.deployments.total ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      <span>{Math.round((clusterMetrics.deployments.available / clusterMetrics.deployments.total) * 100)}%</span>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="card-value">{clusterMetrics.deployments.available}/{clusterMetrics.deployments.total}</div>
                  <div className="card-title">Available Deployments</div>
                  <div className="card-subtitle">
                    {clusterMetrics.deployments.total - clusterMetrics.deployments.available > 0 ? 
                      `${clusterMetrics.deployments.total - clusterMetrics.deployments.available} unavailable` : 
                      'All deployments ready'
                    }
                  </div>
                </div>
              </div>
              <div className="card-hover-effect"></div>
            </div>
          </div>


          {/* Recent Cluster Warnings */}
          {clusterMetrics.events.warnings.length > 0 && (
            <div className="cluster-warnings-section">
              <h4>Recent Cluster Warnings</h4>
              <div className="warnings-grid">
                {clusterMetrics.events.warnings.slice(0, 6).map((event, index) => (
                  <div key={index} className="overview-card card-red">
                    <div className="card-background">
                      <div className="card-glow"></div>
                      <div className="card-pattern"></div>
                    </div>
                    <div className="card-content">
                      <div className="card-header">
                        <div className="card-icon">
                          <AlertTriangle size={18} />
                        </div>
                        <div className="card-trend">
                          <div className="trend-indicator negative">
                            <XCircle size={12} />
                            <span>Warning</span>
                          </div>
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="card-value">{event.reason}</div>
                        <div className="card-title">{event.object?.kind}/{event.object?.name}</div>
                        <div className="card-subtitle">
                          {event.message?.length > 60 ? 
                            `${event.message.substring(0, 60)}...` : 
                            event.message}
                        </div>
                      </div>
                      <div className="card-footer">
                        <div className="event-time">
                          {event.lastTimestamp && 
                            new Date(event.lastTimestamp).toLocaleString()
                          }
                        </div>
                      </div>
                    </div>
                    <div className="card-hover-effect"></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};