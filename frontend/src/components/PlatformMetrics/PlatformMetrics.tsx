import React from 'react';
import { Server, HardDrive, Cpu, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ClusterMetrics, KubernetesHealth } from '../../services/platformMetricsApi';
import './PlatformMetrics.css';

interface PlatformMetricsProps {
  clusterMetrics: ClusterMetrics | null;
  kubernetesHealth: KubernetesHealth | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const PlatformMetrics: React.FC<PlatformMetricsProps> = ({
  clusterMetrics,
  kubernetesHealth,
  loading,
  error,
  onRefresh
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
          {/* Cluster Overview Cards */}
          <div className="cluster-overview">
            <div className="overview-card nodes">
              <div className="card-header">
                <Server size={18} />
                <h4>Nodes</h4>
              </div>
              <div className="card-stats">
                <div className="primary-stat">
                  <span className="stat-value">{clusterMetrics.nodes.ready}</span>
                  <span className="stat-total">/ {clusterMetrics.nodes.total}</span>
                </div>
                <div className="stat-label">Ready Nodes</div>
              </div>
              <div className="status-bar">
                <div 
                  className="status-fill ready" 
                  style={{ width: `${(clusterMetrics.nodes.ready / clusterMetrics.nodes.total) * 100}%` }}
                />
              </div>
            </div>

            <div className="overview-card pods">
              <div className="card-header">
                <HardDrive size={18} />
                <h4>Pods</h4>
              </div>
              <div className="card-stats">
                <div className="primary-stat">
                  <span className="stat-value">{clusterMetrics.pods.running}</span>
                  <span className="stat-total">/ {clusterMetrics.pods.total}</span>
                </div>
                <div className="stat-label">Running Pods</div>
              </div>
              <div className="pod-status-breakdown">
                <div className="status-item running">
                  <span>{clusterMetrics.pods.running}</span>
                  <label>Running</label>
                </div>
                <div className="status-item pending">
                  <span>{clusterMetrics.pods.pending}</span>
                  <label>Pending</label>
                </div>
                <div className="status-item failed">
                  <span>{clusterMetrics.pods.failed}</span>
                  <label>Failed</label>
                </div>
              </div>
            </div>

            <div className="overview-card deployments">
              <div className="card-header">
                <Cpu size={18} />
                <h4>Deployments</h4>
              </div>
              <div className="card-stats">
                <div className="primary-stat">
                  <span className="stat-value">{clusterMetrics.deployments.available}</span>
                  <span className="stat-total">/ {clusterMetrics.deployments.total}</span>
                </div>
                <div className="stat-label">Available</div>
              </div>
              <div className="status-bar">
                <div 
                  className="status-fill available" 
                  style={{ width: `${(clusterMetrics.deployments.available / clusterMetrics.deployments.total) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Node Resource Usage */}
          {clusterMetrics.nodes.metrics.length > 0 && (
            <div className="node-details">
              <h4>Node Resource Usage</h4>
              <div className="node-overview">
                {clusterMetrics.nodes.metrics.map((node) => (
                  <div key={node.name} className="overview-card node-resource-card">
                    <div className="card-header">
                      <Server size={18} />
                      <h4>{node.name}</h4>
                      <div className={`node-status ${node.ready ? 'ready' : 'not-ready'}`}>
                        {node.ready ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {node.ready ? 'Ready' : 'Not Ready'}
                      </div>
                    </div>
                    
                    <div className="node-resources">
                      <div className="resource-metric">
                        <div className="resource-info">
                          <Cpu size={12} />
                          <span>CPU</span>
                          <span className="percentage">{node.cpu.percentage}%</span>
                        </div>
                        <div className="resource-bar">
                          <div 
                            className="resource-fill cpu" 
                            style={{ width: `${Math.min(node.cpu.percentage, 100)}%` }}
                          />
                        </div>
                        <div className="resource-usage">
                          {node.cpu.usage} / {node.cpu.capacity}
                        </div>
                      </div>
                      
                      <div className="resource-metric">
                        <div className="resource-info">
                          <HardDrive size={12} />
                          <span>Memory</span>
                          <span className="percentage">{node.memory.percentage}%</span>
                        </div>
                        <div className="resource-bar">
                          <div 
                            className="resource-fill memory" 
                            style={{ width: `${Math.min(node.memory.percentage, 100)}%` }}
                          />
                        </div>
                        <div className="resource-usage">
                          {node.memory.usage} / {node.memory.capacity}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Events */}
          {clusterMetrics.events.warnings.length > 0 && (
            <div className="cluster-events">
              <h4>Recent Cluster Warnings</h4>
              <div className="events-list">
                {clusterMetrics.events.warnings.slice(0, 5).map((event, index) => (
                  <div key={index} className="event-item warning">
                    <AlertTriangle size={16} />
                    <div className="event-content">
                      <div className="event-header">
                        <span className="event-reason">{event.reason}</span>
                        <span className="event-object">{event.object?.kind}/{event.object?.name}</span>
                      </div>
                      <div className="event-message">{event.message}</div>
                      <div className="event-timestamp">
                        {event.lastTimestamp && new Date(event.lastTimestamp).toLocaleString()}
                      </div>
                    </div>
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