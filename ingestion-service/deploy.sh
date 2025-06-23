#!/bin/bash

# Deploy ingestion service with version control

set -e

VERSION=${1:-latest}
DOCKER_REPO="lijomadassery/appsentry-ingestion-service"

echo "Deploying AppSentry Ingestion Service..."
echo "Version: $VERSION"

# Update the deployment with specific version
sed "s|image: lijomadassery/appsentry-ingestion-service:.*|image: $DOCKER_REPO:$VERSION|" \
  /Users/lijomadassery/Documents/Work/AppSentry/k8s/ingestion-service.yaml | \
  kubectl apply -f -

echo "Waiting for deployment to be ready..."
kubectl rollout status deployment/ingestion-service -n appsentry-ingestion --timeout=120s

echo "Deployment completed!"
echo "Checking pod status..."
kubectl get pods -n appsentry-ingestion

echo ""
echo "Service endpoints:"
kubectl get services -n appsentry-ingestion