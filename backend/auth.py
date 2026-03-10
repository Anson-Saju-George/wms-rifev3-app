import os
from jose import jwt
from datetime import datetime, timedelta
from google.oauth2 import id_token
from google.auth.transport import requests

from sqlalchemy.orm import Session
from models import User

from dotenv import load_dotenv
load_dotenv()

# ---------------- CONFIG ----------------

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

SECRET_KEY = os.getenv("JWT_SECRET")

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

ADMIN_EMAILS = [
    "ansonsaju007@gmail.com"
]

# ---------------- GOOGLE VERIFY ----------------

def verify_google_token(token: str):

    try:

        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )

        return idinfo

    except Exception:
        return None


# ---------------- JWT ----------------

def create_access_token(data: dict):

    payload = data.copy()

    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)

    payload.update({"exp": expire})

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str):

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except:
        return None


# ---------------- USER ----------------

def get_or_create_user(email: str, db: Session):

    user = db.query(User).filter(User.email == email).first()

    if user:
        return user

    role = "admin" if email in ADMIN_EMAILS else "user"

    user = User(
        email=email,
        role=role
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user