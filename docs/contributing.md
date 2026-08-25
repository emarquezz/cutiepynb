# Contributing

Bug reports, documentation improvements, and focused pull requests are
welcome.

## Report an issue

Open an issue at <https://github.com/emarquezz/cutiepynb/issues> and include:

- your Python version and operating system;
- a minimal notebook or Markdown cell that reproduces the problem;
- the command or Python call you ran;
- what you expected and what happened instead.

Remove outputs or private data from example notebooks before attaching them.

## Local setup

```bash
git clone https://github.com/emarquezz/cutiepynb.git
cd cutiepynb
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install -e ".[dev]"
```

Run the checks:

```bash
ruff check .
pytest
python -m build
mkdocs build --strict
```

Tests should use pytest's `tmp_path` fixture for generated notebooks. Do not
write test output into `docs/examples` or commit `_chulo.ipynb` files produced
during local testing.

## Pull requests

Keep each pull request focused. Add tests for behavior changes and update the
tutorial or API documentation when users will interact with the change.
