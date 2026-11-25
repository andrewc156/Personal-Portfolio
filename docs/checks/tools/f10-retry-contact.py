from pathlib import Path

from PIL import Image, ImageDraw

root = Path("docs/checks/F10/attempt-2")
modes = ("rising", "dye", "pond", "rivers", "collatz")


def sheet(files, suffix):
    cell_w, cell_h = 510, 460
    rows = (len(files) + 1) // 2
    view = Image.new("RGB", (2 * cell_w, rows * cell_h), "#d5d9de")
    labels = ImageDraw.Draw(view)
    for index, file in enumerate(files):
        with Image.open(file) as source:
            thumbnail = source.convert("RGB")
            thumbnail.thumbnail((cell_w - 10, cell_h - 21), Image.Resampling.LANCZOS)
        row, col = divmod(index, 2)
        x, y = col * cell_w + 5, row * cell_h + 3
        labels.text((x, y), file.stem, fill="#14191e")
        view.paste(thumbnail, (x, y + 17))
    view.save(root / f"contact-{suffix}.jpg", quality=92)


for mode in modes:
    backgrounds = []
    panels = []
    for width in (375, 768, 1280):
        for theme in ("light", "dark"):
            backgrounds.append(root / f"{mode}-{width}-{theme}.png")
            panel = root / f"{mode}-{width}-{theme}-panel.png"
            if panel.exists():
                panels.append(panel)
    sheet(backgrounds, mode)
    if panels:
        sheet(panels, mode + "-panel")
reduced = sorted(root.glob("rm-*.png"))
if reduced:
    sheet(reduced, "reduced-motion")
