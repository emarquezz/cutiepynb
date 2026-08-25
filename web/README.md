# cutiepynb web app

The web interface is a static GitHub Pages application. A small native
JavaScript transformer runs in the visitor's browser, so notebooks are never
uploaded and code cells are never executed. Formatting runs in a Web Worker so
the main interface remains responsive with larger notebooks.

## Test locally

Run the server from the repository root:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/web/>. Do not open `index.html` directly with a
`file://` URL because browsers restrict JavaScript module workers on local-file
pages.

The app has no runtime CDN dependency and does not need an internet connection
after its local files have loaded.

The preview is intentionally an outline rather than a notebook renderer. All
notebook-derived strings are inserted as text, and notebook HTML, code, and
saved outputs are never rendered.

The advanced outline editor uses native text inputs and H1–H6 selects rather
than rendering notebook HTML. Previously styled notebooks restore their saved
hex palette and table-of-contents setting, then flow through the same
idempotent transformation when recolored.

## Tests

The JavaScript tests have no npm dependencies. They also run language-neutral
fixtures through both implementations to catch browser/Python drift:

```bash
cd web
npm test
```

The GitHub Pages workflow copies the production assets in this directory to
`/app/`. The browser transformer is intentionally independent of the installable
Python package at runtime, while shared conformance tests keep their output in
sync.
