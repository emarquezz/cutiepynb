"""Tests for in-memory notebook transformations."""

import copy

import nbformat
import pytest

from cutiepynb import create_new_document, update_heading_colors_in_document
from cutiepynb.core import TOC_MARKER, extract_info


def source_text(cell):
    source = cell["source"]
    return "".join(source) if isinstance(source, list) else source


def test_create_new_document_adds_styled_headings_and_nested_toc(notebook):
    original = copy.deepcopy(notebook)

    result = create_new_document(notebook, ["#111111", "#abcdef"])

    toc = source_text(result["cells"][0])
    first_markdown = source_text(result["cells"][1])
    second_markdown = source_text(result["cells"][2])

    assert TOC_MARKER in toc
    assert result["cells"][0]["id"] == "cutiepynb-toc"
    assert "- [Results](#results)" in toc
    assert "  - [Differential expression](#differential-expression)" in toc
    assert "  - [Differential expression](#differential-expression-2)" in toc
    assert "    - [Enrichment](#enrichment)" in toc
    assert 'id="results"' in first_markdown
    assert 'style="color: #111111"' in first_markdown
    assert 'style="color: #abcdef"' in first_markdown
    assert "# This is code, not a heading" in second_markdown
    assert 'id="this-is-code-not-a-heading"' not in second_markdown
    assert result["cells"][3] == notebook["cells"][2]
    assert notebook == original, "the transformation must not mutate its input"


def test_transformation_is_idempotent(notebook):
    first = create_new_document(notebook, ["tomato", "royalblue"])
    second = create_new_document(first, ["tomato", "royalblue"])

    assert second == first
    assert sum(TOC_MARKER in source_text(cell) for cell in second["cells"]) == 1


def test_heading_text_and_level_can_be_edited_in_the_same_pass(notebook):
    original = copy.deepcopy(notebook)

    result = create_new_document(
        notebook,
        ["#111111", "#222222", "#333333"],
        heading_edits={0: {"title": "Main findings", "level": 3}},
    )

    toc = source_text(result["cells"][0])
    markdown = source_text(result["cells"][1])
    assert "    - [Main findings](#main-findings)" in toc
    assert 'id="main-findings"' in markdown
    assert (
        '### <span class="cutiepynb-heading" style="color: #333333">'
        "Main findings</span>"
    ) in markdown
    assert "# Results" not in markdown
    assert create_new_document(
        result,
        ["#111111", "#222222", "#333333"],
        heading_edits={0: {"title": "Main findings", "level": 3}},
    ) == result
    assert notebook == original


def test_heading_edits_use_document_order_and_ignore_fenced_code(notebook):
    result = create_new_document(
        notebook,
        heading_edits={3: {"title": "Pathway enrichment", "level": 2}},
    )

    first_markdown = result["cells"][1]
    second_markdown = result["cells"][2]
    assert isinstance(first_markdown["source"], list)
    assert isinstance(second_markdown["source"], str)
    assert "# This is code, not a heading" in source_text(second_markdown)
    assert "## <span" in source_text(second_markdown)
    assert "Pathway enrichment" in source_text(second_markdown)
    assert "  - [Pathway enrichment](#pathway-enrichment)" in source_text(result["cells"][0])


def test_level_only_edit_preserves_inline_markdown():
    notebook = {
        "cells": [
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": "## *Careful* [results](https://example.com)",
            }
        ],
        "metadata": {},
        "nbformat": 4,
        "nbformat_minor": 4,
    }

    result = create_new_document(notebook, heading_edits={0: {"level": 4}})
    markdown = source_text(result["cells"][1])
    toc = source_text(result["cells"][0])

    assert "#### <span" in markdown
    assert "*Careful* [results](https://example.com)" in markdown
    assert "      - [Careful results](#careful-results)" in toc


def test_create_new_document_recolors_its_own_output_without_duplicates(notebook):
    first = create_new_document(notebook, ["red", "blue", "green"])
    first_before = copy.deepcopy(first)
    recolored = create_new_document(first, ["#111111", "#222222", "#333333"])
    direct = create_new_document(notebook, ["#111111", "#222222", "#333333"])

    assert recolored == direct
    assert first == first_before
    all_markdown = "\n".join(
        source_text(cell) for cell in recolored["cells"] if cell["cell_type"] == "markdown"
    )
    assert all_markdown.count(TOC_MARKER) == 1
    assert all_markdown.count('class="cutiepynb-anchor"') == 4
    assert all_markdown.count('class="cutiepynb-heading"') == 4
    assert "color: red" not in all_markdown
    assert "color: blue" not in all_markdown
    assert "color: green" not in all_markdown


def test_recoloring_preserves_previously_edited_headings(notebook):
    edited = create_new_document(
        notebook,
        ["red", "blue", "green"],
        heading_edits={0: {"title": "Main findings", "level": 3}},
    )
    recolored = create_new_document(edited, ["#111111", "#222222", "#333333"])

    toc = source_text(recolored["cells"][0])
    markdown = source_text(recolored["cells"][1])
    assert "    - [Main findings](#main-findings)" in toc
    assert (
        '### <span class="cutiepynb-heading" style="color: #333333">'
        "Main findings</span>"
    ) in markdown
    assert markdown.count('id="main-findings"') == 1
    assert "color: red" not in markdown


