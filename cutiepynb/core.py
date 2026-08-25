"""Core notebook transformations for :mod:`cutiepynb`.

The functions in this module deliberately operate on ordinary dictionaries.
That keeps the package lightweight while remaining compatible with notebooks
loaded by either :mod:`json` or :mod:`nbformat`.
"""

from __future__ import annotations

import copy
import html
import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Tuple

from .styles import DEFAULT_COLORS, heading_html, update_heading_colors_in_document
from .utils import save_doc_enchulado

Notebook = Dict[str, Any]
Cell = Dict[str, Any]
HeadingInfo = Dict[int, Dict[str, Any]]
HeadingEdits = Mapping[int, Mapping[str, Any]]

TOC_TITLE = "Table of Contents"
TOC_MARKER = "<!-- cutiepynb:table-of-contents -->"
TOC_METADATA_KEY = "cutiepynb"

_FENCE_RE = re.compile(r"^\s*(`{3,}|~{3,})")
_HEADING_RE = re.compile(
    r"^(?P<indent> {0,3})(?P<hashes>#{1,6})[ \t]+(?P<title>.*?)(?:[ \t]+#+)?[ \t]*$"
)
_CURRENT_ANCHOR_RE = re.compile(
    r'^\s*<a\s+class=["\']cutiepynb-anchor["\']\s+id=["\'][^"\']+["\']\s*></a>\s*$'
)
_LEGACY_ANCHOR_RE = re.compile(
    r'^\s*<a\s+class=["\']anchor["\']\s+id=["\'][^"\']+_\d+["\']\s*></a>\s*$'
)
_CUTIE_SPAN_RE = re.compile(
    r'<span\b[^>]*class=["\']cutiepynb-heading["\'][^>]*>(?P<title>.*?)</span>',
    flags=re.IGNORECASE,
)
_LEGACY_SPAN_RE = re.compile(
    r'<span\b[^>]*class=(?:["\'])?title_\d+(?:["\'])?[^>]*>(?P<title>.*?)</span>',
    flags=re.IGNORECASE,
)
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_MARKDOWN_LINK_RE = re.compile(r"!?\[([^]]+)\]\([^)]+\)")
_CSS_COLOR_RE = re.compile(
    r"(?:#[0-9a-fA-F]{3,8}|[A-Za-z][A-Za-z0-9-]*|"
    r"[A-Za-z][A-Za-z0-9-]*\([#A-Za-z0-9_.,% /+\-]+\))"
)
_LEGACY_TOC_ITEM_RE = re.compile(r"^\s*\+\s+\[[^]]+\]\(#[^)]+\)\s*$")


def _source_as_text(source: Any) -> str:
    if isinstance(source, list):
        return "".join(str(part) for part in source)
    return str(source or "")


def _restore_source_type(text: str, original_source: Any) -> Any:
    if isinstance(original_source, list):
        return text.splitlines(keepends=True)
    return text


def _strip_cutiepynb_markup(title: str) -> str:
    """Remove markup produced by current and early cutiepynb versions."""

    for pattern in (_CUTIE_SPAN_RE, _LEGACY_SPAN_RE):
        match = pattern.search(title)
        if match:
            title = match.group("title")
    return title.strip()


def _plain_title(title: str) -> str:
    title = _MARKDOWN_LINK_RE.sub(r"\1", title)
    title = _HTML_TAG_RE.sub("", title)
    title = re.sub(r"[`*_~]", "", title)
    return html.unescape(title).strip()


def _slugify(title: str) -> str:
    plain = _plain_title(title)
    normalized = unicodedata.normalize("NFKD", plain)
    ascii_title = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_title).strip("-")
    return slug or "section"


def _unique_anchor(title: str, seen: MutableMapping[str, int]) -> str:
    base = _slugify(title)
    seen[base] = seen.get(base, 0) + 1
    return base if seen[base] == 1 else f"{base}-{seen[base]}"


def _is_toc_cell(cell: Mapping[str, Any]) -> bool:
    if cell.get("cell_type") != "markdown":
        return False
    metadata = cell.get("metadata", {})
    marker = metadata.get(TOC_METADATA_KEY, {}) if isinstance(metadata, Mapping) else {}
    source = _source_as_text(cell.get("source", ""))
    if marker.get("role") == "table-of-contents" or TOC_MARKER in source:
        return True

    # Early releases used a leading-space title and ``+`` list items, without
    # metadata. Recognize that exact shape so old output can be upgraded while
    # leaving user-authored tables of contents alone.
    lines = [line for line in source.splitlines() if line.strip()]
    return bool(
        len(lines) > 1
        and lines[0] == " # Table of Contents"
        and all(_LEGACY_TOC_ITEM_RE.match(line) for line in lines[1:])
    )


