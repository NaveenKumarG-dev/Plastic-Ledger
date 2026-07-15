import os
import json
import argparse
from pathlib import Path
import numpy as np
import rasterio

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import matplotlib.pyplot as plt
import segmentation_models_pytorch as smp

# HuggingFace Transformers
from transformers import SegformerForSemanticSegmentation, SegformerConfig

# CONFIG
NUM_CLASSES = 15
CONFIG = {
    "batch_size": 8,  # SegFormer-B2 is heavier than ResNet34, use batch=8 to avoid OOM
    "learning_rate": 2e-4,
    "weight_decay": 1e-4,
    "focal_gamma": 2.0,
    "focal_alpha": 0.25,
    "dice_weight": 0.5
}

class MARIDADataset(Dataset):
    def __init__(self, data_dir: str, split: str = "train_X", augment: bool = False):
        self.data_dir = Path(data_dir)
        self.patches_dir = self.data_dir / "patches"
        self.augment = augment
        
        split_path = self.data_dir / "splits" / f"{split}.txt"
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

        if self.augment:
            if np.random.random() > 0.5:
                image = np.flip(image, axis=2).copy()
                label = np.flip(label, axis=1).copy()
            if np.random.random() > 0.5:
                image = np.flip(image, axis=1).copy()
                label = np.flip(label, axis=0).copy()
            k = np.random.randint(0, 4)
            if k > 0:
                image = np.rot90(image, k=k, axes=(1, 2)).copy()
                label = np.rot90(label, k=k, axes=(0, 1)).copy()

        return torch.from_numpy(image), torch.from_numpy(label)

class FocalLoss(nn.Module):
    def __init__(self, gamma=2.0, alpha=0.25, ignore_index=255):
        super().__init__()
        self.gamma = gamma
        self.alpha = alpha
        self.ignore_index = ignore_index

    def forward(self, inputs, targets):
        ce_loss = nn.functional.cross_entropy(inputs, targets, reduction="none", ignore_index=self.ignore_index)
        pt = torch.exp(-ce_loss)
        focal_loss = self.alpha * (1 - pt) ** self.gamma * ce_loss
        return focal_loss.mean()

class ComboLoss(nn.Module):
    def __init__(self, gamma=2.0, alpha=0.25, dice_weight=0.5, ignore_index=255):
        super().__init__()
        self.focal = FocalLoss(gamma=gamma, alpha=alpha, ignore_index=ignore_index)
        self.dice = smp.losses.DiceLoss(mode="multiclass", ignore_index=ignore_index)
        self.dice_weight = dice_weight

    def forward(self, inputs, targets):
        focal_loss = self.focal(inputs, targets)
        dice_loss = self.dice(inputs, targets)
        return (1 - self.dice_weight) * focal_loss + self.dice_weight * dice_loss

def compute_metrics(predictions, targets, num_classes=15):
    valid = targets != 255
    pred_valid = predictions[valid]
    targ_valid = targets[valid]
    
    ious = []
    for cls in range(num_classes):
        pred_cls = (pred_valid == cls)
        targ_cls = (targ_valid == cls)
        
        intersection = (pred_cls & targ_cls).sum().item()
        union = (pred_cls | targ_cls).sum().item()
        
        if union == 0:
            ious.append(np.nan)
        else:
            ious.append(intersection / union)
            
    miou = np.nanmean(ious)
    debris_iou = ious[0] if not np.isnan(ious[0]) else 0.0
    return miou, debris_iou

