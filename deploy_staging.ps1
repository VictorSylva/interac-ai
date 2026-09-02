# deploy_staging.ps1
# Script to build and deploy the InteracAI Staging environment

$ErrorActionPreference = "Stop"

Write-Host "--- [INTERAC AI] STAGING DEPLOYMENT START ---" -ForegroundColor Cyan

# 1. Check current branch
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "staging") {
    Write-Host "ERROR: You must be on the 'staging' branch to deploy to staging. Current branch: $branch" -ForegroundColor Red
    exit 1
}

# 2. Build Frontend
Write-Host "Building frontend for staging..." -ForegroundColor Yellow
cd frontend
# Force staging environment variables for Create React App
Copy-Item .env.staging .env.production.local -Force
npm run build
$buildResult = $LASTEXITCODE
Remove-Item .env.production.local -Force
if ($buildResult -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

# 3. Deploy to Firebase
Write-Host "Deploying to Firebase Hosting (Staging)..." -ForegroundColor Yellow
# Note: Ensure you have a 'staging' target in firebase.json or use --site
npx firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { Write-Host "Firebase deployment failed!" -ForegroundColor Red; exit 1 }

# 4. Push Backend to Staging branch (Triggers Render staging build)
Write-Host "Pushing code to staging branch..." -ForegroundColor Yellow
cd ..
git push origin staging

Write-Host "--- [INTERAC AI] STAGING DEPLOYMENT COMPLETE ---" -ForegroundColor Green
Write-Host "Frontend: https://interac-ai.web.app"
Write-Host "Backend: https://interact-backend-staging.onrender.com (or your custom Render URL)"
