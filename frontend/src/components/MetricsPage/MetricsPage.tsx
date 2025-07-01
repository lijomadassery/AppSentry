import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Activity, AlertCircle, CheckCircle, Clock, RefreshCw, 
  Filter, Calendar, ChevronDown, Users, Server
} from 'lucide-react';
import './MetricsPage.css';

interface Application {
  id: string;
  name: string;
  team: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  last_check_time: string;
  environment: string;
  namespace: string;
}

interface HealthSummary {
  total: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
}

interface TeamSummary {
  teamName: string;
  totalApplications: number;
  healthyApplications: number;
  healthPercentage: string;
  applications: Application[];
}

interface PlatformSummary {
  summary: HealthSummary;
  timestamp: string;
}

const MetricsPage: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [teamStats, setTeamStats] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval] = useState<number>(30000); // 30 seconds
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');

  const statusColors = {
    healthy: '#10b981',
    unhealthy: '#ef4444',
    unknown: '#6b7280'
  };

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

  const loadPlatformOverview = async () => {
    try {
      const response = await fetch('/api/platform/overview');
      const data = await response.json();
      
      if (response.ok) {
        setPlatformSummary(data);
      } else {
        console.error('Failed to fetch platform overview:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch platform overview:', error);
    }
  };

  const loadTeamStats = async () => {
    try {
      const response = await fetch('/api/platform/teams');
      const data = await response.json();
      
      if (response.ok) {
        setTeamStats(data.teams || []);
      } else {
        console.error('Failed to fetch team stats:', data.error);
        setTeamStats([]);
      }
    } catch (error) {
      console.error('Failed to fetch team stats:', error);
      setTeamStats([]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadApplications(),
        loadPlatformOverview(),
        loadTeamStats()
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const filteredApplications = applications.filter(app => {
    const teamMatch = selectedTeam === 'all' || app.team === selectedTeam;
    const envMatch = selectedEnvironment === 'all' || app.environment === selectedEnvironment;
    return teamMatch && envMatch;
  });

  const teams = Array.from(new Set(applications.map(app => app.team)));
  const environments = Array.from(new Set(applications.map(app => app.environment)));

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'unhealthy':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getHealthPercentage = (healthy: number, total: number) => {
    return total > 0 ? ((healthy / total) * 100).toFixed(1) : '0';
  };

  const pieData = platformSummary ? [
    { name: 'Healthy', value: platformSummary.summary.healthy, color: statusColors.healthy },
    { name: 'Unhealthy', value: platformSummary.summary.unhealthy, color: statusColors.unhealthy },
    { name: 'Unknown', value: platformSummary.summary.unknown, color: statusColors.unknown }
  ] : [];

  const teamHealthData = teamStats.map(team => ({
    name: team.teamName,
    total: team.totalApplications,
    healthy: team.healthyApplications,
    percentage: parseFloat(team.healthPercentage)
  }));

  return (
    <div className="metrics-page">
      <div className="metrics-header">
        <div className="header-left">
          <h1 className="page-title">Application Dashboard</h1>
          <p className="page-subtitle">Monitor and manage your applications</p>
        </div>
        
        <div className="header-controls">
          <div className="filter-group">
            <div className="filter-item">
              <label htmlFor="team-select">Team:</label>
              <select 
                id="team-select"
                value={selectedTeam} 
                onChange={(e) => setSelectedTeam(e.target.value)}
              >
                <option value="all">All Teams</option>
                {teams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-item">
              <label htmlFor="env-select">Environment:</label>
              <select 
                id="env-select"
                value={selectedEnvironment} 
                onChange={(e) => setSelectedEnvironment(e.target.value)}
              >
                <option value="all">All Environments</option>
                {environments.map(env => (
                  <option key={env} value={env}>{env}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            className={`refresh-button ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
        </div>
      ) : (
        <div className="metrics-content">
          {/* Summary Cards */}
          <div className="summary-grid">
            <div className="summary-card">
              <div className="card-icon">
                <Server className="w-6 h-6 text-blue-500" />
              </div>
              <div className="card-content">
                <h3>Total Applications</h3>
                <div className="card-value">{platformSummary?.summary.total || 0}</div>
              </div>
            </div>

            <div className="summary-card">
              <div className="card-icon">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div className="card-content">
                <h3>Healthy Applications</h3>
                <div className="card-value">{platformSummary?.summary.healthy || 0}</div>
                <div className="card-subtitle">
                  {getHealthPercentage(
                    platformSummary?.summary.healthy || 0, 
                    platformSummary?.summary.total || 0
                  )}% health rate
                </div>
              </div>
            </div>

            <div className="summary-card">
              <div className="card-icon">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div className="card-content">
                <h3>Issues Detected</h3>
                <div className="card-value">{platformSummary?.summary.unhealthy || 0}</div>
                <div className="card-subtitle">Require attention</div>
              </div>
            </div>

            <div className="summary-card">
              <div className="card-icon">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div className="card-content">
                <h3>Active Teams</h3>
                <div className="card-value">{teams.length}</div>
                <div className="card-subtitle">Managing applications</div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-grid">
            {/* Application Health Distribution */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Application Health Distribution</h3>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Team Health Overview */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Team Health Overview</h3>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamHealthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="healthy" fill="#10b981" name="Healthy" />
                    <Bar dataKey="total" fill="#e5e7eb" name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Applications List */}
          <div className="applications-section">
            <div className="section-header">
              <h3>Application Status ({filteredApplications.length})</h3>
            </div>
            
            <div className="applications-grid">
              {filteredApplications.map(app => (
                <div key={app.id} className="application-card">
                  <div className="app-header">
                    <div className="app-status">
                      {renderStatusIcon(app.status)}
                    </div>
                    <div className="app-info">
                      <h4 className="app-name">{app.name}</h4>
                      <div className="app-details">
                        <span className="app-team">{app.team}</span>
                        <span className="app-env">{app.environment}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="app-meta">
                    <div className="meta-item">
                      <span className="meta-label">Namespace:</span>
                      <span className="meta-value">{app.namespace}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Last Check:</span>
                      <span className="meta-value">
                        {app.last_check_time ? 
                          new Date(app.last_check_time).toLocaleString() : 
                          'Never'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredApplications.length === 0 && (
              <div className="empty-state">
                <Activity className="w-12 h-12 text-gray-400" />
                <p>No applications found matching the current filters.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricsPage;