
# deploy_production.ps1
# Script to build and deploy the InteracAI Production environment

$ErrorActionPreference = "Stop"

Write-Host "--- [INTERAC AI] PRODUCTION DEPLOYMENT START ---" -ForegroundColor Red

# 1. Check current branch
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "production") {
    Write-Host "ERROR: You must be on the 'production' branch to deploy to production. Current branch: $branch" -ForegroundColor Red
    exit 1
}

# 2. Build Frontend
Write-Host "Building frontend for production..." -ForegroundColor Yellow
cd frontend
# Uses default .env.production
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

# 3. Deploy to Firebase
Write-Host "Deploying to Firebase Hosting (Production)..." -ForegroundColor Yellow
npx firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { Write-Host "Firebase deployment failed!" -ForegroundColor Red; exit 1 }

# 4. Push Backend to Production branch (Triggers Render production build)
Write-Host "Pushing code to production branch..." -ForegroundColor Yellow
cd ..
git push origin production

Write-Host "--- [INTERAC AI] PRODUCTION DEPLOYMENT COMPLETE ---" -ForegroundColor Green
Write-Host "Live Site: https://interacai.com"
