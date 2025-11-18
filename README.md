# Parakeet TDT - Audio Transcriber

[![Tests](https://github.com/YOUR_USERNAME/Parakeet-TDT/actions/workflows/tests.yml/badge.svg)](https://github.com/YOUR_USERNAME/Parakeet-TDT/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A professional-grade full-stack application for recording audio in the browser and transcribing it locally using NVIDIA's Parakeet ASR model with advanced speaker diarization.

## ✨ Features

- 🎙️ **Live Audio Recording**: High-quality audio capture directly from your browser
- 🤖 **Advanced ASR**: Dual-engine support (NVIDIA Parakeet + OpenAI Whisper)
- 🔊 **Speaker Diarization**: Automatic identification of speakers using pyannote.audio (~90% accuracy)
- 📨 **Live Transcription**: Real-time message-based transcript display with smart pause detection
- 💾 **Transcript History**: Browse, search, and manage all saved transcripts
- 📥 **Export Options**: Download transcripts as text files or view as JSON
- 📋 **Clipboard Support**: Copy transcripts with one click
- 🌐 **Multi-user**: Support for 3+ concurrent transcription users
- 🚀 **100% Local Processing**: All transcription happens locally, no cloud APIs
- 🎯 **Intelligent VAD**: Voice Activity Detection with natural pause recognition

## Project Structure

```
.
├── frontend/          # Next.js frontend application
│   ├── app/
│   │   ├── components/
│   │   │   ├── AudioRecorder.tsx
│   │   │   └── TranscriptHistory.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.js
└── backend/           # Python FastAPI backend
    ├── main.py
    ├── database.py
    ├── schemas.py
    ├── requirements.txt
    └── .env.example
```

## Prerequisites

- Node.js 18+ (for frontend)
- Python 3.9+ (for backend)
- GPU (recommended for faster transcription, NVIDIA CUDA preferred)

## Backend Setup

### 1. Create and activate virtual environment

```bash
cd backend
python -m venv venv

# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

Note: The first time you run the application, Parakeet will download the pre-trained model (~1.5GB), which may take a few minutes.

### 3. Create environment file

```bash
cp .env.example .env
```

### 4. Run the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

## Frontend Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Run the development server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Usage

1. Open `http://localhost:3000` in your browser
2. Click "Start Recording" to begin recording audio
3. Speak into your microphone
4. Click "Stop Recording" when done
5. Wait for the transcription to complete
6. View your transcript, copy it, or download it as a text file
7. Your transcripts are saved in the "Transcript History" section

## API Endpoints

### POST /transcribe
Upload an audio file for transcription
- **Parameters**:
  - `file`: Audio file (WAV, MP3, etc.)
  - `title`: Optional title for the transcript

### GET /transcripts
Get all saved transcripts

### GET /transcripts/{transcript_id}
Get a specific transcript by ID

### DELETE /transcripts/{transcript_id}
Delete a transcript

### WS /ws/transcribe
WebSocket endpoint for streaming transcription (future enhancement)

## Troubleshooting

### "Unable to access microphone"
- Make sure your browser has microphone permissions
- Check your browser's privacy settings
- Try using HTTPS (required for microphone access on non-localhost)

### "Model not loaded" error
- Make sure you have internet connection for the first run (to download the model)
- Check that your GPU has enough memory (recommended: 4GB+)
- For CPU-only, transcription will be slower

### Port already in use
- Frontend: Change port in `npm run dev -- -p 3001`
- Backend: Change port in `uvicorn main:app --port 8001`
- Update CORS origins in `backend/main.py` accordingly

## Performance Notes

- **GPU**: With NVIDIA GPU, transcription typically takes 2-5 seconds per minute of audio
- **CPU**: Without GPU, transcription may take 30+ seconds per minute of audio
- The Parakeet model requires about 1.5GB of disk space and ~2GB of RAM

## Quick Start

### Fast Setup (macOS/Linux)
```bash
./start.sh
```

### Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Detailed architecture, command reference, and implementation notes
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - How to contribute to this project
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Detailed setup instructions
- **[API.md](./API.md)** - API endpoint documentation

## Architecture

### Speaker Diarization
The system uses **pyannote.audio** to identify and track speakers with ~90% accuracy:
- Analyzes complete audio after recording
- Automatically detects number of speakers
- Labels segments with speaker attribution
- Graceful fallback if pyannote unavailable

### Voice Activity Detection (VAD)
Smart pause detection breaks natural speech into manageable segments:
- 0.3-0.5s pause triggers transcription
- 1.5+ seconds confirms end of phrase
- 15+ second buffer forces send to prevent huge blocks

### Multi-user Support
- Up to 3 concurrent transcriptions
- Configurable worker threads
- WebSocket support for real-time updates
- PostgreSQL or SQLite database backend

## Performance

| Scenario | Time | Hardware |
|----------|------|----------|
| 1 min audio (GPU) | 5-10s | NVIDIA GPU + 8GB RAM |
| 1 min audio (CPU) | 5-10 min | CPU-only |
| Multi-user (3 concurrent) | Sequential | ~3x slower per user |

## Environment Setup

### Optional: HuggingFace Token
For better speaker diarization model access:
```bash
# Create token at https://huggingface.co/settings/tokens
# Add to .env:
HUGGINGFACE_TOKEN=hf_your_token_here
```

### Database Configuration
```bash
# Default: SQLite (auto-created)
# For PostgreSQL:
DATABASE_URL=postgresql://user:pass@localhost/transcriber_db
```

## Future Enhancements

- [ ] Support for multiple languages
- [ ] Confidence scores for transcribed text
- [ ] Batch transcription
- [ ] Audio file upload without recording
- [ ] Real-time speaker identification display
- [ ] Custom speaker name assignment
- [ ] Transcript search and filtering
- [ ] Timestamp-based playback
- [ ] Speaker demographics (experimental)

## License

This project uses open-source components:
- Frontend: Next.js (MIT)
- Backend: FastAPI (MIT)
- ASR Model: Nvidia Parakeet (Apache 2.0)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Verify all prerequisites are installed
3. Check that both backend and frontend servers are running
4. View browser console and backend logs for error messages
