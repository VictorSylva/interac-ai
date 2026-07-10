# InteracAI Complete Deployment Guide

This guide covers the deployment workflow, from committing code to a live production state.

## 1. Version Control & Branches
- `main`: The single source of truth for production code. All code merged here should be strictly reviewed and tested.
- `staging`: Used for the testing environment.

## 2. CI/CD Pipeline (Render Auto-Deploy)
Render is configured to automatically deploy changes pushed to the designated branch.
1. **Push to `main`**: Triggers a build for the Backend API, Worker, and Frontend.
2. **Build Phase**:
   - **Backend**: Render pulls the Docker image, installs `requirements.txt` via Dockerfile.
   - **Frontend**: Render runs `npm run build`.
3. **Pre-Deploy Hooks**:
   - Render should be configured to run `alembic upgrade head` to automatically apply any new database schema changes before starting the new web service containers.

## 3. Deployment Scripts (`ps1` / `.bat`)
The workspace contains several helper scripts:
- `deploy_production.ps1` / `deploy_staging.ps1`: Use these for pushing changes, tagging releases, and manually triggering deployments via Render deploy hooks if auto-deploy is disabled.
- Ensure the Render Deploy Hook URL is securely added to the script parameters when using these.

## 4. Health Checks
Configure Render to hit the following endpoints to ensure the application is successfully booted before routing traffic:
- **Backend**: `GET /api/v1/health` (Assuming standard FastAPI health check exists. If not, map to `GET /docs` temporarily).
- **Argus OS**: `GET /`

## 5. Rollback Procedure
If a deployment fails or introduces critical bugs:
1. Go to the Render Dashboard.
2. Select the service (e.g., `interacai-api`).
3. Go to the "Events" or "Deploys" tab.
4. Click on the last known good deployment.
5. Click **"Rollback to this deploy"**.
   - *Note: If database migrations were applied, you may need to manually downgrade the database using `alembic downgrade -1` before rolling back the code.*
