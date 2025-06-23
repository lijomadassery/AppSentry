# Phase 3: Multi-Cluster Federation & Global Aggregation

## Overview
Build a federation layer to aggregate telemetry data across 6 Kubernetes clusters (dev, test, stage, prod, app-prod, shared-services) with global querying capabilities.

## Architecture
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  DEV Cluster │ │ TEST Cluster │ │STAGE Cluster│
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       └───────────────┴───────────────┘
                      │
              ┌───────────────┐
              │ Global Query  │
              │   Federation  │
              │    Service    │
              └───────┬───────┘
                      │
       ┌──────────────┴──────────────┐
       │                             │
┌──────┴──────┐ ┌─────────────┐ ┌───┴─────────┐
│ PROD Cluster│ │ APP-PROD    │ │SHARED-SVCS  │
└─────────────┘ └─────────────┘ └─────────────┘
```

## Week 3: Implementation Schedule

### Day 1-2: Federation Service Architecture

#### Global Query Router (Go)
```go
// cmd/federation/main.go
package main

import (
    "github.com/appsentry/federation/internal/router"
    "github.com/appsentry/federation/internal/aggregator"
    "github.com/appsentry/federation/internal/cache"
)

type FederationConfig struct {
    Clusters []ClusterConfig `yaml:"clusters"`
    Cache    CacheConfig     `yaml:"cache"`
    Security SecurityConfig  `yaml:"security"`
}

type ClusterConfig struct {
    Name        string            `yaml:"name"`
    Environment string            `yaml:"environment"`
    Endpoint    string            `yaml:"endpoint"`
    Weight      float64           `yaml:"weight"`
    Credentials CredentialConfig  `yaml:"credentials"`
    RateLimit   RateLimitConfig   `yaml:"rateLimit"`
}

func main() {
    config := LoadConfig()
    
    // Initialize components
    queryRouter := router.NewQueryRouter(config.Clusters)
    aggregator := aggregator.NewGlobalAggregator()
    cacheManager := cache.NewRedisCache(config.Cache)
    
    // Create federation server
    server := &FederationServer{
        router:     queryRouter,
        aggregator: aggregator,
        cache:      cacheManager,
    }
    
    server.Start(":8080")
}

// internal/router/query_router.go
package router

import (
    "context"
    "sync"
    "time"
)

type QueryRouter struct {
    clusters map[string]*ClusterClient
    weights  map[string]float64
}

func (qr *QueryRouter) ExecuteQuery(ctx context.Context, query Query) (*QueryResult, error) {
    // Determine which clusters to query based on filters
    targetClusters := qr.selectClusters(query)
    
    // Execute queries in parallel
    var wg sync.WaitGroup
    results := make(chan *ClusterResult, len(targetClusters))
    errors := make(chan error, len(targetClusters))
    
    for _, cluster := range targetClusters {
        wg.Add(1)
        go func(c *ClusterClient) {
            defer wg.Done()
            
            // Apply cluster-specific optimizations
            optimizedQuery := qr.optimizeQueryForCluster(query, c)
            
            result, err := c.ExecuteQuery(ctx, optimizedQuery)
            if err != nil {
                errors <- fmt.Errorf("cluster %s: %w", c.Name, err)
                return
            }
            
            results <- &ClusterResult{
                ClusterName: c.Name,
                Data:        result,
                QueryTime:   time.Since(start),
            }
        }(cluster)
    }
    
    wg.Wait()
    close(results)
    close(errors)
    
    // Aggregate results
    return qr.aggregateResults(results, errors)
}

func (qr *QueryRouter) selectClusters(query Query) []*ClusterClient {
    clusters := make([]*ClusterClient, 0)
    
    // Filter by environment
    if query.Environment != "" {
        for name, client := range qr.clusters {
            if client.Environment == query.Environment {
                clusters = append(clusters, client)
            }
        }
        return clusters
    }
    
    // Filter by time range - exclude dev/test for production queries
    if query.TimeRange.IsProduction() {
        for name, client := range qr.clusters {
            if client.Environment == "prod" || 
               client.Environment == "app-prod" || 
               client.Environment == "shared-services" {
                clusters = append(clusters, client)
            }
        }
        return clusters
    }
    
    // Default: query all clusters
    for _, client := range qr.clusters {
        clusters = append(clusters, client)
    }
    
    return clusters
}
```

### Day 2-3: Cross-Cluster Aggregation

#### Distributed Aggregation Engine
```go
// internal/aggregator/global_aggregator.go
package aggregator

