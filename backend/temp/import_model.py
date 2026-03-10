"""
Legacy-safe model loader for RIFE_HDv3 + IFNet_HDv3.

- Does NOT modify original train_log/RIFE_HDv3.py.
- Handles:
    model_id 0 -> baseline checkpoint with 'module.' prefixes
    model_id 1 -> WMS finetune (clean keys)
    model_id 2 -> WMS custom-loss (clean keys)
- Returns a Model() instance with .flownet on the selected device.
"""

import os
import torch

# We assume this file lives in the same folder as train_log/
THIS_DIR = os.path.dirname(os.path.abspath(__file__))

# Add THIS_DIR so "from train_log.RIFE_HDv3 import Model" works
import sys
if THIS_DIR not in sys.path:
    sys.path.append(THIS_DIR)

from train_log.RIFE_HDv3 import Model as RIFEModel  # OG class, untouched


# Map IDs to checkpoint directories
MODEL_DIRS = {
    0: os.path.join(THIS_DIR, "train_log"),                    # baseline
    1: os.path.join(THIS_DIR, "train_log_wms"),                # WMS finetune
    2: os.path.join(THIS_DIR, "train_log_wms_custom_loss"),    # WMS custom-loss
}


def _strip_module_prefix(state_dict: dict) -> dict:
    """
    Returns a new dict where a leading 'module.' is removed from keys.
    Used for model 0 where weights were saved via DataParallel.
    """
    out = {}
    for k, v in state_dict.items():
        if k.startswith("module."):
            out[k.replace("module.", "", 1)] = v
        else:
            out[k] = v
    return out


def load_rife_model(model_id: int,
                    device: str = "cuda",
                    strict: bool = False) -> RIFEModel:
    """
    Load a RIFE_HDv3 Model for a given model_id.

    - model_id 0: baseline (fixes 'module.' prefix)
    - model_id 1: WMS finetune
    - model_id 2: WMS custom-loss

    Returns:
        m: RIFEModel instance with .flownet on device.
    """
    if model_id not in MODEL_DIRS:
        raise ValueError(f"Unknown model_id {model_id}")

    model_dir = MODEL_DIRS[model_id]
    ckpt_path = os.path.join(model_dir, "flownet.pkl")

    if not os.path.isdir(model_dir):
        raise FileNotFoundError(f"Checkpoint dir not found: {model_dir}")
    if not os.path.isfile(ckpt_path):
        raise FileNotFoundError(f"Checkpoint file not found: {ckpt_path}")

    # Build model skeleton
    m = RIFEModel()
    m.eval()

    # Load checkpoint (always on CPU first)
    sd = torch.load(ckpt_path, map_location="cpu")

    # For model 0, fix 'module.' prefix. For others, keys already match.
    if model_id == 0:
        sd = _strip_module_prefix(sd)

    # Load with desired strictness; default False is safer with minor mismatches
    m.flownet.load_state_dict(sd, strict=strict)

    # Move to device
    if device == "cuda" and torch.cuda.is_available():
        m.flownet.cuda()
    return m


# Optional: little CLI to quickly test loading all 3 models
if __name__ == "__main__":
    for mid in [0, 1, 2]:
        try:
            print(f"\n=== Testing model_id {mid} ===")
            model = load_rife_model(mid, device="cpu", strict=False)
            print(f"Model {mid} loaded OK. #params:",
                  sum(p.numel() for p in model.flownet.parameters()))
        except Exception as e:
            print(f"Model {mid} FAILED -> {repr(e)}")
