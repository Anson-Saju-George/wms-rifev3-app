import os
import uuid
import shutil
import threading
import time
import subprocess
from urllib.parse import quote

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

import torch
import cv2
import razorpay

from sqlalchemy.orm import Session

from model_engine import load_model
from core_engine import interpolate_video

from database import get_db, engine, SessionLocal 
from models import Base, User, Job, Transaction 
from auth import verify_google_token, create_access_token, decode_token, get_or_create_user

Base.metadata.create_all(bind=engine)

# --------------------------------------------------
# CONFIG
# --------------------------------------------------

RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")

rz_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

MAX_VIDEO_SECONDS = 60 * 5 
MAX_WIDTH = 3840
MAX_HEIGHT = 2160
MAX_QUEUE = 10 
MAX_FILE_SIZE = 100 * 1024 * 1024 # 100 MB Limit

AUTO_PURGE_AFTER = 60 * 60 
IDLE_TIMEOUT = 60 * 20 

SUPPORTED_MODELS = [0,1,2]
SUPPORTED_MULTIPLIERS = [2,3,4]

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "storage/uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "storage/outputs")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

MAX_GPU_WORKERS = 3
MIN_FREE_VRAM_MB = 1200

# --------------------------------------------------
# FASTAPI
# --------------------------------------------------

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ansonsajugeorge.online",
        "https://www.ansonsajugeorge.online",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# --------------------------------------------------
# GLOBAL STATE
# --------------------------------------------------

models = {}
model_last_used = {}
job_queue = []
job_status = {}
job_progress = {}
job_model = {}
job_multiplier = {}
job_input_path = {}
job_timestamps = {}
job_original_name = {}

queue_lock = threading.Lock()
gpu_lock = threading.Lock()

active_gpu_jobs = 0
last_activity = time.time()

# --------------------------------------------------
# GPU STATS & UTILS
# --------------------------------------------------

def gpu_free_mb():
    if DEVICE != "cuda":
        return 99999
    torch.cuda.synchronize()
    total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)
    allocated = torch.cuda.memory_allocated() / (1024 ** 2)
    return total - allocated

def refund_credit(job_id):
    db = SessionLocal()
    try:
        job_record = db.query(Job).filter(Job.id == job_id).first()
        if job_record:
            user = db.query(User).filter(User.id == job_record.user_id).first()
            if user and user.role != "admin" and user.credits_used > 0:
                user.credits_used -= 1
                db.commit()
                print(f"Refunded credit to {user.email}")
    except Exception as e:
        print(f"Failed to refund credit: {e}")
    finally:
        db.close()

# --------------------------------------------------
# MODEL MANAGEMENT
# --------------------------------------------------

def get_model(model_id):
    global last_activity
    if model_id not in models:
        print(f"Loading model {model_id}")
        models[model_id] = load_model(model_id, device=DEVICE)
    model_last_used[model_id] = time.time()
    last_activity = time.time()
    return models[model_id]

def offload_idle_models():
    while True:
        time.sleep(15)
        if active_gpu_jobs != 0 or job_queue:
            continue
        now = time.time()
        for mid in list(models.keys()):
            if now - model_last_used.get(mid,0) > IDLE_TIMEOUT:
                print(f"Offloading model {mid}")
                try:
                    models[mid].flownet.cpu()
                except:
                    pass
                torch.cuda.empty_cache()
                del models[mid]

threading.Thread(target=offload_idle_models, daemon=True).start()

# --------------------------------------------------
# VALIDATION
# --------------------------------------------------

def validate_video(path):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("Invalid video file or unsupported codec.")
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    duration = frames / fps if fps > 0 else 0
    cap.release()
    if duration > MAX_VIDEO_SECONDS:
        raise ValueError(f"Video exceeds 5 minutes limit.")
    if w > MAX_WIDTH or h > MAX_HEIGHT:
        raise ValueError(f"Resolution exceeds 4K limit.")

# --------------------------------------------------
# WORKER
# --------------------------------------------------

