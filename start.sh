#!/bin/bash
cd /home/ayush-ranjan/Documents/zomato-live-agent

echo "Starting backend..."
cd backend
PORT=8055 uvicorn main:app --reload --port 8055 &
BACKEND_PID=$!

cd /home/ayush-ranjan/Documents/zomato-live-agent
echo "Starting GCP Voice Agent Server..."
cd voice_agent_server
PORT=8080 uvicorn main:app --reload --port 8080 &
VOICE_AGENT_PID=$!

cd /home/ayush-ranjan/Documents/zomato-live-agent
echo "Starting frontend..."
cd frontend
python3 -m http.server 8056 &
FRONTEND_PID=$!

echo "=================================================="
echo "Backend API running on         http://localhost:8055"
echo "GCP Voice Agent running on     ws://localhost:8080/ws/voice"
echo "Frontend UI running on         http://localhost:8056/index.html"
echo "=================================================="

wait
