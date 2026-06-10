# Stack-frame click-to-open — finish report

**Trigger (user, 2026-06-07):** "collapse groups and stack traces are COMPLETELY BROKEN" while reviewing `d:\src\contacts\reports\20260607\20260607_073856_contacts.log`. Three reported defects: (1) collapsing a message line hides unrelated "Awesome Notifications" lines; (2) a stack appears as a second collapse group nested inside the message line (wants single-level only); (3) the stack trace is not clickable inline or via the right-side file-link.

This finish pass ships **complaint #3 only** (stack-frame clickability), the one defect I could verify deterministically from the code. Complaints #1/#2 were investigated exhaustively and traced to filter/peek-state gutter affordances, not the grouping data — left open pending the user's choice between two proposed fixes.

## Finish Report (2026-06-07)

**This work will be reviewed by another AI.**

### Scope
**(B)** VS Code extension (TypeScript / webview script). No Flutter/Dart, no docs-only.

### Investigation summary (how the conclusion was reached)
- Built a faithful reproduction feeding the exact log bytes (lines 599–616) through the **real** parser (`parseRawLinesToPending`), the **real** `isStackFrameText`, and the **real** `addToData` in file-review, live, and forced-same-timestamp live modes.
- **Grouping data is correct in every mode:** the "Notification Sent" stack contains exactly its 5 frames; the Awesome Notifications land outside as plain lines (the group closes on the first non-frame line, `viewer-data-add.ts:96`); "Fiery resilience" is in no group; a stack-header can never become a continuation child (frames are consumed before continuation, which only groups `type:'line'` items). So #1/#2 as literally described do not arise from the grouping logic.
- The message-line collapse chevrons in the screenshots are gutter **gap/peek** affordances (`getCounterAffordance`), which only appear when adjacent lines are filter-hidden or a peek is active — i.e. live-session filter state. The gutter showing 1291 (not ~599) confirms the screenshots are a live capture, not the saved file.
- **#3 root cause (verified from rendered HTML):** member-first rendering (`formatFrameMemberFirst`) emits the member as plain text and floats the only link — the path — hard-right at opacity 0.6 (`.frame-lib-src`), which clips off a narrow sidebar. Clicking the visible member did nothing.

### Change
`src/ui/viewer/viewer-script-click-handlers.ts` — added a click branch: a click anywhere on a `.stack-line` frame row, after the specific targets it can carry (`.source-link`, async-gap glyph, meta tags) and before the `.stack-header` toggle branch, resolves the frame's embedded `.source-link` and posts `linkClicked` (path/line/col, `splitEditor` on Ctrl/Cmd). Guarded on `window.getSelection().isCollapsed` so drag-to-select frame text is not hijacked into an open. Stack-header rows are unaffected (whole-row toggle preserved; their path link still opens via the `.source-link` branch).

### Deep review notes
- Logic/safety: new branch is null-guarded (`getSelection` optional, `querySelector` may return null → no-op), no recursion, no state mutation. Returns early only when a link is found.
- Architecture: reuses the existing `linkClicked` outbound message (no new message type → catalogs unchanged). Mirrors the existing `.source-link` branch payload shape.
- No existing behavior modified — purely additive branch ordering.

### Testing
- **Audit:** grepped `src/test/` for `getViewerClickHandlerScript`, `stack-line`, `source-link`, `linkClicked`. All click-handler tests are static-string inspection (`viewer-script-null-guards`, `viewer-floating-search`, etc.); none assert stack-frame click routing, and none break from an additive branch. `viewer-dart-frame-format.test.ts` pins `formatFrameMemberFirst` output (unmodified).
- **New test:** `src/test/ui/viewer-stack-frame-click.test.ts` (Mocha style, matches siblings) — 4 cases pinning: routes to `linkClicked`, selection guard present, frame branch precedes header branch, direct `.source-link` branch still first. Assertions validated here via a temp node runner (**ALL 8 ASSERTIONS PASS**). Not executed under the Extension Host (Mocha/vscode-test) in this environment — that run happens in CI / `npm run test`.
- **Gates:** `npm run check-types` clean; `eslint` clean on both files; `npm run compile` passed all verify gates (NLS, webview catalogs, host-outbound catalog, list-commands, dist-size 4.42 MiB).

### Maintenance
- CHANGELOG: entry added under `[Unreleased] → Fixed`.
- README: verified — no update needed (line 96 documents collapse-cycle behavior, unchanged; frame click-to-open restores expected behavior rather than adding a documented feature).
- guides reviewed (`docs/guides/TERMINOLOGY.md` — no terminology change).
- `docs/LAUNCH_TEST.md`: not present in this repo — SKIPPED.
- l10n: SKIPPED [B-NOT-IN-SCOPE] — extension TS, no Flutter ARB.
- Roadmap: no roadmap entry closed.
- No bug archive — task did not close a `bugs/*.md` file.

