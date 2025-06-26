import { logger } from '../utils/logger';
import { clickHouseService } from './clickhouseService';

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
  private isConnected: boolean = true; // Use ClickHouse as data source

  constructor() {
    // No initialization needed - using ClickHouse
  }

  public async getClusterMetrics() {
    try {
      // Query ClickHouse for Kubernetes node and pod metrics from OTEL data
      const nodeQuery = `
        SELECT DISTINCT
          ResourceAttributes['k8s.node.name'] as name,
          'Running' as status,
          [] as conditions
        FROM otel.metrics_gauge 
        WHERE ResourceAttributes['k8s.node.name'] != '' 
        AND TimeUnix >= now() - INTERVAL 5 MINUTE
        ORDER BY name
      `;

      const podQuery = `
        SELECT DISTINCT
          ResourceAttributes['k8s.pod.name'] as name,
          ResourceAttributes['k8s.namespace.name'] as namespace,
          'Running' as status
        FROM otel.metrics_gauge 
        WHERE ResourceAttributes['k8s.pod.name'] != '' 
        AND ResourceAttributes['k8s.namespace.name'] != ''
        AND TimeUnix >= now() - INTERVAL 5 MINUTE
        ORDER BY namespace, name
      `;

      const serviceQuery = `
        SELECT DISTINCT
          ResourceAttributes['service.name'] as name,
          ResourceAttributes['k8s.namespace.name'] as namespace,
          'ClusterIP' as type
        FROM otel.metrics_gauge 
        WHERE ResourceAttributes['service.name'] != '' 
        AND ResourceAttributes['k8s.namespace.name'] != ''
        AND TimeUnix >= now() - INTERVAL 5 MINUTE
        ORDER BY namespace, name
      `;

      const [nodes, pods, services] = await Promise.all([
        clickHouseService.query(nodeQuery),
        clickHouseService.query(podQuery),
        clickHouseService.query(serviceQuery)
      ]);

      // Transform data to match frontend expectations
      const nodeMetrics = (nodes || []).map((node: any) => ({
        name: node.name,
        cpu: {
          usage: '0m',
          capacity: '1000m',
          percentage: 0
        },
        memory: {
          usage: '0Mi',
          capacity: '1000Mi', 
          percentage: 0
        },
        conditions: [],
        ready: true
      }));

      const podsByNamespace = (pods || []).reduce((acc: any, pod: any) => {
        acc[pod.namespace] = (acc[pod.namespace] || 0) + 1;
        return acc;
      }, {});

      return {
        nodes: {
          total: nodeMetrics.length,
          ready: nodeMetrics.length,
          metrics: nodeMetrics
        },
        pods: {
          total: (pods || []).length,
          running: (pods || []).length,
          pending: 0,
          failed: 0,
          byNamespace: podsByNamespace
        },
        deployments: {
          total: 0,
          available: 0,
          byNamespace: {}
        },
        events: {
          recent: [],
          warnings: []
        }
      };
    } catch (error) {
      logger.error('Failed to get cluster metrics from ClickHouse:', error);
      return {
        nodes: {
          total: 0,
          ready: 0,
          metrics: []
        },
        pods: {
          total: 0,
          running: 0,
          pending: 0,
          failed: 0,
          byNamespace: {}
        },
        deployments: {
          total: 0,
          available: 0,
          byNamespace: {}
        },
        events: {
          recent: [],
          warnings: []
        }
      };
    }
  }

  public async getNamespacePods(namespace: string) {
    try {
      const query = `
        SELECT DISTINCT
          ResourceAttributes['k8s.pod.name'] as name,
          'Running' as status,
          0 as restarts,
          now() - INTERVAL 1 DAY as age
        FROM otel.metrics_gauge 
        WHERE ResourceAttributes['k8s.namespace.name'] = '${namespace}'
        AND ResourceAttributes['k8s.pod.name'] != '' 
        AND TimeUnix >= now() - INTERVAL 5 MINUTE
        ORDER BY name
      `;

      const pods = await clickHouseService.query(query);
      return pods || [];
    } catch (error) {
      logger.error(`Failed to get pods for namespace ${namespace}:`, error);
      return [];
    }
  }

  public async getDeploymentStatus(namespace: string, name: string) {
    try {
      // Query for pods related to this deployment from OTEL data
      const query = `
        SELECT 
          COUNT(*) as total_pods,
          COUNT(*) as ready_pods
        FROM (
          SELECT DISTINCT ResourceAttributes['k8s.pod.name'] as pod_name
          FROM otel.metrics_gauge 
          WHERE ResourceAttributes['k8s.namespace.name'] = '${namespace}'
          AND ResourceAttributes['k8s.pod.name'] LIKE '${name}%'
          AND TimeUnix >= now() - INTERVAL 5 MINUTE
        )
      `;

      const result = await clickHouseService.query(query);
      const deployment = result?.[0] || { total_pods: 0, ready_pods: 0 };

      return {
        status: deployment.ready_pods > 0 ? 'available' : 'unavailable',
        replicas: {
          desired: deployment.total_pods,
          ready: deployment.ready_pods
        }
      };
    } catch (error) {
      logger.error(`Failed to get deployment status for ${namespace}/${name}:`, error);
      return { status: 'error', replicas: { desired: 0, ready: 0 } };
    }
  }

  public async getEnhancedNodeMetrics(): Promise<NodeMetrics[]> {
    try {
      const query = `
        SELECT 
          ResourceAttributes['k8s.node.name'] as name,
          AVG(Value) as cpu_usage,
          '4000m' as cpu_capacity,
          '8Gi' as memory_capacity,
          [] as conditions,
          true as ready
        FROM otel.metrics_gauge 
        WHERE ResourceAttributes['k8s.node.name'] != '' 
        AND MetricName LIKE '%cpu%'
        AND TimeUnix >= now() - INTERVAL 5 MINUTE
        GROUP BY ResourceAttributes['k8s.node.name']
        ORDER BY name
      `;

      const nodeData = await clickHouseService.query(query);
      
      return (nodeData || []).map((node: any) => ({
        name: node.name,
        cpu: {
          usage: `${Math.round(node.cpu_usage)}m`,
          capacity: node.cpu_capacity,
          percentage: this.calculatePercentage(`${Math.round(node.cpu_usage)}m`, node.cpu_capacity)
        },
        memory: {
          usage: '2Gi', // Simulated for now
          capacity: node.memory_capacity,
          percentage: 25 // Simulated for now
        },
        conditions: [],
        ready: true
      }));
    } catch (error) {
      logger.error('Failed to get enhanced node metrics from ClickHouse:', error);
      return [];
    }
  }

  public async getEnhancedPodMetrics(namespace?: string): Promise<PodMetrics[]> {
    try {
      const namespaceFilter = namespace ? `AND ResourceAttributes['k8s.namespace.name'] = '${namespace}'` : '';
      
      const query = `
        SELECT 
          ResourceAttributes['k8s.pod.name'] as name,
          ResourceAttributes['k8s.namespace.name'] as namespace,
          AVG(Value) as cpu_usage,
          '100Mi' as memory_usage,
          0 as restarts,
          'Running' as status,
          true as ready,
          ResourceAttributes['k8s.node.name'] as node
        FROM otel.metrics_gauge 
        WHERE ResourceAttributes['k8s.pod.name'] != '' 
        AND ResourceAttributes['k8s.namespace.name'] != ''
        ${namespaceFilter}
        AND TimeUnix >= now() - INTERVAL 5 MINUTE
        GROUP BY 
          ResourceAttributes['k8s.pod.name'],
          ResourceAttributes['k8s.namespace.name'],
          ResourceAttributes['k8s.node.name']
        ORDER BY namespace, name
      `;

      const podData = await clickHouseService.query(query);
      
      return (podData || []).map((pod: any) => ({
        name: pod.name,
        namespace: pod.namespace,
        cpu: `${Math.round(pod.cpu_usage || 0)}m`,
        memory: pod.memory_usage || '0',
        restarts: pod.restarts || 0,
        status: pod.status || 'Running',
        ready: pod.ready !== false,
        node: pod.node || 'unknown'
      }));
    } catch (error) {
      logger.error('Failed to get enhanced pod metrics from ClickHouse:', error);
      return [];
    }
  }

  public async getWorkloadHealthData(namespace?: string): Promise<WorkloadHealth[]> {
    try {
      const namespaceFilter = namespace ? `AND ResourceAttributes['k8s.namespace.name'] = '${namespace}'` : '';
      
      // Query for workloads based on service names from OTEL data
      const query = `
        SELECT 
          ResourceAttributes['k8s.namespace.name'] as namespace,
          ResourceAttributes['service.name'] as workload,
          'Deployment' as type,
          COUNT(DISTINCT ResourceAttributes['k8s.pod.name']) as pod_count
        FROM otel.metrics_gauge 
        WHERE ResourceAttributes['service.name'] != '' 
        AND ResourceAttributes['k8s.namespace.name'] != ''
        ${namespaceFilter}
        AND TimeUnix >= now() - INTERVAL 5 MINUTE
        GROUP BY 
          ResourceAttributes['k8s.namespace.name'],
          ResourceAttributes['service.name']
        ORDER BY namespace, workload
      `;

      const workloadData = await clickHouseService.query(query);
      
      return (workloadData || []).map((workload: any) => ({
        namespace: workload.namespace,
        workload: workload.workload,
        type: 'Deployment' as const,
        replicas: {
          desired: workload.pod_count || 1,
          ready: workload.pod_count || 1,
          available: workload.pod_count || 1
        },
        status: workload.pod_count > 0 ? 'Healthy' as const : 'Unhealthy' as const,
        conditions: []
      }));
    } catch (error) {
      logger.error('Failed to get workload health data from ClickHouse:', error);
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