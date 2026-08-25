import {
  extractNotebookHeadings,
  isGeneratedToc,
  plainTitle,
  sourceAsText,
  stripCutiepynbMarkup,
} from "./transform.js";

export { isGeneratedToc } from "./transform.js";

export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;
export const PREVIEW_HEADING_LIMIT = 80;
export const MAX_PREVIEW_TITLE_LENGTH = 240;

// Every bundled palette meets WCAG AA contrast against a white notebook page.
export const PALETTES = {
  cutie: ["#6D28D9", "#BE185D", "#BE123C", "#C2410C", "#0E7490", "#047857"],
  berry: ["#4C1D95", "#6B21A8", "#86198F", "#9D174D", "#BE123C", "#C2415D"],
  ocean: ["#164E63", "#075985", "#0369A1", "#0E7490", "#0F766E", "#047857"],
  earth: ["#713F12", "#78350F", "#92400E", "#854D0E", "#3F6212", "#166534"],
  colorSafe: ["#000000", "#9A5A00", "#0072B2", "#007A68", "#B0004B", "#6B4C9A"],
};

export const DEMO_NOTEBOOK = {
  cells: [
    {
      id: "intro-cell",
      cell_type: "markdown",
      metadata: {},
      source: [
        "# RNA-seq analysis\n",
        "A small example notebook for cutiepynb.\n",
        "## Quality control\n",
        "### Read quality\n",
        "### Alignment summary\n",
      ],
    },
    {
      id: "code-cell",
      cell_type: "code",
      execution_count: null,
      metadata: {},
      outputs: [],
      source: ["# This code is never executed\n", "print('hello')\n"],
    },
    {
      id: "analysis-cell",
      cell_type: "markdown",
      metadata: {},
      source: [
        "## Differential expression\n",
        "### Significant genes\n",
        "## Functional enrichment\n",
        "### Biological interpretation\n",
      ],
    },
  ],
  metadata: {
    kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
  },
  nbformat: 4,
  nbformat_minor: 5,
};

const CURRENT_SPAN_RE =
  /<span\b[^>]*class=["'][^"']*\bcutiepynb-heading\b[^"']*["'][^>]*>(.*?)<\/span>/i;
const CURRENT_MARKUP_RE = /class=["'][^"']*\b(?:cutiepynb-heading|cutiepynb-anchor)\b[^"']*["']/i;
const LEGACY_MARKUP_RE = /class=(?:["'])?(?:title_\d+|anchor)(?:["'\s>])/i;

export function previewHeadingTitle(title) {
  const value = String(title);
  return value.length > MAX_PREVIEW_TITLE_LENGTH
    ? `${value.slice(0, MAX_PREVIEW_TITLE_LENGTH - 1)}…`
    : value;
}

function validateCell(cell, index) {
  if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
    throw new Error(`Cell ${index + 1} is malformed.`);
  }
  if (typeof cell.cell_type !== "string" || !cell.cell_type) {
    throw new Error(`Cell ${index + 1} has no valid cell_type.`);
  }
  const { source } = cell;
  const sourceIsValid =
    typeof source === "string" ||
    (Array.isArray(source) && source.every((line) => typeof line === "string"));
  if (!sourceIsValid) {
    throw new Error(`Cell ${index + 1} has an invalid source.`);
  }
}

export function parseNotebookText(text) {
  let notebook;
  try {
    notebook = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!notebook || typeof notebook !== "object" || Array.isArray(notebook)) {
    throw new Error("This does not look like a Jupyter notebook.");
  }
  if (!Array.isArray(notebook.cells)) {
    throw new Error("This does not look like a Jupyter notebook: the cells list is missing.");
  }
  if (notebook.nbformat !== 4) {
    throw new Error("cutiepynb currently expects a version 4 Jupyter notebook.");
  }
  if (!Number.isInteger(notebook.nbformat_minor) || notebook.nbformat_minor < 0) {
    throw new Error("This notebook has an invalid nbformat_minor value.");
  }
  notebook.cells.forEach(validateCell);
  return notebook;
}

export function extractHeadings(notebook) {
  return extractNotebookHeadings(notebook);
}

export function isCutiepynbNotebook(notebook) {
  return notebook.cells.some((cell) => {
    if (cell?.cell_type !== "markdown") return false;
    const source = sourceAsText(cell.source);
    return isGeneratedToc(cell) || CURRENT_MARKUP_RE.test(source) || LEGACY_MARKUP_RE.test(source);
  });
}

export function extractStyledPalette(notebook, fallback = PALETTES.cutie) {
  const colors = [...fallback];
  let found = false;

  for (const cell of notebook.cells) {
    if (cell?.cell_type !== "markdown" || isGeneratedToc(cell)) continue;
    for (const line of sourceAsText(cell.source).split(/\r?\n/)) {
      const heading = line.match(/^ {0,3}(#{1,6})[\t ]+(.+?)\s*$/);
      if (!heading || !CURRENT_SPAN_RE.test(heading[2])) continue;
      const color = heading[2].match(/\bcolor\s*:\s*(#[0-9a-fA-F]{6})\b/i)?.[1];
      if (!color) continue;
      colors[heading[1].length - 1] = color.toUpperCase();
      found = true;
    }
  }

  return found ? colors : null;
}

export function extractTocSettings(notebook) {
  for (const cell of notebook.cells) {
    if (!isGeneratedToc(cell)) continue;
    const titleLine = sourceAsText(cell.source)
      .split(/\r?\n/)
      .find((line) => /^#\s+\S/.test(line));
    const title = titleLine
      ? plainTitle(stripCutiepynbMarkup(titleLine.replace(/^#\s+/, "")))
      : "";
    return { addToc: true, title: title || "Table of Contents" };
  }
  return { addToc: false, title: "Table of Contents" };
}

export function buildHeadingEdits(originalHeadings, currentHeadings) {
  if (originalHeadings.length !== currentHeadings.length) {
    throw new Error("The notebook outline changed unexpectedly.");
  }

  return currentHeadings.flatMap((heading, position) => {
    const original = originalHeadings[position];
    const edit = { index: original.index ?? position };
    const title = typeof heading.title === "string" ? heading.title.trim() : "";
    if (title !== original.title) edit.title = title;
    if (heading.level !== original.level) edit.level = heading.level;
    return Object.keys(edit).length > 1 ? [edit] : [];
  });
}

function relativeLuminance(hexColor) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hexColor.slice(offset, offset + 2), 16));
  if (channels.some((channel) => !Number.isFinite(channel))) return null;
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(foreground, background = "#FFFFFF") {
  if (!/^#[0-9a-fA-F]{6}$/.test(foreground) || !/^#[0-9a-fA-F]{6}$/.test(background)) {
    return null;
  }
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function outputFileName(inputName) {
  const name = inputName || "notebook.ipynb";
  if (!name.toLowerCase().endsWith(".ipynb")) return `${name}_chulo.ipynb`;
  const stem = name.slice(0, -6);
  return stem.toLowerCase().endsWith("_chulo") ? `${stem}.ipynb` : `${stem}_chulo.ipynb`;
}
