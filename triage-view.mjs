// Rendering for the triage page. Shared by index.html (browser) and the node:test suite,
// so it only touches `textContent` and `hidden` and never injects HTML.

export const TOPIC_LABELS = {
  delivery: "Доставка",
  pricing: "Цена и стоимость",
  other: "Другое",
};

export const MESSAGES = {
  pending: "Разбираем заявку…",
  invalid_input: "Введите текст заявки — поле не может быть пустым.",
  manual_review:
    "AI не смог разобрать заявку. Разберите её вручную: определите тему и напишите ответ клиенту сами.",
};

function showMessage(view, text) {
  view.result.hidden = true;
  view.topic.textContent = "";
  view.draft.textContent = "";
  view.message.textContent = text;
  view.message.hidden = false;
}

/** Clears the previous answer as soon as a new request starts. */
export function renderPending(view) {
  showMessage(view, MESSAGES.pending);
}

/** Renders an API payload. Anything that is not a well-formed ready answer is shown as manual review. */
export function renderResult(view, payload) {
  const isReady =
    payload?.status === "ready" &&
    Object.hasOwn(TOPIC_LABELS, payload.topic) &&
    typeof payload.draft === "string" &&
    payload.draft.trim() !== "";

  if (isReady) {
    view.topic.textContent = TOPIC_LABELS[payload.topic];
    view.draft.textContent = payload.draft;
    view.message.textContent = "";
    view.message.hidden = true;
    view.result.hidden = false;
    return;
  }
  showMessage(view, payload?.status === "invalid_input" ? MESSAGES.invalid_input : MESSAGES.manual_review);
}