import (
    "sort"
    "sync"
)

type GlobalAggregator struct {
    strategies map[string]AggregationStrategy
}

type AggregationStrategy interface {
    Aggregate(results []*ClusterResult) (interface{}, error)
}

// Trace aggregation across clusters
type TraceAggregator struct{}

func (ta *TraceAggregator) Aggregate(results []*ClusterResult) (interface{}, error) {
    // Collect all traces
    allTraces := make([]Trace, 0)
    traceMap := make(map[string]*DistributedTrace)
    
    for _, result := range results {
        for _, trace := range result.Traces {
            if dt, exists := traceMap[trace.TraceID]; exists {
                // Merge spans from different clusters
                dt.Spans = append(dt.Spans, trace.Spans...)
                dt.Clusters = append(dt.Clusters, result.ClusterName)
            } else {
                traceMap[trace.TraceID] = &DistributedTrace{
                    TraceID:   trace.TraceID,
                    Spans:     trace.Spans,
                    Clusters:  []string{result.ClusterName},
                    StartTime: trace.StartTime,
                    EndTime:   trace.EndTime,
                }
            }
        }
    }
    
    // Sort spans within each trace
    for _, dt := range traceMap {
        sort.Slice(dt.Spans, func(i, j int) bool {
            return dt.Spans[i].StartTime.Before(dt.Spans[j].StartTime)
        })
        
        // Recalculate trace duration
        dt.Duration = dt.Spans[len(dt.Spans)-1].EndTime.Sub(dt.Spans[0].StartTime)
    }
    
    return traceMap, nil
}

// Metrics aggregation with proper time alignment
type MetricsAggregator struct {
    alignmentWindow time.Duration
}

func (ma *MetricsAggregator) Aggregate(results []*ClusterResult) (interface{}, error) {
    // Time-align metrics from different clusters
    alignedMetrics := make(map[string]*AlignedMetric)
    
    for _, result := range results {
        for _, metric := range result.Metrics {
            // Align to common time boundaries
            alignedTime := ma.alignTime(metric.Timestamp)
            key := fmt.Sprintf("%s:%s:%d", metric.Name, metric.Service, alignedTime.Unix())
            
            if am, exists := alignedMetrics[key]; exists {
                // Aggregate based on metric type
                switch metric.Type {
                case "COUNTER":
                    am.Value += metric.Value
                case "GAUGE":
                    am.Values = append(am.Values, metric.Value)
                case "HISTOGRAM":
                    am.Buckets = mergeBuckets(am.Buckets, metric.Buckets)
                }
                am.SampleCount += metric.SampleCount
            } else {
                alignedMetrics[key] = &AlignedMetric{
                    Name:        metric.Name,
                    Service:     metric.Service,
                    Timestamp:   alignedTime,
                    Type:        metric.Type,
                    Value:       metric.Value,
                    Values:      []float64{metric.Value},
                    SampleCount: metric.SampleCount,
                    Clusters:    []string{result.ClusterName},
                }
            }
        }
    }
    
    // Calculate final aggregated values
    for _, am := range alignedMetrics {
        if am.Type == "GAUGE" && len(am.Values) > 0 {
            // Average gauges across clusters
            sum := 0.0
            for _, v := range am.Values {
                sum += v
            }
            am.Value = sum / float64(len(am.Values))
        }
    }
    
    return alignedMetrics, nil
}
```

### Day 3-4: Global Service Discovery

#### Service Registry
```go
// internal/discovery/service_registry.go
package discovery

import (
    "sync"
    "time"
)

type ServiceRegistry struct {
    services map[string]*ServiceInfo
    mu       sync.RWMutex
    
    // Cluster clients for discovery
    clusters []*ClusterClient
}

type ServiceInfo struct {
    Name         string
    Clusters     []ClusterDeployment
    TotalPods    int
    Endpoints    []string
    LastUpdated  time.Time
    Dependencies []string
    SLO          SLOConfig
}

type ClusterDeployment struct {
    ClusterName string
    Namespace   string
    PodCount    int
    Version     string
    Status      string
}

