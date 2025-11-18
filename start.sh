#!/bin/bash

# Audio Transcriber - Start Both Frontend and Backend

echo "================================"
echo "Audio Transcriber Setup"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python version: $PYTHON_VERSION"

# Start Backend
echo -e "${BLUE}Setting up Backend Server...${NC}"
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
echo "Installing Python dependencies..."
pip install --upgrade pip setuptools wheel

# Install ml_dtypes first to prevent downgrade by other packages
echo "Installing ml_dtypes (required for nemo-toolkit compatibility)..."
pip install --upgrade "ml_dtypes>=0.5.4"

# Now install other dependencies
echo "Installing other Python dependencies..."
pip install -r requirements.txt

# Ensure ml_dtypes stays at correct version (in case something tried to downgrade it)
echo "Verifying ml_dtypes version..."
pip install --upgrade --force-reinstall "ml_dtypes>=0.5.4"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install backend dependencies${NC}"
    exit 1
fi

# Start backend server
echo -e "${GREEN}Starting FastAPI backend...${NC}"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend to start
sleep 3

# Start Frontend
echo -e "${BLUE}Setting up Frontend Server...${NC}"
cd ../frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install frontend dependencies${NC}"
        kill $BACKEND_PID
        exit 1
    fi
fi

# Start frontend development server
echo -e "${GREEN}Starting Next.js frontend...${NC}"
PORT=3001 npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend started (PID: $FRONTEND_PID)${NC}"

echo ""
echo "================================"
echo -e "${GREEN}Both servers are running!${NC}"
echo "================================"
echo "Frontend:  http://localhost:3001"
echo "Backend:   http://localhost:8000"
echo ""
echo "Logs:"
echo "  Backend:  Check terminal output above"
echo "  Frontend: Check terminal output above"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "================================"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    wait $FRONTEND_PID 2>/dev/null
    echo "Servers stopped."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
