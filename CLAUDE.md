# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Audio Transcriber with Parakeet ASR** - A full-stack web application for recording audio in the browser and transcribing it locally using Nvidia's Parakeet automatic speech recognition model. 100% local processing with no cloud APIs.

### Tech Stack
- **Frontend**: Next.js 14 (React 18) with TypeScript, Tailwind CSS
- **Backend**: Python FastAPI with SQLAlchemy ORM
- **ASR Models**: Parakeet (NeMo) and Whisper as fallback
- **Database**: SQLite (default), PostgreSQL supported
- **Deployment**: Docker Compose available

## Quick Commands

### Development Setup

```bash
# Fast start (macOS/Linux)
./start.sh

# Fast start (Windows)
start.bat

# Manual backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Manual frontend setup
cd frontend
npm install
npm run dev
```

### Development Commands

**Backend** (from `/backend`):
- `uvicorn main:app --reload` - Run dev server with hot reload
- `uvicorn main:app --port 8001` - Run on different port
- `python -m pytest` - Run tests (if test files added)

**Frontend** (from `/frontend`):
- `npm run dev` - Start dev server (port 3000)
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run lint` - Run ESLint

### Docker

```bash
# Run entire stack with Docker Compose
docker-compose up

# Access:
# Frontend: http://localhost:3001
# Backend: http://localhost:8000
```

### Database

```bash
# View transcripts (SQLite)
sqlite3 backend/transcripts.db "SELECT id, title, created_at FROM transcripts;"

# Reset database
sqlite3 backend/transcripts.db "DELETE FROM transcripts;"
```

## Architecture

### Frontend Architecture

**Structure**: `/frontend/app/`
- `page.tsx` - Main page combining both components
- `components/AudioRecorder.tsx` - Audio recording & transcription UI
- `components/TranscriptHistory.tsx` - Transcript history display
- `globals.css` - Global styles
- `layout.tsx` - Root layout wrapper

**Key Libraries**:
- `axios` - HTTP client for API calls
- `date-fns` - Date formatting
- `@ricky0123/vad` - Voice Activity Detection
- `tailwindcss` - Utility-first CSS

**Data Flow**:
1. User clicks "Start Recording"
2. Web Audio API captures microphone input → WAV Blob
3. Send to POST `/transcribe` with audio blob
4. Display transcript and save to history
5. TranscriptHistory polls GET `/transcripts` and displays list

### Backend Architecture

**Structure**: `/backend/`
- `main.py` - FastAPI app with all endpoints and ASR logic
- `database.py` - SQLAlchemy models and session management
- `schemas.py` - Pydantic validation models
- `requirements.txt` - Python dependencies

**Key ASR Logic**:
- Uses **Whisper** (OpenAI) as primary model during startup
- Falls back to **Parakeet** (NVIDIA NeMo) if available
- Supports both CPU and GPU (auto-detected with PyTorch/CUDA)
- Models are lazily loaded and cached

**API Endpoints**:
- `GET /` - Health check
- `POST /transcribe` - Upload audio file for transcription
- `GET /transcripts` - Get all transcripts (ordered by created_at DESC)
- `GET /transcripts/{id}` - Get specific transcript
- `DELETE /transcripts/{id}` - Delete transcript
- `WS /ws/transcribe` - WebSocket for streaming transcription

**Database Schema** (SQLite):
```
transcripts table:
  - id (INTEGER, PRIMARY KEY)
  - title (VARCHAR)
  - content (TEXT) - transcribed text
  - created_at (DATETIME)
  - duration (INTEGER) - seconds
  - segments (TEXT) - JSON with timestamps/speakers
```

**Important Configuration**:
- CORS: Allows `http://localhost:3000` and `http://localhost:3001`
- Update in `main.py` `CORSMiddleware` for production
- Database URL: Set via `DATABASE_URL` env var (defaults to SQLite)
- Environment: Load from `.env` file using `python-dotenv`

### Data Flow

**Recording & Transcription**:
```
Browser Audio Recording
  ↓ (WAV Blob)
POST /transcribe
  ↓
Backend receives file
  ↓
Load ASR model (if not cached)
  ↓
Transcribe audio (Whisper or Parakeet)
  ↓
Save to SQLite database
  ↓
Return JSON response
  ↓
Display transcript to user
```

**Transcript History**:
```
TranscriptHistory component mounts
  ↓
GET /transcripts (ordered by date DESC)
  ↓
Display list with expand/delete/copy/download actions
```