func (sr *ServiceRegistry) DiscoverServices(ctx context.Context) error {
    // Query each cluster for services
    var wg sync.WaitGroup
    servicesChan := make(chan map[string]*ServiceInfo, len(sr.clusters))
    
    for _, cluster := range sr.clusters {
        wg.Add(1)
        go func(c *ClusterClient) {
            defer wg.Done()
            
            services, err := c.ListServices(ctx)
            if err != nil {
                log.Errorf("Failed to discover services in %s: %v", c.Name, err)
                return
            }
            
            servicesChan <- services
        }(cluster)
    }
    
    wg.Wait()
    close(servicesChan)
    
    // Merge service information
    sr.mu.Lock()
    defer sr.mu.Unlock()
    
    sr.services = make(map[string]*ServiceInfo)
    
    for clusterServices := range servicesChan {
        for name, info := range clusterServices {
            if existing, ok := sr.services[name]; ok {
                // Merge cluster deployments
                existing.Clusters = append(existing.Clusters, info.Clusters...)
                existing.TotalPods += info.TotalPods
                existing.Endpoints = append(existing.Endpoints, info.Endpoints...)
            } else {
                sr.services[name] = info
            }
        }
    }
    
    // Build dependency graph
    sr.buildDependencyGraph()
    
    return nil
}

func (sr *ServiceRegistry) GetServiceTopology() *ServiceTopology {
    sr.mu.RLock()
    defer sr.mu.RUnlock()
    
    topology := &ServiceTopology{
        Services: make(map[string]*ServiceNode),
        Edges:    make([]ServiceEdge, 0),
    }
    
    // Build nodes
    for name, info := range sr.services {
        topology.Services[name] = &ServiceNode{
            Name:     name,
            Clusters: info.Clusters,
            Status:   sr.calculateServiceStatus(info),
            Metrics:  sr.getServiceMetrics(name),
        }
    }
    
    // Build edges from dependencies
    for name, info := range sr.services {
        for _, dep := range info.Dependencies {
            topology.Edges = append(topology.Edges, ServiceEdge{
                Source: name,
                Target: dep,
                Weight: sr.calculateDependencyWeight(name, dep),
            })
        }
    }
    
    return topology
}
```

### Day 4-5: Multi-Tenant Security

#### Authentication & Authorization
```go
// internal/auth/multi_tenant.go
package auth

import (
    "context"
    "github.com/golang-jwt/jwt/v4"
)

type TenantManager struct {
    tenants map[string]*Tenant
    rbac    *RBACEngine
}

type Tenant struct {
    ID           string
    Name         string
    Clusters     []string // Allowed clusters
    Namespaces   []string // Allowed namespaces
    DataQuota    DataQuota
    RateLimits   RateLimits
    Users        map[string]*User
}

type RBACEngine struct {
    roles       map[string]*Role
    permissions map[string]*Permission
}

func (tm *TenantManager) Authenticate(ctx context.Context, token string) (*AuthContext, error) {
    // Parse JWT token
    claims, err := tm.parseToken(token)
    if err != nil {
        return nil, ErrInvalidToken
    }
    
    // Get tenant and user
    tenant, exists := tm.tenants[claims.TenantID]
    if !exists {
        return nil, ErrTenantNotFound
    }
    
    user, exists := tenant.Users[claims.UserID]
    if !exists {
        return nil, ErrUserNotFound
    }
    
    // Build auth context
    authCtx := &AuthContext{
        TenantID:   tenant.ID,
        UserID:     user.ID,
        Roles:      user.Roles,
        Clusters:   tm.getAllowedClusters(tenant, user),
        Namespaces: tm.getAllowedNamespaces(tenant, user),
        Quotas:     tenant.DataQuota,
    }
    
    return authCtx, nil
}

func (tm *TenantManager) Authorize(ctx context.Context, authCtx *AuthContext, resource string, action string) error {
    // Check tenant-level permissions
    if !tm.isTenantAllowed(authCtx.TenantID, resource) {
        return ErrTenantAccessDenied
    }
    
    // Check user-level permissions
    for _, role := range authCtx.Roles {
        if tm.rbac.HasPermission(role, resource, action) {
            // Check resource-specific constraints
            if err := tm.checkResourceConstraints(authCtx, resource); err != nil {
                return err
            }
            return nil
        }
    }
    
    return ErrAccessDenied
}

