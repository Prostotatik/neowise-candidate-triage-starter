# Design

## Context

Single zero-dependency Node server (`server.mjs`), a static page and an AI mock (`mock-ai.mjs`) that must stay unchanged. The mock accepts `{ signal }` and rejects its `[timeout]` delay on abort. README promises Node 20+.

## Goals / Non-Goals

**Goals:** deterministic, fully tested contract for every input and model failure; tests do not depend on a fixed port.

**Non-Goals:** real LLM provider, auth, persistence, i18n.

## Decisions

- **Split `app.mjs` (factory `createApp({ classify, timeoutMs })`) from `server.mjs` (listen only).** Tests import the factory and `listen(0)`; injecting `classify` also lets tests cover a model that never resolves. Alternative `import.meta.main` is Node 24 only.
- **Timeout via `AbortController` + `Promise.race` with a timer.** The timer is cleared in `finally`; the controller is aborted on timeout so the mock stops. The race guarantees the limit even if a model ignores the signal.
- **Validation as pure functions** (`parseTriageRequest`, `parseModelOutput`) returning `null` on failure; the handler maps `null` to the fixed 400 / manual_review bodies. The ready body is built field by field (no spread).
- **Render logic in `triage-view.mjs`**, a browser ES module served at `/triage-view.mjs` with `text/javascript`. It writes to plain `{ textContent, hidden }` targets, so `node:test` can verify draft clearing without a DOM library.
- **Body limit 64 KB → `invalid_input`.** Bytes past the limit are drained but not buffered, so memory stays bounded and the contract keeps a single 400 body.
- **Routing by pathname** (query string ignored).
- **No overlapping requests on the page**: the submit button is disabled while a request is in flight, so a slow reply cannot overwrite a newer one.
- **Tests with built-in `node:test`**, explicit file list (glob arguments need Node 21+). CI runs on Node 20.

## Risks / Trade-offs

- [Timeout test depends on wall clock] → assert elapsed < 900 ms against the 1200 ms mock delay, leaving a wide margin.
- [Draft returned as is] → only `trim()` is used for the emptiness check, so the model formatting is preserved.
