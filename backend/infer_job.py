import argparse
import os
import sys
import traceback

from model_engine import load_model
from core_engine import interpolate_video


def write_progress(progress_file, percent):
    os.makedirs(os.path.dirname(os.path.abspath(progress_file)), exist_ok=True)
    tmp_path = f"{progress_file}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(str(int(percent)))
    os.replace(tmp_path, progress_file)


def parse_args():
    parser = argparse.ArgumentParser(description="Run one WMS interpolation job in an isolated process.")
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--model-id", required=True, type=int)
    parser.add_argument("--multiplier", required=True, type=int)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--device", required=True)
    parser.add_argument("--progress-file", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    try:
        write_progress(args.progress_file, 0)
        model = load_model(args.model_id, device=args.device)
        interpolate_video(
            model,
            args.input,
            args.output,
            args.multiplier,
            args.device,
            progress_callback=lambda p: write_progress(args.progress_file, p),
        )
        write_progress(args.progress_file, 100)
        return 0
    except RuntimeError as exc:
        if "CUDA out of memory" in str(exc) or "out of memory" in str(exc).lower():
            print("CUDA_OOM", file=sys.stderr)
            return 42
        traceback.print_exc(file=sys.stderr)
        return 1
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())