#!/usr/bin/env python3
"""
precompute_predictions.py — Run U-Net inference locally for every GeoTIFF
in backend/data/ and write the results to backend/static/predictions/.

Each output file is a JSON document with the exact same structure that the
/predict endpoint returns to the frontend:

    {
        "success": true,
        "image":   "<base64 RGBA PNG>",
        "bounds":  [[south, west], [north, east]],
        "region":  "souss_massa",
        "date":    "2024-01",
        "class_distribution": {"0": 0.12, "1": 0.34, "2": 0.34, "3": 0.20}
    }

Usage (run from the backend/ directory):
    cd backend
    python scripts/precompute_predictions.py

Output (one file per TIF):
    backend/static/predictions/souss_massa_2024-01.json
    backend/static/predictions/souss_massa_2024-05.json
    ...

After running this script:
1. Commit the generated .json files to the repository.
2. Set ENVIRONMENT=production on Render.
3. Render will serve the precomputed files instantly — no TensorFlow at runtime.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import sys
import time
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from PIL import Image

# ── Path setup ─────────────────────────────────────────────────────────────────
# Script is at  backend/scripts/precompute_predictions.py
# backend/ must be on sys.path so we can import pipeline.py.

SCRIPT_DIR  = Path(__file__).resolve().parent   # backend/scripts/
BACKEND_DIR = SCRIPT_DIR.parent                 # backend/

sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)           # relative paths in rasterio resolve against CWD

load_dotenv(BACKEND_DIR / ".env")

from pipeline import ProcessedRaster, process_geotiff   # noqa: E402

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("precompute")

# ── Paths ──────────────────────────────────────────────────────────────────────

MODEL_PATH = BACKEND_DIR / "models" / "model_unet_souss_massa.keras"
DATA_DIR   = BACKEND_DIR / "data"
OUTPUT_DIR = BACKEND_DIR / "static" / "predictions"

# ── Colour table — must match main.py _CLASS_RGBA exactly ─────────────────────
#   Class 0 — Sain / Irrigué   → #2ecc71  (emerald green)
#   Class 1 — Stress Léger     → #3498db  (sky blue)
#   Class 2 — Stress Modéré    → #f39c12  (amber)
#   Class 3 — Stress Critique  → #960000  (deep crimson)

_CLASS_RGBA: np.ndarray = np.array(
    [
        [0x2E, 0xCC, 0x71, 0xFF],
        [0x34, 0x98, 0xDB, 0xFF],
        [0xF3, 0x9C, 0x12, 0xFF],
        [0x96, 0x00, 0x00, 0xFF],
    ],
    dtype=np.uint8,
)
N_CLASSES = len(_CLASS_RGBA)


# ── Helpers (mirrors the private functions in main.py) ─────────────────────────

def _reconstruct_prediction_map(
    patch_classes: np.ndarray,
    raster: ProcessedRaster,
) -> np.ndarray:
    """
    Stitch per-patch class predictions back into the full spatial grid.
    Pixels outside the study boundary are set to −1 (transparent in the PNG).
    """
    patch_size = patch_classes.shape[1]

    padded_map = np.full(
        (raster.padded_height, raster.padded_width),
        fill_value=-1,
        dtype=np.int8,
    )
    for idx, (r0, c0) in enumerate(raster.patch_positions):
        padded_map[r0 : r0 + patch_size, c0 : c0 + patch_size] = patch_classes[idx]

    result = padded_map[: raster.original_height, : raster.original_width]
    result[raster.outer_nan_mask] = -1
    return result


def _render_transparent_png(pred_map: np.ndarray) -> str:
    """
    Convert an integer class map (values −1…3) to a transparent RGBA PNG
    and return it as a base64-encoded UTF-8 string.
    Class −1 → fully transparent (A = 0).
    """
    h, w = pred_map.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    for cls_idx in range(N_CLASSES):
        mask = pred_map == cls_idx
        if mask.any():
            rgba[mask] = _CLASS_RGBA[cls_idx]

    pil_img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG", optimize=False)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


# ── Model loader ───────────────────────────────────────────────────────────────

def _load_model():
    """
    Load the Keras U-Net model using the same import ladder as main.py lifespan.
    Tries standalone Keras 3.x first, then TensorFlow 2.x bundled keras.
    """
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}\n"
            "Place model_unet_souss_massa.keras inside backend/models/."
        )

    logger.info("Loading model: %s", MODEL_PATH)

    try:
        import keras
        model = keras.saving.load_model(str(MODEL_PATH), compile=False)
        logger.info("Loaded via keras.saving.load_model")
    except (ImportError, AttributeError):
        try:
            import tensorflow as tf
            model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
            logger.info("Loaded via tf.keras.models.load_model")
        except Exception as exc:
            raise RuntimeError(
                f"Failed to load model — install tensorflow or keras.\nError: {exc}"
            ) from exc

    logger.info(
        "Model ready — input: %s | output: %s",
        model.input_shape,
        model.output_shape,
    )
    return model


# ── Per-file prediction ────────────────────────────────────────────────────────

def precompute_one(model, tif_path: Path) -> dict:
    """
    Run the full prediction pipeline for a single GeoTIFF and return the
    JSON-serialisable payload (identical structure to the /predict response).

    File naming convention: <region>_<YYYY-MM>.tif
    Example: souss_massa_2024-01.tif → region=souss_massa, date=2024-01
    """
    # Parse region and date from the filename.
    # The date is always the last token after the final underscore (YYYY-MM).
    stem = tif_path.stem                        # "souss_massa_2024-01"
    region, date = stem.rsplit("_", 1)          # "souss_massa", "2024-01"

    logger.info("─── %s  (region=%s  date=%s) ───", tif_path.name, region, date)

    # 1. Preprocess GeoTIFF → normalised patch stack
    raster = process_geotiff(str(tif_path))
    logger.info(
        "Preprocessing OK — %d valid patches | %d×%d px",
        len(raster.patch_positions), raster.original_height, raster.original_width,
    )

    # 2. Batch U-Net inference
    logits = model.predict(raster.patch_stack, batch_size=32, verbose=0)
    patch_classes = np.argmax(logits, axis=-1).astype(np.int8)
    logger.info(
        "Inference OK — shape=%s | classes=%s",
        patch_classes.shape, np.unique(patch_classes).tolist(),
    )

    # 3. Reconstruct full spatial class map
    pred_map = _reconstruct_prediction_map(patch_classes, raster)

    # 4. Per-class pixel distribution (only over valid / non-−1 pixels)
    valid_pixels = pred_map[pred_map >= 0]
    n_valid = max(int(valid_pixels.size), 1)
    class_distribution = {
        str(c): round(float((valid_pixels == c).sum()) / n_valid, 6)
        for c in range(N_CLASSES)
    }
    logger.info("Class distribution: %s", class_distribution)

    # 5. Render RGBA PNG → base64 string
    b64_image = _render_transparent_png(pred_map)
    logger.info("PNG rendered — base64 length: %d chars", len(b64_image))

    # 6. Build Leaflet-compatible bounding box [[south,west],[north,east]]
    leaflet_bounds = [
        [raster.bounds.bottom, raster.bounds.left],
        [raster.bounds.top,    raster.bounds.right],
    ]

    return {
        "success": True,
        "image": b64_image,
        "bounds": leaflet_bounds,
        "region": region,
        "date": date,
        "class_distribution": class_distribution,
    }


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    tif_files = sorted(DATA_DIR.glob("*.tif"))
    if not tif_files:
        logger.error("No .tif files found in %s", DATA_DIR)
        sys.exit(1)

    logger.info("Found %d TIF file(s): %s", len(tif_files), [f.name for f in tif_files])
    logger.info("Output directory: %s", OUTPUT_DIR)

    model  = _load_model()
    failed = []

    for tif_path in tif_files:
        t0 = time.perf_counter()
        try:
            payload = precompute_one(model, tif_path)
        except Exception as exc:
            logger.error("FAILED: %s — %s", tif_path.name, exc, exc_info=True)
            failed.append(tif_path.name)
            continue

        out_path = OUTPUT_DIR / f"{tif_path.stem}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            # compact separators keep file size small (no spaces around : and ,)
            json.dump(payload, f, separators=(",", ":"))

        elapsed = time.perf_counter() - t0
        logger.info(
            "Saved %s  (%.1f s | %d bytes | dist=%s)",
            out_path.name,
            elapsed,
            out_path.stat().st_size,
            payload["class_distribution"],
        )

    total = len(tif_files)
    ok    = total - len(failed)
    logger.info("=" * 60)
    logger.info("Done — %d / %d succeeded.", ok, total)

    if failed:
        logger.error("Failed: %s", failed)
        sys.exit(1)

    logger.info(
        "Next steps:\n"
        "  1. git add backend/static/predictions/\n"
        "  2. git commit -m 'feat: add precomputed predictions'\n"
        "  3. git push origin master\n"
        "  4. On Render: set ENVIRONMENT=production and redeploy."
    )


if __name__ == "__main__":
    main()
