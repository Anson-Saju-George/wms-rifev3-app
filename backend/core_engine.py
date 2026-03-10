"""
Streaming interpolation engine for video frame interpolation.
Memory efficient and supports progress callbacks.
"""

import os
import cv2
import torch
import numpy as np
from torch.nn import functional as F


# ---------------- GPU ----------------

def reset_gpu_peak():
    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()


def get_gpu_peak_mb():
    if not torch.cuda.is_available():
        return 0.0
    torch.cuda.synchronize()
    return torch.cuda.max_memory_allocated() / (1024 ** 2)


# ---------------- Tensor Helpers ----------------

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


# ---------------- Frame Interpolation ----------------

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


# ---------------- Streaming Video Interpolation ----------------

def interpolate_video(
    model,
    input_path,
    output_path,
    multiplier,
    device,
    progress_callback=None
):
    """
    Memory-efficient video interpolation.
    Processes frame-by-frame and writes directly to disk.
    """

    cap = cv2.VideoCapture(input_path)

    if not cap.isOpened():
        raise ValueError("Failed to open video")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    ret, prev = cap.read()

    if not ret:
        raise ValueError("Video has no frames")

    h, w, _ = prev.shape

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    writer = cv2.VideoWriter(
        output_path,
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps * multiplier,
        (w, h),
    )

    processed = 0

    while True:

        ret, frame = cap.read()

        if not ret:
            break

        writer.write(prev)

        mids = interpolate_pair(
            model,
            prev,
            frame,
            multiplier,
            device
        )

        for m in mids:
            writer.write(m)

        prev = frame

        processed += 1

        if progress_callback and total_frames > 0:
            progress = int((processed / total_frames) * 100)
            progress_callback(progress)

    writer.write(prev)

    writer.release()
    cap.release()

    if progress_callback:
        progress_callback(100)