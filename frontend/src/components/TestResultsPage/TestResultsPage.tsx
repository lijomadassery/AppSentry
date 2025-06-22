import React, { useState, useMemo } from 'react';
import {
  Activity,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Download,
  Filter,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Eye,
  FileText,
  Server,
} from 'lucide-react';
import './TestResultsPage.css';

interface TestResult {
  id: string;
  applicationId: string;
  applicationName: string;
  testType: 'health' | 'login' | 'full' | 'custom';
  status: 'passed' | 'failed' | 'warning' | 'running';
  startedAt: Date;
  completedAt?: Date;
  duration: number;
  responseTime: number;
  errors: string[];
  warnings: string[];
  details: {
    steps: TestStep[];
    metrics: TestMetrics;
  };
}

interface TestStep {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface TestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number;
}

interface TestResultsPageProps {
  results: TestResult[];
  onRunTest: (appId: string) => void;
  onViewDetails: (result: TestResult) => void;
  onExportResults: (results: TestResult[]) => void;
}

interface FilterState {
  search: string;
  status: 'all' | 'passed' | 'failed' | 'warning' | 'running';
  testType: 'all' | 'health' | 'login' | 'full' | 'custom';
  dateRange: 'all' | 'today' | 'week' | 'month';
  applicationId: 'all' | string;
}

// Mock data for demonstration
const mockTestResults: TestResult[] = [
  {
    id: '1',
    applicationId: 'app1',
    applicationName: 'Main Portal',
    testType: 'health',
    status: 'passed',
    startedAt: new Date(Date.now() - 30 * 60 * 1000),
    completedAt: new Date(Date.now() - 25 * 60 * 1000),
    duration: 5000,
    responseTime: 245,
    errors: [],
    warnings: [],
    details: {
      steps: [
        { id: '1', name: 'Health Check', status: 'passed', duration: 245 },
        { id: '2', name: 'Database Connection', status: 'passed', duration: 89 },
        { id: '3', name: 'Service Dependencies', status: 'passed', duration: 156 },
      ],
      metrics: {
        totalRequests: 3,
        successfulRequests: 3,
        failedRequests: 0,
        averageResponseTime: 163,
        minResponseTime: 89,
        maxResponseTime: 245,
        throughput: 0.6,
      },
    },
  },
  {
    id: '2',
    applicationId: 'app2',
    applicationName: 'Admin Dashboard',
    testType: 'login',
    status: 'failed',
    startedAt: new Date(Date.now() - 45 * 60 * 1000),
    completedAt: new Date(Date.now() - 40 * 60 * 1000),
    duration: 8000,
    responseTime: 1250,
    errors: ['Authentication failed: Invalid credentials', 'Session timeout after 30 seconds'],
    warnings: ['Slow response time detected'],
    details: {
      steps: [
        { id: '1', name: 'Load Login Page', status: 'passed', duration: 450 },
        { id: '2', name: 'Enter Credentials', status: 'passed', duration: 200 },
        { id: '3', name: 'Submit Form', status: 'failed', duration: 1250, error: 'Authentication failed' },
        { id: '4', name: 'Verify Dashboard', status: 'skipped', duration: 0 },
      ],
      metrics: {
        totalRequests: 4,
        successfulRequests: 2,
        failedRequests: 2,
        averageResponseTime: 475,
        minResponseTime: 200,
        maxResponseTime: 1250,
        throughput: 0.5,
      },
    },
  },
  {
    id: '3',
    applicationId: 'app3',
    applicationName: 'Customer API',
    testType: 'full',
    status: 'warning',
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 15000),
    duration: 15000,
    responseTime: 850,
    errors: [],
    warnings: ['High response time on GET /customers', 'Rate limit threshold reached'],
    details: {
      steps: [
        { id: '1', name: 'Health Check', status: 'passed', duration: 180 },
        { id: '2', name: 'Authentication', status: 'passed', duration: 320 },
        { id: '3', name: 'GET /customers', status: 'passed', duration: 850 },
        { id: '4', name: 'POST /customers', status: 'passed', duration: 290 },
        { id: '5', name: 'Rate Limit Test', status: 'passed', duration: 1200 },
      ],
      metrics: {
        totalRequests: 25,
        successfulRequests: 24,
        failedRequests: 1,
        averageResponseTime: 420,
        minResponseTime: 180,
        maxResponseTime: 1200,
        throughput: 1.67,
      },
    },
  },
];

export const TestResultsPage: React.FC<TestResultsPageProps> = ({
  results = mockTestResults,
  onRunTest,
  onViewDetails,
  onExportResults,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    testType: 'all',
    dateRange: 'all',
    applicationId: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());

  // Get unique applications for filter
  const applications = useMemo(() => {
    const apps = new Map();
    results.forEach(result => {
      if (!apps.has(result.applicationId)) {
        apps.set(result.applicationId, result.applicationName);
      }
    });
    return Array.from(apps.entries()).map(([id, name]) => ({ id, name }));
  }, [results]);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let filtered = results.filter((result) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !result.applicationName.toLowerCase().includes(searchLower) &&
          !result.testType.toLowerCase().includes(searchLower) &&
          !result.errors.some(error => error.toLowerCase().includes(searchLower))
        ) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== 'all' && result.status !== filters.status) {
        return false;
      }

      // Test type filter
      if (filters.testType !== 'all' && result.testType !== filters.testType) {
        return false;
      }

      // Application filter
      if (filters.applicationId !== 'all' && result.applicationId !== filters.applicationId) {
        return false;
      }

      // Date range filter
      if (filters.dateRange !== 'all') {
        const now = new Date();
        const resultDate = new Date(result.startedAt);
        
        switch (filters.dateRange) {
          case 'today':
            if (resultDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (resultDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (resultDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });

    // Sort by most recent first
    filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return filtered;
  }, [results, filters]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const total = filteredResults.length;
    const passed = filteredResults.filter(r => r.status === 'passed').length;
    const failed = filteredResults.filter(r => r.status === 'failed').length;
    const warnings = filteredResults.filter(r => r.status === 'warning').length;
    const running = filteredResults.filter(r => r.status === 'running').length;

    const avgResponseTime = filteredResults.length > 0
      ? Math.round(filteredResults.reduce((sum, r) => sum + r.responseTime, 0) / filteredResults.length)
      : 0;

    const avgDuration = filteredResults.length > 0
      ? Math.round(filteredResults.reduce((sum, r) => sum + r.duration, 0) / filteredResults.length)
      : 0;

    return {
      total,
      passed,
      failed,
      warnings,
      running,
      successRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      avgResponseTime,
      avgDuration,
    };
  }, [filteredResults]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="status-icon passed" size={16} />;
      case 'failed':
        return <XCircle className="status-icon failed" size={16} />;
      case 'warning':
        return <AlertCircle className="status-icon warning" size={16} />;
      case 'running':
        return <RefreshCw className="status-icon running" size={16} />;
      default:
        return <Clock className="status-icon unknown" size={16} />;
    }
  };

  const getTestTypeIcon = (testType: string) => {
    switch (testType) {
      case 'health':
        return <Activity size={16} />;
      case 'login':
        return <Eye size={16} />;
      case 'full':
        return <BarChart3 size={16} />;
      case 'custom':
        return <FileText size={16} />;
      default:
        return <Play size={16} />;
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDateTime = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleSelectAll = () => {
    if (selectedResults.size === filteredResults.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(filteredResults.map(r => r.id)));
    }
  };

  const handleSelectResult = (resultId: string) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId);
    } else {
      newSelected.add(resultId);
    }
    setSelectedResults(newSelected);
  };

  const handleExportSelected = () => {
    const selectedResultsData = filteredResults.filter(r => selectedResults.has(r.id));
    onExportResults(selectedResultsData);
  };

  return (
    <div className="test-results-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <h1>
            <Activity size={24} />
            Test Results
            <span className="count">({stats.total})</span>
          </h1>
          <p>Monitor test execution history and analyze performance trends</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </button>
          <button 
            className="btn secondary"
            onClick={handleExportSelected}
            disabled={selectedResults.size === 0}
          >
            <Download size={16} />
            Export ({selectedResults.size})
          </button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon total">
            <BarChart3 size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Tests</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon passed">
            <CheckCircle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.passed}</div>
            <div className="stat-label">Passed</div>
            <div className="stat-trend">
              <TrendingUp size={12} />
              {stats.successRate}%
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon failed">
            <XCircle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <AlertCircle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.warnings}</div>
            <div className="stat-label">Warnings</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon metric">
            <Clock size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.avgResponseTime}ms</div>
            <div className="stat-label">Avg Response</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon metric">
            <RefreshCw size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatDuration(stats.avgDuration)}</div>
            <div className="stat-label">Avg Duration</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="search-bar">
        <div className="search-input">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search test results..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
            >
              <option value="all">All Status</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="warning">Warning</option>
              <option value="running">Running</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Test Type</label>
            <select
              value={filters.testType}
              onChange={(e) => setFilters({ ...filters, testType: e.target.value as any })}
            >
              <option value="all">All Types</option>
              <option value="health">Health Check</option>
              <option value="login">Login Test</option>
              <option value="full">Full Test</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Application</label>
            <select
              value={filters.applicationId}
              onChange={(e) => setFilters({ ...filters, applicationId: e.target.value })}
            >
              <option value="all">All Applications</option>
              {applications.map(app => (
                <option key={app.id} value={app.id}>{app.name}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedResults.size > 0 && (
        <div className="bulk-actions">
          <span>{selectedResults.size} result(s) selected</span>
          <div className="bulk-buttons">
            <button 
              className="btn secondary"
              onClick={handleExportSelected}
            >
              <Download size={16} />
              Export Selected
            </button>
            <button 
              className="btn ghost"
              onClick={() => setSelectedResults(new Set())}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="results-table">
        <div className="table-header">
          <div className="table-cell checkbox-cell">
            <input
              type="checkbox"
              checked={selectedResults.size === filteredResults.length}
              onChange={handleSelectAll}
            />
          </div>
          <div className="table-cell">Application</div>
          <div className="table-cell">Test Type</div>
          <div className="table-cell">Status</div>
          <div className="table-cell">Started</div>
          <div className="table-cell">Duration</div>
          <div className="table-cell">Response Time</div>
          <div className="table-cell">Actions</div>
        </div>

        {filteredResults.map((result) => {
          const isSelected = selectedResults.has(result.id);

          return (
            <div 
              key={result.id} 
              className={`table-row ${isSelected ? 'selected' : ''} ${result.status}`}
            >
              <div className="table-cell checkbox-cell">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleSelectResult(result.id)}
                />
              </div>
              
              <div className="table-cell app-cell">
                <div className="app-info">
                  <Server size={16} className="app-icon" />
                  <span className="app-name">{result.applicationName}</span>
                </div>
              </div>
              
              <div className="table-cell test-type-cell">
                <div className="test-type">
                  {getTestTypeIcon(result.testType)}
                  <span>{result.testType.charAt(0).toUpperCase() + result.testType.slice(1)}</span>
                </div>
              </div>
              
              <div className="table-cell status-cell">
                <div className="status-info">
                  {getStatusIcon(result.status)}
                  <span className={`status-text ${result.status}`}>
                    {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                  </span>
                </div>
                {result.errors.length > 0 && (
                  <div className="error-count">
                    {result.errors.length} error{result.errors.length > 1 ? 's' : ''}
                  </div>
                )}
                {result.warnings.length > 0 && (
                  <div className="warning-count">
                    {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              
              <div className="table-cell">
                <div className="datetime">
                  <Calendar size={12} />
                  {formatDateTime(result.startedAt)}
                </div>
              </div>
              
              <div className="table-cell">
                <div className="duration">
                  <Clock size={12} />
                  {formatDuration(result.duration)}
                </div>
              </div>
              
              <div className="table-cell">
                <div className={`response-time ${result.responseTime > 1000 ? 'slow' : result.responseTime > 500 ? 'medium' : 'fast'}`}>
                  {result.responseTime > 1000 ? (
                    <TrendingDown size={12} />
                  ) : (
                    <TrendingUp size={12} />
                  )}
                  {result.responseTime}ms
                </div>
              </div>
              
              <div className="table-cell actions-cell">
                <button
                  className="btn secondary small"
                  onClick={() => onViewDetails(result)}
                >
                  <Eye size={14} />
                  Details
                </button>
                <button
                  className="btn ghost small"
                  onClick={() => onRunTest(result.applicationId)}
                >
                  <Play size={14} />
                  Rerun
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredResults.length === 0 && (
        <div className="empty-state">
          <Activity size={48} className="empty-icon" />
          <h3>No test results found</h3>
          <p>
            {filters.search || filters.status !== 'all' || filters.testType !== 'all' || filters.dateRange !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'Run some tests to see results here.'}
          </p>
        </div>
      )}
    </div>
  );
};