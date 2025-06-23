import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Application, DashboardStats, TestRun, User } from '../types';
import { applicationApi } from '../services/api';
import { platformMetricsApi, ClusterMetrics, KubernetesHealth } from '../services/platformMetricsApi';
import { healthCheckApi, HealthMetrics } from '../services/healthCheckApi';

// State Types
interface AppState {
  // Applications
  applications: Application[];
  applicationsLoading: boolean;
  applicationsError: string | null;
  
  // Dashboard Stats
  stats: DashboardStats;
  statsLoading: boolean;
  statsError: string | null;
  
  // Platform Metrics (Kubernetes)
  clusterMetrics: ClusterMetrics | null;
  clusterMetricsLoading: boolean;
  clusterMetricsError: string | null;
  kubernetesHealth: KubernetesHealth | null;
  
  // Health Check Metrics
  healthMetrics: HealthMetrics | null;
  healthMetricsLoading: boolean;
  healthMetricsError: string | null;
  
  // Test Runs
  currentTestRun: TestRun | null;
  testRunHistory: TestRun[];
  
  // User & UI
  user: User | null;
  isAuthenticated: boolean;
  
  // Navigation
  activeRoute: string;
  isNavCollapsed: boolean;
  isMobileMenuOpen: boolean;
  
  // Theme
  isDarkMode: boolean;
  
  // Global Error/Success Messages
  globalMessage: {
    type: 'success' | 'error' | 'warning' | 'info' | null;
    message: string;
    timestamp?: number;
  } | null;
}

// Action Types
type AppAction =
  // Applications
  | { type: 'APPLICATIONS_LOADING'; payload?: boolean }
  | { type: 'APPLICATIONS_SUCCESS'; payload: Application[] }
  | { type: 'APPLICATIONS_ERROR'; payload: string }
  | { type: 'APPLICATION_ADD'; payload: Application }
  | { type: 'APPLICATION_UPDATE'; payload: { id: string; updates: Partial<Application> } }
  | { type: 'APPLICATION_DELETE'; payload: string }
  
  // Dashboard Stats
  | { type: 'STATS_LOADING'; payload?: boolean }
  | { type: 'STATS_SUCCESS'; payload: DashboardStats }
  | { type: 'STATS_ERROR'; payload: string }
  
  // Platform Metrics (Kubernetes)
  | { type: 'CLUSTER_METRICS_LOADING'; payload?: boolean }
  | { type: 'CLUSTER_METRICS_SUCCESS'; payload: ClusterMetrics }
  | { type: 'CLUSTER_METRICS_ERROR'; payload: string }
  | { type: 'KUBERNETES_HEALTH_UPDATE'; payload: KubernetesHealth }
  
  // Health Check Metrics
  | { type: 'HEALTH_METRICS_LOADING'; payload?: boolean }
  | { type: 'HEALTH_METRICS_SUCCESS'; payload: HealthMetrics }
  | { type: 'HEALTH_METRICS_ERROR'; payload: string }
  
  // Test Runs
  | { type: 'TEST_RUN_START'; payload: TestRun }
  | { type: 'TEST_RUN_UPDATE'; payload: Partial<TestRun> }
  | { type: 'TEST_RUN_COMPLETE'; payload?: string }
  | { type: 'TEST_RUN_CANCEL' }
  
  // User & Auth
  | { type: 'USER_LOGIN'; payload: User }
  | { type: 'USER_LOGOUT' }
  | { type: 'USER_UPDATE'; payload: Partial<User> }
  
  // Navigation
  | { type: 'ROUTE_CHANGE'; payload: string }
  | { type: 'NAV_TOGGLE_COLLAPSE' }
  | { type: 'MOBILE_MENU_TOGGLE' }
  
  // Theme
  | { type: 'THEME_TOGGLE' }
  | { type: 'THEME_SET'; payload: boolean }
  
  // Global Messages
  | { type: 'SHOW_MESSAGE'; payload: { type: 'success' | 'error' | 'warning' | 'info'; message: string } }
  | { type: 'CLEAR_MESSAGE' };

