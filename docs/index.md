# Colorful notebooks, without the copy-and-paste

`cutiepynb` styles Markdown headings and builds a linked table of contents for
Jupyter notebooks. It works as a terminal command or as a small Python library.

## A two-minute example

Install the package:

```bash
python -m pip install cutiepynb
```

Then style a notebook:

```bash
cutiepynb analysis.ipynb \
  --color "#5D2197" \
  --color "#AB1A7C" \
  --color "#DE2227"
```

The result is saved as `analysis_chulo.ipynb`; the source notebook is not
changed.

## What it does

- Finds level 1–6 Markdown headings.
- Assigns a color by heading level.
- Adds unique anchors, including for repeated titles.
- Creates a nested table of contents at the top.
- Leaves code cells and fenced code examples alone.

The transformation is idempotent: running the same settings again replaces
cutiepynb's generated markup instead of nesting it.

[Start the tutorial](tutorial.md){ .md-button .md-button--primary }
[See the command reference](usage.md){ .md-button }
