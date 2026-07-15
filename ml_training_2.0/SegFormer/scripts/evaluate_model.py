import os
import json
import argparse
from pathlib import Path
from datetime import datetime

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import numpy as np
import rasterio
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap

from transformers import SegformerForSemanticSegmentation, SegformerConfig

# CONFIG
NUM_CLASSES = 15
CLASS_MAP = {
    0: "Marine Debris", 1: "Dense Sargassum", 2: "Sparse Sargassum",
    3: "Natural Organic", 4: "Ship", 5: "Clouds", 6: "Marine Water",
    7: "Sediment-Laden Water", 8: "Foam", 9: "Turbid Water",
    10: "Shallow Water", 11: "Waves", 12: "Cloud Shadows",
    13: "Wakes", 14: "Mixed Water"
}

# Colors for visualization (Debris = Red, Water = Blue, etc.)
COLORS = [
    '#FF0000', '#00FF00', '#007F00', '#8B4513', '#808080', '#FFFFFF', '#0000FF',
    '#BDB76B', '#E0FFFF', '#4682B4', '#00CED1', '#4169E1', '#708090', '#F5FFFA', '#1E90FF'
]
CMAP = ListedColormap(COLORS)

class MARIDATestDataset(Dataset):
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.patches_dir = self.data_dir / "patches"
        
        split_path = self.data_dir / "splits" / "test_X.txt"
        self.patch_names = []
        if split_path.exists():
            names = [l.strip() for l in split_path.read_text().strip().splitlines() if l.strip()]
            for pname in names:
                parts = pname.rsplit("_", 1)
                scene = "S2_" + parts[0] if len(parts) == 2 else "S2_" + pname
                img_path = self.patches_dir / scene / f"S2_{pname}.tif"
                if img_path.exists():
                    self.patch_names.append((pname, img_path))

    def __len__(self):
        return len(self.patch_names)

    def __getitem__(self, idx):
        pname, img_path = self.patch_names[idx]
        lbl_path = img_path.parent / f"S2_{pname}_cl.tif"

        with rasterio.open(img_path) as src:
            image = src.read().astype(np.float32)
            image = np.nan_to_num(image)
        
        with rasterio.open(lbl_path) as src:
            label = src.read(1).astype(np.int64)

        mask = label == 0
        label = label - 1
        label[mask] = 255

        return torch.from_numpy(image), torch.from_numpy(label), pname, str(img_path)

def fast_hist(a, b, n):
    k = (a >= 0) & (a < n)
    return np.bincount(n * a[k].astype(int) + b[k], minlength=n ** 2).reshape(n, n)

def plot_patch(img, pred, gt, out_path, pname):
    # RGB mapping: Band 4 (Red), Band 3 (Green), Band 2 (Blue) in original 11 bands:
    # B01s(0), B02(1), B03(2), B04(3), B05(4), B06s(5), B07s(6), B08(7), B8A(8), B11(9), B12(10)
    rgb = img[[3, 2, 1], :, :]
    
    # Normalize RGB for visualization
    for i in range(3):
        p2, p98 = np.percentile(rgb[i], (2, 98))
        rgb[i] = np.clip((rgb[i] - p2) / (p98 - p2 + 1e-5), 0, 1)
    
    rgb = np.transpose(rgb, (1, 2, 0))
    
    gt_vis = np.ma.masked_where(gt == 255, gt)
    
    fig, axs = plt.subplots(1, 3, figsize=(16, 6))
    
    titles = [f"RGB ({pname})", "Ground Truth (Red=Debris)", "Prediction"]
    images = [rgb, gt_vis, pred]
    cmaps = [None, CMAP, CMAP]
    vmins = [None, 0, 0]
    vmaxs = [None, 14, 14]
    
    for ax, title, img_data, cmap, vmin, vmax in zip(axs, titles, images, cmaps, vmins, vmaxs):
        ax.imshow(img_data, cmap=cmap, vmin=vmin, vmax=vmax)
        ax.set_title(title, fontsize=16, fontweight='bold', pad=15)
        # Keep the axis (for the black outline) but remove ticks
        ax.set_xticks([])
        ax.set_yticks([])
        # Set a slightly thicker black outline
        for spine in ax.spines.values():
            spine.set_edgecolor('black')
            spine.set_linewidth(2)
            
    plt.tight_layout()
    plt.savefig(out_path, bbox_inches='tight', dpi=150)
    plt.close()