def test_reupload_can_remove_the_generated_toc_while_recoloring(notebook):
    styled = create_new_document(notebook, ["red", "blue"])
    recolored = create_new_document(styled, ["#111111", "#222222"], add_toc=False)

    assert all(TOC_MARKER not in source_text(cell) for cell in recolored["cells"])
    assert "color: red" not in source_text(recolored["cells"][0])
    assert "color: #111111" in source_text(recolored["cells"][0])


def test_legacy_output_is_upgraded_without_removing_user_anchors(notebook):
    notebook["cells"].insert(
        0,
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [" # Table of Contents\n", "+ [Results](#Results_0)\n"],
        },
    )
    notebook["cells"][1]["source"] = [
        '<a class="anchor" id="Results_0"></a>\n',
        '# <span class=title_0 style="color: red">Results</span>\n',
        '<a class="anchor" id="keep-me"></a>\n',
    ]

    result = create_new_document(notebook, ["blue"])
    markdown = source_text(result["cells"][1])

    assert sum("Table of Contents" in source_text(cell) for cell in result["cells"]) == 1
    assert 'id="results"' in markdown
    assert 'id="Results_0"' not in markdown
    assert 'id="keep-me"' in markdown


def test_empty_palette_adds_navigation_without_color_markup(notebook):
    result = create_new_document(notebook, colors=[])
    markdown = source_text(result["cells"][1])

    assert 'class="cutiepynb-anchor"' in markdown
    assert "cutiepynb-heading" not in markdown
    assert "# Results" in markdown


def test_table_of_contents_can_be_disabled_and_renamed(notebook):
    without_toc = create_new_document(notebook, add_toc=False)
    renamed = create_new_document(notebook, toc_title="On this page")

    assert all(TOC_MARKER not in source_text(cell) for cell in without_toc["cells"])
    assert "# On this page" in source_text(renamed["cells"][0])


def test_existing_colors_are_updated_without_nesting_spans(notebook):
    styled = create_new_document(notebook, ["red", "blue", "green"])

    updated = update_heading_colors_in_document(styled, ["#000000", "#ffffff"])
    markdown = source_text(updated["cells"][1])

    assert 'style="color: #000000"' in markdown
    assert 'style="color: #ffffff"' in markdown
    assert "red" not in markdown
    assert markdown.count("<span") == 3
    assert "red" in source_text(styled["cells"][1]), "the input must not be mutated"


def test_extract_info_handles_multiple_headings_and_fenced_examples():
    titles = extract_info(
        ["Intro\n", "# One\n", "## Two\n", "```\n", "# Not me\n", "```\n"],
        {},
    )

    assert [item["title"] for item in titles.values()] == ["One", "Two"]
    assert [item["level"] for item in titles.values()] == [1, 2]


@pytest.mark.parametrize(
    "document, message",
    [
        ({}, "'cells' list"),
        ({"cells": "not-a-list"}, "'cells' list"),
    ],
)
def test_invalid_notebook_shape_is_rejected(document, message):
    with pytest.raises(ValueError, match=message):
        create_new_document(document)


def test_malformed_cell_is_rejected_with_a_clear_error():
    with pytest.raises(ValueError, match="cell 1"):
        create_new_document({"cells": ["not-a-cell"]})


@pytest.mark.parametrize("colors", [[""], ["red; background: black"], ['red"']])
def test_unsafe_or_empty_colors_are_rejected(notebook, colors):
    with pytest.raises(ValueError, match="colors"):
        create_new_document(notebook, colors)


def test_multiline_toc_title_is_rejected(notebook):
    with pytest.raises(ValueError, match="single line"):
        create_new_document(notebook, toc_title="Contents\n# Surprise")


@pytest.mark.parametrize(
    "heading_edits, message",
    [
        ([{"title": "Nope"}], "mapping"),
        ({-1: {"title": "Nope"}}, "non-negative"),
        ({True: {"title": "Nope"}}, "non-negative"),
        ({0: "Nope"}, "must be a mapping"),
        ({0: {}}, "must change"),
        ({0: {"unknown": "Nope"}}, "unsupported fields"),
        ({0: {"title": ""}}, "non-empty single line"),
        ({0: {"title": "Two\nlines"}}, "non-empty single line"),
        ({0: {"level": True}}, "integer from 1 to 6"),
        ({0: {"level": 0}}, "integer from 1 to 6"),
        ({0: {"level": 7}}, "integer from 1 to 6"),
        ({99: {"title": "Nope"}}, "does not exist"),
    ],
)
def test_invalid_heading_edits_are_rejected(notebook, heading_edits, message):
    with pytest.raises(ValueError, match=message):
        create_new_document(notebook, heading_edits=heading_edits)


@pytest.mark.parametrize("minor_version", range(6))
def test_generated_notebook_is_valid_for_supported_minor_versions(notebook, minor_version):
    notebook["nbformat_minor"] = minor_version
    if minor_version < 5:
        for cell in notebook["cells"]:
            cell.pop("id", None)

    result = create_new_document(notebook)

    nbformat.validate(result)
    if minor_version < 5:
        assert "id" not in result["cells"][0]
    else:
        assert result["cells"][0]["id"] == "cutiepynb-toc"


def test_generated_toc_uses_a_unique_cell_id(notebook):
    notebook["cells"][0]["id"] = "cutiepynb-toc"

    result = create_new_document(notebook)

    assert result["cells"][0]["id"] == "cutiepynb-toc-2"
    assert len({cell["id"] for cell in result["cells"]}) == len(result["cells"])
    nbformat.validate(result)
