from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

out = Path("docs/checks/F11b/attempt-2")
for width in (375, 768, 1280):
    tiles = []
    for mode in ("strip", "settings"):
        for theme in ("light", "dark"):
            file = out / f"{mode}-{width}-{theme}.png"
            with Image.open(file) as image:
                capture = image.convert("RGB")
            if mode == "strip":
                capture = capture.crop((0, 0, capture.width, min(capture.height, 1000)))
            capture.thumbnail((680, 850))
            tiles.append((file.stem, capture))
    w = max(im.width for _, im in tiles) + 12
    h = max(im.height for _, im in tiles) + 25
    sheet = Image.new("RGB", (w * 2, h * 2), "white")
    labels = ImageDraw.Draw(sheet)
    for i, (name, tile) in enumerate(tiles):
        x, y = (i % 2) * w, (i // 2) * h
        labels.text((x + 6, y + 3), name, fill="black")
        sheet.paste(ImageOps.expand(tile, border=1, fill="#bbb"), (x + 5, y + 20))
    sheet.save(out / f"contact-{width}.jpg", quality=88)

tiles = []
for width in (375, 768, 1280):
    for theme in ("light", "dark"):
        file = out / f"caption-{width}-{theme}.png"
        with Image.open(file) as image:
            capture = image.convert("RGB")
        tiles.append((file.stem, capture))
w = max(im.width for _, im in tiles) + 12
h = max(im.height for _, im in tiles) + 25
sheet = Image.new("RGB", (w * 2, h * 3), "white")
labels = ImageDraw.Draw(sheet)
for i, (name, tile) in enumerate(tiles):
    x, y = (i % 2) * w, (i // 2) * h
    labels.text((x + 6, y + 3), name, fill="black")
    sheet.paste(ImageOps.expand(tile, border=1, fill="#bbb"), (x + 5, y + 20))
sheet.save(out / "contact-caption.jpg", quality=92)
