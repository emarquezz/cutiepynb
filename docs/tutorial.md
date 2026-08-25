# Tutorial: make an analysis notebook cute

This tutorial starts with a normal notebook named `analysis.ipynb` and creates
a styled copy. Your original is left untouched.

## 1. Install cutiepynb

```bash
python -m pip install cutiepynb
```

Check that the command is available:

```bash
cutiepynb --version
```

## 2. Try the default palette

```bash
cutiepynb analysis.ipynb
```

Open `analysis_chulo.ipynb`. You should see:

1. A table of contents in the first cell.
2. Colored Markdown headings.
3. Links that jump to the corresponding sections.

The command refuses to overwrite `analysis_chulo.ipynb` by default. This makes
experimentation safe. Add `--force` when replacing that file is intentional:

```bash
cutiepynb analysis.ipynb --force
```

## 3. Choose your own colors

Repeat `--color` to build a palette. The first color is used for `#` headings,
the second for `##`, and so on. If there are more heading levels than colors,
the palette repeats.

```bash
cutiepynb analysis.ipynb \
  --output analysis_purple.ipynb \
  --color "#5D2197" \
  --color "#AB1A7C" \
  --color "#DE2227"
```

CSS color names also work:

```bash
cutiepynb analysis.ipynb --color rebeccapurple --color hotpink
```

## 4. Use it from Python

The recommended file API returns the path it wrote:

```python
from cutiepynb import process_notebook

output = process_notebook(
    "analysis.ipynb",
    "analysis_purple.ipynb",
    colors=["#5D2197", "#AB1A7C", "#DE2227"],
    toc_title="Contents",
)

print(f"Open {output}")
```

Existing output is protected. To replace it explicitly:

```python
process_notebook(
    "analysis.ipynb",
    "analysis_purple.ipynb",
    colors=["#5D2197", "#AB1A7C", "#DE2227"],
    overwrite=True,
)
```

## 5. Use a seaborn palette

Seaborn support is optional, so it does not make the base installation heavy.

```bash
python -m pip install "cutiepynb[palette]"
cutiepynb analysis.ipynb --palette magma
```

The same option is available in Python:

```python
from cutiepynb import process_notebook

process_notebook("analysis.ipynb", sns_palette="mako")
```

## 6. Transform a notebook already loaded in memory

Use `create_new_document` when another tool has already loaded the notebook.
The input dictionary is not changed.

```python
import json
from cutiepynb import create_new_document

with open("analysis.ipynb", encoding="utf-8") as stream:
    notebook = json.load(stream)

styled = create_new_document(
    notebook,
    colors=["#0f766e", "#0891b2", "#4f46e5"],
    toc_title="Navigate this analysis",
)
```

You can then pass `styled` to the next step of your own application.

The in-memory API can also correct headings while it styles the notebook. The
indices are zero-based and follow Markdown headings in document order:

```python
corrected = create_new_document(
    notebook,
    colors=["#0f766e", "#0891b2", "#4f46e5"],
    heading_edits={
        0: {"title": "Main findings"},
        2: {"title": "Quality control", "level": 2},
    },
)
```

Headings in code cells, fenced examples, and generated tables of contents do
not count toward those indices.

## 7. Update an existing palette

If a notebook dictionary already contains styled cutiepynb headings, update
the colors without nesting new HTML spans:

```python
from cutiepynb import update_heading_colors_in_document

restyled = update_heading_colors_in_document(
    styled,
    ["#111827", "#7c3aed", "#db2777"],
)
```

Both functions return a new dictionary and keep their input unchanged.
Calling `create_new_document` again with a different palette is also safe: it
rebuilds cutiepynb's spans, anchors, and table of contents instead of stacking
new markup on top of the old output.

## 8. Optional behaviors

Skip the table of contents:

```bash
cutiepynb analysis.ipynb --no-toc
```

Replace the input only when you really want to:

```bash
cutiepynb analysis.ipynb --in-place --force
```

For reproducible analysis projects, creating a separate output is usually the
better choice. Generated notebooks can be rebuilt from their originals.

## What counts as a heading?

cutiepynb recognizes standard ATX Markdown headings:

```markdown
# Main result
## Quality control
### Sample-level observations
```

Headings inside code cells or fenced examples are ignored. Duplicate heading
names receive unique anchors such as `results` and `results-2`.

Next, see the [command and API reference](usage.md).
