import os

TRUE_VALUES = {"1", "true", "t", "yes", "y", "on"}

_USE_MODAL = os.getenv("INFERENCE_BACKEND_MODAL", "false").strip().lower() in TRUE_VALUES
_FALLBACK = os.getenv("FALLBACK_TO_LOCAL", "true").strip().lower() in TRUE_VALUES
_APP_NAME = os.getenv("MODAL_APP_NAME", "").strip() or "wms-rife"
_FUNCTION_NAME = os.getenv("MODAL_FUNCTION_NAME", "").strip() or "interpolate"
_PROGRESS_DICT_NAME = "wms-rife-progress"
_progress = None


def _load_modal():
    import modal

    return modal


def dispatch(job_id, input_path, model_id, multiplier):
    """Returns ('modal', call_id) or ('local', None)."""
    if _USE_MODAL:
        try:
            modal = _load_modal()
            fn = modal.Function.from_name(_APP_NAME, _FUNCTION_NAME)
            with open(input_path, "rb") as f:
                data = f.read()
            call = fn.spawn(job_id, data, model_id, multiplier)
            return ("modal", call.object_id)
        except Exception:
            if not _FALLBACK:
                raise

    return ("local", None)


def poll(call_id):
    """Returns ('running', None), ('done', mp4_bytes), or ('failed', reason)."""
    modal = _load_modal()
    fc = modal.FunctionCall.from_id(call_id)
    try:
        return ("done", fc.get(timeout=0))
    except Exception as exc:
        if isinstance(exc, TimeoutError) or exc.__class__.__name__ == "TimeoutError":
            return ("running", None)
        return ("failed", str(exc))


def get_progress(job_id):
    global _progress
    modal = _load_modal()
    if _progress is None:
        _progress = modal.Dict.from_name(_PROGRESS_DICT_NAME, create_if_missing=True)
    return _progress.get(job_id, 0)