def _clean_generated_anchors(text: str) -> str:
    lines = [
        line
        for line in text.splitlines()
        if not (_CURRENT_ANCHOR_RE.match(line) or _LEGACY_ANCHOR_RE.match(line))
    ]
    cleaned = "\n".join(lines)
    if text.endswith("\n") and cleaned:
        cleaned += "\n"
    return cleaned


def _decorate_markdown(
    source: str,
    colors: Sequence[str],
    seen_anchors: MutableMapping[str, int],
    heading_edits: Mapping[int, Mapping[str, Any]],
    heading_counter: List[int],
) -> Tuple[str, List[Dict[str, Any]]]:
    """Decorate ATX headings outside fenced code blocks."""

    source = _clean_generated_anchors(source)
    had_trailing_newline = source.endswith("\n")
    output: List[str] = []
    headings: List[Dict[str, Any]] = []
    fence: Optional[str] = None

    for line in source.splitlines():
        fence_match = _FENCE_RE.match(line)
        if fence_match:
            marker = fence_match.group(1)
            if fence is None:
                fence = marker[0]
            elif marker[0] == fence:
                fence = None
            output.append(line)
            continue

        match = _HEADING_RE.match(line) if fence is None else None
        if not match:
            output.append(line)
            continue

        level = len(match.group("hashes"))
        title = _strip_cutiepynb_markup(match.group("title"))
        if not title:
            output.append(line)
            continue

        heading_index = heading_counter[0]
        heading_counter[0] += 1
        edit = heading_edits.get(heading_index, {})
        title = str(edit.get("title", title))
        level = int(edit.get("level", level))

        anchor = _unique_anchor(title, seen_anchors)
        display_title = _plain_title(title)
        headings.append({"title": display_title, "level": level, "anchor": anchor})
        output.append(f'<a class="cutiepynb-anchor" id="{anchor}"></a>')
        formatted_title = heading_html(title, level, colors) if colors else title
        output.append(f'{match.group("indent")}{"#" * level} {formatted_title}')

    transformed = "\n".join(output)
    if had_trailing_newline and transformed:
        transformed += "\n"
    return transformed, headings


def _normalise_colors(colors: Optional[Sequence[str]]) -> Tuple[str, ...]:
    if colors is None:
        return tuple(DEFAULT_COLORS)
    normalised = tuple(colors)
    if any(not isinstance(color, str) or not color.strip() for color in normalised):
        raise ValueError("colors must contain non-empty strings")
    if any(not _CSS_COLOR_RE.fullmatch(color.strip()) for color in normalised):
        raise ValueError("colors must be safe CSS color values")
    return normalised


def _normalise_heading_edits(
    heading_edits: Optional[HeadingEdits],
) -> Dict[int, Dict[str, Any]]:
    if heading_edits is None:
        return {}
    if not isinstance(heading_edits, Mapping):
        raise ValueError("heading_edits must be a mapping keyed by heading index")

    normalised: Dict[int, Dict[str, Any]] = {}
    for index, raw_edit in heading_edits.items():
        if isinstance(index, bool) or not isinstance(index, int) or index < 0:
            raise ValueError("heading edit indices must be non-negative integers")
        if not isinstance(raw_edit, Mapping):
            raise ValueError(f"heading edit {index} must be a mapping")

        unknown_keys = set(raw_edit) - {"title", "level"}
        if unknown_keys:
            raise ValueError(
                f"heading edit {index} has unsupported fields: "
                f"{', '.join(sorted(str(key) for key in unknown_keys))}"
            )
        if not raw_edit:
            raise ValueError(f"heading edit {index} must change title, level, or both")

        edit: Dict[str, Any] = {}
        if "title" in raw_edit:
            title = raw_edit["title"]
            if not isinstance(title, str):
                raise ValueError(f"heading edit {index} title must be a string")
            title = _strip_cutiepynb_markup(title).strip()
            title = re.sub(r"[ \t]+#+[ \t]*$", "", title).strip()
            if not title or "\n" in title or "\r" in title:
                raise ValueError(
                    f"heading edit {index} title must be a non-empty single line"
                )
            edit["title"] = title

        if "level" in raw_edit:
            level = raw_edit["level"]
            if isinstance(level, bool) or not isinstance(level, int) or not 1 <= level <= 6:
                raise ValueError(f"heading edit {index} level must be an integer from 1 to 6")
            edit["level"] = level

        normalised[index] = edit

    return normalised


