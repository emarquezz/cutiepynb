# Command and API reference

## Command line

```text
cutiepynb NOTEBOOK [--output PATH | --in-place] [OPTIONS]
```

| Option | Meaning |
| --- | --- |
| `-o`, `--output PATH` | Choose the output path. |
| `--in-place` | Replace the input; requires `--force`. |
| `--color CSS_COLOR` | Add one color; repeat to define a palette. |
| `--palette NAME` | Use a seaborn palette from the optional extra. |
| `--no-toc` | Style headings without adding a table of contents. |
| `--toc-title TEXT` | Change the table-of-contents title. |
| `-f`, `--force` | Replace existing output. |

Run `cutiepynb --help` for the complete built-in help.

## Recommended Python API

```python
from cutiepynb import process_notebook

path = process_notebook(
    "input.ipynb",
    "output.ipynb",
    colors=["#7c3aed", "#db2777", "#e11d48"],
    add_toc=True,
    toc_title="Table of Contents",
    overwrite=False,
)
```

## In-memory API

```python
from cutiepynb import create_new_document

styled_notebook = create_new_document(
    notebook_dictionary,
    colors=["purple", "hotpink"],
    heading_edits={
        0: {"title": "Main findings", "level": 1},
        3: {"level": 2},
    },
)
```

Heading positions are zero-based and follow the notebook's Markdown headings
in document order. Each edit can change the title, the level, or both. The
returned notebook is a deep copy; the input is not mutated.

## Compatibility API

The original function remains available:

```python
from cutiepynb import cutiepy_nb

notebook = cutiepy_nb(
    "analysis.ipynb",
    colors=["#5D2197", "#AB1A7C", "#DE2227"],
    save=True,
)
```

It returns the transformed dictionary and, by default, writes
`analysis_chulo.ipynb`. It preserves the original function's overwrite
behavior; new applications should prefer `process_notebook`.