// Initial State
const initialState: AppState = {
  applications: [],
  applicationsLoading: false,
  applicationsError: null,
  
  stats: {
    totalApplications: 0,
    healthyCount: 0,
    warningCount: 0,
    errorCount: 0,
    overallHealth: 0,
    averageResponseTime: 0,
    totalUptime: 0,
    slaCompliance: 0,
  },
  statsLoading: false,
  statsError: null,
  
  clusterMetrics: null,
  clusterMetricsLoading: false,
  clusterMetricsError: null,
  kubernetesHealth: null,
  
  healthMetrics: null,
  healthMetricsLoading: false,
  healthMetricsError: null,
  
  currentTestRun: null,
  testRunHistory: [],
  
  user: null,
  isAuthenticated: false,
  
  activeRoute: 'dashboard',
  isNavCollapsed: false,
  isMobileMenuOpen: false,
  
  isDarkMode: localStorage.getItem('theme') === 'dark',
  
  globalMessage: null,
};

// Reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    // Applications
    case 'APPLICATIONS_LOADING':
      return {
        ...state,
        applicationsLoading: action.payload ?? true,
        applicationsError: null,
      };
      
    case 'APPLICATIONS_SUCCESS':
      return {
        ...state,
        applications: action.payload,
        applicationsLoading: false,
        applicationsError: null,
      };
      
    case 'APPLICATIONS_ERROR':
      return {
        ...state,
        applicationsLoading: false,
        applicationsError: action.payload,
      };
      
    case 'APPLICATION_ADD':
      return {
        ...state,
        applications: [...state.applications, action.payload],
      };
      
    case 'APPLICATION_UPDATE':
      return {
        ...state,
        applications: state.applications.map(app =>
          app.id === action.payload.id 
            ? { ...app, ...action.payload.updates }
            : app
        ),
      };
      
    case 'APPLICATION_DELETE':
      return {
        ...state,
        applications: state.applications.filter(app => app.id !== action.payload),
      };
      
    // Dashboard Stats
    case 'STATS_LOADING':
      return {
        ...state,
        statsLoading: action.payload ?? true,
        statsError: null,
      };
      
    case 'STATS_SUCCESS':
      return {
        ...state,
        stats: action.payload,
        statsLoading: false,
        statsError: null,
      };
      
    case 'STATS_ERROR':
      return {
        ...state,
        statsLoading: false,
        statsError: action.payload,
      };
      
    // Platform Metrics (Kubernetes)
    case 'CLUSTER_METRICS_LOADING':
      return {
        ...state,
        clusterMetricsLoading: action.payload ?? true,
        clusterMetricsError: null,
      };
      
    case 'CLUSTER_METRICS_SUCCESS':
      return {
        ...state,
        clusterMetrics: action.payload,
        clusterMetricsLoading: false,
        clusterMetricsError: null,
      };
      
    case 'CLUSTER_METRICS_ERROR':
      return {
        ...state,
        clusterMetricsLoading: false,
        clusterMetricsError: action.payload,
      };
      
    case 'KUBERNETES_HEALTH_UPDATE':
      return {
        ...state,
        kubernetesHealth: action.payload,
      };
      
    // Health Check Metrics
    case 'HEALTH_METRICS_LOADING':
      return {
        ...state,
        healthMetricsLoading: action.payload ?? true,
        healthMetricsError: null,
      };
      
    case 'HEALTH_METRICS_SUCCESS':
      return {
        ...state,
        healthMetrics: action.payload,
        healthMetricsLoading: false,
        healthMetricsError: null,
      };
      
    case 'HEALTH_METRICS_ERROR':
      return {
        ...state,
        healthMetricsLoading: false,
        healthMetricsError: action.payload,
      };
      
    // Test Runs
    case 'TEST_RUN_START':
      return {
        ...state,
        currentTestRun: action.payload,
      };
      
    case 'TEST_RUN_UPDATE':
      return {
        ...state,
        currentTestRun: state.currentTestRun 
          ? { ...state.currentTestRun, ...action.payload }
          : null,
      };
      
    case 'TEST_RUN_COMPLETE':
      return {
        ...state,
        currentTestRun: null,
        testRunHistory: state.currentTestRun 
          ? [{ ...state.currentTestRun, status: 'completed' }, ...state.testRunHistory.slice(0, 9)]
          : state.testRunHistory,
      };
      
    case 'TEST_RUN_CANCEL':
      return {
        ...state,
        currentTestRun: null,
      };
      
    // User & Auth
    case 'USER_LOGIN':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
      };
      
    case 'USER_LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
      };
      
    case 'USER_UPDATE':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
      
    // Navigation
    case 'ROUTE_CHANGE':
      return {
        ...state,
        activeRoute: action.payload,
        isMobileMenuOpen: false, // Close mobile menu on route change
      };
      
    case 'NAV_TOGGLE_COLLAPSE':
      return {
        ...state,
        isNavCollapsed: !state.isNavCollapsed,
      };
      
    case 'MOBILE_MENU_TOGGLE':
      return {
        ...state,
        isMobileMenuOpen: !state.isMobileMenuOpen,
      };
      
    // Theme
    case 'THEME_TOGGLE':
      const newTheme = !state.isDarkMode;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light');
      return {
        ...state,
        isDarkMode: newTheme,
      };
      
    case 'THEME_SET':
      localStorage.setItem('theme', action.payload ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', action.payload ? 'dark' : 'light');
      return {
        ...state,
        isDarkMode: action.payload,
      };
      
    // Global Messages
    case 'SHOW_MESSAGE':
      return {
        ...state,
        globalMessage: {
          ...action.payload,
          timestamp: Date.now(),
        },
      };
      
    case 'CLEAR_MESSAGE':
      return {
        ...state,
        globalMessage: null,
      };
      
    default:
      return state;
  }
};

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  
  // Helper functions
  loadApplications: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadClusterMetrics: () => Promise<void>;
  loadKubernetesHealth: () => Promise<void>;
  loadHealthMetrics: () => Promise<void>;
  addApplication: (app: Partial<Application>) => Promise<void>;
  updateApplication: (id: string, updates: Partial<Application>) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  startTestRun: (testRun: TestRun) => void;
  showMessage: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  clearMessage: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider Component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    dispatch({ type: 'THEME_SET', payload: shouldUseDark });
  }, []);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (state.globalMessage) {
      const timer = setTimeout(() => {
        dispatch({ type: 'CLEAR_MESSAGE' });
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [state.globalMessage]);

  // Helper Functions - Memoized to prevent infinite re-renders
  const loadApplications = useCallback(async () => {
    dispatch({ type: 'APPLICATIONS_LOADING' });
    try {
      const apps = await applicationApi.getAll();
      dispatch({ type: 'APPLICATIONS_SUCCESS', payload: apps });
    } catch (error) {
      console.error('Failed to load applications:', error);
      dispatch({ type: 'APPLICATIONS_ERROR', payload: 'Failed to load applications' });
    }
  }, []);

  const loadStats = useCallback(async () => {
    dispatch({ type: 'STATS_LOADING' });
    try {
      const stats = await applicationApi.getStats();
      dispatch({ type: 'STATS_SUCCESS', payload: stats });
    } catch (error) {
      console.error('Failed to load stats:', error);
      dispatch({ type: 'STATS_ERROR', payload: 'Failed to load dashboard statistics' });
    }
  }, []);

  const addApplication = useCallback(async (appData: Partial<Application>) => {
    try {
      const newApp = await applicationApi.create(appData);
      dispatch({ type: 'APPLICATION_ADD', payload: newApp });
      dispatch({ type: 'SHOW_MESSAGE', payload: { type: 'success', message: `Application "${newApp.name}" created successfully` } });
      
      // Refresh stats
      loadStats();
    } catch (error) {
      console.error('Failed to create application:', error);
      dispatch({ type: 'SHOW_MESSAGE', payload: { type: 'error', message: 'Failed to create application' } });
      throw error;
    }
  }, [loadStats]);

  const updateApplication = useCallback(async (id: string, updates: Partial<Application>) => {
    try {
      const updatedApp = await applicationApi.update(id, updates);
      dispatch({ type: 'APPLICATION_UPDATE', payload: { id, updates: updatedApp } });
      dispatch({ type: 'SHOW_MESSAGE', payload: { type: 'success', message: `Application "${updatedApp.name}" updated successfully` } });
      
      // Refresh stats
      loadStats();
    } catch (error) {
      console.error('Failed to update application:', error);
      dispatch({ type: 'SHOW_MESSAGE', payload: { type: 'error', message: 'Failed to update application' } });
      throw error;
    }
  }, [loadStats]);

  const deleteApplication = useCallback(async (id: string) => {
    const app = state.applications.find(a => a.id === id);
    const appName = app?.name || 'application';
    
    try {
      await applicationApi.delete(id);
      dispatch({ type: 'APPLICATION_DELETE', payload: id });
      dispatch({ type: 'SHOW_MESSAGE', payload: { type: 'success', message: `Application "${appName}" deleted successfully` } });
      
      // Refresh stats
      loadStats();
    } catch (error) {
      console.error('Failed to delete application:', error);
      dispatch({ type: 'SHOW_MESSAGE', payload: { type: 'error', message: `Failed to delete "${appName}"` } });
      throw error;
    }
  }, [state.applications, loadStats]);

  const startTestRun = useCallback((testRun: TestRun) => {
    dispatch({ type: 'TEST_RUN_START', payload: testRun });
  }, []);

  const showMessage = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    dispatch({ type: 'SHOW_MESSAGE', payload: { type, message } });
  }, []);

  const loadClusterMetrics = useCallback(async () => {
    dispatch({ type: 'CLUSTER_METRICS_LOADING' });
    try {
      const response = await platformMetricsApi.getClusterMetrics();
      dispatch({ type: 'CLUSTER_METRICS_SUCCESS', payload: response.cluster });
    } catch (error) {
      console.error('Failed to load cluster metrics:', error);
      dispatch({ type: 'CLUSTER_METRICS_ERROR', payload: 'Failed to load Kubernetes cluster metrics' });
    }
  }, []);

  const loadKubernetesHealth = useCallback(async () => {
    try {
      const health = await platformMetricsApi.getKubernetesHealth();
      dispatch({ type: 'KUBERNETES_HEALTH_UPDATE', payload: health });
    } catch (error) {
      console.error('Failed to load Kubernetes health:', error);
      dispatch({ type: 'KUBERNETES_HEALTH_UPDATE', payload: { isConnected: false, status: 'disconnected', timestamp: new Date().toISOString() } });
    }
  }, []);

  const loadHealthMetrics = useCallback(async () => {
    dispatch({ type: 'HEALTH_METRICS_LOADING' });
    try {
      const metrics = await healthCheckApi.getHealthMetrics();
      dispatch({ type: 'HEALTH_METRICS_SUCCESS', payload: metrics });
    } catch (error) {
      console.error('Failed to load health metrics:', error);
      dispatch({ type: 'HEALTH_METRICS_ERROR', payload: 'Failed to load health check metrics' });
    }
  }, []);

  const clearMessage = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGE' });
  }, []);

  // Load initial data on app startup - placed after function definitions
  useEffect(() => {
    loadApplications();
    loadStats();
    loadClusterMetrics();
    loadKubernetesHealth();
    loadHealthMetrics();
  }, [loadApplications, loadStats, loadClusterMetrics, loadKubernetesHealth, loadHealthMetrics]);

  const contextValue = useMemo(() => ({
    state,
    dispatch,
    loadApplications,
    loadStats,
    loadClusterMetrics,
    loadKubernetesHealth,
    loadHealthMetrics,
    addApplication,
    updateApplication,
    deleteApplication,
    startTestRun,
    showMessage,
    clearMessage,
  }), [
    state,
    loadApplications,
    loadStats,
    loadClusterMetrics,
    loadKubernetesHealth,
    loadHealthMetrics,
    addApplication,
    updateApplication,
    deleteApplication,
    startTestRun,
    showMessage,
    clearMessage,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Custom Hook
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;