## Important Implementation Details

### ASR Model Selection

The backend implements **graceful degradation**:
1. On startup, attempts to load Whisper base model
2. Falls back to Whisper tiny if base fails
3. Parakeet (NeMo) is available but optional due to dependency complexity
4. Check `HAS_PARRAKEET` flag in `main.py` to see if Parakeet is available

### Model Caching

- Models are downloaded once (~1.5GB) and cached locally
- Parakeet models cached in `parakeet_model_cache` dict
- First transcription may take longer due to model initialization
- Subsequent transcriptions use cached models (5-10x faster)

### Performance Notes

**CPU (default)**:
- Startup: 1-2 minutes (model loading)
- 1 minute audio → 5-10 minutes transcription

**GPU (NVIDIA CUDA)**:
- Startup: 1-2 minutes
- 1 minute audio → 5-10 seconds transcription
- Auto-detected by PyTorch

### Threading & Async

- Backend uses ThreadPoolExecutor for CPU-intensive Whisper operations
- Prevents blocking the FastAPI event loop
- **Max 3 concurrent workers** - allows up to 3 simultaneous transcriptions
- WebSocket endpoint for streaming transcription support
- Configure `max_workers` in `main.py:52` based on hardware:
  - CPU-only: 2-3 workers (each uses ~1-2 cores)
  - With GPU: Can increase to 4-5 if VRAM allows
  - More workers = slower individual transcriptions but higher throughput

### Voice Activity Detection (VAD) - Live Mode

The frontend implements **intelligent pause detection** to break up natural speech into manageable messages:

**How It Works**:
1. **RMS-based Speech Detection**: Uses audio level (dB) thresholds to detect when someone is speaking vs. silent
2. **Multi-threshold Approach**:
   - `-28 dB`: Threshold for active speech (start recording)
   - `-40 dB`: Threshold for silence (end of phrase)
3. **Smart Pause Detection**: Sends transcription when:
   - **Natural pause** (~0.3-0.5s silence) detected after >1 second of speech
   - **Long pause** (1.5+ seconds) - definite break in conversation
   - **Audio buffer overflow** (>15 seconds accumulated) - forces send to prevent massive blocks
4. **Resume Detection**: Automatically tracks when speech resumes after a pause

**Key Benefits**:
- ✅ Avoids sending huge text blocks (previously just used fixed 0.5s timer)
- ✅ Detects natural sentence boundaries and pauses
- ✅ Works with conversational speech patterns (respects natural rhythm)
- ✅ Forces sends on very long monologues (prevents >15 second accumulation)
- ✅ Sends individual sentences as separate messages in chat-like interface

**Tuning Parameters** (in `frontend/AudioRecorder.tsx`):
- `minPauseFramesForTranscription = 8` (~0.33s pause for sentence breaks)
- `maxAudioDurationBeforeForceSend = 15 * sampleRate` (~15 seconds)
- `speechThreshold = -28` dB
- `noiseThreshold = -40` dB

### Speaker Diarization - Who is Speaking?

The backend implements **professional speaker diarization** using `pyannote.audio`:

**How It Works**:
1. **During Live Recording**: Generic "Speaker" label is used for all segments
2. **After Recording Ends**:
   - Complete audio buffer is saved to temporary file
   - `pyannote.audio` (state-of-the-art model) analyzes the full recording
   - Unique speakers are identified and labeled "Speaker 1", "Speaker 2", etc.
   - Segment timestamps are matched with speaker boundaries
3. **Accuracy**: ~90%+ accuracy for identifying and tracking speakers

**Key Features**:
- ✅ Uses industry-standard AI model (pyannote-3.0)
- ✅ Works on complete audio (more accurate than real-time)
- ✅ Can identify individual speakers and track them throughout
- ✅ Graceful fallback if pyannote not available
- ✅ All speaker labels saved with segments in database

**Requirements**:
- `pyannote.audio>=2.1.1` in `requirements.txt`
- Optional: `HUGGINGFACE_TOKEN` env var (for improved model access)
- GPU recommended for faster processing (auto-detected)

**Limitations**:
- Requires ~30 seconds to analyze (runs after recording)
- Needs sufficient audio duration per speaker (typically >10 seconds per speaker)
- May struggle with similar voices or heavy accents
- Requires internet access on first run to download model

**Enable/Disable**:
- Automatically enabled if pyannote installed
- Backend detects availability on startup: `✓ Speaker diarization enabled` or `⚠️ Speaker diarization disabled`
- If disabled, falls back to generic "Speaker" labels

