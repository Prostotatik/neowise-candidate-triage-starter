import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPending, renderResult, MESSAGES } from "../triage-view.mjs";

// Plain objects stand in for DOM elements: the view only touches textContent and hidden.
function fakeView() {
  const el = () => ({ textContent: "", hidden: true });
  return { result: el(), topic: el(), draft: el(), message: el() };
}

const READY = { status: "ready", topic: "delivery", draft: "Спасибо за обращение." };
const MANUAL_REVIEW = { status: "manual_review", topic: null, draft: null };

test("ready shows topic label and draft", () => {
  const view = fakeView();
  renderResult(view, READY);
  assert.equal(view.result.hidden, false);
  assert.equal(view.topic.textContent, "Доставка");
  assert.equal(view.draft.textContent, READY.draft);
  assert.equal(view.message.hidden, true);
});

test("manual_review after a ready answer clears the previous draft", () => {
  const view = fakeView();
  renderResult(view, READY);
  renderResult(view, MANUAL_REVIEW);

  assert.equal(view.result.hidden, true);
  assert.equal(view.topic.textContent, "");
  assert.equal(view.draft.textContent, "");
  assert.equal(view.message.hidden, false);
  assert.equal(view.message.textContent, MESSAGES.manual_review);
});

test("starting a new request clears the previous draft immediately", () => {
  const view = fakeView();
  renderResult(view, READY);
  renderPending(view);
  assert.equal(view.draft.textContent, "");
  assert.equal(view.result.hidden, true);
  assert.equal(view.message.textContent, MESSAGES.pending);
});

test("unexpected or missing payload is shown as manual review", () => {
  for (const payload of [null, undefined, {}, { status: "server_error" }, { status: "ready", topic: "refund", draft: "x" }]) {
    const view = fakeView();
    renderResult(view, READY);
    renderResult(view, payload);
    assert.equal(view.draft.textContent, "");
    assert.equal(view.message.textContent, MESSAGES.manual_review);
  }
});

test("invalid_input shows a hint and no draft", () => {
  const view = fakeView();
  renderResult(view, READY);
  renderResult(view, { status: "invalid_input" });
  assert.equal(view.draft.textContent, "");
  assert.equal(view.message.textContent, MESSAGES.invalid_input);
});
