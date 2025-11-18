# Audio Transcriber with Parakeet ASR

A full-stack application for recording audio in the browser and transcribing it using Nvidia's Parakeet automatic speech recognition model.

## Features

- 🎙️ **Live Audio Recording**: Record audio directly from your browser
- 🤖 **Parakeet ASR**: Uses Nvidia's open-source Parakeet model for transcription
- 💾 **Transcript History**: View, save, and manage all your transcripts
- 📥 **Export Options**: Download transcripts as `.txt` files
- 📋 **Copy to Clipboard**: Easily copy transcripts to clipboard

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

## Future Enhancements

- Real-time streaming transcription via WebSocket
- Support for multiple languages
- Speaker diarization
- Confidence scores for transcribed text
- Batch transcription
- Audio file upload without recording

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
