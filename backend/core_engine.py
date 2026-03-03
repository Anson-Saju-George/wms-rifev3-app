"""
Minimal interpolation engine for video frame interpolation.
No benchmarking. No CSV logging. No experiment logic.
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


# ---------------- Interpolation ----------------

def interpolate_pair(model, img0, img1, times, device):
    """
    Generates intermediate frames between two images.
    Supports recursive multi-step interpolation.
    """

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


def interpolate_video(model, video_path, times, device):
    """
    Interpolates full video.
    Returns interpolated frames and original fps.
    """

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise ValueError("Failed to open video")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0

    frames = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)

    cap.release()

    if len(frames) < 2:
        return frames, fps

    output = []

    for i in range(len(frames) - 1):
        output.append(frames[i])
        mids = interpolate_pair(model, frames[i], frames[i + 1], times, device)
        output.extend(mids)

    output.append(frames[-1])

    return output, fps


def write_video(frames, path, fps):
    if not frames:
        raise ValueError("No frames to write")

    os.makedirs(os.path.dirname(path), exist_ok=True)

    h, w, _ = frames[0].shape

    writer = cv2.VideoWriter(
        path,
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (w, h),
    )

    for frame in frames:
        writer.write(frame)

    writer.release()