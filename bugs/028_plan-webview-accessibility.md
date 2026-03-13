# Plan: Explicit accessibility (a11y) for webview UI

**Issue:** [ROADMAP.md §7](../ROADMAP.md) — No explicit accessibility (a11y)  
**Location:** webview UI (viewer and panels)  
**Severity:** Medium

---

## Current state

- **Viewer** (`viewer-content.ts`, `viewer-icon-bar.ts`, `viewer-replay.ts`): Many controls already have `aria-label`, `title`, `role` (e.g. `role="log"` on log region, `role="toolbar"` on icon bar, `role="region"` on replay bar), and some `aria-hidden` / `aria-live="polite"`.
- **Panels** (options, session list, integrations, shortcuts, timeline, investigation, insights, bug-report, ai-explain): Coverage is inconsistent; some have `aria-label` on buttons/inputs, others have little or no landmarks.
- No project-wide a11y standard or audit (e.g. axe) is documented; focus order and keyboard-only use are not guaranteed.

## Goal

Define and implement explicit accessibility for all webview UI: consistent semantics, keyboard navigation, focus management, and screen-reader-friendly behavior so the extension is usable with keyboard and assistive tech.

## Sub-tasks

### 1. Audit and document

- List every webview entry point (viewer, Session Comparison, and each panel that renders HTML).
- For each: note existing `role`, `aria-*`, `tabindex`, and heading structure; identify missing landmarks (`main`, `nav`, `region`), live regions for dynamic content, and skip links if needed.
- Document expected focus order and any traps (e.g. modals, panels that steal focus).

### 2. Viewer

- Ensure `<main>` or equivalent landmark wraps primary content; ensure icon bar has `role="toolbar"` and focusable items are in a logical tab order.
- Log region: keep `role="log"` and `aria-label`; ensure line updates (when filtering or loading) are announced if critical (e.g. `aria-live` on status or summary, not on the full log).
- Level toggles, filter badge, session/split nav: ensure all interactive elements are focusable and have clear labels; avoid `tabindex="-1"` unless for programmatic focus only.
- Replay bar: ensure play/pause/stop, speed, and scrubber are keyboard-usable and labeled.

### 3. Panels (options, session list, integrations, shortcuts, timeline, etc.)

- Add `role` and `aria-label` to panel containers and key controls.
- Ensure headings hierarchy (e.g. one `h1` per view, then `h2`/`h3`) where applicable.
- For dynamic content (e.g. session list, integration list), use `aria-live` where updates should be announced.
- Ensure selects, buttons, and links are focusable and operable by keyboard (Enter/Space, no click-only).

### 4. Focus and keyboard

- When opening a panel or overlay, move focus into it and trap focus until closed (or provide a clear “Close” that returns focus to opener).
- When closing, return focus to the trigger element.
- Document shortcut coverage (e.g. Ctrl+F for search) in the viewer **Options** → **Keyboard shortcuts…** panel and ensure no conflicting or unreachable actions.

### 5. Testing and docs

- Run an a11y checker (e.g. axe DevTools or axe-core in CI) on the built webview HTML where feasible, and fix critical/serious issues.
- Add a short “Accessibility” subsection to README or CONTRIBUTING describing keyboard use and any known limitations.

## Files to touch (representative)

| Area | Files |
|------|--------|
| Viewer shell | `viewer-content.ts`, `viewer-icon-bar.ts`, `viewer-replay.ts` |
| Panels | `viewer-options-panel-*.ts`, `viewer-session-panel-html.ts`, `viewer-integrations-panel-html.ts`, `viewer-keyboard-shortcuts-html.ts`, `timeline-panel.ts`, `investigation-panel-html.ts`, `insights-panel.ts`, `bug-report-panel.ts`, `ai-explain-panel.ts` |
| Session comparison | `session-comparison.ts` |
| Docs | `README.md` or `CONTRIBUTING.md` |

## Considerations

- VS Code webview has its own focus behavior; ensure panel open/close and iframe boundaries don’t break focus flow.
- Avoid `aria-hidden="true"` on focusable content; use it only for purely decorative or redundant content.
- Prefer semantic HTML (`<button>`, `<a>`, `<nav>`) plus ARIA where semantics are not sufficient (e.g. custom widgets).
