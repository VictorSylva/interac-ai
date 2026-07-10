# InteracAI Dev Starter
$env:ENV="development"
Write-Host "Starting InteracAI in Development Mode..." -ForegroundColor Cyan
.\venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
