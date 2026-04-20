import os
import sys
import json

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
output_dir = os.path.join(root_dir, 'utilities', 'squarespace')
os.makedirs(output_dir, exist_ok=True)

files = {
    'html':     ('index.html',              root_dir),
    'js':       ('app.js',                  root_dir),
    'css':      ('style.css',               root_dir),
    'locations':('json/locations.json',     root_dir),
    'veoci':    ('json/veoci-export.json',  root_dir),
    'area':     ('json/area.json',          root_dir),
    'config':   ('json/config.json',        root_dir),
    'historic': ('json/historic-data.json', root_dir),
}

print("Reading files...")
contents = {}
missing = []

for key, (filename, base) in files.items():
    path = os.path.join(base, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            contents[key] = f.read()
        print(f"  OK  {filename}")
    else:
        missing.append(filename)
        print(f"  MISSING  {filename}")

if missing:
    print(f"\nError: missing files: {', '.join(missing)}")
    input("Press Enter to exit...")
    sys.exit(1)

json_files = {
    'json/locations.json':     ('locations', contents['locations']),
    'json/veoci-export.json':  ('veoci',     contents['veoci']),
    'json/area.json':          ('area',      contents['area']),
    'json/config.json':        ('config',    contents['config']),
    'json/historic-data.json': ('historic',  contents['historic']),
}

print("\nWriting JSON html files...")

for fetch_key, (slug, json_content) in json_files.items():
    try:
        json.loads(json_content)
    except json.JSONDecodeError as e:
        print(f"  ERROR: {fetch_key} is not valid JSON: {e}")
        input("Press Enter to exit...")
        sys.exit(1)

    html = f"<script>\nwindow.__DATA__ = window.__DATA__ || {{}};\nwindow.__DATA__['{fetch_key}'] = {json_content};\n</script>"

    out_path = os.path.join(output_dir, f"{slug}.html")
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"  OK  {slug}.html")

fetch_interceptor = """<script>
window.__DATA__ = window.__DATA__ || {};
const __real_fetch__ = window.fetch.bind(window);
window.fetch = function(url, options) {
  const knownKeys = [
    'json/locations.json',
    'json/veoci-export.json',
    'json/area.json',
    'json/config.json',
    'json/historic-data.json'
  ];
  const key = knownKeys.find(k => url === k || url.endsWith('/' + k) || url === k.split('/').pop());
  if (key) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (window.__DATA__ && window.__DATA__[key] !== undefined) {
          clearInterval(interval);
          resolve({
            ok: true,
            json: () => Promise.resolve(window.__DATA__[key])
          });
        }
      }, 20);
    });
  }
  return __real_fetch__(url, options);
};
</script>"""

print("\nBuilding dashboard.html...")
html = contents['html']

css_link = '<link rel="stylesheet" href="style.css"/>'
css_inline = f"<style>\n{contents['css']}\n  </style>"
if css_link in html:
    html = html.replace(css_link, css_inline)
else:
    print("  WARNING: Could not find style.css link tag - CSS not inlined")

js_tag = '<script src="app.js"></script>'
js_inline = f"{fetch_interceptor}\n  <script>\n{contents['js']}\n  </script>"
if js_tag in html:
    html = html.replace(js_tag, js_inline)
else:
    print("  WARNING: Could not find app.js script tag - JS not inlined")

out_path = os.path.join(output_dir, 'dashboard.html')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(html)
print("  OK  dashboard.html")

print(f"\nDone! Files written to utilities/squarespace/:")
print("  - dashboard.html   (paste into main code block)")
print("  - locations.html   (paste into its own code block)")
print("  - veoci.html       (paste into its own code block)")
print("  - area.html        (paste into its own code block)")
print("  - config.html      (paste into its own code block)")
print("  - historic.html    (paste into its own code block)")
input("\nPress Enter to exit...")