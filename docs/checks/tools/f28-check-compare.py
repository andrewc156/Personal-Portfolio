"""F28 check: before/after composites and pixel diffs of the §11.5 shots.

Usage: python3 docs/checks/tools/f28-check-compare.py
Writes docs/checks/F28b/attempt-1/compare-*.png (home, garden, settings) and
docs/checks/F28c/attempt-1/compare-*.png (rising-water, explorer controls), plus diff stats.
"""
import json
import os
from PIL import Image, ImageChops, ImageDraw

SH = 'docs/checks/F28b/attempt-1/shots'
OUTB = 'docs/checks/F28b/attempt-1'
OUTC = 'docs/checks/F28c/attempt-1'
os.makedirs(OUTC, exist_ok=True)
stats = {}


def diff(a, b):
    if a.size != b.size:
        return {'size': [a.size, b.size]}
    d = ImageChops.difference(a.convert('RGB'), b.convert('RGB')).convert('L')
    px = sum(1 for v in d.getdata() if v > 24)
    return {'changedPx': px, 'pct': round(100 * px / (a.size[0] * a.size[1]), 2), 'bbox': d.point(lambda v: 255 if v > 24 else 0).getbbox()}


for kind in ['home', 'garden', 'settings', 'rising-water', 'excontrols']:
    for w in [375, 768, 1280]:
        tiles = []
        for scheme in ['light', 'dark']:
            pb = f'{SH}/base-{kind}-{w}-{scheme}.png'
            pc = f'{SH}/cur-{kind}-{w}-{scheme}.png'
            if not (os.path.exists(pb) and os.path.exists(pc)):
                continue
            a, b = Image.open(pb), Image.open(pc)
            stats[f'{kind}-{w}-{scheme}'] = diff(a, b)
            tiles += [(f'BASE {scheme}', a), (f'F28 {scheme}', b)]
        if not tiles:
            continue
        scale = 0.5 if w >= 768 and kind != 'excontrols' else 1.0
        tiles = [(t, im.resize((int(im.size[0] * scale), int(im.size[1] * scale)))) for t, im in tiles]
        W = sum(im.size[0] for _, im in tiles) + 8 * (len(tiles) + 1)
        H = max(im.size[1] for _, im in tiles) + 30
        canvas = Image.new('RGB', (W, H), (120, 120, 120))
        dr = ImageDraw.Draw(canvas)
        x = 8
        for t, im in tiles:
            dr.text((x, 8), t, fill=(255, 255, 255))
            canvas.paste(im, (x, 24))
            x += im.size[0] + 8
        out = OUTC if kind in ('rising-water', 'excontrols') else OUTB
        canvas.save(f'{out}/compare-{kind}-{w}.png')
print(json.dumps(stats, indent=1))
json.dump(stats, open(f'{OUTB}/compare-diffstats.json', 'w'), indent=1)
