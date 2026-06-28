"""
main.py — AgroSmart FastAPI inference server.

Startup
-------
The Keras U-Net model is loaded *once* at application startup via a FastAPI
lifespan context manager.  This avoids the ~10 s TensorFlow cold-start penalty
on every request.

Prediction Route
----------------
POST /predict?region=<str>&date=<YYYY-MM>

    1. Locate the pre-exported GeoTIFF at  data/{region}_{date}.tif
    2. Run the full preprocessing pipeline (pipeline.process_geotiff).
    3. Batch-run model.predict() → argmax → integer class map (0–3).
    4. Reconstruct the full spatial class map from individual patch predictions.
    5. Force outer-boundary pixels (originally all-NaN) to class −1 (transparent).
    6. Compute per-class pixel distribution over valid (non-−1) pixels.
    7. Render the class map to a pixel-perfect transparent RGBA PNG using Pillow.
    8. Base64-encode the PNG and return a JSON payload with Leaflet-compatible
       bounding box  [[south, west], [north, east]].

CORS
----
Origins are read from the CORS_ALLOWED_ORIGINS environment variable
(comma-separated list).  Defaults to http://localhost:3000 for local dev.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

# Load .env before any os.getenv() calls in imported modules
load_dotenv()

from auth import get_current_user          # noqa: E402  (must come after load_dotenv)
from database import Base, engine          # noqa: E402
from db_models import User                 # noqa: E402
from pipeline import ProcessedRaster, process_geotiff  # noqa: E402
from routers import profile as profile_router  # noqa: E402

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("agrosmart.api")

# ── Runtime environment ────────────────────────────────────────────────────────
# Defaults to "production" (serve precomputed JSON, no TensorFlow).
# Set ENVIRONMENT=development locally to run live U-Net inference.

ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")

# ── File paths ─────────────────────────────────────────────────────────────────

BASE_DIR: str   = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH: str = os.path.join(BASE_DIR, "models", "model_unet_souss_massa.keras")
DATA_DIR: str   = os.path.join(BASE_DIR, "data")
PRED_DIR: str   = os.path.join(BASE_DIR, "static", "predictions")

# ── Colour table for the 4 water-stress classes ────────────────────────────────
# Matches the ListedColormap used during training visualisation and the
# frontend legend in Dashboard.tsx STRESS_CLASSES.
#
#   Class 0 — Sain / Irrigué   → #2ecc71  (emerald green)
#   Class 1 — Stress Léger     → #3498db  (sky blue)
#   Class 2 — Stress Modéré    → #f39c12  (amber / orange)
#   Class 3 — Stress Critique  → #960000  (deep crimson)
#
# Each row is (R, G, B, A) in uint8.  Class −1 maps to fully transparent (A=0).
_CLASS_RGBA: np.ndarray = np.array(
    [
        [0x2E, 0xCC, 0x71, 0xFF],   # 0 — green
        [0x34, 0x98, 0xDB, 0xFF],   # 1 — blue
        [0xF3, 0x9C, 0x12, 0xFF],   # 2 — amber
        [0x96, 0x00, 0x00, 0xFF],   # 3 — crimson
    ],
    dtype=np.uint8,
)

N_CLASSES: int = len(_CLASS_RGBA)

# ── Global model handle ────────────────────────────────────────────────────────

_model = None   # populated in lifespan()


# ── Lifespan: load model at startup ───────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup / shutdown handler.

    Production mode  → skip TensorFlow entirely; serve precomputed JSON files.
    Development mode → load the Keras U-Net model once, release on shutdown.
    """
    global _model

    logger.info("[STARTUP] ENVIRONMENT=%s", ENVIRONMENT)

    # ── Production: no model load ──────────────────────────────────────────────
    if ENVIRONMENT == "production":
        logger.info(
            "[STARTUP] production mode — TensorFlow not imported; "
            "precomputed predictions will be served from %s", PRED_DIR
        )
        Base.metadata.create_all(bind=engine)
        logger.info("[STARTUP] database tables ensured")
        yield
        return          # nothing to clean up

    # ── Development: load model ────────────────────────────────────────────────
    logger.info("[STARTUP] development mode — loading U-Net model")

    if not os.path.isfile(MODEL_PATH):
        raise RuntimeError(
            f"Model file not found at '{MODEL_PATH}'. "
            "Place model_unet_souss_massa.keras inside backend/models/."
        )

    logger.info("Loading U-Net model: %s", MODEL_PATH)

    try:
        # Standalone Keras 3.x  (pip install keras)
        import keras
        _model = keras.saving.load_model(MODEL_PATH, compile=False)
        logger.info("Loaded via keras.saving.load_model")
    except (ImportError, AttributeError):
        try:
            # TensorFlow 2.x bundled keras  (pip install tensorflow)
            import tensorflow as tf
            _model = tf.keras.models.load_model(MODEL_PATH, compile=False)
            logger.info("Loaded via tf.keras.models.load_model")
        except Exception as exc:
            raise RuntimeError(
                f"Failed to load model. Install tensorflow or keras. Error: {exc}"
            ) from exc

    logger.info(
        "Model ready — input: %s | output: %s",
        _model.input_shape,
        _model.output_shape,
    )

    # Create DB tables (no-op if they already exist)
    Base.metadata.create_all(bind=engine)
    logger.info("[STARTUP] database tables ensured")

    yield   # ←── server is running

    logger.info("[SHUTDOWN] releasing model")
    _model = None


