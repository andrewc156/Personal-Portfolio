from pathlib import Path
import json
from urllib.parse import urlsplit
from PIL import Image, ImageDraw

for feature, expected in [('F19a', 48), ('F19b', 12)]:
    d = Path('docs/checks') / feature / 'attempt-2'
    rows = json.loads((d / 'pages.json').read_text())
    assert len(rows) == expected
    assert all(r['status'] == 200 and not any(r[k] for k in ('errors','failed','third','overflowX','clipped')) for r in rows)
    sheets = d / 'sheets'
    sheets.mkdir(exist_ok=True)
    for name in sorted({r['name'] for r in rows}):
        paths = [Path(r['file']) for r in rows if r['name'] == name]
        assert len(paths) == 6
        ims = []
        for p in paths:
            with Image.open(p) as img:
                copy = img.convert('RGB')
                copy.thumbnail((430, 1300))
                ims.append((p, copy))
        h = max(im.height for _, im in ims) + 20
        sheet = Image.new('RGB', (1320, h * 2), (101, 102, 103))
        draw = ImageDraw.Draw(sheet)
        for i, (p, im) in enumerate(ims):
            x, y = i // 2 * 440, i % 2 * h
            sheet.paste(im, (x, y + 18))
            draw.text((x + 3, y + 2), p.stem, fill='white')
        sheet.save(sheets / f'{name}.png')
    lh = d / 'test-results/candidate/.lighthouseci'
    keys = ['performance','accessibility','best-practices','seo']
    lines = []
    for p in sorted(lh.glob('lhr-*.json')):
        data = json.loads(p.read_text())
        path = urlsplit(data['requestedUrl']).path
        cls = data['audits']['cumulative-layout-shift']['numericValue']
        scores = [round(data['categories'][k]['score'] * 100) for k in keys]
        lines.append(f'{path}: {scores}, CLS {cls}')
        assert cls < .05 and scores[0] >= (80 if path == '/rising-water/' else 90) and min(scores[1:]) >= 95
    assert len(lines) == expected // 6, lines
    print(feature, *lines, sep='\n')
    (d / 'test-results/lighthouse-scores.txt').write_text('\n'.join(lines) + '\n')
