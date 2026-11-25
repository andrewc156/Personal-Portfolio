from pathlib import Path
from PIL import Image, ImageDraw

root = Path("docs/checks/F14/attempt-1")
for width in (320,375,768,1280):
    thumbnail_width = min(width,640)
    paths = [root / f"home-{width}-{theme}-{state}.png"
             for theme in ("light","dark") for state in ("closed","open")]
    thumbnails = []
    for path in paths:
        with Image.open(path) as image:
            copy = image.convert("RGB")
        copy.thumbnail((thumbnail_width,1024), Image.Resampling.LANCZOS)
        thumbnails.append((path,copy))
    thumbnail_height = max(image.height for _,image in thumbnails)
    panel_width = thumbnail_width + 8
    panel_height = thumbnail_height + 24
    sheet = Image.new("RGB", (panel_width*2,panel_height*2), "#d5d9de")
    labels = ImageDraw.Draw(sheet)
    for index,(path,image) in enumerate(thumbnails):
        col,row = index % 2,index // 2
        x,y=col*panel_width+4,row*panel_height+4
        labels.text((x,y), path.stem, fill="#14191e")
        sheet.paste(image,(x,y+15))
    sheet.save(root / f"contact-{width}.jpg", quality=94)
