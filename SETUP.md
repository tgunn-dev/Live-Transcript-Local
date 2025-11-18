# Audio Transcriber - Setup Guide

This guide will help you set up and run the Audio Transcriber application with Parakeet ASR.

## Quick Start (Recommended)

### On macOS/Linux:

```bash
# Make the start script executable
chmod +x start.sh

# Run both frontend and backend
./start.sh
```

### On Windows:

```bash
# Run the batch file
start.bat
```

Both servers will start in your terminal. Open your browser to `http://localhost:3000` and start recording!

---

## Manual Setup

If the scripts don't work, follow these manual steps:

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment:**
   - **macOS/Linux:**
     ```bash
     source venv/bin/activate
     ```
   - **Windows:**
     ```bash
     venv\Scripts\activate
     ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

   Note: This may take several minutes as it downloads the Parakeet model (~1.5GB) on first run.

5. **Run the server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   You should see:
   ```
   Uvicorn running on http://0.0.0.0:8000
   ```

### Frontend Setup (in a new terminal)

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

   You should see:
   ```
   ▲ Next.js 14.x.x
   - Local: http://localhost:3000
   ```

4. **Open browser:**
   Visit `http://localhost:3000`

---

## Docker Setup (Alternative)

If you have Docker installed, you can run the entire application in containers:

```bash
# From the project root
docker-compose up
```

The application will be available at `http://localhost:3000`

---

## System Requirements

### Minimum
- 4GB RAM
- 2GB disk space (for Parakeet model)
- Python 3.9+
- Node.js 18+

### Recommended
- 8GB RAM
- NVIDIA GPU with CUDA support
- 10GB disk space

---

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'nemo'"

**Solution:** Make sure you activated the virtual environment and installed all dependencies:
```bash
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Issue: "Port 8000 already in use"

**Solution:** Either stop the process using that port or run on a different port:
```bash
uvicorn main:app --reload --port 8001
```

Then update the frontend's API URL in `frontend/app/components/AudioRecorder.tsx`:
```typescript
const response = await axios.post(
  "http://localhost:8001/transcribe",  // Change from 8000 to 8001
  formData,
  ...
);
```

### Issue: "Microphone permission denied"

**Solution:**
- Allow microphone access when your browser prompts you
- For HTTPS on non-localhost, you MUST use HTTPS
- Check your browser's privacy settings

### Issue: "Model download timeout"

**Solution:** The model is large (~1.5GB). If the download times out:
1. Make sure you have a stable internet connection
2. Try again - the model will be cached after first download
3. On slow connections, the download may take 10+ minutes

### Issue: Transcription is very slow

**Solution:** This is normal on CPU. The first transcription after startup may be slower.
- With GPU: 2-5 seconds per minute of audio
- Without GPU: 30+ seconds per minute of audio

To use GPU (NVIDIA):
1. Install CUDA toolkit
2. Install GPU version of PyTorch:
   ```bash
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```

---

## Environment Variables

The backend uses a `.env` file for configuration. Create one from the example:

```bash
cd backend
cp .env.example .env
```

Current configuration:
```
DATABASE_URL=sqlite:///./transcripts.db
```

For production, you might want to use PostgreSQL:
```
DATABASE_URL=postgresql://user:password@localhost/transcriber
```

---

## Development Tips

### Hot Reload
- **Frontend:** Automatically reloads on file changes (Next.js dev server)
- **Backend:** Automatically reloads with `--reload` flag in uvicorn

### Database Reset
To clear all transcripts and start fresh:
```bash
rm backend/transcripts.db
```

The database will be recreated on next run.

### API Testing
Test the backend API without the frontend:
```bash
# Get all transcripts
curl http://localhost:8000/transcripts

# Upload and transcribe an audio file
curl -X POST -F "file=@audio.wav" -F "title=My Recording" http://localhost:8000/transcribe
```

---

## Next Steps

1. Record your first audio
2. Download transcripts as text files
3. Build additional features on top of the API
4. Deploy to production (see deployment guides below)

---

## Deployment

### Deploy Backend (Heroku)
See `deployment/heroku-backend.md`

### Deploy Frontend (Vercel)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from frontend directory
cd frontend
vercel
```

---

## Support & Issues

If you encounter any issues:

1. Check the troubleshooting section above
2. Review the main README.md
3. Check the terminal output for error messages
4. Try running on a different port (see Port Already In Use section)

---

## Next: First Recording

Once both servers are running, go to `http://localhost:3000` and:

1. Click **"Start Recording"**
2. Speak clearly into your microphone
3. Click **"Stop Recording"**
4. Wait for transcription (may take 5-30 seconds depending on audio length and hardware)
5. View, copy, or download your transcript!

Enjoy! 🎙️✨
