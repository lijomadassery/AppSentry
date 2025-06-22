import React, { useState } from 'react';
import { X, Download, Calendar, BarChart3, TrendingUp, AlertTriangle, FileText } from 'lucide-react';
import './ReportsModal.css';

interface ReportsModalProps {
  onClose: () => void;
}

interface ExecutiveSummary {
  overallHealth: number;
  failedTests: number;
  totalTests: number;
  averageResponse: number;
  uptime: number;
  slaCompliance: number;
}

interface SLAData {
  appName: string;
  target: number;
  actual: number;
  status: 'met' | 'warning' | 'breach';
}

interface TopFailure {
  appName: string;
  failures: number;
  lastFailure: string;
  type: string;
}

interface ScheduledReport {
  name: string;
  frequency: string;
  lastGenerated: string;
  recipients: number;
}

// Mock data - in real app this would come from API
const mockExecutiveSummary: ExecutiveSummary = {
  overallHealth: 92.3,
  failedTests: 23,
  totalTests: 2456,
  averageResponse: 245,
  uptime: 99.1,
  slaCompliance: 96.2,
};

const mockSLAData: SLAData[] = [
  { appName: 'user-service', target: 99.9, actual: 99.8, status: 'warning' },
  { appName: 'auth-service', target: 99.5, actual: 99.7, status: 'met' },
  { appName: 'payment-api', target: 99.0, actual: 98.1, status: 'breach' },
  { appName: 'notification-svc', target: 99.5, actual: 99.6, status: 'met' },
];

const mockTopFailures: TopFailure[] = [
  { appName: 'payment-api', failures: 8, lastFailure: '2h ago', type: 'Timeout' },
  { appName: 'user-dashboard', failures: 5, lastFailure: '4h ago', type: 'Login Failed' },
  { appName: 'notification-svc', failures: 3, lastFailure: '6h ago', type: 'Health Check' },
  { appName: 'auth-service', failures: 2, lastFailure: '1d ago', type: 'SSL Error' },
];

const mockScheduledReports: ScheduledReport[] = [
  { name: 'Weekly Executive Summary', frequency: 'Weekly', lastGenerated: '2 days ago', recipients: 5 },
  { name: 'Monthly SLA Report', frequency: 'Monthly', lastGenerated: '1 week ago', recipients: 12 },
  { name: 'Daily Operations', frequency: 'Daily', lastGenerated: '1 hour ago', recipients: 8 },
];

export const ReportsModal: React.FC<ReportsModalProps> = ({ onClose }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('7d');

  const getStatusIcon = (status: string) => {
    switch (status) {
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

  const getHealthStatusIcon = (health: number) => {
    if (health >= 95) return '✅';
    if (health >= 90) return '⚠️';
    return '❌';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="reports-modal-content" onClick={e => e.stopPropagation()}>
        <div className="reports-header">
          <div className="reports-title">
            <BarChart3 size={24} />
            <h2>Reports & Analytics</h2>
          </div>
          <div className="reports-actions">
            <button className="action-btn">
              <Calendar size={16} />
              Schedule Report
            </button>
            <button className="action-btn">
              <Download size={16} />
              Export
            </button>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="timeframe-selector">
          <label>Time Period:</label>
          <div className="timeframe-buttons">
            <button
              className={`timeframe-btn ${selectedTimeframe === '7d' ? 'active' : ''}`}
              onClick={() => setSelectedTimeframe('7d')}
            >
              Last 7 Days
            </button>
            <button
              className={`timeframe-btn ${selectedTimeframe === '30d' ? 'active' : ''}`}
              onClick={() => setSelectedTimeframe('30d')}
            >
              Last 30 Days
            </button>
            <button
              className={`timeframe-btn ${selectedTimeframe === '90d' ? 'active' : ''}`}
              onClick={() => setSelectedTimeframe('90d')}
            >
              Last 90 Days
            </button>
          </div>
        </div>

        <div className="reports-content">
          {/* Executive Summary */}
          <div className="summary-section">
            <h3>Executive Summary</h3>
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-value">
                  {getHealthStatusIcon(mockExecutiveSummary.overallHealth)} {mockExecutiveSummary.overallHealth}%
                </div>
                <div className="summary-label">Overall Health</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">{mockExecutiveSummary.failedTests}</div>
                <div className="summary-label">Failed Tests</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">{mockExecutiveSummary.totalTests.toLocaleString()}</div>
                <div className="summary-label">Total Tests</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">{mockExecutiveSummary.averageResponse}ms</div>
                <div className="summary-label">Average Response</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">{mockExecutiveSummary.uptime}%</div>
                <div className="summary-label">Uptime</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">
                  {getHealthStatusIcon(mockExecutiveSummary.slaCompliance)} {mockExecutiveSummary.slaCompliance}%
                </div>
                <div className="summary-label">SLA Compliance</div>
              </div>
            </div>
          </div>

          {/* Main Reports Grid */}
          <div className="reports-grid">
            {/* SLA Compliance by App */}
            <div className="report-panel">
              <div className="panel-title">
                <TrendingUp size={20} />
                <h4>SLA Compliance by App</h4>
              </div>
              <div className="sla-list">
                {mockSLAData.map((sla, index) => (
                  <div key={index} className="sla-item">
                    <div className="sla-app">
                      <span className="app-name">{sla.appName}</span>
                      <div className="sla-progress">
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${sla.status}`}
                            style={{ width: `${(sla.actual / sla.target) * 100}%` }}
                          ></div>
                        </div>
                        <span className="sla-percentage">{sla.actual}%</span>
                      </div>
                    </div>
                    <div className="sla-status">
                      {getStatusIcon(sla.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response Time Trends */}
            <div className="report-panel">
              <div className="panel-title">
                <BarChart3 size={20} />
                <h4>Response Time Trends</h4>
              </div>
              <div className="chart-placeholder">
                <div className="chart-bars">
                  <div className="bar" style={{ height: '60%' }}></div>
                  <div className="bar" style={{ height: '80%' }}></div>
                  <div className="bar" style={{ height: '45%' }}></div>
                  <div className="bar" style={{ height: '90%' }}></div>
                  <div className="bar" style={{ height: '70%' }}></div>
                  <div className="bar" style={{ height: '55%' }}></div>
                  <div className="bar" style={{ height: '85%' }}></div>
                </div>
                <div className="chart-labels">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </div>
            </div>

            {/* Top Failures */}
            <div className="report-panel">
              <div className="panel-title">
                <AlertTriangle size={20} />
                <h4>Top Failures (Last 7 Days)</h4>
              </div>
              <div className="failures-list">
                {mockTopFailures.map((failure, index) => (
                  <div key={index} className="failure-item">
                    <div className="failure-info">
                      <span className="failure-app">{failure.appName}</span>
                      <span className="failure-type">{failure.type}</span>
                    </div>
                    <div className="failure-stats">
                      <span className="failure-count">{failure.failures} failures</span>
                      <span className="failure-time">{failure.lastFailure}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scheduled Reports */}
            <div className="report-panel">
              <div className="panel-title">
                <FileText size={20} />
                <h4>Scheduled Reports</h4>
              </div>
              <div className="scheduled-list">
                {mockScheduledReports.map((report, index) => (
                  <div key={index} className="scheduled-item">
                    <div className="scheduled-info">
                      <span className="scheduled-name">{report.name}</span>
                      <span className="scheduled-frequency">{report.frequency}</span>
                    </div>
                    <div className="scheduled-meta">
                      <span className="scheduled-generated">{report.lastGenerated}</span>
                      <span className="scheduled-recipients">{report.recipients} recipients</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};