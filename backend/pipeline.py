"""
pipeline.py — Geospatial preprocessing pipeline for AgroSmart U-Net inference.

Mirrors exactly the Earth Engine export + training preprocessing workflow:
  1. Open a Float32 multi-band GeoTIFF (5 bands).
  2. Replace rasterio nodata sentinels with IEEE NaN.
  3. Transpose (Bands, H, W) → (H, W, Bands) — standard image convention.
  4. Pad spatial dimensions to the next multiple of PATCH_SIZE with NaN.
  5. Slide a non-overlapping 32×32 grid over the padded image.
  6. Discard patches where *every* pixel across *every* band is NaN
     (fully outside the study extent — coastal borders, mountain fringes, etc.).
  7. For each surviving patch apply strict per-channel min-max normalization:
         normed_c = (patch_c − min_c) / (max_c − min_c)
     Channels with zero range become 0. Residual isolated NaNs become 0.
  8. Return a typed dataclass with the patch stack + all geometry metadata
     required to reconstruct the full spatial prediction map in main.py.

Training band order (must match export):
  Band 0 → NDVI        (Sentinel-2, 10 m, resampled to region grid)
  Band 1 → NDWI        (Sentinel-2, 10 m, resampled to region grid)
  Band 2 → LST         (Landsat 8 TIRS Band 10, Single-Channel algorithm)
  Band 3 → CHIRPS      (precipitation mm/day, ~5.5 km, resampled)
  Band 4 → SWC Layer 1 (ERA5-Land Volumetric Soil Water, 9 km, resampled)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
import rasterio
from rasterio.coords import BoundingBox
from rasterio.crs import CRS

# ── Module-level constants ─────────────────────────────────────────────────────

PATCH_SIZE: int = 32
N_BANDS: int = 5

logger = logging.getLogger(__name__)


# ── Output dataclass ───────────────────────────────────────────────────────────

@dataclass
class ProcessedRaster:
    """
    Complete output of :func:`process_geotiff`.

    Attributes
    ----------
    patch_stack : ndarray (N_valid, PATCH_SIZE, PATCH_SIZE, N_BANDS), float32
        Normalized patch tensors ready for ``model.predict()``.

    patch_positions : list of (row_start, col_start)
        Top-left corner of each patch in the *padded* image coordinate system.
        ``patch_positions[i]`` is the spatial origin of ``patch_stack[i]``.

    original_height, original_width : int
        Pixel dimensions of the source raster before any padding.

    padded_height, padded_width : int
        Pixel dimensions after NaN-padding to PATCH_SIZE multiples.

    outer_nan_mask : ndarray bool (original_height, original_width)
        True  → pixel is outside the study boundary (all N_BANDS were NaN).
        False → pixel is inside the valid study area and received a prediction.
        Applied in main.py after map reconstruction to force class = -1 outside.

    bounds : rasterio BoundingBox
        Geographic extent of the *original* (unpadded) raster.
        Fields: .left (west), .right (east), .bottom (south), .top (north).
        Coordinates are in the raster's native CRS (typically EPSG:4326).

    crs : rasterio CRS
        Coordinate Reference System of the source raster.
    """

    patch_stack: np.ndarray                   # (N, 32, 32, 5), float32
    patch_positions: List[Tuple[int, int]]    # [(r0, c0), …]
    original_height: int
    original_width: int
    padded_height: int
    padded_width: int
    outer_nan_mask: np.ndarray                # (H, W) bool
    bounds: BoundingBox
    crs: CRS


# ── Private helpers ────────────────────────────────────────────────────────────

def _pad_to_multiple(array: np.ndarray, patch_size: int) -> np.ndarray:
    """
    Right- and bottom-pad *array* (H, W, C) with NaN until both H and W are
    exact multiples of *patch_size*.  The channel axis is never padded.

    Uses the identity  pad = (-n) % m  to compute the minimum required padding,
    which evaluates to 0 when n is already a multiple of m.
    """
    h, w, _ = array.shape
    pad_h = (-h) % patch_size
    pad_w = (-w) % patch_size
    if pad_h == 0 and pad_w == 0:
        return array
    return np.pad(
        array,
        pad_width=((0, pad_h), (0, pad_w), (0, 0)),
        mode="constant",
        constant_values=np.nan,
    )


def _normalize_patch(patch: np.ndarray) -> np.ndarray:
    """
    Per-channel min-max normalization of a single spatial patch.

    For each channel c:
        normed[..., c] = (patch[..., c] − nanmin_c) / (nanmax_c − nanmin_c)

    Special cases handled:
    - Range ≤ 1e-8 (constant channel, or all NaN): channel set to 0.
    - Residual isolated NaN pixels after scaling: replaced with 0.0.

    Parameters
    ----------
    patch : ndarray (PATCH_SIZE, PATCH_SIZE, C), float32

    Returns
    -------
    ndarray same shape, float32, all values ∈ [0.0, 1.0], no NaN values.
    """
    out = patch.copy().astype(np.float32)

    for c in range(out.shape[-1]):
        ch = out[..., c]

        # ── Pre-filter (Level 2): per-channel NaN guard ────────────────────
        # A border patch can have valid pixels in some bands but a single
        # channel that is entirely NaN (e.g. CHIRPS / ERA5 footprint edge
        # doesn't align perfectly with the Sentinel-2 tile boundary).
        # Calling np.nanmin / np.nanmax on such a channel raises:
        #   RuntimeWarning: All-NaN slice encountered
        # We detect this case BEFORE any reduction and zero-fill the channel.
        if np.isnan(ch).all():
            out[..., c] = 0.0
            continue

        lo = float(np.nanmin(ch))
        hi = float(np.nanmax(ch))
        rng = hi - lo

        if rng > 1e-8:
            out[..., c] = (ch - lo) / rng
        else:
            # Constant channel (all identical values, or single valid pixel)
            out[..., c] = 0.0

    # Replace residual isolated NaNs (partial nodata within a valid patch)
    return np.nan_to_num(out, nan=0.0)


# ── Public entry point ─────────────────────────────────────────────────────────

def process_geotiff(
    raster_path: str,
    patch_size: int = PATCH_SIZE,
) -> ProcessedRaster:
    """
    Full preprocessing pipeline: GeoTIFF file → model-ready patch stack.

    Called once per prediction request.  Returns everything needed to run
    inference and reassemble the full spatial prediction map.

    Parameters
    ----------
    raster_path : str
        Absolute or relative path to a Float32 GeoTIFF with exactly N_BANDS=5
        bands, in the training band order (NDVI, NDWI, LST, CHIRPS, SWC).

    patch_size : int, optional
        Square patch side length in pixels.  Must equal the U-Net input size
        the model was trained on (default: 32).

    Returns
    -------
    ProcessedRaster
        See class docstring for field descriptions.

    Raises
    ------
    FileNotFoundError
        Propagated from rasterio if *raster_path* does not exist.
    ValueError
        If band count ≠ N_BANDS, or if zero valid patches are extracted.
    """
    logger.info("process_geotiff: opening '%s'", raster_path)

    # ── Step 1: Open raster and read all bands ─────────────────────────────────
    with rasterio.open(raster_path) as src:
        if src.count != N_BANDS:
            raise ValueError(
                f"Expected {N_BANDS} bands in '{raster_path}', "
                f"found {src.count}."
            )

        # Read all bands → (Bands, H, W) in float32
        raw: np.ndarray = src.read().astype(np.float32)

        # Normalise any rasterio nodata sentinel to IEEE NaN so the NaN-based
        # logic below is uniform regardless of export convention (-9999, 0, etc.)
        nodata = src.nodata
        if nodata is not None:
            raw[raw == float(nodata)] = np.nan

        raster_bounds: BoundingBox = src.bounds
        crs: CRS = src.crs
        original_height: int = src.height
        original_width: int = src.width

    logger.info(
        "Read OK — shape (B,H,W)=%s | bounds=%s | crs=%s",
        raw.shape, raster_bounds, crs,
    )

    # ── Step 2: Transpose (Bands, H, W) → (H, W, Bands) ──────────────────────
    # Keras U-Net expects channel-last tensors: (batch, H, W, C).
    image: np.ndarray = np.transpose(raw, axes=(1, 2, 0))   # (H, W, C)

    # ── Step 3: Build outer NaN mask before padding ────────────────────────────
    # A location is "outside the study boundary" iff EVERY band is NaN there.
    # We capture this on the unpadded image so we can crop it back exactly.
    outer_nan_mask: np.ndarray = np.all(np.isnan(image), axis=-1)   # (H, W) bool

    n_outer = int(outer_nan_mask.sum())
    logger.info(
        "Outer NaN mask: %d / %d px outside study extent (%.1f%%)",
        n_outer,
        original_height * original_width,
        100.0 * n_outer / (original_height * original_width),
    )

    # ── Step 4: Pad image to PATCH_SIZE multiples ──────────────────────────────
    padded: np.ndarray = _pad_to_multiple(image, patch_size)
    padded_height, padded_width, _ = padded.shape

    logger.info(
        "Padding: (%d×%d) → (%d×%d)",
        original_height, original_width,
        padded_height, padded_width,
    )

    # ── Step 5: Extract patches, filter all-NaN, normalize ────────────────────
    valid_patches: List[np.ndarray] = []
    patch_positions: List[Tuple[int, int]] = []

    n_row_blocks = padded_height // patch_size
    n_col_blocks = padded_width // patch_size

    for y in range(n_row_blocks):
        for x in range(n_col_blocks):
            r0 = y * patch_size
            c0 = x * patch_size

            # Slice the raw (un-normalised) patch from the padded image.
            # Shape: (PATCH_SIZE, PATCH_SIZE, N_BANDS)
            patch_brut: np.ndarray = padded[r0 : r0 + patch_size, c0 : c0 + patch_size, :]

            # ── Pre-filter (Level 1): patch-level NaN guard ────────────────
            # Discard immediately if EVERY pixel across EVERY band is NaN.
            # This covers pure-padding tiles and tiles that fall entirely
            # outside the study extent (ocean, mountain barriers, etc.).
            # Must be evaluated BEFORE any call to np.nanmin / np.nanmax
            # to avoid "All-NaN slice encountered" RuntimeWarning.
            if np.isnan(patch_brut).all():
                continue

            valid_patches.append(_normalize_patch(patch_brut))
            patch_positions.append((r0, c0))

    n_total_patches = n_row_blocks * n_col_blocks
    n_valid = len(valid_patches)

    logger.info(
        "Patches: total=%d | valid=%d | discarded=%d",
        n_total_patches, n_valid, n_total_patches - n_valid,
    )

    if n_valid == 0:
        raise ValueError(
            f"No valid patches found in '{raster_path}'. "
            "The raster may be entirely outside the study extent."
        )

    # ── Step 6: Stack into model input tensor ──────────────────────────────────
    # Shape: (N_valid, PATCH_SIZE, PATCH_SIZE, N_BANDS)
    patch_stack: np.ndarray = np.stack(valid_patches, axis=0).astype(np.float32)

    logger.info(
        "process_geotiff complete: patch_stack=%s dtype=%s",
        patch_stack.shape, patch_stack.dtype,
    )

    return ProcessedRaster(
        patch_stack=patch_stack,
        patch_positions=patch_positions,
        original_height=original_height,
        original_width=original_width,
        padded_height=padded_height,
        padded_width=padded_width,
        outer_nan_mask=outer_nan_mask,
        bounds=raster_bounds,
        crs=crs,
    )
