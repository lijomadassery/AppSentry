import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Application } from '../../types';
import { ApplicationCard } from '../ApplicationCard/ApplicationCard';
import './ApplicationsGrid.css';

interface ApplicationsGridProps {
  applications: Application[];
  onConfigureApp: (app: Application) => void;
  onRunTest: (appId: string) => void;
  onAddApp: () => void;
  runningTestAppId?: string;
}

type FilterType = 'all' | 'healthy' | 'warning' | 'error';

export const ApplicationsGrid: React.FC<ApplicationsGridProps> = ({
  applications,
  onConfigureApp,
  onRunTest,
  onAddApp,
  runningTestAppId,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const getFilterCounts = () => {
    return {
      all: applications.length,
      healthy: applications.filter(app => app.status === 'healthy').length,
      warning: applications.filter(app => app.status === 'warning').length,
      error: applications.filter(app => app.status === 'error').length,
    };
  };

  const counts = getFilterCounts();

  return (
    <div className="applications-grid-container">
      <div className="grid-header">
        <div className="grid-title">
          <h2>Applications ({filteredApplications.length})</h2>
          <button className="add-app-btn" onClick={onAddApp}>
            <Plus size={16} />
            Add App
          </button>
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({counts.all})
          </button>
          <button
            className={`filter-btn healthy ${filter === 'healthy' ? 'active' : ''}`}
            onClick={() => setFilter('healthy')}
          >
            Healthy ({counts.healthy})
          </button>
          <button
            className={`filter-btn warning ${filter === 'warning' ? 'active' : ''}`}
            onClick={() => setFilter('warning')}
          >
            Warning ({counts.warning})
          </button>
          <button
            className={`filter-btn error ${filter === 'error' ? 'active' : ''}`}
            onClick={() => setFilter('error')}
          >
            Error ({counts.error})
          </button>
        </div>
      </div>

      <div className="applications-grid">
        {filteredApplications.map(app => (
          <ApplicationCard
            key={app.id}
            application={app}
            onConfigure={onConfigureApp}
            onRunTest={onRunTest}
            isTestRunning={runningTestAppId === app.id}
          />
        ))}

        {filteredApplications.length === 0 && (
          <div className="empty-state">
            <div className="empty-content">
              <h3>No applications found</h3>
              <p>
                {filter === 'all'
                  ? 'Get started by adding your first application.'
                  : `No applications with ${filter} status.`}
              </p>
              {filter === 'all' && (
                <button className="add-app-btn primary" onClick={onAddApp}>
                  <Plus size={16} />
                  Add Your First App
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};