# Checker throwaway: stack PNGs vertically into contact sheets with labels.
import sys
from PIL import Image, ImageDraw

out, *paths = sys.argv[1:]
ims = [Image.open(p).convert("RGB") for p in paths]
W = max(i.width for i in ims)
H = sum(i.height + 22 for i in ims)
sheet = Image.new("RGB", (W, H), (200, 0, 200))
d = ImageDraw.Draw(sheet)
y = 0
for p, im in zip(paths, ims):
    d.rectangle([0, y, W, y + 22], fill=(255, 255, 0))
    d.text((4, y + 5), p.split("/")[-1], fill=(0, 0, 0))
    sheet.paste(im, (0, y + 22))
    y += im.height + 22
sheet.save(out)
print(out, sheet.size)
