"""Run shared browser transformation fixtures with the Python implementation."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from cutiepynb import create_new_document  # noqa: E402


def python_options(operation: dict[str, Any]) -> dict[str, Any]:
    """Translate the language-neutral fixture shape to the Python API."""

    edits = {
        edit["index"]: {key: value for key, value in edit.items() if key != "index"}
        for edit in operation.get("headingEdits", [])
    }
    return {
        "colors": operation.get("colors"),
        "add_toc": operation.get("addToc", True),
        "toc_title": operation.get("tocTitle", "Table of Contents"),
        "heading_edits": edits,
    }


def main() -> None:
    fixture_path = Path(sys.argv[1])
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    outputs = []
    for case in fixture["cases"]:
        document = case["notebook"]
        for operation in case["operations"]:
            document = create_new_document(document, **python_options(operation))
        outputs.append(document)
    print(json.dumps(outputs, ensure_ascii=False))


if __name__ == "__main__":
    main()
