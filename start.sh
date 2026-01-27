#!/bin/bash

# Start MTG Tracker - Backend and Frontend

echo "Starting MTG Tracker..."

# Start backend in background
cd backend && npm run dev &
BACKEND_PID=$!

# Start frontend in background
cd frontend && npm start &
FRONTEND_PID=$!

# Handle Ctrl+C to stop both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

echo "Backend running on http://localhost:5000"
echo "Frontend running on http://localhost:3000"
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait
