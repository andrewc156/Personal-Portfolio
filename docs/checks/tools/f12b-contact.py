"""Open all explorer screenshots and make visual overview and map/control sheets."""
import sys
from pathlib import Path

from PIL import Image

directory = Path(sys.argv[1])
for theme in ("light", "dark"):
    source = []
    for width in (375, 768, 1280):
        path = directory / f"on-{width}-{theme}.png"
        with Image.open(path) as image:
            source.append(image.convert("RGB"))

    for mode in ("overview", "map"):
        pieces = []
        for image in source:
            if mode == "overview":
                piece = image.copy()
                piece.thumbnail((430, 1850))
            else:
                height = 3100 if image.width == 750 else 2200
                piece = image.crop((0, 0, image.width, height))
                piece.thumbnail((640, 1300))
            pieces.append(piece)
        sheet = Image.new("RGB", (sum(p.width for p in pieces) + 20, max(p.height for p in pieces)), "#ccc")
        offset = 0
        for piece in pieces:
            sheet.paste(piece, (offset, 0))
            offset += piece.width + 10
        sheet.save(directory / f"{mode}-{theme}.jpg", quality=89)
