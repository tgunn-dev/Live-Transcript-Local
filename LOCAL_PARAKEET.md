# Local Parakeet Setup & Configuration

This document confirms that your application runs Parakeet ASR **completely locally** with no external API calls.

## How It Works

### Local Model Loading

In `backend/main.py`, Parakeet is loaded directly from HuggingFace:

```python
from nemo.collections.asr import ASRModel

# Load Parakeet model locally
asr_model = ASRModel.from_pretrained("nvidia/parakeet-ctc-base")
asr_model.eval()

# Use GPU if available, otherwise CPU
if torch.cuda.is_available():
    asr_model = asr_model.cuda()
```

### First-Run Download

On first run, the model (~1.5GB) will be downloaded and cached:

```
Loading Parakeet ASR model...
Downloading: 100%|██████████| 1.5GB [00:45<00:00, 33MB/s]
Parakeet model loaded successfully
```

After the first run, it's cached locally and loads much faster.

### Local Transcription

When audio is transcribed, all processing happens on your machine:

```python
def transcribe_with_parakeet(audio_path: str) -> str:
    # Load audio locally
    audio, sr = librosa.load(audio_path, sr=16000)

    # Transcribe using local model (no API calls)
    with torch.no_grad():
        transcript = asr_model.transcribe([audio_path])

    return transcript[0]
```

---

## Hardware Requirements

### Minimum (CPU Only)
- 4GB RAM
- 2GB disk space
- ~30 seconds per 10 seconds of audio

### Recommended (GPU)
- NVIDIA GPU with 4GB+ VRAM
- 8GB system RAM
- ~1 second per 10 seconds of audio
- 10GB disk space for model and cache

---

## GPU Acceleration (Optional)

### Check if GPU is Available

The backend automatically detects GPU:

```python
if torch.cuda.is_available():
    asr_model = asr_model.cuda()
    print("Using GPU for transcription")
else:
    print("Using CPU for transcription")
```

### Enable CUDA (NVIDIA)

If you have an NVIDIA GPU:

1. **Install CUDA Toolkit**
   - Download from: https://developer.nvidia.com/cuda-downloads

2. **Install cuDNN**
   - Download from: https://developer.nvidia.com/cudnn

3. **Install GPU PyTorch**
   ```bash
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```

4. **Verify GPU**
   ```bash
   python -c "import torch; print(torch.cuda.is_available())"
   ```

Expected output: `True`

---

## Model Details

### Parakeet CTC Base

**Model Name**: `nvidia/parakeet-ctc-base`

**Architecture**:
- Conformer encoder
- CTC (Connectionist Temporal Classification) decoder
- ~100M parameters

**Capabilities**:
- English speech recognition
- 16kHz audio input
- ~94% accuracy on LibriSpeech test-clean

**Specifications**:
- Size: 1.5GB (compressed)
- RAM Required: 2GB
- VRAM Required (GPU): 4GB+
- Latency (CPU): 5-10x real-time
- Latency (GPU): 0.1-0.2x real-time

---

## Model Cache Location

The model is cached in your home directory:

- **Linux/macOS**: `~/.cache/huggingface/hub/`
- **Windows**: `C:\Users\<username>\.cache\huggingface\hub\`

To change cache location, set environment variable:

```bash
export HUGGINGFACE_HUB_CACHE=/custom/path
```

---

## Privacy & Security

Since Parakeet runs locally:

✅ **No data sent to external servers**
✅ **No API keys required**
✅ **Complete privacy for your recordings**
✅ **Works offline after first model download**
✅ **No usage tracking or analytics**

---

## Alternative Models

To use a different Parakeet model, update `backend/main.py`:

```python
# Available models:
# - nvidia/parakeet-ctc-base (current, recommended)
# - nvidia/parakeet-ctc-large (larger, more accurate, slower)
# - Custom fine-tuned model

asr_model = ASRModel.from_pretrained("nvidia/parakeet-ctc-large")
```

---

## Performance Optimization

### Batch Processing

For multiple audio files, process them sequentially to save memory:

```python
transcripts = []
for audio_file in audio_files:
    transcript = transcribe_with_parakeet(audio_file)
    transcripts.append(transcript)