// Query filtering based on tenant access
func (tm *TenantManager) FilterQuery(query Query, authCtx *AuthContext) Query {
    filtered := query.Clone()
    
    // Add cluster filters
    if len(authCtx.Clusters) > 0 {
        filtered.AddFilter("cluster", "in", authCtx.Clusters)
    }
    
    // Add namespace filters
    if len(authCtx.Namespaces) > 0 {
        filtered.AddFilter("namespace", "in", authCtx.Namespaces)
    }
    
    // Add time range limits based on quota
    maxTimeRange := authCtx.Quotas.MaxQueryTimeRange
    if filtered.TimeRange.Duration() > maxTimeRange {
        filtered.TimeRange.End = filtered.TimeRange.Start.Add(maxTimeRange)
    }
    
    return filtered
}
```

### Day 5-6: Global Dashboard & API

#### GraphQL Federation API
```graphql
# schema.graphql
type Query {
  # Global service overview
  services(
    clusters: [String!]
    namespaces: [String!]
    timeRange: TimeRangeInput!
  ): ServiceOverview!
  
  # Cross-cluster trace search
  traces(
    traceId: String
    serviceName: String
    clusters: [String!]
    timeRange: TimeRangeInput!
    limit: Int = 100
  ): TraceSearchResult!
  
  # Global metrics aggregation
  metrics(
    metricName: String!
    serviceName: String
    aggregation: AggregationType!
    groupBy: [String!]
    clusters: [String!]
    timeRange: TimeRangeInput!
  ): MetricResult!
  
  # Multi-cluster health status
  clusterHealth: [ClusterHealth!]!
  
  # Service topology across clusters
  serviceTopology(
    serviceName: String
    depth: Int = 2
  ): ServiceTopology!
}

type ServiceOverview {
  totalServices: Int!
  servicesPerCluster: [ClusterServiceCount!]!
  healthStatus: HealthSummary!
  topErrors: [ServiceError!]!
  sloCompliance: Float!
}

type TraceSearchResult {
  traces: [DistributedTrace!]!
  totalCount: Int!
  clusters: [String!]!
}

type DistributedTrace {
  traceId: String!
  rootService: String!
  clusters: [String!]!
  spanCount: Int!
  duration: Float!
  status: TraceStatus!
  timeline: [TraceEvent!]!
}
```

#### REST API Gateway
```go
// internal/api/gateway.go
package api

import (
    "github.com/gin-gonic/gin"
    "github.com/appsentry/federation/internal/auth"
)

type APIGateway struct {
    federation *FederationService
    auth       *auth.TenantManager
    cache      *cache.Manager
}

func (ag *APIGateway) SetupRoutes(r *gin.Engine) {
    // Middleware
    r.Use(ag.authMiddleware())
    r.Use(ag.rateLimitMiddleware())
    r.Use(ag.corsMiddleware())
    
    // Health endpoints
    r.GET("/health", ag.healthCheck)
    r.GET("/ready", ag.readinessCheck)
    
    // Federation API v1
    v1 := r.Group("/api/v1")
    {
        // Service discovery
        v1.GET("/services", ag.listServices)
        v1.GET("/services/:name", ag.getService)
        v1.GET("/services/:name/topology", ag.getServiceTopology)
        
        // Traces
        v1.GET("/traces", ag.searchTraces)
        v1.GET("/traces/:id", ag.getTrace)
        
        // Metrics
        v1.POST("/metrics/query", ag.queryMetrics)
        v1.GET("/metrics/services/:name", ag.getServiceMetrics)
        
        // Logs
        v1.POST("/logs/search", ag.searchLogs)
        
        // Cluster management
        v1.GET("/clusters", ag.listClusters)
        v1.GET("/clusters/:name/health", ag.getClusterHealth)
    }
}

func (ag *APIGateway) searchTraces(c *gin.Context) {
    authCtx := c.MustGet("auth").(*auth.AuthContext)
    
    var req TraceSearchRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // Apply tenant filters
    req = ag.auth.FilterTraceSearch(req, authCtx)
    
    // Check cache
    cacheKey := ag.cache.BuildKey("traces", req)
    if cached, found := ag.cache.Get(cacheKey); found {
        c.JSON(200, cached)
        return
    }
    
    // Execute federated search
    result, err := ag.federation.SearchTraces(c.Request.Context(), req)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // Cache result
    ag.cache.Set(cacheKey, result, 5*time.Minute)
    
    c.JSON(200, result)
}
```

### Day 6-7: Performance & Caching

#### Global Caching Layer
```go
// internal/cache/distributed_cache.go
package cache

import (
    "github.com/go-redis/redis/v8"
    "github.com/vmihailenco/msgpack/v5"
)

type DistributedCache struct {
    primary   *redis.Client
    secondary *redis.Client // Read replica
    ttl       map[string]time.Duration
}

