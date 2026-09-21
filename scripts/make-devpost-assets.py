#!/usr/bin/env python3
"""Devpost submission assets: thumbnail (1200x800) + 3:2 gallery crops."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "devpost")
os.makedirs(OUT, exist_ok=True)

def font(size, bold=False):
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
        "/usr/share/fonts/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
    ]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

TEAL = (13, 148, 136)
DARK = (20, 28, 30)
LIGHT = (244, 247, 246)

def rounded(d, box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)

def capsule(d, cx, cy, w, h, c1, c2, angle=0):
    """draw a two-tone capsule pill"""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(img)
    r = h // 2
    dd.rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=c2)
    dd.pieslice([0, 0, h, h], 90, 270, fill=c1)
    dd.rectangle([r - 1, 0, w // 2, h - 1], fill=c1)
    if angle:
        img = img.rotate(angle, expand=True, resample=Image.BICUBIC)
    return img

# ---------------- thumbnail 1200x800 ----------------
img = Image.new("RGB", (1200, 800), LIGHT)
d = ImageDraw.Draw(img)

# soft radial-ish wash: big pale teal circle behind content
d.ellipse([780, -260, 1500, 460], fill=(224, 242, 240))
d.ellipse([-300, 520, 320, 1140], fill=(228, 243, 240))

# scattered capsules
cap1 = capsule(d, 0, 0, 220, 92, TEAL, (255, 255, 255), angle=-18)
img.paste(cap1, (910, 580), cap1)
cap2 = capsule(d, 0, 0, 150, 62, (94, 200, 190), TEAL, angle=24)
img.paste(cap2, (1010, 60), cap2)
cap3 = capsule(d, 0, 0, 150, 64, (255, 255, 255), (148, 210, 205), angle=-30)
img.paste(cap3, (140, 620), cap3)

# icon badge: teal rounded square with white capsule-cross
bx, by, bs = 130, 150, 150
rounded(d, [bx, by, bx + bs, by + bs], 34, TEAL)
# medical cross
cx, cy, cw, ct = bx + bs // 2, by + bs // 2, 26, 82
d.rounded_rectangle([cx - ct // 2, cy - cw, cx + ct // 2, cy + cw], radius=13, fill="white")
d.rounded_rectangle([cx - cw, cy - ct // 2, cx + cw, cy + ct // 2], radius=13, fill="white")

# wordmark + tagline
d.text((320, 160), "DoseWise", font=font(118, True), fill=DARK)
d.text((134, 350), "Point your camera at the pill bottles.", font=font(44, True), fill=TEAL)
d.text((134, 415), "Get the whole picture — safely.", font=font(44, True), fill=DARK)

# feature chips
chips = ["photo → med list", "interaction alerts", "daily schedule", "no account"]
x = 134
for c in chips:
    t = font(24, True)
    tw = d.textlength(c, font=t)
    rounded(d, [x, 520, x + tw + 40, 572], 26, (226, 240, 238))
    d.text((x + 20, 534), c, font=t, fill=(10, 110, 100))
    x += tw + 40 + 14

d.text((134, 690), "InfinityX Global Hackathon 2K26", font=font(26), fill=(120, 130, 135))
d.text((134, 728), "georgefifth.github.io/dosewise", font=font(26, True), fill=TEAL)

img.save(os.path.join(OUT, "thumbnail.png"))
print("✓ thumbnail.png")

# ---------------- 3:2 gallery crops ----------------
def crop32(src, dst, anchor="top"):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    tw = w
    th = round(w * 2 / 3)
    if th > h:  # too tall? crop width instead
        th = h
        tw = round(h * 3 / 2)
    x0 = (w - tw) // 2
    y0 = 0 if anchor == "top" else (h - th) // 2
    im.crop((x0, y0, x0 + tw, y0 + th)).save(dst)
    print(f"✓ {os.path.basename(dst)}  {tw}x{th}")

crop32("/tmp/dosewise-shots/01-landing.png", os.path.join(OUT, "g1-landing.png"))
crop32("/tmp/dosewise-shots/02-confirm.png", os.path.join(OUT, "g2-confirm.png"))
crop32("/tmp/dosewise-shots/03-results-top.png", os.path.join(OUT, "g3-results.png"))
crop32("/tmp/frame52.png", os.path.join(OUT, "g4-alerts.png"))

# ---------------- sample-label grid (what the camera reads) ----------------
grid = Image.new("RGB", (1200, 800), LIGHT)
gd = ImageDraw.Draw(grid)
names = ["warfarin", "ibuprofen", "lisinopril", "simvastatin"]
for i, n in enumerate(names):
    im = Image.open(os.path.join(ROOT, "public", "samples", f"{n}.png")).convert("RGB")
    im = im.resize((560, 356))
    x = 40 + (i % 2) * 590
    y = 60 + (i // 2) * 390
    grid.paste(im, (x, y))
    gd.rectangle([x, y, x + 560, y + 356], outline=(200, 205, 205), width=2)
gd.text((40, 22), "What the camera reads →", font=font(28, True), fill=DARK)
grid.save(os.path.join(OUT, "g5-labels.png"))
print("✓ g5-labels.png")
