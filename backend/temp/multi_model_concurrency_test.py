import requests
import threading
import time
import os
import sys

SERVER = "http://127.0.0.1:8000"
VIDEO = "backend/samples/video_1.mp4"

MODELS = [0, 1, 2]
UPLOADS_PER_MODEL = 3   # total jobs = 9
STATUS_INTERVAL = 5     # seconds
GLOBAL_TIMEOUT = 600    # 10 min

job_ids = []
job_lock = threading.Lock()


def log(msg):
    print(msg)
    sys.stdout.flush()


def upload_job(model_id, index):
    log(f"[UPLOAD START] Model {model_id} | Job #{index}")

    try:
        with open(VIDEO, "rb") as f:
            files = {"file": f}
            response = requests.post(
                f"{SERVER}/upload",
                params={"model_id": model_id},
                files=files,
                timeout=60
            )

        log(f"[UPLOAD RESPONSE] Model {model_id} | Status: {response.status_code}")

        if response.status_code == 200:
            job_id = response.json()["job_id"]
            log(f"[UPLOAD SUCCESS] Model {model_id} → {job_id}")

            with job_lock:
                job_ids.append(job_id)
        else:
            log(f"[UPLOAD FAILED] {response.text}")

    except Exception as e:
        log(f"[UPLOAD ERROR] {e}")


def monitor_jobs():

    start_time = time.time()

    while True:

        with job_lock:
            current_jobs = list(job_ids)

        if not current_jobs:
            log("[MONITOR] No jobs registered yet...")
            time.sleep(1)
            continue

        all_done = True

        for job_id in current_jobs:

            try:
                r = requests.get(
                    f"{SERVER}/status/{job_id}",
                    timeout=10
                )

                if r.status_code != 200:
                    log(f"[STATUS ERROR] {job_id} → {r.text}")
                    continue

                data = r.json()
                log(f"[STATUS] {job_id} → {data}")

                status = data.get("status")

                if status == "done":
                    download(job_id)

                elif status.startswith("failed"):
                    log(f"[FAILED] {job_id} → {status}")

                else:
                    all_done = False

            except Exception as e:
                log(f"[STATUS EXCEPTION] {job_id} → {e}")

        if all_done:
            log("\n🎯 ALL JOBS FINISHED")
            break

        if time.time() - start_time > GLOBAL_TIMEOUT:
            log("\n⛔ GLOBAL TIMEOUT REACHED")
            break

        time.sleep(STATUS_INTERVAL)


def download(job_id):
    try:
        r = requests.get(
            f"{SERVER}/download/{job_id}",
            timeout=60
        )

        if r.status_code == 200:
            filename = f"download_{job_id}.mp4"
            with open(filename, "wb") as f:
                f.write(r.content)
            log(f"[DOWNLOADED] {job_id}")
        else:
            log(f"[DOWNLOAD FAILED] {job_id} → {r.text}")

    except Exception as e:
        log(f"[DOWNLOAD ERROR] {job_id} → {e}")


def main():

    if not os.path.exists(VIDEO):
        log(f"❌ Video not found: {VIDEO}")
        return

    log("\n=== MULTI-MODEL CONCURRENCY TEST START ===\n")

    threads = []

    for model_id in MODELS:
        for i in range(UPLOADS_PER_MODEL):
            t = threading.Thread(
                target=upload_job,
                args=(model_id, i)
            )
            t.start()
            threads.append(t)

    for t in threads:
        t.join()

    log(f"\n[INFO] Total Jobs Submitted: {len(job_ids)}\n")

    monitor_jobs()

    log("\n=== TEST COMPLETE ===\n")


if __name__ == "__main__":
    main()