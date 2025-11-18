# Getting Started - Audio Transcriber

Welcome! This is a complete guide to get your Audio Transcriber application up and running in under 10 minutes.

## What You Have

A full-stack audio transcription application with:
- 🎙️ **Browser-based audio recording** (Next.js frontend)
- 🤖 **Local Parakeet ASR** (Python backend)
- 💾 **SQLite transcript storage** (Local database)
- 📥 **Export & sharing** (Download as text)

**100% local processing - no cloud APIs, no subscriptions needed!**

---

## Quick Start (60 seconds)

### Step 1: Open Terminal

Navigate to your project directory:
```bash
cd path/to/Parakeet-TDT
```

(Replace `path/to/Parakeet-TDT` with wherever you cloned the repository)

### Step 2: Run Everything

**On macOS/Linux:**
```bash
chmod +x start.sh
./start.sh
```

**On Windows:**
```bash
start.bat
```

### Step 3: Open Browser

Visit: **http://localhost:3000**

**Done!** 🎉 Start recording audio!

---

## What's Happening

When you run `./start.sh`:

1. ✅ Creates Python virtual environment
2. ✅ Installs backend dependencies (including Parakeet model)
3. ✅ Starts backend server on http://localhost:8000
4. ✅ Installs frontend dependencies
5. ✅ Starts frontend server on http://localhost:3000

The first run will take a few minutes to download the Parakeet model (~1.5GB).

---

## Using the App

### Recording Audio

1. Click **"Start Recording"**
2. Speak clearly into your microphone
3. Click **"Stop Recording"**
4. Wait for transcription (30 seconds to 2 minutes depending on audio length)
5. View your transcript!

### Managing Transcripts

- **Copy**: Copy transcript to clipboard
- **Download**: Save as `.txt` file
- **Delete**: Remove from history
- **View**: Click to expand transcript details

---

## Directory Structure

```
Parakeet TDT/
├── frontend/           ← React web app (localhost:3000)
├── backend/            ← Python API (localhost:8000)
├── README.md           ← Full documentation
├── SETUP.md            ← Detailed setup guide
├── API.md              ← API reference
├── LOCAL_PARAKEET.md   ← GPU/optimization guide
├── start.sh            ← Quick start (macOS/Linux)
└── start.bat           ← Quick start (Windows)
```

---

## Manual Start (If Scripts Don't Work)

### Terminal 1: Backend

```bash
cd backend
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Wait for: `Uvicorn running on http://0.0.0.0:8000`

### Terminal 2: Frontend

```bash
cd frontend
npm install
npm run dev
```

Wait for: `Local: http://localhost:3000`

---

## Troubleshooting

### "Permission denied" on start.sh

```bash
chmod +x start.sh
./start.sh
```

### Port 8000 already in use

**On macOS/Linux:**
```bash
# Check what's using it
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use a different port
uvicorn main:app --port 8001
```

**On Windows:**
```bash
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID with the number from above)
taskkill /PID <PID> /F

# Or use a different port
uvicorn main:app --port 8001
```

### "Unable to access microphone"

1. Allow microphone permission in browser popup
2. Check browser privacy settings
3. Try a different browser

### "Model not loading" or timeout

1. Check your internet connection
2. Model (~1.5GB) downloads on first run - this takes time
3. Once downloaded, it's cached for future runs

### "npm not found"

Install Node.js from: https://nodejs.org/ (18+ required)

### "python not found"

Install Python from: https://python.org/ (3.9+ required)

---

## Next Steps

1. **Record your first audio** (localhost:3000)
2. **Download a transcript** as a text file
3. **Check API docs** (API.md) if you want to integrate elsewhere
4. **Read SETUP.md** for advanced configuration
5. **Check LOCAL_PARAKEET.md** if you have an NVIDIA GPU

---

## Performance Expectations

### Without GPU (CPU only)
- Startup: 1-2 minutes (model loading)
- 1 minute of audio: 5-10 minutes transcription time

### With GPU (NVIDIA CUDA)
- Startup: 1-2 minutes (model loading)
- 1 minute of audio: 5-10 seconds transcription time

**After first run, startup is much faster!**

---

