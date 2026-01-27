#!/bin/bash

# Stop MTG Tracker - Kill backend and frontend processes

echo "Stopping MTG Tracker..."

# Kill Node processes running on port 5000 (backend)
BACKEND_PID=$(lsof -t -i:5000 2>/dev/null)
if [ -n "$BACKEND_PID" ]; then
  echo "Stopping backend (PID: $BACKEND_PID)..."
  kill $BACKEND_PID 2>/dev/null
  echo "Backend stopped."
else
  echo "Backend not running."
fi

# Kill Node processes running on port 3000 (frontend)
FRONTEND_PID=$(lsof -t -i:3000 2>/dev/null)
if [ -n "$FRONTEND_PID" ]; then
  echo "Stopping frontend (PID: $FRONTEND_PID)..."
  kill $FRONTEND_PID 2>/dev/null
  echo "Frontend stopped."
else
  echo "Frontend not running."
fi

# Alternative: Kill by process name if lsof doesn't work
# pkill -f "node.*server.js" 2>/dev/null
# pkill -f "react-scripts start" 2>/dev/null

echo "MTG Tracker stopped."
