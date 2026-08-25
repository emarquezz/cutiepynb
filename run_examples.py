"""Style the small example notebook included with the documentation."""

from pathlib import Path

from cutiepynb import process_notebook


def run_example_notebooks():
    examples = Path(__file__).parent / "docs" / "examples"
    example_files = [examples / "Test.ipynb"]

    for file in example_files:
        output = process_notebook(
            file,
            colors=["#40498e", "#357ba3", "#38aaac", "#79d6ae"],
            overwrite=True,
        )
        print(f"Processed notebook: {output}")


if __name__ == "__main__":
    run_example_notebooks()
