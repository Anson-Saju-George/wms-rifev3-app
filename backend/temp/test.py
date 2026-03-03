import os
import time
import torch

from model_engine import load_model
from core_engine import (
    interpolate_video,
    write_video,
    reset_gpu_peak,
    get_gpu_peak_mb,
)

# -------- CONFIG --------

MODEL_ID = 1          # 0, 1, or 2
FACTOR = 2            # 2x, 4x, 8x
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

INPUT_VIDEO = "samples/video_1.mp4"   # put test video in same folder
OUTPUT_VIDEO = "storage/output_test.mp4"

# ------------------------

def main():
    print("=== VFI ENGINE TEST ===")
    print(f"Device: {DEVICE}")
    print(f"Loading model {MODEL_ID}...")

    t0 = time.time()
    model = load_model(MODEL_ID, device=DEVICE)
    print(f"Model loaded in {time.time() - t0:.2f}s")

    print("Starting interpolation...")
    reset_gpu_peak()
    t1 = time.time()

    frames, fps = interpolate_video(
        model=model,
        video_path=INPUT_VIDEO,
        times=FACTOR,
        device=DEVICE,
    )

    duration = time.time() - t1
    peak_vram = get_gpu_peak_mb()

    print(f"Interpolation done in {duration:.2f}s")
    print(f"Peak VRAM usage: {peak_vram:.2f} MB")

    print("Writing output...")
    write_video(frames, OUTPUT_VIDEO, fps * FACTOR)

    print("Done.")
    print(f"Output saved to: {OUTPUT_VIDEO}")


if __name__ == "__main__":
    main()