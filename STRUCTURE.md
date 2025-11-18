# Project Structure

Complete overview of the Audio Transcriber project directory structure.

```
Parakeet TDT/
├── README.md                    # Main documentation
├── SETUP.md                     # Setup and installation guide
├── API.md                       # API documentation
├── STRUCTURE.md                 # This file
├── docker-compose.yml           # Docker multi-container setup
├── start.sh                     # Quick start script (macOS/Linux)
├── start.bat                    # Quick start script (Windows)
│
├── frontend/                    # Next.js React Application
│   ├── app/
│   │   ├── components/
│   │   │   ├── AudioRecorder.tsx      # Audio recording component
│   │   │   └── TranscriptHistory.tsx  # Transcript history component
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Main page
│   │   └── globals.css                # Global styles
│   ├── public/                  # Static assets (images, icons)
│   ├── package.json             # Node.js dependencies
│   ├── package-lock.json        # Locked dependency versions
│   ├── tsconfig.json            # TypeScript configuration
│   ├── next.config.js           # Next.js configuration
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   ├── postcss.config.js        # PostCSS configuration
│   ├── .eslintrc.json           # ESLint configuration
│   ├── .gitignore               # Git ignore rules
│   └── Dockerfile               # Docker image definition
│
├── backend/                     # Python FastAPI Application
│   ├── main.py                  # Main FastAPI application
│   ├── database.py              # Database models and setup
│   ├── schemas.py               # Pydantic data models
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment variables template
│   ├── .gitignore               # Git ignore rules
│   ├── Dockerfile               # Docker image definition
│   └── transcripts.db           # SQLite database (created at runtime)
│
└── .idea/                       # PyCharm IDE configuration
```

---

## Key Files Explained

### Frontend

#### `frontend/app/page.tsx`
Main entry point. Combines AudioRecorder and TranscriptHistory components.
- Sets up the page layout
- Manages state for transcript refresh

#### `frontend/app/components/AudioRecorder.tsx`
Handles audio recording with Web Audio API.
- Manages recording state
- Sends audio to backend via POST request
- Displays transcription results
- Provides download and copy functionality

#### `frontend/app/components/TranscriptHistory.tsx`
Displays all saved transcripts.
- Fetches transcripts from backend
- Shows expandable transcript list
- Provides delete, copy, and download functionality

#### `frontend/package.json`
Project dependencies:
- `next` - React framework
- `react` - UI library
- `axios` - HTTP client
- `date-fns` - Date formatting
- `tailwindcss` - CSS framework

### Backend

#### `backend/main.py`
FastAPI application with all API endpoints:
- `/` - Health check
- `POST /transcribe` - Upload and transcribe audio
- `GET /transcripts` - Get all transcripts
- `GET /transcripts/{id}` - Get specific transcript
- `DELETE /transcripts/{id}` - Delete transcript
- `WS /ws/transcribe` - WebSocket transcription

#### `backend/database.py`
SQLAlchemy database setup:
- Defines `Transcript` model
- Creates database tables
- Provides session management

#### `backend/schemas.py`
Pydantic data validation models:
- `TranscriptBase` - Base transcript data
- `TranscriptCreate` - Creation request model
- `TranscriptResponse` - API response model
- `TranscriptionChunk` - WebSocket message format

#### `backend/requirements.txt`
Python dependencies:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `sqlalchemy` - Database ORM
- `pydantic` - Data validation
- `nemo-toolkit` - Nvidia NeMo ASR
- `librosa` - Audio processing
- `torch` - Deep learning framework

---

## Component Architecture

### Frontend Components

```
page.tsx
├── AudioRecorder
│   ├── Recording controls
│   ├── Live transcript display
│   └── Export options
└── TranscriptHistory
    ├── Transcript list
    ├── Expandable details
    └── Management actions
```

### Backend Structure

```
FastAPI App
├── Audio Upload Handler
│   ├── File validation
│   ├── Parakeet transcription
│   └── Database save
├── WebSocket Handler
│   ├── Audio streaming
│   ├── Transcription
│   └── Result sending
└── Database Layer
    ├── SQLite (default)
    └── Optional: PostgreSQL
```

---

## Data Flow

### Recording and Transcription Flow

```
1. User clicks "Start Recording"
   ↓
2. AudioRecorder requests microphone permission
   ↓
3. Web Audio API captures audio chunks
   ↓
4. User clicks "Stop Recording"
   ↓
5. Audio blob assembled and sent to backend POST /transcribe
   ↓
6. Backend receives audio file
   ↓
7. Parakeet ASR transcribes audio
   ↓
8. Transcript saved to SQLite database
   ↓
9. Transcript returned to frontend
   ↓
10. Frontend displays transcript to user
```

