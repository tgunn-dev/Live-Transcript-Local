@echo off
REM Audio Transcriber - Start Both Frontend and Backend

echo ================================
echo Audio Transcriber Setup
echo ================================
echo.

REM Start Backend
echo Starting Backend Server...
cd backend

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies if needed
pip install -r requirements.txt

REM Start backend server in a new window
start "Audio Transcriber - Backend" cmd /k "uvicorn main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3

REM Start Frontend
echo Starting Frontend Server...
cd ..\frontend

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Start frontend development server in a new window
start "Audio Transcriber - Frontend" cmd /k "npm run dev"

echo.
echo ================================
echo Both servers are starting!
echo ================================
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:8000
echo ================================
echo.
echo Close the windows to stop the servers
pause