func (dc *DistributedCache) GetOrCompute(
    key string,
    compute func() (interface{}, error),
    ttl time.Duration,
) (interface{}, error) {
    // Try primary cache
    if val, err := dc.get(dc.primary, key); err == nil {
        return val, nil
    }
    
    // Try secondary cache
    if val, err := dc.get(dc.secondary, key); err == nil {
        // Async write to primary
        go dc.set(dc.primary, key, val, ttl)
        return val, nil
    }
    
    // Compute and cache
    val, err := compute()
    if err != nil {
        return nil, err
    }
    
    // Write to both caches
    go dc.set(dc.primary, key, val, ttl)
    go dc.set(dc.secondary, key, val, ttl)
    
    return val, nil
}

// Query result aggregation cache
type AggregationCache struct {
    cache *DistributedCache
}

func (ac *AggregationCache) GetServiceMetrics(
    clusters []string,
    service string,
    timeRange TimeRange,
) (*ServiceMetrics, error) {
    key := ac.buildKey(clusters, service, timeRange)
    
    return ac.cache.GetOrCompute(
        key,
        func() (interface{}, error) {
            // Expensive cross-cluster aggregation
            return ac.computeServiceMetrics(clusters, service, timeRange)
        },
        ac.ttlForTimeRange(timeRange),
    )
}

func (ac *AggregationCache) ttlForTimeRange(tr TimeRange) time.Duration {
    duration := tr.End.Sub(tr.Start)
    
    switch {
    case duration <= 1*time.Hour:
        return 1 * time.Minute
    case duration <= 24*time.Hour:
        return 5 * time.Minute
    case duration <= 7*24*time.Hour:
        return 30 * time.Minute
    default:
        return 2 * time.Hour
    }
}
```

## Deployment Architecture

### Kubernetes Manifests
```yaml
# k8s/federation/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: federation-service
  namespace: appsentry-global
spec:
  replicas: 3
  selector:
    matchLabels:
      app: federation-service
  template:
    metadata:
      labels:
        app: federation-service
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - federation-service
            topologyKey: kubernetes.io/hostname
      containers:
      - name: federation
        image: appsentry/federation:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: CLUSTER_CONFIG
          value: /config/clusters.yaml
        - name: REDIS_CLUSTER
          value: "redis-cluster:6379"
        - name: AUTH_ENABLED
          value: "true"
        volumeMounts:
        - name: config
          mountPath: /config
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
      volumes:
      - name: config
        configMap:
          name: federation-config
---
# Global Load Balancer (for multi-region)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: federation-global-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, OPTIONS"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.appsentry.global
    secretName: appsentry-tls
  rules:
  - host: api.appsentry.global
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: federation-service
            port:
              number: 8080
```

## Cross-Region Architecture

### Multi-Region Deployment
```yaml
# terraform/multi_region.tf
resource "kubernetes_namespace" "federation" {
  for_each = var.regions
  
  metadata {
    name = "appsentry-federation"
    labels = {
      region = each.key
    }
  }
}

resource "helm_release" "federation" {
  for_each = var.regions
  
  name       = "federation-${each.key}"
  namespace  = kubernetes_namespace.federation[each.key].metadata[0].name
  chart      = "./charts/federation"
  
  values = [
    <<-EOT
    global:
      region: ${each.key}
      clusters: ${jsonencode(each.value.clusters)}
    
    federation:
      replicaCount: ${each.value.replicas}
      
    redis:
      enabled: true
      cluster:
        enabled: true
        slaveCount: 2
    
    ingress:
      enabled: true
      hostname: api-${each.key}.appsentry.global
    EOT
  ]
}

# Global Traffic Manager
resource "aws_route53_record" "federation_global" {
  zone_id = var.route53_zone_id
  name    = "api.appsentry.global"
  type    = "A"
  
  alias {
    name                   = aws_globalaccelerator_accelerator.federation.dns_name
    zone_id                = aws_globalaccelerator_accelerator.federation.hosted_zone_id
    evaluate_target_health = true
  }
}
```

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Query Latency (p99) | < 500ms | Prometheus |
| Cross-Cluster Join | < 2s | Custom metric |
| Cache Hit Rate | > 80% | Redis metrics |
| API Availability | 99.95% | Uptime monitoring |
| Data Freshness | < 1 min | Lag monitoring |

## Security Considerations

1. **mTLS between clusters**
2. **API Gateway with rate limiting**
3. **Tenant isolation at query level**
4. **Audit logging for all queries**
5. **Data encryption in transit and at rest**

## Cost Optimization

- Query result caching: -70% compute
- Cluster-aware routing: -50% cross-region traffic
- Aggregation pushdown: -60% data transfer
- Time-based query restrictions: -40% resource usage