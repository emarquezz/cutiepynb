# Changelog

## 1.1.0 - Unreleased

### Added

- A working `cutiepynb` command-line interface.
- Safe `process_notebook` and in-memory `create_new_document` APIs.
- Default colors, custom output paths, custom TOC titles, and optional TOCs.
- Optional seaborn palette support through `cutiepynb[palette]`.
- Tests for transformations, file handling, backward compatibility, and CLI use.
- A complete tutorial and API-oriented documentation.
- A static browser studio with a safe outline preview, background formatting,
  persistent download recovery, and responsive keyboard-friendly controls.
- An advanced outline editor for correcting heading text and changing H1–H6
  levels before download.
- A native JavaScript browser transformer, shared Python/JavaScript conformance
  fixtures, and a lightweight accessible sparkle treatment for the studio.

### Changed

- Transformations no longer mutate their input dictionaries.
- Repeated runs are idempotent.
- Multiple headings in one cell and duplicate heading names are supported.
- Code cells and fenced Markdown code examples are ignored correctly.
- Base installation no longer depends on unused NumPy.
- CI workflows no longer install unrelated geospatial dependencies.
- Default and browser palette colors meet AA contrast on a white notebook page.
- Re-uploaded cutiepynb notebooks restore their palette and navigation choice,
  then replace old colors without duplicating spans, anchors, or the TOC.
- The browser studio no longer downloads or starts Pyodide, making its formatter
  available immediately and removing the runtime CDN dependency.

### Fixed

- The missing CLI module referenced by the package metadata.
- Seaborn palette handling and heading-level color indexing.
- Invalid heading span markup and fragile table-of-contents links.
- Tests writing generated notebooks into the repository.
- Invalid table-of-contents cell IDs in older notebook formats and collisions
  with user-authored cell IDs.
- Repeated `_chulo_chulo.ipynb` suffixes when restyling a downloaded notebook.

## 1.0.0

- Initial PyPI release with colored headings and table-of-contents generation.
