from pydantic import BaseModel
from datetime import datetime


class TranscriptBase(BaseModel):
    title: str
    content: str
    duration: int = 0
    segments: list[dict] = None  # List of segments with timestamps and speakers


class TranscriptCreate(TranscriptBase):
    pass


class TranscriptResponse(TranscriptBase):
    id: int
    user_id: str = None  # Track which user owns the transcript
    created_at: datetime
    segments: list[dict] = None  # List of segments with timestamps and speakers

    class Config:
        from_attributes = True


class TranscriptionChunk(BaseModel):
    text: str
    is_final: bool = False
