# Copy Error JSON — context-menu action

**Triggered by user request (verbatim):** "in log viewer, when copying an error we need a new DEFAULT that puts the error in json field and the full log path and session details in other json fields. so analysts can get full context. so make a second Copy Error JSON menu option"

Interpretation: added a **second** menu item ("Copy Error JSON" / "Copy Warning JSON") alongside the existing "Copy Error" / "Copy Warning" block-copy action. The existing default copy behavior (Ctrl+C / Copy to JSON / Copy Line) is unchanged — the user asked for a new menu option, not a replacement of the current default.

## Finish Report (2026-06-09)

### 1. Reviewed by another AI
Acknowledged.

### 2. Scope
**(B)** VS Code extension (TypeScript). No Flutter/Dart, no Dart tests. Flutter-specific sections marked `SKIPPED [A-NOT-IN-SCOPE]`.

### 3. Deep Review
- **Logic & Safety:** The webview cannot see the absolute log path (only `currentFilename`, a basename); `currentFileUri` lives solely on the extension. The action therefore splits: webview sends the block text + severity + 1-based line range + first timestamp + `sessionInfoData`; the host (`runCopyErrorWarningJson`) attaches `logPath`/`logFile` from `ctx.currentFileUri` and writes the JSON. This mirrors the existing `createReportFile` flow exactly. Empty-text guard surfaces `msg.logCopyEmpty` and returns; clipboard write uses the same success(status bar)/failure(error dialog) pattern as `copyToClipboard`. No race/recursion risk — single synchronous post + one clipboard write.
- **Architecture & Adherence:** Extracted the three grouped-block copy actions (Copy Error, Copy Error JSON, Copy DB cluster) into a new module `viewer-context-menu-block-copy.ts` to keep `viewer-context-menu-line-actions.ts` under the 300-line limit (it had reached 315). The extraction also removed duplicated block-text building (previously inlined in two cases) into one shared `joinLineRangeText()` — net reduction in logic duplication. All webview scripts share one concatenated scope; the new script is prepended in `getContextMenuActionsScript()` so its function declarations hoist ahead of the `handleBlockCopyAction` call site in line-actions.
- **Performance & UI/UX:** Instant in-webview toast ("Copied error block (N lines) as JSON") plus host status-bar confirmation — no silent async. The menu gate now toggles BOTH error/warning rows via `querySelectorAll` (the prior singular `querySelector` would have left the new JSON row stranded hidden) and switches both labels Error↔Warning by severity.
- **Documentation:** New module carries a verbose file-doc header naming the shared-scope dependency; the host builder documents WHY the JSON is assembled host-side (absolute path) and WHY the long `error` field is ordered last (keeps metadata scannable).
- **Refactoring:** No out-of-scope smells surfaced beyond the line-limit extraction, which was required by the change itself.
- **Linter-Specific Integrity:** SKIPPED [A-NOT-IN-SCOPE].

### 4. Testing Validation
**A. Audit of existing tests (mandatory):** Grepped `src/test/` for every touched symbol.
- `viewer-context-menu.test.ts:117-118` pinned the literal `case 'copy-error-warning-block':` / `case 'copy-db-cluster-block':`. The extraction converted these from `switch` cases to `if (action === ...)` in `handleBlockCopyAction`, so those assertions would have broken. Rewrote them to pin the new dispatch form (`action === 'copy-error-warning-block'`, `'copy-db-cluster-block'`) and added the new `'copy-error-warning-json'`. Intent (these actions are handled) preserved.
- `viewer-context-menu-html.test.ts:116-127` pinned the ordering Copy Error → DB cluster → separator → Copy & Export. Insertion of the JSON item between block and db-cluster keeps `dbIdx > ewIdx` true, so it still passed; extended it to also assert the JSON item sits between them, that `data-ew-json-label` exists, and that exactly two `data-copy-error-warning-row` markers exist.
- `viewer-copy-decorated.test.ts` imports `getContextMenuLineActionsScript` but references none of the extracted symbols — audited, unaffected.

**Run:** `npm run compile-tests` then `npm run test:file` on each — all green:
- `viewer-context-menu.test.js` — 29 passing
- `viewer-context-menu-html.test.js` — 24 passing
- `viewer-copy-decorated.test.js` — 9 passing

**B. New behavior:** Covered by the extended assertions above (new menu item + new dispatch action). Flutter test template: SKIPPED [A-NOT-IN-SCOPE].

### 5. Localization
SKIPPED [A-NOT-IN-SCOPE] — Flutter ARB pipeline. The extension's own NLS pipeline (`verify-nls`) passed during `npm run compile`; webview viewer labels/toasts are hardcoded English by existing convention (the sibling "Copy Error" label and "Copied lines…" toasts are literals, not NLS keys), so the new label/toast match the established pattern.

### 6. Project Maintenance & Tracking
- CHANGELOG: updated under a new `## [Unreleased]` section (Added).
- README: verified — no updates needed (README covers build/run; no product-fact change).
- package.json / lock: unchanged (no release/dep change).
- TODOs/plans: none open for this.
- doc/guides: reviewed — the auto-generated `doc/internal/webview-incoming-message-types.md` was regenerated (`generate:webview-catalog`) and `verify:webview-catalog` passed on compile.
- LAUNCH_TEST: SKIPPED — no `docs/LAUNCH_TEST.md` exists in this project.
- Roadmap: SKIPPED [A-NOT-IN-SCOPE].
- Bug archival: `No bug archive — task did not close a bugs/*.md file`.

### 7. Persist Finish Report
Case B — task closed no bug/plan. `Finish report saved: plans/history/2026.06/2026.06.09/copy-error-json-context-menu.md` (this file).

### Files changed
- `src/ui/viewer-context-menu/viewer-context-menu-html.ts` — new "Copy Error JSON" menu item.
- `src/ui/viewer-context-menu/viewer-context-menu.ts` — gate toggles both rows (`querySelectorAll`) + sets JSON label by severity.
- `src/ui/viewer-context-menu/viewer-context-menu-block-copy.ts` — **new** module: `joinLineRangeText`, `incidentBlockLevel`, `copyIncidentBlockAsJson`, `copyLineRangePlain`, `handleBlockCopyAction`.
- `src/ui/viewer-context-menu/viewer-context-menu-actions.ts` — prepend new block-copy script.
- `src/ui/viewer-context-menu/viewer-context-menu-line-actions.ts` — removed the three grouped-block cases; delegate to `handleBlockCopyAction` (back under 300 lines).
- `src/ui/provider/viewer-message-handler-actions.ts` — `import path`; `runCopyErrorWarningJson` builder + `copyErrorWarningJson` case.
- `doc/internal/webview-incoming-message-types.md` — regenerated catalog (adds `copyErrorWarningJson`).
- `src/test/ui/viewer-context-menu.test.ts`, `src/test/ui/viewer-context-menu-html.test.ts` — updated/extended assertions.
- `CHANGELOG.md` — `## [Unreleased]` Added entry.

### Diff summary (core logic)
Webview side posts `{ type: 'copyErrorWarningJson', errorText, level, lineStart, lineEnd, timestamp, sessionInfo }`. Host builds:
```json
{ "logPath": "<abs>", "logFile": "<basename>", "level": "error|warning",
  "lineStart": N, "lineEnd": M, "timestamp": "<ISO>", "session": {…}, "error": "<block text>" }
```
and writes it to the clipboard (status-bar confirm on success, error dialog on failure).

### Outstanding
None in code. On-device manual check of the menu interaction is pending (see What to test) — not run in this environment.
