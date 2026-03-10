"""
Minimal production-safe model loader for RIFE_HDv3 variants.

Supports:
    0 -> baseline (module. prefix fix)
    1 -> WMS finetuned
    2 -> WMS custom loss

Returns a loaded model with .flownet moved to device.
"""

import os
import torch
from train_log.RIFE_HDv3 import Model as RIFEModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_DIRS = {
    0: os.path.join(BASE_DIR, "train_log"),
    1: os.path.join(BASE_DIR, "train_log_wms"),
    2: os.path.join(BASE_DIR, "train_log_wms_custom_loss"),
}


def _strip_module_prefix(state_dict):
    return {
        k.replace("module.", "", 1) if k.startswith("module.") else k: v
        for k, v in state_dict.items()
    }


def load_model(model_id: int, device="cuda", strict=False):
    if model_id not in MODEL_DIRS:
        raise ValueError(f"Invalid model_id {model_id}")

    ckpt_path = os.path.join(MODEL_DIRS[model_id], "flownet.pkl")

    if not os.path.isfile(ckpt_path):
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    model = RIFEModel()
    model.eval()

    state_dict = torch.load(ckpt_path, map_location="cpu")

    if model_id == 0:
        state_dict = _strip_module_prefix(state_dict)

    model.flownet.load_state_dict(state_dict, strict=strict)

    if device == "cuda" and torch.cuda.is_available():
        model.flownet = model.flownet.cuda()

    return model