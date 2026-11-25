from html.parser import HTMLParser
from pathlib import Path
import re

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.excluded = 0
        self.content = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "template"}:
            self.excluded += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "template"}:
            self.excluded -= 1

    def handle_data(self, data):
        if not self.excluded:
            self.content.append(data)

pages = sorted(Path("dist").rglob("*.html"))
assert len(pages) == 10
for page in pages:
    text = VisibleText()
    text.feed(page.read_text())
    matches = re.findall(r"\b(?:TODO|TBD|lorem|placeholder|Draft)\b", " ".join(text.content), re.I)
    assert not matches, (page, matches)
print("Ten built HTML pages contain no unfinished-copy sentinels or draft badges in their text.")
