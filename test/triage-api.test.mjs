import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.mjs";

const MANUAL_REVIEW = { status: "manual_review", topic: null, draft: null };
const INVALID_INPUT = { status: "invalid_input" };

let server;
let baseUrl;

before(async () => {
  server = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function postRaw(body, base = baseUrl) {
  const response = await fetch(`${base}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { status: response.status, body: await response.json() };
}

const post = (payload) => postRaw(JSON.stringify(payload));

test("invalid input returns 400 invalid_input", async (t) => {
  const cases = {
    "empty body": "",
    "broken JSON": "{text:",
    "JSON null": "null",
    "JSON array": "[]",
    "JSON string": '"hello"',
    "JSON number": "42",
    "missing text": "{}",
    "empty text": '{"text":""}',
    "whitespace-only text": '{"text":"   \\n\\t"}',
    "numeric text": '{"text":123}',
    "null text": '{"text":null}',
    "array text": '{"text":["доставка"]}',
  };
  for (const [name, body] of Object.entries(cases)) {
    await t.test(name, async () => {
      assert.deepEqual(await postRaw(body), { status: 400, body: INVALID_INPUT });
    });
  }
});

test("oversized body returns 400 invalid_input", async () => {
  const body = JSON.stringify({ text: "доставка ".repeat(10_000) });
  assert.deepEqual(await postRaw(body), { status: 400, body: INVALID_INPUT });
});

test("routes ignore the query string", async () => {
  const response = await fetch(`${baseUrl}/api/triage?source=test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Какая цена?" }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ready");
});

test("valid model answer returns ready with topic and draft only", async (t) => {
  const cases = {
    delivery: "Когда будет доставка заказа?",
    pricing: "Какая цена тарифа?",
    other: "Хочу поменять email в профиле",
  };
  for (const [topic, text] of Object.entries(cases)) {
    await t.test(topic, async () => {
      const { status, body } = await post({ text });
      assert.equal(status, 200);
      assert.deepEqual(Object.keys(body).sort(), ["draft", "status", "topic"]);
      assert.equal(body.status, "ready");
      assert.equal(body.topic, topic);
      assert.ok(body.draft.trim().length > 0);
    });
  }
});

test("model timeout falls back to manual_review within the 300 ms limit", async () => {
  const startedAt = performance.now();
  const result = await post({ text: "Где доставка? [timeout]" });
  const elapsed = performance.now() - startedAt;

  assert.deepEqual(result, { status: 200, body: MANUAL_REVIEW });
  // The mock sleeps 1200 ms; answering well before that proves we did not wait for it.
  assert.ok(elapsed < 900, `expected fallback before 900 ms, got ${Math.round(elapsed)} ms`);
});

test("model failures fall back to manual_review", async (t) => {
  for (const tag of ["[error]", "[bad-json]", "[bad-topic]", "[empty-draft]"]) {
    await t.test(tag, async () => {
      assert.deepEqual(await post({ text: `Вопрос по доставке ${tag}` }), {
        status: 200,
        body: MANUAL_REVIEW,
      });
    });
  }
});

test("model output that is not a usable object falls back to manual_review", async (t) => {
  const outputs = {
    "JSON null": "null",
    "JSON array": '["delivery"]',
    "JSON number": "1",
    "missing draft": '{"topic":"delivery"}',
    "non-string draft": '{"topic":"delivery","draft":42}',
    "non-string output": { topic: "delivery", draft: "ok" },
  };
  for (const [name, output] of Object.entries(outputs)) {
    await t.test(name, async () => {
      const app = createApp({ classify: async () => output });
      await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
      try {
        const result = await postRaw('{"text":"hi"}', `http://127.0.0.1:${app.address().port}`);
        assert.deepEqual(result, { status: 200, body: MANUAL_REVIEW });
      } finally {
        await new Promise((resolve) => app.close(resolve));
      }
    });
  }
});

test("model that never answers is aborted after the timeout", async () => {
  let receivedSignal;
  const app = createApp({
    timeoutMs: 50,
    classify: (_text, { signal }) => {
      receivedSignal = signal;
      return new Promise(() => {});
    },
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  try {
    const result = await postRaw('{"text":"hi"}', `http://127.0.0.1:${app.address().port}`);
    assert.deepEqual(result, { status: 200, body: MANUAL_REVIEW });
    assert.equal(receivedSignal.aborted, true);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
});

test("page and its view module are served", async () => {
  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);

  const script = await fetch(`${baseUrl}/triage-view.mjs`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /text\/javascript/);
});
