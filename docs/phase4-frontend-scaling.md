# Phase 4: Frontend Scaling & Performance Optimization

## Overview
Transform the React frontend from loading all data in memory to a high-performance, scalable architecture capable of handling millions of data points with sub-second response times.

## Current Problems
- Loading ALL logs/traces into browser memory
- No pagination or virtualization
- React re-renders freeze UI at 10K+ items
- No data aggregation on client
- Memory leaks with large datasets

## Target Architecture
```
┌─────────────────────────────────────────────┐
│          Progressive Web App (PWA)          │
├─────────────────────────────────────────────┤
│     Service Worker (Offline + Cache)        │
├─────────────────────────────────────────────┤
│  React Query + Infinite Scroll + Virtual    │
├─────────────────────────────────────────────┤
│      GraphQL (Apollo) + DataLoader          │
├─────────────────────────────────────────────┤
│    WebAssembly for Heavy Computations       │
└─────────────────────────────────────────────┘
```

## Week 4: Implementation Schedule

### Day 1-2: GraphQL API Layer

#### GraphQL Schema
```graphql
# backend/src/graphql/schema.graphql
scalar DateTime
scalar JSON

type Query {
  # Paginated traces with cursor
  traces(
    first: Int = 20
    after: String
    filter: TraceFilter
    orderBy: TraceOrderBy
  ): TraceConnection!
  
  # Single trace detail
  trace(id: String!): Trace
  
  # Aggregated metrics
  metrics(
    timeRange: TimeRangeInput!
    aggregation: MetricAggregation!
    groupBy: [String!]
    filter: MetricFilter
  ): MetricResult!
  
  # Log search with highlighting
  logs(
    first: Int = 50
    after: String
    search: String
    filter: LogFilter
    highlight: Boolean = true
  ): LogConnection!
  
  # Service overview
  serviceOverview(
    timeRange: TimeRangeInput!
  ): ServiceOverview!
}

type Subscription {
  # Real-time trace updates
  traceAdded(serviceName: String): Trace!
  
  # Real-time metrics
  metricUpdate(
    metricName: String!
    serviceName: String
  ): MetricPoint!
  
  # Live log tail
  logStream(
    filter: LogFilter
  ): Log!
}

# Relay-style pagination
type TraceConnection {
  edges: [TraceEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
  aggregations: TraceAggregations
}

type TraceEdge {
  node: Trace!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type TraceAggregations {
  statusCounts: [StatusCount!]!
  serviceDistribution: [ServiceCount!]!
  durationHistogram: [HistogramBucket!]!
}
```

#### GraphQL Resolvers with DataLoader
```typescript
// backend/src/graphql/resolvers/trace.resolver.ts
import DataLoader from 'dataloader';
import { QueryBuilder } from '../utils/queryBuilder';

export class TraceResolver {
  private traceLoader: DataLoader<string, Trace>;
  private spanLoader: DataLoader<string, Span[]>;
  
  constructor(private clickhouse: ClickHouseService) {
    // Batch trace loading
    this.traceLoader = new DataLoader(async (traceIds) => {
      const traces = await this.clickhouse.query(`
        SELECT * FROM traces
        WHERE TraceId IN (${traceIds.map(id => `'${id}'`).join(',')})
      `);
      
      const traceMap = new Map(traces.map(t => [t.TraceId, t]));
      return traceIds.map(id => traceMap.get(id));
    });
    
    // Batch span loading
    this.spanLoader = new DataLoader(async (traceIds) => {
      const spans = await this.clickhouse.query(`
        SELECT * FROM traces
        WHERE TraceId IN (${traceIds.map(id => `'${id}'`).join(',')})
        ORDER BY TraceId, Timestamp
      `);
      
      const spansByTrace = new Map<string, Span[]>();
      spans.forEach(span => {
        if (!spansByTrace.has(span.TraceId)) {
          spansByTrace.set(span.TraceId, []);
        }
        spansByTrace.get(span.TraceId)!.push(span);
      });
      
      return traceIds.map(id => spansByTrace.get(id) || []);
    });
  }
  
  async traces(args: TraceQueryArgs, context: Context) {
    const query = new QueryBuilder('traces')
      .select(['TraceId', 'ServiceName', 'SpanName', 'Duration', 'StatusCode'])
      .where(args.filter)
      .orderBy(args.orderBy || { field: 'Timestamp', direction: 'DESC' })
      .limit(args.first || 20);
    
    if (args.after) {
      query.after(decodeCursor(args.after));
    }
    
    // Execute main query
    const results = await this.clickhouse.query(query.build());
    
    // Execute count query in parallel
    const countQuery = query.clone().count();
    const [{ count }] = await this.clickhouse.query(countQuery.build());
    
    // Build edges with cursor
    const edges = results.map(trace => ({
      node: trace,
      cursor: encodeCursor({
        timestamp: trace.Timestamp,
        traceId: trace.TraceId
      })
    }));
    
    // Calculate aggregations if needed
    const aggregations = await this.calculateAggregations(args.filter);
    
    return {
      edges,
      pageInfo: {
        hasNextPage: results.length === args.first,
        hasPreviousPage: !!args.after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor
      },
      totalCount: count,
      aggregations
    };
  }
  
  // Resolver for nested spans (uses DataLoader)
  async spans(trace: Trace) {
    return this.spanLoader.load(trace.TraceId);
  }
}
```

