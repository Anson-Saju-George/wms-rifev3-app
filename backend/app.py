import os
import uuid
import shutil
import threading
import time

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

import torch
import cv2

from sqlalchemy.orm import Session

from model_engine import load_model
from core_engine import interpolate_video

from database import get_db, engine
from models import Base, User, Job
from auth import verify_google_token, create_access_token, decode_token, get_or_create_user

Base.metadata.create_all(bind=engine)

# --------------------------------------------------
# CONFIG
# --------------------------------------------------

MAX_VIDEO_SECONDS = 60 * 10 # 10 minutes length limit
MAX_WIDTH = 1920
MAX_HEIGHT = 1080

MAX_QUEUE = 10

AUTO_PURGE_AFTER = 60 * 60  # Purge after 1 hr of inactivity
IDLE_TIMEOUT = 60 * 20 # Offload models after 20 mins of inactivity

SUPPORTED_MODELS = [0,1,2]
SUPPORTED_MULTIPLIERS = [2,3,4]

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_DIR = os.path.join(BASE_DIR, "storage/uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "storage/outputs")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

MAX_GPU_WORKERS = 2
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

# NEW
job_original_name = {}

queue_lock = threading.Lock()
gpu_lock = threading.Lock()

active_gpu_jobs = 0
last_activity = time.time()

# --------------------------------------------------
# GPU STATS
# --------------------------------------------------

def gpu_free_mb():

    if DEVICE != "cuda":
        return 99999

    torch.cuda.synchronize()

    total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)
    allocated = torch.cuda.memory_allocated() / (1024 ** 2)

    return total - allocated

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
        raise ValueError("Invalid video")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)

    w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)

    duration = frames / fps if fps > 0 else 0

    cap.release()

    if duration > MAX_VIDEO_SECONDS:
        raise ValueError("Video exceeds 10 minutes")

    if w > MAX_WIDTH or h > MAX_HEIGHT:
        raise ValueError("Resolution too high")

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

        output_path = os.path.join(OUTPUT_DIR, f"{job_id}.mp4")

        job_status[job_id] = "processing"

        try:

            print(f"[Worker {worker_id}] Starting job {job_id}")

            model = get_model(model_id)

            interpolate_video(
                model,
                input_path,
                output_path,
                multiplier,
                DEVICE,
                progress_callback=lambda p: job_progress.__setitem__(job_id,p)
            )

            job_status[job_id] = "done"
            job_progress[job_id] = 100

        except RuntimeError as e:

            if "CUDA out of memory" in str(e):

                torch.cuda.empty_cache()
                job_status[job_id] = "failed_oom"

            else:

                print("Runtime error:", e)
                job_status[job_id] = "failed"

        except Exception as e:

            print("Job failed:", e)
            job_status[job_id] = "failed"

        finally:

            with gpu_lock:
                active_gpu_jobs -= 1

        job_timestamps[job_id] = time.time()
        last_activity = time.time()

for i in range(MAX_GPU_WORKERS):
    threading.Thread(target=worker_loop, args=(i,), daemon=True).start()

# --------------------------------------------------
# CLEANUP
# --------------------------------------------------

def purge_all():

    print("System idle. Purging storage.")

    for f in os.listdir(UPLOAD_DIR):
        os.remove(os.path.join(UPLOAD_DIR,f))

    for f in os.listdir(OUTPUT_DIR):
        os.remove(os.path.join(OUTPUT_DIR,f))

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
# AUTH
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
        os.remove(upload_path)
        raise HTTPException(status_code=400, detail=str(e))

    with queue_lock:
        job_queue.append(job_id)

    job_status[job_id] = "queued"
    job_progress[job_id] = 0
    job_model[job_id] = model_id
    job_multiplier[job_id] = multiplier
    job_input_path[job_id] = upload_path

    last_activity = time.time()

    job = Job(
        id=job_id,
        user_id=user.id,
        model_id=model_id,
        status="queued"
    )

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
def download(
    job_id:str,
    user:User=Depends(get_current_user),
    db:Session=Depends(get_db)
):

    job = db.query(Job).filter(Job.id==job_id).first()

    if not job or job.user_id != user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    output_path = os.path.join(OUTPUT_DIR,f"{job_id}.mp4")

    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Not ready")

    original = job_original_name.get(job_id, job_id)

    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=f"{original}_processed.mp4"
    )