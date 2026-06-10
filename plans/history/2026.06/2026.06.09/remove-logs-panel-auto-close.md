# Remove Logs panel auto-close after opening a file

Triggered by the user request: "remove the side panel log list (session history) auto-hide feature. it is too annoying."

The Logs (session history) side panel started a 5-second countdown after a file was opened from it (`openSessionFromPanel`), then closed itself. Each new selection reset the timer. Browsing several files in a row meant the panel kept closing out from under the user. This change removes the auto-close entirely; the panel now stays open until an explicit close (its icon, an outside click, or Escape).

## Finish Report (2026-06-09)

This work will be reviewed by another AI.

### Scope

**(B)** VS Code extension (TypeScript), webview-side panel script. No Flutter/Dart, no host-only logic.

### Deep Review

- **Logic & Safety:** The removed code was a single `setTimeout(closeSessionPanel, 5000)` armed in the session-row click handler, plus its `clearTimeout` guard in `closeSessionPanel` and the `sessionAutoCloseTimer` declaration. Removing all three leaves no dangling reference (grep confirms zero remaining `sessionAutoCloseTimer` and zero `setTimeout` in the `viewer-session-panel*.ts` files). The `e.stopPropagation()` at the end of the row-click handler is retained — it is independently required so the click does not bubble to the document outside-click handler and close the freshly-rerendered (detached-node) panel. Removing the timer does not affect that path.
- **Architecture & Adherence:** No new state, no new API surface. Manual close (`closeSessionPanel`) is unchanged and still wired to the icon, outside-click, and Escape paths.
- **Performance/UX:** Strictly less work (one fewer timer per open). UX is the point of the change — the panel no longer disappears mid-browse.
- **Documentation:** The two doc comments that described the auto-close rationale were removed with the code they explained. No stale comments left.

### Testing Validation

**A. Existing-test audit (mandatory).** Grepped `src/test/` for `sessionAutoCloseTimer`, `AutoClose`, `auto-close`, `closeSessionPanel`, `setTimeout`, `openSessionFromPanel`, `5000`, and the changed file basenames. No existing test asserted the auto-close timer or the panel-closes-after-open behavior. The `5000` hits are all unrelated (`windowMs`, mtimes, durations). The session-panel test harness (`viewer-session-panel-test-helpers.ts`) stubs `addEventListener` as a no-op and defines no `setTimeout`, so it never exercised the click→timer path. Nothing to update. Ran the full `viewer-session-panel-runtime.test.js` file: **12 passing** (the 10 prior + 2 new).

**B. New tests.** A click-driven behavioral test is not possible in the current harness (no-op `addEventListener`, no `setTimeout`). Following the repo's established pattern of asserting against the generated webview script string (e.g. `viewer-script-syntax.test.ts`), added a `no auto-close after opening a file` suite to `viewer-session-panel-runtime.test.ts`:
  - asserts the composed `getSessionPanelScript()` contains no `sessionAutoCloseTimer` and no `setTimeout` (the auto-close was the only timer in these files), so the timer cannot silently return;
  - asserts the script still contains `openSessionFromPanel` (open preserved) and `closeSessionPanel` (explicit close preserved).

### Quality gates

- `npm run check-types` — clean.
- `npm run lint` — 0 errors. 11 pre-existing warnings on this feature branch (`viewer-data-helpers-core/render`, `viewer-format-markdown`, `viewer-script-messages` over max-lines; one curly-brace warning in `viewer-script-keyboard-escape.test.ts`) are in files this task did not touch; my edits only removed lines.
- `npm run compile` — succeeds; all verify gates pass (NLS, webview catalogs, command list, dist-size).
- `npm run test:file -- out/test/ui/viewer-session-panel-runtime.test.js` — 12 passing.

### Files changed

- `src/ui/viewer-panels/viewer-session-panel-events.ts` — removed the `setTimeout(closeSessionPanel, 5000)` auto-close block (and its `clearTimeout` reset) from the session-row click handler; kept `e.stopPropagation()`.
- `src/ui/viewer-panels/viewer-session-panel.ts` — removed the `sessionAutoCloseTimer` declaration/doc and the `clearTimeout` guard in `closeSessionPanel`.
- `src/test/ui/viewer-session-panel-runtime.test.ts` — added the `no auto-close after opening a file` regression suite + import of `getSessionPanelScript`.
- `CHANGELOG.md` — "Changed" entry under `[Unreleased]`.
- `plans/history/2026.06/2026.06.09/remove-logs-panel-auto-close.md` — this report.