def worker_loop(worker_id):
    global active_gpu_jobs
    global last_activity

    while True:
        with queue_lock:
            job_id = job_queue.pop(0) if job_queue else None

        if not job_id:
            time.sleep(0.5)
            continue

        while True:
            with gpu_lock:
                if active_gpu_jobs < MAX_GPU_WORKERS and gpu_free_mb() > MIN_FREE_VRAM_MB:
                    active_gpu_jobs += 1
                    break
            time.sleep(1)

        model_id = job_model[job_id]
        multiplier = job_multiplier[job_id]
        input_path = job_input_path[job_id]
        silent_output = os.path.join(OUTPUT_DIR, f"silent_{job_id}.mp4")
        final_output = os.path.join(OUTPUT_DIR, f"{job_id}.mp4")
        job_status[job_id] = "processing"

        try:
            print(f"[Worker {worker_id}] Starting job {job_id}")
            model = get_model(model_id)

            interpolate_video(
                model,
                input_path,
                silent_output,
                multiplier,
                DEVICE,
                progress_callback=lambda p: job_progress.__setitem__(job_id,p)
            )

            if not merge_audio(input_path, silent_output, final_output):
                shutil.copy(silent_output, final_output)
            
            if os.path.exists(silent_output):
                os.remove(silent_output)

            job_status[job_id] = "done"
            job_progress[job_id] = 100

        except RuntimeError as e:
            if "CUDA out of memory" in str(e):
                torch.cuda.empty_cache()
                job_status[job_id] = "failed_oom"
            else:
                job_status[job_id] = "failed"
            refund_credit(job_id)

        except Exception as e:
            job_status[job_id] = "failed"
            refund_credit(job_id)

        finally:
            with gpu_lock:
                active_gpu_jobs -= 1

        job_timestamps[job_id] = time.time()
        last_activity = time.time()

for i in range(MAX_GPU_WORKERS):
    threading.Thread(target=worker_loop, args=(i,), daemon=True).start()

# --------------------------------------------------
# AUDIO MERGE
# --------------------------------------------------

def merge_audio(original_video, silent_video, final_video):
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", silent_video,
            "-i", original_video,
            "-map", "0:v",
            "-map", "1:a?",
            "-c:v", "copy",
            "-c:a", "copy",
            "-shortest",
            final_video
        ]
        subprocess.run(cmd, check=True)
        return True
    except Exception as e:
        print("Audio merge failed:", e)
        return False


# --------------------------------------------------
# CLEANUP
# --------------------------------------------------

def purge_all():
    print("System idle. Purging storage.")
    for f in os.listdir(UPLOAD_DIR):
        try: os.remove(os.path.join(UPLOAD_DIR,f))
        except: pass
    for f in os.listdir(OUTPUT_DIR):
        try: os.remove(os.path.join(OUTPUT_DIR,f))
        except: pass
    job_status.clear()
    job_progress.clear()
    job_model.clear()
    job_multiplier.clear()
    job_input_path.clear()
    job_timestamps.clear()
    job_original_name.clear()

def cleanup_loop():
    global last_activity
    while True:
        time.sleep(30)
        now = time.time()
        if active_gpu_jobs == 0 and not job_queue:
            if now - last_activity > AUTO_PURGE_AFTER:
                purge_all()
                last_activity = time.time()

threading.Thread(target=cleanup_loop, daemon=True).start()

# --------------------------------------------------
# AUTH & USER
# --------------------------------------------------

@app.post("/auth/google")
def google_auth(token:str, db:Session=Depends(get_db)):
    user_info = verify_google_token(token)
    if not user_info:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    email = user_info["email"]
    user = get_or_create_user(email, db)
    access_token = create_access_token({
        "user_id": user.id,
        "email": user.email,
        "role": user.role
    })
    return {
        "access_token": access_token,
        "email": user.email,
        "role": user.role
    }