def generate_new_cells(
    cells: Iterable[Mapping[str, Any]],
    colors: Optional[Sequence[str]] = None,
    *,
    heading_edits: Optional[HeadingEdits] = None,
) -> Tuple[HeadingInfo, List[Cell]]:
    """Return decorated cells and the headings used to build a table of contents.

    Existing cutiepynb table-of-contents cells are removed, which makes the
    transformation safe to run more than once.
    """

    palette = _normalise_colors(colors)
    edits = _normalise_heading_edits(heading_edits)
    info: HeadingInfo = {}
    new_cells: List[Cell] = []
    seen_anchors: Dict[str, int] = {}
    heading_counter = [0]

    for cell_index, original_cell in enumerate(cells):
        if not isinstance(original_cell, Mapping):
            raise ValueError(f"cell {cell_index + 1} must be a notebook cell mapping")
        if _is_toc_cell(original_cell):
            continue

        cell = copy.deepcopy(dict(original_cell))
        if cell.get("cell_type") != "markdown":
            new_cells.append(cell)
            continue

        original_source = cell.get("source", "")
        transformed, headings = _decorate_markdown(
            _source_as_text(original_source),
            palette,
            seen_anchors,
            edits,
            heading_counter,
        )
        cell["source"] = _restore_source_type(transformed, original_source)
        new_cells.append(cell)

        for heading in headings:
            info[len(info)] = heading

    unused_edits = sorted(index for index in edits if index >= heading_counter[0])
    if unused_edits:
        index = unused_edits[0]
        raise ValueError(f"heading edit index {index} does not exist")

    return info, new_cells


def generate_contents(
    info_to_add: Mapping[int, Mapping[str, Any]],
    title: str = TOC_TITLE,
    *,
    cell_id: Optional[str] = "cutiepynb-toc",
) -> Cell:
    """Build the generated table-of-contents markdown cell."""

    source = [f"{TOC_MARKER}\n", f"# {title}\n", "\n"]
    for number in sorted(info_to_add):
        source.append(format_title_index(number, info_to_add))

    cell: Cell = {
        "cell_type": "markdown",
        "metadata": {TOC_METADATA_KEY: {"role": "table-of-contents"}},
        "source": source,
    }
    if cell_id is not None:
        cell["id"] = cell_id
    return cell


def _unique_toc_cell_id(cells: Sequence[Mapping[str, Any]]) -> str:
    """Return a valid table-of-contents cell id not already in ``cells``."""

    used_ids = {
        cell_id
        for cell in cells
        if isinstance(cell, Mapping)
        and isinstance((cell_id := cell.get("id")), str)
    }
    candidate = "cutiepynb-toc"
    suffix = 2
    while candidate in used_ids:
        candidate = f"cutiepynb-toc-{suffix}"
        suffix += 1
    return candidate


def create_new_document(
    document: Mapping[str, Any],
    colors: Optional[Sequence[str]] = None,
    *,
    add_toc: bool = True,
    toc_title: str = TOC_TITLE,
    heading_edits: Optional[HeadingEdits] = None,
) -> Notebook:
    """Return a styled copy of a notebook dictionary.

    The input is never mutated. Markdown headings receive stable, unique
    anchors and optional colors; code cells and fenced code examples are left
    untouched. ``heading_edits`` maps zero-based heading positions to a new
    ``title``, a new ``level`` from 1 to 6, or both.
    """

    if "cells" not in document or not isinstance(document["cells"], list):
        raise ValueError("document must be a notebook dictionary with a 'cells' list")
    if (
        not isinstance(toc_title, str)
        or not toc_title.strip()
        or "\n" in toc_title
        or "\r" in toc_title
    ):
        raise ValueError("toc_title must be a non-empty single line")

    result: Notebook = copy.deepcopy(dict(document))
    info, cells = generate_new_cells(
        result["cells"],
        colors,
        heading_edits=heading_edits,
    )
    if add_toc and info:
        # Cell ids were added to the notebook schema in nbformat 4.5. Adding
        # one to older notebooks makes them invalid, while reusing a fixed id
        # can collide with a user-authored cell in newer notebooks.
        minor_version = result.get("nbformat_minor", 0)
        supports_cell_ids = (
            result.get("nbformat") == 4
            and isinstance(minor_version, int)
            and minor_version >= 5
        )
        cell_id = _unique_toc_cell_id(cells) if supports_cell_ids else None
        cells.insert(
            0,
            generate_contents(
                info,
                title=toc_title.strip(),
                cell_id=cell_id,
            ),
        )
    result["cells"] = cells
    return result


def format_title_index(
    title_numb: int,
    titles: Mapping[int, Mapping[str, Any]],
) -> str:
    """Format one heading as a nested Markdown table-of-contents item."""

    title = titles[title_numb]
    level = int(title["level"])
    indentation = "  " * max(level - 1, 0)
    label = str(title["title"]).replace("[", r"\[").replace("]", r"\]")
    return f'{indentation}- [{label}](#{title["anchor"]})\n'