### Bug archive

No bug archive — task did not close a `bugs/*.md` file.

### Outstanding work

None. Single-behavior removal, fully shipped.

## Finish Report (2026-06-09) — follow-up: outside-click auto-hide

User reported the first fix was incomplete: "the session history is still collapsing when i click in the the log viewer." The 5-second timer was only one of TWO auto-hide mechanisms. The second — and the one the user actually hit — was a document-level `click` listener that closed the panel whenever the click landed outside it (i.e. anywhere in the log viewer): `document.addEventListener('click', … if (sessionPanelEl.contains(e.target)) return; … closeSessionPanel())`. That handler is now removed.

This work will be reviewed by another AI.

### Scope

(B) VS Code extension (TypeScript), webview-side panel script.

### Deep Review

- **Logic & Safety:** Removed the entire document-level outside-click handler in `viewer-session-panel-events.ts`. Verified the panel retains independent close paths: the close button (`session-close`), the Logs icon toggle and mutual-exclusion via `setActivePanel` in `viewer-icon-bar.ts`, the global Escape handler (`viewer-icon-bar.ts` keydown → `setActivePanel(activePanel)`), and `closeAllPanels` when another panel opens. None depended on the removed handler.
- **stopPropagation:** The row-open click still calls `e.stopPropagation()`. Its old comment justified it solely by the now-removed outside-click handler; rewrote the comment to state the real remaining reason — many OTHER document-level click listeners exist (context menus, popovers, peer-panel dismissers, confirmed by grep) and the just-rebuilt (detached) row node must not reach them. Kept the call to avoid an unscoped behavior change.
- **Architecture:** No new state or API. Strict deletion plus comment hygiene.

### Testing Validation

**A. Existing-test audit.** Re-grepped `src/test/` for `sessionPanelEl.contains`, `closeSessionPanel`, `document.*click`, `outside`, `ib-sessions`. No test asserted outside-click-to-close. Nothing to update.

**B. New test.** Extended the regression suite (renamed `no auto-close after opening a file` → `no auto-hide for the Logs panel`) in `viewer-session-panel-runtime.test.ts` with `does not close the panel on an outside (in-viewer) click`, asserting the composed `getSessionPanelScript()` contains no `sessionPanelEl.contains` — the unique signature of the removed handler. A behavioral click test remains impossible (harness stubs `addEventListener` as a no-op). Ran the file: **13 passing**.

### Quality gates (this follow-up)

- `npm run check-types` — clean.
- `npm run compile-tests` + `npm run test:file -- out/test/ui/viewer-session-panel-runtime.test.js` — 13 passing.
- Round-2 full `npm run lint` (0 errors) and `npm run compile` (all verify gates) were run before commit isolation.

### Commit isolation note (important for the Reviewer AI)

The working tree was, at finish time, a shared scratch space holding a large in-progress parallel feature (loaded-files-history: size-range filter, session pinning, a message-listener extraction into `viewer-session-panel-events-messages.ts`) that intermingled with this fix inside `viewer-session-panel-events.ts`. The parallel branch work had already committed this task's CHANGELOG line and the round-1 timer removal, **but HEAD still contained the live outside-click handler** — HEAD's changelog claimed the fix while HEAD's code lacked it. To land the real fix without bundling the unverified parallel feature, `viewer-session-panel-events.ts` was reset to HEAD and only the two isolated hunks (handler removal + comment rewrite) were re-applied and committed; the entangled feature edits were then restored to the working tree, uncommitted, for that workstream to own.

### Files changed (this follow-up commit)

- `src/ui/viewer-panels/viewer-session-panel-events.ts` — removed the document outside-click handler; rewrote the row-open `stopPropagation` comment.
- `src/test/ui/viewer-session-panel-runtime.test.ts` — renamed suite + added the outside-click absence assertion.
- `plans/history/2026.06/2026.06.09/remove-logs-panel-auto-close.md` — this follow-up section.
- (CHANGELOG entry for both mechanisms was already committed on the branch in parallel.)

### Bug archive

No bug archive — task did not close a `bugs/*.md` file.

### Outstanding work

None for this task. The parallel loaded-files-history feature remains uncommitted in the working tree and is owned by that workstream, not this one.
