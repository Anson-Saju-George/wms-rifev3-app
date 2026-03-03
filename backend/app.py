from datetime import time
import os
import uuid
import shutil
import threading
from fastapi import FastAPI, UploadFile, File, HTTPException, FileResponse
import torch
import cv2

from model_engine import load_model
from core_engine import interpolate_video, write_video

# ---------------- CONFIG ----------------

MAX_VIDEO_SECONDS = 30
MAX_WIDTH = 1920
MAX_HEIGHT = 1080
MAX_QUEUE = 3
MODEL_ID = 2

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

UPLOAD_DIR = "storage/uploads"
OUTPUT_DIR = "storage/outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---------------- GLOBAL STATE ----------------

app = FastAPI()

model = load_model(MODEL_ID, device=DEVICE)
print("Model loaded.")

job_queue = []
job_status = {}
lock = threading.Lock()

# ---------------- VIDEO VALIDATION ----------------

def validate_video(path):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("Invalid video file")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)

    duration = frame_count / fps if fps > 0 else 0

    cap.release()

    if duration > MAX_VIDEO_SECONDS:
        raise ValueError("Video too long")

    if width > MAX_WIDTH or height > MAX_HEIGHT:
        raise ValueError("Resolution too high")

# ---------------- WORKER ----------------

def worker_loop():
    while True:
        if not job_queue:
            time.sleep(0.2)
            continue

        with lock:
            job_id = job_queue.pop(0)

        job_status[job_id] = "processing"

        input_path = os.path.join(UPLOAD_DIR, f"{job_id}.mp4")
        output_path = os.path.join(OUTPUT_DIR, f"{job_id}.mp4")

        try:
            frames, fps = interpolate_video(model, input_path, 2, DEVICE)
            write_video(frames, output_path, fps * 2)
            job_status[job_id] = "done"

        except RuntimeError as e:
            if "CUDA out of memory" in str(e):
                torch.cuda.empty_cache()
                job_status[job_id] = "failed_oom"
            else:
                job_status[job_id] = "failed"

        except Exception:
            job_status[job_id] = "failed"

# Start worker thread
threading.Thread(target=worker_loop, daemon=True).start()

# ---------------- ROUTES ----------------

@app.post("/upload")
async def upload(file: UploadFile = File(...)):

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

    return {"job_id": job_id}

@app.get("/status/{job_id}")
def status(job_id: str):
    return {"status": job_status.get(job_id, "unknown")}

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