@echo off
echo ==============================================
echo   GhostPilot $0 Local Laptop Launcher
echo   Web Dashboard: http://localhost:3000
echo   Telegram Bot:  Auto-polling every 8 seconds
echo ==============================================

if not exist "node_modules" (
  echo Installing dependencies (one-time)...
  call npm install
)

call npm run dev
pause
