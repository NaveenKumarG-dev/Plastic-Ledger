"""
Plastic-Ledger - Pipeline Visual Evaluation Script
=====================================================
Fetches a real Sentinel-2 scene from Copernicus using a BBOX + date,
applies the EXACT same preprocessing as the production pipeline
(band reorder, DN offset subtraction, reflectance conversion, tiling),
runs model inference with TTA, and saves side-by-side
  RGB | Prediction
visualizations for 3 representative patches:
  - 1 patch where the model detected marine debris
  - 2 patches where the model detected nothing (random, shows real input)

Output directory: ml_training_2.0/pipeline_eval/

Usage:
    python ml_training_2.0/scripts/evaluate_pipeline.py \
        --bbox "-88.85,15.90,-88.50,16.20" \
        --date "2020-12-13" \
        --model_path "ml_training_2.0/SegFormer/training-log/run_1/best_model.pth" \
        --cloud_cover 50

Dependencies: torch, transformers, rasterio, numpy, matplotlib, pyproj, shapely,
              pystac-client, requests, scipy
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# project root / env setup
_script_dir  = Path(__file__).resolve().parent           # ml_training_2.0/scripts/
_project_root = _script_dir.parent.parent                # Plastic-Ledger/
_src_dir     = _project_root / "src"

if str(_src_dir) not in sys.path:
    sys.path.insert(0, str(_src_dir))

# Load .env
_env_file = _src_dir / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file, override=True)
    except ImportError:
        pass

os.environ.pop("PROJ_LIB", None)
os.environ.pop("PROJ_DATA", None)

import numpy as np
import torch
import torch.nn as nn

# constants matching 03_detect.py exactly
NUM_CLASSES = 15
NUM_BANDS   = 11
DEBRIS_CLASS = 0
THRESHOLD   = 0.10
LOGIT_BOOST = 0.5
PATCH_SIZE  = 256
OVERLAP     = 32

CLASS_COLORS: Dict[int, Tuple[int, int, int]] = {
    0:  (220,  50,  50),
    1:  ( 34, 139,  34),
    2:  (144, 238, 144),
    3:  (139,  90,  43),
    4:  (128, 128, 128),
    5:  (255, 255, 255),
    6:  (  0,   0, 205),
    7:  (210, 180, 140),
    8:  (255, 255, 200),
    9:  ( 64, 164, 223),
    10: ( 30,  90, 180),
    11: (200, 200, 255),
    12: (105, 105, 105),
    13: (255, 140,   0),
    14: (100, 180, 200),
}

CLASS_NAMES: Dict[int, str] = {
    0: "Marine Debris",    1: "Dense Sargassum",   2: "Sparse Sargassum",
    3: "Natural Organic",  4: "Ship",              5: "Clouds",
    6: "Marine Water",     7: "Sediment-Laden",    8: "Foam",
    9: "Turbid Water",    10: "Shallow Water",     11: "Waves",
    12: "Cloud Shadows",  13: "Wakes",            14: "Mixed Water",
}

RGB_INDICES = (3, 2, 1)  # B04=red, B03=green, B02=blue (0-indexed in model order)
BAND_ORDER  = ["B01","B02","B03","B04","B05","B06","B07","B08","B8A","B11","B12"]


# ==============================================================================
# STAGE 1 - DOWNLOAD
# ==============================================================================

def download_scene(
    bbox: Tuple[float, float, float, float],
    date: str,
    output_dir: Path,
    cloud_cover: int = 50,
) -> Tuple[Path, str]:
    """Search Copernicus STAC and download an L2A scene."""
    ingest = __import__("pipeline.01_ingest", fromlist=["run"])
    raw_dir = output_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    # Build config with Copernicus credentials from env (loaded from .env)
    username = os.environ.get("COPERNICUS_USERNAME") or os.environ.get("CDSE_USERNAME")
    password = os.environ.get("COPERNICUS_PASSWORD") or os.environ.get("CDSE_PASSWORD")
    config = {}
    if username and password:
        config = {"apis": {"copernicus_username": username, "copernicus_password": password}}
        print(f"[Stage 1] Authenticating as: {username}")
    else:
        print("[Stage 1] WARNING: No Copernicus credentials found in .env — download may fail (401).")
        print("          Expected env vars: COPERNICUS_USERNAME / COPERNICUS_PASSWORD")

    scene_dirs, _ = ingest.run(
        bbox=bbox,
        date_start="2015-01-01",
        date_end=date,
        cloud_cover_max=cloud_cover,
        output_dir=str(raw_dir),
        config=config,
    )
    if not scene_dirs:
        raise RuntimeError("No scenes downloaded.")
    scene_dir = scene_dirs[0]
    print(f"[Stage 1] Scene: {scene_dir.name}")
    return scene_dir, scene_dir.name


# ==============================================================================
# STAGE 2 - PREPROCESSING  (identical to 02_preprocess.py)
# ==============================================================================

def preprocess_scene(scene_dir: Path) -> Tuple[np.ndarray, Any, Any]:
    """Load bands, subtract DN offset, convert to reflectance. Matches pipeline exactly."""
    import rasterio
    from scipy.ndimage import zoom as ndimage_zoom

    band_data: Dict[str, np.ndarray] = {}
    ref_profile = None
    ref_shape   = None

    for band_name in BAND_ORDER:
        candidates = [
            scene_dir / f"{band_name}.tif",
            scene_dir / f"{band_name.lower()}.tif",
        ]
        candidates += list(scene_dir.glob(f"*{band_name}*.tif"))
        for cand in candidates:
            if cand.exists():
                with rasterio.open(cand) as src:
                    arr = src.read(1).astype(np.float32)
                    band_data[band_name] = arr
                    if ref_shape is None or arr.size > ref_shape[0]*ref_shape[1]:
                        ref_profile = src.profile.copy()
                        ref_shape   = (src.height, src.width)
                break

    if not band_data:
        raise FileNotFoundError(f"No band files found in {scene_dir}")

    image = np.zeros((11, *ref_shape), dtype=np.float32)
    for i, bname in enumerate(BAND_ORDER):
        if bname in band_data:
            arr = band_data[bname]
            if arr.shape != ref_shape:
                zf  = (ref_shape[0]/arr.shape[0], ref_shape[1]/arr.shape[1])
                arr = ndimage_zoom(arr, zf, order=1)
            image[i] = arr

    # normalization - identical to normalize_scene() in 02_preprocess.py
    nodata_mask = (image.sum(axis=0) == 0)
    image = np.where(~nodata_mask, image - 1000.0, 0.0)  # Copernicus DN offset
    image = np.clip(image, 0.0, None)
    image = image / 10000.0                               # reflectance
    image[:, nodata_mask] = 0.0
    image = np.clip(image, 0.0, 1.0)
    image = np.nan_to_num(image, nan=0.0, posinf=1.0, neginf=0.0)

    transform = ref_profile.get("transform")
    crs       = ref_profile.get("crs")
    return image, transform, crs


# ==============================================================================
# STAGE 2b - TILING  (identical to tile_scene() in 02_preprocess.py)
# ==============================================================================

def tile_scene(image: np.ndarray) -> Tuple[List[np.ndarray], List[Dict[str, Any]]]:
    """Tile (11, H, W) array into overlapping 256x256 patches."""
    _, h, w = image.shape
    stride  = PATCH_SIZE - OVERLAP
    patches, infos = [], []
    r_idx, row = 0, 0
    while row < h:
        c_idx, col = 0, 0
        while col < w:
            row_end = min(row + PATCH_SIZE, h)
            col_end = min(col + PATCH_SIZE, w)
            patch   = np.zeros((NUM_BANDS, PATCH_SIZE, PATCH_SIZE), dtype=np.float32)
            ah = row_end - row
            aw = col_end - col
            patch[:, :ah, :aw] = image[:, row:row_end, col:col_end]
            patches.append(patch)
            infos.append({"row": r_idx, "col": c_idx,
                           "row_start": row, "col_start": col,
                           "actual_h": ah, "actual_w": aw})
            col += stride; c_idx += 1
            if col_end >= w: break
        row += stride; r_idx += 1
        if row_end >= h: break
    return patches, infos


def filter_patches_by_bbox(patches, infos, bbox, transform, crs):
    """Identical bbox filter logic to 03_detect.py"""
    try:
        from pyproj import Transformer
        from shapely.geometry import box as shapely_box
        lon_min, lat_min, lon_max, lat_max = bbox
        t = Transformer.from_crs("EPSG:4326", str(crs), always_xy=True)
        corners = [t.transform(lon_min, lat_min), t.transform(lon_max, lat_max),
                   t.transform(lon_min, lat_max), t.transform(lon_max, lat_min)]
        xs = [c[0] for c in corners]; ys = [c[1] for c in corners]
        user_box = shapely_box(min(xs), min(ys), max(xs), max(ys))
        tf = [transform.a, transform.b, transform.c,
              transform.d, transform.e, transform.f]
        kept_p, kept_i = [], []
        for patch, info in zip(patches, infos):
            minx = tf[2] + info["col_start"] * tf[0]
            maxy = tf[5] + info["row_start"] * tf[4]
            maxx = minx + info["actual_w"] * tf[0]
            miny = maxy + info["actual_h"] * tf[4]
            pb = shapely_box(min(minx,maxx), min(miny,maxy), max(minx,maxx), max(miny,maxy))
            if pb.intersects(user_box):
                kept_p.append(patch)
                kept_i.append(info)
        print(f"[filter] Retained {len(kept_p)}/{len(patches)} patches within bbox")
        return kept_p, kept_i
    except ImportError:
        print("[filter] pyproj/shapely not available - using all patches")
        return patches, infos


# ==============================================================================
# STAGE 3 - MODEL INFERENCE  (identical to 03_detect.py)
# ==============================================================================

def load_model(model_path: Path, device: torch.device) -> torch.nn.Module:
    """Auto-detect architecture and load. Identical to 03_detect.load_model()."""
    from transformers import SegformerForSemanticSegmentation, SegformerConfig

    ckpt = torch.load(model_path, map_location=device, weights_only=False)
    if isinstance(ckpt, dict):
        sd = (ckpt.get("model_state") or ckpt.get("state_dict")
              or ckpt.get("model_state_dict") or ckpt)
    else:
        sd = ckpt
    keys = list(sd.keys()) if isinstance(sd, dict) else []

    arch = (ckpt.get("architecture") if isinstance(ckpt, dict) else None)
    if not arch and isinstance(ckpt, dict) and ckpt.get("encoder"):
        arch = "unet_smp"
    if not arch:
        if any(k.startswith("segformer.stages.") for k in keys):
            # B2 pretrained structure — uses .stages not .encoder
            arch = "segformer_b2"
        elif any(k.startswith("segformer.encoder.") for k in keys):
            # B0 scratch structure — uses .encoder
            arch = "segformer_b0"
        elif any(k.startswith("inc.") for k in keys) and "outc.weight" in sd:
            arch = "unet_official"
        elif any(k.startswith("decoder.") for k in keys):
            arch = "unet_smp"
        else:
            # Last resort: detect from classifier head hidden size
            # B2: decoder_hidden_size=768, B0: decoder_hidden_size=256
            cls_w = sd.get("decode_head.classifier.weight") if isinstance(sd, dict) else None
            if cls_w is not None:
                hidden_size = cls_w.shape[1]
                arch = "segformer_b2" if hidden_size >= 512 else "segformer_b0"
                print(f"[model] Detected from classifier shape: hidden={hidden_size} → {arch}")
            else:
                arch = "segformer_b0"
    arch = arch.lower()
    print(f"[model] Architecture: {arch}")

    if arch == "segformer_b2":
        model = SegformerForSemanticSegmentation.from_pretrained(
            "nvidia/segformer-b2-finetuned-ade-512-512",
            num_labels=NUM_CLASSES, ignore_mismatched_sizes=True)
        old = model.segformer.stages[0].patch_embeddings.proj
        model.segformer.stages[0].patch_embeddings.proj = nn.Conv2d(
            NUM_BANDS, old.out_channels, old.kernel_size, old.stride, old.padding,
            bias=(old.bias is not None))
        model.config.num_channels = NUM_BANDS
        model.load_state_dict(sd, strict=False)
    elif arch in {"segformer_b0", "segformer"}:
        cfg = SegformerConfig(num_labels=NUM_CLASSES, num_channels=NUM_BANDS,
                              depths=[2,2,2,2], hidden_sizes=[32,64,160,256],
                              decoder_hidden_size=256)
        model = SegformerForSemanticSegmentation(cfg)
        old = model.segformer.encoder.patch_embeddings[0].proj
        model.segformer.encoder.patch_embeddings[0].proj = nn.Conv2d(
            NUM_BANDS, old.out_channels, old.kernel_size, old.stride, old.padding)
        model.load_state_dict(sd, strict=False)
    elif arch in {"unet_smp", "unet", "unet_resnet34"}:
        import segmentation_models_pytorch as smp
        enc  = ckpt.get("encoder","resnet34") if isinstance(ckpt,dict) else "resnet34"
        nb   = int(ckpt.get("num_bands", NUM_BANDS)) if isinstance(ckpt,dict) else NUM_BANDS
        nc   = int(ckpt.get("num_classes", NUM_CLASSES)) if isinstance(ckpt,dict) else NUM_CLASSES
        model = smp.Unet(encoder_name=enc, encoder_weights=None, in_channels=nb, classes=nc)
        model.load_state_dict(sd, strict=False)
    else:
        raise ValueError(f"Unknown architecture: {arch}")

    model.to(device).eval()
    print(f"[model] Loaded: {model_path.name}")
    return model


def _apply_aug(p, aug):
    if aug == "original": return p
    if aug == "hflip":    return np.flip(p, axis=2).copy()
    if aug == "vflip":    return np.flip(p, axis=1).copy()
    if aug == "rot90":    return np.rot90(p, k=1, axes=(1,2)).copy()
    if aug == "rot180":   return np.rot90(p, k=2, axes=(1,2)).copy()
    if aug == "rot270":   return np.rot90(p, k=3, axes=(1,2)).copy()
    return p


def _undo_aug(pm, aug):
    if aug == "original": return pm
    if aug == "hflip":    return np.flip(pm, axis=2).copy()
    if aug == "vflip":    return np.flip(pm, axis=1).copy()
    if aug == "rot90":    return np.rot90(pm, k=-1, axes=(1,2)).copy()
    if aug == "rot180":   return np.rot90(pm, k=-2, axes=(1,2)).copy()
    if aug == "rot270":   return np.rot90(pm, k=-3, axes=(1,2)).copy()
    return pm


def run_tta_inference(model, patch, device):
    """TTA inference - exact copy of 03_detect.run_tta_inference()."""
    import torch.nn.functional as F
    H, W = patch.shape[1], patch.shape[2]
    augs = ["original","hflip","vflip","rot90","rot180","rot270"]
    acc  = None
    with torch.no_grad():
        for aug in augs:
            t = torch.from_numpy(_apply_aug(patch, aug)).unsqueeze(0).float().to(device)
            out = model(t)
            if hasattr(out, "logits"):   logits = out.logits
            elif isinstance(out, torch.Tensor): logits = out
            elif isinstance(out, (tuple,list)): logits = out[0]
            else: logits = out
            logits = logits.clone()
            logits[:, DEBRIS_CLASS, :, :] += LOGIT_BOOST
            if logits.shape[-2:] != (H, W):
                logits = F.interpolate(logits, size=(H, W), mode="bilinear", align_corners=False)
            probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()
            probs = _undo_aug(probs, aug)
            acc   = probs if acc is None else acc + probs
    return acc / len(augs)


def run_inference_on_patches(model, patches, device):
    prob_maps = []
    for i, patch in enumerate(patches):
        prob_maps.append(run_tta_inference(model, patch, device))
        if (i+1) % 5 == 0 or i == len(patches)-1:
            print(f"  Inference: {i+1}/{len(patches)} patches")
    return prob_maps


# ==============================================================================
# PATCH SELECTION
# ==============================================================================

def select_patches(patches, prob_maps, n_debris=1, n_no_debris=2):
    import random
    counts = []
    for i, pm in enumerate(prob_maps):
        dp   = pm[DEBRIS_CLASS]
        cm   = pm.argmax(axis=0)
        cnt  = int(((dp > THRESHOLD) & (cm == DEBRIS_CLASS)).sum())
        counts.append((cnt, i))
    counts.sort(key=lambda x: x[0], reverse=True)

    with_debris    = [idx for cnt,idx in counts if cnt > 0][:n_debris]
    without_debris = [idx for cnt,idx in counts if cnt == 0]

    if len(with_debris) < n_debris:
        extra = [idx for _,idx in counts if idx not in with_debris]
        with_debris += extra[:n_debris-len(with_debris)]

    random.shuffle(without_debris)
    without_debris = without_debris[:n_no_debris]

    print(f"[select] {len(with_debris)} debris patch(es), {len(without_debris)} no-debris patch(es)")
    return {"debris": with_debris, "no_debris": without_debris}


# ==============================================================================
# VISUALISATION
# ==============================================================================

def colorise_pred(pred_cls: np.ndarray) -> np.ndarray:
    rgb = np.zeros((*pred_cls.shape, 3), dtype=np.uint8)
    for cls, color in CLASS_COLORS.items():
        rgb[pred_cls == cls] = color
    return rgb


def make_rgb(patch: np.ndarray) -> np.ndarray:
    r, g, b = patch[RGB_INDICES[0]], patch[RGB_INDICES[1]], patch[RGB_INDICES[2]]
    rgb_f   = np.stack([r, g, b], axis=-1)
    for c in range(3):
        lo = np.percentile(rgb_f[...,c], 2)
        hi = np.percentile(rgb_f[...,c], 98)
        if hi > lo:
            rgb_f[...,c] = (rgb_f[...,c] - lo) / (hi - lo)
    return (np.clip(rgb_f, 0, 1) * 255).astype(np.uint8)


def save_visualization(patch, prob_map, label, info, output_path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches

    rgb_img  = make_rgb(patch)
    pred_cls = prob_map.argmax(axis=0)
    pred_rgb = colorise_pred(pred_cls)
    dp       = prob_map[DEBRIS_CLASS]
    n_debris = int(((dp > THRESHOLD) & (pred_cls == DEBRIS_CLASS)).sum())

    title = (f"Row {info['row_start']} | Col {info['col_start']} | "
             f"Debris pixels: {n_debris} | {label}")

    fig, axes = plt.subplots(1, 2, figsize=(12, 6))
    fig.suptitle(title, fontsize=11, fontweight="bold", y=1.01)

    axes[0].imshow(rgb_img)
    axes[0].set_title("RGB (B04/B03/B02)", fontsize=10, fontweight="bold")
    axes[0].axis("off")

    axes[1].imshow(pred_rgb)
    axes[1].set_title("Prediction", fontsize=10, fontweight="bold")
    axes[1].axis("off")

    unique = np.unique(pred_cls)
    patches_leg = [
        mpatches.Patch(
            facecolor=tuple(c/255 for c in CLASS_COLORS.get(int(cls),(128,128,128))),
            label=CLASS_NAMES.get(int(cls), f"Class {cls}"),
        )
        for cls in unique if int(cls) in CLASS_NAMES
    ]
    if patches_leg:
        axes[1].legend(handles=patches_leg, loc="lower left",
                       fontsize=7, framealpha=0.8, ncol=2)

    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {output_path.name}")


# ==============================================================================
# MAIN
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Plastic-Ledger pipeline visual evaluation (real scene, exact preprocessing)")
    parser.add_argument("--bbox",        type=str, required=True,
                        help="lon_min,lat_min,lon_max,lat_max")
    parser.add_argument("--date",        type=str, required=True,
                        help="Target date YYYY-MM-DD")
    parser.add_argument("--model_path",  type=str, required=True,
                        help="Path to trained .pth checkpoint")
    parser.add_argument("--cloud_cover", type=int, default=50)
    parser.add_argument("--output_dir",  type=str,
                        default=str(_project_root / "ml_training_2.0" / "pipeline_eval"))
    parser.add_argument("--no-download", action="store_true", dest="no_download",
                        help="Skip download if scene already exists in output_dir/raw/")
    args = parser.parse_args()

    bbox = tuple(float(x) for x in args.bbox.split(","))
    assert len(bbox) == 4

    model_path = Path(args.model_path)
    if not model_path.is_absolute():
        model_path = _project_root / model_path
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    print("\n" + "="*65)
    print("  Plastic-Ledger - Pipeline Visual Evaluation")
    print(f"  BBox : {bbox}")
    print(f"  Date : {args.date}")
    print(f"  Model: {model_path.name}")
    print("="*65 + "\n")

    # Stage 1: Download
    if args.no_download:
        raw_dir    = output_dir / "raw"
        scene_dirs = [d for d in raw_dir.iterdir() if d.is_dir()] if raw_dir.exists() else []
        if not scene_dirs:
            raise FileNotFoundError("No scene in output_dir/raw/")
        scene_dir, scene_id = scene_dirs[0], scene_dirs[0].name
        print(f"[Stage 1] Using cached scene: {scene_id}")
    else:
        print("[Stage 1] Downloading scene ...")
        scene_dir, scene_id = download_scene(bbox, args.date, output_dir, args.cloud_cover)

    # Stage 2: Preprocess
    print("\n[Stage 2] Preprocessing (band reorder + DN offset + reflectance) ...")
    image, transform, crs = preprocess_scene(scene_dir)
    print(f"[Stage 2] Shape {image.shape}, range [{image.min():.4f}, {image.max():.4f}]")

    # Stage 2b: Tile
    print("[Stage 2] Tiling 256x256 patches (overlap=32) ...")
    patches, infos = tile_scene(image)
    print(f"[Stage 2] Total patches: {len(patches)}")

    if crs:
        patches, infos = filter_patches_by_bbox(patches, infos, bbox, transform, crs)
    else:
        print("[filter] No CRS - using all patches")

    if not patches:
        raise RuntimeError("No patches after bbox filter. Widen the bbox.")

    # Stage 3: Inference
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n[Stage 3] Loading model on {device} ...")
    model = load_model(model_path, device)
    print(f"[Stage 3] Running TTA inference on {len(patches)} patches ...")
    prob_maps = run_inference_on_patches(model, patches, device)

    # Select patches
    print("\n[Select] Choosing representative patches ...")
    selection = select_patches(patches, prob_maps, n_debris=1, n_no_debris=2)

    # Visualise
    print("\n[Visualise] Saving PNGs ...")
    visuals_dir  = output_dir / "visuals"
    all_selected = ([(idx, "DEBRIS DETECTED") for idx in selection["debris"]] +
                    [(idx, "No Debris")        for idx in selection["no_debris"]])

    summary_records = []
    for k, (idx, label) in enumerate(all_selected):
        tag       = "debris"   if "DEBRIS" in label else f"no_debris_{k - len(selection['debris'])}"
        out_path  = visuals_dir / f"{scene_id}_{tag}.png"
        pm        = prob_maps[idx]
        n_d       = int(((pm[DEBRIS_CLASS] > THRESHOLD) & (pm.argmax(0) == DEBRIS_CLASS)).sum())
        save_visualization(patches[idx], pm, label, infos[idx], out_path)
        summary_records.append({"tag": tag, "debris_pixels": n_d,
                                 "row_start": infos[idx]["row_start"],
                                 "col_start": infos[idx]["col_start"],
                                 "png": str(out_path)})

    # Summary JSON
    summary = {"scene_id": scene_id, "bbox": list(bbox), "date": args.date,
                "model": str(model_path), "patches_processed": len(patches),
                "patches_visualised": summary_records,
                "elapsed_seconds": round(time.time()-t0, 1)}
    sp = output_dir / "eval_summary.json"
    with open(sp, "w") as fh:
        json.dump(summary, fh, indent=2)

    print(f"\n[Done] {summary['elapsed_seconds']}s elapsed")
    print(f"[Done] PNGs in: {visuals_dir}")
    print(f"[Done] Summary: {sp}")
    print("\nPatches visualised:")
    for r in summary_records:
        print(f"  {r['tag']:<22} debris_pixels={r['debris_pixels']}")


if __name__ == "__main__":
    main()
