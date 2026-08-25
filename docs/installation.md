# Installation

## From PyPI

```bash
python -m pip install cutiepynb
```

cutiepynb supports Python 3.9 and newer and has no required runtime
dependencies.

## With seaborn palette support

```bash
python -m pip install "cutiepynb[palette]"
```

## Development version

```bash
python -m pip install "git+https://github.com/emarquezz/cutiepynb.git"
```

## Editable development install

```bash
git clone https://github.com/emarquezz/cutiepynb.git
cd cutiepynb
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install -e ".[dev]"
```
