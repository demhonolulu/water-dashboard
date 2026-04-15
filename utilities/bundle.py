import os
import sys

script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

files = {
    'html':      'index.html',
    'js':        'app.js',
    'css':       'style.css',
    'locations': 'json/locations.json',
    'veoci':     'json/veoci-export.json',
    'area':      'json/area.json',
    'config':    'json/config.json',
}

print("Reading files...")
contents = {}
missing = []

for key, filename in files.items():
    path = os.path.join(script_dir, filename)
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

print("\nBundling...")

html = contents['html']

# Replace <link rel="stylesheet" href="style.css"/> with inlined <style>
css_link = '<link rel="stylesheet" href="style.css"/>'
css_inline = f"<style>\n{contents['css']}\n  </style>"
if css_link in html:
    html = html.replace(css_link, css_inline)
else:
    print("  WARNING: Could not find the style.css <link> tag - CSS not inlined")

# Build the fetch interceptor script block
fetch_interceptor = f"""<script>
const __BUNDLED_DATA__ = {{
  'locations.json':    {contents['locations']},
  'veoci-export.json': {contents['veoci']},
  'area.json':         {contents['area']},
  'config.json':       {contents['config']}
}};
const __real_fetch__ = window.fetch.bind(window);
window.fetch = function(url, options) {{
  const key = Object.keys(__BUNDLED_DATA__).find(k => url === k || url.endsWith('/' + k));
  if (key) {{
    return Promise.resolve({{ ok: true, json: () => Promise.resolve(__BUNDLED_DATA__[key]) }});
  }}
  return __real_fetch__(url, options);
}};
  </script>"""

# Replace <script src="app.js"></script> with interceptor + inlined app.js
js_tag = '<script src="app.js"></script>'
js_inline = f"""{fetch_interceptor}
  <script>
{contents['js']}
  </script>"""

if js_tag in html:
    html = html.replace(js_tag, js_inline)
else:
    print("  WARNING: Could not find the app.js <script> tag - JS not inlined")

output_path = os.path.join(script_dir, 'dashboard-bundle.html')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Done! Created: dashboard-bundle.html")
input("\nPress Enter to exit...")
