"""Assemble the F13b page and map screenshots for visual checking."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path("docs/checks/F13b/attempt-1")
for theme in ("light", "dark"):
    for group in ("pages", "map-views"):
        thumbs = []
        for width in (375, 768, 1280):
            page = out / f"labels-{width}-{theme}.png"
            masked = out / f"labels-mask-{width}-{theme}.png"
            if group == "pages":
                im = Image.open(page).convert("RGB")
                im.thumbnail((300, 1590))
                thumbs.append((f"{width}px • labels enabled", im))
            else:
                im = Image.open(masked).convert("RGB")
                im.thumbnail((475, 1350))
                thumbs.append((f"{width}px • labels and basin mask enabled", im))
        height = max(im.height for _, im in thumbs)
        column = 320 if group == "pages" else 495
        sheet = Image.new("RGB", (column * len(thumbs), height + 38), "white")
        draw = ImageDraw.Draw(sheet)
        for i, (caption, thumb) in enumerate(thumbs):
            draw.text((column * i + 10, 14), caption, fill="black")
            sheet.paste(thumb, (column * i + 10, 34))
        sheet.save(out / f"review-{group}-{theme}.jpg", quality=92)
