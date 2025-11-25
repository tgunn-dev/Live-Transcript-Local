from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv
import uuid

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./transcripts.db")

# Create engine with appropriate connection args for SQLite or PostgreSQL
if "sqlite" in DATABASE_URL:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, unique=True, index=True)  # WebSocket session ID
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    transcripts = relationship("Transcript", back_populates="user")


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=True)  # nullable for backward compatibility
    title = Column(String, index=True)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    duration = Column(Integer)  # Duration in seconds
    # Store timestamps and speaker info as JSON
    # Format: [{"text": "...", "timestamp": 0.0, "speaker": "Speaker 1"}, ...]
    segments = Column(Text)  # JSON string of segments with timestamps and speakers

    # Relationship
    user = relationship("User", back_populates="transcripts")


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
