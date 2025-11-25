from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TranscriptBase(BaseModel):
    title: str
    content: str
    duration: int = 0
    segments: list[dict] = None  # List of segments with timestamps and speakers


class TranscriptCreate(TranscriptBase):
    pass


class TranscriptResponse(TranscriptBase):
    id: int
    user_id: Optional[str] = None  # Track which user owns the transcript (nullable for backward compatibility)
    created_at: datetime
    segments: Optional[list[dict]] = None  # List of segments with timestamps and speakers

    class Config:
        from_attributes = True


class TranscriptionChunk(BaseModel):
    text: str
    is_final: bool = False
