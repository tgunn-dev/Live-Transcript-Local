from fastapi import FastAPI, UploadFile, File, Depends, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv
import io
import json
import tempfile
import whisper
import ssl
import urllib.request
import certifi
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Dict
import time
import numpy as np

# Optional: Parrakeet for faster speech recognition
# Lazy import to avoid startup errors if there are dependency issues
HAS_PARRAKEET = False
ASRModel = None
try:
    import torch
    # Try importing nemo only when needed (lazy import)
    HAS_PARRAKEET = True
except ImportError:
    print("⚠️  Parrakeet (nemo-toolkit) not installed. Run: pip install nemo-toolkit[asr]")

from database import get_db, Transcript
from schemas import TranscriptResponse, TranscriptionChunk
from speaker_diarization import (
    is_diarization_available,
    detect_speakers,
    get_speaker_at_time,
    merge_speaker_segments,
)

load_dotenv()

# Disable SSL verification for model downloads (workaround for certificate issues)
os.environ['REQUESTS_CA_BUNDLE'] = ''
os.environ['CURL_CA_BUNDLE'] = ''

app = FastAPI(title="Audio Transcriber API")

# Thread pool for running CPU-intensive transcription without blocking
# Increased to 6 to support multiple concurrent users (10+ simultaneous users)
# Note: Each transcription is CPU-intensive, adjust based on your hardware
# - CPU-only: 4-6 workers recommended for 10+ concurrent users
# - With GPU: Can increase to 8-10 if GPU memory allows
# - Each Gunicorn worker gets its own thread pool
executor = ThreadPoolExecutor(max_workers=6)

# Cache for Parakeet models (key: model_name, value: model instance)
parakeet_model_cache = {}

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Whisper model (runs locally)
print("Loading Whisper ASR model...")
asr_model = None

try:
    # Try to load the base Whisper model
    print("Attempting to load 'base' model...")
    import warnings
    warnings.filterwarnings('ignore')

    # Disable SSL verification for this specific request
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    # Load model with timeout
    asr_model = whisper.load_model("base", device="cpu")
    print("✓ Whisper (base) model loaded successfully!")

except Exception as e:
    print(f"⚠ Could not load 'base' model: {e}")
    print("Attempting to load 'tiny' model as fallback...")

    try:
        asr_model = whisper.load_model("tiny", device="cpu")
        print("✓ Whisper (tiny) model loaded successfully!")
    except Exception as e2:
        print(f"✗ Could not load 'tiny' model: {e2}")
        print("\nNote: Model loading failed. The first transcription may download the model.")
        asr_model = None


# Preload default Parakeet models on startup for faster transcription
def preload_parakeet_models():
    """Preload Parakeet models during startup to avoid delays on first request"""
    if not HAS_PARRAKEET:
        print("⚠️  Parakeet (nemo-toolkit) not available, skipping preload")
        return

    # Note: Parakeet models are large (2.4GB+ per model) and can cause OOM in Docker
    # Instead of preloading, we use lazy-loading: models are loaded on-demand when the user selects them
    # This is more memory-efficient and works better in Docker environments with limited RAM
    print("✓ Parakeet models will be lazy-loaded on first use (more Docker-friendly)")


# Print info about model loading strategy
print("\n📻 Model Loading Strategy:")
print("✓ Whisper (base) - Preloaded at startup")
print("✓ Parakeet models - Lazy-loaded on first use (on-demand)")
try:
    preload_parakeet_models()
except Exception as e:
    print(f"⚠️  Parakeet info error: {e}")


@app.get("/")
async def root():
    return {"message": "Audio Transcriber API is running"}


def resample_audio_to_16khz(audio_path: str) -> tuple[str, bool]:
    """
    Resample audio file to 16kHz (required by Parakeet)
    Returns tuple of (path_to_use, is_resampled)
    If resampled=True, caller should delete the resampled file after use
    """
    import librosa
    import soundfile as sf

    try:
        # Load audio at original sample rate
        audio, sr = librosa.load(audio_path, sr=None, mono=True)

        # If already 16kHz, return original path
        if sr == 16000:
            return audio_path, False

        # Resample to 16kHz
        audio_16k = librosa.resample(audio, orig_sr=sr, target_sr=16000)

        # Save to a proper temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            resampled_path = tmp_file.name

        sf.write(resampled_path, audio_16k, 16000)
        print(f"🔄 Resampled audio from {sr}Hz to 16kHz: {resampled_path}")
        return resampled_path, True
    except Exception as e:
        print(f"⚠️  Resampling failed, trying original audio: {e}")
        return audio_path, False