# ── FastAPI application ────────────────────────────────────────────────────────

app = FastAPI(
    title="AgroSmart Prediction API",
    description=(
        "U-Net 2D semantic segmentation for soil water stress classification "
        "in the Souss-Massa region, Morocco."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Read comma-separated allowed origins from the CORS_ALLOWED_ORIGINS env var.
# Set this on Render to: http://localhost:3000,https://agrosmart-ai-4fmz.vercel.app
_raw_origins = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,https://agrosmart-ai-4fmz.vercel.app",
)
_cors_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
logger.info("CORS allowed origins: %s", _cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(profile_router.router)


# ── Private: map reconstruction ────────────────────────────────────────────────

def _reconstruct_prediction_map(
    patch_classes: np.ndarray,
    raster: ProcessedRaster,
) -> np.ndarray:
    """
    Stitch per-patch class predictions back into a full spatial grid and
    clean up the outer boundary using the original NaN mask.

    Parameters
    ----------
    patch_classes : ndarray (N_valid, PATCH_SIZE, PATCH_SIZE), dtype int8
        Integer class indices (0–3) for every valid patch, in the same order
        as ``raster.patch_positions``.

    raster : ProcessedRaster
        Metadata returned by pipeline.process_geotiff.

    Returns
    -------
    ndarray (original_height, original_width), dtype int8
        Class map where:
            0–3  → valid prediction
            -1   → outside study boundary (originally all-NaN across all bands)
    """
    patch_size = patch_classes.shape[1]   # == PATCH_SIZE

    # Initialise the padded grid with sentinel value −1 ("outside / unknown")
    padded_map: np.ndarray = np.full(
        (raster.padded_height, raster.padded_width),
        fill_value=-1,
        dtype=np.int8,
    )

    # Place each patch prediction into its correct spatial location
    for idx, (r0, c0) in enumerate(raster.patch_positions):
        padded_map[r0 : r0 + patch_size, c0 : c0 + patch_size] = patch_classes[idx]

    # Crop the padding back to the original raster dimensions
    result: np.ndarray = padded_map[: raster.original_height, : raster.original_width]

    # Enforce that pixels the raster itself reported as "outside the study
    # extent" (all bands == NaN) remain at −1, even if a patch touched them.
    result[raster.outer_nan_mask] = -1

    return result


# ── Private: transparent PNG rendering ────────────────────────────────────────

def _render_transparent_png(pred_map: np.ndarray) -> str:
    """
    Convert a 2-D integer class map to a transparent-background RGBA PNG and
    return it as a Base64-encoded UTF-8 string.

    Approach:
    - Build an (H, W, 4) RGBA numpy array directly from the class colour table.
    - Pixels with class −1 keep the default transparent value (all zeros, A=0).
    - Use ``PIL.Image`` to encode to PNG in an in-memory byte buffer — no temp
      files, no matplotlib overhead, no interpolation artefacts.

    Parameters
    ----------
    pred_map : ndarray (H, W), int8, values in {−1, 0, 1, 2, 3}

    Returns
    -------
    str
        Base64-encoded PNG bytes, UTF-8, without ``data:image/png;base64,``
        prefix (the frontend prepends this itself for the <ImageOverlay>).
    """
    h, w = pred_map.shape

    # Output tensor: (H, W, 4) RGBA, all transparent by default
    rgba: np.ndarray = np.zeros((h, w, 4), dtype=np.uint8)

    # Paint valid class pixels using the colour table
    for cls_idx in range(N_CLASSES):
        mask: np.ndarray = pred_map == cls_idx
        if mask.any():
            rgba[mask] = _CLASS_RGBA[cls_idx]

    # Encode to PNG in memory (no disk I/O, no temp file)
    pil_img = Image.fromarray(rgba, mode="RGBA")
    buffer = io.BytesIO()
    pil_img.save(buffer, format="PNG", optimize=False)
    buffer.seek(0)

    return base64.b64encode(buffer.read()).decode("utf-8")


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.post("/predict")
async def predict(
    region: str = Query(..., description="Province key, e.g. 'souss_massa'"),
    date: str = Query(..., description="Month in YYYY-MM format, e.g. '2024-01'"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Return a U-Net hydric-stress prediction for the given region/date.

    Production mode  → loads backend/static/predictions/{region}_{date}.json
    Development mode → runs live TensorFlow inference against the GeoTIFF

    Response (identical in both modes):
        {
            "success": true,
            "image":   "<base64 RGBA PNG>",
            "bounds":  [[south, west], [north, east]],
            "region":  "souss_massa",
            "date":    "2024-01",
            "class_distribution": {"0": 0.12, "1": 0.34, "2": 0.34, "3": 0.20}
        }
    """
    t0 = time.perf_counter()

    # ── Input validation (always runs regardless of mode) ──────────────────────
    if not region.replace("-", "").replace("_", "").isalpha():
        raise HTTPException(
            status_code=422,
            detail=f"Invalid region identifier: '{region}'.",
        )

    # ══════════════════════════════════════════════════════════════════════════
    # PRODUCTION MODE — serve precomputed JSON (no TensorFlow, no GeoTIFF I/O)
    # ══════════════════════════════════════════════════════════════════════════
    if ENVIRONMENT == "production":
        pred_path = os.path.join(PRED_DIR, f"{region}_{date}.json")

        logger.info("[PREDICT] production mode: loading precomputed prediction")
        logger.info("[PREDICT] file path used: %s", pred_path)

        if not os.path.isfile(pred_path):
            raise HTTPException(
                status_code=404,
                detail=(
                    f"No precomputed prediction for region='{region}', date='{date}'. "
                    f"Run scripts/precompute_predictions.py locally first, then "
                    f"commit static/predictions/{region}_{date}.json."
                ),
            )

        with open(pred_path, "r", encoding="utf-8") as f:
            payload: Dict[str, Any] = json.load(f)

        elapsed = time.perf_counter() - t0
        logger.info("[PREDICT] total response time: %.3f s", elapsed)
        return payload

    # ══════════════════════════════════════════════════════════════════════════
    # DEVELOPMENT MODE — live U-Net inference
    # ══════════════════════════════════════════════════════════════════════════
    global _model

    logger.info("[PREDICT] development mode: running live model")

    if _model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Server may still be starting up.",
        )

    tif_filename = f"{region}_{date}.tif"
    tif_path = os.path.join(DATA_DIR, tif_filename)

    logger.info("[PREDICT] file path used: %s", tif_path)
    logger.info("POST /predict — region=%s  date=%s  file=%s", region, date, tif_path)

    if not os.path.isfile(tif_path):
        raise HTTPException(
            status_code=404,
            detail=(
                f"No input file found for region='{region}', date='{date}'. "
                f"Expected: backend/data/{tif_filename}"
            ),
        )

    # ── 1. Preprocess GeoTIFF ─────────────────────────────────────────────────
    try:
        raster: ProcessedRaster = process_geotiff(tif_path)
    except (FileNotFoundError, ValueError) as exc:
        logger.error("Preprocessing failed: %s", exc)
        raise HTTPException(status_code=422, detail=f"Preprocessing error: {exc}") from exc
    except Exception as exc:
        logger.exception("Unexpected preprocessing error")
        raise HTTPException(status_code=500, detail=f"Preprocessing error: {exc}") from exc

    logger.info(
        "Preprocessing OK — %d valid patches | image (%d×%d)",
        len(raster.patch_positions),
        raster.original_height,
        raster.original_width,
    )

    # ── 2. Batch U-Net inference ──────────────────────────────────────────────
    try:
        logits: np.ndarray = _model.predict(
            raster.patch_stack,
            batch_size=32,
            verbose=0,
        )
    except Exception as exc:
        logger.exception("model.predict() failed")
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}") from exc

    patch_classes: np.ndarray = np.argmax(logits, axis=-1).astype(np.int8)

    logger.info(
        "Inference OK — patch predictions shape=%s | classes present=%s",
        patch_classes.shape,
        np.unique(patch_classes).tolist(),
    )

    # ── 3. Reconstruct full spatial prediction map ────────────────────────────
    pred_map: np.ndarray = _reconstruct_prediction_map(patch_classes, raster)

    logger.info(
        "Reconstruction OK — map shape=%s | unique values=%s",
        pred_map.shape,
        np.unique(pred_map).tolist(),
    )

    # ── 4. Per-class pixel distribution ──────────────────────────────────────
    valid_pixels: np.ndarray = pred_map[pred_map >= 0]
    n_valid_px = max(int(valid_pixels.size), 1)

    class_distribution: Dict[str, float] = {
        str(cls_idx): round(float((valid_pixels == cls_idx).sum()) / n_valid_px, 6)
        for cls_idx in range(N_CLASSES)
    }

    logger.info("Class distribution: %s", class_distribution)

    # ── 5. Render transparent PNG → base64 ───────────────────────────────────
    try:
        b64_image: str = _render_transparent_png(pred_map)
    except Exception as exc:
        logger.exception("PNG rendering failed")
        raise HTTPException(status_code=500, detail=f"Rendering error: {exc}") from exc

    logger.info("PNG rendered — base64 length: %d chars", len(b64_image))

    # ── 6. Leaflet bounding box ───────────────────────────────────────────────
    south: float = raster.bounds.bottom
    north: float = raster.bounds.top
    west:  float = raster.bounds.left
    east:  float = raster.bounds.right

    leaflet_bounds: List[List[float]] = [[south, west], [north, east]]

    elapsed = time.perf_counter() - t0
    logger.info(
        "[PREDICT] total response time: %.3f s | bounds=%s | b64_len=%d",
        elapsed, leaflet_bounds, len(b64_image),
    )

    return {
        "success": True,
        "image": b64_image,
        "bounds": leaflet_bounds,
        "region": region,
        "date": date,
        "class_distribution": class_distribution,
    }


# ── Health probe ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> Dict[str, str]:
    """Liveness probe — returns model load status."""
    return {
        "status": "ok",
        "model": "loaded" if _model is not None else "not_loaded",
    }
