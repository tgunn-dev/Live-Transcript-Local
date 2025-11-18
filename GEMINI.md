# Project Overview

This is a full-stack web application for audio transcription. It allows users to record audio in the browser, which is then transcribed using a speech-to-text model running on the backend. The application consists of a Next.js frontend and a Python FastAPI backend.

**Frontend:**
- **Framework:** Next.js with React
- **Styling:** Tailwind CSS
- **Key Features:**
    - In-browser audio recording
    - Live transcription mode (using WebSockets)
    - Standard transcription mode (upload after recording)
    - Display and management of transcript history
    - Options to select audio input devices and transcription models

**Backend:**
- **Framework:** FastAPI
- **Language:** Python
- **Transcription:** OpenAI's Whisper model (running locally)
- **Database:** SQLite for storing transcripts
- **APIs:**
    - REST API for uploading audio, and managing transcripts.
    - WebSocket API for live, real-time transcription.

**Orchestration:**
- A `docker-compose.yml` file is provided to run the frontend and backend services in containers.

# Building and Running

## Using Docker (Recommended)

The easiest way to run the project is with Docker Compose:

```bash
docker-compose up --build
```

- The frontend will be available at `http://localhost:3000`
- The backend will be available at `http://localhost:8000`

## Running Locally

### Backend

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Run the server:**
    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```

### Frontend

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```

# Development Conventions

- The frontend code is written in TypeScript and uses functional components with hooks.
- The backend follows the standard FastAPI project structure, with database models, schemas, and API endpoints separated into different files.
- The project uses `eslint` for linting the frontend code. To run the linter:
  ```bash
  cd frontend
  npm run lint
  ```
- The `README.md` mentions the Parakeet ASR model, but the actual implementation uses OpenAI's Whisper model. The code contains an optional import for Parakeet, suggesting it might be a future goal or a past implementation.
