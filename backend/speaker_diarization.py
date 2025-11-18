"""
Speaker Diarization Module
Uses pyannote.audio for accurate speaker identification and tracking
"""

import os
import tempfile
import numpy as np
from typing import List, Dict, Tuple
import torch

# Try to import pyannote
HAS_PYANNOTE = False
try:
    from pyannote.audio import Pipeline
    HAS_PYANNOTE = True
except ImportError:
    print("⚠️ pyannote.audio not installed. Speaker diarization will be disabled.")

# Global cache for diarization pipeline
diarization_pipeline = None


def initialize_diarization():
    """Initialize the speaker diarization pipeline (lazy loading)"""
    global diarization_pipeline

    if not HAS_PYANNOTE:
        print("⚠️ pyannote.audio not available. Cannot perform speaker diarization.")
        return False

    try:
        if diarization_pipeline is None:
            print("📥 Loading pyannote.audio speaker diarization pipeline...")

            # Check if HuggingFace token is available
            hf_token = os.getenv("HUGGINGFACE_TOKEN")
            if not hf_token:
                print("⚠️ HUGGINGFACE_TOKEN not set. Using public models (may have limited access).")
                # Try to use the pipeline without token (may fail for some models)
                diarization_pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.0",
                    use_auth_token=False
                )
            else:
                diarization_pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.0",
                    use_auth_token=hf_token
                )

            # Move pipeline to GPU if available
            if torch.cuda.is_available():
                diarization_pipeline = diarization_pipeline.to(torch.device("cuda"))
                print("✓ Speaker diarization pipeline loaded on GPU")
            else:
                print("✓ Speaker diarization pipeline loaded on CPU")

        return True
    except Exception as e:
        print(f"❌ Failed to load speaker diarization pipeline: {e}")
        print("   Falling back to basic voice characteristics detection.")
        return False


def detect_speakers(audio_path: str) -> List[Dict]:
    """
    Detect and diarize speakers in audio file

    Returns list of dicts with:
    - start: start time in seconds
    - end: end time in seconds
    - speaker: speaker label (e.g., "Speaker 1", "Speaker 2")
    """
    global diarization_pipeline

    if not HAS_PYANNOTE or diarization_pipeline is None:
        if not initialize_diarization():
            return []

    try:
        print(f"🎤 Running speaker diarization on {audio_path}...")

        # Run diarization
        diarization = diarization_pipeline(audio_path)

        # Convert to list format
        speakers = []
        speaker_map = {}  # Map speaker labels to Speaker 1, Speaker 2, etc.
        speaker_counter = 1

        for turn, _, speaker in diarization.itertracks(yield_label=True):
            # Map speaker label to Speaker N
            if speaker not in speaker_map:
                speaker_map[speaker] = f"Speaker {speaker_counter}"
                speaker_counter += 1

            speakers.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker_map[speaker],
                "confidence": 0.95,  # pyannote provides confidence, we'd extract it here
            })

        print(f"✓ Detected {len(set(s['speaker'] for s in speakers))} unique speakers")
        return speakers

    except Exception as e:
        print(f"❌ Speaker diarization error: {e}")
        return []


def get_speaker_at_time(speakers: List[Dict], timestamp: float) -> str:
    """
    Get the speaker label at a specific timestamp

    Args:
        speakers: List of speaker segments from detect_speakers()
        timestamp: Time in seconds

    Returns:
        Speaker label (e.g., "Speaker 1") or "Unknown" if not found
    """
    if not speakers:
        return "Unknown"

    for segment in speakers:
        if segment["start"] <= timestamp <= segment["end"]:
            return segment["speaker"]

    # If no exact match, find closest speaker before this time
    before_segments = [s for s in speakers if s["end"] <= timestamp]
    if before_segments:
        latest = max(before_segments, key=lambda x: x["end"])
        if timestamp - latest["end"] < 2.0:  # Within 2 seconds
            return latest["speaker"]

    return "Unknown"


def merge_speaker_segments(speakers: List[Dict], min_gap: float = 0.5) -> List[Dict]:
    """
    Merge speaker segments that are very close together (same speaker)

    Args:
        speakers: List of speaker segments
        min_gap: Minimum gap in seconds to consider as same speaker

    Returns:
        Merged speaker segments
    """
    if not speakers:
        return []

    # Sort by start time
    sorted_speakers = sorted(speakers, key=lambda x: x["start"])
    merged = [sorted_speakers[0]]

    for current in sorted_speakers[1:]:
        last = merged[-1]

        # If same speaker and close together, merge
        if (current["speaker"] == last["speaker"] and
            current["start"] - last["end"] < min_gap):
            last["end"] = current["end"]
        else:
            merged.append(current)

    return merged


def is_diarization_available() -> bool:
    """Check if speaker diarization is available"""
    return HAS_PYANNOTE
