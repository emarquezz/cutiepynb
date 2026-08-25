"""Make Jupyter notebooks colorful and easier to navigate."""

from .core import create_new_document, cutiepy_nb, enchular_ipynb, process_notebook
from .styles import DEFAULT_COLORS, update_heading_colors_in_document

__author__ = "Elisa Márquez-Zavala"
__email__ = "emarquez@lcg.unam.mx"
__version__ = "1.1.0"

__all__ = [
    "DEFAULT_COLORS",
    "create_new_document",
    "cutiepy_nb",
    "enchular_ipynb",
    "process_notebook",
    "update_heading_colors_in_document",
]
