# Tasks

## 1. API

- [x] 1.1 Move request handling into `app.mjs` with `createApp({ classify, timeoutMs })`; `server.mjs` only listens; verify `node server.mjs` still serves the page
- [x] 1.2 Validate the request body, including a 64 KB limit (400 `invalid_input`); verify with API tests for empty, broken, non-object, non-string, blank and oversized input
- [x] 1.3 Add the 300 ms model timeout with abort and model output validation (200 `manual_review`); verify with API tests for every mock tag and a never-resolving model
- [x] 1.4 Build the ready response field by field; verify with API tests for delivery, pricing and other

## 2. Page

- [x] 2.1 Add `triage-view.mjs` render logic served as `text/javascript`; verify with a unit test that manual_review after ready clears the draft
- [x] 2.2 Update `index.html`: loading state with the button disabled, clear on submit, network/500 fallback; verify in a browser with `[timeout]` after a successful request

## 3. Tooling and docs

- [x] 3.1 Add `package.json` test script, CI workflow on Node 20/22/24 and a README run/test section; verify `npm test` passes locally and CI is green

## Workflow follow-up

- Archive the change after implementation and verification.
