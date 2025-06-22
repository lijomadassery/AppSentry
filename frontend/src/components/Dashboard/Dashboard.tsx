import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Server } from 'lucide-react';
import { Header } from '../Header/Header';
import { ApplicationsGrid } from '../ApplicationsGrid/ApplicationsGrid';
import { Sidebar } from '../Sidebar/Sidebar';
import { ApplicationModal } from '../ApplicationModal/ApplicationModal';
import { ReportsModal } from '../ReportsModal/ReportsModal';
import { WebSocketDemo } from '../WebSocketDemo/WebSocketDemo';
import { LeftNavigation } from '../LeftNavigation/LeftNavigation';
import { OverviewCards } from '../OverviewCards/OverviewCards';
import { ApplicationsPage } from '../ApplicationsPage/ApplicationsPage';
import { TestResultsPage } from '../TestResultsPage/TestResultsPage';
import { AnalyticsPage } from '../AnalyticsPage/AnalyticsPage';
import { TeamPage } from '../TeamPage/TeamPage';
import { NotificationsPage } from '../NotificationsPage/NotificationsPage';
import TracesPage from '../TracesPage/TracesPage';
import MetricsPage from '../MetricsPage/MetricsPage';
import LogsPage from '../LogsPage/LogsPage';
import ServiceMapPage from '../ServiceMapPage/ServiceMapPage';
import QueryBuilderPage from '../QueryBuilderPage/QueryBuilderPage';
import { GlobalMessage } from '../GlobalMessage/GlobalMessage';
import { PerformanceMonitor } from '../PerformanceMonitor/PerformanceMonitor';
import { PlatformMetrics } from '../PlatformMetrics/PlatformMetrics';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../contexts/ThemeContext';
import { useApp } from '../../contexts/AppContext';
import { webSocketSimulator } from '../../services/websocketSimulator';
import { testApi } from '../../services/api';
import { Application, User, TestRun } from '../../types';
import { mockApplications, mockStats } from '../../data/mockData';
import './Dashboard.css';

const WEBSOCKET_URL = process.env.REACT_APP_WS_URL || 'http://localhost:3001';

// Mock user data - in real app this would come from auth context
const mockUser: User = {
  id: '1',
  displayName: 'John Doe',
  email: 'john.doe@company.com',
  role: 'admin',
};

