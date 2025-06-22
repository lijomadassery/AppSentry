import React, { useState, useMemo } from 'react';
import {
  Server,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Play,
  Settings,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  Shield,
  Zap,
  Eye,
  Edit3,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Application } from '../../types';
import './ApplicationsPage.css';

interface ApplicationsPageProps {
  applications: Application[];
  onConfigureApp: (app: Application) => void;
  onRunTest: (appId: string) => void;
  onAddApp: () => void;
  onDeleteApp: (appId: string) => void;
  runningTestAppId?: string;
}

interface FilterState {
  search: string;
  status: 'all' | 'healthy' | 'warning' | 'error';
  category: 'all' | 'web' | 'api' | 'database' | 'service';
  sort: 'name' | 'status' | 'lastTested' | 'responseTime';
  order: 'asc' | 'desc';
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  applications,
  onConfigureApp,
  onRunTest,
  onAddApp,
  onDeleteApp,
  runningTestAppId,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    category: 'all',
    sort: 'name',
    order: 'asc',
  });
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter and sort applications
  const filteredApplications = useMemo(() => {
    // Safety check: ensure applications is an array
    if (!Array.isArray(applications)) {
      return [];
    }
    
    let filtered = applications.filter((app) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !app.name.toLowerCase().includes(searchLower) &&
          !app.url.toLowerCase().includes(searchLower) &&
          !app.description?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== 'all' && app.status !== filters.status) {
        return false;
      }

      // Category filter (based on URL or type)
      if (filters.category !== 'all') {
        const category = getApplicationCategory(app);
        if (category !== filters.category) {
          return false;
        }
      }

      return true;
    });

    // Sort applications
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (filters.sort) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = getStatusPriority(a.status);
          bValue = getStatusPriority(b.status);
          break;
        case 'lastTested':
          aValue = a.lastTested ? new Date(a.lastTested).getTime() : 0;
          bValue = b.lastTested ? new Date(b.lastTested).getTime() : 0;
          break;
        case 'responseTime':
          aValue = a.responseTime || 0;
          bValue = b.responseTime || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return filters.order === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.order === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [applications, filters]);

  const getApplicationCategory = (app: Application): string => {
    const url = app.url.toLowerCase();
    if (url.includes('/api/') || url.includes('api.')) return 'api';
    if (url.includes('db.') || url.includes('database')) return 'database';
    if (url.includes('service') || url.includes('svc')) return 'service';
    return 'web';
  };

  const getStatusPriority = (status: string): number => {
    switch (status) {
      case 'error': return 3;
      case 'warning': return 2;
      case 'healthy': return 1;
      default: return 0;
    }
  };

  const handleSelectAll = () => {
    if (selectedApps.size === filteredApplications.length) {
      setSelectedApps(new Set());
    } else {
      setSelectedApps(new Set(filteredApplications.map(app => app.id)));
    }
  };

  const handleSelectApp = (appId: string) => {
    const newSelected = new Set(selectedApps);
    if (newSelected.has(appId)) {
      newSelected.delete(appId);
    } else {
      newSelected.add(appId);
    }
    setSelectedApps(newSelected);
  };

  const handleBulkAction = async (action: string) => {
    const selectedAppIds = Array.from(selectedApps);
    switch (action) {
      case 'test':
        selectedAppIds.forEach(appId => onRunTest(appId));
        break;
      case 'delete':
        // Show confirmation before bulk delete
        if (window.confirm(`Are you sure you want to delete ${selectedAppIds.length} application(s)?`)) {
          for (const appId of selectedAppIds) {
            await onDeleteApp(appId);
          }
          setSelectedApps(new Set());
        }
        break;
      default:
        break;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="status-icon healthy" size={16} />;
      case 'warning':
        return <AlertCircle className="status-icon warning" size={16} />;
      case 'error':
        return <AlertCircle className="status-icon error" size={16} />;
      default:
        return <Clock className="status-icon unknown" size={16} />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'web':
        return <Globe size={16} />;
      case 'api':
        return <Zap size={16} />;
      case 'database':
        return <Server size={16} />;
      case 'service':
        return <Shield size={16} />;
      default:
        return <Globe size={16} />;
    }
  };

  return (
    <div className="applications-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <h1>
            <Server size={24} />
            Applications
            <span className="count">({filteredApplications.length})</span>
          </h1>
          <p>Manage and monitor all your applications in one place</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn secondary"
            onClick={() => {
              if (selectedApps.size > 0) {
                handleBulkAction('test');
              } else {
                // Run tests on all visible applications
                filteredApplications.forEach(app => onRunTest(app.id));
              }
            }}
            title={selectedApps.size > 0 ? 
              `Run health checks on ${selectedApps.size} selected apps` : 
              `Run health checks on all ${filteredApplications.length} apps`
            }
          >
            <Play size={16} />
            Run Health Checks
            {selectedApps.size > 0 && <span className="btn-badge">({selectedApps.size})</span>}
          </button>
          <button 
            className="btn secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </button>
          <button 
            className="btn secondary"
            onClick={() => {
              const dataToExport = selectedApps.size > 0 
                ? filteredApplications.filter(app => selectedApps.has(app.id))
                : filteredApplications;
              
              const csvContent = [
                'Name,URL,Status,Environment,Category,Owner Team,Owner Email,Last Tested,Response Time,Uptime',
                ...dataToExport.map(app => [
                  app.name,
                  app.url || app.healthUrl,
                  app.status,
                  app.environment,
                  app.category,
                  app.owner?.team || '',
                  app.owner?.email || '',
                  app.lastTested ? new Date(app.lastTested).toISOString() : '',
                  app.responseTime || '',
                  app.uptime || ''
                ].join(','))
              ].join('\n');
              
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `applications-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              window.URL.revokeObjectURL(url);
            }}
            title={selectedApps.size > 0 ? 
              `Export ${selectedApps.size} selected applications` : 
              `Export all ${filteredApplications.length} applications`
            }
          >
            <Download size={16} />
            Export
            {selectedApps.size > 0 && <span className="btn-badge">({selectedApps.size})</span>}
          </button>
          <button className="btn primary" onClick={onAddApp}>
            <Plus size={16} />
            Add Application
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="search-bar">
        <div className="search-input">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search applications..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        
        <div className="view-toggle">
          <button 
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </button>
          <button 
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
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
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value as any })}
            >
              <option value="all">All Categories</option>
              <option value="web">Web Apps</option>
              <option value="api">APIs</option>
              <option value="database">Databases</option>
              <option value="service">Services</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Sort By</label>
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value as any })}
            >
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="lastTested">Last Tested</option>
              <option value="responseTime">Response Time</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Order</label>
            <select
              value={filters.order}
              onChange={(e) => setFilters({ ...filters, order: e.target.value as any })}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedApps.size > 0 && (
        <div className="bulk-actions">
          <span>{selectedApps.size} application(s) selected</span>
          <div className="bulk-buttons">
            <button 
              className="btn secondary"
              onClick={() => handleBulkAction('test')}
            >
              <Play size={16} />
              Run Tests
            </button>
            <button 
              className="btn danger"
              onClick={() => handleBulkAction('delete')}
            >
              <Trash2 size={16} />
              Delete
            </button>
            <button 
              className="btn ghost"
              onClick={() => setSelectedApps(new Set())}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Applications Grid/List */}
      <div className={`applications-container ${viewMode}`}>
        {viewMode === 'list' && (
          <div className="list-header">
            <div className="list-cell checkbox-cell">
              <input
                type="checkbox"
                checked={selectedApps.size === filteredApplications.length}
                onChange={handleSelectAll}
              />
            </div>
            <div className="list-cell">Name</div>
            <div className="list-cell">Status</div>
            <div className="list-cell">Category</div>
            <div className="list-cell">Last Tested</div>
            <div className="list-cell">Response Time</div>
            <div className="list-cell">Actions</div>
          </div>
        )}

        {filteredApplications.map((app) => {
          const category = getApplicationCategory(app);
          const isSelected = selectedApps.has(app.id);
          const isRunning = runningTestAppId === app.id;

          if (viewMode === 'grid') {
            return (
              <div 
                key={app.id} 
                className={`app-card ${isSelected ? 'selected' : ''}`}
              >
                <div className="card-header">
                  <div className="app-info">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectApp(app.id)}
                    />
                    <div className="app-icon">
                      {getCategoryIcon(category)}
                    </div>
                    <div className="app-details">
                      <h3>{app.name}</h3>
                      <p>{app.url}</p>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button className="action-btn" title="View Details">
                      <Eye size={14} />
                    </button>
                    <button className="action-btn" title="More Options">
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>

                <div className="card-body">
                  <div className="status-row">
                    {getStatusIcon(app.status)}
                    <span className={`status-text ${app.status}`}>
                      {app.status.toUpperCase()}
                    </span>
                    {app.uptime && (
                      <span className="uptime">{app.uptime}% uptime</span>
                    )}
                  </div>

                  {app.description && (
                    <p className="description">{app.description}</p>
                  )}

                  <div className="metrics">
                    {app.responseTime && (
                      <div className="metric">
                        <Clock size={12} />
                        <span>{app.responseTime}ms</span>
                      </div>
                    )}
                    {app.lastTested && (
                      <div className="metric">
                        <RefreshCw size={12} />
                        <span>{new Date(app.lastTested).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-footer">
                  <button
                    className={`btn primary small ${isRunning ? 'loading' : ''}`}
                    onClick={() => onRunTest(app.id)}
                    disabled={isRunning}
                  >
                    <Play size={14} />
                    {isRunning ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    className="btn secondary small"
                    onClick={() => onConfigureApp(app)}
                  >
                    <Settings size={14} />
                    Configure
                  </button>
                </div>
              </div>
            );
          } else {
            return (
              <div 
                key={app.id} 
                className={`list-row ${isSelected ? 'selected' : ''}`}
              >
                <div className="list-cell checkbox-cell">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectApp(app.id)}
                  />
                </div>
                <div className="list-cell app-cell">
                  <div className="app-icon">
                    {getCategoryIcon(category)}
                  </div>
                  <div className="app-info">
                    <div className="app-name">{app.name}</div>
                    <div className="app-url">{app.url}</div>
                  </div>
                </div>
                <div className="list-cell status-cell">
                  {getStatusIcon(app.status)}
                  <span className={`status-text ${app.status}`}>
                    {app.status.toUpperCase()}
                  </span>
                </div>
                <div className="list-cell category-cell">
                  <span className={`category-badge ${category}`}>
                    {category.toUpperCase()}
                  </span>
                </div>
                <div className="list-cell">
                  {app.lastTested ? new Date(app.lastTested).toLocaleDateString() : 'Never'}
                </div>
                <div className="list-cell">
                  {app.responseTime ? `${app.responseTime}ms` : '-'}
                </div>
                <div className="list-cell actions-cell">
                  <button
                    className={`btn primary small ${isRunning ? 'loading' : ''}`}
                    onClick={() => onRunTest(app.id)}
                    disabled={isRunning}
                  >
                    <Play size={14} />
                  </button>
                  <button
                    className="btn secondary small"
                    onClick={() => onConfigureApp(app)}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button className="btn ghost small" title="More Options">
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>
            );
          }
        })}
      </div>

      {filteredApplications.length === 0 && (
        <div className="empty-state">
          <Server size={48} className="empty-icon" />
          <h3>No applications found</h3>
          <p>
            {filters.search || filters.status !== 'all' || filters.category !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'Get started by adding your first application.'}
          </p>
          {!filters.search && filters.status === 'all' && filters.category === 'all' && (
            <button className="btn primary" onClick={onAddApp}>
              <Plus size={16} />
              Add Application
            </button>
          )}
        </div>
      )}
    </div>
  );
};