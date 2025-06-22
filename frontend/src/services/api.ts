import axios from 'axios';
import { Application, TestRun, DashboardStats } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Applications API
export const applicationApi = {
  getAll: async (): Promise<Application[]> => {
    const response = await api.get('/applications');
    return response.data;
  },

  getById: async (id: string): Promise<Application> => {
    const response = await api.get(`/applications/${id}`);
    return response.data;
  },

  create: async (application: Partial<Application>): Promise<Application> => {
    const response = await api.post('/applications', application);
    return response.data;
  },

  update: async (id: string, application: Partial<Application>): Promise<Application> => {
    const response = await api.put(`/applications/${id}`, application);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/applications/${id}`);
  },

  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/applications/stats');
    return response.data;
  },
};

// Tests API
export const testApi = {
  runAll: async (): Promise<{ testRunId: string }> => {
    const response = await api.post('/tests/run-all');
    return response.data;
  },

  runApps: async (applicationIds: string[]): Promise<{ testRunId: string }> => {
    const response = await api.post('/tests/run-apps', { applications: applicationIds });
    return response.data;
  },

  runSingle: async (applicationId: string): Promise<{ testRunId: string }> => {
    const response = await api.post(`/tests/${applicationId}/test`);
    return response.data;
  },

  getStatus: async (testRunId: string): Promise<any> => {
    const response = await api.get(`/tests/status/${testRunId}`);
    return response.data;
  },

  getHistory: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    applicationId?: string;
  }): Promise<{
    testRuns: TestRun[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const response = await api.get('/tests/history', { params });
    return response.data;
  },

  getTestRun: async (testRunId: string): Promise<TestRun> => {
    const response = await api.get(`/tests/${testRunId}`);
    return response.data;
  },

  cancel: async (testRunId: string): Promise<void> => {
    await api.delete(`/tests/${testRunId}`);
  },

  retry: async (testRunId: string): Promise<{ testRunId: string }> => {
    const response = await api.post(`/tests/${testRunId}/retry`);
    return response.data;
  },
};

// Auth API
export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('authToken');
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
};

// Health API
export const healthApi = {
  // Frontend health check with backend connectivity test
  checkHealth: async (): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    service: string;
    version: string;
    checks: {
      frontend: string;
      backend?: string;
      backend_details?: any;
    };
  }> => {
    try {
      // Test backend connectivity
      const backendResponse = await axios.get('http://localhost:3001/health', {
        timeout: 5000
      });
      
      return {
        status: backendResponse.data.status === 'healthy' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        service: 'appsentry-frontend',
        version: '0.1.0',
        checks: {
          frontend: 'healthy',
          backend: backendResponse.data.status,
          backend_details: backendResponse.data
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        service: 'appsentry-frontend',
        version: '0.1.0',
        checks: {
          frontend: 'healthy',
          backend: 'unreachable'
        }
      };
    }
  },

  // Simple static health check
  getStaticHealth: async (): Promise<any> => {
    const response = await axios.get('/health.json');
    return response.data;
  }
};

export default api;