# cutiepynb 💖

[![PyPI](https://img.shields.io/pypi/v/cutiepynb.svg)](https://pypi.org/project/cutiepynb/)
[![CI](https://github.com/emarquezz/cutiepynb/actions/workflows/ci.yml/badge.svg)](https://github.com/emarquezz/cutiepynb/actions/workflows/ci.yml)
[![Documentation](https://github.com/emarquezz/cutiepynb/actions/workflows/docs.yml/badge.svg)](https://emarquezz.github.io/cutiepynb/)
[![Python](https://img.shields.io/pypi/pyversions/cutiepynb.svg)](https://pypi.org/project/cutiepynb/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Turn an ordinary Jupyter notebook into a colorful, easy-to-navigate notebook.
`cutiepynb` styles Markdown headings, adds stable anchors, and generates a
linked table of contents. The base package has no runtime dependencies.

Prefer not to install anything? The browser app can also fix heading titles and
levels. Its native JavaScript formatter starts immediately and runs locally in
your tab—there is no Python runtime or notebook upload:
[open cutiepynb studio](https://emarquezz.github.io/cutiepynb/app/).

To try the complete repository before publishing it, follow the
[local testing guide](LOCAL_TESTING.md). When you are happy with it, the
[GitHub Pages guide](GITHUB_PAGES_SETUP.md) explains the one-time repository
setting.

## Before and after

<table>
  <tr>
    <th>Before</th>
    <th>After</th>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/emarquezz/cutiepynb/main/docs/images/example_1.jpeg" alt="Notebook before cutiepynb" width="420"></td>
    <td><img src="https://raw.githubusercontent.com/emarquezz/cutiepynb/main/docs/images/example_2.jpeg" alt="Notebook after cutiepynb" width="420"></td>
  </tr>
</table>

## Install

```bash
python -m pip install cutiepynb
```

## Quick start

From the terminal:

```bash
cutiepynb analysis.ipynb \
  --color "#5D2197" \
  --color "#AB1A7C" \
  --color "#DE2227"
```

This creates `analysis_chulo.ipynb` and leaves the original untouched. Existing
output is protected; use `--force` only when you intend to replace it.

Or from Python:

```python
from cutiepynb import process_notebook

output = process_notebook(
    "analysis.ipynb",
    colors=["#5D2197", "#AB1A7C", "#DE2227"],
)
print(output)
```

`cutiepy_nb(...)`, the original API, is still available for existing notebooks.

## Highlights

- Colors heading levels with your own CSS color palette.
- Generates a nested table of contents with unique links.
- Handles several headings in one Markdown cell.
- Ignores headings inside code cells and fenced Markdown examples.
- Produces the same result when safely run more than once.
- Lets the browser studio rename headings, change H1–H6 levels, and recolor
  notebooks it styled earlier.
- Supports both a Python API and a command-line interface.
- Uses seaborn palettes through the optional `cutiepynb[palette]` extra.
- Includes a private-by-design browser studio that never executes notebook code.
- Keeps the native browser formatter aligned with Python through shared
  transformation fixtures.

Read the [full tutorial](https://emarquezz.github.io/cutiepynb/tutorial/) for
custom output paths, in-place editing, seaborn palettes, recoloring, and
in-memory transformations.

## Development

```bash
git clone https://github.com/emarquezz/cutiepynb.git
cd cutiepynb
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install -e ".[dev]"
pytest
mkdocs serve
```

Released under the [MIT License](LICENSE).