export const Dashboard: React.FC = () => {
  // Get state and actions from AppContext
  const { 
    state, 
    dispatch,
    loadApplications, 
    loadStats,
    loadClusterMetrics,
    loadKubernetesHealth,
    addApplication,
    updateApplication,
    deleteApplication,
    startTestRun
  } = useApp();
  
  const {
    applications,
    stats,
    clusterMetrics,
    clusterMetricsLoading,
    clusterMetricsError,
    kubernetesHealth,
    currentTestRun,
    applicationsLoading,
    statsLoading,
    activeRoute,
    isNavCollapsed,
    isMobileMenuOpen,
    isDarkMode
  } = state;

  // Local modal state (not shared globally)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showAppModal, setShowAppModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  
  // Theme
  const { toggleTheme } = useTheme();

  const { 
    connected, 
    connecting, 
    testProgress, 
    activities, 
    subscribeToTestRun, 
    unsubscribeFromTestRun,
    reconnect,
    onApplicationUpdate,
    onTestRunCompleted,
    onNotification,
  } = useWebSocket(WEBSOCKET_URL);

  // Note: Initial data loading is now handled in AppContext

  // WebSocket event handlers
  useEffect(() => {
    if (currentTestRun) {
      subscribeToTestRun(currentTestRun.id);
    }
    
    return () => {
      if (currentTestRun) {
        unsubscribeFromTestRun(currentTestRun.id);
      }
    };
  }, [currentTestRun, subscribeToTestRun, unsubscribeFromTestRun]);

  // Handle real-time application updates
  useEffect(() => {
    onApplicationUpdate((updatedApp: Application) => {
      dispatch({ 
        type: 'APPLICATION_UPDATE', 
        payload: { id: updatedApp.id, updates: updatedApp } 
      });
      
      // Update stats when application status changes
      loadStats();
    });
  }, [onApplicationUpdate, dispatch, loadStats]);

  // Handle test run completion
  useEffect(() => {
    onTestRunCompleted((testRunId: string) => {
      if (currentTestRun?.id === testRunId) {
        dispatch({ type: 'TEST_RUN_COMPLETE', payload: testRunId });
        // Refresh applications and stats after test completion
        loadApplications();
        loadStats();
      }
    });
  }, [onTestRunCompleted, currentTestRun?.id, dispatch, loadApplications, loadStats]);

  // Handle notifications
  useEffect(() => {
    onNotification((notification: any) => {
      // Show notification toast
      if (notification.type === 'error') {
        dispatch({ 
          type: 'SHOW_MESSAGE', 
          payload: { type: 'error', message: notification.message } 
        });
      }
    });
  }, [onNotification, dispatch]);

  // Setup WebSocket simulator for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Connect simulator events to WebSocket hook events
      webSocketSimulator.on('testRunStarted', (data: any) => {
        // Simulate starting a test run in the UI
        const testRun: TestRun = {
          id: data.testRunId,
          status: 'running',
          applications: applications.map(app => app.id),
          progressTotal: data.applicationCount * 2,
          progressCompleted: 0,
          startedAt: new Date(),
        };
        startTestRun(testRun);
      });

      webSocketSimulator.on('testRunCompleted', () => {
        dispatch({ type: 'TEST_RUN_COMPLETE' });
      });

      webSocketSimulator.on('testRunCancelled', () => {
        dispatch({ type: 'TEST_RUN_CANCEL' });
      });
    }
  }, [applications, startTestRun, dispatch]);

  const handleRunAllTests = async () => {
    try {
      console.log('Starting health checks for all applications...');
      const response = await testApi.runAll();
      const testRun: TestRun = {
        id: response.testRunId,
        status: 'running',
        applications: applications.map(app => app.id),
        progressTotal: applications.length * 2, // Health check + login test
        progressCompleted: 0,
        startedAt: new Date(),
      };
      startTestRun(testRun);
      console.log('Health checks started successfully:', response.testRunId);
    } catch (err) {
      console.error('Failed to start test run:', err);
      dispatch({ 
        type: 'SHOW_MESSAGE', 
        payload: { type: 'error', message: 'Failed to start health checks. Please check your connection.' }
      });
    }
  };

  const handleRunSingleTest = async (appId: string) => {
    try {
      const response = await testApi.runSingle(appId);
      const testRun: TestRun = {
        id: response.testRunId,
        status: 'running',
        applications: [appId],
        progressTotal: 2, // Health check + login test
        progressCompleted: 0,
        startedAt: new Date(),
      };
      startTestRun(testRun);
    } catch (err) {
      console.error('Failed to start single test:', err);
      dispatch({ 
        type: 'SHOW_MESSAGE', 
        payload: { type: 'error', message: 'Failed to start test' }
      });
    }
  };

  const handleCancelTest = async () => {
    if (currentTestRun) {
      try {
        await testApi.cancel(currentTestRun.id);
        dispatch({ type: 'TEST_RUN_CANCEL' });
      } catch (err) {
        console.error('Failed to cancel test:', err);
        dispatch({ 
          type: 'SHOW_MESSAGE', 
          payload: { type: 'error', message: 'Failed to cancel test' }
        });
      }
    }
  };

  const handleConfigureApp = (app: Application) => {
    setSelectedApp(app);
    setShowAppModal(true);
  };

  const handleAddApp = () => {
    setSelectedApp(null);
    setShowAppModal(true);
  };

  const handleSaveApp = async (appData: Partial<Application>) => {
    try {
      if (selectedApp) {
        // Update existing app
        await updateApplication(selectedApp.id, appData);
      } else {
        // Create new app
        await addApplication(appData);
      }
      
      setShowAppModal(false);
      setSelectedApp(null);
    } catch (err) {
      // Error handling is done in the context functions
      console.error('Failed to save application:', err);
    }
  };

  const handleDeleteApp = async (appId: string) => {
    const app = applications.find(a => a.id === appId);
    const appName = app ? app.name : 'application';
    
    if (!window.confirm(`Are you sure you want to delete "${appName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteApplication(appId);
    } catch (err) {
      // Error handling is done in the context function
      console.error('Failed to delete application:', err);
    }
  };

  // WebSocket simulation handlers
  const handleSimulateTest = () => {
    if (process.env.NODE_ENV === 'development' && !webSocketSimulator.isRunning()) {
      webSocketSimulator.simulateTestRun(applications);
    }
  };

  const handleSimulateStatusUpdate = () => {
    if (process.env.NODE_ENV === 'development' && applications.length > 0) {
      const randomApp = applications[Math.floor(Math.random() * applications.length)];
      webSocketSimulator.simulateApplicationStatusUpdate(randomApp);
    }
  };

  const handleSimulateActivity = () => {
    if (process.env.NODE_ENV === 'development') {
      webSocketSimulator.simulateRandomActivity();
    }
  };

  // Navigation handlers
  const handleToggleNavCollapse = () => {
    dispatch({ type: 'NAV_TOGGLE_COLLAPSE' });
  };

  const handleRouteChange = (route: string) => {
    dispatch({ type: 'ROUTE_CHANGE', payload: route });
  };

  const handleToggleMobileMenu = () => {
    dispatch({ type: 'MOBILE_MENU_TOGGLE' });
  };

  const handleRefreshPlatformMetrics = async () => {
    try {
      await Promise.all([
        loadClusterMetrics(),
        loadKubernetesHealth()
      ]);
    } catch (error) {
      console.error('Failed to refresh platform metrics:', error);
    }
  };

  // Mock functions for page components
  const handleAddTeamMember = () => {
    console.log('Add team member');
  };

  const handleEditTeamMember = (member: any) => {
    console.log('Edit team member:', member);
  };

  const handleDeleteTeamMember = (memberId: string) => {
    console.log('Delete team member:', memberId);
  };

  const handleResendInvite = (memberId: string) => {
    console.log('Resend invite:', memberId);
  };

  const handleViewTestDetails = (result: any) => {
    console.log('View test details:', result);
  };

  const handleExportResults = (results: any[]) => {
    console.log('Export results:', results);
  };

  const handleMarkNotificationAsRead = (notificationId: string) => {
    console.log('Mark as read:', notificationId);
  };

  const handleMarkAllNotificationsAsRead = () => {
    console.log('Mark all as read');
  };

  const handleDeleteNotification = (notificationId: string) => {
    console.log('Delete notification:', notificationId);
  };

  const handleUpdateNotificationPreferences = (preferences: any) => {
    console.log('Update preferences:', preferences);
  };

  // Render the appropriate page based on active route
  const renderPageContent = () => {
    switch (activeRoute) {
      case 'applications':
        return (
          <ApplicationsPage
            applications={Array.isArray(applications) ? applications : []}
            onConfigureApp={handleConfigureApp}
            onRunTest={handleRunSingleTest}
            onAddApp={handleAddApp}
            onDeleteApp={handleDeleteApp}
            runningTestAppId={runningTestAppId}
          />
        );
      case 'test-results':
        return (
          <TestResultsPage
            results={[]}
            onRunTest={handleRunSingleTest}
            onViewDetails={handleViewTestDetails}
            onExportResults={handleExportResults}
          />
        );
      case 'analytics':
        return (
          <AnalyticsPage
            applications={applications}
            testResults={[]}
          />
        );
      case 'traces':
        return <TracesPage />;
      case 'metrics':
        return <MetricsPage />;
      case 'logs':
        return <LogsPage />;
      case 'service-map':
        return <ServiceMapPage />;
      case 'query-builder':
        return <QueryBuilderPage />;
      case 'team':
        return (
          <TeamPage
            members={[]}
            onAddMember={handleAddTeamMember}
            onEditMember={handleEditTeamMember}
            onDeleteMember={handleDeleteTeamMember}
            onResendInvite={handleResendInvite}
            currentUserRole="admin"
          />
        );
      case 'notifications':
        return (
          <NotificationsPage
            notifications={[]}
            preferences={{
              email: true,
              browser: true,
              mobile: false,
              sound: true,
              types: {
                alerts: true,
                testResults: true,
                systemUpdates: true,
                teamActivity: false,
              },
            }}
            onMarkAsRead={handleMarkNotificationAsRead}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            onDeleteNotification={handleDeleteNotification}
            onUpdatePreferences={handleUpdateNotificationPreferences}
          />
        );
      case 'settings':
        return (
          <div className="settings-placeholder">
            <h2>Settings</h2>
            <p>Settings page coming soon...</p>
          </div>
        );
      default:
        return (
          <>
            {/* Overview Cards */}
            <OverviewCards stats={stats} />
            
            {/* Platform Infrastructure Metrics */}
            <PlatformMetrics
              clusterMetrics={clusterMetrics}
              kubernetesHealth={kubernetesHealth}
              loading={clusterMetricsLoading}
              error={clusterMetricsError}
              onRefresh={handleRefreshPlatformMetrics}
            />
            
            {/* Quick Navigation Bar */}
            <div className="quick-navigation-bar">
              <div className="nav-actions-horizontal">
                <button 
                  className="nav-btn applications"
                  onClick={() => handleRouteChange('applications')}
                  title="Manage Applications"
                >
                  <Server size={18} />
                  <span>Applications</span>
                </button>
                <button 
                  className="nav-btn monitoring"
                  onClick={() => handleRouteChange('traces')}
                  title="View Monitoring Tools"
                >
                  <Activity size={18} />
                  <span>Monitor</span>
                </button>
                <button 
                  className="nav-btn alerts"
                  onClick={() => handleRouteChange('notifications')}
                  title="View Active Alerts"
                >
                  <AlertTriangle size={18} />
                  <span>Alerts</span>
                  {(stats.errorCount + stats.warningCount > 0) && (
                    <div className="alert-badge">
                      {stats.errorCount + stats.warningCount}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Mission Control Center */}
            <div className="mission-control-center">
              <div className="control-panel">
                <h3>Mission Control</h3>
                <div className="primary-actions">
                  <button
                    className={`control-btn primary extra-large ${isTestRunning ? 'running' : ''}`}
                    onClick={handleRunAllTests}
                    disabled={isTestRunning}
                  >
                    <Activity size={24} />
                    <span>{isTestRunning ? 'Running Health Checks...' : 'Run All Health Checks'}</span>
                    {isTestRunning && <div className="loading-spinner"></div>}
                  </button>
                </div>
              </div>

              <div className="status-overview">
                <h3>System Status</h3>
                <div className="status-cards horizontal-layout">
                  <div className="status-card healthy">
                    <div className="status-count">{stats.healthyCount}</div>
                    <div className="status-label">Healthy</div>
                  </div>
                  <div className="status-card warning">
                    <div className="status-count">{stats.warningCount}</div>
                    <div className="status-label">Warning</div>
                  </div>
                  <div className="status-card error">
                    <div className="status-count">{stats.errorCount}</div>
                    <div className="status-label">Critical</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="dashboard-body">
              <div className="main-content">
                {/* Dashboard Summary - High level overview only */}
                <div className="dashboard-summary">
                  <div className="summary-section">
                    <h2>Platform Overview</h2>
                    <p>Your centralized mission control for monitoring and managing all applications.</p>
                    <div className="quick-stats">
                      <div className="stat-card">
                        <h3>{stats.totalApplications}</h3>
                        <p>Total Applications</p>
                      </div>
                      <div className="stat-card">
                        <h3>{Math.round((stats.healthyCount / stats.totalApplications) * 100)}%</h3>
                        <p>Overall Health</p>
                      </div>
                      <div className="stat-card">
                        <h3>{stats.averageResponseTime}ms</h3>
                        <p>Avg Response Time</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Sidebar
                testProgress={testProgress}
                activities={activities}
                connected={connected}
                connecting={connecting}
                onCancelTest={isTestRunning ? handleCancelTest : undefined}
                onReconnect={reconnect}
              />
            </div>
          </>
        );
    }
  };

  const isTestRunning = currentTestRun?.status === 'running';
  const runningTestAppId = isTestRunning && currentTestRun?.applications.length === 1 
    ? currentTestRun.applications[0] 
    : undefined;

  if (applicationsLoading && applications.length === 0) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard modern-layout">
      {/* Left Navigation */}
      <LeftNavigation
        isCollapsed={isNavCollapsed}
        onToggleCollapse={handleToggleNavCollapse}
        activeRoute={activeRoute}
        onRouteChange={handleRouteChange}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => dispatch({ type: 'THEME_TOGGLE' })}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={handleToggleMobileMenu}
      />

      {/* Main Content Area */}
      <div className={`dashboard-main ${isNavCollapsed ? 'nav-collapsed' : 'nav-expanded'}`}>
        {/* Header with hamburger menu for mobile */}
        <Header
          user={mockUser}
          onToggleMobileMenu={handleToggleMobileMenu}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        {/* Dashboard Content */}
        <div className="dashboard-content">
          {renderPageContent()}
        </div>
      </div>

      {showAppModal && (
        <ApplicationModal
          application={selectedApp}
          onSave={handleSaveApp}
          onDelete={selectedApp ? () => handleDeleteApp(selectedApp.id) : undefined}
          onClose={() => {
            setShowAppModal(false);
            setSelectedApp(null);
          }}
        />
      )}

      {showReportsModal && (
        <ReportsModal
          onClose={() => setShowReportsModal(false)}
        />
      )}

      {/* Global Message Toast */}
      <GlobalMessage />

      {!connected && (
        <div className="connection-status">
          <span>⚠️ Real-time updates unavailable</span>
        </div>
      )}

      <WebSocketDemo
        onSimulateTest={handleSimulateTest}
        onSimulateStatusUpdate={handleSimulateStatusUpdate}
        onSimulateActivity={handleSimulateActivity}
        isTestRunning={isTestRunning || webSocketSimulator.isRunning()}
      />
      
      {/* Performance Monitor - Development Only */}
      <PerformanceMonitor />
    </div>
  );
};