#!/usr/bin/env bash
set -e

echo "=============================================="
echo "  GhostPilot $0 Local Laptop Launcher"
echo "  Web Dashboard: http://localhost:3000"
echo "  Telegram Bot:  Auto-polling every 8 seconds"
echo "=============================================="

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (one-time)..."
  npm install
fi

npm run dev
