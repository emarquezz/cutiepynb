import {
  DEMO_NOTEBOOK,
  LARGE_FILE_THRESHOLD,
  MAX_FILE_SIZE,
  PALETTES,
  PREVIEW_HEADING_LIMIT,
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
} from "./notebook.js";

const HEADING_EDITOR_PAGE_SIZE = 50;

const state = {
  notebook: null,
  originalHeadings: [],
  headings: [],
  fileName: "notebook.ipynb",
  fileSize: 0,
  colors: [...PALETTES.cutie],
  processing: false,
  preparedUrl: null,
  styledNotebook: false,
  headingEditorLimit: HEADING_EDITOR_PAGE_SIZE,
  headingEditorQuery: "",
};

const formatter = {
  worker: null,
  readyPromise: null,
  readyResolve: null,
  readyReject: null,
  requestId: 0,
  pending: new Map(),
};

const elements = {
  dropZone: document.querySelector("#drop-zone"),
  fileInput: document.querySelector("#file-input"),
  fileSummary: document.querySelector("#file-summary"),
  fileName: document.querySelector("#file-name"),
  fileMeta: document.querySelector("#file-meta"),
  styledNote: document.querySelector("#styled-note"),
  fileError: document.querySelector("#file-error"),
  fileStatus: document.querySelector("#file-status"),
  replaceFile: document.querySelector("#replace-file"),
  removeFile: document.querySelector("#remove-file"),
  demoButton: document.querySelector("#demo-button"),
  colorGrid: document.querySelector("#color-grid"),
  contrastSummary: document.querySelector("#contrast-summary"),
  resetPalette: document.querySelector("#reset-palette"),
  presets: [...document.querySelectorAll(".preset")],
  tocToggle: document.querySelector("#toc-toggle"),
  tocTitle: document.querySelector("#toc-title"),
  headingEditorToggle: document.querySelector("#heading-editor-toggle"),
  headingEditorToggleLabel: document.querySelector("#heading-editor-toggle-label"),
  headingEditorBody: document.querySelector("#heading-editor-body"),
  headingSearchWrap: document.querySelector("#heading-search-wrap"),
  headingSearch: document.querySelector("#heading-search"),
  headingEditCount: document.querySelector("#heading-edit-count"),
  headingResetAll: document.querySelector("#heading-reset-all"),
  headingEditorList: document.querySelector("#heading-editor-list"),
  headingEditorEmpty: document.querySelector("#heading-editor-empty"),
  headingEditorError: document.querySelector("#heading-editor-error"),
  headingShowMore: document.querySelector("#heading-show-more"),
  emptyPreview: document.querySelector("#empty-preview"),
  previewContent: document.querySelector("#preview-content"),
  previewStats: document.querySelector("#preview-stats"),
  previewLimit: document.querySelector("#preview-limit"),
  cellCount: document.querySelector("#cell-count"),
  headingCount: document.querySelector("#heading-count"),
  levelCount: document.querySelector("#level-count"),
  notebookTab: document.querySelector("#notebook-tab"),
  runtimeStatus: document.querySelector("#runtime-status"),
  runtimeLabel: document.querySelector("#runtime-label"),
  downloadButton: document.querySelector("#download-button"),
  downloadLabel: document.querySelector("#download-label"),
  downloadHint: document.querySelector("#download-hint"),
  generationError: document.querySelector("#generation-error"),
  generationErrorText: document.querySelector("#generation-error-text"),
  retryButton: document.querySelector("#retry-button"),
  preparedLink: document.querySelector("#prepared-link"),
  toast: document.querySelector("#toast"),
};

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 4200);
}

function setRuntimeStatus(label, mode = "idle") {
  elements.runtimeLabel.textContent = label;
  elements.runtimeStatus.dataset.mode = mode;
}

function showFileError(message = "") {
  elements.fileError.textContent = message;
  elements.fileError.hidden = !message;
}

function showGenerationError(message = "") {
  elements.generationErrorText.textContent = message;
  elements.generationError.hidden = !message;
}

function invalidatePreparedDownload() {
  if (state.preparedUrl) URL.revokeObjectURL(state.preparedUrl);
  state.preparedUrl = null;
  elements.preparedLink.hidden = true;
  elements.preparedLink.removeAttribute("href");
  elements.preparedLink.removeAttribute("download");
}

