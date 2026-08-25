# Interactive web app

The cutiepynb web app mirrors the package transformation in native browser
JavaScript. Your notebook is not uploaded anywhere, and code cells are never
executed.

[Open cutiepynb studio](https://emarquezz.github.io/cutiepynb/app/){ .md-button .md-button--primary }

With the app you can:

- upload an `.ipynb` notebook;
- preview its heading hierarchy;
- correct heading titles and change their H1–H6 levels;
- choose colors for heading levels 1–6;
- add, remove, or rename the table of contents; and
- download a styled `_chulo.ipynb` copy.

Uploading a notebook that cutiepynb has already styled restores its current
hex palette and table-of-contents choice. Choosing new colors replaces the old
styles instead of nesting spans or duplicating navigation, so the studio is
safe to use again on its own output.

There is no Python runtime or third-party code to download, so formatting can
start immediately. The transformation still runs in a background worker so the
controls remain responsive with larger notebooks. Shared conformance fixtures
compare the JavaScript result with the Python package in automated tests.

## Test a local checkout

From the repository root, run:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000/web/>.

The safe preview shows only the notebook's Markdown heading outline. It never
renders notebook HTML, code cells, or saved outputs.
