# Proposal

## Why

`POST /api/triage` trusts both the client and the AI mock: a broken or empty body crashes into HTTP 500, a slow model hangs the request, and malformed model output reaches the manager as a "ready" answer. The page prints raw JSON and keeps a stale draft visible after a failure, so a manager can send the wrong reply.

## What Changes

- Validate the request body: only a JSON object with a non-blank string `text` is accepted; everything else returns HTTP 400 `{"status":"invalid_input"}`.
- Bound the model call to 300 ms and abort it on timeout.
- Validate model output (JSON object, topic in `delivery|pricing|other`, non-blank string draft); any failure returns HTTP 200 `{"status":"manual_review","topic":null,"draft":null}`.
- Build the `ready` response field by field so model output cannot inject extra fields or override `status`.
- Page: show a readable topic and the draft on success, a clear manual-review message on failure, clear the previous draft on every new submit, ignore stale responses.
- Add executable `node:test` tests (API + view logic) and a CI workflow on Node 20.
- `mock-ai.mjs` is unchanged.

## Capabilities

### New Capabilities
- `candidate-triage`: classifying an incoming request into a topic with a reply draft, including input validation, model time limit, output validation and the manager-facing page.

### Modified Capabilities

## Impact

- `server.mjs` (now only starts the server), new `app.mjs` (request handling), new `triage-view.mjs` (page rendering, served to the browser), `index.html`.
- New `test/`, `package.json` (scripts only, no dependencies), `.github/workflows/ci.yml`, README run/test section.
