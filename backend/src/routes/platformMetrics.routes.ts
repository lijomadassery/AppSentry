import express from 'express';
import { prisma } from '../database/prisma';
import { kubernetesService } from '../services/kubernetesService';
import { logger } from '../utils/logger';

const router = express.Router();

// Get platform overview metrics
router.get('/overview', async (req, res) => {
  try {
    logger.info('Platform overview requested', {
      operation: 'platform_metrics',
      type: 'overview',
      source: 'api_request'
    });
    
    const applications = await prisma.application.findMany({ 
      where: { active: true } 
    });
    
    // Calculate overall platform health
    const totalApps = applications.length;
    const healthyApps = applications.filter(app => app.status === 'healthy').length;
    const degradedApps = applications.filter(app => app.status === 'degraded').length;
    const downApps = applications.filter(app => app.status === 'down').length;
    const unknownApps = applications.filter(app => app.status === 'unknown').length;

    logger.info('Platform overview calculated', {
      operation: 'platform_metrics',
      total_apps: totalApps,
      healthy_apps: healthyApps,
      degraded_apps: degradedApps,
      down_apps: downApps,
      overall_health_percent: totalApps > 0 ? (healthyApps / totalApps * 100).toFixed(1) : 0
    });

    res.json({
      summary: {
        totalApplications: totalApps,
        healthyApplications: healthyApps,
        degradedApplications: degradedApps,
        downApplications: downApps,
        unknownApplications: unknownApps,
        overallHealth: totalApps > 0 ? (healthyApps / totalApps * 100).toFixed(1) : 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get platform overview', { error });
    res.status(500).json({ error: 'Failed to retrieve platform overview' });
  }
});

// Get team summary
router.get('/teams', async (req, res) => {
  try {
    const applications = await prisma.application.findMany({ 
      where: { active: true } 
    });
    
    // Group applications by team
    const teamGroups = applications.reduce((acc, app) => {
      if (!acc[app.team]) {
        acc[app.team] = [];
      }
      acc[app.team].push(app);
      return acc;
    }, {} as Record<string, any[]>);

    const teamStats = Object.entries(teamGroups).map(([teamName, teamApps]) => {
      const totalApps = teamApps.length;
      const healthyApps = teamApps.filter(app => app.status === 'healthy').length;
      
      return {
        teamName,
        totalApplications: totalApps,
        healthyApplications: healthyApps,
        healthPercentage: totalApps > 0 ? (healthyApps / totalApps * 100).toFixed(1) : 0,
        applications: teamApps.map(app => ({
          id: app.id,
          name: app.name,
          status: app.status,
          namespace: app.namespace,
          environment: app.environment
        }))
      };
    });

    res.json({
      teams: teamStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get team stats', { error });
    res.status(500).json({ error: 'Failed to retrieve team statistics' });
  }
});

// Get Kubernetes cluster metrics
router.get('/k8s/cluster', async (req, res) => {
  try {
    const clusterMetrics = await kubernetesService.getClusterMetrics();
    
    if (!clusterMetrics) {
      return res.status(503).json({ 
        error: 'Kubernetes API unavailable',
        isConnected: kubernetesService.isHealthy()
      });
    }
    
    res.json({
      cluster: clusterMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get K8s cluster metrics', { error });
    res.status(500).json({ error: 'Failed to retrieve Kubernetes cluster metrics' });
  }
});

// Get Kubernetes node metrics
router.get('/k8s/nodes', async (req, res) => {
  try {
    const clusterMetrics = await kubernetesService.getClusterMetrics();
    
    if (!clusterMetrics) {
      return res.status(503).json({ 
        error: 'Kubernetes API unavailable',
        isConnected: kubernetesService.isHealthy()
      });
    }
    
    res.json({
      nodes: clusterMetrics.nodes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get K8s node metrics', { error });
    res.status(500).json({ error: 'Failed to retrieve Kubernetes node metrics' });
  }
});

// Get pods for a specific namespace
router.get('/k8s/namespaces/:namespace/pods', async (req, res) => {
  try {
    const { namespace } = req.params;
    const pods = await kubernetesService.getNamespacePods(namespace);
    
    res.json({
      namespace,
      pods,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to get pods for namespace ${req.params.namespace}`, { error });
    res.status(500).json({ error: 'Failed to retrieve namespace pods' });
  }
});

// Get deployment status
router.get('/k8s/deployments/:namespace/:name', async (req, res) => {
  try {
    const { namespace, name } = req.params;
    const deployment = await kubernetesService.getDeploymentStatus(namespace, name);
    
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }
    
    res.json({
      deployment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to get deployment ${req.params.namespace}/${req.params.name}`, { error });
    res.status(500).json({ error: 'Failed to retrieve deployment status' });
  }
});

// Get enhanced Kubernetes node metrics
router.get('/k8s/nodes/enhanced', async (req, res) => {
  try {
    const { range } = req.query;
    const nodeMetrics = await kubernetesService.getEnhancedNodeMetrics();
    
    // Transform data for frontend
    const nodes = nodeMetrics.map(node => ({
      nodeName: node.name,
      cpuUsage: node.cpu.percentage,
      memoryUtilization: node.memory.percentage,
      networkIORate: Math.floor(Math.random() * 500000 + 50000), // Simulated
      filesystemUtilization: Math.floor(Math.random() * 40 + 10), // Simulated
      networkErrors: 0, // Simulated
      podCount: Math.floor(Math.random() * 20 + 5), // Simulated
      containerCount: Math.floor(Math.random() * 50 + 10), // Simulated
      status: node.ready ? 'healthy' : 'unhealthy'
    }));

    res.json({
      nodes,
      networkHistory: [], // TODO: Implement network history tracking
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get enhanced node metrics', { error });
    res.status(500).json({ error: 'Failed to retrieve enhanced node metrics' });
  }
});

// Get enhanced Kubernetes pod metrics
router.get('/k8s/pods/enhanced', async (req, res) => {
  try {
    const { namespace, range } = req.query;
    const podData = await kubernetesService.getEnhancedPodMetrics(namespace as string);
    
    // Transform pods data for frontend
    const pods = podData.map(pod => ({
      name: pod.name,
      namespace: pod.namespace,
      nodeName: pod.node,
      status: pod.status,
      cpuUsage: Math.floor(Math.random() * 80 + 10), // Simulated until metrics-server available
      memoryUsage: Math.floor(Math.random() * 70 + 20),
      cpuLimit: 0, // To be implemented with metrics collection
      cpuRequest: 0, // To be implemented with metrics collection
      memoryLimit: 0, // To be implemented with metrics collection
      memoryRequest: 0, // To be implemented with metrics collection
      networkIORate: Math.floor(Math.random() * 500000 + 50000), // Simulated
      filesystemUsage: Math.floor(Math.random() * 40 + 10),
      restartCount: pod.restarts,
      deployment: pod.namespace // Simplified deployment mapping
    }));

    res.json({
      pods,
      deployments: [], // To be implemented with K8s metrics
      nodeStats: [], // To be implemented with K8s metrics
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get enhanced pod metrics', { error });
    res.status(500).json({ error: 'Failed to retrieve enhanced pod metrics' });
  }
});

// Get Kubernetes workload health data
router.get('/k8s/workload-health', async (req, res) => {
  try {
    const { namespace } = req.query;
    const healthData = await kubernetesService.getWorkloadHealthData(namespace as string);
    
    res.json(healthData);
  } catch (error) {
    logger.error('Failed to get workload health data', { error });
    res.status(500).json({ error: 'Failed to retrieve workload health data' });
  }
});

// Get Kubernetes API health status
router.get('/k8s/health', async (req, res) => {
  try {
    const isHealthy = kubernetesService.isHealthy();
    
    res.json({
      isConnected: isHealthy,
      status: isHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to check K8s health', { error });
    res.status(500).json({ error: 'Failed to check Kubernetes health' });
  }
});

export default router;