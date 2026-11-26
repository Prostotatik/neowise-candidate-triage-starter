import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { classify as mockClassify } from "./mock-ai.mjs";

export const MODEL_TIMEOUT_MS = 300;
export const TOPICS = new Set(["delivery", "pricing", "other"]);
export const MAX_BODY_BYTES = 64 * 1024;

const INVALID_INPUT = { status: "invalid_input" };
const MANUAL_REVIEW = { status: "manual_review", topic: null, draft: null };

const STATIC_FILES = {
  "/": { file: "./index.html", type: "text/html; charset=utf-8" },
  "/triage-view.mjs": { file: "./triage-view.mjs", type: "text/javascript; charset=utf-8" },
};
const staticContent = Object.fromEntries(
  Object.entries(STATIC_FILES).map(([path, { file, type }]) => [
    path,
    { type, body: readFileSync(new URL(file, import.meta.url)) },
  ]),
);

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isNonBlankString = (value) => typeof value === "string" && value.trim().length > 0;

/** Returns the request text, or null when the body is not `{ "text": "<non-blank string>" }`. */
export function parseTriageRequest(rawBody) {
  if (typeof rawBody !== "string") return null;
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isPlainObject(payload) || !isNonBlankString(payload.text)) return null;
  return payload.text;
}

/** Returns `{ topic, draft }` from raw model output, or null when the output is unusable. */
export function parseModelOutput(rawOutput) {
  if (typeof rawOutput !== "string") return null;
  let output;
  try {
    output = JSON.parse(rawOutput);
  } catch {
    return null;
  }
  if (!isPlainObject(output)) return null;
  if (!TOPICS.has(output.topic) || !isNonBlankString(output.draft)) return null;
  return { topic: output.topic, draft: output.draft };
}

/** Calls the model with a hard time limit; rejects on timeout and aborts the pending call. */
async function callModel(classify, text, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Model did not answer within ${timeoutMs} ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([classify(text, { signal: controller.signal }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the body as UTF-8; returns null (without buffering the rest) when it exceeds the limit. */
async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size <= MAX_BODY_BYTES) chunks.push(chunk);
  }
  return size > MAX_BODY_BYTES ? null : Buffer.concat(chunks).toString("utf8");
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function handleTriage(request, response, { classify, timeoutMs }) {
  const text = parseTriageRequest(await readBody(request));
  if (text === null) return sendJson(response, 400, INVALID_INPUT);

  let result = null;
  try {
    result = parseModelOutput(await callModel(classify, text, timeoutMs));
  } catch {
    // Model error or timeout: the manager handles the request manually.
  }
  if (result === null) return sendJson(response, 200, MANUAL_REVIEW);
  return sendJson(response, 200, { status: "ready", topic: result.topic, draft: result.draft });
}

export function createApp({ classify = mockClassify, timeoutMs = MODEL_TIMEOUT_MS } = {}) {
  return createServer(async (request, response) => {
    const { pathname } = new URL(request.url, "http://localhost");
    const asset = request.method === "GET" ? staticContent[pathname] : undefined;
    if (asset) {
      response.writeHead(200, { "Content-Type": asset.type });
      response.end(asset.body);
      return;
    }
    if (request.method !== "POST" || pathname !== "/api/triage") {
      return sendJson(response, 404, { status: "not_found" });
    }
    try {
      await handleTriage(request, response, { classify, timeoutMs });
    } catch {
      if (!response.headersSent) sendJson(response, 500, { status: "server_error" });
    }
  });
}
