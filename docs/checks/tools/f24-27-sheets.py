# F24–F27 checker: contact sheets of the visual matrix so every PNG is reviewed.
# Usage: pipeline/.venv/bin/python docs/checks/tools/f24-27-sheets.py
import glob, os
from PIL import Image, ImageDraw
D = 'docs/checks/F25/attempt-1/visual'
groups = {
    'home': [f'home-{w}-{t}.png' for t in ('light', 'dark') for w in (320, 375, 768, 1280)],
    'rw': [f'rw-{w}-{t}.png' for t in ('light', 'dark') for w in (320, 375, 768, 1280)],
    'rwmap': [f'rw-map-{w}-{t}.png' for t in ('light', 'dark') for w in (320, 375, 768, 1280)],
    'garden': [f'garden-{w}-{t}.png' for t in ('light', 'dark') for w in (320, 375, 768, 1280)],
    'panels': ['home-sheet-375-light.png', 'home-sheet-375-dark.png', 'home-drawer-1280-light.png', 'home-drawer-1280-dark.png'],
    'nojs': sorted(os.path.basename(p) for p in glob.glob(f'{D}/*-nojs.png')),
    'reduced': sorted(os.path.basename(p) for p in glob.glob(f'{D}/*-reduced.png')),
}
H = 560
for name, files in groups.items():
    ims = []
    for f in files:
        im = Image.open(f'{D}/{f}').convert('RGB')
        s = H / im.height
        im = im.resize((max(1, int(im.width * s)), H))
        lab = Image.new('RGB', (im.width, H + 18), 'white'); lab.paste(im, (0, 18))
        ImageDraw.Draw(lab).text((4, 2), f, fill='black'); ims.append(lab)
    per_row = 4
    rows = [ims[i:i + per_row] for i in range(0, len(ims), per_row)]
    W = max(sum(i.width for i in r) + 8 * len(r) for r in rows)
    sheet = Image.new('RGB', (W, len(rows) * (H + 26)), (200, 200, 200))
    y = 0
    for r in rows:
        x = 0
        for i in r:
            sheet.paste(i, (x, y)); x += i.width + 8
        y += H + 26
    sheet.save(f'docs/checks/F25/attempt-1/sheet-{name}.png')
    print(name, sheet.size)
