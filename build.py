#!/usr/bin/env python3
"""Build index.html from src/ and vendor/.

    python3 build.py            write index.html
    python3 build.py --check    exit 1 if index.html is out of date

Standard library only. index.html is committed so that double-clicking it
and GitHub Pages both just work; this script is how it gets made.
"""
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
template = (root / "src" / "template.html").read_text(encoding="utf-8")
three = (root / "vendor" / "three.r128.min.js").read_text(encoding="utf-8")
orbits = (root / "src" / "orbits.js").read_text(encoding="utf-8")
app = (root / "src" / "app.js").read_text(encoding="utf-8")

for name, code in (("three", three), ("orbits", orbits), ("app", app)):
    if "</script" in code.lower():
        sys.exit("build: %s contains a closing script tag, which would end the page early" % name)

for marker in ("<!--THREE-->", "<!--ORBITS-->", "<!--APP-->"):
    if template.count(marker) != 1:
        sys.exit("build: template needs exactly one %s" % marker)

html = template.replace("<!--THREE-->", "<script>" + three.strip() + "</script>")
html = html.replace("<!--ORBITS-->", "<script>\n" + orbits.strip() + "\n</script>")
html = html.replace("<!--APP-->", "<script>\n" + app.strip() + "\n</script>")

out = root / "index.html"
if "--check" in sys.argv:
    current = out.read_text(encoding="utf-8") if out.exists() else ""
    if current != html:
        sys.exit("index.html is out of date. Run: python3 build.py")
    print("index.html is up to date")
else:
    out.write_text(html, encoding="utf-8")
    print("wrote index.html (%d KB)" % (len(html.encode("utf-8")) // 1024))
