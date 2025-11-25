"""
Authentication utilities for JWT token management and Google OAuth verification
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from google.auth.transport import requests
from google.oauth2 import id_token
import logging

logger = logging.getLogger(__name__)

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24  # 30 days
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


def create_access_token(email: str, user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token for authenticated users

    Args:
        email: User's email address
        user_id: User's unique ID
        expires_delta: Optional custom expiration time

    Returns:
        JWT token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "email": email,
        "user_id": user_id,
        "exp": expire
    }

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """
    Verify a JWT token and extract claims

    Args:
        token: JWT token string

    Returns:
        Token payload dict if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"Invalid token: {e}")
        return None


def verify_google_token(token: str) -> Optional[dict]:
    """
    Verify Google OAuth token and extract user info

    Args:
        token: Google OAuth ID token

    Returns:
        Google user info dict if valid (id, email, name, picture), None if invalid
    """
    if not GOOGLE_CLIENT_ID:
        logger.error("GOOGLE_CLIENT_ID environment variable not set")
        return None

    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), GOOGLE_CLIENT_ID)

        # Check that the token hasn't expired
        if idinfo.get('exp') < datetime.now(timezone.utc).timestamp():
            logger.warning("Google token has expired")
            return None

        # Extract user information
        user_info = {
            'google_id': idinfo.get('sub'),  # Google's unique ID
            'email': idinfo.get('email'),
            'name': idinfo.get('name'),
            'picture': idinfo.get('picture'),
        }

        return user_info
    except Exception as e:
        logger.error(f"Failed to verify Google token: {e}")
        return None


def hash_password(password: str) -> str:
    """
    Hash a password for storage (future use for local auth)

    Args:
        password: Plain text password

    Returns:
        Hashed password
    """
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against its hash (future use for local auth)

    Args:
        plain_password: Plain text password to verify
        hashed_password: Stored password hash

    Returns:
        True if password matches, False otherwise
    """
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_context.verify(plain_password, hashed_password)
