"""Contact sheets: one per screenshot kind, the 6 variants side by side (scaled to 1/2)."""
import glob
import os
import sys
from PIL import Image
d = sys.argv[1]
kinds = sorted({os.path.basename(p).rsplit('-', 2)[0] for p in glob.glob(f'{d}/*.png') if not os.path.basename(p).startswith('corrupt')})
for k in kinds:
    ims = []
    for th in ['light', 'dark']:
        for w in ['375', '768', '1280']:
            p = f'{d}/{k}-{w}-{th}.png'
            if os.path.exists(p):
                ims.append((p, Image.open(p)))
    if not ims:
        continue
    scale = 0.5
    maxh = 1800
    tiles = []
    for p, im in ims:
        im = im.resize((int(im.width * scale), int(im.height * scale)))
        if im.height > maxh:
            im = im.crop((0, 0, im.width, maxh))
        tiles.append(im)
    W = sum(t.width for t in tiles) + 10 * len(tiles)
    H = max(t.height for t in tiles)
    sheet = Image.new('RGB', (W, H), (255, 0, 255))
    x = 0
    for t in tiles:
        sheet.paste(t, (x, 0))
        x += t.width + 10
    sheet.save(f'{d}/sheets/{k}.png')
    print(k, sheet.size)