def create_segformer_model():
    model = SegformerForSemanticSegmentation.from_pretrained(
        "nvidia/segformer-b2-finetuned-ade-512-512",
        num_labels=NUM_CLASSES,
        ignore_mismatched_sizes=True
    )
    
    # Adapt the first layer to accept 11 channels instead of 3
    old_conv = model.segformer.stages[0].patch_embeddings.proj
    new_conv = nn.Conv2d(
        in_channels=11, 
        out_channels=old_conv.out_channels, 
        kernel_size=old_conv.kernel_size, 
        stride=old_conv.stride, 
        padding=old_conv.padding, 
        bias=(old_conv.bias is not None)
    )
    
    with torch.no_grad():
        new_conv.weight.data[:, :3, :, :] = old_conv.weight.clone()
        if old_conv.bias is not None:
            new_conv.bias.data = old_conv.bias.clone()
            
    model.segformer.stages[0].patch_embeddings.proj = new_conv
    model.config.num_channels = 11
    return model

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir", required=True)
    parser.add_argument("--model_dir", required=True)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluation starting on {device}...")

    # Load Model
    model = create_segformer_model()
    model_path = Path(args.model_dir) / "best_model.pth"
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model.to(device)
    model.eval()

    test_dataset = MARIDATestDataset(args.data_dir)
    print(f"Test patches found: {len(test_dataset)}")
    
    out_dir = Path(args.model_dir) / "evaluation"
    vis_dir = out_dir / "visuals"
    vis_dir.mkdir(parents=True, exist_ok=True)

    hist = np.zeros((NUM_CLASSES, NUM_CLASSES))
    
    debris_patches = []

    print("Running inference on test_X...")
    with torch.no_grad():
        for i in range(len(test_dataset)):
            img_t, lbl_t, pname, img_path = test_dataset[i]
            img_batch = img_t.unsqueeze(0).to(device)
            
            outputs = model(pixel_values=img_batch)
            logits = outputs.logits
            
            # Upsample from H/4 to H
            upsampled_logits = nn.functional.interpolate(logits, size=(256, 256), mode="bilinear", align_corners=False)
            
            pred = upsampled_logits.argmax(dim=1).squeeze(0).cpu().numpy()
            lbl = lbl_t.numpy()
            
            hist += fast_hist(lbl.flatten(), pred.flatten(), NUM_CLASSES)
            
            # Save visual if it contains Debris in GT
            if 0 in lbl and len(debris_patches) < 10:
                debris_patches.append((img_t.numpy(), pred, lbl, pname))
            
            if i % 50 == 0:
                print(f"Processed {i}/{len(test_dataset)} patches")

    print(f"Generating {len(debris_patches)} visual overlays...")
    for img, pred, lbl, pname in debris_patches:
        plot_patch(img, pred, lbl, vis_dir / f"{pname}.png", pname)

    # Calculate metrics
    eps = 1e-7
    tp = np.diag(hist)
    fp = hist.sum(axis=0) - tp
    fn = hist.sum(axis=1) - tp

    iou = tp / (tp + fp + fn + eps)
    precision = tp / (tp + fp + eps)
    recall = tp / (tp + fn + eps)
    f1 = 2 * (precision * recall) / (precision + recall + eps)

    # Filter out classes with no ground truth or predictions
    valid_classes = (hist.sum(axis=1) + hist.sum(axis=0)) > 0
    miou = np.nanmean(iou[valid_classes])

    metrics = {
        "mIoU": float(miou),
        "Debris": {
            "IoU": float(iou[0]),
            "Precision": float(precision[0]),
            "Recall": float(recall[0]),
            "F1": float(f1[0])
        },
        "per_class_iou": {CLASS_MAP[c]: float(iou[c]) for c in range(NUM_CLASSES) if valid_classes[c]},
        "confusion_matrix": hist.tolist()
    }

    with open(out_dir / "benchmark_results.json", "w") as f:
        json.dump(metrics, f, indent=2)

    # Generate Markdown Report
    rpt = [
        "# Model Evaluation Benchmark",
        f"- **Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "- **Test Set**: MARIDA test_X (359 patches)",
        f"- **Model**: SegFormer (B2) from {args.model_dir}",
        "",
        "## Key Metrics",
        f"- **mIoU**: {metrics['mIoU']:.4f}",
        f"- **Debris IoU**: {metrics['Debris']['IoU']:.4f}",
        f"- **Debris Precision**: {metrics['Debris']['Precision']:.4f}",
        f"- **Debris Recall**: {metrics['Debris']['Recall']:.4f}",
        f"- **Debris F1**: {metrics['Debris']['F1']:.4f}",
        "",
        "## Per-Class IoU",
        "| Class | IoU |",
        "|-------|-----|"
    ]
    for cname, ciou in metrics["per_class_iou"].items():
        rpt.append(f"| {cname} | {ciou:.4f} |")
    
    (out_dir / "benchmark.md").write_text("\n".join(rpt))
    print(f"\nEvaluation Complete! Results saved to: {out_dir}")

if __name__ == "__main__":
    main()