## Key Files

| File | Purpose |
|------|---------|
| `README.md` | Full documentation |
| `SETUP.md` | Installation guide |
| `API.md` | API endpoints reference |
| `LOCAL_PARAKEET.md` | GPU setup & optimization |
| `STRUCTURE.md` | Project architecture |
| `start.sh` | Auto-start script |

---

## Architecture Overview

```
Your Browser (localhost:3000)
        ↓
    React UI
        ↓
   Audio Recorder
        ↓ (HTTP POST)
Backend API (localhost:8000)
        ↓
   Parakeet ASR
        ↓
   Database (SQLite)
        ↓ (JSON Response)
    Display Transcript
```

---

## Environment Variables

Currently, no config needed. Optional (in `backend/.env`):

```
DATABASE_URL=sqlite:///./transcripts.db
```

For production with PostgreSQL:
```
DATABASE_URL=postgresql://user:pass@localhost/db
```

---

## Helpful Commands

### Stop servers

Press `Ctrl+C` in terminal (or close windows if using batch script)

### View logs

The terminal shows all activity:
- Backend logs: HTTP requests, transcription status
- Frontend logs: JavaScript console messages

### Access API directly

```bash
# Get all transcripts
curl http://localhost:8000/transcripts

# Transcribe a file
curl -X POST -F "file=@recording.wav" http://localhost:8000/transcribe

# Delete a transcript
curl -X DELETE http://localhost:8000/transcripts/1
```

### Check database

```bash
# View transcripts
cd backend
sqlite3 transcripts.db "SELECT id, title, created_at FROM transcripts;"

# Delete all transcripts (reset)
sqlite3 transcripts.db "DELETE FROM transcripts;"
```

---

## What's Installed

### Frontend
- **Next.js** - React framework
- **Axios** - HTTP client
- **Tailwind CSS** - Styling
- **date-fns** - Date formatting

### Backend
- **FastAPI** - Web framework
- **SQLAlchemy** - Database ORM
- **Parakeet** (NeMo) - Speech recognition
- **LibROSA** - Audio processing
- **PyTorch** - Deep learning

---

## Hardware

### Minimum
- 4GB RAM
- 2GB disk space
- Any CPU

### Recommended
- 8GB+ RAM
- 10GB disk space
- NVIDIA GPU with 4GB+ VRAM (optional)

---

## Offline Usage

Once the model is downloaded:
1. ✅ Works completely offline
2. ✅ No internet required
3. ✅ No API keys needed
4. ✅ Complete privacy

---

## Common Questions

### Q: Is my audio uploaded anywhere?
**A:** No! Everything runs locally on your machine.

### Q: Do I need API keys?
**A:** No, Parakeet runs locally without any external services.

### Q: Can I use this in production?
**A:** Yes! See SETUP.md for Docker & deployment options.

### Q: How do I add more features?
**A:** See STRUCTURE.md for adding components.

### Q: How do I use my GPU?
**A:** See LOCAL_PARAKEET.md for GPU setup.

### Q: How do I deploy this?
**A:** Docker configs included! (docker-compose.yml)

---

## Support Resources

- **Full README**: Read `README.md` for comprehensive docs
- **API Reference**: Check `API.md` for endpoint details
- **Setup Help**: See `SETUP.md` for detailed installation
- **Architecture**: Review `STRUCTURE.md` for code organization
- **GPU/Optimization**: Read `LOCAL_PARAKEET.md` for performance

---

## Next: Your First Recording

1. Open http://localhost:3000
2. Click **"Start Recording"**
3. Say something into your mic: "Hello, this is a test of the Parakeet speech recognition system"
4. Click **"Stop Recording"**
5. Wait for transcription...
6. See your words appear on screen!

---

## That's It!

You now have a fully functional audio transcription system running locally on your machine with Parakeet ASR.

**Happy transcribing!** 🎙️✨

---

## Need Help?

1. Check the terminal for error messages
2. Read SETUP.md for common issues
3. Verify both servers are running:
   - Frontend: http://localhost:3000 (should load)
   - Backend: http://localhost:8000 (should show {"message": "..."}

Questions about the code? Check STRUCTURE.md!
