import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { transformNotebook } from "../transform.js";

const fixtureUrl = new URL("../../tests/fixtures/transform_cases.json", import.meta.url);
const helperUrl = new URL("../../tests/python_transform_cases.py", import.meta.url);
const repositoryUrl = new URL("../..", import.meta.url);

test("native JavaScript output matches Python across shared notebook fixtures", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const javascriptOutputs = fixture.cases.map((fixtureCase) =>
    fixtureCase.operations.reduce(
      (document, operation) => transformNotebook(document, operation),
      fixtureCase.notebook,
    ),
  );

  const python = spawnSync(
    process.env.PYTHON || "python3",
    [fileURLToPath(helperUrl), fileURLToPath(fixtureUrl)],
    {
      cwd: fileURLToPath(repositoryUrl),
      encoding: "utf8",
    },
  );
  assert.equal(python.status, 0, python.stderr || "Python fixture runner failed");
  const pythonOutputs = JSON.parse(python.stdout);

  fixture.cases.forEach((fixtureCase, index) => {
    assert.deepEqual(
      javascriptOutputs[index],
      pythonOutputs[index],
      `JavaScript drifted from Python for: ${fixtureCase.name}`,
    );
  });
});