def extract_info(source: Sequence[str], titles: HeadingInfo) -> HeadingInfo:
    """Extract headings from markdown source into ``titles``.

    This compatibility helper does not modify the source. New code will
    usually call :func:`create_new_document` instead.
    """

    seen = {str(item["anchor"]): 1 for item in titles.values()}
    text = _source_as_text(source)
    fence: Optional[str] = None
    for line in text.splitlines():
        fence_match = _FENCE_RE.match(line)
        if fence_match:
            marker = fence_match.group(1)
            fence = None if fence == marker[0] else marker[0]
            continue
        match = _HEADING_RE.match(line) if fence is None else None
        if not match:
            continue
        title = _strip_cutiepynb_markup(match.group("title"))
        if title:
            anchor = _unique_anchor(title, seen)
            titles[len(titles)] = {
                "title": _plain_title(title),
                "level": len(match.group("hashes")),
                "anchor": anchor,
            }
    return titles


def create_source_anchor(
    source: Sequence[str],
    values: Mapping[str, Any],
    colors: Optional[Sequence[str]] = None,
) -> List[str]:
    """Add a cutiepynb anchor and styling to a single heading source.

    This function is retained for compatibility with the original public
    module. It returns notebook-style source lines.
    """

    del source  # The heading information in ``values`` is authoritative.
    level = int(values["level"])
    title = str(values["title"])
    palette = _normalise_colors(colors)
    formatted = heading_html(title, level, palette) if palette else title
    anchor = str(values["anchor"])
    return [
        f'<a class="cutiepynb-anchor" id="{anchor}"></a>\n',
        f'{"#" * level} {formatted}\n',
    ]


def _palette_colors(name: str, count: int = 6) -> Sequence[str]:
    try:
        import seaborn as sns
    except ImportError as exc:  # pragma: no cover - environment-dependent branch
        raise ImportError(
            "Seaborn palettes require the optional dependency: "
            "pip install 'cutiepynb[palette]'"
        ) from exc
    return sns.color_palette(name, n_colors=count).as_hex()


def enchular_ipynb(
    file: str | Path,
    sns_palette: Optional[str] = None,
    colors: Optional[Sequence[str]] = None,
    update_colors: Optional[Sequence[str]] = None,
    *,
    add_toc: bool = True,
    toc_title: str = TOC_TITLE,
) -> Notebook:
    """Load and transform a notebook without writing it to disk."""

    if sns_palette and colors is not None:
        raise ValueError("pass either sns_palette or colors, not both")
    selected_colors = _palette_colors(sns_palette) if sns_palette else colors

    path = Path(file)
    with path.open("r", encoding="utf-8") as stream:
        document = json.load(stream)

    transformed = create_new_document(
        document,
        selected_colors,
        add_toc=add_toc,
        toc_title=toc_title,
    )
    if update_colors is not None:
        transformed = update_heading_colors_in_document(transformed, update_colors)
    return transformed


def process_notebook(
    input_file: str | Path,
    output_file: str | Path | None = None,
    *,
    colors: Optional[Sequence[str]] = None,
    sns_palette: Optional[str] = None,
    add_toc: bool = True,
    toc_title: str = TOC_TITLE,
    overwrite: bool = False,
) -> Path:
    """Transform ``input_file`` and save it, returning the output path.

    When ``output_file`` is omitted, ``report.ipynb`` becomes
    ``report_chulo.ipynb``. Existing output is protected unless
    ``overwrite=True`` is explicitly requested.
    """

    document = enchular_ipynb(
        input_file,
        sns_palette=sns_palette,
        colors=colors,
        add_toc=add_toc,
        toc_title=toc_title,
    )
    return save_doc_enchulado(
        document,
        input_file,
        output_file=output_file,
        overwrite=overwrite,
    )


def cutiepy_nb(
    file: str | Path,
    sns_palette: Optional[str] = None,
    colors: Optional[Sequence[str]] = None,
    save: bool = True,
    update_colors: Optional[Sequence[str]] = None,
    *,
    output_file: str | Path | None = None,
    add_toc: bool = True,
    toc_title: str = TOC_TITLE,
) -> Notebook:
    """Compatibility API for styling a notebook.

    The transformed notebook dictionary is always returned. If ``save`` is
    true, it is also written to ``output_file`` or to ``*_chulo.ipynb``. This
    wrapper keeps the original overwrite behavior; new applications should
    prefer :func:`process_notebook` for explicit overwrite protection.
    """

    document = enchular_ipynb(
        file,
        sns_palette=sns_palette,
        colors=colors,
        update_colors=update_colors,
        add_toc=add_toc,
        toc_title=toc_title,
    )
    if save:
        save_doc_enchulado(
            document,
            file,
            output_file=output_file,
            overwrite=True,
        )
    return document
