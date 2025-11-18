# Live Transcription Feature Guide

Your Audio Transcriber now supports **live transcription** - see text appear in real-time as you speak!

## Overview

### Two Modes

#### 🔴 Live Mode (WebSocket)
- **Real-time updates**: Transcription appears as you speak
- **Updates every ~2 seconds**: Gets partial results during recording
- **Final transcript**: Refined version when you stop recording
- **Best for**: Lectures, meetings, brainstorming where you want to see results immediately

#### Standard Mode (HTTP)
- **Batch processing**: Records complete audio then transcribes
- **Single request**: More efficient for short clips
- **Cleaner final result**: Whisper sees full context
- **Best for**: Short sentences, precise transcription needs

## How Live Transcription Works

### Architecture

```
┌─────────────────────────────────────────────────┐
│         Your Browser (Frontend)                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 1. Start Recording                      │   │
│  │ 2. Send 250ms audio chunks via WebSocket│   │
│  │ 3. Receive & display partial updates    │   │
│  │ 4. Stop Recording → Get final transcript│   │
│  └─────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────┘
                       │ WebSocket
                       ↓
┌─────────────────────────────────────────────────┐
│      Backend (FastAPI + Whisper)                │
│  ┌─────────────────────────────────────────┐   │
│  │ 1. Receive 250ms audio chunks           │   │
│  │ 2. Accumulate 8 chunks (~2 sec)         │   │
│  │ 3. Transcribe accumulated audio         │   │
│  │ 4. Send partial result if changed       │   │
│  │ 5. On disconnect: Final transcription   │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### The Flow

1. **User clicks "Start Recording" with Live Mode enabled**
   - Frontend connects to WebSocket at `ws://localhost:8000/ws/transcribe`
   - Starts capturing audio at 250ms chunks

2. **Audio chunks stream to backend**
   - Each 250ms chunk sent immediately via WebSocket
   - Backend accumulates chunks in a buffer

3. **Every ~2 seconds, backend transcribes accumulated audio**
   - Takes the buffer contents
   - Runs Whisper transcription
   - Sends "partial" message if text changed
   - Frontend displays the partial result

4. **User stops recording**
   - WebSocket connection closes
   - Backend processes complete audio one final time
   - Sends "final" message with refined transcript
   - Frontend displays final result

## Using Live Transcription

### Enable Live Mode

1. Open http://localhost:3001
2. Check the **"🔴 Live Mode"** checkbox (enabled by default)
3. Click **"🎙️ Start Recording"**
4. Start speaking - watch the text appear!

### During Recording

- Text updates appear every ~2 seconds
- Updated status message: "✨ Live transcription in progress..."
- Timer shows how long you've been recording

### After Recording

1. Click **"⏹️ Stop Recording"**
2. Backend processes final audio
3. Complete transcript appears
4. Options: Copy or Download

## Technical Details

### Frontend Implementation (React)

```typescript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8000/ws/transcribe');

// Listen for updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "partial") {
    // Update UI with partial result
    setTranscript(data.text);
  } else if (data.type === "final") {
    // Show final transcript
    setTranscript(data.text);
  }
};

// Send audio chunks
mediaRecorder.ondataavailable = (event) => {
  event.data.arrayBuffer().then((buffer) => {
    ws.send(buffer);  // Binary data to backend
  });
};
```

### Backend Implementation (FastAPI)

**Key features:**
- Receives binary audio chunks via WebSocket
- Accumulates 8 chunks (~2 seconds) before transcribing
- Uses Whisper in "fast" mode for speed
- Only sends updates if transcription changed
- Final transcription on disconnect

```python
@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    # Accept connection
    await websocket.accept()

    # Loop: receive chunks, accumulate, transcribe
    while True:
        data = await websocket.receive_bytes()
        # ... accumulate and transcribe every 8 chunks

    # When client disconnects: final transcription
    # WebSocketDisconnect exception caught
```

## Performance Considerations

### Latency vs Accuracy

**Live Mode (every ~2 seconds)**
- ✓ Real-time feedback
- ✗ May have minor errors (Whisper works better with longer audio)
- ✗ Slightly less polished final result

**Standard Mode (after recording)**
- ✓ Better accuracy (Whisper sees full context)
- ✗ Longer wait time
- ✓ More polished final result

### Network Impact

- **Live Mode**: Continuous WebSocket connection, binary chunks every 250ms
- **Standard Mode**: Single HTTP POST request with complete audio

Both are very efficient for local localhost connections.

### CPU/Memory Usage

