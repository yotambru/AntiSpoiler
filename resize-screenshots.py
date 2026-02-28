#!/usr/bin/env python3
"""Resize screenshots to Chrome Store dimensions with proper aspect ratio (no distortion)."""
from PIL import Image
import os

BG_LIGHT = (245, 245, 245)  # Light gray - for light/white page backgrounds

def resize_fit(img_path, out_path, target=(1280, 800), bg_color=BG_LIGHT):
    img = Image.open(img_path).convert("RGB")
    img.thumbnail(target, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", target, bg_color)
    x = (target[0] - img.width) // 2
    y = (target[1] - img.height) // 2
    canvas.paste(img, (x, y))
    canvas.save(out_path, "PNG", optimize=True)

if __name__ == "__main__":
    assets = "/Users/yotam.bru/.cursor/projects/Users-yotam-bru-Documents-Code-AntiSpoiler/assets"
    out_dir = "/Users/yotam.bru/Documents/Code/AntiSpoiler/chrome-store-screenshots"
    src = "Screenshot_2026-02-23_at_1.12.51_PM-42d40df5-9bb3-44ab-83f3-4efeee023cc8.png"
    dst = "screenshot5-foxsports-1280x800.png"
    src_path = os.path.join(assets, src)
    out_path = os.path.join(out_dir, dst)
    os.makedirs(out_dir, exist_ok=True)
    resize_fit(src_path, out_path, target=(1280, 800))
    print(f"Created {out_path}")
