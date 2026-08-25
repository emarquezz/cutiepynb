export const TOC_TITLE = "Table of Contents";
export const TOC_MARKER = "<!-- cutiepynb:table-of-contents -->";

const DEFAULT_COLORS = [
  "#6d28d9",
  "#be185d",
  "#be123c",
  "#c2410c",
  "#0e7490",
  "#047857",
];

const FENCE_RE = /^\s*(`{3,}|~{3,})/;
const HEADING_RE = /^( {0,3})(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const CURRENT_ANCHOR_RE =
  /^\s*<a\s+class=["']cutiepynb-anchor["']\s+id=["'][^"']+["']\s*><\/a>\s*$/;
const LEGACY_ANCHOR_RE =
  /^\s*<a\s+class=["']anchor["']\s+id=["'][^"']+_\d+["']\s*><\/a>\s*$/;
const CURRENT_SPAN_RE =
  /<span\b[^>]*class=["']cutiepynb-heading["'][^>]*>(.*?)<\/span>/i;
const LEGACY_SPAN_RE =
  /<span\b[^>]*class=(?:["'])?title_\d+(?:["'])?[^>]*>(.*?)<\/span>/i;
const MARKDOWN_LINK_RE = /!?\[([^\]]+)\]\([^)]+\)/g;
const HTML_TAG_RE = /<[^>]+>/g;
const LEGACY_TOC_ITEM_RE = /^\s*\+\s+\[[^\]]+\]\(#[^)]+\)\s*$/;
const CSS_COLOR_RE = /^(?:#[0-9a-fA-F]{3,8}|[A-Za-z][A-Za-z0-9-]*|[A-Za-z][A-Za-z0-9-]*\([#A-Za-z0-9_.,% /+\-]+\))$/;
const LINE_BREAKS = new Set(["\n", "\v", "\f", "\r", "\x1c", "\x1d", "\x1e", "\x85", "\u2028", "\u2029"]);
const HTML_ENTITIES = {
  amp: "&",
  apos: "'",
  copy: "©",
  divide: "÷",
  gt: ">",
  hellip: "…",
  laquo: "«",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  reg: "®",
  times: "×",
};

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function sourceAsText(source) {
  if (Array.isArray(source)) return source.map(String).join("");
  return String(source || "");
}

function splitLinesKeepEnds(text) {
  if (!text) return [];
  const lines = [];
  let start = 0;
  let index = 0;

  while (index < text.length) {
    const character = text[index];
    if (character === "\r" && text[index + 1] === "\n") {
      index += 2;
      lines.push(text.slice(start, index));
      start = index;
      continue;
    }
    if (LINE_BREAKS.has(character)) {
      index += 1;
      lines.push(text.slice(start, index));
      start = index;
      continue;
    }
    index += 1;
  }

  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

function stripLineEnding(line) {
  if (line.endsWith("\r\n")) return line.slice(0, -2);
  return LINE_BREAKS.has(line.at(-1)) ? line.slice(0, -1) : line;
}

function splitLines(text) {
  return splitLinesKeepEnds(text).map(stripLineEnding);
}

function restoreSourceType(text, originalSource) {
  return Array.isArray(originalSource) ? splitLinesKeepEnds(text) : text;
}

export function stripCutiepynbMarkup(rawTitle) {
  let title = String(rawTitle);
  for (const pattern of [CURRENT_SPAN_RE, LEGACY_SPAN_RE]) {
    const match = title.match(pattern);
    if (match) title = match[1];
  }
  return title.trim();
}

function decodeHtmlEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (match, entity) => {
    if (entity[0] !== "#") return HTML_ENTITIES[entity.toLowerCase()] ?? match;
    const hexadecimal = entity[1]?.toLowerCase() === "x";
    const number = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isFinite(number) || number < 0 || number > 0x10ffff) return match;
    try {
      return String.fromCodePoint(number);
    } catch {
      return match;
    }
  });
}

export function plainTitle(rawTitle) {
  return decodeHtmlEntities(
    String(rawTitle)
      .replace(MARKDOWN_LINK_RE, "$1")
      .replace(HTML_TAG_RE, "")
      .replace(/[`*_~]/g, ""),
  ).trim();
}

function slugify(title) {
  const asciiTitle = plainTitle(title)
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase();
  return asciiTitle.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}

