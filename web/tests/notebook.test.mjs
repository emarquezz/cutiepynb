import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_NOTEBOOK,
  MAX_PREVIEW_TITLE_LENGTH,
  PALETTES,
  buildHeadingEdits,
  contrastRatio,
  extractHeadings,
  extractStyledPalette,
  extractTocSettings,
  formatBytes,
  isCutiepynbNotebook,
  outputFileName,
  parseNotebookText,
  previewHeadingTitle,
} from "../notebook.js";

test("parses a structurally valid notebook", () => {
  assert.equal(parseNotebookText(JSON.stringify(DEMO_NOTEBOOK)).nbformat, 4);
  assert.ok(DEMO_NOTEBOOK.cells.every((cell) => typeof cell.id === "string"));
});

test("rejects invalid JSON and notebook roots", () => {
  assert.throws(() => parseNotebookText("nope"), /valid JSON/);
  assert.throws(() => parseNotebookText("[]"), /Jupyter notebook/);
  assert.throws(() => parseNotebookText('{"nbformat":4}'), /cells list/);
  assert.throws(
    () => parseNotebookText('{"nbformat":3,"nbformat_minor":0,"cells":[]}'),
    /version 4/,
  );
  assert.throws(
    () => parseNotebookText('{"nbformat":4,"nbformat_minor":"5","cells":[]}'),
    /nbformat_minor/,
  );
});

test("rejects malformed cells before they reach the formatter", () => {
  const malformedCell = { nbformat: 4, nbformat_minor: 5, cells: ["not a cell"] };
  const missingType = { nbformat: 4, nbformat_minor: 5, cells: [{ source: [] }] };
  const invalidSource = {
    nbformat: 4,
    nbformat_minor: 5,
    cells: [{ cell_type: "markdown", source: ["valid", 2] }],
  };

  assert.throws(() => parseNotebookText(JSON.stringify(malformedCell)), /Cell 1 is malformed/);
  assert.throws(() => parseNotebookText(JSON.stringify(missingType)), /cell_type/);
  assert.throws(() => parseNotebookText(JSON.stringify(invalidSource)), /invalid source/);
});

test("extracts Markdown headings but ignores code and fenced examples", () => {
  const notebook = structuredClone(DEMO_NOTEBOOK);
  notebook.cells.push({
    id: "fence-cell",
    cell_type: "markdown",
    metadata: {},
    source: ["```python\n", "# Not a heading\n", "```\n", "#### A real heading\n"],
  });

  const headings = extractHeadings(notebook);
  assert.equal(headings.some((heading) => heading.title === "Not a heading"), false);
  assert.equal(headings.at(-1).title, "A real heading");
  assert.equal(headings.at(-1).level, 4);
  assert.equal(headings.at(-1).index, headings.length - 1);
  assert.equal(headings.some((heading) => heading.title.includes("never executed")), false);
});

test("understands current styled headings and decodes common entities", () => {
  const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    cells: [
      {
        id: "styled-cell",
        cell_type: "markdown",
        metadata: {},
        source: [
          '<a class="cutiepynb-anchor" id="results"></a>\n',
          '# <span class="cutiepynb-heading" style="color: red">Results &amp; notes</span>\n',
        ],
      },
    ],
  };

  assert.deepEqual(extractHeadings(notebook), [
    { index: 0, level: 1, title: "Results & notes" },
  ]);
});

test("ignores current and legacy generated tables of contents", () => {
  const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    cells: [
      {
        id: "current-toc",
        cell_type: "markdown",
        metadata: { cutiepynb: { role: "table-of-contents" } },
        source: ["# Contents\n", "- [Real](#real)\n"],
      },
      {
        id: "legacy-toc",
        cell_type: "markdown",
        metadata: {},
        source: [" # Table of Contents\n", "+ [Real](#Real_0)\n"],
      },
      {
        id: "real-cell",
        cell_type: "markdown",
        metadata: {},
        source: "# Real",
      },
    ],
  };

  assert.deepEqual(extractHeadings(notebook), [{ index: 0, level: 1, title: "Real" }]);
});

