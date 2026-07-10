@echo off
echo ===========================================
echo   InteractAI: Unified Terminal Startup
echo ===========================================

echo [1/1] Building and Launching All Services via Docker Compose...
docker-compose up -d --build

echo.
echo -------------------------------------------
echo   Everything is starting up!
echo   - API Gateway: http://localhost:8080
echo   - Backend: http://localhost:8000
echo   - Frontend: Needs 'npm run start' in its own window
echo -------------------------------------------
pause
