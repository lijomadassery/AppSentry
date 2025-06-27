package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Shopify/sarama"
	"github.com/ClickHouse/clickhouse-go/v2"
	tracecollectorv1 "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	metricscollectorv1 "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	logscollectorv1 "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	commonv1 "go.opentelemetry.io/proto/otlp/common/v1"
	metricsv1 "go.opentelemetry.io/proto/otlp/metrics/v1"
	"google.golang.org/protobuf/proto"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"net/http"
)

type Config struct {
	KafkaBrokers    []string
	ClickHouseAddr  string
	ConsumerGroup   string
	BatchSize       int
	FlushInterval   time.Duration
	WorkerCount     int
}

type IngestionService struct {
	config     Config
	clickhouse clickhouse.Conn
	consumer   sarama.ConsumerGroup
	
	// Metrics
	messagesProcessed *prometheus.CounterVec
	batchesWritten    *prometheus.CounterVec
	processingTime    *prometheus.HistogramVec
	errors           *prometheus.CounterVec
}

type BatchData struct {
	Traces  []TraceRecord
	Metrics []MetricRecord  
	Logs    []LogRecord
	mu      sync.RWMutex
}

type TraceRecord struct {
	TraceID     string    `json:"trace_id"`
	SpanID      string    `json:"span_id"`
	ParentSpanID string   `json:"parent_span_id"`
	ServiceName string    `json:"service_name"`
	OperationName string  `json:"operation_name"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Duration    int64     `json:"duration"`
	StatusCode  int32     `json:"status_code"`
	Tags        string    `json:"tags"`
	SpanKind    int32     `json:"span_kind"`
}

type MetricRecord struct {
	MetricName  string    `json:"metric_name"`
	ServiceName string    `json:"service_name"`
	Timestamp   time.Time `json:"timestamp"`
	Value       float64   `json:"value"`
	MetricType  string    `json:"metric_type"`
	Labels      string    `json:"labels"`
}

type LogRecord struct {
	TraceID     string    `json:"trace_id"`
	SpanID      string    `json:"span_id"`
	ServiceName string    `json:"service_name"`
	Timestamp   time.Time `json:"timestamp"`
	SeverityText string   `json:"severity_text"`
	SeverityNumber int32  `json:"severity_number"`
	Body        string    `json:"body"`
	Attributes  string    `json:"attributes"`
}

func NewIngestionService(config Config) (*IngestionService, error) {
	// Initialize Prometheus metrics
	messagesProcessed := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "appsentry_messages_processed_total",
			Help: "Total number of Kafka messages processed",
		},
		[]string{"topic", "status"},
	)
	
	batchesWritten := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "appsentry_batches_written_total", 
			Help: "Total number of batches written to ClickHouse",
		},
		[]string{"table", "status"},
	)
	
	processingTime := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "appsentry_processing_duration_seconds",
			Help: "Time spent processing messages",
		},
		[]string{"operation"},
	)
	
	errors := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "appsentry_errors_total",
			Help: "Total number of processing errors",
		},
		[]string{"component", "error_type"},
	)

	prometheus.MustRegister(messagesProcessed, batchesWritten, processingTime, errors)

	// Initialize ClickHouse connection
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{config.ClickHouseAddr},
		Auth: clickhouse.Auth{
			Database: "otel",
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 60,
		},
		DialTimeout:     time.Second * 30,
		MaxOpenConns:    5,
		MaxIdleConns:    5,
		ConnMaxLifetime: time.Hour,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ClickHouse: %v", err)
	}

	// Test connection
	if err := conn.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ping ClickHouse: %v", err)
	}

	// Initialize Kafka consumer
	saramaConfig := sarama.NewConfig()
	saramaConfig.Consumer.Group.Rebalance.Strategy = sarama.BalanceStrategyRoundRobin
	saramaConfig.Consumer.Offsets.Initial = sarama.OffsetOldest
	saramaConfig.Consumer.Group.Session.Timeout = 10 * time.Second
	saramaConfig.Consumer.Group.Heartbeat.Interval = 3 * time.Second
	saramaConfig.Consumer.MaxProcessingTime = 2 * time.Minute
	saramaConfig.Consumer.Fetch.Min = 1
	saramaConfig.Consumer.Fetch.Default = 1024 * 1024
	saramaConfig.Consumer.Fetch.Max = 10 * 1024 * 1024

	consumer, err := sarama.NewConsumerGroup(config.KafkaBrokers, config.ConsumerGroup, saramaConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create consumer group: %v", err)
	}

	return &IngestionService{
		config:            config,
		clickhouse:       conn,
		consumer:         consumer,
		messagesProcessed: messagesProcessed,
		batchesWritten:   batchesWritten,
		processingTime:   processingTime,
		errors:          errors,
	}, nil
}

func (s *IngestionService) Start() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start metrics server
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		})
		log.Println("Starting metrics server on :8080")
		if err := http.ListenAndServe(":8080", nil); err != nil {
			log.Printf("Metrics server error: %v", err)
		}
	}()

	// Initialize batch data
	batchData := &BatchData{}
	
	// Start batch flusher
	go s.startBatchFlusher(ctx, batchData)

	// Start consumer
	wg := &sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-ctx.Done():
				return
			default:
				if err := s.consumer.Consume(ctx, []string{"telemetry-traces", "telemetry-metrics", "telemetry-logs"}, &ConsumerGroupHandler{
					service:   s,
					batchData: batchData,
				}); err != nil {
					s.errors.WithLabelValues("consumer", "consume_error").Inc()
					log.Printf("Error from consumer: %v", err)
				}
			}
		}
	}()

	// Wait for interrupt signal
	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGINT, syscall.SIGTERM)
	<-sigterm

	log.Println("Shutting down...")
	cancel()
	
	// Close consumer
	if err := s.consumer.Close(); err != nil {
		log.Printf("Error closing consumer: %v", err)
	}

	// Close ClickHouse connection
	if err := s.clickhouse.Close(); err != nil {
		log.Printf("Error closing ClickHouse: %v", err)
	}

	wg.Wait()
	return nil
}

func (s *IngestionService) startBatchFlusher(ctx context.Context, batchData *BatchData) {
	ticker := time.NewTicker(s.config.FlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			// Final flush before shutdown
			s.flushBatch(batchData)
			return
		case <-ticker.C:
			s.flushBatch(batchData)
		}
	}
}

func (s *IngestionService) flushBatch(batchData *BatchData) {
	timer := prometheus.NewTimer(s.processingTime.WithLabelValues("batch_flush"))
	defer timer.ObserveDuration()

	batchData.mu.Lock()
	defer batchData.mu.Unlock()

	// Flush traces
	if len(batchData.Traces) > 0 {
		if err := s.writeTraces(batchData.Traces); err != nil {
			s.errors.WithLabelValues("clickhouse", "write_traces").Inc()
			log.Printf("Error writing traces: %v", err)
		} else {
			s.batchesWritten.WithLabelValues("traces", "success").Inc()
			log.Printf("Wrote %d traces to ClickHouse", len(batchData.Traces))
		}
		batchData.Traces = batchData.Traces[:0]
	}

	// Flush metrics  
	if len(batchData.Metrics) > 0 {
		if err := s.writeMetrics(batchData.Metrics); err != nil {
			s.errors.WithLabelValues("clickhouse", "write_metrics").Inc()
			log.Printf("Error writing metrics: %v", err)
		} else {
			s.batchesWritten.WithLabelValues("metrics", "success").Inc()
			log.Printf("Wrote %d metrics to ClickHouse", len(batchData.Metrics))
		}
		batchData.Metrics = batchData.Metrics[:0]
	}

	// Flush logs
	if len(batchData.Logs) > 0 {
		if err := s.writeLogs(batchData.Logs); err != nil {
			s.errors.WithLabelValues("clickhouse", "write_logs").Inc()
			log.Printf("Error writing logs: %v", err)
		} else {
			s.batchesWritten.WithLabelValues("logs", "success").Inc()
			log.Printf("Wrote %d logs to ClickHouse", len(batchData.Logs))
		}
		batchData.Logs = batchData.Logs[:0]
	}
}

type ConsumerGroupHandler struct {
	service   *IngestionService
	batchData *BatchData
}

func (h *ConsumerGroupHandler) Setup(sarama.ConsumerGroupSession) error   { return nil }
func (h *ConsumerGroupHandler) Cleanup(sarama.ConsumerGroupSession) error { return nil }

func (h *ConsumerGroupHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for {
		select {
		case message := <-claim.Messages():
			if message == nil {
				return nil
			}

			timer := prometheus.NewTimer(h.service.processingTime.WithLabelValues("message_processing"))
			
			if err := h.processMessage(message); err != nil {
				h.service.errors.WithLabelValues("processing", "message_error").Inc()
				log.Printf("Error processing message: %v", err)
			} else {
				h.service.messagesProcessed.WithLabelValues(message.Topic, "success").Inc()
			}
			
			timer.ObserveDuration()
			session.MarkMessage(message, "")

		case <-session.Context().Done():
			return nil
		}
	}
}

func (h *ConsumerGroupHandler) processMessage(message *sarama.ConsumerMessage) error {
	switch message.Topic {
	case "telemetry-traces":
		return h.processTraces(message.Value)
	case "telemetry-metrics":
		return h.processMetrics(message.Value)
	case "telemetry-logs":
		return h.processLogs(message.Value)
	default:
		return fmt.Errorf("unknown topic: %s", message.Topic)
	}
}

func (h *ConsumerGroupHandler) processTraces(data []byte) error {
	var req tracecollectorv1.ExportTraceServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return fmt.Errorf("failed to unmarshal trace data: %v", err)
	}

	h.batchData.mu.Lock()
	defer h.batchData.mu.Unlock()

	for _, resourceSpan := range req.ResourceSpans {
		serviceName := "unknown"
		
		// Extract service name from resource attributes
		if resourceSpan.Resource != nil {
			for _, attr := range resourceSpan.Resource.Attributes {
				if attr.Key == "service.name" && attr.Value.GetStringValue() != "" {
					serviceName = attr.Value.GetStringValue()
					break
				}
			}
		}

		for _, scopeSpan := range resourceSpan.ScopeSpans {
			for _, span := range scopeSpan.Spans {
				// Convert attributes to JSON
				tagsMap := make(map[string]string)
				for _, attr := range span.Attributes {
					switch v := attr.Value.Value.(type) {
					case *commonv1.AnyValue_StringValue:
						tagsMap[attr.Key] = v.StringValue
					case *commonv1.AnyValue_IntValue:
						tagsMap[attr.Key] = fmt.Sprintf("%d", v.IntValue)
					case *commonv1.AnyValue_DoubleValue:
						tagsMap[attr.Key] = fmt.Sprintf("%f", v.DoubleValue)
					case *commonv1.AnyValue_BoolValue:
						tagsMap[attr.Key] = fmt.Sprintf("%t", v.BoolValue)
					}
				}
				
				tagsJSON, _ := json.Marshal(tagsMap)

				record := TraceRecord{
					TraceID:       fmt.Sprintf("%x", span.TraceId),
					SpanID:        fmt.Sprintf("%x", span.SpanId),
					ParentSpanID:  fmt.Sprintf("%x", span.ParentSpanId),
					ServiceName:   serviceName,
					OperationName: span.Name,
					StartTime:     time.Unix(0, int64(span.StartTimeUnixNano)),
					EndTime:       time.Unix(0, int64(span.EndTimeUnixNano)),
					Duration:      int64(span.EndTimeUnixNano - span.StartTimeUnixNano),
					StatusCode:    int32(span.Status.GetCode()),
					Tags:          string(tagsJSON),
					SpanKind:      int32(span.Kind),
				}

				h.batchData.Traces = append(h.batchData.Traces, record)
			}
		}
	}

	return nil
}

func (h *ConsumerGroupHandler) processMetrics(data []byte) error {
	var req metricscollectorv1.ExportMetricsServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return fmt.Errorf("failed to unmarshal metrics data: %v", err)
	}

	h.batchData.mu.Lock()
	defer h.batchData.mu.Unlock()

	for _, resourceMetric := range req.ResourceMetrics {
		serviceName := "unknown"
		
		// Extract service name from resource attributes
		if resourceMetric.Resource != nil {
			for _, attr := range resourceMetric.Resource.Attributes {
				if attr.Key == "service.name" && attr.Value.GetStringValue() != "" {
					serviceName = attr.Value.GetStringValue()
					break
				}
			}
		}

		for _, scopeMetric := range resourceMetric.ScopeMetrics {
			for _, metric := range scopeMetric.Metrics {
				// Process different metric types
				switch data := metric.Data.(type) {
				case *metricsv1.Metric_Gauge:
					for _, point := range data.Gauge.DataPoints {
						record := MetricRecord{
							MetricName:  metric.Name,
							ServiceName: serviceName,
							Timestamp:   time.Unix(0, int64(point.TimeUnixNano)),
							Value:       point.GetAsDouble(),
							MetricType:  "gauge",
							Labels:      h.attributesToJSON(point.Attributes),
						}
						h.batchData.Metrics = append(h.batchData.Metrics, record)
					}
				case *metricsv1.Metric_Sum:
					for _, point := range data.Sum.DataPoints {
						record := MetricRecord{
							MetricName:  metric.Name,
							ServiceName: serviceName,
							Timestamp:   time.Unix(0, int64(point.TimeUnixNano)),
							Value:       point.GetAsDouble(),
							MetricType:  "sum",
							Labels:      h.attributesToJSON(point.Attributes),
						}
						h.batchData.Metrics = append(h.batchData.Metrics, record)
					}
				}
			}
		}
	}

	return nil
}

func (h *ConsumerGroupHandler) processLogs(data []byte) error {
	var req logscollectorv1.ExportLogsServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return fmt.Errorf("failed to unmarshal logs data: %v", err)
	}

	h.batchData.mu.Lock()
	defer h.batchData.mu.Unlock()

	for _, resourceLog := range req.ResourceLogs {
		serviceName := "unknown"
		
		// Extract service name from resource attributes
		if resourceLog.Resource != nil {
			for _, attr := range resourceLog.Resource.Attributes {
				if attr.Key == "service.name" && attr.Value.GetStringValue() != "" {
					serviceName = attr.Value.GetStringValue()
					break
				}
			}
		}

		for _, scopeLog := range resourceLog.ScopeLogs {
			for _, logRecord := range scopeLog.LogRecords {
				record := LogRecord{
					TraceID:        fmt.Sprintf("%x", logRecord.TraceId),
					SpanID:         fmt.Sprintf("%x", logRecord.SpanId),
					ServiceName:    serviceName,
					Timestamp:      time.Unix(0, int64(logRecord.TimeUnixNano)),
					SeverityText:   logRecord.SeverityText,
					SeverityNumber: int32(logRecord.SeverityNumber),
					Body:           logRecord.Body.GetStringValue(),
					Attributes:     h.attributesToJSON(logRecord.Attributes),
				}

				h.batchData.Logs = append(h.batchData.Logs, record)
			}
		}
	}

	return nil
}

func (h *ConsumerGroupHandler) attributesToJSON(attributes []*commonv1.KeyValue) string {
	attrs := make(map[string]string)
	for _, attr := range attributes {
		switch v := attr.Value.Value.(type) {
		case *commonv1.AnyValue_StringValue:
			attrs[attr.Key] = v.StringValue
		case *commonv1.AnyValue_IntValue:
			attrs[attr.Key] = fmt.Sprintf("%d", v.IntValue)
		case *commonv1.AnyValue_DoubleValue:
			attrs[attr.Key] = fmt.Sprintf("%f", v.DoubleValue)
		case *commonv1.AnyValue_BoolValue:
			attrs[attr.Key] = fmt.Sprintf("%t", v.BoolValue)
		}
	}
	
	result, _ := json.Marshal(attrs)
	return string(result)
}

func parseLabelsToMap(labelsJSON string) map[string]string {
	attrs := make(map[string]string)
	if labelsJSON != "" {
		json.Unmarshal([]byte(labelsJSON), &attrs)
	}
	return attrs
}

func (s *IngestionService) writeTraces(traces []TraceRecord) error {
	ctx := context.Background()
	batch, err := s.clickhouse.PrepareBatch(ctx, "INSERT INTO otel.traces")
	if err != nil {
		return err
	}

	for _, trace := range traces {
		// Map to current ClickHouse OTEL schema (22 columns)
		err := batch.Append(
			trace.StartTime,                    // Timestamp
			trace.TraceID,                      // TraceId
			trace.SpanID,                       // SpanId
			trace.ParentSpanID,                 // ParentSpanId
			"",                                 // TraceState
			trace.OperationName,                // SpanName
			fmt.Sprintf("%d", trace.SpanKind),  // SpanKind
			trace.ServiceName,                  // ServiceName
			map[string]string{"service.name": trace.ServiceName}, // ResourceAttributes
			"",                                 // ScopeName
			"",                                 // ScopeVersion
			map[string]string{},                // SpanAttributes (empty map)
			trace.Duration,                     // Duration
			fmt.Sprintf("%d", trace.StatusCode), // StatusCode
			"",                                 // StatusMessage
			[]time.Time{},                      // Events.Timestamp
			[]string{},                         // Events.Name
			[]map[string]string{},              // Events.Attributes
			[]string{},                         // Links.TraceId
			[]string{},                         // Links.SpanId
			[]string{},                         // Links.TraceState
			[]map[string]string{},              // Links.Attributes
		)
		if err != nil {
			return err
		}
	}

	return batch.Send()
}

func (s *IngestionService) writeMetrics(metrics []MetricRecord) error {
	ctx := context.Background()
	
	// Split by metric type
	gauges := []MetricRecord{}
	sums := []MetricRecord{}
	
	for _, metric := range metrics {
		switch metric.MetricType {
		case "gauge":
			gauges = append(gauges, metric)
		case "sum":
			sums = append(sums, metric)
		}
	}

	// Write gauges - map to current ClickHouse OTEL schema (22 columns) 
	if len(gauges) > 0 {
		batch, err := s.clickhouse.PrepareBatch(ctx, "INSERT INTO otel.metrics_gauge")
		if err != nil {
			return err
		}

		for _, metric := range gauges {
			err := batch.Append(
				map[string]string{"service.name": metric.ServiceName}, // ResourceAttributes
				"",                                 // ResourceSchemaUrl
				"",                                 // ScopeName
				"",                                 // ScopeVersion
				map[string]string{},                // ScopeAttributes
				uint32(0),                          // ScopeDroppedAttrCount
				"",                                 // ScopeSchemaUrl
				metric.MetricName,                  // MetricName
				"",                                 // MetricDescription
				"",                                 // MetricUnit
				parseLabelsToMap(metric.Labels),    // Attributes
				metric.Timestamp,                   // StartTimeUnix
				metric.Timestamp,                   // TimeUnix
				metric.Value,                       // Value
				uint32(0),                          // Flags
				[]map[string]string{},              // Exemplars.FilteredAttributes
				[]time.Time{},                      // Exemplars.TimeUnix
				[]float64{},                        // Exemplars.Value
				[]string{},                         // Exemplars.SpanId
				[]string{},                         // Exemplars.TraceId
			)
			if err != nil {
				return err
			}
		}

		if err := batch.Send(); err != nil {
			return err
		}
	}

	// Write sums - map to current ClickHouse OTEL schema (22 columns)
	if len(sums) > 0 {
		batch, err := s.clickhouse.PrepareBatch(ctx, "INSERT INTO otel.metrics_sum")
		if err != nil {
			return err
		}

		for _, metric := range sums {
			err := batch.Append(
				map[string]string{"service.name": metric.ServiceName}, // ResourceAttributes
				"",                                 // ResourceSchemaUrl
				"",                                 // ScopeName
				"",                                 // ScopeVersion
				map[string]string{},                // ScopeAttributes
				uint32(0),                          // ScopeDroppedAttrCount
				"",                                 // ScopeSchemaUrl
				metric.MetricName,                  // MetricName
				"",                                 // MetricDescription
				"",                                 // MetricUnit
				parseLabelsToMap(metric.Labels),    // Attributes
				metric.Timestamp,                   // StartTimeUnix
				metric.Timestamp,                   // TimeUnix
				metric.Value,                       // Value
				uint32(0),                          // Flags
				[]map[string]string{},              // Exemplars.FilteredAttributes
				[]time.Time{},                      // Exemplars.TimeUnix
				[]float64{},                        // Exemplars.Value
				[]string{},                         // Exemplars.SpanId
				[]string{},                         // Exemplars.TraceId
				int32(1),                           // AggTemp (sum metrics have this)
				true,                               // IsMonotonic (sum metrics have this)
			)
			if err != nil {
				return err
			}
		}

		if err := batch.Send(); err != nil {
			return err
		}
	}

	return nil
}

func (s *IngestionService) writeLogs(logs []LogRecord) error {
	ctx := context.Background()
	batch, err := s.clickhouse.PrepareBatch(ctx, "INSERT INTO otel.logs")
	if err != nil {
		return err
	}

	for _, log := range logs {
		// Map to current ClickHouse OTEL schema (15 columns)
		err := batch.Append(
			log.Timestamp,                      // Timestamp
			log.TraceID,                        // TraceId
			log.SpanID,                         // SpanId
			uint32(0),                          // TraceFlags
			log.SeverityText,                   // SeverityText
			log.SeverityNumber,                 // SeverityNumber
			log.ServiceName,                    // ServiceName
			log.Body,                           // Body
			"",                                 // ResourceSchemaUrl
			map[string]string{"service.name": log.ServiceName}, // ResourceAttributes
			"",                                 // ScopeSchemaUrl
			"",                                 // ScopeName
			"",                                 // ScopeVersion
			map[string]string{},                // ScopeAttributes
			map[string]string{},                // LogAttributes
		)
		if err != nil {
			return err
		}
	}

	return batch.Send()
}

func main() {
	config := Config{
		KafkaBrokers:  strings.Split(os.Getenv("KAFKA_BROKERS"), ","),
		ClickHouseAddr: os.Getenv("CLICKHOUSE_ADDR"),
		ConsumerGroup: os.Getenv("CONSUMER_GROUP"),
		BatchSize:     1000,
		FlushInterval: 10 * time.Second,
		WorkerCount:   4,
	}

	// Set defaults
	if len(config.KafkaBrokers) == 0 || config.KafkaBrokers[0] == "" {
		config.KafkaBrokers = []string{"kafka.appsentry-kafka.svc.cluster.local:9092"}
	}
	if config.ClickHouseAddr == "" {
		config.ClickHouseAddr = "clickhouse.appsentry-clickhouse.svc.cluster.local:9000"
	}
	if config.ConsumerGroup == "" {
		config.ConsumerGroup = "appsentry-ingestion"
	}

	log.Printf("Starting AppSentry Ingestion Service")
	log.Printf("Kafka Brokers: %v", config.KafkaBrokers)
	log.Printf("ClickHouse: %s", config.ClickHouseAddr)
	log.Printf("Consumer Group: %s", config.ConsumerGroup)

	service, err := NewIngestionService(config)
	if err != nil {
		log.Fatalf("Failed to create ingestion service: %v", err)
	}

	if err := service.Start(); err != nil {
		log.Fatalf("Service error: %v", err)
	}
}