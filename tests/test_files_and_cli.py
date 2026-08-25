"""Tests for file processing, the compatibility API, and the CLI."""

import json
from pathlib import Path

import pytest

from cutiepynb import cutiepy_nb, process_notebook
from cutiepynb.cli import main


def source_text(cell):
    source = cell["source"]
    return "".join(source) if isinstance(source, list) else source


def test_process_notebook_uses_traditional_output_name(notebook_file):
    output = process_notebook(notebook_file, colors=["#123456"])

    assert output == notebook_file.with_name("analysis_chulo.ipynb")
    saved = json.loads(output.read_text(encoding="utf-8"))
    assert "Table of Contents" in source_text(saved["cells"][0])
    assert "#123456" in source_text(saved["cells"][1])


def test_process_notebook_protects_existing_output(notebook_file):
    output = process_notebook(notebook_file)

    with pytest.raises(FileExistsError, match="overwrite=True"):
        process_notebook(notebook_file)

    assert process_notebook(notebook_file, overwrite=True) == output


def test_custom_output_directory_is_created(notebook_file, tmp_path):
    destination = tmp_path / "nested" / "pretty.ipynb"

    result = process_notebook(notebook_file, destination)

    assert result == destination
    assert destination.exists()


def test_compatibility_api_can_return_without_saving(notebook_file):
    result = cutiepy_nb(notebook_file, colors=["purple"], save=False)

    assert "purple" in source_text(result["cells"][1])
    assert not notebook_file.with_name("analysis_chulo.ipynb").exists()


def test_cli_writes_selected_colors(notebook_file, tmp_path, capsys):
    output = tmp_path / "styled.ipynb"

    exit_code = main(
        [
            str(notebook_file),
            "--output",
            str(output),
            "--color",
            "#101010",
            "--color",
            "#202020",
        ]
    )

    assert exit_code == 0
    assert f"Saved {output}" in capsys.readouterr().out
    saved = json.loads(output.read_text(encoding="utf-8"))
    assert "#101010" in source_text(saved["cells"][1])
    assert "#202020" in source_text(saved["cells"][1])


def test_cli_requires_force_for_in_place(notebook_file):
    with pytest.raises(SystemExit) as error:
        main([str(notebook_file), "--in-place"])

    assert error.value.code == 2


def test_cli_can_replace_input_when_explicit(notebook_file):
    original_path = Path(notebook_file)

    assert main([str(original_path), "--in-place", "--force", "--no-toc"]) == 0

    saved = json.loads(original_path.read_text(encoding="utf-8"))
    assert all("Table of Contents" not in source_text(cell) for cell in saved["cells"])
    assert "cutiepynb-heading" in source_text(saved["cells"][0])
