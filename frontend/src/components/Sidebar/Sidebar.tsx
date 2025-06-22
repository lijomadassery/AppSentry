import React from 'react';
import { X, Pause, ExternalLink, Wifi, WifiOff, RotateCw } from 'lucide-react';
import { TestProgress, ActivityLog } from '../../types';
import './Sidebar.css';

interface SidebarProps {
  testProgress: TestProgress | null;
  activities: ActivityLog[];
  connected: boolean;
  connecting: boolean;
  onCancelTest?: () => void;
  onPauseTest?: () => void;
  onViewAllActivity?: () => void;
  onReconnect?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  testProgress,
  activities,
  connected,
  connecting,
  onCancelTest,
  onPauseTest,
  onViewAllActivity,
  onReconnect,
}) => {
  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const getActivityIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '🟢';
      case 'error':
        return '🔴';
      case 'warning':
        return '🟡';
      default:
        return '⚪';
    }
  };

  const getProgressPercentage = () => {
    if (!testProgress || testProgress.total === 0) return 0;
    return Math.round((testProgress.completed / testProgress.total) * 100);
  };

  const getConnectionStatus = () => {
    if (connecting) {
      return {
        icon: <RotateCw className="connection-icon connecting" size={14} />,
        text: 'Connecting...',
        className: 'connecting'
      };
    }
    if (connected) {
      return {
        icon: <Wifi className="connection-icon connected" size={14} />,
        text: 'Live Updates',
        className: 'connected'
      };
    }
    return {
      icon: <WifiOff className="connection-icon disconnected" size={14} />,
      text: 'Disconnected',
      className: 'disconnected'
    };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="sidebar">
      {/* Connection Status */}
      <div className={`connection-status ${connectionStatus.className}`}>
        {connectionStatus.icon}
        <span>{connectionStatus.text}</span>
        {!connected && !connecting && onReconnect && (
          <button className="reconnect-btn" onClick={onReconnect} title="Reconnect">
            <RotateCw size={12} />
          </button>
        )}
      </div>

      {/* Test Progress Panel */}
      <div className="sidebar-panel">
        <div className="panel-header">
          <h3>Test Progress</h3>
        </div>

        <div className="panel-content">
          {testProgress ? (
            <div className="test-progress">
              <div className="current-test">
                <div className="test-indicator">
                  <div className="status-dot"></div>
                  <span className="test-status">
                    {testProgress.currentApplication
                      ? `Testing ${testProgress.currentApplication}`
                      : 'Running tests...'}
                  </span>
                </div>
              </div>

              <div className="progress-bar-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage()}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {getProgressPercentage()}%
                </span>
              </div>

              <div className="progress-stats">
                <span className="progress-count">
                  {testProgress.completed} of {testProgress.total} complete
                </span>
              </div>

              <div className="progress-actions">
                {onCancelTest && (
                  <button className="action-btn cancel" onClick={onCancelTest}>
                    <X size={14} />
                    Cancel
                  </button>
                )}
                {onPauseTest && (
                  <button className="action-btn pause" onClick={onPauseTest}>
                    <Pause size={14} />
                    Pause
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="no-progress">
              <p>No active tests running</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Panel */}
      <div className="sidebar-panel">
        <div className="panel-header">
          <h3>Recent Activity</h3>
        </div>

        <div className="panel-content">
          {activities.length > 0 ? (
            <div className="activity-list">
              {activities.slice(0, 8).map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon">
                    {getActivityIcon(activity.status)}
                  </div>
                  <div className="activity-content">
                    <div className="activity-main">
                      <span className="activity-app">
                        {activity.applicationName}
                      </span>
                      <span className={`activity-message ${activity.status}`}>
                        {activity.message}
                      </span>
                    </div>
                    <div className="activity-meta">
                      <span className="activity-time">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                      {activity.duration && (
                        <span className="activity-duration">
                          {activity.duration}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {onViewAllActivity && (
                <div className="activity-footer">
                  <button
                    className="view-all-btn"
                    onClick={onViewAllActivity}
                  >
                    <ExternalLink size={14} />
                    View All Activity
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="no-activity">
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};