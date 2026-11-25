# F9 attempt 4: grid sheets of the stretch screenshots (checker-owned).
import glob
import os

from PIL import Image, ImageDraw

D = "docs/checks/F9/attempt-4/stretch"
os.makedirs(f"{D}/sheets", exist_ok=True)


def sheet(paths, cols, out, maxh=None):
    ims = [Image.open(p).convert("RGB") for p in paths]
    if maxh:
        ims = [i.crop((0, 0, i.width, min(i.height, maxh))) for i in ims]
    w = max(i.width for i in ims)
    h = max(i.height for i in ims)
    rows = (len(ims) + cols - 1) // cols
    s = Image.new("RGB", (cols * (w + 8), rows * (h + 22)), (255, 0, 255))
    d = ImageDraw.Draw(s)
    for k, (p, im) in enumerate(zip(paths, ims)):
        x, y = (k % cols) * (w + 8), (k // cols) * (h + 22)
        d.rectangle([x, y, x + w, y + 20], fill=(255, 255, 0))
        d.text((x + 3, y + 4), os.path.basename(p), fill=(0, 0, 0))
        s.paste(im, (x, y + 22))
    s.save(out)
    print(out, s.size)


for scheme in ("light", "dark"):
    sheet(sorted(glob.glob(f"{D}/hero-*-375-{scheme}.png")), 6, f"{D}/sheets/hero-375-{scheme}.png")
    hero1280 = sorted(glob.glob(f"{D}/hero-*-1280-{scheme}.png"))
    sheet(hero1280[:3], 3, f"{D}/sheets/hero-1280-{scheme}-a.png")
    sheet(hero1280[3:], 3, f"{D}/sheets/hero-1280-{scheme}-b.png")
    sheet(
        [f"{D}/explorer-mask-labels-375-{scheme}.png", f"{D}/explorer-panel-375-{scheme}.png"],
        2,
        f"{D}/sheets/explorer-375-{scheme}.png",
        maxh=2400,
    )
    sheet(
        [f"{D}/explorer-mask-labels-1280-{scheme}.png", f"{D}/explorer-panel-1280-{scheme}.png"],
        2,
        f"{D}/sheets/explorer-1280-{scheme}.png",
        maxh=1500,
    )
