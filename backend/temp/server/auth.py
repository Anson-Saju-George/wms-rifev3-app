from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt
from sqlalchemy.orm import Session
from .models import User
from .database import SessionLocal

SECRET = "super_secret_key"
ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"

def verify_google_token(token: str):
    idinfo = id_token.verify_oauth2_token(
        token,
        requests.Request(),
        GOOGLE_CLIENT_ID
    )
    return idinfo

def create_or_get_user(email, name):
    db: Session = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def create_jwt(user_id):
    return jwt.encode({"sub": str(user_id)}, SECRET, algorithm=ALGORITHM)