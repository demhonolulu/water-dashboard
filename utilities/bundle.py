#!/usr/bin/env python3
"""
bundle.py - Inline style.css and app.js into index.html to produce a single HTML file.

Expected layout:
    project/
    ├── index.html
    ├── style.css
    ├── app.js
    └── utilities/
        └── bundle.py   <-- this script lives here

Usage (run from inside the utilities folder):
    python bundle.py
    python bundle.py --html ../index.html --css ../style.css --js ../app.js --out dashboard.html
"""

import argparse
import re
from pathlib import Path

# Folder this script lives in (utilities/)
SCRIPT_DIR = Path(__file__).resolve().parent
# Parent folder, where the source files live
SOURCE_DIR = SCRIPT_DIR.parent


def inline_css(html: str, css_content: str, css_filename: str) -> str:
    """Replace the <link ... href="style.css"> tag with an inline <style> block,
    keeping it in the same position (i.e. after the CDN stylesheets)."""
    pattern = re.compile(
        r'<link[^>]+href=["\'](?:\./)?' + re.escape(css_filename) + r'["\'][^>]*/?>',
        re.IGNORECASE,
    )
    style_block = f"<style>\n{css_content}\n</style>"

    if pattern.search(html):
        return pattern.sub(style_block, html, count=1)
    else:
        print(f"⚠️  No <link> tag found for {css_filename}; inserting before </head>.")
        return html.replace("</head>", f"{style_block}\n</head>", 1)


def inline_js(html: str, js_content: str, js_filename: str) -> str:
    """Remove any existing <script src="app.js"> tag, then inject the JS
    as an inline <script> right before </body> so it loads last."""
    pattern = re.compile(
        r'<script[^>]+src=["\'](?:\./)?' + re.escape(js_filename) + r'["\'][^>]*>\s*</script>',
        re.IGNORECASE,
    )
    html = pattern.sub("", html, count=1)

    script_block = f"<script>\n{js_content}\n</script>"

    if "</body>" in html:
        return html.replace("</body>", f"{script_block}\n</body>", 1)
    else:
        return html + f"\n{script_block}\n"


def main():
    parser = argparse.ArgumentParser(description="Bundle HTML, CSS, and JS into one file.")
    parser.add_argument("--html", default=str(SOURCE_DIR / "index.html"), help="Path to HTML file")
    parser.add_argument("--css", default=str(SOURCE_DIR / "style.css"), help="Path to CSS file")
    parser.add_argument("--js", default=str(SOURCE_DIR / "app.js"), help="Path to JS file")
    parser.add_argument("--out", default=str(SCRIPT_DIR / "dashboard.bundled.html"),
                         help="Output file path (defaults to this script's folder)")
    args = parser.parse_args()

    html_path = Path(args.html)
    css_path = Path(args.css)
    js_path = Path(args.js)
    out_path = Path(args.out)

    html = html_path.read_text(encoding="utf-8")
    css = css_path.read_text(encoding="utf-8")
    js = js_path.read_text(encoding="utf-8")

    html = inline_css(html, css, css_path.name)
    html = inline_js(html, js, js_path.name)

    out_path.write_text(html, encoding="utf-8")
    print(f"✅ Bundled file written to {out_path.resolve()}")


if __name__ == "__main__":
    main()