"""Small file and identifier utilities."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Dict


def generate_corpus_id() -> str:
    """Return a random eight-character hexadecimal identifier."""

    return uuid.uuid4().hex[:8]


def default_output_path(file: str | Path) -> Path:
    """Return the traditional ``*_chulo.ipynb`` output path."""

    path = Path(file)
    return path.with_name(f"{path.stem}_chulo{path.suffix}")


def save_doc_enchulado(
    doc_chulo: Dict[str, Any],
    file: str | Path,
    *,
    output_file: str | Path | None = None,
    overwrite: bool = True,
) -> Path:
    """Write a transformed notebook and return its path."""

    destination = Path(output_file) if output_file is not None else default_output_path(file)
    if destination.exists() and not overwrite:
        raise FileExistsError(
            f"output already exists: {destination}. Pass overwrite=True to replace it."
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8") as stream:
        json.dump(doc_chulo, stream, ensure_ascii=False, indent=1)
        stream.write("\n")
    return destination
