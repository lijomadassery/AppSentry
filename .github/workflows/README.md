# GitHub Actions Workflows

## Docker Build and Push

The `docker-build-push.yml` workflow automatically builds and pushes Docker images to Docker Hub.

### Triggers
- **Push to master/main**: Builds and pushes with `latest` tag
- **Pull requests**: Builds only (no push)
- **Git tags (v*)**: Builds and pushes with version tag

### Required Secrets
Set these in your GitHub repository settings (Settings → Secrets and variables → Actions):
- `DOCKERHUB_USERNAME`: Your Docker Hub username (e.g., lijomadassery)
- `DOCKERHUB_TOKEN`: Docker Hub access token (not your password)

### Image Tags
- `latest`: Always points to the latest master/main build
- `master`/`main`: Branch-specific tags
- `v*.*.*`: Semantic version tags (e.g., v2.2.0)
- `v*.*`: Major.minor tags (e.g., v2.2)

### Manual Deployment
To deploy a specific version:
1. Create a git tag: `git tag v2.2.0`
2. Push the tag: `git push origin v2.2.0`
3. GitHub Actions will build, push, and update k8s manifests

### Local Testing
```bash
# Test the build locally
docker build -t appsentry-backend:test .
docker build -t appsentry-frontend:test frontend/
```