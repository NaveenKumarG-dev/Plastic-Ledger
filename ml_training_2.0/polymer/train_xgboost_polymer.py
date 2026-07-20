"""
Stage 4 — Polymer Classification Model (XGBoost)
========================================
Trains an XGBoost model on MARIDA pixel-level spectral signatures
(13 Sentinel-2 bands from dataset.h5) to classify Marine Debris
vs. all other sea-surface classes using GPU acceleration.

Usage:
    python train_xgboost_polymer.py

Output:
    polymer_xgb_model.json   — trained classifier (XGBoost)
    polymer_label_map.json   — class name → integer mapping
    polymer_feature_names.json — ordered list of band names used
"""

import json
import os
from pathlib import Path

import h5py
import numpy as np
import xgboost as xgb
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.preprocessing import LabelEncoder

# ── Config ────────────────────────────────────────────────────────────────────
H5_PATH  = Path(__file__).parent / "dataset.h5"
OUT_DIR  = Path(r"d:\Plastic-Ledger\models\polymer")
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_OUT = OUT_DIR / "polymer_xgb_model.json"
LABEL_MAP_OUT = OUT_DIR / "polymer_label_map.json"
FEAT_OUT  = OUT_DIR / "polymer_feature_names.json"

# The 13 Sentinel-2 spectral band columns present in the h5
SPECTRAL_BANDS = [
    "nm440", "nm490", "nm560", "nm665", "nm705",
    "nm740", "nm783", "nm842", "nm865",
    "nm1600", "nm2200",
]

# Extra indices that MARIDA derives (if present, use them too)
OPTIONAL_BANDS = ["FDI", "PI"]   # Floating Debris Index, Plastic Index

# Plastic-type classes (Marine Debris = known plastic/debris litter)
PLASTIC_CLASSES = {"Marine Debris"}

# ── Load data from h5 ────────────────────────────────────────────────────────

def load_split(f: h5py.File, split: str):
    """Load spectral features + class labels from one h5 split."""
    tbl = f[split]["table"][:]
    dtype_names = set(tbl.dtype.names)

    # Determine which bands actually exist in this file
    bands = [b for b in SPECTRAL_BANDS if b in dtype_names]
    for ob in OPTIONAL_BANDS:
        if ob in dtype_names:
            bands.append(ob)

    X = np.stack([tbl[b].astype(np.float32) for b in bands], axis=1)
    y_raw = np.array([c.decode() if isinstance(c, bytes) else c
                      for c in tbl["Class"]])

    return X, y_raw, bands


def main():
    print(f"Loading MARIDA spectral signatures from {H5_PATH} ...")
    with h5py.File(H5_PATH, "r") as f:
        X_train, y_train_raw, bands = load_split(f, "train")
        X_val,   y_val_raw,   _     = load_split(f, "val")
        X_test,  y_test_raw,  _     = load_split(f, "test")

    print(f"  Train: {X_train.shape[0]:,} pixels  |  {len(bands)} bands")
    print(f"  Val:   {X_val.shape[0]:,} pixels")
    print(f"  Test:  {X_test.shape[0]:,} pixels")
    print(f"  Bands: {bands}")

    # Combine train + val for final training
    X_all  = np.vstack([X_train, X_val])
    y_all  = np.concatenate([y_train_raw, y_val_raw])

    # ── Label encoding ─────────────────────────────────────────────────────
    le = LabelEncoder()
    le.fit(np.concatenate([y_all, y_test_raw]))
    y_enc_all  = le.transform(y_all)
    y_enc_test = le.transform(y_test_raw)

    classes = list(le.classes_)
    num_classes = len(classes)
    print(f"\nClasses ({num_classes}):")
    for i, c in enumerate(classes):
        n = np.sum(y_all == c)
        marker = " <-- PLASTIC" if c in PLASTIC_CLASSES else ""
        print(f"  [{i:2d}] {c:<35}  {n:>8,} pixels{marker}")

    # ── Class weights — heavily upweight Marine Debris ─────────────────────
    # XGBoost handles sample weights via the DMatrix
    sample_weights_all = np.ones(len(y_enc_all), dtype=np.float32)
    debris_idx = le.transform(["Marine Debris"])[0]
    
    # We apply a large multiplier for the Marine Debris class
    debris_mask = (y_enc_all == debris_idx)
    sample_weights_all[debris_mask] = 20.0

    print("\nPreparing DMatrix for XGBoost...")
    dtrain = xgb.DMatrix(X_all, label=y_enc_all, weight=sample_weights_all, feature_names=bands)
    dtest = xgb.DMatrix(X_test, label=y_enc_test, feature_names=bands)

    # ── Train XGBoost ──────────────────────────────────────────────────────
    print("\nTraining XGBoost on GPU...")
    params = {
        "objective": "multi:softmax",
        "num_class": num_classes,
        "tree_method": "hist",
        "device": "cuda",
        "max_depth": 8,
        "eta": 0.1,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "eval_metric": ["merror", "mlogloss"],
        "seed": 42
    }

    evals = [(dtrain, "train"), (dtest, "test")]
    xgb_model = xgb.train(
        params=params,
        dtrain=dtrain,
        num_boost_round=300,
        evals=evals,
        early_stopping_rounds=30,
        verbose_eval=50
    )

    # ── Evaluate on test set ────────────────────────────────────────────────
    print("\nEvaluating on test set...")
    y_pred = xgb_model.predict(dtest)

    print("\n" + "="*65)
    print("  POLYMER CLASSIFICATION — TEST SET RESULTS (XGBOOST)")
    print("="*65)
    print(classification_report(
        y_enc_test, y_pred,
        target_names=classes,
        digits=3,
        zero_division=0,
    ))

    # Debris-specific metrics
    test_debris_mask = (y_enc_test == debris_idx)
    if test_debris_mask.any():
        debris_preds = y_pred[test_debris_mask]
        recall_d  = (debris_preds == debris_idx).mean()
        non_debris_mask = (y_enc_test != debris_idx)
        fp_rate = (y_pred[non_debris_mask] == debris_idx).mean()
        print(f"  Marine Debris Recall:         {recall_d*100:.1f}%")
        print(f"  False Positive Rate (debris): {fp_rate*100:.2f}%")
    print("="*65)

    # Feature importances
    scores = xgb_model.get_score(importance_type="gain")
    importances = {k: v for k, v in sorted(scores.items(), key=lambda item: item[1], reverse=True)}
    print("\nTop feature importances (gain):")
    for rank, (feat, score) in enumerate(importances.items()):
        print(f"  {rank+1}. {feat:<12}: {score:.4f}")

    # ── Save artefacts ─────────────────────────────────────────────────────
    xgb_model.save_model(MODEL_OUT)
    print(f"\nModel saved  -> {MODEL_OUT}")

    label_map = {c: int(le.transform([c])[0]) for c in classes}
    with open(LABEL_MAP_OUT, "w") as fh:
        json.dump(label_map, fh, indent=2)
    print(f"Label map    -> {LABEL_MAP_OUT}")

    with open(FEAT_OUT, "w") as fh:
        json.dump(bands, fh, indent=2)
    print(f"Feature list -> {FEAT_OUT}")

    print("\n[OK] Stage 4 XGBoost polymer model training complete!")


if __name__ == "__main__":
    main()
