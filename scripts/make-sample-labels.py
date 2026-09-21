#!/usr/bin/env python3
"""Render fictional pharmacy label PNGs into public/samples/.

Synthetic labels = zero PHI, clearly demo data. Style mimics a typical US
retail-pharmacy label: pharmacy band on top, drug name bold, sig, qty/refills,
warning strips at the bottom.
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 880, 560
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "samples")

def font(size, bold=False):
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
        "/usr/share/fonts/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
        "/usr/share/fonts/truetype/liberation/LiberationSans-%s.ttf" % ("Bold" if bold else "Regular"),
    ]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def label(pharmacy, drug_line, generic_line, sig, qty, refills, patient, prescriber, rx, warnings, band=(196, 30, 43)):
    img = Image.new("RGB", (W, H), (252, 251, 248))
    d = ImageDraw.Draw(img)
    # pharmacy band
    d.rectangle([0, 0, W, 74], fill=band)
    d.text((26, 20), pharmacy, font=font(30, True), fill="white")
    d.text((W - 250, 28), "24HR 1-800-555-0100", font=font(18), fill=(255, 220, 220))
    # rx / patient
    d.text((30, 96), f"Rx# {rx}", font=font(20, True), fill=(40, 40, 45))
    d.text((300, 96), prescriber, font=font(20), fill=(40, 40, 45))
    d.text((30, 130), patient, font=font(20), fill=(40, 40, 45))
    d.line([30, 164, W - 30, 164], fill=(180, 180, 185), width=2)
    # drug
    d.text((30, 184), drug_line, font=font(40, True), fill=(15, 15, 20))
    d.text((30, 238), generic_line, font=font(22), fill=(80, 80, 90))
    # sig
    d.text((30, 288), sig, font=font(26), fill=(15, 15, 20))
    d.text((30, 336), f"Qty: {qty}", font=font(22), fill=(40, 40, 45))
    d.text((300, 336), f"Refills: {refills}", font=font(22), fill=(40, 40, 45))
    d.line([30, 376, W - 30, 376], fill=(180, 180, 185), width=2)
    # warning strips
    y = 394
    for w in warnings:
        d.rectangle([30, y, W - 30, y + 34], fill=(255, 240, 180))
        d.rectangle([30, y, 38, y + 34], fill=(230, 160, 20))
        d.text((52, y + 7), w, font=font(19, True), fill=(120, 70, 0))
        y += 40
    d.text((30, H - 34), "FICTIONAL SAMPLE LABEL — generated for demo purposes only.", font=font(15), fill=(150, 150, 155))
    return img

JOBS = [
    ("warfarin.png", label(
        "Maple Grove Pharmacy",
        "WARFARIN SODIUM 5 MG TABLETS",
        "(generic for Coumadin)",
        "Take one tablet by mouth once daily",
        "30 tablets", "2",
        "Maria Garcia   DOB 03/15/1955", "Dr. A. Chen",
        "7002341",
        ["Do not take aspirin or ibuprofen unless approved by your doctor",
         "Report unusual bleeding or bruising immediately"],
    )),
    ("ibuprofen.png", label(
        "Maple Grove Pharmacy",
        "IBUPROFEN 200 MG TABLETS",
        "(generic for Advil)  OTC",
        "Take one tablet every 6 hours as needed for pain",
        "100 tablets", "0",
        "Maria Garcia", "— over the counter —",
        "OTC-4431",
        ["Take with food or milk",
         "Ask a doctor before use if you take a blood thinner"],
        band=(30, 90, 160),
    )),
    ("lisinopril.png", label(
        "Maple Grove Pharmacy",
        "LISINOPRIL 10 MG TABLETS",
        "(generic for Zestril)",
        "Take one tablet by mouth once daily",
        "90 tablets", "3",
        "Maria Garcia   DOB 03/15/1955", "Dr. A. Chen",
        "7002355",
        ["May cause dizziness — rise slowly",
         "Avoid potassium supplements unless directed"],
    )),
    ("simvastatin.png", label(
        "Maple Grove Pharmacy",
        "SIMVASTATIN 20 MG TABLETS",
        "(generic for Zocor)",
        "Take one tablet by mouth at bedtime",
        "30 tablets", "5",
        "Maria Garcia   DOB 03/15/1955", "Dr. A. Chen",
        "7002402",
        ["Avoid grapefruit and grapefruit juice",
         "Report unexplained muscle pain or weakness"],
    )),
]

def main():
    os.makedirs(OUT, exist_ok=True)
    for name, img in JOBS:
        p = os.path.join(OUT, name)
        img.save(p, "PNG")
        print(f"✓ {name}  {os.path.getsize(p)} bytes")

if __name__ == "__main__":
    main()