def create_segformer_model():
    # Load Segformer-B2
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
    
    # Copy weights for RGB channels (B04, B03, B02 which are idx 3, 2, 1)
    # The rest are randomly initialized
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
    parser.add_argument("--output_dir", required=True)
    parser.add_argument("--epochs", type=int, default=50)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}", flush=True)

    train_dataset = MARIDADataset(args.data_dir, split="train_X", augment=True)
    val_dataset = MARIDADataset(args.data_dir, split="val_X", augment=False)
    print(f"Train patches: {len(train_dataset)}, Val patches: {len(val_dataset)}", flush=True)

    train_loader = DataLoader(train_dataset, batch_size=CONFIG["batch_size"], shuffle=True, num_workers=4, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=CONFIG["batch_size"], shuffle=False, num_workers=4, pin_memory=True)

    model = create_segformer_model()
    model.to(device)

    criterion = ComboLoss(gamma=CONFIG["focal_gamma"], alpha=CONFIG["focal_alpha"], dice_weight=CONFIG["dice_weight"])
    optimizer = optim.AdamW(model.parameters(), lr=CONFIG["learning_rate"], weight_decay=CONFIG["weight_decay"])
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    best_val_iou = -1.0
    metrics_log = []

    for epoch in range(args.epochs):
        model.train()
        train_loss = 0.0
        train_preds, train_targs = [], []
        
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            
            # SegFormer outputs logits at H/4, W/4
            outputs = model(pixel_values=images)
            logits = outputs.logits
            # Upsample to 256x256
            upsampled_logits = nn.functional.interpolate(logits, size=labels.shape[-2:], mode="bilinear", align_corners=False)
            
            loss = criterion(upsampled_logits, labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            preds = upsampled_logits.argmax(dim=1).cpu().numpy()
            train_preds.append(preds)
            train_targs.append(labels.cpu().numpy())

        scheduler.step()

        # Validation
        model.eval()
        val_loss = 0.0
        val_preds, val_targs = [], []
        
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                
                outputs = model(pixel_values=images)
                logits = outputs.logits
                upsampled_logits = nn.functional.interpolate(logits, size=labels.shape[-2:], mode="bilinear", align_corners=False)
                
                loss = criterion(upsampled_logits, labels)
                val_loss += loss.item()
                
                preds = upsampled_logits.argmax(dim=1).cpu().numpy()
                val_preds.append(preds)
                val_targs.append(labels.cpu().numpy())

        train_preds = np.concatenate(train_preds)
        train_targs = np.concatenate(train_targs)
        val_preds = np.concatenate(val_preds)
        val_targs = np.concatenate(val_targs)

        train_miou, train_debris_iou = compute_metrics(train_preds, train_targs)
        val_miou, val_debris_iou = compute_metrics(val_preds, val_targs)

        epoch_metrics = {
            "epoch": epoch + 1,
            "train_loss": train_loss / len(train_loader),
            "val_loss": val_loss / len(val_loader),
            "train_miou": train_miou,
            "train_debris_iou": train_debris_iou,
            "val_miou": val_miou,
            "val_debris_iou": val_debris_iou
        }
        metrics_log.append(epoch_metrics)
        
        print(f"Epoch {epoch+1}/{args.epochs}", flush=True)
        print(f"  Train Loss: {epoch_metrics['train_loss']:.4f}, Val Loss: {epoch_metrics['val_loss']:.4f}", flush=True)
        print(f"  Train mIoU: {epoch_metrics['train_miou']:.4f}, Val mIoU: {epoch_metrics['val_miou']:.4f}", flush=True)
        print(f"  Train Debris IoU: {epoch_metrics['train_debris_iou']:.4f}, Val Debris IoU: {epoch_metrics['val_debris_iou']:.4f}", flush=True)

        if epoch_metrics["val_debris_iou"] > best_val_iou:
            best_val_iou = epoch_metrics["val_debris_iou"]
            torch.save(model.state_dict(), out_dir / "best_model.pth")
            
        with open(out_dir / "metrics.json", "w") as f:
            json.dump(metrics_log, f, indent=2)

    # Visualization
    epochs_range = range(1, args.epochs + 1)
    train_losses = [m["train_loss"] for m in metrics_log]
    val_losses = [m["val_loss"] for m in metrics_log]
    train_debris = [m["train_debris_iou"] for m in metrics_log]
    val_debris = [m["val_debris_iou"] for m in metrics_log]

    plt.figure(figsize=(12, 5))
    plt.subplot(1, 2, 1)
    plt.plot(epochs_range, train_losses, label='Train Loss')
    plt.plot(epochs_range, val_losses, label='Val Loss')
    plt.title('Loss Over Epochs')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    
    plt.subplot(1, 2, 2)
    plt.plot(epochs_range, train_debris, label='Train Debris IoU')
    plt.plot(epochs_range, val_debris, label='Val Debris IoU')
    plt.title('Debris IoU Over Epochs')
    plt.xlabel('Epoch')
    plt.ylabel('IoU')
    plt.legend()
    
    plt.tight_layout()
    plt.savefig(out_dir / "training_plot.png")
    plt.close()
    
    print(f"Training complete. Logs, model, and plots saved to {out_dir}", flush=True)

if __name__ == "__main__":
    main()
