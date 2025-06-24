#!/bin/bash

# AppSentry Build and Deploy Script
# Builds Docker images and deploys to Minikube

set -e

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

# Configuration
NAMESPACE="appsentry"
TAG="latest"
LOCAL_BUILD=${LOCAL_BUILD:-true}  # Set to false to build for DockerHub

if [ "$LOCAL_BUILD" = "true" ]; then
    BACKEND_IMAGE="appsentry/backend"
    FRONTEND_IMAGE="appsentry/frontend"
    INGESTION_IMAGE="appsentry/ingestion-service"
else
    BACKEND_IMAGE="docker.io/lijomadassery/appsentry-backend"
    FRONTEND_IMAGE="docker.io/lijomadassery/appsentry-frontend"
    INGESTION_IMAGE="docker.io/lijomadassery/appsentry-ingestion-service"
fi

echo "🚀 Starting AppSentry Build and Deploy Process"
echo "================================================="

# Step 1: Check prerequisites
log_info "Step 1: Checking prerequisites..."

# Check if Minikube is running
if ! minikube status | grep -q "Running"; then
    log_error "Minikube is not running. Please start it with: minikube start"
    exit 1
fi
log_success "Minikube is running"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker"
    exit 1
fi
log_success "Docker is running"

# Step 2: Set up Docker environment for Minikube
log_info "Step 2: Setting up Docker environment..."
eval $(minikube -p minikube docker-env)
log_success "Docker environment configured for Minikube"

# Step 3: Create namespace if it doesn't exist
log_info "Step 3: Creating namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
log_success "Namespace '$NAMESPACE' ready"

# Step 4: Handle Docker images
if [ "$LOCAL_BUILD" = "true" ]; then
    # Build images locally
    log_info "Step 4: Building backend Docker image..."
    docker build -t $BACKEND_IMAGE:$TAG -f Dockerfile .
    log_success "Backend image built: $BACKEND_IMAGE:$TAG"

    log_info "Step 5: Building frontend Docker image..."
    docker build -t $FRONTEND_IMAGE:$TAG -f frontend/Dockerfile ./frontend
    log_success "Frontend image built: $FRONTEND_IMAGE:$TAG"

    log_info "Step 5.5: Building ingestion service Docker image..."
    docker build -t $INGESTION_IMAGE:$TAG -f ingestion-service/Dockerfile ./ingestion-service
    log_success "Ingestion service image built: $INGESTION_IMAGE:$TAG"
else
    # Pull images from DockerHub
    log_info "Step 4: Pulling Docker images from DockerHub..."
    
    log_info "Pulling backend image..."
    docker pull $BACKEND_IMAGE:$TAG || docker pull $BACKEND_IMAGE:master
    
    log_info "Pulling frontend image..."
    docker pull $FRONTEND_IMAGE:$TAG || docker pull $FRONTEND_IMAGE:master
    
    log_info "Pulling ingestion service image..."
    docker pull $INGESTION_IMAGE:$TAG || docker pull $INGESTION_IMAGE:master
    
    log_success "All images pulled from DockerHub"
fi

# Step 6: Deploy backend
log_info "Step 6: Deploying backend to Kubernetes..."
kubectl apply -f k8s/appsentry-backend.yaml
log_success "Backend deployed"

# Step 7: Deploy frontend
log_info "Step 7: Deploying frontend to Kubernetes..."
kubectl apply -f k8s/appsentry-frontend.yaml
log_success "Frontend deployed"

# Step 8: Wait for deployments to be ready
log_info "Step 8: Waiting for deployments to be ready..."

log_info "Waiting for backend deployment..."
kubectl wait --for=condition=available --timeout=300s deployment/appsentry-backend -n $NAMESPACE

log_info "Waiting for frontend deployment..."
kubectl wait --for=condition=available --timeout=300s deployment/appsentry-frontend -n $NAMESPACE

log_success "All deployments are ready"

# Step 9: Check pod status
log_info "Step 9: Checking pod status..."
kubectl get pods -n $NAMESPACE -l "app in (appsentry-backend,appsentry-frontend)"

# Step 10: Set up port forwarding for testing
log_info "Step 10: Setting up port forwarding for testing..."

# Kill any existing port forwards
pkill -f "kubectl.*port-forward" || true
sleep 2

# Start port forwards in background
kubectl port-forward -n $NAMESPACE svc/appsentry-backend 3001:3001 &
BACKEND_PF_PID=$!

kubectl port-forward -n $NAMESPACE svc/appsentry-frontend 3000:3000 &
FRONTEND_PF_PID=$!

# Wait a moment for port forwards to establish
sleep 3

log_success "Port forwarding established:"
log_success "  - Backend: http://localhost:3001"
log_success "  - Frontend: http://localhost:3000"

# Step 11: Health checks
log_info "Step 11: Performing health checks..."

# Test backend health
if curl -s -f http://localhost:3001/health > /dev/null; then
    log_success "Backend health check passed"
else
    log_warning "Backend health check failed"
fi

# Test frontend health
if curl -s -f http://localhost:3000/health.json > /dev/null; then
    log_success "Frontend health check passed"
else
    log_warning "Frontend health check failed"
fi

echo ""
log_success "🎉 AppSentry deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "  1. Access the application:"
echo "     - Frontend: http://localhost:3000"
echo "     - Backend API: http://localhost:3001"
echo ""
echo "  2. Run the e2e test:"
echo "     ./test-e2e-flow.sh"
echo ""
echo "  3. View logs:"
echo "     kubectl logs -n $NAMESPACE -l app=appsentry-backend"
echo "     kubectl logs -n $NAMESPACE -l app=appsentry-frontend"
echo ""
echo "  4. Stop port forwarding when done:"
echo "     kill $BACKEND_PF_PID $FRONTEND_PF_PID"
echo ""

# Save PIDs for cleanup script
echo "BACKEND_PF_PID=$BACKEND_PF_PID" > .port-forward-pids
echo "FRONTEND_PF_PID=$FRONTEND_PF_PID" >> .port-forward-pids

log_info "Port forward PIDs saved to .port-forward-pids"
log_info "Ready for testing! 🚀"