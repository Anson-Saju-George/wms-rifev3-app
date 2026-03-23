from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    role = Column(String, default="user")  # 'admin' or 'user'

    # Credit System
    # New users start with 5 total credits. 
    # When they buy more, credits_total increases.
    credits_total = Column(Integer, default=5)
    credits_used = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    model_id = Column(Integer)
    status = Column(String) # queued, processing, done, failed, failed_oom

    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Razorpay Details
    razorpay_order_id = Column(String, unique=True, index=True)
    razorpay_payment_id = Column(String, nullable=True)
    razorpay_signature = Column(String, nullable=True)
    
    amount = Column(Integer) # Amount in paise (e.g. 50000 for ₹500)
    credits_added = Column(Integer) # How many credits were bought in this tx
    status = Column(String, default="pending") # pending, completed, failed
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())