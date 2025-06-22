import api from './api';

export interface NodeMetrics {
  name: string;
  cpu: {
    usage: string;
    capacity: string;
    percentage: number;
  };
  memory: {
    usage: string;
    capacity: string;
    percentage: number;
  };
  conditions: any[];
  ready: boolean;
}

export interface PodMetrics {
  namespace: string;
  name: string;
  status: string;
  restarts: number;
  cpu?: string;
  memory?: string;
  node: string;
}

export interface ClusterMetrics {
  nodes: {
    total: number;
    ready: number;
    metrics: NodeMetrics[];
  };
  pods: {
    total: number;
    running: number;
    pending: number;
    failed: number;
    byNamespace: Record<string, number>;
  };
  deployments: {
    total: number;
    available: number;
    byNamespace: Record<string, number>;
  };
  events: {
    recent: any[];
    warnings: any[];
  };
}

export interface PlatformOverview {
  summary: {
    totalApplications: number;
    healthyApplications: number;
    degradedApplications: number;
    downApplications: number;
    unknownApplications: number;
    overallHealth: string;
  };
  timestamp: string;
}

export interface TeamStats {
  teams: Array<{
    teamName: string;
    totalApplications: number;
    healthyApplications: number;
    healthPercentage: string;
    applications: Array<{
      id: string;
      name: string;
      status: string;
      namespace: string;
      environment: string;
    }>;
  }>;
  timestamp: string;
}

export interface KubernetesHealth {
  isConnected: boolean;
  status: 'connected' | 'disconnected';
  timestamp: string;
}

class PlatformMetricsApi {
  // Platform overview
  async getOverview(): Promise<PlatformOverview> {
    const response = await api.get('/platform/overview');
    return response.data;
  }

  // Team statistics
  async getTeamStats(): Promise<TeamStats> {
    const response = await api.get('/platform/teams');
    return response.data;
  }

  // Kubernetes cluster metrics
  async getClusterMetrics(): Promise<{ cluster: ClusterMetrics; timestamp: string }> {
    const response = await api.get('/platform/k8s/cluster');
    return response.data;
  }

  // Kubernetes node metrics
  async getNodeMetrics(): Promise<{ nodes: ClusterMetrics['nodes']; timestamp: string }> {
    const response = await api.get('/platform/k8s/nodes');
    return response.data;
  }

  // Kubernetes pods for specific namespace
  async getNamespacePods(namespace: string): Promise<{ namespace: string; pods: PodMetrics[]; timestamp: string }> {
    const response = await api.get(`/platform/k8s/namespaces/${namespace}/pods`);
    return response.data;
  }

  // Kubernetes deployment status
  async getDeploymentStatus(namespace: string, name: string): Promise<{ deployment: any; timestamp: string }> {
    const response = await api.get(`/platform/k8s/deployments/${namespace}/${name}`);
    return response.data;
  }

  // Kubernetes API health
  async getKubernetesHealth(): Promise<KubernetesHealth> {
    const response = await api.get('/platform/k8s/health');
    return response.data;
  }
}

export const platformMetricsApi = new PlatformMetricsApi();