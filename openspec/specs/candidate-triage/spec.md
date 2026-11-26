# candidate-triage Specification

## Purpose
Lets a manager paste an incoming request and get a topic plus a reply draft from the AI, while guaranteeing that invalid input and slow or broken model answers never reach the manager as a ready reply.

## Requirements

### Requirement: Request validation
`POST /api/triage` SHALL accept only a JSON object whose `text` field is a string containing at least one non-whitespace character. Any other body SHALL produce HTTP 400 with exactly `{"status":"invalid_input"}`.

#### Scenario: Missing, empty or non-string text
- **WHEN** the body is `{}`, `{"text":""}`, `{"text":"   "}` or `{"text":123}`
- **THEN** the response is HTTP 400 `{"status":"invalid_input"}`

#### Scenario: Malformed or non-object JSON
- **WHEN** the body is empty, not valid JSON, `null`, an array, a primitive or larger than 64 KB
- **THEN** the response is HTTP 400 `{"status":"invalid_input"}`

### Requirement: Ready response
When the model returns a JSON object with `topic` in `delivery`, `pricing`, `other` and a non-blank string `draft`, the endpoint SHALL return HTTP 200 with exactly the fields `status` (`"ready"`), `topic` and `draft`.

#### Scenario: Valid delivery request
- **WHEN** the text mentions delivery and the model answers correctly
- **THEN** the response is HTTP 200 `{"status":"ready","topic":"delivery","draft":"<non-empty text>"}`

### Requirement: Model time limit
The endpoint SHALL wait for the model no longer than 300 ms and SHALL cancel the pending model call on timeout.

#### Scenario: Model is too slow
- **WHEN** the model does not answer within 300 ms
- **THEN** the response is HTTP 200 `{"status":"manual_review","topic":null,"draft":null}` well before the model would have finished

### Requirement: Manual review fallback
A model error, non-JSON output, a non-object JSON value, an unknown topic or a missing or blank draft SHALL produce HTTP 200 `{"status":"manual_review","topic":null,"draft":null}`.

#### Scenario: Unusable model output
- **WHEN** the model throws, returns non-JSON, returns topic `refund` or a whitespace-only draft
- **THEN** the response is HTTP 200 `{"status":"manual_review","topic":null,"draft":null}`

### Requirement: Manager page
The page SHALL show the topic and draft on `ready`, a message asking the manager to handle the request manually on `manual_review` or on a network or server failure, and a hint on `invalid_input`. Each new submission SHALL clear the previous topic, draft and message.

#### Scenario: Failure after a successful draft
- **GIVEN** a draft from a previous request is shown
- **WHEN** the next request ends in `manual_review`
- **THEN** the previous draft and topic are no longer shown and the manual-review message is visible
