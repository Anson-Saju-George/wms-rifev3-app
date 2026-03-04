from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)

    role = Column(String, default="user")  # admin / user

    trial_used = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"))

    model_id = Column(Integer)

    status = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())