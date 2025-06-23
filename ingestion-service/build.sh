#!/bin/bash

# Build and push the Go ingestion service Docker image to DockerHub

set -e

# Configuration
DOCKER_REPO="lijomadassery/appsentry-ingestion-service"
VERSION=${1:-latest}  # Use provided version or default to 'latest'

echo "Building AppSentry Ingestion Service Docker image..."
echo "Repository: $DOCKER_REPO"
echo "Version: $VERSION"

# Build for multiple architectures (dev cluster compatibility)
docker buildx create --name appsentry-builder --use 2>/dev/null || docker buildx use appsentry-builder

# Build and push to DockerHub
echo "Building and pushing to DockerHub..."
docker buildx build --platform linux/amd64,linux/arm64 \
  -t $DOCKER_REPO:$VERSION \
  -t $DOCKER_REPO:latest \
  --push .

echo "Docker image built and pushed successfully!"
echo "Images:"
echo "  - $DOCKER_REPO:$VERSION"
echo "  - $DOCKER_REPO:latest"
echo ""
echo "To use in Kubernetes:"
echo "  image: $DOCKER_REPO:$VERSION"