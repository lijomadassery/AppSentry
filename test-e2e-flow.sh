#!/bin/bash

# End-to-End Flow Testing Script for AppSentry Phase 1 Architecture
# Tests: OTEL SDK → OTEL Collector → Kafka → Go Ingestion Service → ClickHouse

set -e

echo "🚀 Starting AppSentry Phase 1 End-to-End Test"
echo "=============================================="

# Configuration
OTEL_COLLECTOR_ENDPOINT="http://localhost:4318"
INGESTION_METRICS_ENDPOINT="http://localhost:8080"
BACKEND_ENDPOINT="http://localhost:3001"

# Auto-setup port forwarding if not already running
setup_port_forwarding() {
    log_info "Setting up port forwarding for e2e test..."
    
    # Kill any existing port forwards
    pkill -f "kubectl.*port-forward.*otel-collector" || true
    pkill -f "kubectl.*port-forward.*ingestion-service" || true
    sleep 2
    
    # Start port forwards
    kubectl port-forward -n appsentry-otel svc/otel-collector 4318:4318 &
    kubectl port-forward -n appsentry-ingestion svc/ingestion-service 8080:8080 &
    
    # Wait for port forwards to establish
    sleep 3
}

# Check if services are accessible, if not setup port forwarding
check_and_setup_connectivity() {
    if ! curl -s -f "$INGESTION_METRICS_ENDPOINT/health" > /dev/null 2>&1; then
        log_warning "Services not accessible, setting up port forwarding..."
        setup_port_forwarding
    fi
}
TEST_DURATION=30
LOAD_INTENSITY=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a service is running
check_service() {
    local service_name="$1"
    local endpoint="$2"
    local max_retries=5
    local retry=0

    log_info "Checking $service_name..."
    
    while [ $retry -lt $max_retries ]; do
        if [ "$service_name" = "OTEL Collector" ]; then
            # For OTEL Collector, check with proper POST request
            local response_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$endpoint")
            if [ "$response_code" = "400" ] || [ "$response_code" = "415" ] || [ "$response_code" = "200" ]; then
                log_success "$service_name is running (HTTP $response_code)"
                return 0
            fi
        else
            # For other services, use regular GET request
            if curl -s -f "$endpoint" > /dev/null 2>&1; then
                log_success "$service_name is running"
                return 0
            fi
        fi
        retry=$((retry + 1))
        log_warning "$service_name not ready, retrying ($retry/$max_retries)..."
        sleep 2
    done
    
    log_error "$service_name is not responding"
    return 1
}

# Function to get metrics from a Prometheus endpoint
get_metric_value() {
    local endpoint="$1"
    local metric_name="$2"
    local labels="$3"
    
    curl -s "$endpoint" | grep "^$metric_name" | grep "$labels" | tail -1 | awk '{print $2}' || echo "0"
}

# Function to send test trace data
send_test_trace() {
    local service_name="$1"
    local operation_name="$2"
    local trace_id=$(openssl rand -hex 16)
    local span_id=$(openssl rand -hex 8)
    local timestamp_ns=$(date +%s%N)
    local end_time_ns=$((timestamp_ns + 1000000000))
    
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{
          \"resourceSpans\": [{
            \"resource\": {
              \"attributes\": [{
                \"key\": \"service.name\",
                \"value\": {\"stringValue\": \"$service_name\"}
              }, {
                \"key\": \"service.version\", 
                \"value\": {\"stringValue\": \"1.0.0\"}
              }]
            },
            \"scopeSpans\": [{
              \"scope\": {
                \"name\": \"test-scope\"
              },
              \"spans\": [{
                \"traceId\": \"$trace_id\",
                \"spanId\": \"$span_id\", 
                \"name\": \"$operation_name\",
                \"kind\": 1,
                \"startTimeUnixNano\": \"$timestamp_ns\",
                \"endTimeUnixNano\": \"$end_time_ns\",
                \"status\": {
                  \"code\": 1
                },
                \"attributes\": [{
                  \"key\": \"test.id\",
                  \"value\": {\"stringValue\": \"e2e-test\"}
                }]
              }]
            }]
          }]
        }" \
        "$OTEL_COLLECTOR_ENDPOINT/v1/traces"
}