function uniqueAnchor(title, seen) {
  const base = slugify(title);
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

export function isGeneratedToc(cell) {
  if (cell?.cell_type !== "markdown") return false;
  const metadata = isMapping(cell.metadata) ? cell.metadata : {};
  const marker = isMapping(metadata.cutiepynb) ? metadata.cutiepynb : {};
  const source = sourceAsText(cell.source);
  if (marker.role === "table-of-contents" || source.includes(TOC_MARKER)) return true;

  const lines = splitLines(source).filter((line) => line.trim());
  return (
    lines.length > 1 &&
    lines[0] === " # Table of Contents" &&
    lines.slice(1).every((line) => LEGACY_TOC_ITEM_RE.test(line))
  );
}

export function extractNotebookHeadings(notebook) {
  const headings = [];
  for (const cell of notebook.cells ?? []) {
    if (cell?.cell_type !== "markdown" || isGeneratedToc(cell)) continue;
    let fence = null;

    for (const line of splitLines(sourceAsText(cell.source))) {
      const fenceMatch = line.match(FENCE_RE);
      if (fenceMatch) {
        const marker = fenceMatch[1][0];
        if (fence === null) fence = marker;
        else if (marker === fence) fence = null;
        continue;
      }
      if (fence !== null) continue;

      const match = line.match(HEADING_RE);
      if (!match) continue;
      const rawTitle = stripCutiepynbMarkup(match[3]);
      if (!rawTitle) continue;
      headings.push({
        index: headings.length,
        level: match[2].length,
        title: plainTitle(rawTitle),
      });
    }
  }
  return headings;
}

function cleanGeneratedAnchors(text) {
  const cleaned = splitLines(text)
    .filter((line) => !CURRENT_ANCHOR_RE.test(line) && !LEGACY_ANCHOR_RE.test(line))
    .join("\n");
  return text.endsWith("\n") && cleaned ? `${cleaned}\n` : cleaned;
}

function normalizeColors(colors) {
  if (colors === undefined || colors === null) return [...DEFAULT_COLORS];
  if (!Array.isArray(colors)) throw new Error("colors must be an array");
  if (colors.some((color) => typeof color !== "string" || !color.trim())) {
    throw new Error("colors must contain non-empty strings");
  }
  if (colors.some((color) => !CSS_COLOR_RE.test(color.trim()))) {
    throw new Error("colors must be safe CSS color values");
  }
  return [...colors];
}

function normalizeHeadingEdits(headingEdits) {
  if (headingEdits === undefined || headingEdits === null) return new Map();
  if (!Array.isArray(headingEdits)) throw new Error("heading edits must be an array");

  const normalized = new Map();
  for (const rawEdit of headingEdits) {
    if (!isMapping(rawEdit)) throw new Error("each heading edit must be an object");
    const unknownKeys = Object.keys(rawEdit).filter(
      (key) => !["index", "title", "level"].includes(key),
    );
    if (unknownKeys.length) {
      throw new Error(`heading edit has unsupported fields: ${unknownKeys.sort().join(", ")}`);
    }

    const { index } = rawEdit;
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("heading edit indices must be non-negative integers");
    }
    if (normalized.has(index)) throw new Error(`duplicate heading edit index ${index}`);
    if (!("title" in rawEdit) && !("level" in rawEdit)) {
      throw new Error(`heading edit ${index} must change title, level, or both`);
    }

    const edit = {};
    if ("title" in rawEdit) {
      if (typeof rawEdit.title !== "string") {
        throw new Error(`heading edit ${index} title must be a string`);
      }
      const title = stripCutiepynbMarkup(rawEdit.title)
        .replace(/[ \t]+#+[ \t]*$/, "")
        .trim();
      if (!title || title.includes("\n") || title.includes("\r")) {
        throw new Error(`heading edit ${index} title must be a non-empty single line`);
      }
      edit.title = title;
    }
    if ("level" in rawEdit) {
      if (!Number.isInteger(rawEdit.level) || rawEdit.level < 1 || rawEdit.level > 6) {
        throw new Error(`heading edit ${index} level must be an integer from 1 to 6`);
      }
      edit.level = rawEdit.level;
    }
    normalized.set(index, edit);
  }
  return normalized;
}

function headingHtml(title, level, colors) {
  const color = colors[(level - 1) % colors.length];
  return `<span class="cutiepynb-heading" style="color: ${color}">${title}</span>`;
}

function decorateMarkdown(source, colors, seenAnchors, headingEdits, headingCounter) {
  const cleanedSource = cleanGeneratedAnchors(source);
  const hadTrailingNewline = cleanedSource.endsWith("\n");
  const output = [];
  const headings = [];
  let fence = null;

  for (const line of splitLines(cleanedSource)) {
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      output.push(line);
      continue;
    }

    const match = fence === null ? line.match(HEADING_RE) : null;
    if (!match) {
      output.push(line);
      continue;
    }

    let level = match[2].length;
    let title = stripCutiepynbMarkup(match[3]);
    if (!title) {
      output.push(line);
      continue;
    }

    const headingIndex = headingCounter.value;
    headingCounter.value += 1;
    const edit = headingEdits.get(headingIndex) ?? {};
    title = edit.title ?? title;
    level = edit.level ?? level;

    const anchor = uniqueAnchor(title, seenAnchors);
    headings.push({ title: plainTitle(title), level, anchor });
    output.push(`<a class="cutiepynb-anchor" id="${anchor}"></a>`);
    const formattedTitle = colors.length ? headingHtml(title, level, colors) : title;
    output.push(`${match[1]}${"#".repeat(level)} ${formattedTitle}`);
  }

  const transformed = output.join("\n");
  return {
    text: hadTrailingNewline && transformed ? `${transformed}\n` : transformed,
    headings,
  };
}