```

### Audio Preprocessing

Preprocess audio for better results:

```python
# Resample to 16kHz
audio, sr = librosa.load(audio_path, sr=16000)

# Normalize volume
audio = librosa.util.normalize(audio)

# Save preprocessed audio
sf.write('processed.wav', audio, 16000)
```

### Memory Management

For very long audio (>30 minutes):

```python
# Split audio into chunks
chunk_duration = 300  # 5 minutes
overlap = 10  # seconds

# Process each chunk and concatenate results
```

---

## Troubleshooting

### Issue: "Model download stuck"

**Solution**:
- Check internet connection
- Delete cache: `rm -rf ~/.cache/huggingface/`
- Try again

### Issue: "Out of memory"

**Solution**:
- Close other applications
- Reduce batch size
- Use smaller model
- Process shorter audio files

### Issue: "CUDA out of memory"

**Solution**:
```python
import torch
torch.cuda.empty_cache()  # Clear GPU memory

# Or reduce batch size
# Or process shorter audio
```

### Issue: "Model not found"

**Solution**:
```bash
# Check model exists
huggingface-cli list-repo-refs "nvidia/parakeet-ctc-base"

# Re-download
rm -rf ~/.cache/huggingface/hub/models--nvidia--parakeet-ctc-base
```

---

## Monitoring GPU Usage

### Linux/macOS
```bash
# Watch GPU usage in real-time
watch -n 1 nvidia-smi

# Or use alternative
gpustat
```

### Windows
```bash
# In PowerShell
nvidia-smi.exe -l 1
```

Expected output during transcription:
```
GPU Memory Usage: ~2-3 GB
GPU Utilization: 80-100%
```

---

## Deployment Notes

### Docker with GPU

To use GPU in Docker:

```bash
# Install nvidia-docker
# https://github.com/NVIDIA/nvidia-docker

# Run container with GPU
docker run --gpus all -p 8000:8000 parakeet-transcriber
```

### Production Optimization

For production use:

1. **Pre-load model on startup**
   - Already done in our backend

2. **Use model quantization**
   ```python
   asr_model = asr_model.half()  # Use float16
   ```

3. **Implement request queuing**
   - Use Celery for async jobs

4. **Add caching**
   - Cache transcriptions of duplicate audio

5. **Monitor resource usage**
   - Log GPU/CPU metrics

---

## What Happens When You Record

```
┌─────────────────────────────────────────────┐
│ You record audio in the browser             │
└─────────────────┬───────────────────────────┘
                  │
         ┌────────▼──────────┐
         │ Send to backend   │ (Only audio bytes, no metadata)
         └────────┬──────────┘
                  │
         ┌────────▼──────────────────────┐
         │ Backend (localhost:8000)      │
         │ - Load Parakeet model locally │
         │ - Transcribe audio            │
         │ - Save to local database      │
         └────────┬──────────────────────┘
                  │
         ┌────────▼──────────┐
         │ Return transcript │ (Only text result)
         └────────┬──────────┘
                  │
         ┌────────▼──────────────────────┐
         │ Frontend displays transcript  │
         └───────────────────────────────┘

All processing stays on your machine! ✓
```

---

## Cost Savings

Compared to cloud APIs:

| Service | Monthly Cost | Local Parakeet |
|---------|-------------|-----------------|
| OpenAI Whisper | $0.002/min | Free (one-time) |
| Google Cloud Speech | $0.004/min | Free |
| AWS Transcribe | $0.0001/sec | Free |
| Azure Speech | $0.004/min | Free |

**1000 hours of audio/month:**
- Cloud APIs: $48-288/month
- Local Parakeet: Free (after model download)

---

## Next Steps

1. Start both servers: `./start.sh`
2. Go to `http://localhost:3000`
3. Record audio
4. Wait for local Parakeet to transcribe
5. All processing happens on your machine!

---

## References

- Parakeet Model: https://huggingface.co/nvidia/parakeet-ctc-base
- NeMo Documentation: https://docs.nvidia.com/deeplearning/nemo/user-guide/
- PyTorch: https://pytorch.org/
- Librosa: https://librosa.org/

---

## Summary

✅ **Your application runs 100% locally**
✅ **No external API dependencies**
✅ **No subscription fees**
✅ **Complete privacy**
✅ **Works offline** (after initial model download)
