import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Zap,
  Globe,
  Server,
} from 'lucide-react';
import './AnalyticsPage.css';

interface AnalyticsData {
  timeRange: string;
  successRate: number;
  averageResponseTime: number;
  totalTests: number;
  uptime: number;
  errorRate: number;
  throughput: number;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

interface AnalyticsPageProps {
  applications: any[];
  testResults: any[];
}

type TimeRange = '24h' | '7d' | '30d' | '90d';
type MetricType = 'success-rate' | 'response-time' | 'uptime' | 'test-volume' | 'error-rate';

// Mock analytics data
const mockAnalyticsData: Record<TimeRange, AnalyticsData[]> = {
  '24h': [
    { timeRange: '00:00', successRate: 95, averageResponseTime: 245, totalTests: 24, uptime: 99.5, errorRate: 5, throughput: 1.2 },
    { timeRange: '04:00', successRate: 97, averageResponseTime: 220, totalTests: 18, uptime: 99.8, errorRate: 3, throughput: 1.1 },
    { timeRange: '08:00', successRate: 92, averageResponseTime: 280, totalTests: 32, uptime: 99.2, errorRate: 8, throughput: 1.8 },
    { timeRange: '12:00', successRate: 89, averageResponseTime: 350, totalTests: 45, uptime: 98.9, errorRate: 11, throughput: 2.1 },
    { timeRange: '16:00', successRate: 94, averageResponseTime: 290, totalTests: 38, uptime: 99.4, errorRate: 6, throughput: 1.9 },
    { timeRange: '20:00', successRate: 96, averageResponseTime: 240, totalTests: 28, uptime: 99.7, errorRate: 4, throughput: 1.4 },
  ],
  '7d': [
    { timeRange: 'Mon', successRate: 94, averageResponseTime: 265, totalTests: 156, uptime: 99.3, errorRate: 6, throughput: 1.5 },
    { timeRange: 'Tue', successRate: 97, averageResponseTime: 220, totalTests: 142, uptime: 99.8, errorRate: 3, throughput: 1.4 },
    { timeRange: 'Wed', successRate: 91, averageResponseTime: 310, totalTests: 168, uptime: 98.9, errorRate: 9, throughput: 1.6 },
    { timeRange: 'Thu', successRate: 96, averageResponseTime: 240, totalTests: 134, uptime: 99.6, errorRate: 4, throughput: 1.3 },
    { timeRange: 'Fri', successRate: 88, averageResponseTime: 380, totalTests: 189, uptime: 98.2, errorRate: 12, throughput: 1.8 },
    { timeRange: 'Sat', successRate: 99, averageResponseTime: 180, totalTests: 98, uptime: 99.9, errorRate: 1, throughput: 0.9 },
    { timeRange: 'Sun', successRate: 98, averageResponseTime: 200, totalTests: 87, uptime: 99.8, errorRate: 2, throughput: 0.8 },
  ],
  '30d': [
    { timeRange: 'Week 1', successRate: 93, averageResponseTime: 275, totalTests: 892, uptime: 99.1, errorRate: 7, throughput: 1.4 },
    { timeRange: 'Week 2', successRate: 95, averageResponseTime: 250, totalTests: 1024, uptime: 99.5, errorRate: 5, throughput: 1.6 },
    { timeRange: 'Week 3', successRate: 91, averageResponseTime: 320, totalTests: 967, uptime: 98.8, errorRate: 9, throughput: 1.5 },
    { timeRange: 'Week 4', successRate: 97, averageResponseTime: 220, totalTests: 1156, uptime: 99.7, errorRate: 3, throughput: 1.8 },
  ],
  '90d': [
    { timeRange: 'Month 1', successRate: 94, averageResponseTime: 280, totalTests: 3890, uptime: 99.2, errorRate: 6, throughput: 1.5 },
    { timeRange: 'Month 2', successRate: 96, averageResponseTime: 240, totalTests: 4120, uptime: 99.6, errorRate: 4, throughput: 1.6 },
    { timeRange: 'Month 3', successRate: 92, averageResponseTime: 310, totalTests: 3945, uptime: 98.9, errorRate: 8, throughput: 1.5 },
  ],
};

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  applications = [],
  testResults = [],
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('success-rate');
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set(['all']));

  // Get current analytics data based on time range
  const currentData = mockAnalyticsData[timeRange] || [];

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (currentData.length === 0) return null;

    const latest = currentData[currentData.length - 1];
    const previous = currentData.length > 1 ? currentData[currentData.length - 2] : latest;

    const calculateChange = (current: number, prev: number) => {
      if (prev === 0) return 0;
      return ((current - prev) / prev) * 100;
    };

    return {
      successRate: {
        value: latest.successRate,
        change: calculateChange(latest.successRate, previous.successRate),
      },
      responseTime: {
        value: latest.averageResponseTime,
        change: calculateChange(latest.averageResponseTime, previous.averageResponseTime),
      },
      uptime: {
        value: latest.uptime,
        change: calculateChange(latest.uptime, previous.uptime),
      },
      totalTests: {
        value: currentData.reduce((sum, d) => sum + d.totalTests, 0),
        change: calculateChange(latest.totalTests, previous.totalTests),
      },
      errorRate: {
        value: latest.errorRate,
        change: calculateChange(latest.errorRate, previous.errorRate),
      },
      throughput: {
        value: latest.throughput,
        change: calculateChange(latest.throughput, previous.throughput),
      },
    };
  }, [currentData]);

  // Generate chart data based on selected metric
  const chartData = useMemo((): ChartData => {
    const labels = currentData.map(d => d.timeRange);
    
    switch (selectedMetric) {
      case 'success-rate':
        return {
          labels,
          datasets: [
            {
              label: 'Success Rate (%)',
              data: currentData.map(d => d.successRate),
              color: '#10b981',
            },
          ],
        };
      case 'response-time':
        return {
          labels,
          datasets: [
            {
              label: 'Avg Response Time (ms)',
              data: currentData.map(d => d.averageResponseTime),
              color: '#3b82f6',
            },
          ],
        };
      case 'uptime':
        return {
          labels,
          datasets: [
            {
              label: 'Uptime (%)',
              data: currentData.map(d => d.uptime),
              color: '#8b5cf6',
            },
          ],
        };
      case 'test-volume':
        return {
          labels,
          datasets: [
            {
              label: 'Total Tests',
              data: currentData.map(d => d.totalTests),
              color: '#f59e0b',
            },
          ],
        };
      case 'error-rate':
        return {
          labels,
          datasets: [
            {
              label: 'Error Rate (%)',
              data: currentData.map(d => d.errorRate),
              color: '#ef4444',
            },
          ],
        };
      default:
        return { labels: [], datasets: [] };
    }
  }, [currentData, selectedMetric]);

  const formatMetricValue = (metric: MetricType, value: number): string => {
    switch (metric) {
      case 'success-rate':
      case 'uptime':
      case 'error-rate':
        return `${value.toFixed(1)}%`;
      case 'response-time':
        return `${value}ms`;
      case 'test-volume':
        return value.toString();
      default:
        return value.toString();
    }
  };

  const getChangeColor = (change: number, metric: MetricType): string => {
    const isGoodChange = metric === 'error-rate' ? change < 0 : change > 0;
    if (Math.abs(change) < 1) return '#6b7280'; // neutral
    return isGoodChange ? '#10b981' : '#ef4444';
  };

  const renderChart = (data: ChartData) => {
    if (data.labels.length === 0) return null;

    const maxValue = Math.max(...data.datasets[0].data);
    const minValue = Math.min(...data.datasets[0].data);
    const range = maxValue - minValue;
    const padding = range * 0.1;

    return (
      <div className="chart-container">
        <div className="chart-area">
          <div className="y-axis">
            {[5, 4, 3, 2, 1, 0].map(i => {
              const value = minValue + (range * i / 5) + padding;
              return (
                <div key={i} className="y-axis-label">
                  {formatMetricValue(selectedMetric, value)}
                </div>
              );
            })}
          </div>
          <div className="chart-grid">
            {data.labels.map((label, index) => {
              const value = data.datasets[0].data[index];
              const height = ((value - minValue + padding) / (range + 2 * padding)) * 100;
              
              return (
                <div key={index} className="chart-column">
                  <div className="chart-grid-lines">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="grid-line" />
                    ))}
                  </div>
                  <div 
                    className="chart-bar"
                    style={{
                      height: `${height}%`,
                      backgroundColor: data.datasets[0].color,
                    }}
                    title={`${label}: ${formatMetricValue(selectedMetric, value)}`}
                  />
                  <div className="x-axis-label">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <h1>
            <BarChart3 size={24} />
            Analytics
          </h1>
          <p>Monitor performance trends and gain insights into your applications</p>
        </div>
        <div className="header-actions">
          <button className="btn secondary">
            <Filter size={16} />
            Filters
          </button>
          <button className="btn secondary">
            <Download size={16} />
            Export
          </button>
          <button className="btn secondary">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="time-range-selector">
        <label>Time Range:</label>
        <div className="time-range-buttons">
          {[
            { value: '24h', label: 'Last 24 Hours' },
            { value: '7d', label: 'Last 7 Days' },
            { value: '30d', label: 'Last 30 Days' },
            { value: '90d', label: 'Last 90 Days' },
          ].map(option => (
            <button
              key={option.value}
              className={`time-range-btn ${timeRange === option.value ? 'active' : ''}`}
              onClick={() => setTimeRange(option.value as TimeRange)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {summaryMetrics && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-icon success">
              <CheckCircle size={20} />
            </div>
            <div className="card-content">
              <div className="card-value">{summaryMetrics.successRate.value.toFixed(1)}%</div>
              <div className="card-label">Success Rate</div>
              <div 
                className="card-change"
                style={{ color: getChangeColor(summaryMetrics.successRate.change, 'success-rate') }}
              >
                {summaryMetrics.successRate.change > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {Math.abs(summaryMetrics.successRate.change).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon response">
              <Clock size={20} />
            </div>
            <div className="card-content">
              <div className="card-value">{summaryMetrics.responseTime.value}ms</div>
              <div className="card-label">Avg Response Time</div>
              <div 
                className="card-change"
                style={{ color: getChangeColor(summaryMetrics.responseTime.change, 'response-time') }}
              >
                {summaryMetrics.responseTime.change > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {Math.abs(summaryMetrics.responseTime.change).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon uptime">
              <Activity size={20} />
            </div>
            <div className="card-content">
              <div className="card-value">{summaryMetrics.uptime.value.toFixed(1)}%</div>
              <div className="card-label">Uptime</div>
              <div 
                className="card-change"
                style={{ color: getChangeColor(summaryMetrics.uptime.change, 'uptime') }}
              >
                {summaryMetrics.uptime.change > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {Math.abs(summaryMetrics.uptime.change).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon tests">
              <BarChart3 size={20} />
            </div>
            <div className="card-content">
              <div className="card-value">{summaryMetrics.totalTests.value.toLocaleString()}</div>
              <div className="card-label">Total Tests</div>
              <div 
                className="card-change"
                style={{ color: getChangeColor(summaryMetrics.totalTests.change, 'test-volume') }}
              >
                {summaryMetrics.totalTests.change > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {Math.abs(summaryMetrics.totalTests.change).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon error">
              <XCircle size={20} />
            </div>
            <div className="card-content">
              <div className="card-value">{summaryMetrics.errorRate.value.toFixed(1)}%</div>
              <div className="card-label">Error Rate</div>
              <div 
                className="card-change"
                style={{ color: getChangeColor(summaryMetrics.errorRate.change, 'error-rate') }}
              >
                {summaryMetrics.errorRate.change > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {Math.abs(summaryMetrics.errorRate.change).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon throughput">
              <Zap size={20} />
            </div>
            <div className="card-content">
              <div className="card-value">{summaryMetrics.throughput.value.toFixed(1)}</div>
              <div className="card-label">Throughput (req/s)</div>
              <div 
                className="card-change"
                style={{ color: getChangeColor(summaryMetrics.throughput.change, 'test-volume') }}
              >
                {summaryMetrics.throughput.change > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {Math.abs(summaryMetrics.throughput.change).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Section */}
      <div className="chart-section">
        <div className="chart-header">
          <h2>Performance Trends</h2>
          <div className="metric-selector">
            <label>Metric:</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
            >
              <option value="success-rate">Success Rate</option>
              <option value="response-time">Response Time</option>
              <option value="uptime">Uptime</option>
              <option value="test-volume">Test Volume</option>
              <option value="error-rate">Error Rate</option>
            </select>
          </div>
        </div>
        
        <div className="chart-wrapper">
          {renderChart(chartData)}
        </div>
      </div>

      {/* Application Performance Breakdown */}
      <div className="app-performance-section">
        <h2>
          <Server size={20} />
          Application Performance Breakdown
        </h2>
        
        <div className="app-performance-grid">
          {(Array.isArray(applications) ? applications : []).slice(0, 6).map((app, index) => (
            <div key={app.id} className="app-performance-card">
              <div className="app-header">
                <div className="app-icon">
                  <Globe size={16} />
                </div>
                <div className="app-info">
                  <h3>{app.name}</h3>
                  <p>{app.url}</p>
                </div>
                <div className={`status-indicator ${app.status}`} />
              </div>
              
              <div className="performance-metrics">
                <div className="metric">
                  <span className="metric-label">Response Time</span>
                  <span className="metric-value">{app.responseTime || 245}ms</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Uptime</span>
                  <span className="metric-value">{app.uptime || 99.5}%</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Success Rate</span>
                  <span className="metric-value">
                    {app.status === 'healthy' ? '99.2%' : app.status === 'warning' ? '94.8%' : '87.3%'}
                  </span>
                </div>
              </div>

              <div className="mini-chart">
                <div className="chart-bars">
                  {[85, 92, 88, 95, 89, 94, 91].map((value, i) => (
                    <div 
                      key={i} 
                      className="mini-bar"
                      style={{ 
                        height: `${value}%`,
                        backgroundColor: app.status === 'healthy' ? '#10b981' : 
                                       app.status === 'warning' ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};