function generateNewCells(cells, colors, headingEdits) {
  const newCells = [];
  const headings = [];
  const seenAnchors = new Map();
  const headingCounter = { value: 0 };

  cells.forEach((originalCell, cellIndex) => {
    if (!isMapping(originalCell)) {
      throw new Error(`cell ${cellIndex + 1} must be a notebook cell object`);
    }
    if (isGeneratedToc(originalCell)) return;

    const cell = deepClone(originalCell);
    if (cell.cell_type !== "markdown") {
      newCells.push(cell);
      return;
    }

    const originalSource = cell.source ?? "";
    const decorated = decorateMarkdown(
      sourceAsText(originalSource),
      colors,
      seenAnchors,
      headingEdits,
      headingCounter,
    );
    cell.source = restoreSourceType(decorated.text, originalSource);
    newCells.push(cell);
    headings.push(...decorated.headings);
  });

  const unusedEdit = [...headingEdits.keys()].sort((a, b) => a - b)
    .find((index) => index >= headingCounter.value);
  if (unusedEdit !== undefined) throw new Error(`heading edit index ${unusedEdit} does not exist`);
  return { cells: newCells, headings };
}

function formatTocItem(heading) {
  const indentation = "  ".repeat(Math.max(heading.level - 1, 0));
  const label = String(heading.title).replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  return `${indentation}- [${label}](#${heading.anchor})\n`;
}

function uniqueTocCellId(cells) {
  const usedIds = new Set(
    cells
      .filter(isMapping)
      .map((cell) => cell.id)
      .filter((cellId) => typeof cellId === "string"),
  );
  let candidate = "cutiepynb-toc";
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `cutiepynb-toc-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function generateContents(headings, title, cellId) {
  const cell = {
    cell_type: "markdown",
    metadata: { cutiepynb: { role: "table-of-contents" } },
    source: [`${TOC_MARKER}\n`, `# ${title}\n`, "\n", ...headings.map(formatTocItem)],
  };
  if (cellId !== null) cell.id = cellId;
  return cell;
}

export function transformNotebook(document, options = {}) {
  if (!isMapping(document) || !Array.isArray(document.cells)) {
    throw new Error("document must be a notebook object with a 'cells' array");
  }

  const tocTitle = options.tocTitle ?? TOC_TITLE;
  if (
    typeof tocTitle !== "string" ||
    !tocTitle.trim() ||
    tocTitle.includes("\n") ||
    tocTitle.includes("\r")
  ) {
    throw new Error("toc_title must be a non-empty single line");
  }

  const colors = normalizeColors(options.colors);
  const headingEdits = normalizeHeadingEdits(options.headingEdits);
  const result = deepClone(document);
  const generated = generateNewCells(result.cells, colors, headingEdits);
  const addToc = options.addToc ?? true;

  if (addToc && generated.headings.length) {
    const supportsCellIds =
      result.nbformat === 4 &&
      Number.isInteger(result.nbformat_minor) &&
      result.nbformat_minor >= 5;
    const cellId = supportsCellIds ? uniqueTocCellId(generated.cells) : null;
    generated.cells.unshift(generateContents(generated.headings, tocTitle.trim(), cellId));
  }

  result.cells = generated.cells;
  return result;
}

export function serializeTransformedNotebook(document, options = {}) {
  return `${JSON.stringify(transformNotebook(document, options), null, 1)}\n`;
}
