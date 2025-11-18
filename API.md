# Audio Transcriber API Documentation

Complete API reference for the Audio Transcriber backend.

## Base URL

```
http://localhost:8000
```

## Authentication

Currently, no authentication is required. For production deployment, add API key authentication.

---

## Endpoints

### 1. Health Check

**GET** `/`

Check if the API is running.

**Response (200):**
```json
{
  "message": "Audio Transcriber API is running"
}
```

---

### 2. Transcribe Audio File

**POST** `/transcribe`

Upload an audio file and get its transcription.

**Parameters:**

- `file` (required): Audio file (WAV, MP3, M4A, OGG, FLAC)
  - Type: `multipart/form-data`
  - Max size: 25MB (configurable)

- `title` (optional): Human-readable title for the transcript
  - Type: `string`
  - Default: "Untitled Recording"

**cURL Example:**
```bash
curl -X POST \
  -F "file=@recording.wav" \
  -F "title=My Recording" \
  http://localhost:8000/transcribe
```

**Response (200):**
```json
{
  "id": 1,
  "title": "My Recording",
  "content": "This is the transcribed text from the audio file.",
  "created_at": "2024-01-15T10:30:00",
  "duration": 0
}
```

**Errors:**
- `400 Bad Request`: No file provided
- `422 Unprocessable Entity`: Invalid file format
- `500 Internal Server Error`: Transcription failed

---

### 3. Get All Transcripts

**GET** `/transcripts`

Retrieve all saved transcripts, ordered by most recent first.

**Query Parameters:** None

**cURL Example:**
```bash
curl http://localhost:8000/transcripts
```

**Response (200):**
```json
[
  {
    "id": 2,
    "title": "Recent Recording",
    "content": "Another transcription...",
    "created_at": "2024-01-15T11:00:00",
    "duration": 0
  },
  {
    "id": 1,
    "title": "My Recording",
    "content": "This is the transcribed text...",
    "created_at": "2024-01-15T10:30:00",
    "duration": 0
  }
]
```

---

### 4. Get Specific Transcript

**GET** `/transcripts/{transcript_id}`

Retrieve a specific transcript by its ID.

**Path Parameters:**
- `transcript_id` (required): The ID of the transcript

**cURL Example:**
```bash
curl http://localhost:8000/transcripts/1
```

**Response (200):**
```json
{
  "id": 1,
  "title": "My Recording",
  "content": "This is the transcribed text from the audio file.",
  "created_at": "2024-01-15T10:30:00",
  "duration": 0
}
```

**Errors:**
- `404 Not Found`: Transcript with given ID doesn't exist

---

### 5. Delete Transcript

**DELETE** `/transcripts/{transcript_id}`

Delete a specific transcript.

**Path Parameters:**
- `transcript_id` (required): The ID of the transcript to delete

**cURL Example:**
```bash
curl -X DELETE http://localhost:8000/transcripts/1
```

**Response (200):**
```json
{
  "message": "Transcript deleted successfully"
}
```

**Errors:**
- `404 Not Found`: Transcript with given ID doesn't exist

---

### 6. WebSocket Transcription (Real-time)

**WS** `/ws/transcribe`

Stream audio chunks via WebSocket for transcription.

**Protocol:**

1. Connect to WebSocket
2. Send audio data as binary frames
3. Server processes audio
4. Disconnect when done
5. Server sends transcription on disconnect

**JavaScript Example:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/transcribe');

// Send audio chunks
ws.send(audioBuffer);
ws.send(moreAudioBuffer);

// Listen for transcription
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.text); // Transcribed text
};

// Close when done
ws.close();
```

**Response Messages:**

When the connection closes, you'll receive:
```json
{
  "type": "transcription",
  "text": "Complete transcribed text",
  "is_final": true
}
```

Or on error:
```json
{
  "type": "error",
  "message": "Error message"
}
```

---

## Data Models

### Transcript

```typescript
interface Transcript {
  id: number;              // Unique identifier
  title: string;           // Human-readable title
  content: string;         // Transcribed text
  created_at: string;      // ISO 8601 timestamp
  duration: number;        // Duration in seconds (0 if unknown)
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (missing/invalid parameters) |
| 404 | Not Found (transcript doesn't exist) |
| 422 | Unprocessable Entity (invalid data) |
| 500 | Internal Server Error |

---

## Error Handling

All errors return a JSON response with error details:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Example error response:
```json
{
  "detail": "Transcription failed: Model not loaded"
}
```

---

## Rate Limiting

Currently, there is no rate limiting. In production, implement:
- Per-IP rate limiting (e.g., 100 requests/hour)
- Per-user rate limiting with authentication
- File size limits

---

## CORS

The API accepts requests from:
- `http://localhost:3000`
- `http://localhost:3001`

For production, update the CORS origins in `backend/main.py`.

---

## Best Practices

1. **Error Handling**: Always check response status codes
2. **File Size**: Keep audio files under 100MB
3. **Audio Quality**: Use 16kHz or higher sample rate for best results
4. **Timeout**: Expect transcription to take 0.5-1 second per second of audio
5. **Caching**: Cache transcriptions to avoid re-processing same audio

---

## Examples

### Python Requests
```python
import requests

# Transcribe audio
with open('audio.wav', 'rb') as f:
    files = {'file': f}
    data = {'title': 'My Recording'}
    response = requests.post(
        'http://localhost:8000/transcribe',
        files=files,
        data=data
    )
    print(response.json())
```

### JavaScript Fetch
```javascript
// Transcribe audio
const formData = new FormData();
formData.append('file', audioBlob, 'recording.wav');
formData.append('title', 'My Recording');

const response = await fetch('http://localhost:8000/transcribe', {
  method: 'POST',
  body: formData
});

const transcript = await response.json();
console.log(transcript.content);
```

### Command Line (curl)
```bash
# Get all transcripts
curl http://localhost:8000/transcripts | jq

# Transcribe file
curl -X POST \
  -F "file=@audio.wav" \
  -F "title=CLI Recording" \
  http://localhost:8000/transcribe | jq

# Delete transcript
curl -X DELETE http://localhost:8000/transcripts/1
```

---

## Performance Notes

- **Transcription Time**: Depends on audio length and hardware
  - GPU (NVIDIA): ~1 second per 10 seconds of audio
  - CPU: ~5-10 seconds per 10 seconds of audio
  - First run: Additional time for model initialization

- **Memory Usage**:
  - Parakeet model: ~2GB RAM
  - Recommended: 4GB+ total system RAM

- **Disk Space**:
  - Model cache: ~1.5GB
  - Database: Depends on number of transcripts

---

## Versioning

Current API Version: **v1** (no explicit version prefix)

Future versions may be prefixed as `/api/v2/...`