# Function to send test metrics
send_test_metric() {
    local service_name="$1"
    local metric_name="$2"
    local value="$3"
    local timestamp_ns=$(date +%s%N)
    
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{
          \"resourceMetrics\": [{
            \"resource\": {
              \"attributes\": [{
                \"key\": \"service.name\",
                \"value\": {\"stringValue\": \"$service_name\"}
              }]
            },
            \"scopeMetrics\": [{
              \"scope\": {
                \"name\": \"test-scope\"
              },
              \"metrics\": [{
                \"name\": \"$metric_name\",
                \"description\": \"Test metric for e2e validation\",
                \"unit\": \"1\",
                \"sum\": {
                  \"dataPoints\": [{
                    \"attributes\": [{
                      \"key\": \"test.id\",
                      \"value\": {\"stringValue\": \"e2e-test\"}
                    }],
                    \"startTimeUnixNano\": \"$timestamp_ns\",
                    \"timeUnixNano\": \"$timestamp_ns\",
                    \"asDouble\": $value
                  }],
                  \"aggregationTemporality\": 2,
                  \"isMonotonic\": true
                }
              }]
            }]
          }]
        }" \
        "$OTEL_COLLECTOR_ENDPOINT/v1/metrics"
}

# Function to send test logs
send_test_log() {
    local service_name="$1"
    local log_body="$2"
    local severity="$3"
    local timestamp_ns=$(date +%s%N)
    
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{
          \"resourceLogs\": [{
            \"resource\": {
              \"attributes\": [{
                \"key\": \"service.name\",
                \"value\": {\"stringValue\": \"$service_name\"}
              }]
            },
            \"scopeLogs\": [{
              \"scope\": {
                \"name\": \"test-scope\"
              },
              \"logRecords\": [{
                \"timeUnixNano\": \"$timestamp_ns\",
                \"severityNumber\": 9,
                \"severityText\": \"$severity\",
                \"body\": {
                  \"stringValue\": \"$log_body\"
                },
                \"attributes\": [{
                  \"key\": \"test.id\",
                  \"value\": {\"stringValue\": \"e2e-test\"}
                }]
              }]
            }]
          }]
        }" \
        "$OTEL_COLLECTOR_ENDPOINT/v1/logs"
}

# Start the test
echo ""
log_info "Phase 1: Pre-flight checks"
echo "==========================================="

# Setup connectivity if needed
check_and_setup_connectivity

# Check all services are running
check_service "OTEL Collector" "$OTEL_COLLECTOR_ENDPOINT/v1/traces" || exit 1
check_service "Ingestion Service" "$INGESTION_METRICS_ENDPOINT/health" || exit 1
check_service "Backend API" "$BACKEND_ENDPOINT/api/otel/health" || exit 1

echo ""
log_info "Phase 2: Baseline metrics collection"
echo "==========================================="

# Get baseline metrics from ingestion service
log_info "Collecting baseline metrics..."
initial_messages=$(get_metric_value "$INGESTION_METRICS_ENDPOINT/metrics" "appsentry_messages_processed_total" "status=\"success\"")
initial_batches=$(get_metric_value "$INGESTION_METRICS_ENDPOINT/metrics" "appsentry_batches_written_total" "status=\"success\"")
initial_errors=$(get_metric_value "$INGESTION_METRICS_ENDPOINT/metrics" "appsentry_errors_total" "")

log_info "Baseline - Messages processed: $initial_messages"
log_info "Baseline - Batches written: $initial_batches"  
log_info "Baseline - Errors: $initial_errors"

echo ""
log_info "Phase 3: Load generation"
echo "==========================================="

log_info "Generating load for $TEST_DURATION seconds with intensity $LOAD_INTENSITY..."

# Start background load generation
for i in $(seq 1 $LOAD_INTENSITY); do
    (
        end_time=$(($(date +%s) + TEST_DURATION))
        counter=0
        while [ $(date +%s) -lt $end_time ]; do
            counter=$((counter + 1))
            
            # Send a trace every iteration
            send_test_trace "e2e-test-service-$i" "test-operation-$counter" > /dev/null 2>&1
            
            # Send a metric every 3rd iteration
            if [ $((counter % 3)) -eq 0 ]; then
                send_test_metric "e2e-test-service-$i" "test_counter" "$counter" > /dev/null 2>&1
            fi
            
            # Send a log every 5th iteration
            if [ $((counter % 5)) -eq 0 ]; then
                send_test_log "e2e-test-service-$i" "Test log entry $counter" "INFO" > /dev/null 2>&1
            fi
            
            sleep 0.1
        done
        echo "Worker $i completed $counter operations"
    ) &
done

# Show progress
for i in $(seq 1 $TEST_DURATION); do
    echo -n "."
    sleep 1
done
echo ""

# Wait for all background jobs to complete
wait

