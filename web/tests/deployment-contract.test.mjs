import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../../.github/workflows/docs.yml", import.meta.url);
const appUrl = new URL("../app.js", import.meta.url);
const indexUrl = new URL("../index.html", import.meta.url);
const workerUrl = new URL("../worker.js", import.meta.url);
const transformUrl = new URL("../transform.js", import.meta.url);
const stylesUrl = new URL("../../cutiepynb/styles.py", import.meta.url);

test("Pages workflow publishes every browser runtime asset", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  for (const asset of ["app.js", "favicon.svg", "index.html", "logo.png", "notebook.js", "og.png", "styles.css", "transform.js", "worker.js"]) {
    assert.match(workflow, new RegExp(asset.replace(".", "\\.")), `${asset} must be copied to Pages`);
  }
  assert.doesNotMatch(workflow, /site\/cutiepynb|cp cutiepynb\/\*\.py/);
});

test("browser Cutie palette matches the Python package defaults", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const defaults = [...styles.matchAll(/"(#[0-9a-f]{6})"/g)].slice(0, 6).map((match) => match[1].toUpperCase());
  const notebookModule = await import(new URL("../notebook.js", import.meta.url));
  assert.deepEqual(defaults, notebookModule.PALETTES.cutie);
});

test("worker uses the local JavaScript transformer with no runtime download", async () => {
  const worker = await readFile(workerUrl, "utf8");
  assert.match(worker, /from "\.\/transform\.js"/);
  assert.match(worker, /serializeTransformedNotebook/);
  for (const dependency of ["pyodide", "jsdelivr", "loadPyodide", "packageBase", "fetch(", "/cutiepynb"]) {
    assert.doesNotMatch(worker.toLowerCase(), new RegExp(dependency.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("preview code never injects notebook strings as HTML", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.doesNotMatch(app, /\.innerHTML\s*=/);
  assert.doesNotMatch(app, /document\.write\s*\(/);
  assert.doesNotMatch(app, /\beval\s*\(/);
  assert.match(app, /title\.textContent = displayHeadingTitle\(heading\)/);
  assert.match(app, /new Worker\(/);
});

test("heading editor is wired through the browser worker to JavaScript", async () => {
  const [app, worker, transform, page] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(workerUrl, "utf8"),
    readFile(transformUrl, "utf8"),
    readFile(indexUrl, "utf8"),
  ]);

  assert.match(page, /id="heading-editor-toggle"/);
  assert.match(page, /id="heading-editor-list"/);
  assert.match(page, /id="heading-search"/);
  assert.match(app, /headingEdits,/);
  assert.match(app, /currentHeadingEdits\(\),/);
  assert.match(worker, /headingEdits: message\.headingEdits \?\? \[\]/);
  assert.match(transform, /normalizeHeadingEdits/);
});

test("page explains the name and keeps its sparkle accessible", async () => {
  const [page, styles] = await Promise.all([
    readFile(indexUrl, "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /cutie plus Python notebook/);
  assert.match(page, /class="brand-logo" src="\.\/logo\.png"/);
  assert.match(page, /into a <em>cutiepie\.<\/em>/);
  assert.doesNotMatch(page, /class="brand-mark"/);
  assert.match(page, /class="hero-sparkles" aria-hidden="true"/);
  assert.match(page, /native browser JavaScript/);
  assert.doesNotMatch(page, /jsdelivr|pyodide/i);
  assert.match(styles, /@keyframes cutie-twinkle/);
  assert.match(styles, /prefers-reduced-motion/);
});
