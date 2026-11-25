# F9 attempt 4: cut every full-page PNG into segments and pack them into review sheets
# (<= ~2000x1500 px each, so nothing is downscaled much when viewed). Checker-owned.
# Run: pipeline/.venv/bin/python docs/checks/tools/f9a4_sheets.py
import glob
import json
import os

from PIL import Image, ImageDraw

D = "docs/checks/F9/attempt-4"
OUT = f"{D}/sheets"
os.makedirs(OUT, exist_ok=True)
SEG = {375: 1450, 768: 1450, 1280: 1100}
COLS = {375: 5, 768: 2, 1280: 1}
index = []
for path in sorted(glob.glob(f"{D}/*-*-*.png")):
    name = os.path.basename(path)[:-4]
    im = Image.open(path).convert("RGB")
    w = im.width
    seg_h, cols = SEG[w], COLS[w]
    segs = [im.crop((0, y, w, min(y + seg_h, im.height))) for y in range(0, im.height, seg_h)]
    for s in range(0, len(segs), cols):
        group = segs[s : s + cols]
        sheet = Image.new("RGB", (cols * (w + 12), seg_h + 24), (255, 0, 255))
        d = ImageDraw.Draw(sheet)
        d.rectangle([0, 0, sheet.width, 22], fill=(255, 255, 0))
        d.text((4, 5), f"{name}  segments {s + 1}-{s + len(group)} of {len(segs)}", fill=(0, 0, 0))
        for k, g in enumerate(group):
            sheet.paste(g, (k * (w + 12), 24))
        out = f"{OUT}/{name}__{s // cols + 1:02d}.png"
        sheet.save(out)
        index.append(out)
json.dump(index, open(f"{OUT}/index.json", "w"), indent=1)
print(len(index), "sheets")