function resetFormatter(error = new Error("The formatter was restarted.")) {
  formatter.worker?.terminate();
  formatter.worker = null;
  formatter.readyReject?.(error);
  formatter.readyPromise = null;
  formatter.readyResolve = null;
  formatter.readyReject = null;
  for (const pending of formatter.pending.values()) pending.reject(error);
  formatter.pending.clear();
}

function failFormatter(message) {
  const error = new Error(message);
  resetFormatter(error);
  setRuntimeStatus("Formatter unavailable", "error");
  return error;
}

function handleFormatterMessage(event) {
  const message = event.data;
  if (message.type === "status") {
    if (message.status === "loading") setRuntimeStatus("Starting local formatter…", "loading");
    if (message.status === "ready") {
      setRuntimeStatus("Instant local formatter", "ready");
      formatter.readyResolve?.();
      formatter.readyResolve = null;
      formatter.readyReject = null;
    }
    if (message.status === "error") failFormatter(message.message);
    return;
  }

  const pending = formatter.pending.get(message.requestId);
  if (!pending) return;
  formatter.pending.delete(message.requestId);
  if (message.type === "result") pending.resolve(message.output);
  if (message.type === "error") pending.reject(new Error(message.message));
}

function ensureFormatter() {
  if (formatter.readyPromise) return formatter.readyPromise;
  if (!("Worker" in window)) {
    return Promise.reject(new Error("This browser does not support the local formatter."));
  }

  setRuntimeStatus("Starting local formatter…", "loading");
  formatter.readyPromise = new Promise((resolve, reject) => {
    formatter.readyResolve = resolve;
    formatter.readyReject = reject;
  });
  formatter.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  formatter.worker.addEventListener("message", handleFormatterMessage);
  formatter.worker.addEventListener("error", (event) => {
    event.preventDefault();
    failFormatter("The browser formatter could not start. Retry or reload the page.");
  });
  formatter.worker.postMessage({ type: "initialize" });
  return formatter.readyPromise;
}

async function transformWithFormatter(notebook, colors, addToc, tocTitle, headingEdits) {
  await ensureFormatter();
  const requestId = ++formatter.requestId;
  return new Promise((resolve, reject) => {
    formatter.pending.set(requestId, { resolve, reject });
    try {
      formatter.worker.postMessage({
        type: "transform",
        requestId,
        notebook,
        colors,
        addToc,
        tocTitle,
        headingEdits,
      });
    } catch (error) {
      formatter.pending.delete(requestId);
      reject(error);
    }
  });
}

function warmFormatter() {
  ensureFormatter().catch(() => {
    // The persistent status and export error provide the recovery path.
  });
}

