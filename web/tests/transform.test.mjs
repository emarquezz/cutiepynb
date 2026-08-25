import assert from "node:assert/strict";
import test from "node:test";

import {
  TOC_MARKER,
  serializeTransformedNotebook,
  transformNotebook,
} from "../transform.js";

function sourceText(cell) {
  return Array.isArray(cell.source) ? cell.source.join("") : cell.source;
}

const NOTEBOOK = {
  cells: [
    {
      id: "markdown",
      cell_type: "markdown",
      metadata: {},
      source: ["# Results\n", "## Details\n", "```\n", "# Not code\n", "```\n"],
    },
    {
      id: "code",
      cell_type: "code",
      execution_count: null,
      metadata: {},
      outputs: [],
      source: ["# Leave me alone\n"],
    },
  ],
  metadata: {},
  nbformat: 4,
  nbformat_minor: 5,
};

test("transforms a copy, edits headings, and ignores fenced and code content", () => {
  const original = structuredClone(NOTEBOOK);
  const result = transformNotebook(NOTEBOOK, {
    colors: ["#111111", "#222222", "#333333"],
    headingEdits: [{ index: 0, title: "Main results", level: 3 }],
    tocTitle: "On this page",
  });

  assert.deepEqual(NOTEBOOK, original);
  assert.match(sourceText(result.cells[0]), /# On this page/);
  assert.match(sourceText(result.cells[0]), /\[Main results\]\(#main-results\)/);
  assert.match(sourceText(result.cells[1]), /### <span[^>]+>Main results<\/span>/);
  assert.doesNotMatch(sourceText(result.cells[1]), /id="not-code"/);
  assert.deepEqual(result.cells[2], NOTEBOOK.cells[1]);
});

test("repeat runs recolor cleanly without duplicate navigation or anchors", () => {
  const first = transformNotebook(NOTEBOOK, { colors: ["red", "blue"] });
  const recolored = transformNotebook(first, { colors: ["#111111", "#222222"] });
  const direct = transformNotebook(NOTEBOOK, { colors: ["#111111", "#222222"] });
  const markdown = recolored.cells
    .filter((cell) => cell.cell_type === "markdown")
    .map(sourceText)
    .join("\n");

  assert.deepEqual(recolored, direct);
  assert.equal(markdown.split(TOC_MARKER).length - 1, 1);
  assert.equal(markdown.match(/class="cutiepynb-anchor"/g)?.length, 2);
  assert.doesNotMatch(markdown, /color: (?:red|blue)/);
});

test("older notebooks get a valid toc without a cell id", () => {
  const oldNotebook = structuredClone(NOTEBOOK);
  oldNotebook.nbformat_minor = 4;
  oldNotebook.cells.forEach((cell) => delete cell.id);
  const result = transformNotebook(oldNotebook);
  assert.equal("id" in result.cells[0], false);
});

test("serializes downloadable notebook JSON with a final newline", () => {
  const output = serializeTransformedNotebook(NOTEBOOK, { addToc: false });
  assert.ok(output.endsWith("\n"));
  assert.equal(JSON.parse(output).nbformat, 4);
});

test("rejects unsafe colors, invalid titles, and missing edit targets", () => {
  assert.throws(
    () => transformNotebook(NOTEBOOK, { colors: ["red; background: black"] }),
    /safe CSS color/,
  );
  assert.throws(
    () => transformNotebook(NOTEBOOK, { headingEdits: [{ index: 0, title: "" }] }),
    /non-empty single line/,
  );
  assert.throws(
    () => transformNotebook(NOTEBOOK, { headingEdits: [{ index: 99, level: 2 }] }),
    /does not exist/,
  );
});