## Common Modifications

### Change Backend Port
Update `uvicorn` command in `start.sh` and ensure frontend API calls match.

### Add Authentication
1. Add user model to `database.py`
2. Create login endpoint in `main.py` using JWT
3. Add dependency injection for auth in endpoints
4. Add login form to frontend

### Switch to PostgreSQL
1. Update `DATABASE_URL` in `.env`: `postgresql://user:pass@localhost/db`
2. Uncomment `psycopg2-binary` in `requirements.txt`
3. Restart backend

### Enable GPU in Docker
Uncomment GPU section in `docker-compose.yml` and ensure nvidia-docker installed.

### Change ASR Model
In `main.py`, modify Whisper model size:
- `tiny` - Smallest, fastest
- `base` - Default, balanced
- `small`, `medium`, `large` - Slower but more accurate

Or use Parakeet by ensuring `nemo-toolkit[asr]` is installed and modifying transcription logic.

## File Dependency Map

**Frontend**:
```
page.tsx
├── AudioRecorder.tsx (axios, React hooks, Web Audio API)
└── TranscriptHistory.tsx (axios, date-fns, React hooks)
```

**Backend**:
```
main.py
├── database.py (SQLAlchemy, SQLite/PostgreSQL)
├── schemas.py (Pydantic models)
├── FastAPI + CORS Middleware
└── ASR (Whisper/Parakeet, librosa, torch)
```

## Testing

**Frontend**:
- No test framework configured yet
- Add Jest/Testing Library: `npm install --save-dev jest @testing-library/react`

**Backend**:
- No test files present
- Add pytest tests in `backend/tests/test_*.py`
- Run: `python -m pytest`

## Environment Variables

**Backend** (in `.env` or via system):
- `DATABASE_URL` - SQLite path or PostgreSQL connection (default: `sqlite:///./transcripts.db`)

**Frontend**:
- No required env vars for development
- Optional: Set `NEXT_PUBLIC_API_URL` for non-localhost backend

## Deployment Considerations

### Current Limitations
- Single-process backend (handles transcriptions sequentially)
- SQLite not suitable for concurrent writes
- No authentication or rate limiting
- Parakeet model (~1.5GB) must be downloaded on first run

### For Production
1. Use process queue (Celery) for concurrent transcriptions
2. Switch to PostgreSQL for concurrent access
3. Add Redis caching
4. Implement JWT authentication
5. Add rate limiting via middleware
6. Use reverse proxy (Nginx) in front of FastAPI
7. Deploy with Gunicorn/Uvicorn workers
8. Consider separate GPU server for transcription if high volume

## Troubleshooting

**Port already in use**:
```bash
# macOS/Linux: Find process
lsof -i :8000
kill -9 <PID>

# Or use different port
uvicorn main:app --port 8001
```

**"Model not loading"**:
- Check internet (first run downloads ~1.5GB model)
- Verify GPU memory if using CUDA
- Check disk space (10GB+ recommended)
- For Parakeet: Ensure `ml_dtypes>=0.5.4` installed (see start.sh)

**"Unable to access microphone"**:
- Allow browser permissions
- Ensure HTTPS for non-localhost (browser security)
- Check browser privacy settings

**Frontend/Backend connection issues**:
- Verify backend running on correct port (default 8000)
- Check CORS origins in `main.py` match frontend URL
- Browser console shows actual error

## Resources

- **Next.js Docs**: https://nextjs.org/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **NVIDIA NeMo/Parakeet**: https://github.com/NVIDIA/NeMo
- **Whisper Docs**: https://github.com/openai/whisper
- **SQLAlchemy**: https://docs.sqlalchemy.org
- **Tailwind CSS**: https://tailwindcss.com/docs

## Recent Changes & Known Issues

**Current Implementation Notes**:
- Backend implements dual ASR with Whisper primary, Parakeet optional
- VAD (Voice Activity Detection) available in frontend via `@ricky0123/vad`
- Database supports segments column for future speaker diarization
- WebSocket endpoint implemented but not fully utilized by frontend yet
- Fallback to Whisper ensures app works even if NeMo dependencies fail

**Watch Out For**:
- `ml_dtypes` version conflicts with NeMo (start.sh handles this)
- Whisper model downloads during first request (takes time)
- CORS issues if changing localhost ports without updating both services
- GPU memory requirements if using larger Whisper models