### Outstanding work (NOT shipped this pass)
- **#1 (collapsing hides unrelated Awesome Notifications)** and **#2 (apparent nested/multi-level grouping)** remain open. Grouping data is verified correct; the symptom is the gap/peek gutter affordance interacting with the live filter state. Two proposed fixes await the user's choice:
  - **A.** Stop the gutter gap/peek chevron from engulfing a separate stack group, so a reveal never reads as a nested second level around a trace.
  - **B.** Add temporary on-screen diagnostics; user reproduces live and pastes the dump so the exact state is fixed rather than the most-likely one.

### Files changed
- `src/ui/viewer/viewer-script-click-handlers.ts` (fix)
- `src/test/ui/viewer-stack-frame-click.test.ts` (new test)
- `CHANGELOG.md` (Unreleased → Fixed entry)
- `plans/history/2026.06/2026.06.07/stack-frame-click-to-open.md` (this report)

## Follow-up — #1/#2 root cause FOUND and fixed (2026-06-07, same day)

The user challenged "did you really find the issues?" — correctly. The first pass
declared #1/#2 "filter-state dependent, grouping correct" because the standalone
reproduction ran with the WRONG filter defaults (`showDevice='all'`). Re-running
with the REAL defaults found the actual bug.

### Root cause (reproduced in the DEFAULT out-of-the-box state, no manual filter)
- `viewer-stack-tags/viewer-stack-filter.ts:20` defaults `showDevice='warnplus'`
  (and `showExternal='warnplus'`). So info-level **device-other** lines are hidden
  by default — including the "Awesome Notifications" / logcat rows interleaved in
  the app log flow.
- When such a hidden line falls immediately AFTER an app stack trace,
  `computeRowAffordances` stamps the reveal `_hiddenAfter` on the trace's LAST
  **stack-frame** row. But `renderStackFrame`/`getDecorationPrefix` rendered NO
  decoration prefix for stack-frame rows (column alignment), so the `▶` reveal
  chevron was computed and thrown away. The hidden line vanished with no control
  to surface it, and reading the trace looked like the collapse had "eaten"
  unrelated lines (= complaint #1). The lost reveal also reads as confusing
  structure around the trace (= complaint #2).
- Verified deterministically: feeding the real log slice with real tier
  classification + DB signals on + `showDevice='warnplus'`, the 3 Awesome
  Notification rows were `height=0` and the gap was hosted on a stack-frame whose
  chevron never rendered.

### Fix
`src/ui/viewer/viewer-data-helpers-render-stack.ts` — `renderStackFrame` now
derives its own gutter: when the frame carries `_hiddenAfter` (a hidden gap below
it), it renders the affordance chevron ONLY (empty counter — frames have no line
number) wrapped in `.line-decoration`, and drops `line-deco-spacer-only` so the
column doesn't double-indent. The chevron carries `data-affordance-kind="gap"` +
`data-hidden-from/to`, routing through the existing `handleCounterRowClick` →
`peekChevron(from,to,'filter')` peek control. No change to grouping/continuation
logic, `getDecorationPrefix`, or `computeRowAffordances`. Kept the logic in
render-stack.ts (had headroom) rather than growing `getDecorationPrefix` /
`renderItem`, which would have tripped the 300-line `max-lines` gate.

### Test
`src/test/ui/viewer-stack-frame-hidden-gap.test.ts` (Mocha) — 2 cases: (1) the
last frame before a warnplus-hidden device line renders the gap chevron with the
hidden range and drops the spacer; (2) a frame with nothing hidden after it
renders no chevron and keeps the spacer. Both validated here via shimmed
suite/test globals (Mocha runs in CI). Gates: check-types clean, eslint clean
(no max-lines warnings), `npm run compile` green.

### Still genuinely open
- Whether the user ALSO sees this with `showDevice='all'` (device lines visible).
  In that state the device lines are NOT hidden and the collapse cannot affect
  them — if the user still sees hiding there, that is a different bug and needs
  their exact filter state. Needs on-device confirmation (F5).
- The deeper UX question of whether interleaved device-info lines SHOULD be
  warnplus-hidden by default mid-app-flow is a product decision, not changed here.

### Additional files changed (this follow-up)
- `src/ui/viewer/viewer-data-helpers-render-stack.ts` (fix)
- `src/test/ui/viewer-stack-frame-hidden-gap.test.ts` (new test)
- `CHANGELOG.md` (second Unreleased → Fixed entry)
