# cutiepynb 💖

[![PyPI Version](https://img.shields.io/pypi/v/cutiepynb.svg)](https://pypi.python.org/pypi/cutiepynb)
[![Conda Version](https://img.shields.io/conda/vn/conda-forge/cutiepynb.svg)](https://anaconda.org/conda-forge/cutiepynb)
![Run Python Tests](https://github.com/emarquezz/cutiepynb/actions/workflows/python-tests.yml/badge.svg)
![macOS Build Status](https://github.com/emarquezz/cutiepynb/actions/workflows/macos.yml/badge.svg)
![Ubuntu Build Status](https://github.com/emarquezz/cutiepynb/actions/workflows/ubuntu.yml/badge.svg)
![Windows Build Status](https://github.com/emarquezz/cutiepynb/actions/workflows/windows.yml/badge.svg)

**Turn your Jupyter Notebooks into beautiful, colorful cutie ipynb with cutiepynb!**  
Dress them up with vibrant title colors and an auto-generated table of contents.

- **License:** [MIT License](LICENSE)

## Features ✨

- 🎨 **Customizable title colors** for notebook headings.
- 📚 **Automatic table of contents generation**.
- 🔄 **Supports dynamic updates** to heading styles.
- 🌈 **Works seamlessly with various seaborn color palettes**.

## Installation

You can install `cutiepynb` via pip:

```bash
pip install cutiepynb
```

## Examples

To see cutiepynb in action, run the following script to process example notebooks:

```bash
python run_examples.py
```

## Visual Demo

### Before Applying cutiepynb 🥱

<kbd>

<img src="https://raw.githubusercontent.com/emarquezz/cutiepynb/main/docs/images/example_1.jpeg" alt="Before Example"  width="500" style="border:1px solid #000000"/>
</kbd>

### Cutiepying the notebook 

```python
from cutiepynb import cutiepy_nb

test_file = 'Test.ipynb'
cutiepy_nb(test_file, colors=['#5D2197', '#AB1A7C', '#DE2227'], save=True)
```

### After Applying cutiepynb 🎀

<kbd>
<img src="https://raw.githubusercontent.com/emarquezz/cutiepynb/main/docs/images/example_2.jpeg" alt="After Example"  width="500"/>
</kbd>



- **Documentation:** [cutiepynb Docs](https://emarquezz.github.io/cutiepynb)