log_success "Load generation completed"

echo ""
log_info "Phase 4: Metrics validation"
echo "==========================================="

# Wait a bit for ingestion to complete
log_info "Waiting 10 seconds for ingestion to complete..."
sleep 10

# Get final metrics
final_messages=$(get_metric_value "$INGESTION_METRICS_ENDPOINT/metrics" "appsentry_messages_processed_total" "status=\"success\"")
final_batches=$(get_metric_value "$INGESTION_METRICS_ENDPOINT/metrics" "appsentry_batches_written_total" "status=\"success\"")
final_errors=$(get_metric_value "$INGESTION_METRICS_ENDPOINT/metrics" "appsentry_errors_total" "")

# Calculate differences
messages_processed=$((final_messages - initial_messages))
batches_written=$((final_batches - initial_batches))
new_errors=$((final_errors - initial_errors))

log_info "Final - Messages processed: $final_messages (Δ+$messages_processed)"
log_info "Final - Batches written: $final_batches (Δ+$batches_written)"
log_info "Final - Errors: $final_errors (Δ+$new_errors)"

echo ""
log_info "Phase 5: Data validation"
echo "==========================================="

# Check if we have data in ClickHouse via backend API
log_info "Checking data in ClickHouse..."

# Count traces
trace_count=$(curl -s "$BACKEND_ENDPOINT/api/otel/traces?limit=1000&timeRange=1h" | jq '.traces | length' 2>/dev/null || echo "0")
log_info "Traces in ClickHouse: $trace_count"

# Count logs
log_count=$(curl -s "$BACKEND_ENDPOINT/api/otel/logs?limit=1000&timeRange=1h" | jq '.logs | length' 2>/dev/null || echo "0")
log_info "Logs in ClickHouse: $log_count"

echo ""
log_info "Phase 6: Health check"
echo "==========================================="

# Check ingestion service health
ingestion_health=$(curl -s "$INGESTION_METRICS_ENDPOINT/health")
if [ "$ingestion_health" = "OK" ]; then
    log_success "Ingestion service health: OK"
else
    log_warning "Ingestion service health: $ingestion_health"
fi

# Check for any consumer errors in logs (if available)
if kubectl get pods -n appsentry-ingestion > /dev/null 2>&1; then
    log_info "Checking ingestion service logs for errors..."
    error_count=$(kubectl logs -n appsentry-ingestion -l app=ingestion-service --tail=100 | grep -i error | wc -l)
    if [ "$error_count" -eq 0 ]; then
        log_success "No errors found in ingestion service logs"
    else
        log_warning "Found $error_count error messages in ingestion service logs"
    fi
fi

echo ""
log_info "Phase 7: Results summary"
echo "==========================================="

# Calculate success metrics
if [ "$messages_processed" -gt 0 ] && [ "$batches_written" -gt 0 ] && [ "$trace_count" -gt 0 ]; then
    log_success "✅ End-to-End Test PASSED"
    echo ""
    echo "📊 Test Results:"
    echo "  • Messages processed: $messages_processed"
    echo "  • Batches written: $batches_written"
    echo "  • Traces stored: $trace_count"
    echo "  • Logs stored: $log_count"
    echo "  • New errors: $new_errors"
    echo ""
    echo "🎯 Pipeline Performance:"
    echo "  • Throughput: ~$((messages_processed / TEST_DURATION)) messages/second"
    echo "  • Batch efficiency: ~$((messages_processed / batches_written)) messages/batch"
    echo ""
    log_success "The Kafka ingestion pipeline is working correctly!"
else
    log_error "❌ End-to-End Test FAILED"
    echo ""
    echo "🔍 Diagnosis:"
    if [ "$messages_processed" -eq 0 ]; then
        echo "  • No messages were processed by ingestion service"
    fi
    if [ "$batches_written" -eq 0 ]; then
        echo "  • No batches were written to ClickHouse"
    fi
    if [ "$trace_count" -eq 0 ]; then
        echo "  • No traces found in ClickHouse"
    fi
    echo ""
    echo "🛠️  Troubleshooting:"
    echo "  • Check ingestion service logs: kubectl logs -n appsentry-ingestion -l app=ingestion-service"
    echo "  • Check Kafka topics: kubectl exec kafka-client -n appsentry-kafka -- kafka-topics.sh --list --bootstrap-server kafka:9092"
    echo "  • Check OTEL collector logs: kubectl logs -n appsentry-otel -l app=otel-collector"
    exit 1
fi

echo ""
log_info "Test completed successfully! 🎉"