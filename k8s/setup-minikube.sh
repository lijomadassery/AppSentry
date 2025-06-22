#!/bin/bash

set -e

echo "🚀 Setting up AppSentry OTEL Observability Platform"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Please install minikube manually for your OS."
    exit 1
fi

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    print_error "Homebrew is required but not installed. Please install Homebrew first."
    exit 1
fi

# Check if Docker is running
if ! docker ps &> /dev/null; then
    print_warning "Docker is not running. Starting Docker Desktop..."
    open -a Docker
    print_status "Waiting for Docker to start..."
    while ! docker ps &> /dev/null; do
        sleep 2
        echo -n "."
    done
    echo ""
    print_success "Docker is now running"
fi

# Install minikube if not already installed
if ! command -v minikube &> /dev/null; then
    print_status "Installing minikube..."
    brew install minikube
    print_success "Minikube installed"
else
    print_success "Minikube already installed"
fi

# Check if minikube is running
if minikube status &> /dev/null; then
    print_warning "Minikube is already running. Stopping current instance..."
    minikube stop
fi

# Start minikube with appropriate resources
print_status "Starting minikube with OTEL configuration..."
minikube start \
    --cpus=4 \
    --memory=4096 \
    --disk-size=20g \
    --driver=docker \
    --kubernetes-version=v1.28.3 \
    --addons=metrics-server,dashboard

print_success "Minikube started successfully"

# Enable required addons
print_status "Enabling required addons..."
minikube addons enable metrics-server
minikube addons enable dashboard

# Apply Kubernetes manifests
print_status "Deploying OTEL infrastructure..."

# Apply namespace and RBAC
kubectl apply -f /Users/lijomadassery/Documents/Work/AppSentry/k8s/otel/namespace.yaml
print_success "Namespace and RBAC created"

# Deploy ClickHouse
kubectl apply -f /Users/lijomadassery/Documents/Work/AppSentry/k8s/otel/clickhouse.yaml
print_status "ClickHouse deployment created. Waiting for it to be ready..."

# Wait for ClickHouse to be ready
kubectl wait --for=condition=available --timeout=300s deployment/clickhouse -n appsentry-otel
print_success "ClickHouse is ready"

# Deploy OTEL Collector
kubectl apply -f /Users/lijomadassery/Documents/Work/AppSentry/k8s/otel/otel-collector.yaml
print_status "OTEL Collector deployment created. Waiting for it to be ready..."

# Wait for OTEL Collector to be ready
kubectl wait --for=condition=available --timeout=300s deployment/otel-collector -n appsentry-otel
print_success "OTEL Collector is ready"

# Get minikube IP
MINIKUBE_IP=$(minikube ip)

# Display connection information
echo ""
echo "🎉 OTEL Infrastructure Successfully Deployed!"
echo "============================================="
echo ""
echo "📊 Service Endpoints:"
echo "  • OTEL Collector GRPC: ${MINIKUBE_IP}:30317"
echo "  • OTEL Collector HTTP: ${MINIKUBE_IP}:30318"
echo "  • ClickHouse HTTP:     ${MINIKUBE_IP}:$(kubectl get svc clickhouse -n appsentry-otel -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo 'pending')"
echo ""
echo "🔍 Monitoring & Debug:"
echo "  • OTEL Collector Health: http://${MINIKUBE_IP}:$(kubectl get svc otel-collector-external -n appsentry-otel -o jsonpath='{.spec.ports[2].nodePort}' 2>/dev/null || echo 'pending')"
echo "  • Kubernetes Dashboard:  minikube dashboard"
echo ""
echo "📝 Next Steps:"
echo "  1. Update AppSentry backend to send OTEL data to: ${MINIKUBE_IP}:30318"
echo "  2. Update AppSentry frontend to send OTEL data to: ${MINIKUBE_IP}:30318"
echo "  3. Instrument your applications with OTEL SDKs"
echo ""
echo "🐛 Debugging Commands:"
echo "  • View OTEL Collector logs: kubectl logs -f deployment/otel-collector -n appsentry-otel"
echo "  • View ClickHouse logs:     kubectl logs -f deployment/clickhouse -n appsentry-otel"
echo "  • Check pod status:         kubectl get pods -n appsentry-otel"
echo ""

# Save configuration to file
cat > /Users/lijomadassery/Documents/Work/AppSentry/otel-config.env << EOF
# OTEL Configuration for AppSentry
OTEL_EXPORTER_OTLP_ENDPOINT=http://${MINIKUBE_IP}:30318
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://${MINIKUBE_IP}:30318/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://${MINIKUBE_IP}:30318/v1/metrics
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://${MINIKUBE_IP}:30318/v1/logs
OTEL_SERVICE_NAME=appsentry
OTEL_SERVICE_VERSION=1.0.0
OTEL_RESOURCE_ATTRIBUTES=service.name=appsentry,deployment.environment=minikube
CLICKHOUSE_URL=http://${MINIKUBE_IP}:$(kubectl get svc clickhouse -n appsentry-otel -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo '8123')
EOF

print_success "OTEL configuration saved to otel-config.env"
echo ""
echo "✨ Ready to instrument AppSentry with OpenTelemetry!"