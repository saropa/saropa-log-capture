# Webview accessibility audit

**Plan:** [028_plan-webview-accessibility.md](028_plan-webview-accessibility.md)

Entry points and current a11y state. Focus order and traps are documented where known.

---

## 1. Main viewer (webview)

**Entry:** `buildViewerHtml()` in `src/ui/provider/viewer-content.ts`; body from `viewer-content-body.ts`.

| Area | Current | Gaps |
|------|--------|------|
| **Shell** | Composes body + scripts; no `<main>` landmark | Add `role="main"` to `#main-content` |
| **Log region** | `viewer-content-body.ts`: `#log-content` has `role="log"` `aria-label="Log content"` | Add `aria-live` on line-count summary so filter/load updates are announced |
| **Session/split nav** | Buttons have `aria-label` / `title`; split breadcrumb has `aria-hidden="true"` | OK |
| **Footer** | Level menu, filter badge, hidden-lines counter, replay, version link have `role`/`aria-label`; level flyup toggles have `aria-label` | Level flyup "All"/"None" are `<a href="#">` — change to `<button>` for keyboard |
| **Icon bar** | `viewer-icon-bar.ts`: `role="toolbar"` `aria-label="Log viewer tools"`; buttons have `tabindex="0"` and `aria-label` | OK |
| **Replay bar** | `viewer-replay.ts`: `role="region"` `aria-label="Session replay controls"`; play/pause/stop/selects/range have `aria-label`; `#replay-status` has `aria-live="polite"` | Native controls — keyboard OK |
| **Modals** | Context menu, export, edit, deco-settings, auto-hide, goto-line, error breakpoint | Focus trap and return focus on close (see Focus section) |

**Focus order:** Document order: session nav → split breadcrumb → panel slot (when open) → log area (scroll buttons, copy-float) → footer → level flyup → icon bar. Panel open should move focus into panel; close should return to icon bar button.

---

## 2. Panels (embedded in viewer HTML)

Rendered inside `#panel-slot` via `getXxxPanelHtml()`.

| Panel | File(s) | Current | Gaps |
|-------|---------|--------|------|
| Options | `viewer-options-panel-html.ts` | Headings (h3); no container role/label; close has `title` only | Add `role="region"` `aria-label="Options"` to container; `aria-label="Close"` on close button; ensure form controls have labels |
| Session list | `viewer-session-panel-html.ts`, `viewer-session-panel-rendering.ts` | TBD | Landmark, headings, `aria-live` for list updates |
| Integrations | `viewer-integrations-panel-html.ts` | TBD | Landmark, headings |
| Keyboard shortcuts | `viewer-keyboard-shortcuts-html.ts` | TBD | Landmark, headings |
| Find | `viewer-find-panel.ts` | TBD | Landmark, labels |
| Bookmarks | `viewer-bookmark-panel.ts` | TBD | Landmark |
| Trash | `viewer-trash-panel.ts` | TBD | Landmark |
| Filters | `viewer-filters-panel.ts` / `viewer-filters-panel-html.ts` | TBD | Landmark |
| Crashlytics | `viewer-crashlytics-panel.ts` | TBD | Landmark |
| Insight | `viewer-insight-panel.ts` | TBD | Landmark |
| About | `viewer-about-panel.ts` | TBD | Landmark |

---

## 3. Standalone webview panels

These set `panel.webview.html` (or equivalent) to their own HTML.

| View | File | Current | Gaps |
|------|------|--------|------|
| Session comparison | `session-comparison.ts` | `buildHtml()` | Landmarks, headings, labels |
| Timeline | `timeline-panel.ts` | `buildTimelineHtml`, `buildLoadingHtml`, `buildErrorHtml` | Landmarks, headings |
| Investigation | `investigation-panel.ts` | Renders `investigation` HTML | Landmarks, headings |
| Insights (standalone) | `insights-panel.ts` | TBD | Landmarks |
| Bug report | `bug-report-panel.ts` | `buildPreviewHtml`, `buildLoadingHtml` | Landmarks, labels |
| AI explain | `ai-explain-panel.ts` | `buildExplanationHtml` | Landmarks, labels |
| Vitals | `vitals-panel.ts` | `buildPanelHtml`, `buildLoadingHtml` | Landmarks |
| Analysis | `analysis-panel.ts` | `buildProgressiveShell` | Landmarks |
| Pop-out | `pop-out-panel.ts` | Uses `buildViewerHtml` | Same as main viewer |

---

## 4. Focus and keyboard

- **Panel open:** When a panel opens (e.g. Options, Sessions), focus should move into the panel (first focusable or close button). Implement focus trap so Tab stays within panel until closed.
- **Panel close:** Close button (and Escape when implemented) should return focus to the icon bar button that opened the panel.
- **Modals:** Same: focus into modal, trap, on close return focus to trigger.
- **Shortcuts:** Document in Options → Keyboard shortcuts…; ensure Ctrl+F (search), etc., are reachable and not conflicting.

---

## 5. Testing

- Run axe DevTools (or axe-core) on built viewer HTML in browser or in webview where feasible.
- Manual: navigate viewer and each panel with keyboard only (Tab, Enter, Space, Escape).
- Screen reader: verify landmarks and live regions announce as expected.