def get_current_user(
    authorization:str = Header(None),
    db:Session=Depends(get_db)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.replace("Bearer ","")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id==payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.get("/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "email": user.email,
        "role": user.role,
        "credits_total": user.credits_total,
        "credits_used": user.credits_used
    }

# --------------------------------------------------
# PAYMENTS
# --------------------------------------------------

@app.post("/payments/create-order")
def create_order(num_credits: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if num_credits < 1:
        raise HTTPException(status_code=400, detail="Minimum 1 credit required")

    PRICE_PER_CREDIT = 20 
    total_amount_in_paise = num_credits * PRICE_PER_CREDIT * 100
    
    order_data = {
        "amount": total_amount_in_paise,
        "currency": "INR",
        "payment_capture": 1
    }
    
    try:
        razorpay_order = rz_client.order.create(data=order_data)
        new_tx = Transaction(
            user_id=user.id,
            razorpay_order_id=razorpay_order['id'],
            amount=total_amount_in_paise,
            credits_added=num_credits,
            status="pending"
        )
        db.add(new_tx)
        db.commit()
        return razorpay_order
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/payments/verify")
def verify_payment(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        rz_client.utility.verify_payment_signature({
            'razorpay_order_id': data['razorpay_order_id'],
            'razorpay_payment_id': data['razorpay_payment_id'],
            'razorpay_signature': data['razorpay_signature']
        })
        tx = db.query(Transaction).filter(Transaction.razorpay_order_id == data['razorpay_order_id']).first()
        if tx and tx.status == "pending":
            tx.status = "completed"
            tx.razorpay_payment_id = data['razorpay_payment_id']
            tx.razorpay_signature = data['razorpay_signature']
            user.credits_total += tx.credits_added
            db.commit()
            return {"status": "success"}
        else:
            return {"status": "already_processed"}
    except Exception:
        raise HTTPException(status_code=400, detail="Payment verification failed")

# --------------------------------------------------
# ROUTES
# --------------------------------------------------

@app.post("/upload")
async def upload(
    model_id:int,
    multiplier:int=2,
    file:UploadFile=File(...),
    user:User=Depends(get_current_user),
    db:Session=Depends(get_db)
):
    global last_activity

    if user.role != "admin":
        if user.credits_used >= user.credits_total:
            raise HTTPException(status_code=402, detail="Insufficient credits. Please purchase more.")

    # 100MB SIZE CHECK
    file_size = 0
    try:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
    except:
        pass

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 100MB limit.")

    if model_id not in SUPPORTED_MODELS:
        raise HTTPException(status_code=400, detail="Invalid model")

    if multiplier not in SUPPORTED_MULTIPLIERS:
        raise HTTPException(status_code=400, detail="Invalid multiplier")

    with queue_lock:
        if len(job_queue) >= MAX_QUEUE:
            raise HTTPException(status_code=429, detail="Queue full")

    job_id = str(uuid.uuid4())
    original_name, ext = os.path.splitext(file.filename)
    job_original_name[job_id] = original_name
    upload_path = os.path.join(UPLOAD_DIR,f"{job_id}{ext}")

    with open(upload_path,"wb") as buffer:
        shutil.copyfileobj(file.file,buffer)

    try:
        validate_video(upload_path)
    except Exception as e:
        if os.path.exists(upload_path):
            os.remove(upload_path)
        print(f"!!! UPLOAD VALIDATION FAILED: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    if user.role != "admin":
        user.credits_used += 1
        db.commit()

    with queue_lock:
        job_queue.append(job_id)

    job_status[job_id] = "queued"
    job_progress[job_id] = 0
    job_model[job_id] = model_id
    job_multiplier[job_id] = multiplier
    job_input_path[job_id] = upload_path

    last_activity = time.time()

    job = Job(id=job_id, user_id=user.id, model_id=model_id, status="queued")
    db.add(job)
    db.commit()

    return {"job_id":job_id}

@app.get("/status/{job_id}")
def status(job_id:str):
    return {
        "status":job_status.get(job_id,"unknown"),
        "progress":job_progress.get(job_id,0),
        "model_id":job_model.get(job_id),
        "multiplier":job_multiplier.get(job_id)
    }

@app.get("/download/{job_id}")
def download(job_id:str, user:User=Depends(get_current_user), db:Session=Depends(get_db)):
    job = db.query(Job).filter(Job.id==job_id).first()
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    output_path = os.path.join(OUTPUT_DIR,f"{job_id}.mp4")
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Not ready")
    original = job_original_name.get(job_id, job_id)
    model = job_model.get(job_id, 0)
    multiplier = job_multiplier.get(job_id, 2)
    model_display = model + 1
    filename = quote(f"{original}_processed_m{model_display}_x{multiplier}.mp4")

    return FileResponse(
        output_path,
        media_type="video/mp4",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}"
        }
    )

@app.get("/system")
def system():
    return {
        "active_gpu_jobs": active_gpu_jobs,
        "queue_length": len(job_queue),
        "free_vram_mb": round(gpu_free_mb())
    }