### Day 2-3: React Query Integration

#### Setup React Query with Infinite Scroll
```typescript
// frontend/src/hooks/useTraces.ts
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { graphqlClient } from '../graphql/client';

export const useTraces = (filter: TraceFilter) => {
  return useInfiniteQuery({
    queryKey: ['traces', filter],
    queryFn: async ({ pageParam }) => {
      const query = gql`
        query GetTraces($first: Int!, $after: String, $filter: TraceFilter) {
          traces(first: $first, after: $after, filter: $filter) {
            edges {
              node {
                id
                traceId
                serviceName
                spanName
                duration
                statusCode
                timestamp
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
            aggregations {
              statusCounts {
                status
                count
              }
              durationHistogram {
                bucket
                count
              }
            }
          }
        }
      `;
      
      const response = await graphqlClient.request(query, {
        first: 50,
        after: pageParam,
        filter
      });
      
      return response.traces;
    },
    getNextPageParam: (lastPage) => 
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Real-time updates with subscription
export const useTraceSubscription = (serviceName?: string) => {
  const queryClient = useQueryClient();
  
  useSubscription(
    gql`
      subscription OnTraceAdded($serviceName: String) {
        traceAdded(serviceName: $serviceName) {
          id
          traceId
          serviceName
          spanName
          duration
          statusCode
        }
      }
    `,
    {
      variables: { serviceName },
      onData: ({ data }) => {
        // Update cache with new trace
        queryClient.setQueryData(
          ['traces'],
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page: any, index: number) => {
                if (index === 0) {
                  return {
                    ...page,
                    edges: [
                      { node: data.traceAdded, cursor: 'new' },
                      ...page.edges
                    ]
                  };
                }
                return page;
              })
            };
          }
        );
      }
    }
  );
};
```

### Day 3-4: Virtual Scrolling Implementation

#### React Virtual for Large Lists
```typescript
// frontend/src/components/VirtualTraceList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTraces } from '../hooks/useTraces';

export const VirtualTraceList: React.FC<{ filter: TraceFilter }> = ({ filter }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useTraces(filter);
  
  // Flatten pages
  const allTraces = useMemo(
    () => data?.pages.flatMap(page => page.edges.map(edge => edge.node)) || [],
    [data]
  );
  
  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: hasNextPage ? allTraces.length + 1 : allTraces.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated row height
    overscan: 5,
  });
  
  // Load more when scrolling near bottom
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    
    if (
      lastItem &&
      lastItem.index >= allTraces.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    virtualizer.getVirtualItems(),
    allTraces.length,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  ]);
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  
  return (
    <div ref={parentRef} className="trace-list-container">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const trace = allTraces[virtualItem.index];
          const isLoaderRow = virtualItem.index > allTraces.length - 1;
          
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div className="loading-more">Loading more...</div>
              ) : (
                <TraceRow trace={trace} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Optimized trace row component
const TraceRow = React.memo<{ trace: Trace }>(({ trace }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="trace-row">
      <div className="trace-header" onClick={() => setExpanded(!expanded)}>
        <StatusIcon status={trace.statusCode} />
        <span className="service-name">{trace.serviceName}</span>
        <span className="span-name">{trace.spanName}</span>
        <span className="duration">{formatDuration(trace.duration)}</span>
        <TimeAgo timestamp={trace.timestamp} />
      </div>
      {expanded && <TraceDetails traceId={trace.traceId} />}
    </div>
  );
});
```

### Day 4-5: WebAssembly for Heavy Computations

#### WASM Module for Data Processing
```rust
// wasm/src/lib.rs
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
pub struct TraceProcessor {
    traces: Vec<Trace>,
}

#[derive(Serialize, Deserialize)]
struct Trace {
    trace_id: String,
    service_name: String,
    duration: f64,
    timestamp: f64,
    status_code: String,
}

#[wasm_bindgen]
impl TraceProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { traces: Vec::new() }
    }
    
    #[wasm_bindgen]
    pub fn add_traces(&mut self, traces_json: &str) {
        if let Ok(traces) = serde_json::from_str::<Vec<Trace>>(traces_json) {
            self.traces.extend(traces);
        }
    }
    
    #[wasm_bindgen]
    pub fn calculate_percentiles(&self) -> String {
        let mut durations: Vec<f64> = self.traces
            .iter()
            .map(|t| t.duration)
            .collect();
        
        durations.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let percentiles = Percentiles {
            p50: calculate_percentile(&durations, 0.50),
            p75: calculate_percentile(&durations, 0.75),
            p90: calculate_percentile(&durations, 0.90),
            p95: calculate_percentile(&durations, 0.95),
            p99: calculate_percentile(&durations, 0.99),
        };
        
        serde_json::to_string(&percentiles).unwrap()
    }
    
    #[wasm_bindgen]
    pub fn build_service_graph(&self) -> String {
        let mut graph = ServiceGraph::new();
        
        // Build edges from parent-child relationships
        for trace in &self.traces {
            // Extract service dependencies from attributes
            if let Some(peer_service) = self.extract_peer_service(trace) {
                graph.add_edge(&trace.service_name, &peer_service);
            }
        }
        
        serde_json::to_string(&graph).unwrap()
    }
    
    #[wasm_bindgen]
    pub fn filter_anomalies(&self, threshold_std_devs: f64) -> String {
        let mean = self.calculate_mean_duration();
        let std_dev = self.calculate_std_deviation();
        
        let anomalies: Vec<&Trace> = self.traces
            .iter()
            .filter(|t| {
                let z_score = (t.duration - mean) / std_dev;
                z_score.abs() > threshold_std_devs
            })
            .collect();
        
        serde_json::to_string(&anomalies).unwrap()
    }
}

fn calculate_percentile(sorted_values: &[f64], percentile: f64) -> f64 {
    if sorted_values.is_empty() {
        return 0.0;
    }
    
    let index = (percentile * (sorted_values.len() - 1) as f64) as usize;
    sorted_values[index]
}
```

#### Using WASM in React
```typescript
// frontend/src/workers/trace.worker.ts
import init, { TraceProcessor } from '../wasm/trace_processor';

let processor: TraceProcessor | null = null;

// Initialize WASM module
init().then(() => {
  processor = new TraceProcessor();
  postMessage({ type: 'ready' });
});

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  if (!processor) {
    postMessage({ type: 'error', error: 'WASM not initialized' });
    return;
  }
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'add_traces':
      processor.add_traces(JSON.stringify(data));
      postMessage({ type: 'traces_added' });
      break;
      
    case 'calculate_percentiles':
      const percentiles = processor.calculate_percentiles();
      postMessage({ type: 'percentiles', data: JSON.parse(percentiles) });
      break;
      
    case 'build_service_graph':
      const graph = processor.build_service_graph();
      postMessage({ type: 'service_graph', data: JSON.parse(graph) });
      break;
      
    case 'filter_anomalies':
      const anomalies = processor.filter_anomalies(data.threshold);
      postMessage({ type: 'anomalies', data: JSON.parse(anomalies) });
      break;
  }
});

// frontend/src/hooks/useTraceProcessor.ts
export const useTraceProcessor = () => {
  const workerRef = useRef<Worker>();
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/trace.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    workerRef.current.onmessage = (event) => {
      if (event.data.type === 'ready') {
        setReady(true);
      }
    };
    
    return () => {
      workerRef.current?.terminate();
    };
  }, []);
  
  const processTraces = useCallback(async (traces: Trace[]) => {
    if (!ready || !workerRef.current) return;
    
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'percentiles') {
          workerRef.current!.removeEventListener('message', handler);
          resolve(event.data.data);
        }
      };
      
      workerRef.current.addEventListener('message', handler);
      workerRef.current.postMessage({
        type: 'add_traces',
        data: traces
      });
      workerRef.current.postMessage({
        type: 'calculate_percentiles'
      });
    });
  }, [ready]);
  
  return { ready, processTraces };
};
```

### Day 5-6: Advanced Visualizations

#### Time Series Charts with Apache ECharts
```typescript
// frontend/src/components/MetricsChart.tsx
import * as echarts from 'echarts';
import { useMetrics } from '../hooks/useMetrics';

export const MetricsChart: React.FC<{ config: MetricConfig }> = ({ config }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<echarts.ECharts>();
  
  const { data, isLoading } = useMetrics(config);
  
  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;
    
    const instance = echarts.init(chartRef.current, 'dark', {
      renderer: 'canvas',
      useDirtyRect: true, // Performance optimization
    });
    
    setChart(instance);
    
    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      instance.resize();
    });
    resizeObserver.observe(chartRef.current);
    
    return () => {
      resizeObserver.disconnect();
      instance.dispose();
    };
  }, []);
  
  // Update chart data
  useEffect(() => {
    if (!chart || !data) return;
    
    const option: echarts.EChartsOption = {
      title: {
        text: config.title,
        left: 'center',
        textStyle: {
          color: '#e0e0e0',
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          animation: false,
        },
        formatter: (params: any) => {
          const time = new Date(params[0].value[0]).toLocaleString();
          const lines = params.map((p: any) => 
            `${p.marker} ${p.seriesName}: ${p.value[1].toFixed(2)}`
          );
          return `${time}<br/>${lines.join('<br/>')}`;
        },
      },
      xAxis: {
        type: 'time',
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: '#333',
          },
        },
      },
      dataZoom: [
        {
          type: 'inside',
          start: 80,
          end: 100,
        },
        {
          start: 80,
          end: 100,
        },
      ],
      series: data.series.map((s) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        symbol: 'none',
        sampling: 'lttb', // Downsampling for performance
        data: s.data.map((d) => [d.timestamp, d.value]),
        lineStyle: {
          width: 2,
        },
        emphasis: {
          focus: 'series',
        },
      })),
      // Performance optimizations
      animation: false,
      progressive: 1000,
      progressiveThreshold: 2000,
    };
    
    chart.setOption(option);
  }, [chart, data]);
  
  return (
    <div className="metrics-chart-container">
      {isLoading && <LoadingOverlay />}
      <div ref={chartRef} className="chart" />
    </div>
  );
};

// Service topology visualization
export const ServiceTopologyGraph: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const { data: topology } = useServiceTopology();
  
  useEffect(() => {
    if (!chartRef.current || !topology) return;
    
    const chart = echarts.init(chartRef.current);
    
    const option = {
      series: [{
        type: 'graph',
        layout: 'force',
        force: {
          repulsion: 1000,
          edgeLength: 200,
          gravity: 0.1,
        },
        roam: true,
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
        },
        data: topology.nodes.map(node => ({
          name: node.name,
          value: node.requestRate,
          symbolSize: Math.sqrt(node.requestRate) * 2,
          category: node.status,
          itemStyle: {
            color: getStatusColor(node.status),
          },
        })),
        links: topology.edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          value: edge.requestCount,
          lineStyle: {
            width: Math.log(edge.requestCount + 1),
            curveness: 0.3,
          },
        })),
        categories: [
          { name: 'healthy', itemStyle: { color: '#10b981' } },
          { name: 'warning', itemStyle: { color: '#f59e0b' } },
          { name: 'error', itemStyle: { color: '#ef4444' } },
        ],
      }],
    };
    
    chart.setOption(option);
    
    return () => chart.dispose();
  }, [topology]);
  
  return <div ref={chartRef} className="topology-graph" />;
};
```

### Day 6-7: Progressive Web App Features

#### Service Worker for Offline Support
```javascript
// frontend/public/service-worker.js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache GraphQL queries
registerRoute(
  ({ url }) => url.pathname === '/graphql',
  new StaleWhileRevalidate({
    cacheName: 'graphql-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60, // 1 minute
      }),
    ],
  })
);

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-telemetry') {
    event.waitUntil(syncTelemetryData());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: data.url,
  });
});
```

## Performance Optimizations

### Bundle Splitting
```javascript
// frontend/webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        },
        charts: {
          test: /[\\/]node_modules[\\/](echarts|d3)/,
          name: 'charts',
          priority: 20,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

### React Optimization
```typescript
// Use React.memo and useMemo extensively
const TraceList = React.memo(({ traces }: { traces: Trace[] }) => {
  const sortedTraces = useMemo(
    () => traces.sort((a, b) => b.timestamp - a.timestamp),
    [traces]
  );
  
  return (
    <VirtualList
      items={sortedTraces}
      renderItem={(trace) => <TraceRow key={trace.id} trace={trace} />}
    />
  );
});

// Use React Suspense for code splitting
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const TracesPage = lazy(() => import('./pages/TracesPage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
```

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Initial Load | 8s | 1.5s | < 2s |
| Time to Interactive | 12s | 2.5s | < 3s |
| Memory Usage (1M items) | Crash | 200MB | < 500MB |
| FPS during scroll | 10 | 60 | 60 |
| Bundle Size | 5MB | 800KB | < 1MB |

## Deployment

```yaml
# k8s/frontend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: appsentry-frontend-v2
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: frontend
        image: appsentry/frontend:v2
        env:
        - name: REACT_APP_GRAPHQL_ENDPOINT
          value: "https://api.appsentry.global/graphql"
        - name: REACT_APP_WS_ENDPOINT
          value: "wss://api.appsentry.global/graphql"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```