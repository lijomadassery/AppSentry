import React, { useState } from 'react';
import { 
  Search, Plus, X, Play, Save, Clock, 
  Database, Filter, BarChart2, Download,
  ChevronDown, Layers, Zap
} from 'lucide-react';
import './QueryBuilderPage.css';

interface QueryField {
  id: string;
  field: string;
  operation: string;
  value: string;
}

interface QueryAggregate {
  function: string;
  field: string;
  alias: string;
}

interface QueryGroupBy {
  field: string;
}

interface Query {
  name: string;
  dataset: 'traces' | 'metrics' | 'logs';
  fields: QueryField[];
  aggregates: QueryAggregate[];
  groupBy: QueryGroupBy[];
  timeRange: string;
  limit: number;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  executionTime: number;
  rowCount: number;
}

const AVAILABLE_FIELDS = {
  traces: [
    'trace_id', 'span_id', 'parent_span_id', 'operation_name',
    'service_name', 'duration_ms', 'status_code', 'span_kind',
    'http.method', 'http.status_code', 'http.url', 'user.id'
  ],
  metrics: [
    'metric_name', 'metric_type', 'service_name', 'value',
    'timestamp', 'cpu.usage', 'memory.usage', 'disk.usage',
    'network.io', 'http.request_rate', 'http.error_rate'
  ],
  logs: [
    'timestamp', 'level', 'service_name', 'message',
    'trace_id', 'span_id', 'user.id', 'request.id',
    'error.type', 'error.message'
  ]
};

const OPERATIONS = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '<', label: 'less than' },
  { value: '>=', label: 'greater or equal' },
  { value: '<=', label: 'less or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
];

const AGGREGATE_FUNCTIONS = [
  { value: 'COUNT', label: 'Count' },
  { value: 'SUM', label: 'Sum' },
  { value: 'AVG', label: 'Average' },
  { value: 'MIN', label: 'Minimum' },
  { value: 'MAX', label: 'Maximum' },
  { value: 'P50', label: 'P50 (Median)' },
  { value: 'P95', label: 'P95' },
  { value: 'P99', label: 'P99' },
  { value: 'RATE', label: 'Rate' },
  { value: 'COUNT_DISTINCT', label: 'Count Distinct' },
];

