import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, RefreshCw, Download, Calendar,
  AlertCircle, Info, AlertTriangle, Bug, ChevronDown,
  ChevronRight, Copy, Maximize2, GitBranch
} from 'lucide-react';
import './LogsPage.css';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  attributes: Record<string, any>;
  resource: {
    serviceName: string;
    serviceVersion: string;
    environment: string;
  };
}

interface LogFilter {
  level: string[];
  service: string[];
  searchTerm: string;
  timeRange: string;
  applicationFilter: string;
  customTimeStart?: Date;
  customTimeEnd?: Date;
}

interface Application {
  id: string;
  name: string;
  service_name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_seen: string;
}

interface ServiceLogGroup {
  serviceName: string;
  totalLogs: number;
  pods: Set<string>;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  debugCount: number;
  latestLog: LogEntry;
  oldestLog: LogEntry;
  logs: LogEntry[];
}

interface AggregatedView {
  [serviceName: string]: ServiceLogGroup;
}

const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<LogFilter>({
    level: [],
    service: [],
    searchTerm: '',
    timeRange: '24h',
    applicationFilter: '',
  });

  // Get unique services from logs
  const availableServices = Array.from(new Set(logs.map(log => log.service))).sort();
  const [showFilters, setShowFilters] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const [applications, setApplications] = useState<Application[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'aggregated'>('all');
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  // Generate mock log data
  const generateMockLogs = (): LogEntry[] => {
    const levels: LogEntry['level'][] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const services = ['appsentry-frontend', 'appsentry-backend', 'database', 'redis'];
    const messages = [
      'Request processed successfully',
      'Database connection established',
      'Cache miss for key: user_preferences',
      'Authentication token expired',
      'Failed to connect to external service',
      'Memory usage exceeded threshold',
      'Background job completed',
      'WebSocket connection closed unexpectedly',
      'Configuration reloaded',
      'Health check passed',
    ];

    const now = Date.now();
    return Array.from({ length: 50 }, (_, i) => {
      const level = levels[Math.floor(Math.random() * levels.length)];
      const service = services[Math.floor(Math.random() * services.length)];
      
      return {
        id: `log-${i}`,
        timestamp: new Date(now - Math.random() * 3600000).toISOString(),
        level,
        service,
        message: messages[Math.floor(Math.random() * messages.length)],
        traceId: Math.random() > 0.5 ? `trace-${Math.floor(Math.random() * 1000)}` : undefined,
        spanId: Math.random() > 0.5 ? `span-${Math.floor(Math.random() * 1000)}` : undefined,
        attributes: {
          userId: `user-${Math.floor(Math.random() * 100)}`,
          requestId: `req-${Math.floor(Math.random() * 1000)}`,
          duration: Math.floor(Math.random() * 1000),
          ...(level === 'ERROR' && { 
            error: {
              type: 'NetworkError',
              message: 'Connection timeout',
              stack: 'Error: Connection timeout\n    at Socket.timeout\n    at Connection.connect',
            }
          }),
        },
        resource: {
          serviceName: service,
          serviceVersion: '1.0.0',
          environment: 'production',
        },
      };
    });
  };

  // Load logs
  const loadLogs = async () => {
    setLoading(true);
    
    try {
      const queryParams = new URLSearchParams({
        timeRange: filters.timeRange,
        ...(filters.service.length > 0 && { serviceName: filters.service[0] }), // Use first selected service
        ...(filters.level.length > 0 && { severityLevel: filters.level[0] }), // Use first selected level
        ...(filters.searchTerm && { searchTerm: filters.searchTerm }),
        ...(filters.applicationFilter && { applicationName: filters.applicationFilter }),
        limit: '100'
      });

      const response = await fetch(`/api/otel/logs?${queryParams}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('Raw logs data:', data.logs?.length || 0, 'logs');
        // Transform ClickHouse logs to expected format
        const transformedLogs: LogEntry[] = (data.logs || []).map((log: any, index: number) => ({
          id: `${log.trace_id || 'no-trace'}-${log.span_id || 'no-span'}-${new Date(log.timestamp.replace(' ', 'T') + 'Z').getTime()}-${index}`,
          timestamp: log.timestamp.replace(' ', 'T') + 'Z', // Convert to ISO format
          level: log.severity_text as LogEntry['level'],
          service: log.service_name,
          message: log.body,
          traceId: log.trace_id || undefined,
          spanId: log.span_id || undefined,
          attributes: log.log_attributes || {},
          resource: {
            serviceName: log.service_name,
            serviceVersion: log.service_version || '1.0.0',
            environment: log.resource_attributes?.environment || 'production'
          }
        }));

        setLogs(transformedLogs);
      } else {
        console.error('Failed to fetch logs:', data.error);
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Load applications for filtering
  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    loadLogs();
    
    if (autoRefresh) {
      const interval = setInterval(loadLogs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [filters, autoRefresh, refreshInterval]);

  const loadApplications = async () => {
    try {
      const response = await fetch('/api/applications');
      const data = await response.json();
      
      if (response.ok) {
        setApplications(data.applications || []);
      } else {
        console.error('Failed to fetch applications:', data.error);
        setApplications([]);
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      setApplications([]);
    }
  };

  // Filter logs based on current filters
  const filteredLogs = logs.filter(log => {
    // Level filter
    if (filters.level.length > 0 && !filters.level.includes(log.level)) {
      return false;
    }
    
    // Service filter
    if (filters.service.length > 0 && !filters.service.includes(log.service)) {
      return false;
    }
    
    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        log.message.toLowerCase().includes(searchLower) ||
        log.service.toLowerCase().includes(searchLower) ||
        log.traceId?.includes(searchLower) ||
        JSON.stringify(log.attributes).toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  // Create aggregated view by service
  const aggregatedLogs: AggregatedView = filteredLogs.reduce((acc, log) => {
    const serviceName = log.service;
    
    if (!acc[serviceName]) {
      acc[serviceName] = {
        serviceName,
        totalLogs: 0,
        pods: new Set(),
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
        debugCount: 0,
        latestLog: log,
        oldestLog: log,
        logs: []
      };
    }
    
    const group = acc[serviceName];
    group.totalLogs++;
    group.logs.push(log);
    
    // Extract pod name from resource attributes if available
    const podName = log.resource?.serviceName || log.service;
    group.pods.add(podName);
    
    // Count by log level
    switch (log.level) {
      case 'ERROR':
      case 'FATAL':
        group.errorCount++;
        break;
      case 'WARN':
        group.warnCount++;
        break;
      case 'INFO':
        group.infoCount++;
        break;
      case 'DEBUG':
        group.debugCount++;
        break;
    }
    
    // Update latest/oldest logs
    if (new Date(log.timestamp) > new Date(group.latestLog.timestamp)) {
      group.latestLog = log;
    }
    if (new Date(log.timestamp) < new Date(group.oldestLog.timestamp)) {
      group.oldestLog = log;
    }
    
    return acc;
  }, {} as AggregatedView);

  // Toggle service expansion
  const toggleServiceExpansion = (serviceName: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceName)) {
      newExpanded.delete(serviceName);
    } else {
      newExpanded.add(serviceName);
    }
    setExpandedServices(newExpanded);
  };

  // Get log level icon
  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'DEBUG':
      case 'INFO':
        return <Info size={16} />;
      case 'WARN':
        return <AlertTriangle size={16} />;
      case 'ERROR':
      case 'FATAL':
        return <AlertCircle size={16} />;
      default:
        return <Bug size={16} />;
    }
  };

  // Get log level color class
  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'DEBUG':
        return 'log-debug';
      case 'INFO':
        return 'log-info';
      case 'WARN':
        return 'log-warn';
      case 'ERROR':
        return 'log-error';
      case 'FATAL':
        return 'log-fatal';
      default:
        return '';
    }
  };

  // Toggle log expansion
  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // Copy log to clipboard
  const copyToClipboard = (log: LogEntry) => {
    const logText = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(logText);
  };

  // Export logs
  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `logs-${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="logs-page">
      <div className="logs-header">
        <h1>Logs Explorer</h1>
        <div className="logs-controls">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search logs..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            />
          </div>

          <select 
            value={filters.applicationFilter} 
            onChange={(e) => setFilters({ ...filters, applicationFilter: e.target.value })}
            className="application-filter"
          >
            <option value="">All Applications</option>
            {applications.map((app) => (
              <option key={app.id} value={app.name}>
                {app.name}
              </option>
            ))}
          </select>

          <select 
            value={filters.timeRange} 
            onChange={(e) => setFilters({ ...filters, timeRange: e.target.value })}
            className="time-range-select"
          >
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="custom">Custom range</option>
          </select>

          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >
              All Logs
            </button>
            <button 
              className={`view-btn ${viewMode === 'aggregated' ? 'active' : ''}`}
              onClick={() => setViewMode('aggregated')}
            >
              By Service
            </button>
          </div>

          <button 
            className={`filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </button>

          <div className="auto-refresh-control">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
          </div>

          <button className="refresh-btn" onClick={loadLogs} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>

          <button className="export-btn" onClick={exportLogs}>
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="logs-content">
        {showFilters && (
          <div className="logs-filters">
            <div className="filter-section">
              <h4>Log Level</h4>
              <div className="filter-options">
                {['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].map(level => (
                  <label key={level} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.level.includes(level)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters({ ...filters, level: [...filters.level, level] });
                        } else {
                          setFilters({ ...filters, level: filters.level.filter(l => l !== level) });
                        }
                      }}
                    />
                    <span className={`level-label ${getLogLevelClass(level)}`}>
                      {getLogLevelIcon(level)}
                      {level}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <h4>Service</h4>
              <div className="filter-options">
                {availableServices.map(service => (
                  <label key={service} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.service.includes(service)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters({ ...filters, service: [...filters.service, service] });
                        } else {
                          setFilters({ ...filters, service: filters.service.filter(s => s !== service) });
                        }
                      }}
                    />
                    <span>{service}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="logs-list">
          <div className="logs-count">
            {viewMode === 'all' 
              ? `Showing ${filteredLogs.length} of ${logs.length} logs`
              : `Showing ${Object.keys(aggregatedLogs).length} services with ${filteredLogs.length} total logs`
            }
          </div>

          {viewMode === 'all' ? (
            // All Logs View
            filteredLogs.map(log => (
            <div key={log.id} className={`log-entry ${expandedLogs.has(log.id) ? 'expanded' : ''}`}>
              <div className="log-header" onClick={() => toggleLogExpansion(log.id)}>
                <div className="log-expand-icon">
                  {expandedLogs.has(log.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                <div className={`log-level ${getLogLevelClass(log.level)}`}>
                  {getLogLevelIcon(log.level)}
                  {log.level}
                </div>
                <div className="log-timestamp">{formatTimestamp(log.timestamp)}</div>
                <div className="log-service">{log.service}</div>
                <div className="log-message">{log.message}</div>
                <div className="log-actions">
                  {log.traceId && (
                    <button className="trace-link" title="View trace">
                      <GitBranch size={14} />
                    </button>
                  )}
                  <button className="copy-btn" onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(log);
                  }}>
                    <Copy size={14} />
                  </button>
                  <button className="expand-btn" onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLog(log);
                  }}>
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>

              {expandedLogs.has(log.id) && (
                <div className="log-details">
                  {log.traceId && (
                    <div className="log-detail-row">
                      <span className="detail-label">Trace ID:</span>
                      <span className="detail-value">{log.traceId}</span>
                    </div>
                  )}
                  {log.spanId && (
                    <div className="log-detail-row">
                      <span className="detail-label">Span ID:</span>
                      <span className="detail-value">{log.spanId}</span>
                    </div>
                  )}
                  <div className="log-detail-row">
                    <span className="detail-label">Attributes:</span>
                    <pre className="detail-json">{JSON.stringify(log.attributes, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          ))
          ) : (
            // Aggregated View by Service
            Object.entries(aggregatedLogs).map(([serviceName, group]) => (
              <div key={serviceName} className="service-group">
                <div 
                  className="service-header" 
                  onClick={() => toggleServiceExpansion(serviceName)}
                >
                  <div className="service-expand-icon">
                    {expandedServices.has(serviceName) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div className="service-name">{serviceName}</div>
                  <div className="service-stats">
                    <span className="log-count">{group.totalLogs} logs</span>
                    <span className="pod-count">{group.pods.size} pods</span>
                    {group.errorCount > 0 && (
                      <span className="error-badge">{group.errorCount} errors</span>
                    )}
                    {group.warnCount > 0 && (
                      <span className="warn-badge">{group.warnCount} warnings</span>
                    )}
                  </div>
                  <div className="service-last-activity">
                    Last: {formatTimestamp(group.latestLog.timestamp)}
                  </div>
                </div>
                
                {expandedServices.has(serviceName) && (
                  <div className="service-logs">
                    {group.logs.map(log => (
                      <div key={log.id} className={`log-entry ${expandedLogs.has(log.id) ? 'expanded' : ''}`}>
                        <div className="log-header" onClick={() => toggleLogExpansion(log.id)}>
                          <div className="log-expand-icon">
                            {expandedLogs.has(log.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </div>
                          <div className={`log-level ${getLogLevelClass(log.level)}`}>
                            {getLogLevelIcon(log.level)}
                            {log.level}
                          </div>
                          <div className="log-timestamp">{formatTimestamp(log.timestamp)}</div>
                          <div className="log-message">{log.message}</div>
                          <div className="log-actions">
                            {log.traceId && (
                              <button className="trace-link" title="View trace">
                                <GitBranch size={14} />
                              </button>
                            )}
                            <button className="copy-btn" onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(log);
                            }}>
                              <Copy size={14} />
                            </button>
                            <button className="expand-btn" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}>
                              <Maximize2 size={14} />
                            </button>
                          </div>
                        </div>

                        {expandedLogs.has(log.id) && (
                          <div className="log-details">
                            {log.traceId && (
                              <div className="log-detail-row">
                                <span className="detail-label">Trace ID:</span>
                                <span className="detail-value">{log.traceId}</span>
                              </div>
                            )}
                            {log.spanId && (
                              <div className="log-detail-row">
                                <span className="detail-label">Span ID:</span>
                                <span className="detail-value">{log.spanId}</span>
                              </div>
                            )}
                            <div className="log-detail-row">
                              <span className="detail-label">Attributes:</span>
                              <pre className="detail-json">{JSON.stringify(log.attributes, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedLog && (
        <div className="log-modal" onClick={() => setSelectedLog(null)}>
          <div className="log-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="log-modal-header">
              <h3>Log Details</h3>
              <button className="close-btn" onClick={() => setSelectedLog(null)}>×</button>
            </div>
            <div className="log-modal-body">
              <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsPage;