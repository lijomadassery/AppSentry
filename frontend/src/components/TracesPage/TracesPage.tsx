import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import './TracesPage.css';

interface Trace {
  traceId: string;
  rootSpan: {
    name: string;
    serviceName: string;
    startTime: string;
    duration: number;
    status: 'OK' | 'ERROR' | 'TIMEOUT';
  };
  spanCount: number;
  serviceCount: number;
  errorCount: number;
}

interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'OK' | 'ERROR' | 'TIMEOUT';
  attributes: Record<string, any>;
  events: Array<{
    name: string;
    timestamp: string;
    attributes: Record<string, any>;
  }>;
}

const TracesPage: React.FC = () => {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [traceSpans, setTraceSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Load real traces from backend
  useEffect(() => {
    loadTraces();
  }, [timeRange, serviceFilter, statusFilter]);

  const loadTraces = async () => {
    setLoading(true);
    
    try {
      const queryParams = new URLSearchParams({
        timeRange,
        ...(serviceFilter && { serviceName: serviceFilter }),
        limit: '100'
      });

      const response = await fetch(`/api/otel/traces?${queryParams}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('Raw traces data:', data.traces?.length || 0, 'traces');
        // Transform ClickHouse data to expected format
        const transformedTraces: Trace[] = (data.traces || []).map((trace: any) => ({
          traceId: trace.trace_id,
          rootSpan: {
            name: trace.operation_name,
            serviceName: trace.service_name,
            startTime: trace.timestamp.replace(' ', 'T') + 'Z', // Convert to ISO format
            duration: parseFloat(trace.duration_ns) / 1000000, // Convert nanoseconds to milliseconds
            status: trace.status_code === '0' ? 'OK' : trace.status_code === '2' ? 'ERROR' : 'TIMEOUT'
          },
          spanCount: 1, // We'll calculate this properly when we get all spans for a trace
          serviceCount: 1, // We'll calculate this properly when we get all spans for a trace
          errorCount: trace.status_code === '2' ? 1 : 0
        }));

        // Group by trace_id and aggregate span counts
        const traceMap = new Map<string, Trace>();
        transformedTraces.forEach(trace => {
          const existing = traceMap.get(trace.traceId);
          if (existing) {
            existing.spanCount++;
            if (trace.rootSpan.serviceName !== existing.rootSpan.serviceName) {
              existing.serviceCount++;
            }
            if (trace.rootSpan.status === 'ERROR') {
              existing.errorCount++;
            }
          } else {
            traceMap.set(trace.traceId, trace);
          }
        });

        setTraces(Array.from(traceMap.values()));
      } else {
        console.error('Failed to fetch traces:', response.status, data.error || data);
        setTraces([]);
      }
    } catch (error) {
      console.error('Failed to fetch traces:', error);
      // If it's a rate limit error, show a message
      if (error instanceof Error && (error.message?.includes('429') || error.message?.includes('Too many requests'))) {
        console.log('Rate limited - please wait a moment and try again');
      }
      
      setTraces([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTraceDetails = async (traceId: string) => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/otel/traces/${traceId}`);
      const data = await response.json();
      
      if (response.ok) {
        // Transform ClickHouse span data to expected format
        const transformedSpans: Span[] = data.spans.map((span: any) => ({
          spanId: span.span_id,
          traceId: span.trace_id,
          parentSpanId: span.parent_span_id || undefined,
          name: span.operation_name,
          serviceName: span.service_name,
          startTime: span.timestamp.replace(' ', 'T') + 'Z', // Convert to ISO format
          endTime: new Date(new Date(span.timestamp.replace(' ', 'T') + 'Z').getTime() + (parseFloat(span.duration_ns) / 1000000)).toISOString(),
          duration: parseFloat(span.duration_ns) / 1000000, // Convert nanoseconds to milliseconds
          status: span.status_code === '0' ? 'OK' : span.status_code === '2' ? 'ERROR' : 'TIMEOUT',
          attributes: span.span_attributes || {},
          events: [] // We would need to add events support to ClickHouse schema
        }));

        setTraceSpans(transformedSpans);
        setSelectedTrace(traceId);
      } else {
        console.error('Failed to fetch trace details:', data.error);
        setTraceSpans([]);
      }
    } catch (error) {
      console.error('Failed to fetch trace details:', error);
      setTraceSpans([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTraces = traces.filter(trace => {
    const matchesSearch = trace.rootSpan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trace.traceId.includes(searchTerm);
    const matchesService = !serviceFilter || trace.rootSpan.serviceName === serviceFilter;
    const matchesStatus = !statusFilter || trace.rootSpan.status === statusFilter;
    
    return matchesSearch && matchesService && matchesStatus;
  });

  const formatDuration = (duration: number) => {
    if (duration >= 1000) {
      return `${(duration / 1000).toFixed(2)}s`;
    }
    return `${duration.toFixed(1)}ms`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircle className="status-icon status-ok" size={16} />;
      case 'ERROR':
        return <AlertCircle className="status-icon status-error" size={16} />;
      default:
        return <Clock className="status-icon status-timeout" size={16} />;
    }
  };

  return (
    <div className="traces-page">
      <div className="traces-header">
        <h1>Distributed Traces</h1>
        <div className="traces-controls">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search traces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select"
          >
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>

          <select 
            value={serviceFilter} 
            onChange={(e) => setServiceFilter(e.target.value)}
            className="service-filter"
          >
            <option value="">All Services</option>
            <option value="appsentry-frontend">Frontend</option>
            <option value="appsentry-backend">Backend</option>
          </select>

          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="">All Status</option>
            <option value="OK">Success</option>
            <option value="ERROR">Error</option>
            <option value="TIMEOUT">Timeout</option>
          </select>

          <button className="refresh-btn" onClick={loadTraces} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      <div className="traces-content">
        <div className="traces-list">
          <div className="traces-list-header">
            <span>Trace</span>
            <span>Duration</span>
            <span>Spans</span>
            <span>Services</span>
            <span>Time</span>
            <span>Status</span>
          </div>
          
          {filteredTraces.map((trace) => (
            <div 
              key={trace.traceId}
              className={`trace-item ${selectedTrace === trace.traceId ? 'selected' : ''}`}
              onClick={() => loadTraceDetails(trace.traceId)}
            >
              <div className="trace-name">
                <div className="service-name">{trace.rootSpan.serviceName}</div>
                <div className="operation-name">{trace.rootSpan.name}</div>
              </div>
              <div className="trace-duration">
                {formatDuration(trace.rootSpan.duration)}
              </div>
              <div className="trace-spans">
                {trace.spanCount}
                {trace.errorCount > 0 && (
                  <span className="error-count">({trace.errorCount} errors)</span>
                )}
              </div>
              <div className="trace-services">{trace.serviceCount}</div>
              <div className="trace-time">{formatTime(trace.rootSpan.startTime)}</div>
              <div className="trace-status">
                {getStatusIcon(trace.rootSpan.status)}
              </div>
            </div>
          ))}
        </div>

        {selectedTrace && (
          <div className="trace-details">
            <div className="trace-details-header">
              <h3>Trace: {selectedTrace}</h3>
              <div className="trace-waterfall">
                <h4>Span Timeline</h4>
                {traceSpans.map((span) => (
                  <div key={span.spanId} className="span-row">
                    <div className="span-info">
                      <div className="span-name">{span.name}</div>
                      <div className="span-service">{span.serviceName}</div>
                      <div className="span-duration">{formatDuration(span.duration)}</div>
                    </div>
                    <div className="span-bar">
                      <div 
                        className={`span-bar-fill ${span.status.toLowerCase()}`}
                        style={{ width: `${Math.min(100, (span.duration / 1000) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TracesPage;