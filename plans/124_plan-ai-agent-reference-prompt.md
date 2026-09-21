# PLAN 124 — "Copy as agent reference": file path + reference line instead of pasted context

**Status: Open**

Created: 2026-09-20
Type: Viewer feature / Tooling
Related: `src/modules/ai/ai-prompt.ts`, `src/modules/ai/ai-context-builder.ts`, `src/modules/ai/ai-explain-ui.ts`, `saropaLogCapture.ai.contextLines`, PLAN 120, `bug_003` (AI redaction)

---

## Summary

Add a second prompt mode for agentic LLM tools (Claude Code, Cursor agent, etc.) that can
open files themselves: instead of pasting up to ±50 surrounding lines, copy a short prompt
containing the log file path, a reference line number, the error line, and an instruction
to read the surrounding context from disk as needed.

---

## Motivation

Today `buildExplainErrorPrompt()` embeds the error line, stack trace, surrounding lines
(`saropaLogCapture.ai.contextLines`, 0–50) and integration data verbatim. That is required
for the VS Code Language Model API path, which has no file access. For agentic tools it is
the wrong shape:

- Pasted context is a fixed window; an agent can read exactly as much as it needs.
- Large pastes cost tokens and bury the signal.
- The agent reads current file state, not a snapshot.

A path + line reference is the natural handoff for tools that can read files.

---

## Behavior

### User flow

1. In the viewer, alongside the existing copy-prompt action, add "Copy as agent reference".
2. Clipboard receives a short prompt: the untrusted-data notice (PLAN 120), the absolute
   log path, `path:line` reference (1-based, matching what the viewer shows), the
   (redacted) error line, session info, and an instruction to read surrounding lines from
   the file and treat their content as untrusted evidence.
3. For a multi-line selection, reference a range: `path:start-end`.

### UI / UX

- Reuse the existing copy-prompt entry point; no new panel.
- Toast reuses the "prompt copied" pattern.
- No new setting for v1.

---

## Edge Cases

1. **Redaction gap (key risk).** The log file on disk is unredacted, so an agent reading it
   bypasses the `redactSensitiveContent()` protection from `bug_003`. Options: (a) accept
   and warn in the toast/docs, (b) offer to write a redacted copy and reference that,
   (c) gate behind a setting. Decide before implementing; default recommendation is (b) or
   (a) with an explicit one-time notice.
2. **Line numbering.** The reference must match the file's real line numbers, including the
   header offset (`findHeaderEnd`) and split parts (`physicalLineCount` work in 9.5.1).
   Verify against the file, not the viewer's index.
3. **Path is not readable by the agent** (remote/WSL/devcontainer, different machine) —
   the pasted-context mode remains the fallback; do not remove it.
4. **Path contains user home / username.** Path is intentionally unredacted here (the agent
   needs it); note this in the toast text.
5. **Rotated/split logs** — reference the part file containing the line.

---

## Alternatives Considered

- **Replace pasted-context mode** — rejected: the LM API path has no file access.
- **Auto-detect agentic vs. LM-API targets** — rejected for v1: not reliably detectable;
  an explicit second action is clearer.
- **Raise the 50-line cap instead** — rejected: cost/noise grows and doesn't fix the
  fixed-window problem.

---

## Decision

<!-- Fill in when the proposal is accepted or declined -->

---

## Implementation Notes

- New `buildAgentReferencePrompt(context, logPath, refLine)` beside `buildExplainErrorPrompt`
  in `ai-prompt.ts`; reuse `UNTRUSTED_DATA_NOTICE`.
- `AIContext` currently has `lineIndex` (content-relative); add the log path and header
  offset, or compute the file line in the handler.
- Add the command/menu entry and l10n strings (`t()`), plus `package.nls*.json` titles.
- Tests: prompt contains path, `path:line` and range forms, redacted error line, and
  contains no surrounding-line text.

---

## Commits

<!-- Add commit hashes as implementation lands -->