### Transcript History Flow

```
1. TranscriptHistory component mounts
   ↓
2. Component calls GET /transcripts
   ↓
3. Backend queries all transcripts from database
   ↓
4. Backend returns JSON list
   ↓
5. Frontend displays list
   ↓
6. User can click to expand, delete, download, or copy
```

---

## Configuration Files

### `tsconfig.json`
TypeScript compiler settings for frontend.

### `next.config.js`
Next.js-specific configurations (SSR, optimization, etc.)

### `tailwind.config.js`
Tailwind CSS theming and customization.

### `postcss.config.js`
PostCSS plugins for CSS processing.

### `.env.example` / `.env`
Environment variables:
- Database URL
- API keys (if using external services)
- Feature flags

### `docker-compose.yml`
Multi-container Docker setup for easy deployment.

### `.eslintrc.json`
Code quality rules for JavaScript/TypeScript.

---

## File Dependencies

### Frontend Dependencies

```
page.tsx
├── AudioRecorder.tsx
│   ├── axios
│   └── React hooks
└── TranscriptHistory.tsx
    ├── axios
    ├── date-fns
    └── React hooks
```

### Backend Dependencies

```
main.py
├── FastAPI
├── CORS middleware
├── Parakeet (ASR)
├── Librosa (audio processing)
├── Torch (PyTorch)
└── database.py
    ├── SQLAlchemy
    └── SQLite
```

---

## Adding New Files

### Adding a New Frontend Component

1. Create file in `frontend/app/components/NewComponent.tsx`
2. Use `"use client"` directive for interactivity
3. Import in `page.tsx`
4. Add styling with Tailwind CSS

### Adding a New Backend Endpoint

1. Define Pydantic schema in `schemas.py` if needed
2. Add endpoint function in `main.py`
3. Test with curl or Postman
4. Update `API.md` documentation

### Updating Dependencies

1. **Frontend**: Edit `package.json`, run `npm install`
2. **Backend**: Edit `requirements.txt`, run `pip install -r requirements.txt`

---

## Database Schema

### Transcripts Table

```sql
CREATE TABLE transcripts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       VARCHAR NOT NULL,
    content     TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration    INTEGER
);
```

### Creating Custom Database

To use PostgreSQL instead of SQLite:

1. Update `backend/.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/transcriber
   ```

2. Uncomment PostgreSQL driver in `requirements.txt`:
   ```
   psycopg2-binary==2.9.x
   ```

3. Restart backend

---

## Environment Separation

### Development
- Frontend: `npm run dev` (port 3000)
- Backend: `uvicorn main:app --reload` (port 8000)
- Database: SQLite (local file)

### Production
- Frontend: `npm run build` + `npm start`
- Backend: `gunicorn` or similar
- Database: PostgreSQL
- Use environment variables for secrets

---

## Scaling Considerations

### Current Limitations
- Single-process backend (handles one transcription at a time)
- SQLite database (not suitable for concurrent writes)
- No authentication or rate limiting

### For Production
1. Use process queue (Celery)
2. Switch to PostgreSQL
3. Add Redis caching
4. Implement authentication (JWT)
5. Add rate limiting
6. Use CDN for frontend
7. Containerize with Docker/Kubernetes

---

## Testing

### Frontend Testing
```bash
cd frontend
npm test
```

### Backend Testing
```bash
cd backend
pytest
```

(Test files can be added as needed)

---

## Version History

- **v1.0** (Current)
  - Basic audio recording
  - Parakeet ASR transcription
  - Transcript storage and retrieval
  - Export functionality

---

## Common Modifications

### Change Backend Port
In `backend/main.py` and `start.sh`:
```python
uvicorn main:app --port 8001
```

Update frontend API URL in `AudioRecorder.tsx`:
```typescript
"http://localhost:8001/transcribe"
```

### Change Frontend Port
In `start.sh`:
```bash
npm run dev -- -p 3001
```

Update CORS in `backend/main.py`:
```python
allow_origins=["http://localhost:3001"]
```

### Add Authentication
1. Add user model to `database.py`
2. Create login endpoint in `main.py`
3. Add token validation middleware
4. Add login form to frontend

---

## Resources

- **Next.js Docs**: https://nextjs.org/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **Parakeet Docs**: https://github.com/NVIDIA/NeMo
- **Tailwind CSS**: https://tailwindcss.com/docs
- **SQLAlchemy**: https://docs.sqlalchemy.org
