"""Shared notebook fixtures."""

import json

import pytest


@pytest.fixture
def notebook():
    return {
        "cells": [
            {
                "id": "results-cell",
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    "# Results\n",
                    "Some introductory text.\n",
                    "## Differential expression\n",
                    "## Differential expression\n",
                ],
            },
            {
                "id": "enrichment-cell",
                "cell_type": "markdown",
                "metadata": {},
                "source": "```python\n# This is code, not a heading\n```\n### Enrichment",
            },
            {
                "id": "code-cell",
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": ["# Code cells stay unchanged\n", "print('hello')"],
            },
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            }
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }


@pytest.fixture
def notebook_file(tmp_path, notebook):
    path = tmp_path / "analysis.ipynb"
    path.write_text(json.dumps(notebook), encoding="utf-8")
    return path
