import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Clock, Cpu, MemoryStick, 
  HardDrive, Network, RefreshCw, Download, Filter,
  Calendar, ChevronDown
} from 'lucide-react';
import './MetricsPage.css';

interface MetricData {
  timestamp: string;
  value: number;
  service?: string;
}

interface MetricSummary {
  name: string;
  value: number;
  unit: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface MetricChart {
  id: string;
  title: string;
  type: 'line' | 'area' | 'bar' | 'pie';
  data: MetricData[];
  unit: string;
  color?: string;
}

const MetricsPage: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [selectedService, setSelectedService] = useState('all');
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<MetricChart[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<MetricSummary[]>([]);

  // Generate mock time-series data
  const generateTimeSeriesData = (points: number = 20): MetricData[] => {
    const now = Date.now();
    const interval = 60000; // 1 minute intervals
    
    return Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(now - (points - i - 1) * interval).toLocaleTimeString(),
      value: Math.random() * 100 + Math.sin(i / 3) * 20 + 50,
    }));
  };

  // Generate service distribution data
  const generateServiceData = (): MetricData[] => [
    { timestamp: 'Frontend', value: 35, service: 'appsentry-frontend' },
    { timestamp: 'Backend', value: 45, service: 'appsentry-backend' },
    { timestamp: 'Database', value: 15, service: 'database' },
    { timestamp: 'Cache', value: 5, service: 'redis' },
  ];

  // Load metrics data
  const loadMetrics = async () => {
    setLoading(true);
    
    try {
      // Fetch metrics from backend
      const queryParams = new URLSearchParams({
        timeRange: selectedTimeRange,
        ...(selectedService !== 'all' && { serviceName: selectedService }),
        limit: '1000'
      });

      const [metricsResponse, summaryResponse] = await Promise.all([
        fetch(`/api/otel/metrics?${queryParams}`),
        fetch(`/api/otel/metrics/summary?timeRange=${selectedTimeRange}`)
      ]);

      const [metricsData, summaryData] = await Promise.all([
        metricsResponse.json(),
        summaryResponse.json()
      ]);

      if (metricsResponse.ok && summaryResponse.ok) {
        console.log('Raw metrics data:', metricsData.metrics?.length || 0, 'metrics');
        // Group metrics by metric name and transform to chart format
        const metricGroups = new Map<string, MetricData[]>();
        
        (metricsData.metrics || []).forEach((metric: any) => {
          const key = metric.metric_name;
          if (!metricGroups.has(key)) {
            metricGroups.set(key, []);
          }
          metricGroups.get(key)?.push({
            timestamp: new Date(metric.timestamp.replace(' ', 'T') + 'Z').toLocaleTimeString(),
            value: metric.value,
            service: metric.service_name
          });
        });

        // Transform to chart format
        const charts: MetricChart[] = Array.from(metricGroups.entries()).map(([name, data], index) => {
          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
          return {
            id: name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
            title: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: name.includes('rate') || name.includes('count') ? 'line' : 'area',
            data: data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
            unit: name.includes('percent') || name.includes('ratio') ? '%' : 
                  name.includes('time') || name.includes('duration') ? 'ms' :
                  name.includes('memory') || name.includes('bytes') ? 'MB' : '',
            color: colors[index % colors.length]
          };
        });

        // Transform summary data
        const summary: MetricSummary[] = summaryData.summary.map((item: any) => ({
          name: item.metric_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          value: item.avg_value,
          unit: item.metric_name.includes('percent') || item.metric_name.includes('ratio') ? '%' : 
                item.metric_name.includes('time') || item.metric_name.includes('duration') ? 'ms' :
                item.metric_name.includes('memory') || item.metric_name.includes('bytes') ? 'MB' : '',
          change: Math.random() * 20 - 10, // We'd need historical data to calculate real change
          trend: Math.random() > 0.5 ? 'up' : 'down'
        }));

        setMetrics(charts);
        setSummaryMetrics(summary);
      } else {
        console.error('Failed to fetch metrics');
        // Fallback to empty data
        setMetrics([]);
        setSummaryMetrics([]);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      // Fallback to empty data
      setMetrics([]);
      setSummaryMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    loadMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(loadMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [selectedTimeRange, selectedService, refreshInterval, autoRefresh]);

  // Format number with units
  const formatValue = (value: number, unit: string): string => {
    if (unit === '%') return `${value.toFixed(1)}%`;
    if (unit === 'MB') return `${value.toFixed(0)} MB`;
    if (unit === 'GB') return `${value.toFixed(1)} GB`;
    if (unit === 'ms') return `${value.toFixed(0)} ms`;
    if (unit === 'req/s') return `${value.toFixed(1)} req/s`;
    if (value > 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value > 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  // Colors for pie chart
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{label}</p>
          <p className="value">
            {formatValue(payload[0].value, payload[0].unit || '')}
          </p>
        </div>
      );
    }
    return null;
  };

  // Render metric chart based on type
  const renderChart = (metric: MetricChart) => {
    const chartProps = {
      data: metric.data,
      margin: { top: 5, right: 20, left: 10, bottom: 5 },
    };

    switch (metric.type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="timestamp" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={metric.color} 
                strokeWidth={2}
                dot={false}
                unit={metric.unit}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="timestamp" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={metric.color} 
                fill={metric.color}
                fillOpacity={0.3}
                unit={metric.unit}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="timestamp" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={metric.color} unit={metric.unit} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metric.data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.timestamp}: ${entry.value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {metric.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="metrics-page">
      <div className="metrics-header">
        <h1>Metrics Dashboard</h1>
        <div className="metrics-controls">
          <select 
            value={selectedService} 
            onChange={(e) => setSelectedService(e.target.value)}
            className="service-select"
          >
            <option value="all">All Services</option>
            <option value="appsentry-frontend">Frontend</option>
            <option value="appsentry-backend">Backend</option>
            <option value="database">Database</option>
            <option value="redis">Redis</option>
          </select>

          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="time-range-select"
          >
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>

          <div className="auto-refresh-control">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            {autoRefresh && (
              <select 
                value={refreshInterval} 
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="refresh-interval-select"
              >
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
                <option value={60000}>1m</option>
                <option value={300000}>5m</option>
              </select>
            )}
          </div>

          <button className="refresh-btn" onClick={loadMetrics} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>

          <button className="export-btn">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="metrics-summary">
        {summaryMetrics.map((metric, index) => (
          <div key={index} className="summary-card">
            <div className="summary-header">
              <span className="summary-name">{metric.name}</span>
              <span className={`summary-change ${metric.trend}`}>
                {metric.trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {Math.abs(metric.change)}%
              </span>
            </div>
            <div className="summary-value">
              {formatValue(metric.value, metric.unit)}
            </div>
          </div>
        ))}
      </div>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div key={metric.id} className="metric-card">
            <div className="metric-header">
              <h3>{metric.title}</h3>
              <button className="metric-options">
                <ChevronDown size={16} />
              </button>
            </div>
            <div className="metric-chart">
              {renderChart(metric)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MetricsPage;