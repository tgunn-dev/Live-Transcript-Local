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


# Create tables safely - check if they exist first to avoid race conditions with multiple Gunicorn workers
def init_db():
    """Initialize database tables if they don't exist"""
    from sqlalchemy import inspect

    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    # Only create tables that don't exist
    for table in Base.metadata.tables.values():
        if table.name not in existing_tables:
            table.create(bind=engine, checkfirst=True)

    # For SQLite with existing transcripts table (backward compatibility)
    # Check if user_id column exists and add it if needed
    if "sqlite" in DATABASE_URL and "transcripts" in existing_tables:
        try:
            columns = [col.name for col in inspector.get_columns("transcripts")]
            if "user_id" not in columns:
                # Add user_id column to existing transcripts table
                from sqlalchemy import text
                db = SessionLocal()
                try:
                    print("⏳ Adding user_id column to transcripts table...", flush=True)
                    db.execute(text('ALTER TABLE transcripts ADD COLUMN user_id TEXT'))
                    db.commit()
                    print("✓ Added user_id column to transcripts table", flush=True)
                except Exception as col_error:
                    db.rollback()
                    if "duplicate column name" in str(col_error).lower() or "already exists" in str(col_error).lower():
                        print("✓ user_id column already exists", flush=True)
                    else:
                        print(f"❌ Error adding user_id column: {col_error}", flush=True)
                        raise  # Re-raise to prevent app startup if schema migration fails
                finally:
                    db.close()
        except Exception as e:
            print(f"❌ Error checking transcripts schema: {e}", flush=True)
            raise  # Re-raise to prevent app startup on schema errors

# Try to initialize, but handle errors gracefully
try:
    init_db()
except Exception as e:
    # Log but allow app to continue - column may already exist
    import sys
    error_str = str(e).lower()
    if "duplicate column" in error_str or "already exists" in error_str:
        # Column already exists, this is fine
        print(f"✓ Database schema is current", flush=True)
    else:
        # Other errors - log but continue (another worker might be initializing)
        print(f"⚠️ Database initialization encountered: {e}", file=sys.stderr, flush=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