const QueryBuilderPage: React.FC = () => {
  const [query, setQuery] = useState<Query>({
    name: '',
    dataset: 'traces',
    fields: [],
    aggregates: [],
    groupBy: [],
    timeRange: '1h',
    limit: 100,
  });
  
  const [savedQueries, setSavedQueries] = useState<Query[]>([]);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Add filter field
  const addField = () => {
    const newField: QueryField = {
      id: Date.now().toString(),
      field: '',
      operation: '=',
      value: '',
    };
    setQuery({ ...query, fields: [...query.fields, newField] });
  };

  // Update filter field
  const updateField = (id: string, updates: Partial<QueryField>) => {
    setQuery({
      ...query,
      fields: query.fields.map(f => f.id === id ? { ...f, ...updates } : f),
    });
  };

  // Remove filter field
  const removeField = (id: string) => {
    setQuery({
      ...query,
      fields: query.fields.filter(f => f.id !== id),
    });
  };

  // Add aggregate
  const addAggregate = () => {
    const newAggregate: QueryAggregate = {
      function: 'COUNT',
      field: '*',
      alias: '',
    };
    setQuery({ ...query, aggregates: [...query.aggregates, newAggregate] });
  };

  // Update aggregate
  const updateAggregate = (index: number, updates: Partial<QueryAggregate>) => {
    setQuery({
      ...query,
      aggregates: query.aggregates.map((a, i) => i === index ? { ...a, ...updates } : a),
    });
  };

  // Remove aggregate
  const removeAggregate = (index: number) => {
    setQuery({
      ...query,
      aggregates: query.aggregates.filter((_, i) => i !== index),
    });
  };

  // Add group by
  const addGroupBy = () => {
    const newGroupBy: QueryGroupBy = {
      field: '',
    };
    setQuery({ ...query, groupBy: [...query.groupBy, newGroupBy] });
  };

  // Update group by
  const updateGroupBy = (index: number, field: string) => {
    setQuery({
      ...query,
      groupBy: query.groupBy.map((g, i) => i === index ? { field } : g),
    });
  };

  // Remove group by
  const removeGroupBy = (index: number) => {
    setQuery({
      ...query,
      groupBy: query.groupBy.filter((_, i) => i !== index),
    });
  };

  // Execute query
  const executeQuery = async () => {
    setIsExecuting(true);
    
    // Mock query execution - in production, send to backend
    setTimeout(() => {
      const mockResult: QueryResult = {
        columns: ['service_name', 'count', 'avg_duration', 'error_rate'],
        rows: [
          ['appsentry-frontend', 1250, 45.2, 0.5],
          ['appsentry-backend', 2500, 120.8, 1.2],
          ['auth-service', 500, 150.3, 0.2],
          ['database', 3200, 25.1, 0.1],
          ['redis', 5000, 2.1, 0.01],
        ],
        executionTime: 125,
        rowCount: 5,
      };
      
      setQueryResult(mockResult);
      setIsExecuting(false);
    }, 1500);
  };

  // Save query
  const saveQuery = () => {
    if (query.name) {
      setSavedQueries([...savedQueries, { ...query }]);
      setShowSaveDialog(false);
    }
  };

  // Load saved query
  const loadQuery = (savedQuery: Query) => {
    setQuery({ ...savedQuery });
  };

  // Export results
  const exportResults = () => {
    if (queryResult) {
      const csv = [
        queryResult.columns.join(','),
        ...queryResult.rows.map(row => row.join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `query-results-${new Date().toISOString()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="query-builder-page">
      <div className="query-builder-header">
        <h1>Query Builder</h1>
        <div className="query-actions">
          <button 
            className="run-query-btn"
            onClick={executeQuery}
            disabled={isExecuting}
          >
            <Play size={16} />
            {isExecuting ? 'Running...' : 'Run Query'}
          </button>
          <button 
            className="save-query-btn"
            onClick={() => setShowSaveDialog(true)}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      <div className="query-builder-content">
        <div className="query-builder-main">
          {/* Dataset Selection */}
          <div className="query-section">
            <h3>
              <Database size={16} />
              Dataset
            </h3>
            <div className="dataset-selector">
              <select 
                value={query.dataset}
                onChange={(e) => setQuery({ ...query, dataset: e.target.value as any })}
              >
                <option value="traces">Traces</option>
                <option value="metrics">Metrics</option>
                <option value="logs">Logs</option>
              </select>
            </div>
          </div>

          {/* Filters */}
          <div className="query-section">
            <h3>
              <Filter size={16} />
              Filters
            </h3>
            <div className="filters-list">
              {query.fields.map((field) => (
                <div key={field.id} className="filter-row">
                  <select
                    value={field.field}
                    onChange={(e) => updateField(field.id, { field: e.target.value })}
                    className="field-select"
                  >
                    <option value="">Select field...</option>
                    {AVAILABLE_FIELDS[query.dataset].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  
                  <select
                    value={field.operation}
                    onChange={(e) => updateField(field.id, { operation: e.target.value })}
                    className="operation-select"
                  >
                    {OPERATIONS.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => updateField(field.id, { value: e.target.value })}
                    placeholder="Value"
                    className="value-input"
                  />
                  
                  <button 
                    className="remove-btn"
                    onClick={() => removeField(field.id)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              
              <button className="add-filter-btn" onClick={addField}>
                <Plus size={16} />
                Add Filter
              </button>
            </div>
          </div>

          {/* Aggregations */}
          <div className="query-section">
            <h3>
              <BarChart2 size={16} />
              Aggregations
            </h3>
            <div className="aggregations-list">
              {query.aggregates.map((agg, index) => (
                <div key={index} className="aggregate-row">
                  <select
                    value={agg.function}
                    onChange={(e) => updateAggregate(index, { function: e.target.value })}
                    className="function-select"
                  >
                    {AGGREGATE_FUNCTIONS.map(fn => (
                      <option key={fn.value} value={fn.value}>{fn.label}</option>
                    ))}
                  </select>
                  
                  <select
                    value={agg.field}
                    onChange={(e) => updateAggregate(index, { field: e.target.value })}
                    className="field-select"
                  >
                    <option value="*">All (*)</option>
                    {AVAILABLE_FIELDS[query.dataset].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  
                  <input
                    type="text"
                    value={agg.alias}
                    onChange={(e) => updateAggregate(index, { alias: e.target.value })}
                    placeholder="Alias (optional)"
                    className="alias-input"
                  />
                  
                  <button 
                    className="remove-btn"
                    onClick={() => removeAggregate(index)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              
              <button className="add-aggregate-btn" onClick={addAggregate}>
                <Plus size={16} />
                Add Aggregation
              </button>
            </div>
          </div>

          {/* Group By */}
          <div className="query-section">
            <h3>
              <Layers size={16} />
              Group By
            </h3>
            <div className="groupby-list">
              {query.groupBy.map((group, index) => (
                <div key={index} className="groupby-row">
                  <select
                    value={group.field}
                    onChange={(e) => updateGroupBy(index, e.target.value)}
                    className="field-select"
                  >
                    <option value="">Select field...</option>
                    {AVAILABLE_FIELDS[query.dataset].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  
                  <button 
                    className="remove-btn"
                    onClick={() => removeGroupBy(index)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              
              <button className="add-groupby-btn" onClick={addGroupBy}>
                <Plus size={16} />
                Add Group By
              </button>
            </div>
          </div>

          {/* Time Range & Limit */}
          <div className="query-section query-options">
            <div className="option-group">
              <label>
                <Clock size={16} />
                Time Range
              </label>
              <select 
                value={query.timeRange}
                onChange={(e) => setQuery({ ...query, timeRange: e.target.value })}
              >
                <option value="5m">Last 5 minutes</option>
                <option value="15m">Last 15 minutes</option>
                <option value="1h">Last 1 hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
            
            <div className="option-group">
              <label>Limit</label>
              <input
                type="number"
                value={query.limit}
                onChange={(e) => setQuery({ ...query, limit: parseInt(e.target.value) || 100 })}
                min="1"
                max="10000"
              />
            </div>
          </div>

          {/* Query Results */}
          {queryResult && (
            <div className="query-results">
              <div className="results-header">
                <h3>Results</h3>
                <div className="results-info">
                  <span>{queryResult.rowCount} rows</span>
                  <span>•</span>
                  <span>{queryResult.executionTime}ms</span>
                  <button className="export-results-btn" onClick={exportResults}>
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>
              </div>
              
              <div className="results-table-wrapper">
                <table className="results-table">
                  <thead>
                    <tr>
                      {queryResult.columns.map((col, index) => (
                        <th key={index}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Saved Queries Sidebar */}
        <div className="saved-queries-sidebar">
          <h3>
            <Zap size={16} />
            Saved Queries
          </h3>
          <div className="saved-queries-list">
            {savedQueries.map((savedQuery, index) => (
              <div 
                key={index}
                className="saved-query-item"
                onClick={() => loadQuery(savedQuery)}
              >
                <div className="query-name">{savedQuery.name}</div>
                <div className="query-dataset">{savedQuery.dataset}</div>
              </div>
            ))}
            
            {savedQueries.length === 0 && (
              <div className="no-saved-queries">
                No saved queries yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Query Dialog */}
      {showSaveDialog && (
        <div className="save-dialog-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="save-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Save Query</h3>
            <input
              type="text"
              placeholder="Query name"
              value={query.name}
              onChange={(e) => setQuery({ ...query, name: e.target.value })}
              autoFocus
            />
            <div className="dialog-actions">
              <button onClick={() => setShowSaveDialog(false)}>Cancel</button>
              <button onClick={saveQuery} disabled={!query.name}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryBuilderPage;