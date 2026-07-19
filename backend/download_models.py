"""Download WMS RIFE model folders from Hugging Face when absent.

The Docker image intentionally excludes backend/train_log* so model weights are not
baked into the image. This script restores the expected folder layout under backend/.
"""

import os
import sys
from pathlib import Path

DEFAULT_REPO_ID = "Anson-Saju-George/wms-rifev3-models-all-3"
DEFAULT_REVISION = "main"

MODEL_FOLDERS = (
    "train_log",
    "train_log_wms",
    "train_log_wms_custom_loss",
)

REQUIRED_FILES = (
    "train_log/flownet.pkl",
    "train_log/RIFE_HDv3.py",
    "train_log/IFNet_HDv3.py",
    "train_log_wms/flownet.pkl",
    "train_log_wms_custom_loss/flownet.pkl",
)

ALLOW_PATTERNS = tuple(f"{folder}/**" for folder in MODEL_FOLDERS)


def missing_required_files(base_dir: Path):
    missing = []
    for rel_path in REQUIRED_FILES:
        path = base_dir / rel_path
        if not path.is_file() or path.stat().st_size == 0:
            missing.append(rel_path)
    return missing


def main():
    base_dir = Path(__file__).resolve().parent
    missing = missing_required_files(base_dir)
    if not missing:
        print("WMS RIFE model folders already present; skipping Hugging Face download.")
        return 0

    repo_id = os.environ.get("MODEL_REPO_ID", DEFAULT_REPO_ID).strip() or DEFAULT_REPO_ID
    revision = os.environ.get("MODEL_REVISION", DEFAULT_REVISION).strip() or DEFAULT_REVISION

    print(f"Missing WMS RIFE model files: {', '.join(missing)}")
    print(f"Downloading model folders from Hugging Face repo {repo_id}@{revision} into {base_dir}")

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print(
            "huggingface_hub is required for runtime model download. "
            "Install it in the image or restore backend/train_log* manually.",
            file=sys.stderr,
        )
        return 1

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    kwargs = {
        "repo_id": repo_id,
        "repo_type": "model",
        "revision": revision,
        "local_dir": str(base_dir),
        "allow_patterns": ALLOW_PATTERNS,
    }
    if token:
        kwargs["token"] = token

    snapshot_download(**kwargs)

    missing = missing_required_files(base_dir)
    if missing:
        print(
            "Model download finished but required files are still missing: "
            + ", ".join(missing),
            file=sys.stderr,
        )
        return 1

    print("WMS RIFE model folders are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())