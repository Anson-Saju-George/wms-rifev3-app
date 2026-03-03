import time
import torch
import gc

from model_engine import load_model

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
RUNS = 5
MODEL_IDS = [2, 1, 0]  # Test in reverse order to see if caching helps


def benchmark_model(model_id):
    print(f"\n===== MODEL {model_id} =====")
    times = []

    for i in range(RUNS):
        print(f"Run {i+1}/{RUNS}")

        if DEVICE == "cuda":
            torch.cuda.empty_cache()
        gc.collect()

        start = time.perf_counter()
        model = load_model(model_id, device=DEVICE)
        end = time.perf_counter()

        load_ms = (end - start) * 1000
        times.append(load_ms)

        print(f"Load time: {load_ms:.2f} ms")

        del model
        if DEVICE == "cuda":
            torch.cuda.empty_cache()
        gc.collect()

    print("---- Summary ----")
    print(f"Average: {sum(times)/len(times):.2f} ms")
    print(f"Min: {min(times):.2f} ms")
    print(f"Max: {max(times):.2f} ms")

    return times


def main():
    print("=== FULL MODEL LOAD BENCHMARK ===")
    print(f"Device: {DEVICE}")

    for mid in MODEL_IDS:
        benchmark_model(mid)


if __name__ == "__main__":
    main()