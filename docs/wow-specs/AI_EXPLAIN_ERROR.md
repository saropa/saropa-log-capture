# Wow Spec: AI "Explain this error"

**Status:** Proposed (Consider for Wow)  
**Source:** ROADMAP §7 "Consider for Wow" #1, §4 "Wow" #1  
**Dependencies:** VS Code Language Model API (`vscode.lm`), user consent / Copilot or compatible provider  
**Related:** [Language Model API](https://code.visualstudio.com/api/extension-guides/language-model), existing [crashlytics-ai-summary.ts](../../src/modules/crashlytics/crashlytics-ai-summary.ts)

---

## 1. Overview

### 1.1 Goal

Allow the user to select one or more log lines (typically an error or stack trace) and ask an AI language model to **explain the error** in plain language: what likely caused it, what to check, and optionally suggest a fix or link to documentation. The response is shown in a dedicated UI (e.g. a panel, inline hover, or chat-style reply) without leaving the log viewer.

### 1.2 Value Proposition

- **Faster triage:** Developers spend less time searching the web or internal docs for obscure framework/runtime errors.
- **Context-aware:** The model receives the exact log line(s), optional surrounding context (e.g. 5 lines before/after), and can use session metadata (e.g. app version, tags) if provided.
- **Consistency with VS Code:** Uses the same Language Model API and consent flow as other AI features (e.g. Copilot), so no extra API keys or accounts are required when the user already has a supported provider.
- **Differentiator:** Few log viewers offer in-editor "explain this error" with a first-party LM integration.

### 1.3 Out of Scope (for this spec)

- Full chat conversation history in the viewer.
- Running fixes or edits suggested by the model (user copies/applies manually).
- Explaining non-error lines (e.g. "explain this warning") — can be added later with the same mechanism.
- Custom or self-hosted models beyond what `vscode.lm` exposes.

---

## 2. User Stories

| # | As a… | I want to… | So that… |
|---|--------|-------------|-----------|
| 1 | Developer | Right-click an error line and choose "Explain with AI" | I get a short, plain-language explanation and next steps without leaving the viewer. |
| 2 | Developer | Select multiple lines (e.g. stack trace) and run "Explain with AI" | The model sees the full stack and can pinpoint the failing frame or library. |
| 3 | Developer | See the explanation in a panel or popover that stays open | I can read and copy the text while keeping the log visible. |
| 4 | Developer | Be prompted for LM consent only the first time (or when not yet granted) | I am not surprised by repeated consent dialogs. |
| 5 | User without LM | See a clear message that "Explain with AI" requires a language model (e.g. Copilot) | I understand why the command is disabled or what to install. |

---

## 3. Technical Design

### 3.1 API and Flow

1. **Invocation:** Command `saropaLogCapture.explainWithAi` (and optionally a context-menu item on the log content). Input: current log URI, selected line index (or range), and optionally N lines of context before/after (e.g. from existing "context lines" setting or a fixed 5).
2. **Model selection:** Use `vscode.lm.selectChatModels()` with a broad selector (e.g. no filter, or `{ family: 'gpt-4o' }` / `gpt-4o-mini` for speed). Follow VS Code guidance: call `selectChatModels` only in a **user-initiated** action (the command) so consent can be requested. If no models are available, show a single notification: "Explain with AI requires a language model (e.g. GitHub Copilot). Install and sign in, then try again."
3. **Prompt construction:** Build a prompt that includes:
   - **System-style instruction (as first user message):** "You are helping a developer debug. Explain the following log error in 2–4 short paragraphs: what the error means, likely cause, and one or two concrete next steps (e.g. check X, search for Y). Do not run or modify code. If the log contains a stack trace, point to the most relevant frame. Keep the reply under 300 words and use markdown for lists/code."
   - **User message:** The selected line(s) and optional context lines (plain text). Optionally append: "Session: [displayName], tags: [tags], app version: [appVersion]" from session metadata for context.
4. **Request:** `model.sendRequest(messages, {}, cancellationToken)`. Use a `CancellationTokenSource` so the user can cancel (e.g. if the panel has a "Cancel" button).
5. **Response handling:** Stream or accumulate the response. Display in a dedicated **Explain** panel (webview or simple document) with markdown rendering. Show a progress indicator (e.g. "Asking AI…") until the first token arrives; then stream or show the full text when done. On error (`LanguageModelError`): map to user-friendly messages (consent, quota, off-topic, etc.) and show in the same panel or a notification.

### 3.2 UI Options (recommended)

- **Option A — Dedicated panel:** A new webview view (e.g. "Explain") under the same view container as the Log Viewer. When the user runs "Explain with AI", the panel opens and shows the prompt progress then the markdown response. Pros: persistent, doesn’t cover the log. Cons: another panel to manage.
- **Option B — Inline hover / peek:** Show the explanation in a hover or peek widget next to the selected line. Pros: minimal UI. Cons: limited space, hover can be fragile with long answers.
- **Option C — Simple output channel or markdown doc:** Append the explanation to an output channel or open a temporary markdown document. Pros: easy to implement, copy-paste friendly. Cons: less integrated.

**Recommendation:** Start with **Option A** (panel) for readability and consistency with "analysis" or "insights" panels; Option C is an acceptable MVP if panel real estate is a concern.

### 3.3 Configuration

- **Enable/disable:** Reuse or extend `saropaLogCapture.ai.enabled` (already used for Crashlytics AI summary). If disabled, the command does nothing or shows "Enable AI features in settings."
- **Context lines:** Use existing `saropaLogCapture.filterContextLines` or add `saropaLogCapture.ai.explainContextLines` (default 5) for how many lines before/after the selection to send.
- **Model preference:** Optional `saropaLogCapture.ai.explainModelFamily` (e.g. `gpt-4o-mini` for speed, `gpt-4o` for quality). Pass to `selectChatModels({ family: ... })`; fallback to first available if not found.

### 3.4 Privacy and Safety

- **Data sent to the model:** Only the selected log line(s), optional context lines, and optional non-sensitive session fields (display name, tags, app version). Do **not** send full log file, file paths that include usernames, or tokens from `redactEnvVars`.
- **Redaction:** Before building the prompt, apply the same redaction or exclusion logic used elsewhere (e.g. strip or mask known secret patterns) if the selected text might contain secrets.
- **Off-topic / abuse:** If the model returns or the API signals off-topic, show a neutral message ("I can only explain log errors. Try selecting an error or stack trace.") and do not retry automatically.
- **Quota and rate limiting:** Document that use of the feature consumes the user’s LM quota. Consider a simple in-memory throttle (e.g. max N requests per minute) to avoid accidental spam; show a message if throttled.

---

## 4. Implementation Phases

### Phase 1 — MVP

- Register command `saropaLogCapture.explainWithAi`.
- Get selection from viewer (current line or range; if no selection, use line at cursor).
- Resolve log URI and optional metadata (display name, tags) from provider/store.
- Call `vscode.lm.selectChatModels()` (user-initiated); handle no-model case with a single notification.
- Build prompt (instruction + selected text + optional context lines); send request; accumulate full response (no streaming for MVP).
- Show result in a simple webview panel or markdown document with "Explain" in the title.
- Add "Explain with AI" to the log content context menu (right-click) when a line is selected or focused.
- Config: `saropaLogCapture.ai.enabled` and optional `explainContextLines`.

### Phase 2 — Polish

- Streaming response into the panel for perceived performance.
- Cancel button that cancels the `CancellationTokenSource`.
- Optional model family setting and fallback logic.
- Improve error messages (consent, quota, network) with l10n.

### Phase 3 — Enhancements

- "Explain" as a tab in an existing analysis/insights panel instead of a separate view.
- Support "explain this warning" (same flow, different instruction).
- Optional: include nearby source file snippets (e.g. from stack frame) in the prompt when available.

---

## 5. Dependencies and Constraints

- **VS Code API:** `vscode.lm` (Language Model API). Requires VS Code version that supports it (check `engines.vscode` and API docs).
- **User dependency:** User must have a compatible language model provider (e.g. GitHub Copilot) and have granted consent. Extension must not require Copilot as a hard dependency in `package.json` so that users without LM can still use the rest of the extension.
- **Testing:** Do not call the real LM in automated tests (rate limits, nondeterminism). Unit-test prompt building and error-handling paths; mock `vscode.lm` or skip the command in tests.

---

## 6. Success Criteria

- User can invoke "Explain with AI" from the command palette or context menu on a selected error line and receive a concise, readable explanation in a dedicated UI.
- When no model is available or consent is missing, the user sees a single, clear message and no crash.
- Selected content and optional context are sent; no full log or sensitive redacted content is sent.
- Feature is gated by `saropaLogCapture.ai.enabled` and respects existing AI/config patterns (see crashlytics-ai-summary).

---

## 7. References

- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [Language Model API Reference](https://code.visualstudio.com/api/references/vscode-api#lm)
- Existing: `src/modules/crashlytics/crashlytics-ai-summary.ts` (prompt building, `selectChatModels`, `sendRequest`, error handling)
- ROADMAP §4 "Wow" #1, §7 "Consider for Wow" #1
