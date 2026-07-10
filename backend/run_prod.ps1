# InteracAI Prod Starter (Simulated)
$env:ENV="production"
Write-Host "Starting InteracAI in Production Mode (Safety Check)..." -ForegroundColor Yellow
.\venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000
