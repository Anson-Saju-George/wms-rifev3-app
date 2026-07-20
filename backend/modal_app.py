import os
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

import modal

app = modal.App("wms-rife")

weights_vol = modal.Volume.from_name("wms-rife-weights", create_if_missing=True)
progress_dict = modal.Dict.from_name("wms-rife-progress", create_if_missing=True)

LOCAL_BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = LOCAL_BACKEND_DIR.parent
WEIGHTS_DIR = "/weights"
BACKEND_DIR = "/root/backend"


def read_dotenv_value(name):
    for env_path in (REPO_ROOT / ".env", Path.cwd() / ".env"):
        if not env_path.is_file():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            if key.strip() == name:
                return value.strip().strip('"').strip("'")
    return None


def read_int_setting(name, default, minimum=1):
    raw_value = os.getenv(name)
    if raw_value is None or raw_value.strip() == "":
        raw_value = read_dotenv_value(name)
    if raw_value is None or raw_value.strip() == "":
        return default
    try:
        value = int(raw_value)
    except ValueError:
        print(f"Invalid {name}={raw_value!r}; using {default}.")
        return default
    if value < minimum:
        print(f"Invalid {name}={value}; using {default}. Minimum is {minimum}.")
        return default
    return value


MODAL_TIMEOUT_SECONDS = read_int_setting("MODAL_TIMEOUT_SECONDS", 3600, minimum=60)
MODEL_FOLDER_NAMES = {
    0: "train_log",
    1: "train_log_wms",
    2: "train_log_wms_custom_loss",
}


def ignore_backend_path(path):
    path = Path(path)
    parts = set(path.parts)

    if "__pycache__" in parts or path.suffix == ".pyc":
        return True
    if "storage" in parts or "samples" in parts or "temp" in parts:
        return True
    if "secrets" in parts or "env_files" in parts or ".cache" in parts:
        return True
    if path.name == ".env" or path.name == "app.db" or path.suffix in {".db", ".sqlite", ".sqlite3"}:
        return True
    if path.suffix in {".pkl", ".pt", ".pth", ".ckpt"}:
        return True

    in_train_log = any(part.startswith("train_log") for part in path.parts)
    if in_train_log and path.name.startswith("train_log"):
        return False
    if in_train_log and not path.is_dir() and path.suffix != ".py":
        return True

    return False


image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install(
        "torch==2.6.0",
        "torchvision==0.21.0",
        "numpy",
        "opencv-python-headless",
        "tqdm",
        "imageio",
        "imageio-ffmpeg",
    )
    .add_local_dir(
        str(LOCAL_BACKEND_DIR),
        BACKEND_DIR,
        copy=True,
        ignore=ignore_backend_path,
    )
)


def _candidate_weight_dirs(model_id):
    folder_name = MODEL_FOLDER_NAMES[model_id]
    candidates = [
        Path(WEIGHTS_DIR) / folder_name,
        Path(WEIGHTS_DIR) / "backend" / folder_name,
    ]
    if model_id == 0:
        candidates.append(Path(WEIGHTS_DIR))
    return candidates


def _resolve_weight_dir(model_id):
    for candidate in _candidate_weight_dirs(model_id):
        if (candidate / "flownet.pkl").is_file():
            return candidate
    checked = ", ".join(str(path) for path in _candidate_weight_dirs(model_id))
    raise FileNotFoundError(f"No flownet.pkl found for model_id={model_id}; checked: {checked}")


def _configure_model_paths():
    sys.path.insert(0, BACKEND_DIR)
    import model_engine

    model_engine.MODEL_DIRS = {
        model_id: str(_resolve_weight_dir(model_id))
        for model_id in MODEL_FOLDER_NAMES
    }
    return model_engine


def _merge_audio(original_video, silent_video, final_video):
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        silent_video,
        "-i",
        original_video,
        "-map",
        "0:v",
        "-map",
        "1:a?",
        "-c:v",
        "copy",
        "-c:a",
        "copy",
        "-shortest",
        final_video,
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        return final_video
    except Exception as exc:
        print(f"Audio merge failed; returning silent video: {exc}")
        return silent_video


@app.function(gpu="T4", image=image, volumes={WEIGHTS_DIR: weights_vol}, timeout=MODAL_TIMEOUT_SECONDS)
def interpolate(job_id: str, video_bytes: bytes, model_id: int, multiplier: int) -> bytes:
    progress_dict[job_id] = 0

    model_engine = _configure_model_paths()
    from core_engine import interpolate_video

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        input_path = tmpdir_path / "input.mp4"
        silent_output = tmpdir_path / "silent.mp4"
        final_output = tmpdir_path / "out.mp4"

        input_path.write_bytes(video_bytes)

        model = model_engine.load_model(model_id, device="cuda")
        interpolate_video(
            model,
            str(input_path),
            str(silent_output),
            multiplier,
            "cuda",
            progress_callback=lambda pct: progress_dict.__setitem__(job_id, int(pct)),
        )

        output_path = _merge_audio(str(input_path), str(silent_output), str(final_output))
        progress_dict[job_id] = 100
        return Path(output_path).read_bytes()


@app.local_entrypoint()
def main(input: str, model_id: int = 0, multiplier: int = 2):
    data = Path(input).read_bytes()
    output = interpolate.remote(f"local-test-{uuid.uuid4()}", data, model_id, multiplier)
    Path("out.mp4").write_bytes(output)
    print("wrote out.mp4")