def transcribe_with_parakeet(audio_path: str, model_name: str = "parakeet-1.1b-ctc-greedy") -> str:
    """
    Transcribe audio using Parakeet model (runs locally)
    """
    # Lazy import to avoid startup errors
    global ASRModel
    if ASRModel is None:
        try:
            from nemo.collections.asr.models import ASRModel as _ASRModel
            ASRModel = _ASRModel
        except ImportError as e:
            raise Exception(f"Parakeet (nemo-toolkit) not installed. Run: pip install nemo-toolkit[asr]. Error: {e}")
        except Exception as e:
            raise Exception(f"Failed to import Parakeet. This may be a dependency compatibility issue. Error: {e}")

    try:
        # Map frontend model names to HuggingFace model names
        # TDT models are newer and faster than CTC models
        model_mapping = {
            # Newer TDT (Turn Detection and Transcription) models - faster and more accurate
            "parakeet-tdt-0.6b-v3": "nvidia/parakeet-tdt-0.6b-v3",  # Latest, fastest, best quality
            "parakeet-tdt-0.6b": "nvidia/parakeet-tdt-0.6b-v3",  # Alias for latest
            "parakeet-tdt-1.1b": "nvidia/parakeet-tdt-1.1b",  # Larger, more accurate
            # Original CTC models (still available)
            "parakeet-ctc-0.6b": "nvidia/parakeet-ctc-0.6b",
            "parakeet-1.1b-ctc-greedy": "nvidia/parakeet-ctc-1.1b",
            "parakeet-ctc-1.1b": "nvidia/parakeet-ctc-1.1b",
            "parakeet-ctc-base": "nvidia/parakeet-ctc-0.6b",  # Use 0.6b as base
        }
        
        # Get the full model name, default to the provided name if not in mapping
        full_model_name = model_mapping.get(model_name, model_name)
        
        # If model name doesn't start with nvidia/, add it
        if not full_model_name.startswith("nvidia/"):
            full_model_name = f"nvidia/{full_model_name}"
        
        # Check if model is already cached
        if full_model_name not in parakeet_model_cache:
            print(f"Loading Parakeet model: {full_model_name} (this may take a minute on first use)...")
            
            # Load Parakeet model with refresh_cache=False to avoid re-downloading
            try:
                parakeet_model = ASRModel.from_pretrained(full_model_name, refresh_cache=False)
            except Exception:
                # If refresh_cache=False fails, try without it
                parakeet_model = ASRModel.from_pretrained(full_model_name)
            
            parakeet_model.eval()
            
            # Use GPU if available
            if torch.cuda.is_available():
                parakeet_model = parakeet_model.cuda()
                print("✓ Using GPU for Parakeet transcription")
            else:
                print("✓ Using CPU for Parakeet transcription")
            
            # Cache the model
            parakeet_model_cache[full_model_name] = parakeet_model
            print(f"✓ Parakeet model '{full_model_name}' loaded and cached")
        else:
            parakeet_model = parakeet_model_cache[full_model_name]
            # Don't print every time to reduce noise - only on first use

        # Resample audio to 16kHz (required by Parakeet)
        audio_path_16k, is_resampled = resample_audio_to_16khz(audio_path)

        transcribed_text = None
        try:
            # Transcribe with timeout
            print(f"📝 Transcribing with Parakeet model (this may take a moment)...")
            with torch.no_grad():
                transcribed_text = parakeet_model.transcribe([audio_path_16k])
                print(f"✓ Parakeet transcription returned results")
        except Exception as e:
            print(f"❌ Parakeet transcription error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            raise
        finally:
            # Clean up resampled file if we created one
            if is_resampled and os.path.exists(audio_path_16k):
                try:
                    os.remove(audio_path_16k)
                    print(f"🧹 Cleaned up resampled audio file")
                except Exception as e:
                    print(f"⚠️  Could not delete resampled file: {e}")
        
        # Extract text from result (may be Hypothesis object or string)
        if transcribed_text and len(transcribed_text) > 0:
            first_result = transcribed_text[0]
            # Handle Hypothesis object (has .text attribute) or string
            if hasattr(first_result, 'text'):
                result = first_result.text
            elif hasattr(first_result, 'y_sequence'):
                # Alternative: some models return y_sequence
                result = str(first_result.y_sequence) if first_result.y_sequence else ""
            elif isinstance(first_result, str):
                result = first_result
            else:
                # Try to convert to string
                result = str(first_result)
        else:
            result = ""
        
        # Clean up result
        if result:
            result = str(result).strip()
        
        if not result or result == "":
            print("⚠️  Parakeet returned empty transcript")
        else:
            print(f"✓ Parakeet transcription successful: {len(result)} characters")
        
        return result

    except Exception as e:
        error_msg = f"Parakeet transcription failed: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        raise Exception(error_msg)


def transcribe_with_whisper(audio_path: str, model=None) -> str:
    """
    Transcribe audio using Whisper model (runs locally)
    """
    transcription_model = model or asr_model
    if transcription_model is None:
        raise Exception("ASR model not loaded")

    try:
        # Transcribe using Whisper
        result = transcription_model.transcribe(audio_path)
        return result["text"]

    except Exception as e:
        raise Exception(f"Whisper transcription failed: {str(e)}")


async def transcribe_async(audio_path: str, model=None) -> str:
    """
    Async wrapper for Whisper transcription - runs in thread pool to avoid blocking
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, transcribe_with_whisper, audio_path, model)


@app.post("/transcribe", response_model=TranscriptResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    title: str = "Untitled Recording",
    model: str = "whisper-base",
    db: Session = Depends(get_db)
):
    """
    Transcribe an audio file using Whisper or Parakeet ASR (runs completely locally)
    """
    try:
        # Read the audio file
        audio_data = await file.read()

        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            tmp_file.write(audio_data)
            tmp_file_path = tmp_file.name

        try:
            # Transcribe using the selected model
            if model.startswith("parakeet"):
                transcribed_text = transcribe_with_parakeet(tmp_file_path, model)
            else:
                transcribed_text = transcribe_with_whisper(tmp_file_path)

            # Create a single segment for standard transcription
            # Note: For file uploads, we don't have precise timestamps, so we'll create a simple segment
            segments = [{
                "text": transcribed_text,
                "timestamp": 0.0,
                "speaker": "Speaker 1",
                "start_time": 0.0,
                "end_time": 0.0  # Unknown for file uploads
            }]
            segments_json = json.dumps(segments)
            
            # Save to database
            db_transcript = Transcript(
                title=title,
                content=transcribed_text,
                duration=0,  # Will be set by frontend if available
                segments=segments_json
            )
            db.add(db_transcript)
            db.commit()
            db.refresh(db_transcript)

            return db_transcript

        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)

    except Exception as e:
        raise Exception(f"Transcription failed: {str(e)}")


@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    db: Session = next(get_db())
    """
    WebSocket endpoint for LIVE real-time transcription with Whisper.
    Client sends audio chunks, server transcribes periodically and sends partial results.
    Multi-user capable - creates unique session per connection.
    """
    await websocket.accept()

    # Create unique user/session for this connection
    import uuid as uuid_module
    session_id = str(uuid_module.uuid4())
    print(f"✓ WebSocket client connected (Session ID: {session_id[:8]}...)")

    # Create user record for this session
    from database import User
    try:
        user = User(session_id=session_id)
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = user.id
        print(f"  👤 User created: {user_id[:8]}...")
    except Exception as e:
        print(f"  ⚠️ Error creating user session: {e}")
        user_id = None

    audio_buffer = io.BytesIO()
    last_transcribed_text = ""
    last_audio_length = 0  # Track how much audio we've already transcribed
    sample_rate = 48000  # Default sample rate
    selected_model = "base"  # Default model
    current_asr_model = asr_model  # Use the loaded model by default
    title = f"Live Recording - {websocket.client.host}"
    transcript_saved = False
    # Track segments with timestamps and speakers
    transcript_segments = []  # List of {"text": "...", "timestamp": 0.0, "speaker": "Speaker 1"}
    recording_start_time = None

    # Speaker diarization support
    diarization_speakers = []  # Will be populated after recording with pyannote
    use_diarization = is_diarization_available()  # Check if pyannote is available
    if use_diarization:
        print("✓ Speaker diarization enabled (pyannote.audio)")
    else:
        print("⚠️ Speaker diarization disabled (pyannote.audio not available)")

    try:
        while True:
            try:
                # Check for incoming data - could be JSON (config) or binary (audio)
                data = await websocket.receive()

                if "text" in data:
                    # JSON message (config)
                    try:
                        config_data = json.loads(data["text"])
                        if config_data.get("type") == "config":
                            sample_rate = config_data.get("sampleRate", 48000)

                            # Get model selection from frontend
                            model_param = config_data.get("model", "whisper-base")
                            
                            # Check if it's a Parakeet model first
                            if model_param.startswith("parakeet"):
                                selected_model = model_param
                                current_asr_model = "parakeet"  # Flag to use parakeet
                                print(f"✓ Selected Parakeet model: {selected_model}")
                            else:
                                # Parse Whisper model name (e.g., "whisper-base" -> "base")
                                if model_param.startswith("whisper-"):
                                    selected_model = model_param.replace("whisper-", "")
                                else:
                                    selected_model = model_param

                                # Load the Whisper model if different from current
                                if selected_model != "base" or current_asr_model is None or current_asr_model == "parakeet":
                                    try:
                                        print(f"📥 Loading Whisper model: {selected_model}")
                                        current_asr_model = whisper.load_model(selected_model, device="cpu")
                                        print(f"✓ Whisper model loaded: {selected_model}")
                                    except Exception as e:
                                        print(f"⚠️ Could not load {selected_model}, using base: {e}")
                                        current_asr_model = asr_model or whisper.load_model("base", device="cpu")
                                else:
                                    print(f"✓ Using already loaded Whisper model: {selected_model}")

                            config_received = True
                            print(f"✓ Received audio config: sample_rate={sample_rate}Hz, model={selected_model}")
                            continue
                    except json.JSONDecodeError:
                        pass

                elif "bytes" in data:
                    # Binary audio data
                    audio_data_chunk = data["bytes"]

                    # Initialize recording start time on first audio chunk
                    if recording_start_time is None:
                        recording_start_time = time.time()
                        print(f"🎙️ Recording started at {time.strftime('%H:%M:%S')}")

                    # Add chunk to buffer
                    audio_buffer.write(audio_data_chunk)
                    current_audio_length = audio_buffer.tell()

                    # Only transcribe if we have new audio (at least 1 second of new audio)
                    # This prevents re-transcribing the same audio
                    new_audio_bytes = current_audio_length - last_audio_length
                    min_audio_for_transcription = sample_rate * 2 * 2  # 2 seconds of 16-bit mono audio

                    # Transcribe immediately when audio is received (frontend sends complete phrases)
                    if current_asr_model is not None and new_audio_bytes >= min_audio_for_transcription:
                        try:
                            # Only transcribe the NEW audio portion to avoid repetition
                            audio_buffer.seek(last_audio_length)
                            new_audio_data = audio_buffer.read(new_audio_bytes)
                            
                            # If we have enough new audio, transcribe it
                            if len(new_audio_data) > 500:
                                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                                    tmp_file_path = tmp_file.name

                                # Write WAV file with proper headers
                                import wave
                                with wave.open(tmp_file_path, 'wb') as wav_file:
                                    wav_file.setnchannels(1)  # Mono
                                    wav_file.setsampwidth(2)  # 16-bit
                                    wav_file.setframerate(sample_rate)
                                    wav_file.writeframes(new_audio_data)
                                

                                # Transcribe (async - doesn't block)
                                try:
                                    loop = asyncio.get_event_loop()
                                    if current_asr_model == "parakeet":
                                        print(f"🎤 Starting Parakeet transcription with model: {selected_model}")
                                        transcription = await loop.run_in_executor(executor, transcribe_with_parakeet, tmp_file_path, selected_model)
                                        print(f"✓ Parakeet transcription completed: {len(transcription)} characters")
                                    else:
                                        print(f"🎤 Starting Whisper transcription with model: {current_asr_model}")
                                        transcription = await transcribe_async(tmp_file_path, current_asr_model)
                                        print(f"✓ Whisper transcription completed: {len(transcription)} characters")


                                    # Append new transcription to accumulated text with timestamp and speaker
                                    if transcription and transcription.strip():
                                        new_text = transcription.strip()
                                        
                                        # Calculate timestamp based on audio position
                                        # Audio length in bytes / (sample_rate * channels * bytes_per_sample) = seconds
                                        audio_duration_seconds = (last_audio_length / (sample_rate * 1 * 2))  # mono, 16-bit
                                        timestamp = audio_duration_seconds

                                        # During live transcription, use generic speaker label
                                        # We'll run accurate diarization on the full recording at the end
                                        speaker_name = "Speaker"  # Will be updated with pyannote later
                                        
                                        # Create segment with timestamp and speaker
                                        segment = {
                                            "text": new_text,
                                            "timestamp": round(timestamp, 2),
                                            "speaker": speaker_name,
                                            "start_time": round(timestamp, 2),
                                            "end_time": round(timestamp + (new_audio_bytes / (sample_rate * 1 * 2)), 2)
                                        }
                                        
                                        # Append new text to previous (don't replace)
                                        if last_transcribed_text:
                                            # Check if this is truly new content
                                            if not last_transcribed_text.endswith(new_text):
                                                # Append with a space
                                                accumulated_text = f"{last_transcribed_text} {new_text}".strip()
                                            else:
                                                # New text is already at the end, don't duplicate
                                                accumulated_text = last_transcribed_text
                                                # Don't add duplicate segment
                                                segment = None
                                        else:
                                            # First transcription
                                            accumulated_text = new_text
                                        
                                        # Add segment to list if it's new
                                        if segment and accumulated_text != last_transcribed_text:
                                            transcript_segments.append(segment)
                                            last_segment_time = timestamp  # Update last segment time
                                            print(f"📝 Segment added: [{segment['timestamp']:.1f}s] {speaker_name}: {new_text[:50]}...")
                                        
                                        # Always update last_transcribed_text with the full accumulated text
                                        if accumulated_text != last_transcribed_text:
                                            print(f"📝 Accumulating transcript: {len(last_transcribed_text)} -> {len(accumulated_text)} chars")
                                            last_transcribed_text = accumulated_text
                                            last_audio_length = current_audio_length  # Update after successful transcription

                                            # Get the latest segment for metadata
                                            latest_segment = transcript_segments[-1] if transcript_segments else None

                                            await websocket.send_json({
                                                "type": "partial",
                                                "text": accumulated_text,
                                                "chunk": new_text,  # New chunk for message display
                                                "speaker": latest_segment.get("speaker", "Speaker 1") if latest_segment else "Speaker 1",
                                                "timestamp": latest_segment.get("timestamp", 0) if latest_segment else 0,
                                                "segments": transcript_segments  # Send segments with timestamps
                                            })
                                            print(f"✓ Sent full transcript ({len(accumulated_text)} chars), new chunk: {new_text[:50]}...")
                                        else:
                                            print(f"⚠️  Skipped duplicate transcription: {new_text[:50]}...")
                                except Exception as e:
                                    print(f"Transcription error: {e}")
                                finally:
                                    if os.path.exists(tmp_file_path):
                                        os.remove(tmp_file_path)
                        except Exception as e:
                            print(f"Error during partial transcription: {e}")

            except Exception as e:
                print(f"Error in WebSocket receive loop: {e}")
                break

    except WebSocketDisconnect:
        print(f"✓ Client disconnected - live transcription ended")
    finally:
        # Save the full accumulated transcript to database with timestamps and speakers
        if last_transcribed_text and not transcript_saved:
            try:
                final_transcript = last_transcribed_text.strip()

                # Run speaker diarization if available and we have audio
                if use_diarization and audio_buffer.tell() > 0:
                    try:
                        print("🔊 Running speaker diarization with pyannote.audio...")

                        # Save complete audio to temporary file for diarization
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_audio:
                            tmp_audio_path = tmp_audio.name

                        # Write complete audio buffer to wav file
                        import wave
                        with wave.open(tmp_audio_path, 'wb') as wav_file:
                            wav_file.setnchannels(1)  # Mono
                            wav_file.setsampwidth(2)  # 16-bit
                            wav_file.setframerate(sample_rate)
                            wav_file.writeframes(audio_buffer.getvalue())

                        print(f"💾 Saved complete audio ({audio_buffer.tell()} bytes) for diarization")

                        # Run pyannote diarization
                        diarization_speakers = detect_speakers(tmp_audio_path)

                        if diarization_speakers:
                            print(f"✓ Speaker diarization complete: {len(set(s['speaker'] for s in diarization_speakers))} speakers detected")

                            # Update segment speaker labels based on diarization
                            for segment in transcript_segments:
                                timestamp = segment.get("timestamp", 0)
                                speaker = get_speaker_at_time(diarization_speakers, timestamp)
                                if speaker != "Unknown":
                                    segment["speaker"] = speaker
                                    print(f"  📝 Updated: [{timestamp}s] → {speaker}")
                        else:
                            print("⚠️ Speaker diarization returned no results, keeping original labels")

                        # Clean up
                        try:
                            os.remove(tmp_audio_path)
                        except:
                            pass

                    except Exception as e:
                        print(f"⚠️ Speaker diarization failed: {e}")
                        print("  Continuing with original speaker labels...")

                # Calculate total duration
                total_duration = 0
                if transcript_segments:
                    last_segment = transcript_segments[-1]
                    total_duration = int(last_segment.get("end_time", 0))

                # Save segments as JSON
                segments_json = json.dumps(transcript_segments) if transcript_segments else None

                print(f"💾 Saving full transcript to database ({len(final_transcript)} characters, {len(transcript_segments)} segments)...")
                print(f"   Preview: {final_transcript[:100]}...")
                if transcript_segments:
                    print(f"   Segments: {len(transcript_segments)} with timestamps and speakers")
                
                db_transcript = Transcript(
                    user_id=user_id,  # Associate with the user who recorded this
                    title=title,
                    content=final_transcript,  # Save the full accumulated transcript
                    duration=total_duration,
                    segments=segments_json  # Save segments with timestamps and speakers as JSON
                )
                db.add(db_transcript)
                db.commit()
                db.refresh(db_transcript)
                transcript_saved = True
                print(f"✓ Full transcript saved to database (ID: {db_transcript.id}, {len(final_transcript)} chars, {len(transcript_segments)} segments)")
            except Exception as e:
                print(f"✗ Error saving transcript to database: {e}")
                import traceback
                traceback.print_exc()
                db.rollback()


@app.get("/transcripts", response_model=list[TranscriptResponse])
async def get_transcripts(db: Session = Depends(get_db)):
    """
    Get all saved transcripts
    """
    transcripts = db.query(Transcript).order_by(Transcript.created_at.desc()).all()
    # Parse segments JSON for each transcript
    for transcript in transcripts:
        if transcript.segments:
            try:
                transcript.segments = json.loads(transcript.segments) if isinstance(transcript.segments, str) else transcript.segments
            except:
                transcript.segments = None
    return transcripts


@app.get("/transcripts/{transcript_id}", response_model=TranscriptResponse)
async def get_transcript(transcript_id: int, db: Session = Depends(get_db)):
    """
    Get a specific transcript by ID
    """
    transcript = db.query(Transcript).filter(Transcript.id == transcript_id).first()
    if not transcript:
        raise Exception("Transcript not found")
    # Parse segments JSON
    if transcript.segments:
        try:
            transcript.segments = json.loads(transcript.segments) if isinstance(transcript.segments, str) else transcript.segments
        except:
            transcript.segments = None
    return transcript


@app.post("/save-transcript")
async def save_transcript(
    data: Dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Save a transcript directly (used by live transcription feature)
    """
    try:
        # Extract title and content from request body
        title = data.get("title", "Untitled Recording")
        content = data.get("content", "")

        if not content or not content.strip():
            raise Exception("Transcript content cannot be empty")

        db_transcript = Transcript(
            title=title,
            content=content,
            duration=0
        )
        db.add(db_transcript)
        db.commit()
        db.refresh(db_transcript)

        return {
            "message": "Transcript saved successfully",
            "id": db_transcript.id,
            "transcript": {
                "id": db_transcript.id,
                "title": db_transcript.title,
                "content": db_transcript.content,
                "created_at": db_transcript.created_at
            }
        }
    except Exception as e:
        db.rollback()
        raise Exception(f"Failed to save transcript: {str(e)}")


@app.post("/save-transcript")
async def save_transcript(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Save a transcript (from client-side transcription)
    This endpoint allows client-side transcription results to be saved for history
    """
    try:
        title = payload.get("title", f"Recording - {time.strftime('%Y-%m-%d %H:%M:%S')}")
        content = payload.get("content", "")

        if not content or content.strip() == "":
            return {"message": "No transcript content to save"}

        # Create new transcript record
        db_transcript = Transcript(
            title=title,
            content=content,
            duration=0,  # Duration not available from client-side transcription
            segments=json.dumps([])  # Empty segments for client-side transcriptions
        )

        db.add(db_transcript)
        db.commit()
        db.refresh(db_transcript)

        return {
            "id": db_transcript.id,
            "title": db_transcript.title,
            "content": db_transcript.content,
            "message": "Transcript saved successfully"
        }
    except Exception as e:
        db.rollback()
        return {"error": str(e), "message": "Failed to save transcript"}


@app.delete("/transcripts/{transcript_id}")
async def delete_transcript(transcript_id: int, db: Session = Depends(get_db)):
    """
    Delete a transcript
    """
    transcript = db.query(Transcript).filter(Transcript.id == transcript_id).first()
    if not transcript:
        raise Exception("Transcript not found")

    db.delete(transcript)
    db.commit()
    return {"message": "Transcript deleted successfully"}
