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
| Options | `viewer-options-panel-html.ts` | `role="region"` `aria-label="Options"`; close has `aria-label`; search has `aria-label` | Done |
| Session list | `viewer-session-panel-html.ts` | `role="region"` `aria-label="Project Logs"`; buttons have `aria-label`; focus in/out | Done |
| Integrations | `viewer-integrations-panel-html.ts` | `role="region"` `aria-label="Integrations"`; `aria-expanded` on toggles | Done |
| Keyboard shortcuts | `viewer-keyboard-shortcuts-html.ts` | `role="region"` `aria-label="Keyboard shortcuts"`; back button has `aria-label` | Done |
| Find | `viewer-find-panel.ts` | `role="region"` `aria-label="Find in Files"`; buttons/input have `aria-label`; focus returns to icon bar | Done |
| Bookmarks | `viewer-bookmark-panel.ts` | `role="region"` `aria-label="Bookmarks"`; buttons/input have `aria-label`; focus returns to icon bar | Done |
| Trash | `viewer-trash-panel.ts` | `role="region"` `aria-label="Trash"`; buttons have `aria-label`; focus in/out | Done |
| Filters | `viewer-filters-panel-html.ts` | `role="region"` `aria-label="Filters"`; close/search have `aria-label`; focus in/out | Done |
| Crashlytics | `viewer-crashlytics-panel.ts` | `role="region"` `aria-label="Crashlytics"`; buttons have `aria-label`; focus in/out | Done |
| Insight | `viewer-insight-panel.ts` | `role="region"` `aria-label="Insights"`; `aria-expanded`/`aria-controls` on sections; `aria-live` on hero | Done (pre-existing) |
| About | `viewer-about-panel.ts` | `role="region"` `aria-label="About Saropa"`; close has `aria-label`; focus in/out | Done |

---

## 3. Standalone webview panels

These set `panel.webview.html` (or equivalent) to their own HTML.

| View | File | Current | Gaps |
|------|------|--------|------|
| Session comparison | `session-comparison-html.ts` | `role="main"` `aria-label="Session Comparison"`; sync button has `aria-label` | Done |
| Timeline | `timeline-panel.ts` | `role="main"` `aria-label="Timeline"` | Done |
| Investigation | `investigation-panel-html.ts` | `role="main"` `aria-label="Investigation"`; search input, buttons have `aria-label`; emoji `aria-hidden` | Done |
| Insights (standalone) | `insights-panel.ts` | Retired (unified into viewer Insight panel) | N/A |
| Bug report | `bug-report-panel.ts` | `role="main"` `aria-label="Bug Report"`; toolbar has `role="toolbar"` | Done |
| AI explain | `ai-explain-panel.ts` | `role="main"` `aria-label="AI Explanation"` | Done |
| Vitals | `vitals-panel.ts` | `role="main"` `aria-label="Vitals"`; refresh button has `aria-label` | Done |
| Analysis | `analysis-panel-render.ts` | `role="main"` `aria-label="Line Analysis"`; `role="progressbar"` with `aria-valuenow`/`min`/`max`; cancel button has `aria-label` | Done |
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
