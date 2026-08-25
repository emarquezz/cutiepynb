"""Command-line interface for cutiepynb."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional, Sequence

from . import __version__
from .core import TOC_TITLE, process_notebook
from .styles import DEFAULT_COLORS


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cutiepynb",
        description="Add colored headings and a table of contents to a Jupyter notebook.",
    )
    parser.add_argument("notebook", type=Path, help="input .ipynb file")
    destination = parser.add_mutually_exclusive_group()
    destination.add_argument("-o", "--output", type=Path, help="output notebook path")
    destination.add_argument(
        "--in-place",
        action="store_true",
        help="replace the input notebook (requires --force)",
    )
    parser.add_argument(
        "--color",
        action="append",
        dest="colors",
        metavar="CSS_COLOR",
        help="heading color; repeat to define a palette",
    )
    parser.add_argument(
        "--palette",
        help="seaborn palette name (requires cutiepynb[palette])",
    )
    parser.add_argument("--no-toc", action="store_true", help="do not add a table of contents")
    parser.add_argument("--toc-title", default=TOC_TITLE, help="table-of-contents title")
    parser.add_argument("-f", "--force", action="store_true", help="replace an existing output")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.in_place and not args.force:
        parser.error("--in-place requires --force")
    if args.palette and args.colors:
        parser.error("pass either --palette or --color, not both")

    output = args.notebook if args.in_place else args.output
    colors = None if args.palette else (args.colors or DEFAULT_COLORS)

    try:
        destination = process_notebook(
            args.notebook,
            output_file=output,
            colors=colors,
            sns_palette=args.palette,
            add_toc=not args.no_toc,
            toc_title=args.toc_title,
            overwrite=args.force,
        )
    except (FileExistsError, FileNotFoundError, ImportError, ValueError) as exc:
        parser.error(str(exc))

    print(f"Saved {destination}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
