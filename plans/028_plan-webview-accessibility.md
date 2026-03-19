# Plan: Explicit accessibility (a11y) for webview UI

**Issue:** [ROADMAP.md §7](../ROADMAP.md) — No explicit accessibility (a11y)  
**Location:** webview UI (viewer and panels)  
**Severity:** Medium

**Audit:** [028_webview-a11y-audit.md](028_webview-a11y-audit.md) — entry points, current state, gaps, focus notes.

---

## Current state (updated)

- **Viewer:** Primary content has `role="main"` (`viewer-content-body.ts`). Log region has `role="log"` and `aria-label`; `#line-count` has `aria-live="polite"` and `aria-atomic="true"` so filter/load updates are announced. Icon bar has `role="toolbar"`; replay bar has `role="region"` and labeled controls. Level flyup "All"/"None" are `<button>` (keyboard-usable). Session/split nav, footer controls, and level toggles have labels.
- **Panels (done so far):** Options, Session list (Project Logs), and Integrations have `role="region"` and `aria-label` on containers; key buttons/inputs have `aria-label`. Other panels (shortcuts, timeline, investigation, insights, bug-report, ai-explain, find, filters, bookmark, trash, crashlytics, insight, about) still need landmarks and labels per audit.
- **Focus:** Options and Session panels move focus into the panel on open and return focus to the icon bar button on close (Escape or Close button). Focus trap (Tab confined to panel until close) not yet implemented.
- **Docs:** README has an "Accessibility" paragraph under Keyboard shortcuts; audit doc exists. axe in CI not yet added.

## Goal

Define and implement explicit accessibility for all webview UI: consistent semantics, keyboard navigation, focus management, and screen-reader-friendly behavior so the extension is usable with keyboard and assistive tech.

## Sub-tasks

### 1. Audit and document ✅

- List every webview entry point (viewer, Session Comparison, and each panel that renders HTML).
- For each: note existing `role`, `aria-*`, `tabindex`, and heading structure; identify missing landmarks (`main`, `nav`, `region`), live regions for dynamic content, and skip links if needed.
- Document expected focus order and any traps (e.g. modals, panels that steal focus).

### 2. Viewer ✅

- Ensure `<main>` or equivalent landmark wraps primary content; ensure icon bar has `role="toolbar"` and focusable items are in a logical tab order.
- Log region: keep `role="log"` and `aria-label`; ensure line updates (when filtering or loading) are announced if critical (e.g. `aria-live` on status or summary, not on the full log).
- Level toggles, filter badge, session/split nav: ensure all interactive elements are focusable and have clear labels; avoid `tabindex="-1"` unless for programmatic focus only.
- Replay bar: ensure play/pause/stop, speed, and scrubber are keyboard-usable and labeled.

### 3. Panels (options, session list, integrations, shortcuts, timeline, etc.) — in progress

- Add `role` and `aria-label` to panel containers and key controls. **(Done: Options, Session, Integrations.)**
- Ensure headings hierarchy (e.g. one `h1` per view, then `h2`/`h3`) where applicable.
- For dynamic content (e.g. session list, integration list), use `aria-live` where updates should be announced.
- Ensure selects, buttons, and links are focusable and operable by keyboard (Enter/Space, no click-only).

### 4. Focus and keyboard — in progress

- When opening a panel or overlay, move focus into it and trap focus until closed (or provide a clear “Close” that returns focus to opener). **(Focus-in and return-to-opener done for Options and Session; trap not yet implemented.)**
- When closing, return focus to the trigger element.
- Document shortcut coverage (e.g. Ctrl+F for search) in the viewer **Options** → **Keyboard shortcuts…** panel and ensure no conflicting or unreachable actions.

### 5. Testing and docs — in progress

- Run an a11y checker (e.g. axe DevTools or axe-core in CI) on the built webview HTML where feasible, and fix critical/serious issues. **(Not yet.)**
- Add a short “Accessibility” subsection to README or CONTRIBUTING describing keyboard use and any known limitations. **(Done: README.)**

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
