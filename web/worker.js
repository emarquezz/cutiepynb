import { serializeTransformedNotebook } from "./transform.js";

function friendlyError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/toc_title/i.test(message)) {
    return "The table-of-contents title must be one non-empty line.";
  }
  if (/heading edit/i.test(message)) {
    return "One or more heading edits are invalid. Check each title and level.";
  }
  if (/colors/i.test(message)) return "One or more heading colors are invalid.";
  if (/cell \d+|cells.*array|document must/i.test(message)) return message;
  return "The notebook could not be formatted. Your original file is unchanged.";
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "initialize") {
    self.postMessage({ type: "status", status: "ready", engine: "javascript" });
    return;
  }
  if (message.type !== "transform") return;

  try {
    const output = serializeTransformedNotebook(message.notebook, {
      colors: message.colors,
      addToc: message.addToc,
      tocTitle: message.tocTitle,
      headingEdits: message.headingEdits ?? [],
    });
    self.postMessage({ type: "result", requestId: message.requestId, output });
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: message.requestId,
      message: friendlyError(error),
    });
  }
});