test("detects previously styled notebooks and restores their palette and TOC settings", () => {
  const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    cells: [
      {
        id: "toc",
        cell_type: "markdown",
        metadata: { cutiepynb: { role: "table-of-contents" } },
        source: ["<!-- cutiepynb:table-of-contents -->\n", "# On this page\n"],
      },
      {
        id: "styled",
        cell_type: "markdown",
        metadata: {},
        source: [
          '<a class="cutiepynb-anchor" id="results"></a>\n',
          '# <span class="cutiepynb-heading" style="color: #123456">Results</span>\n',
          '## <span class="cutiepynb-heading" style="color: #ABCDEF">Notes</span>\n',
        ],
      },
    ],
  };

  assert.equal(isCutiepynbNotebook(notebook), true);
  assert.deepEqual(extractTocSettings(notebook), { addToc: true, title: "On this page" });
  assert.deepEqual(extractStyledPalette(notebook), [
    "#123456",
    "#ABCDEF",
    ...PALETTES.cutie.slice(2),
  ]);
  assert.deepEqual(extractHeadings(notebook), [
    { index: 0, level: 1, title: "Results" },
    { index: 1, level: 2, title: "Notes" },
  ]);
});

test("recognizes styled notebooks without a TOC and leaves navigation disabled", () => {
  const notebook = {
    nbformat: 4,
    nbformat_minor: 4,
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: '<a class="anchor" id="Old_0"></a>\n# <span class=title_0>Old</span>',
      },
    ],
  };

  assert.equal(isCutiepynbNotebook(notebook), true);
  assert.deepEqual(extractTocSettings(notebook), {
    addToc: false,
    title: "Table of Contents",
  });
  assert.equal(isCutiepynbNotebook(DEMO_NOTEBOOK), false);
});

test("builds sparse heading edits and preserves unchanged fields", () => {
  const original = [
    { index: 0, level: 1, title: "Results" },
    { index: 1, level: 2, title: "Methods" },
  ];
  const current = [
    { index: 0, level: 3, title: "Results" },
    { index: 1, level: 2, title: "Better methods" },
  ];

  assert.deepEqual(buildHeadingEdits(original, current), [
    { index: 0, level: 3 },
    { index: 1, title: "Better methods" },
  ]);
});

test("notebook HTML stays inert and only the visible preview is capped", () => {
  const longTitle = "x".repeat(MAX_PREVIEW_TITLE_LENGTH + 40);
  const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    cells: [
      {
        id: "hostile-cell",
        cell_type: "markdown",
        metadata: {},
        source: [`# <img src=x onerror=alert(1)>Safe ${longTitle}`],
      },
    ],
  };

  const [heading] = extractHeadings(notebook);
  assert.equal(heading.title.includes("<img"), false);
  assert.equal(heading.title.includes("onerror"), false);
  assert.ok(heading.title.length > MAX_PREVIEW_TITLE_LENGTH);
  assert.equal(previewHeadingTitle(heading.title).length, MAX_PREVIEW_TITLE_LENGTH);
  assert.ok(previewHeadingTitle(heading.title).endsWith("…"));
});

test("all preset colors meet AA contrast on a white notebook page", () => {
  for (const [name, colors] of Object.entries(PALETTES)) {
    assert.equal(colors.length, 6, `${name} should provide one color per heading level`);
    for (const color of colors) {
      assert.ok(contrastRatio(color) >= 4.5, `${name} ${color} should meet AA contrast`);
    }
  }
});

test("creates traditional output names", () => {
  assert.equal(outputFileName("analysis.ipynb"), "analysis_chulo.ipynb");
  assert.equal(outputFileName("analysis"), "analysis_chulo.ipynb");
  assert.equal(outputFileName("analysis_chulo.ipynb"), "analysis_chulo.ipynb");
});

test("formats file sizes", () => {
  assert.equal(formatBytes(0), "0 KB");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(2.5 * 1024 * 1024), "2.5 MB");
});
