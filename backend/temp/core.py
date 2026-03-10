import os
import time
import json
import csv
from datetime import datetime
from typing import Dict, Any, List

import cv2
import torch
import numpy as np
from torch.nn import functional as F

from import_model import load_rife_model

THIS_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_CONFIG = {
    "models": [0, 1, 2],
    "mid_factors": [2],
    "frames_root": os.path.join(THIS_DIR, "samples", "input_frames"),
    "videos_root": os.path.join(THIS_DIR, "samples", "input_videos"),
    "output_root": os.path.join(THIS_DIR, "output_tests_vram"),
    "repeat_runs": 1,
}

# ---------------- GPU ----------------

def reset_gpu_peak():
    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()

def get_gpu_peak_mb():
    if not torch.cuda.is_available():
        return 0.0
    torch.cuda.synchronize()
    return torch.cuda.max_memory_allocated() / (1024 ** 2)

# ---------------- IO ----------------

def list_frame_dirs(root):
    if not os.path.isdir(root):
        return []
    return [
        os.path.join(root, d)
        for d in sorted(os.listdir(root))
        if os.path.isdir(os.path.join(root, d))
    ]

def list_videos(root):
    if not os.path.isdir(root):
        return []
    return [
        os.path.join(root, f)
        for f in sorted(os.listdir(root))
        if f.lower().endswith((".mp4", ".avi", ".mov", ".mkv"))
    ]

def _to_tensor(img, device):
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    t = torch.from_numpy(img).permute(2, 0, 1).float() / 255.0
    t = t.unsqueeze(0)
    if device == "cuda":
        t = t.cuda(non_blocking=True)
    return t

def _from_tensor(t):
    t = t.clamp(0, 1).cpu()[0]
    img = (t.numpy() * 255).astype(np.uint8)
    img = np.transpose(img, (1, 2, 0))
    return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

def pad32(t):
    n, c, h, w = t.shape
    ph = ((h - 1) // 32 + 1) * 32
    pw = ((w - 1) // 32 + 1) * 32
    pad = (0, pw - w, 0, ph - h)
    return F.pad(t, pad), (h, w)

# ---------------- INTERPOLATION ----------------

def interpolate_pair(model, img0, img1, times, device):
    I0 = _to_tensor(img0, device)
    I1 = _to_tensor(img1, device)

    I0, orig = pad32(I0)
    I1, _ = pad32(I1)

    def recurse(a, b, n):
        with torch.no_grad():
            mid = model.inference(a, b)
        if n == 1:
            return [mid]
        left = recurse(a, mid, n // 2)
        right = recurse(mid, b, n // 2)
        return left + right if n % 2 == 0 else left + [mid] + right

    mids = recurse(I0, I1, times - 1) if times > 1 else []

    h, w = orig
    out = []
    for m in mids:
        m = m[:, :, :h, :w]
        out.append(_from_tensor(m))

    return out

def interpolate_frames_dir(model, folder, times, device):
    files = sorted([
        f for f in os.listdir(folder)
        if f.lower().endswith((".png", ".jpg", ".jpeg"))
    ])

    imgs = [cv2.imread(os.path.join(folder, f)) for f in files]
    imgs = [i for i in imgs if i is not None]

    if len(imgs) < 2:
        return imgs

    out = []
    for i in range(len(imgs) - 1):
        out.append(imgs[i])
        mids = interpolate_pair(model, imgs[i], imgs[i+1], times, device)
        out.extend(mids)
    out.append(imgs[-1])
    return out

def interpolate_video(model, video_path, times, device):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0

    frames = []
    while True:
        ret, f = cap.read()
        if not ret:
            break
        frames.append(f)
    cap.release()

    if len(frames) < 2:
        return frames, fps

    out = []
    for i in range(len(frames) - 1):
        out.append(frames[i])
        mids = interpolate_pair(model, frames[i], frames[i+1], times, device)
        out.extend(mids)
    out.append(frames[-1])

    return out, fps

def write_video(frames, path, fps):
    if not frames:
        return
    h, w, _ = frames[0].shape
    os.makedirs(os.path.dirname(path), exist_ok=True)
    writer = cv2.VideoWriter(
        path,
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (w, h),
    )
    for f in frames:
        writer.write(f)
    writer.release()

# ---------------- RUNNER ----------------

def run_test(cfg: Dict[str, Any]):

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    test_root = os.path.join(cfg["output_root"], f"test_{ts}")
    os.makedirs(test_root, exist_ok=True)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    frame_dirs = list_frame_dirs(cfg["frames_root"])
    video_files = list_videos(cfg["videos_root"])

    results = []

    for model_id in cfg["models"]:
        print(f"\n[LOAD] Model {model_id}")
        model = load_rife_model(model_id, device=device, strict=False)

        for mid in cfg["mid_factors"]:
            # ---- Frames ----
            for folder in frame_dirs:
                for r in range(cfg["repeat_runs"]):
                    tag = f"model{model_id}_frames_{os.path.basename(folder)}_x{mid}_rep{r}"
                    print(f"[RUN] {tag}")

                    reset_gpu_peak()
                    t0 = time.time()

                    out_frames = interpolate_frames_dir(model, folder, mid, device)

                    duration = time.time() - t0
                    peak = get_gpu_peak_mb()

                    out_path = os.path.join(test_root, f"{tag}.mp4")
                    write_video(out_frames, out_path, fps=25 * mid)

                    results.append({
                        "tag": tag,
                        "type": "frames",
                        "model": model_id,
                        "mid_factor": mid,
                        "duration_sec": duration,
                        "peak_vram_mb": peak,
                        "output": out_path
                    })

            # ---- Videos ----
            for video in video_files:
                for r in range(cfg["repeat_runs"]):
                    tag = f"model{model_id}_video_{os.path.basename(video)}_x{mid}_rep{r}"
                    print(f"[RUN] {tag}")

                    reset_gpu_peak()
                    t0 = time.time()

                    out_frames, fps = interpolate_video(model, video, mid, device)

                    duration = time.time() - t0
                    peak = get_gpu_peak_mb()

                    out_path = os.path.join(test_root, f"{tag}.mp4")
                    write_video(out_frames, out_path, fps * mid)

                    results.append({
                        "tag": tag,
                        "type": "video",
                        "model": model_id,
                        "mid_factor": mid,
                        "duration_sec": duration,
                        "peak_vram_mb": peak,
                        "output": out_path
                    })

    # Save results
    with open(os.path.join(test_root, "results.json"), "w") as f:
        json.dump(results, f, indent=4)

    with open(os.path.join(test_root, "results.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    print(f"\n✅ Done. Outputs + logs saved to:\n{test_root}")