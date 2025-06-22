import React from 'react';
import { Settings, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { Application } from '../../types';
import './ApplicationCard.css';

interface ApplicationCardProps {
  application: Application;
  onConfigure: (app: Application) => void;
  onRunTest: (appId: string) => void;
  isTestRunning?: boolean;
}

export const ApplicationCard: React.FC<ApplicationCardProps> = ({
  application,
  onConfigure,
  onRunTest,
  isTestRunning = false,
}) => {
  const getStatusIcon = () => {
    switch (application.status) {
      case 'healthy':
        return <CheckCircle className="status-icon healthy" size={20} />;
      case 'warning':
        return <AlertTriangle className="status-icon warning" size={20} />;
      case 'error':
        return <XCircle className="status-icon error" size={20} />;
      default:
        return <Clock className="status-icon unknown" size={20} />;
    }
  };

  const getSLAIcon = () => {
    switch (application.slaStatus) {
      case 'met':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'breach':
        return '❌';
      default:
        return '⚪';
    }
  };

  const formatLastChecked = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatResponseTime = (time: number) => {
    if (time >= 10000) return 'timeout';
    return `${time}ms`;
  };

  return (
    <div className={`application-card card-${application.status}`}>
      {/* Card Background Effects */}
      <div className="card-background">
        <div className="card-glow"></div>
        <div className="card-pattern"></div>
      </div>

      {/* Card Content */}
      <div className="card-content">
        {/* Card Header */}
        <div className="card-header">
          <div className="card-icon">
            {getStatusIcon()}
          </div>
          <button
            className="settings-btn"
            onClick={() => onConfigure(application)}
            title="Configure Application"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Card Body */}
        <div className="card-body">
          <div className="card-title">
            {application.name}
          </div>
          <div className="card-subtitle">
            {application.displayName}
          </div>
          
          <div className="metrics-row">
            <div className="metric">
              <span className="metric-value">{formatResponseTime(application.responseTime)}</span>
              <span className="metric-label">Response</span>
            </div>
            <div className="metric">
              <span className="metric-value">{application.uptime.toFixed(1)}%</span>
              <span className="metric-label">Uptime</span>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="card-footer">
          <div className="environment-badge">
            <span className={`env-indicator ${application.environment}`}>
              {application.environment}
            </span>
          </div>
          <button
            className={`test-btn ${isTestRunning ? 'disabled' : ''}`}
            onClick={() => onRunTest(application.id)}
            disabled={isTestRunning}
          >
            {isTestRunning ? 'Testing...' : 'Test'}
          </button>
        </div>
      </div>

      {/* Hover Effects */}
      <div className="card-hover-effect"></div>

      {isTestRunning && (
        <div className="testing-overlay">
          <div className="testing-indicator">
            <div className="spinner"></div>
            <span>Testing...</span>
          </div>
        </div>
      )}
    </div>
  );
};