#!/bin/bash

# Build locally for testing (loads into minikube)

set -e

DOCKER_REPO="lijomadassery/appsentry-ingestion-service"
VERSION="local-$(date +%s)"

echo "Building AppSentry Ingestion Service locally..."
echo "Repository: $DOCKER_REPO"
echo "Version: $VERSION"

# Build for local platform
docker build -t $DOCKER_REPO:$VERSION -t $DOCKER_REPO:local .

echo "Loading image into minikube..."
minikube image load $DOCKER_REPO:local

echo "Local build completed!"
echo "To use in Kubernetes (local testing):"
echo "  image: $DOCKER_REPO:local"
echo "  imagePullPolicy: Never"