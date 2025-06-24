import { logger } from '../utils/logger';

interface NodeMetrics {
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

interface PodMetrics {
  name: string;
  namespace: string;
  cpu: string;
  memory: string;
  restarts: number;
  status: string;
  ready: boolean;
  node: string;
}

interface WorkloadHealth {
  namespace: string;
  workload: string;
  type: 'Deployment' | 'StatefulSet' | 'DaemonSet';
  replicas: {
    desired: number;
    ready: number;
    available: number;
  };
  status: 'Healthy' | 'Degraded' | 'Unhealthy';
  conditions: any[];
}

class KubernetesService {
  private kubeConfig: any;
  private coreApi: any;
  private appsApi: any;
  private metricsApi: any;
  private isConnected: boolean = false;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Initialize will be called on first use
  }

  private async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.performInitialization();
    await this.initPromise;
  }

  private async performInitialization() {
    try {
      // Dynamic import for ES module
      const k8s = await import('@kubernetes/client-node');
      
      this.kubeConfig = new k8s.KubeConfig();
      
      // Try in-cluster config first (when running inside Kubernetes)
      try {
        this.kubeConfig.loadFromCluster();
        logger.info('Loaded in-cluster Kubernetes configuration');
      } catch (error) {
        // Fall back to default kubeconfig (for local development)
        this.kubeConfig.loadFromDefault();
        logger.info('Loaded default Kubernetes configuration');
      }

      this.coreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
      this.appsApi = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
      
      // MetricsV1beta1Api might not be available in all environments
      try {
        this.metricsApi = this.kubeConfig.makeApiClient(k8s.MetricsV1beta1Api);
      } catch (error) {
        logger.warn('Metrics API not available, metrics collection will be limited');
      }

      // Test connection
      await this.coreApi.listNamespace();
      this.isConnected = true;
      this.initialized = true;
      logger.info('Successfully connected to Kubernetes cluster');
    } catch (error) {
      logger.error('Failed to connect to Kubernetes cluster:', error);
      this.isConnected = false;
      this.initialized = true; // Mark as initialized even on failure
      throw error;
    }
  }

  public async getClusterMetrics() {
    await this.initialize();
    
    if (!this.isConnected) {
      return { nodes: [], pods: [], services: [] };
    }

    try {
      const [nodes, pods, services] = await Promise.all([
        this.coreApi.listNode(),
        this.coreApi.listPodForAllNamespaces(),
        this.coreApi.listServiceForAllNamespaces()
      ]);

      return {
        nodes: nodes.body.items.map((node: any) => ({
          name: node.metadata.name,
          status: node.status.phase,
          conditions: node.status.conditions
        })),
        pods: pods.body.items.map((pod: any) => ({
          name: pod.metadata.name,
          namespace: pod.metadata.namespace,
          status: pod.status.phase
        })),
        services: services.body.items.map((service: any) => ({
          name: service.metadata.name,
          namespace: service.metadata.namespace,
          type: service.spec.type
        }))
      };
    } catch (error) {
      logger.error('Failed to get cluster metrics:', error);
      return { nodes: [], pods: [], services: [] };
    }
  }

  public async getNamespacePods(namespace: string) {
    await this.initialize();
    
    if (!this.isConnected) {
      return [];
    }

    try {
      const pods = await this.coreApi.listNamespacedPod(namespace);
      return pods.body.items.map((pod: any) => ({
        name: pod.metadata.name,
        status: pod.status.phase,
        restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
        age: pod.metadata.creationTimestamp
      }));
    } catch (error) {
      logger.error(`Failed to get pods for namespace ${namespace}:`, error);
      return [];
    }
  }

  public async getDeploymentStatus(namespace: string, name: string) {
    await this.initialize();
    
    if (!this.isConnected) {
      return { status: 'unknown', replicas: { desired: 0, ready: 0 } };
    }

    try {
      const deployment = await this.appsApi.readNamespacedDeployment(name, namespace);
      return {
        status: deployment.body.status?.conditions?.find((c: any) => c.type === 'Available')?.status === 'True' ? 'available' : 'unavailable',
        replicas: {
          desired: deployment.body.spec?.replicas || 0,
          ready: deployment.body.status?.readyReplicas || 0
        }
      };
    } catch (error) {
      logger.error(`Failed to get deployment status for ${namespace}/${name}:`, error);
      return { status: 'error', replicas: { desired: 0, ready: 0 } };
    }
  }

  public async getEnhancedNodeMetrics(): Promise<NodeMetrics[]> {
    await this.initialize();
    
    if (!this.isConnected) {
      return [];
    }

    try {
      const nodes = await this.coreApi.listNode();
      const nodeMetrics = this.metricsApi ? await this.metricsApi.listNodeMetrics() : null;

      return nodes.body.items.map((node: any) => {
        const nodeMetric = nodeMetrics?.body.items.find((m: any) => m.metadata.name === node.metadata.name);
        
        const cpuCapacity = node.status.capacity?.cpu || '0';
        const memoryCapacity = node.status.capacity?.memory || '0';
        const cpuUsage = nodeMetric?.usage?.cpu || '0';
        const memoryUsage = nodeMetric?.usage?.memory || '0';

        return {
          name: node.metadata.name,
          cpu: {
            usage: cpuUsage,
            capacity: cpuCapacity,
            percentage: this.calculatePercentage(cpuUsage, cpuCapacity)
          },
          memory: {
            usage: memoryUsage,
            capacity: memoryCapacity,
            percentage: this.calculatePercentage(memoryUsage, memoryCapacity)
          },
          conditions: node.status.conditions || [],
          ready: node.status.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' || false
        };
      });
    } catch (error) {
      logger.error('Failed to get enhanced node metrics:', error);
      return [];
    }
  }

  public async getEnhancedPodMetrics(namespace?: string): Promise<PodMetrics[]> {
    await this.initialize();
    
    if (!this.isConnected) {
      return [];
    }

    try {
      const pods = namespace 
        ? await this.coreApi.listNamespacedPod(namespace)
        : await this.coreApi.listPodForAllNamespaces();
      
      const podMetrics = this.metricsApi && namespace
        ? await this.metricsApi.listNamespacedPodMetrics(namespace)
        : this.metricsApi
        ? await this.metricsApi.listPodMetricsForAllNamespaces()
        : null;

      return pods.body.items.map((pod: any) => {
        const podMetric = podMetrics?.body.items.find(
          (m: any) => m.metadata.name === pod.metadata.name && m.metadata.namespace === pod.metadata.namespace
        );

        const containerMetrics = podMetric?.containers?.[0];
        
        return {
          name: pod.metadata.name,
          namespace: pod.metadata.namespace,
          cpu: containerMetrics?.usage?.cpu || '0',
          memory: containerMetrics?.usage?.memory || '0',
          restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
          status: pod.status.phase,
          ready: pod.status.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' || false,
          node: pod.spec.nodeName || 'unknown'
        };
      });
    } catch (error) {
      logger.error('Failed to get enhanced pod metrics:', error);
      return [];
    }
  }

  public async getWorkloadHealthData(namespace?: string): Promise<WorkloadHealth[]> {
    await this.initialize();
    
    if (!this.isConnected) {
      return [];
    }

    try {
      const workloads: WorkloadHealth[] = [];

      // Get deployments
      const deployments = namespace
        ? await this.appsApi.listNamespacedDeployment(namespace)
        : await this.appsApi.listDeploymentForAllNamespaces();

      for (const deployment of deployments.body.items) {
        const desired = deployment.spec?.replicas || 0;
        const ready = deployment.status?.readyReplicas || 0;
        const available = deployment.status?.availableReplicas || 0;

        workloads.push({
          namespace: deployment.metadata.namespace,
          workload: deployment.metadata.name,
          type: 'Deployment',
          replicas: { desired, ready, available },
          status: ready >= desired ? 'Healthy' : ready > 0 ? 'Degraded' : 'Unhealthy',
          conditions: deployment.status?.conditions || []
        });
      }

      // Get statefulsets
      const statefulSets = namespace
        ? await this.appsApi.listNamespacedStatefulSet(namespace)
        : await this.appsApi.listStatefulSetForAllNamespaces();

      for (const sts of statefulSets.body.items) {
        const desired = sts.spec?.replicas || 0;
        const ready = sts.status?.readyReplicas || 0;
        const available = sts.status?.currentReplicas || 0;

        workloads.push({
          namespace: sts.metadata.namespace,
          workload: sts.metadata.name,
          type: 'StatefulSet',
          replicas: { desired, ready, available },
          status: ready >= desired ? 'Healthy' : ready > 0 ? 'Degraded' : 'Unhealthy',
          conditions: sts.status?.conditions || []
        });
      }

      return workloads;
    } catch (error) {
      logger.error('Failed to get workload health data:', error);
      return [];
    }
  }

  private calculatePercentage(usage: string, capacity: string): number {
    // Simple percentage calculation - would need proper unit parsing in production
    const usageNum = parseInt(usage) || 0;
    const capacityNum = parseInt(capacity) || 1;
    return Math.round((usageNum / capacityNum) * 100);
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }
}

export const kubernetesService = new KubernetesService();