function setActivePreset(name) {
  elements.presets.forEach((button) => {
    const active = button.dataset.preset === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function refreshContrastBadge(color, badge) {
  const ratio = contrastRatio(color);
  const passes = ratio !== null && ratio >= 4.5;
  badge.textContent = passes ? "AA" : "Low";
  badge.classList.toggle("warning", !passes);
  badge.dataset.passes = String(passes);
  badge.title = passes
    ? `Contrast ratio ${ratio.toFixed(1)}:1 on white`
    : `Low contrast: ${ratio?.toFixed(1) ?? "?"}:1 on white`;
}

function updateContrastSummary() {
  const lowContrastCount = state.colors.filter((color) => (contrastRatio(color) ?? 0) < 4.5).length;
  elements.contrastSummary.textContent = lowContrastCount
    ? `${lowContrastCount} ${lowContrastCount === 1 ? "color has" : "colors have"} low contrast on white.`
    : "All six colors meet AA contrast on white.";
  elements.contrastSummary.classList.toggle("warning", lowContrastCount > 0);
}

function updateColor(index, color, controls) {
  state.colors[index] = color.toUpperCase();
  controls.picker.value = state.colors[index];
  controls.value.value = state.colors[index];
  controls.value.setAttribute("aria-invalid", "false");
  refreshContrastBadge(state.colors[index], controls.badge);
  setActivePreset(null);
  updateContrastSummary();
  invalidatePreparedDownload();
  renderPreview();
}

function renderColorControls() {
  elements.colorGrid.replaceChildren();
  state.colors.forEach((color, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "color-control";
    wrapper.setAttribute("role", "group");
    wrapper.setAttribute("aria-label", `Heading level ${index + 1}`);

    const code = document.createElement("span");
    code.className = "heading-code";
    code.textContent = `H${index + 1}`;

    const picker = document.createElement("input");
    picker.className = "color-swatch";
    picker.type = "color";
    picker.value = color;
    picker.setAttribute("aria-label", `Choose heading level ${index + 1} color`);

    const value = document.createElement("input");
    value.className = "color-value";
    value.value = color;
    value.maxLength = 7;
    value.spellcheck = false;
    value.autocomplete = "off";
    value.inputMode = "text";
    value.setAttribute("aria-label", `Heading level ${index + 1} hex color`);
    value.setAttribute("aria-invalid", "false");

    const badge = document.createElement("span");
    badge.className = "contrast-badge";
    refreshContrastBadge(color, badge);

    const controls = { picker, value, badge };
    picker.addEventListener("input", () => updateColor(index, picker.value, controls));
    value.addEventListener("input", () => {
      const candidate = value.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(candidate)) updateColor(index, candidate, controls);
      else value.setAttribute("aria-invalid", "true");
    });
    value.addEventListener("blur", () => {
      if (value.getAttribute("aria-invalid") === "true") {
        value.value = state.colors[index];
        value.setAttribute("aria-invalid", "false");
        showToast("Use a six-digit hex color, for example #6D28D9.");
      }
    });

    wrapper.append(code, picker, value, badge);
    elements.colorGrid.append(wrapper);
  });
  updateContrastSummary();
}

function applyPalette(name) {
  state.colors = [...PALETTES[name]];
  setActivePreset(name);
  renderColorControls();
  invalidatePreparedDownload();
  renderPreview();
}

function matchingPaletteName(colors) {
  return Object.entries(PALETTES).find(([, palette]) =>
    palette.every((color, index) => color.toUpperCase() === colors[index]?.toUpperCase()),
  )?.[0] ?? null;
}

function currentHeadingEdits() {
  return buildHeadingEdits(state.originalHeadings, state.headings);
}

function hasInvalidHeadingTitle() {
  return state.headings.some((heading) => !heading.title.trim());
}

function displayHeadingTitle(heading) {
  return previewHeadingTitle(heading.title.trim() || "Untitled heading");
}

function syncHeadingEditorToggleLabel() {
  const expanded = elements.headingEditorToggle.getAttribute("aria-expanded") === "true";
  const editedCount = state.notebook ? currentHeadingEdits().length : 0;

  if (!state.notebook) {
    elements.headingEditorToggleLabel.textContent = "Upload first";
  } else if (!state.headings.length) {
    elements.headingEditorToggleLabel.textContent = "No headings";
  } else if (expanded) {
    elements.headingEditorToggleLabel.textContent = "Hide editor";
  } else if (editedCount) {
    elements.headingEditorToggleLabel.textContent = `Edit outline · ${editedCount} changed`;
  } else {
    elements.headingEditorToggleLabel.textContent = `Edit ${state.headings.length} headings`;
  }
}

function updateHeadingEditorStatus() {
  const editedCount = state.notebook ? currentHeadingEdits().length : 0;
  const invalid = hasInvalidHeadingTitle();
  elements.headingEditorToggle.disabled = !state.notebook || !state.headings.length || state.processing;
  elements.headingEditCount.textContent = editedCount
    ? `${editedCount} ${editedCount === 1 ? "heading" : "headings"} edited`
    : "No heading edits yet";
  elements.headingResetAll.disabled = editedCount === 0 || state.processing;
  elements.headingEditorError.hidden = !invalid;
  elements.headingEditorError.textContent = invalid
    ? "Give every heading a title before downloading."
    : "";
  syncHeadingEditorToggleLabel();
  updateDownloadState();
}

function updateHeadingEditorRow(row, heading, original, controls) {
  const changed = heading.title.trim() !== original.title || heading.level !== original.level;
  const invalid = !heading.title.trim();
  row.classList.toggle("edited", changed);
  row.classList.toggle("invalid", invalid);
  controls.title.setAttribute("aria-invalid", String(invalid));
  controls.reset.hidden = !changed;
  controls.reset.setAttribute(
    "aria-label",
    `Reset heading ${heading.index + 1}, ${displayHeadingTitle(heading)}`,
  );
}

function renderHeadingEditorRows() {
  elements.headingEditorList.replaceChildren();
  const query = state.headingEditorQuery.toLocaleLowerCase();
  const filtered = state.headings.filter((heading) =>
    heading.title.toLocaleLowerCase().includes(query),
  );
  const visible = filtered.slice(0, state.headingEditorLimit);

  elements.headingEditorEmpty.hidden = visible.length > 0;
  if (!state.headings.length) {
    elements.headingEditorEmpty.textContent = "No Markdown headings found in this notebook.";
  } else if (!visible.length) {
    elements.headingEditorEmpty.textContent = "No headings match that search.";
  }

  for (const heading of visible) {
    const original = state.originalHeadings[heading.index];
    const row = document.createElement("li");
    row.className = "heading-editor-row";

    const number = document.createElement("span");
    number.className = "heading-order";
    number.textContent = String(heading.index + 1).padStart(2, "0");
    number.setAttribute("aria-hidden", "true");

    const level = document.createElement("select");
    level.className = "heading-level-select";
    level.setAttribute("aria-label", `Heading ${heading.index + 1} level`);
    for (let value = 1; value <= 6; value += 1) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = `H${value}`;
      option.selected = value === heading.level;
      level.append(option);
    }

    const title = document.createElement("input");
    title.className = "heading-title-input";
    title.type = "text";
    title.value = heading.title;
    title.spellcheck = true;
    title.autocomplete = "off";
    title.setAttribute("aria-label", `Heading ${heading.index + 1} title`);

    const reset = document.createElement("button");
    reset.className = "heading-reset";
    reset.type = "button";
    reset.textContent = "↺";

    const controls = { level, title, reset };
    updateHeadingEditorRow(row, heading, original, controls);

    title.addEventListener("input", () => {
      heading.title = title.value;
      updateHeadingEditorRow(row, heading, original, controls);
      invalidatePreparedDownload();
      renderPreview();
      updateHeadingEditorStatus();
    });
    title.addEventListener("blur", () => {
      if (!title.value.trim()) return;
      title.value = title.value.trim();
      heading.title = title.value;
      updateHeadingEditorRow(row, heading, original, controls);
      renderPreview();
      updateHeadingEditorStatus();
    });
    level.addEventListener("change", () => {
      heading.level = Number.parseInt(level.value, 10);
      updateHeadingEditorRow(row, heading, original, controls);
      invalidatePreparedDownload();
      renderPreview();
      updateHeadingEditorStatus();
    });
    reset.addEventListener("click", () => {
      heading.title = original.title;
      heading.level = original.level;
      title.value = heading.title;
      level.value = String(heading.level);
      updateHeadingEditorRow(row, heading, original, controls);
      invalidatePreparedDownload();
      renderPreview();
      updateHeadingEditorStatus();
      title.focus();
    });

    row.append(number, level, title, reset);
    elements.headingEditorList.append(row);
  }

  const remaining = filtered.length - visible.length;
  elements.headingShowMore.hidden = remaining <= 0;
  elements.headingShowMore.textContent = remaining > 0
    ? `Show ${Math.min(HEADING_EDITOR_PAGE_SIZE, remaining)} more`
    : "";
  elements.headingSearchWrap.hidden = state.headings.length <= 12;
}

function resetHeadingEditorState() {
  state.headingEditorLimit = HEADING_EDITOR_PAGE_SIZE;
  state.headingEditorQuery = "";
  elements.headingSearch.value = "";
  elements.headingEditorBody.hidden = true;
  elements.headingEditorToggle.setAttribute("aria-expanded", "false");
}

function renderHeadingEditor() {
  renderHeadingEditorRows();
  updateHeadingEditorStatus();
}

function createTocList(headings) {
  const root = document.createElement("ol");
  root.className = "toc-list";
  const stack = [root];

  for (const heading of headings) {
    while (stack.length > heading.level) stack.pop();
    while (stack.length < heading.level) {
      const parentItem = stack.at(-1).lastElementChild;
      if (!parentItem) break;
      const nested = document.createElement("ol");
      parentItem.append(nested);
      stack.push(nested);
    }
    const item = document.createElement("li");
    item.textContent = displayHeadingTitle(heading);
    stack.at(-1).append(item);
  }
  return root;
}

function updateDownloadState() {
  const outputName = outputFileName(state.fileName);
  if (!state.notebook) {
    elements.downloadButton.disabled = true;
    elements.downloadHint.textContent = "Choose a notebook to enable the download.";
  } else if (!state.headings.length) {
    elements.downloadButton.disabled = true;
    elements.downloadHint.textContent = "This notebook has no Markdown headings to style.";
  } else if (hasInvalidHeadingTitle()) {
    elements.downloadButton.disabled = true;
    elements.downloadHint.textContent = "Give every heading a title to enable the download.";
  } else if (state.processing) {
    elements.downloadButton.disabled = true;
    elements.downloadHint.textContent = "Formatting happens locally; larger notebooks may take a moment.";
  } else {
    elements.downloadButton.disabled = false;
    elements.downloadHint.textContent = `Creates ${outputName} · your original remains unchanged.`;
  }
}

function setControlsProcessing(processing) {
  elements.fileInput.disabled = processing;
  elements.replaceFile.disabled = processing;
  elements.removeFile.disabled = processing;
  elements.demoButton.disabled = processing;
  elements.resetPalette.disabled = processing;
  elements.presets.forEach((button) => {
    button.disabled = processing;
  });
  elements.colorGrid.querySelectorAll("input").forEach((input) => {
    input.disabled = processing;
  });
  elements.tocToggle.disabled = processing;
  elements.tocTitle.disabled = processing || !elements.tocToggle.checked;
  elements.headingEditorBody.inert = processing;
}

function renderPreview() {
  if (!state.notebook) {
    elements.emptyPreview.hidden = false;
    elements.previewContent.hidden = true;
    elements.previewStats.hidden = true;
    elements.previewLimit.hidden = true;
    updateDownloadState();
    return;
  }

  const previewHeadings = state.headings.slice(0, PREVIEW_HEADING_LIMIT);
  elements.previewContent.replaceChildren();

  if (elements.tocToggle.checked && previewHeadings.length) {
    const toc = document.createElement("section");
    toc.className = "toc-preview";
    const title = document.createElement("h3");
    title.textContent = elements.tocTitle.value.trim() || "Table of Contents";
    toc.append(title, createTocList(previewHeadings));
    elements.previewContent.append(toc);
  }

  if (previewHeadings.length) {
    previewHeadings.forEach((heading, index) => {
      const element = document.createElement("div");
      element.className = `heading-preview level-${heading.level}`;
      element.style.color = state.colors[(heading.level - 1) % state.colors.length];
      element.setAttribute("role", "heading");
      element.setAttribute("aria-level", String(heading.level));
      const levelBadge = document.createElement("span");
      levelBadge.className = "preview-level-badge";
      levelBadge.textContent = `H${heading.level}`;
      levelBadge.setAttribute("aria-hidden", "true");
      const title = document.createElement("span");
      title.textContent = displayHeadingTitle(heading);
      element.append(levelBadge, title);
      elements.previewContent.append(element);
      if (index < 8) {
        const rule = document.createElement("div");
        rule.className = `preview-rule${index % 2 ? " short" : ""}`;
        rule.setAttribute("aria-hidden", "true");
        elements.previewContent.append(rule);
      }
    });
  } else {
    const message = document.createElement("div");
    message.className = "empty-preview warning-preview";
    const glyph = document.createElement("div");
    glyph.className = "empty-glyph";
    glyph.setAttribute("aria-hidden", "true");
    glyph.textContent = "?";
    const title = document.createElement("strong");
    title.textContent = "No Markdown headings found";
    const detail = document.createElement("span");
    detail.textContent = "Add headings such as # Results or ## Methods, then try again.";
    message.append(glyph, title, detail);
    elements.previewContent.append(message);
  }

  elements.emptyPreview.hidden = true;
  elements.previewContent.hidden = false;
  elements.previewStats.hidden = false;
  elements.cellCount.textContent = String(state.notebook.cells.length);
  elements.headingCount.textContent = String(state.headings.length);
  elements.levelCount.textContent = String(new Set(state.headings.map((heading) => heading.level)).size);
  const hiddenHeadingCount = state.headings.length - previewHeadings.length;
  elements.previewLimit.hidden = hiddenHeadingCount <= 0;
  elements.previewLimit.textContent = hiddenHeadingCount > 0
    ? `Showing the first ${PREVIEW_HEADING_LIMIT} headings · ${hiddenHeadingCount} more will still be styled.`
    : "";
  updateDownloadState();
}

function setNotebook(notebook, name, size) {
  invalidatePreparedDownload();
  state.notebook = notebook;
  state.originalHeadings = extractHeadings(notebook);
  state.headings = state.originalHeadings.map((heading) => ({ ...heading }));
  state.fileName = name;
  state.fileSize = size;
  state.styledNotebook = isCutiepynbNotebook(notebook);

  if (state.styledNotebook) {
    state.colors = extractStyledPalette(notebook, PALETTES.cutie) ?? [...PALETTES.cutie];
    const tocSettings = extractTocSettings(notebook);
    elements.tocToggle.checked = tocSettings.addToc;
    elements.tocTitle.value = tocSettings.title;
  } else {
    state.colors = [...PALETTES.cutie];
    elements.tocToggle.checked = true;
    elements.tocTitle.value = "Table of Contents";
  }
  elements.tocTitle.disabled = !elements.tocToggle.checked;
  elements.tocTitle.setAttribute("aria-invalid", "false");
  setActivePreset(matchingPaletteName(state.colors));
  renderColorControls();
  resetHeadingEditorState();

  elements.dropZone.hidden = true;
  elements.fileSummary.hidden = false;
  elements.fileName.textContent = name;
  const largeFileNote = size >= LARGE_FILE_THRESHOLD ? " · large notebook" : "";
  elements.fileMeta.textContent = `${formatBytes(size)} · ${notebook.cells.length} cells · ${state.headings.length} headings${largeFileNote}`;
  elements.styledNote.hidden = !state.styledNotebook;
  elements.notebookTab.textContent = name;
  elements.fileStatus.textContent = state.styledNotebook
    ? `${name} loaded with ${state.headings.length} headings. Existing cutiepynb styles are ready to recolor.`
    : `${name} loaded with ${state.headings.length} headings.`;
  showFileError();
  showGenerationError();
  renderHeadingEditor();
  renderPreview();
  elements.fileSummary.focus();
  warmFormatter();
}

function clearNotebook() {
  invalidatePreparedDownload();
  state.notebook = null;
  state.originalHeadings = [];
  state.headings = [];
  state.fileName = "notebook.ipynb";
  state.fileSize = 0;
  state.styledNotebook = false;
  resetHeadingEditorState();
  elements.fileInput.value = "";
  elements.dropZone.hidden = false;
  elements.fileSummary.hidden = true;
  elements.styledNote.hidden = true;
  elements.notebookTab.textContent = "notebook.ipynb";
  elements.fileStatus.textContent = "Notebook removed.";
  showFileError();
  showGenerationError();
  renderHeadingEditor();
  renderPreview();
  elements.dropZone.focus();
}

async function loadFile(file) {
  if (!file) return;
  showFileError();
  if (file.size > MAX_FILE_SIZE) {
    showFileError("This notebook is larger than 25 MB. Please choose a smaller file.");
    elements.fileInput.value = "";
    return;
  }
  if (!file.name.toLowerCase().endsWith(".ipynb")) {
    showFileError("Please choose a Jupyter notebook ending in .ipynb.");
    elements.fileInput.value = "";
    return;
  }

  elements.fileStatus.textContent = `Reading ${file.name}…`;
  elements.dropZone.setAttribute("aria-busy", "true");
  try {
    const notebook = parseNotebookText(await file.text());
    setNotebook(notebook, file.name, file.size);
  } catch (error) {
    showFileError(error instanceof Error ? error.message : "The notebook could not be read.");
    elements.fileInput.value = "";
  } finally {
    elements.dropZone.setAttribute("aria-busy", "false");
  }
}

async function createStyledNotebook() {
  if (!state.notebook || !state.headings.length || state.processing) return;
  if (hasInvalidHeadingTitle()) {
    const invalidIndex = state.headings.findIndex((heading) => !heading.title.trim());
    state.headingEditorQuery = "";
    state.headingEditorLimit = Math.max(HEADING_EDITOR_PAGE_SIZE, invalidIndex + 1);
    elements.headingSearch.value = "";
    elements.headingEditorBody.hidden = false;
    elements.headingEditorToggle.setAttribute("aria-expanded", "true");
    renderHeadingEditorRows();
    updateHeadingEditorStatus();
    elements.headingEditorList.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  const tocTitle = elements.tocTitle.value.trim();
  if (elements.tocToggle.checked && !tocTitle) {
    elements.tocTitle.setAttribute("aria-invalid", "true");
    showGenerationError("Give the table of contents a title first.");
    elements.tocTitle.focus();
    return;
  }

  elements.tocTitle.setAttribute("aria-invalid", "false");
  showGenerationError();
  invalidatePreparedDownload();
  state.processing = true;
  setControlsProcessing(true);
  elements.downloadButton.classList.add("processing");
  elements.downloadButton.setAttribute("aria-busy", "true");
  elements.downloadLabel.textContent = "Preparing notebook…";
  updateDownloadState();
  updateHeadingEditorStatus();

  try {
    const output = await transformWithFormatter(
      state.notebook,
      state.colors,
      elements.tocToggle.checked,
      tocTitle || "Table of Contents",
      currentHeadingEdits(),
    );
    if (typeof output !== "string") throw new Error("The formatter returned an unexpected result.");

    const outputName = outputFileName(state.fileName);
    const blob = new Blob([output], { type: "application/x-ipynb+json" });
    state.preparedUrl = URL.createObjectURL(blob);
    elements.preparedLink.href = state.preparedUrl;
    elements.preparedLink.download = outputName;
    elements.preparedLink.textContent = `Download ${outputName}`;
    elements.preparedLink.hidden = false;
    elements.preparedLink.click();
    showToast(`${outputName} is ready. Use the link below if the download did not start.`);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "The notebook could not be formatted. Your original file is unchanged.";
    showGenerationError(message);
  } finally {
    state.processing = false;
    setControlsProcessing(false);
    elements.downloadButton.classList.remove("processing");
    elements.downloadButton.setAttribute("aria-busy", "false");
    elements.downloadLabel.textContent = "Prepare & download notebook";
    updateHeadingEditorStatus();
    updateDownloadState();
  }
}

elements.dropZone.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files?.[0]));
elements.replaceFile.addEventListener("click", () => elements.fileInput.click());
elements.removeFile.addEventListener("click", clearNotebook);
elements.demoButton.addEventListener("click", () => {
  const notebook = structuredClone(DEMO_NOTEBOOK);
  const text = JSON.stringify(notebook);
  setNotebook(notebook, "cutiepynb_demo.ipynb", new Blob([text]).size);
});
elements.resetPalette.addEventListener("click", () => applyPalette("cutie"));
elements.presets.forEach((button) => {
  button.addEventListener("click", () => applyPalette(button.dataset.preset));
});
elements.tocToggle.addEventListener("change", () => {
  elements.tocTitle.disabled = !elements.tocToggle.checked;
  elements.tocTitle.setAttribute("aria-invalid", "false");
  showGenerationError();
  invalidatePreparedDownload();
  renderPreview();
});
elements.tocTitle.addEventListener("input", () => {
  elements.tocTitle.setAttribute("aria-invalid", "false");
  showGenerationError();
  invalidatePreparedDownload();
  renderPreview();
});
elements.headingEditorToggle.addEventListener("click", () => {
  const expanded = elements.headingEditorToggle.getAttribute("aria-expanded") === "true";
  elements.headingEditorToggle.setAttribute("aria-expanded", String(!expanded));
  elements.headingEditorBody.hidden = expanded;
  syncHeadingEditorToggleLabel();
});
elements.headingSearch.addEventListener("input", () => {
  state.headingEditorQuery = elements.headingSearch.value.trim();
  state.headingEditorLimit = HEADING_EDITOR_PAGE_SIZE;
  renderHeadingEditorRows();
});
elements.headingShowMore.addEventListener("click", () => {
  state.headingEditorLimit += HEADING_EDITOR_PAGE_SIZE;
  renderHeadingEditorRows();
});
elements.headingResetAll.addEventListener("click", () => {
  state.headings = state.originalHeadings.map((heading) => ({ ...heading }));
  invalidatePreparedDownload();
  renderHeadingEditorRows();
  renderPreview();
  updateHeadingEditorStatus();
  showToast("Heading edits reset.");
});
elements.downloadButton.addEventListener("click", createStyledNotebook);
elements.retryButton.addEventListener("click", () => {
  resetFormatter();
  showGenerationError();
  createStyledNotebook();
});

let dragDepth = 0;
elements.dropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragDepth += 1;
  elements.dropZone.classList.add("dragging");
});
elements.dropZone.addEventListener("dragover", (event) => event.preventDefault());
elements.dropZone.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) elements.dropZone.classList.remove("dragging");
});
elements.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  elements.dropZone.classList.remove("dragging");
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  if (files.length > 1) {
    showFileError("Please drop one notebook at a time.");
    return;
  }
  loadFile(files[0]);
});

window.addEventListener("beforeunload", () => {
  if (state.preparedUrl) URL.revokeObjectURL(state.preparedUrl);
  formatter.worker?.terminate();
});

setActivePreset("cutie");
renderColorControls();
renderHeadingEditor();
renderPreview();