- **Live Mode**: Continuous transcription every 2 seconds (slight CPU overhead)
- **Standard Mode**: Single transcription at end (cleaner resource usage)

## Customization

### Adjust Update Frequency

Edit `backend/main.py`, line 142:

```python
transcription_interval = 8  # Chunks between transcriptions
# 4 = updates every 1 second
# 8 = updates every 2 seconds (default)
# 16 = updates every 4 seconds
```

Lower values = more frequent updates (more CPU usage)

### Change Chunk Duration

Frontend `AudioRecorder.tsx`, line 119:

```typescript
mediaRecorder.start(250);  // milliseconds
// 100ms = more frequent chunks (higher bandwidth)
// 250ms = balanced (default)
// 500ms = fewer chunks (lower bandwidth)
```

### Use Different Whisper Model

Backend `main.py`, line 49:

```python
asr_model = whisper.load_model("base", device="cpu")
# Options: tiny, base (default), small, medium, large
# Faster: tiny, base
# More accurate: small, medium, large
```

## Troubleshooting

### "WebSocket error" message

**Problem**: WebSocket connection failed

**Solutions**:
1. Check backend is running: http://localhost:8000
2. Check ports: Frontend on 3001, Backend on 8000
3. Try Standard Mode (HTTP) instead
4. Check browser console for detailed error

### Text not updating

**Problem**: Live transcript not appearing

**Solutions**:
1. Wait ~2 seconds - updates every 2 seconds
2. Check backend logs for errors
3. Try speaking louder for clearer audio
4. Switch to Standard Mode if issue persists

### Connection drops

**Problem**: "WebSocket error. Please try again."

**Solutions**:
1. Try recording again
2. Check network connection (working on localhost)
3. Restart backend server
4. Use Standard Mode as fallback

### Slow/delayed updates

**Problem**: Long delays between transcript updates

**Solutions**:
1. This is normal while Whisper is processing
2. CPU-bound transcription takes time
3. Consider using GPU (faster inference)
4. Use smaller model (`tiny` or `base`)

## Advanced: WebSocket Protocol

### Message Format

**Client → Server** (Binary data)
```
Raw audio bytes (WAV/PCM format)
```

**Server → Client** (JSON)
```json
// Partial update (every ~2 seconds)
{
  "type": "partial",
  "text": "Hello world",
  "is_final": false,
  "duration": 2.5
}

// Final result (on disconnect)
{
  "type": "final",
  "text": "Hello world",
  "is_final": true,
  "duration": 5.2
}

// Error
{
  "type": "error",
  "message": "Transcription failed"
}
```

## Comparison: Live vs Standard

| Feature | Live Mode | Standard Mode |
|---------|-----------|---------------|
| Real-time updates | ✓ Every 2s | ✗ After done |
| Accuracy | ◐ Good | ✓ Better |
| Speed | ◐ ~2s for updates | ✗ Longer wait |
| Bandwidth | ◐ Continuous | ✓ Single request |
| Connection type | WebSocket | HTTP POST |
| Best for | Monitoring | Final results |

## Examples

### Use Case 1: Live Meeting Notes
1. Enable **Live Mode**
2. Transcript appears in real-time
3. See what's being transcribed immediately
4. Download final notes when done

### Use Case 2: Accurate Transcription
1. Use **Standard Mode**
2. Record entire statement
3. Get polished final transcript
4. Higher accuracy from full context

### Use Case 3: Quick Verification
1. Enable **Live Mode**
2. See partial results as you speak
3. Stop if you notice errors
4. Re-record to correct

## Future Improvements

Potential enhancements:
- Sentence-by-sentence updates (better UX)
- Speaker detection
- Keyword highlighting
- Auto-correct during typing
- Multiple language support
- Real-time translation

## FAQ

**Q: Can I switch modes during recording?**
A: No, you must stop and start a new recording to change modes.

**Q: Why are partial transcriptions sometimes different from final?**
A: Whisper refines transcription with full context. Partial results are based on incomplete audio.

**Q: Is Live Mode slower than Standard Mode?**
A: Both have similar transcription speed. Live Mode adds ~2s latency for periodic updates.

**Q: Can I use Live Mode on mobile?**
A: Yes! WebSocket works on mobile. May use more battery due to continuous processing.

**Q: How can I speed up updates?**
A: Lower `transcription_interval` in backend or use smaller Whisper model.

**Q: Does Live Mode save transcripts?**
A: Yes, final transcript is saved to database when recording stops.

---

**Enjoy live transcription!** For questions or issues, check the main README.md or API.md.
