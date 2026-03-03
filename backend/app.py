import os
import uuid
import shutil
import threading
import time

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

import torch
import cv2

from model_engine import load_model
from core_engine import interpolate_video, write_video


# ---------------- CONFIG ----------------

MAX_VIDEO_SECONDS = 30
MAX_WIDTH = 1920
MAX_HEIGHT = 1080
MAX_QUEUE = 10

AUTO_DELETE_AFTER = 600      # 10 minutes
IDLE_TIMEOUT = 120           # Offload model after 2 minutes idle

MIN_FREE_VRAM_MB = 2000
MAX_ALLOWED_VRAM_MB = 6500

SUPPORTED_MODELS = [0, 1, 2]

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

UPLOAD_DIR = "storage/uploads"
OUTPUT_DIR = "storage/outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app = FastAPI()

# ---------------- MODEL STORAGE ----------------

models = {}
model_loaded_time = {}
model_last_used = {}

def get_model(model_id):
    if model_id not in models:
        print(f"Loading model {model_id} to {DEVICE}")
        models[model_id] = load_model(model_id, device=DEVICE)
        model_loaded_time[model_id] = time.time()
    model_last_used[model_id] = time.time()
    return models[model_id]

def offload_idle_models():
    while True:
        now = time.time()
        for mid in list(models.keys()):
            if now - model_last_used.get(mid, 0) > IDLE_TIMEOUT:
                print(f"Offloading model {mid} (idle)")
                models[mid].flownet.cpu()
                torch.cuda.empty_cache()
                del models[mid]
        time.sleep(10)

threading.Thread(target=offload_idle_models, daemon=True).start()


# ---------------- GLOBAL STATE ----------------

job_queue = []
job_status = {}
job_progress = {}
job_model = {}
job_timestamps = {}

lock = threading.Lock()


# ---------------- GPU STATS ----------------

def gpu_stats():
    if DEVICE != "cuda":
        return None
    torch.cuda.synchronize()
    total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)
    allocated = torch.cuda.memory_allocated() / (1024 ** 2)
    free = total - allocated
    return total, allocated, free


# ---------------- VALIDATION ----------------

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
        raise ValueError("Video too long")

    if w > MAX_WIDTH or h > MAX_HEIGHT:
        raise ValueError("Resolution too high")


# ---------------- WORKER ----------------

def worker_loop():

    while True:

        with lock:
            if not job_queue:
                time.sleep(0.5)
                continue
            job_id = job_queue.pop(0)

        model_id = job_model[job_id]

        # GPU Guard
        if DEVICE == "cuda":
            total, allocated, free = gpu_stats()
            if free < MIN_FREE_VRAM_MB or allocated > MAX_ALLOWED_VRAM_MB:
                job_status[job_id] = "waiting_gpu"
                with lock:
                    job_queue.insert(0, job_id)
                time.sleep(1)
                continue

        job_status[job_id] = "processing"
        job_progress[job_id] = 0

        model = get_model(model_id)

        input_path = os.path.join(UPLOAD_DIR, f"{job_id}.mp4")
        output_path = os.path.join(OUTPUT_DIR, f"{job_id}.mp4")

        try:
            frames, fps = interpolate_video(model, input_path, 2, DEVICE)
            write_video(frames, output_path, fps * 2)

            job_progress[job_id] = 100
            job_status[job_id] = "done"

        except RuntimeError as e:
            if "CUDA out of memory" in str(e):
                torch.cuda.empty_cache()
                job_status[job_id] = "failed_oom"
            else:
                job_status[job_id] = "failed"

        except Exception:
            job_status[job_id] = "failed"

        job_timestamps[job_id] = time.time()

threading.Thread(target=worker_loop, daemon=True).start()


# ---------------- CLEANUP ----------------

def cleanup_loop():
    while True:
        now = time.time()
        for job_id in list(job_timestamps.keys()):
            if now - job_timestamps[job_id] > AUTO_DELETE_AFTER:

                ip = os.path.join(UPLOAD_DIR, f"{job_id}.mp4")
                op = os.path.join(OUTPUT_DIR, f"{job_id}.mp4")

                if os.path.exists(ip):
                    os.remove(ip)
                if os.path.exists(op):
                    os.remove(op)

                job_status.pop(job_id, None)
                job_progress.pop(job_id, None)
                job_model.pop(job_id, None)
                job_timestamps.pop(job_id, None)

        time.sleep(15)

threading.Thread(target=cleanup_loop, daemon=True).start()


# ---------------- ROUTES ----------------

@app.post("/upload")
async def upload(model_id: int, file: UploadFile = File(...)):

    if model_id not in SUPPORTED_MODELS:
        raise HTTPException(status_code=400, detail="Invalid model_id")

    if len(job_queue) >= MAX_QUEUE:
        raise HTTPException(status_code=429, detail="Queue full")

    job_id = str(uuid.uuid4())
    upload_path = os.path.join(UPLOAD_DIR, f"{job_id}.mp4")

    with open(upload_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        validate_video(upload_path)
    except Exception as e:
        os.remove(upload_path)
        raise HTTPException(status_code=400, detail=str(e))

    with lock:
        job_queue.append(job_id)

    job_status[job_id] = "queued"
    job_progress[job_id] = 0
    job_model[job_id] = model_id

    return {"job_id": job_id}


@app.get("/status/{job_id}")
def status(job_id: str):
    return {
        "status": job_status.get(job_id, "unknown"),
        "progress": job_progress.get(job_id, 0),
        "model_id": job_model.get(job_id)
    }


@app.get("/download/{job_id}")
def download(job_id: str):

    output_path = os.path.join(OUTPUT_DIR, f"{job_id}.mp4")

    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Not ready")

    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=f"{job_id}.mp4"
    )