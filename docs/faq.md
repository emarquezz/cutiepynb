# Frequently asked questions

## Does cutiepynb change my original notebook?

Not by default. The command writes `NAME_chulo.ipynb`. In-place replacement
requires both `--in-place` and `--force`.

## Why does cutiepynb refuse to save?

The output already exists. Choose another `--output` path or add `--force` if
replacement is intentional.

## Can I run it twice?

Yes. cutiepynb recognizes its own table of contents, anchors, and heading spans,
then replaces them instead of creating duplicates.

## Why was a line beginning with `#` ignored?

Only Markdown headings are styled. Lines in code cells and fenced Markdown code
blocks are intentionally ignored.

## Can I use seaborn palettes?

Yes. Install `cutiepynb[palette]`, then pass `--palette mako` or
`sns_palette="mako"`.

## Can I remove the generated styling?

Keep the original notebook as the reproducible source. That is safer than
trying to reverse arbitrary notebook edits and makes it easy to generate many
visual variants.
