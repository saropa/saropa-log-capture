# Smart-bookmark popup replaced with five-action modal

User reported: "during active logging when there is an error there is a popup asking me if i want too bookmark." Follow-up: "add bookmark seems to get lost — where do I find them? Show me the error in a bigger snack / modal so I can actually decide what to do with it: copy (to clipboard), focus (in log viewer), bookmark (??), ignore (suppress further messages), dismiss (ignore until next issue)." The existing prompt was a two-button `showInformationMessage` toast that exposed the line number only (full error text was truncated/hidden), gave no acknowledgment after "Add bookmark" was clicked (the bookmark landed but the user had to discover the Bookmarks side panel themselves), and had no per-pattern suppression.

## Finish Report (2026-05-30)

### 1. Critical Note

This work will be reviewed by another AI.

### 2. Scope

(B) VS Code extension (TypeScript). No Flutter/Dart app code touched, no Dart linter, no docs-only changes.

### 3. Deep Review

- **Logic & Safety.** `maybeSuggestSmartBookmark` marks the URI in `promptedUris` BEFORE the `await showSmartBookmarkModal(...)` so a second file load racing in cannot double-prompt. The `ignoredErrorTexts` check happens before the `bookmarkStore.getForFile()` read so we don't pay disk for a prompt we'd suppress anyway. No recursion paths. The modal returns `undefined` when the user closes without choosing — handled as a no-op (and the URI is still marked prompted, intentional: closing the modal is implicit dismissal for that file).
- **Architecture & Adherence.** Function-length budget (30 lines per `.claude/rules/global.md`) preserved by splitting into `pickCandidate` (4 lines), `maybeSuggestSmartBookmark` (15 lines), `showSmartBookmarkModal` (18 lines), `runSmartBookmarkAction` (18 lines), `addBookmarkFromCandidate` (10 lines). Two new exported interfaces (`SmartBookmarkSession`, `SmartBookmarkViewer`) cleanly separate the host-side state from the viewer adapter so the handler in `extension-activation-handlers.ts` constructs both and the helper stays decoupled from `LogViewerProvider`. No new files created. No new dependencies. No new shared infrastructure.
- **Performance & UI/UX.** The prompt fires once per file per window (existing guard). New modal is VS Code's native `showInformationMessage({modal: true, detail})` — no custom webview, no asset additions, no perceivable cost over the prior two-button popup. Per the global "no silent async" rule, all five actions emit a visible outcome: Focus reveals the row (visible state change), Copy fires a confirmation toast, Bookmark fires a confirmation toast naming the panel location, Ignore is silent intentionally (the absence of future prompts IS the feedback the user asked for), Dismiss is silent (current behavior).
- **Documentation Quality.** Function header on `maybeSuggestSmartBookmark` explains intent ("Surface the first error/warning … with 5 actions") and lists the action names so the reader doesn't have to scroll to the switch. Doc on `SmartBookmarkSession` explains both fields AND why they aren't persisted (a reload gives the user a fresh start). Inline comments call out: (a) the race-safe `promptedUris.add()` placement, (b) the 1-based scroll index convention. No filler comments.
- **Refactoring.** No out-of-scope cleanup. `bookmarkStore.add()` is still called inline (same as before); did not extract into a shared `addBookmarkFromUriAndCandidate` helper because the only caller is this file.

### 4. Testing Validation

**A. Existing test audit — completed.**

Grepped `src/test/` for every symbol touched and every string literal modified:
- `maybeSuggestSmartBookmark` — 0 references in tests.
- `smartBookmarkSuggestedForUri` (removed identifier) — 0 references.
- `SmartBookmarkSession`, `SmartBookmarkViewer` (new types) — 0 references (new).
- `msg.smartBookmarkFirstError`, `msg.smartBookmarkFirstWarning` keys (modified English) — 0 references.
- `action.addBookmark`, `action.dismiss` keys (relabeled to "Bookmark", unchanged "Dismiss") — 0 references.
- `extension-activation-helpers`, `extension-activation-handlers` (touched files) — 0 references.
- `"Add bookmark"`, `"First error at line"`, `"First warning at line"` (literal strings) — 0 references.

Only `src/test/modules/bookmarks/first-error.test.ts` touches the smart-bookmark area, and it covers `findFirstErrorLines` in `src/modules/bookmarks/first-error.ts` — a file I did NOT modify. No test required updating.

**B. New behavior tests.**

Not added. The new behavior is gated entirely on `vscode.window.showInformationMessage`, `vscode.env.clipboard.writeText`, and `LogViewerProvider.scrollToLine` — VS Code APIs that require either the Extension Host (vscode-test) or extensive stub modules to mock. The prior `maybeSuggestSmartBookmark` had zero tests for the same reason (it wraps `showInformationMessage`). Extracting `pickCandidate` for unit testing would require also stubbing `getConfig` which reads `vscode.workspace.getConfiguration`, adding more harness than the 4-line function warrants. Manual verification is documented in the commit message and the "How to verify" section below.

**C. Preflight result.**

`npm run check-types` reports zero errors in the three files I touched (`src/extension-activation-helpers.ts`, `src/extension-activation-handlers.ts`, `src/l10n/strings-a.ts`). Six pre-existing errors persist in `src/ui/provider/viewer-provider-actions.ts` from in-progress work on classifier inputs (`buildClassifierInputs`, `ClassifierInputs`, `SessionListPayloadOptions.payload`); those are unrelated to this change and were already in the user's working tree before this task started.

`npm run verify-nls`: passed. 465 keys aligned across 11 `package.nls*.json` files.

### 5. Localization (Flutter UI scope only)

SKIPPED [B-NOT-IN-SCOPE] — this is a VS Code extension; no Flutter `lib/`, no `app_en.arb`, no `flutter gen-l10n` to run. The new English strings live in `src/l10n/strings-a.ts` and are resolved through `vscode.l10n.t()`; missing translations in `l10n/bundle.l10n.*.json` fall back to English at runtime (the project's `verify-nls` script does not check those bundles).

### 6. Project Maintenance & Tracking

- **CHANGELOG.md** — Unreleased section updated with the user-facing intro line + a `### Changed` bullet describing the modal redesign and listing each new action's behavior.
- **README.md** — verified, no updates needed (smart bookmarks are not mentioned in README).
- **package.json / package-lock.json** — not touched (no release, no dependency change).
- **TODOs / plans** — none open for this work prior to the task.
- **doc/guides/** — guides reviewed; nothing user-facing in the guides covers smart-bookmark prompt copy.
- **docs/LAUNCH_TEST.md** — file does not exist in this project. SKIPPED [FILE-NOT-PRESENT].
- **Roadmap** — SKIPPED [A-NOT-IN-SCOPE] (Roadmap step is Dart-linter-specific).
- **Bug archival** — SKIPPED [NO-BUG-FIXED]. No `bugs/*.md` file described this work; the request originated as conversational UX feedback during the session.

### 7. Persist Finish Report

Finish report saved: `plans/history/2026.05/2026.05.30/smart-bookmark-popup-replaced-with-modal.md` (this file). Case (B) of Section 7 applies — task closed no pre-existing bug or plan file.

### 8. Commit & Finalization

**Files changed (this task only — unrelated working-tree state preserved):**

- `src/extension-activation-helpers.ts` — replaced two-button `maybeSuggestSmartBookmark` with five-action modal + `SmartBookmarkSession` state + `SmartBookmarkViewer` adapter + three new dispatch helpers.
- `src/extension-activation-handlers.ts` — imports `SmartBookmarkSession`, builds the session bucket + viewer adapter once per window, passes both into the handler call.
- `src/l10n/strings-a.ts` — five new keys (`action.focusLine`, `action.copy`, `action.ignoreError`, `msg.errorCopied`, `msg.bookmarkAdded`); trimmed `"Add bookmark?"` suffix off the two existing `smartBookmarkFirst*` strings; relabeled `action.addBookmark` from "Add bookmark" → "Bookmark" so the button works as a verb alongside the other four single-word actions.
- `CHANGELOG.md` — Unreleased intro paragraph extended + new `### Changed` bullet.
- `plans/history/2026.05/2026.05.30/smart-bookmark-popup-replaced-with-modal.md` — this finish report (new).

**Files explicitly NOT staged** (other workstreams' in-progress changes already in the working tree before this task):

- `src/ui/provider/viewer-provider-actions.ts` and the many other M-state files listed in the session-start git status — unverified feature code from other workstreams, will be committed separately by their authors.

**Diff summary for reviewer:**

Logic change is local to `extension-activation-helpers.ts`. The old function fetched the candidate, prompted with two buttons, conditionally called `bookmarkStore.add()`. The new function does the same up to the candidate fetch, then additionally checks `session.ignoredErrorTexts`, opens a modal with five buttons + `detail: candidate.lineText`, and dispatches to one of: `viewer.scrollToLine`, `clipboard.writeText`, `bookmarkStore.add` + acknowledgment toast, `session.ignoredErrorTexts.add`, or no-op. The handler change in `extension-activation-handlers.ts` is purely structural — swap a `Set<string>` for a typed `SmartBookmarkSession` object and pass a tiny `{ scrollToLine }` adapter so the helper never imports `LogViewerProvider` directly.

**How to verify (manual, in Extension Development Host):**

1. F5 to launch the Extension Development Host.
2. Start a session that the active app will log an error into (a Flutter app throwing an exception is the easiest repro).
3. Wait for the first error to land. The modal should appear with:
   - Title: `First error at line N` (no trailing "Add bookmark?" prompt).
   - Detail: the full error line, not truncated.
   - Five buttons: Focus / Copy / Bookmark / Ignore / Dismiss.
4. Test each button against a fresh session per case:
   - **Focus** → viewer scrolls to the error row.
   - **Copy** → clipboard contains the line, "Error copied to clipboard" toast appears.
   - **Bookmark** → bookmark appears in the Bookmarks side panel (icon bar bookmark button in the viewer toolbar), "Bookmark added at line N. Open the Bookmarks panel in the viewer toolbar to find it." toast appears.
   - **Ignore** → modal closes silently; load another log containing the same exact error line; modal does NOT re-appear.
   - **Dismiss** → modal closes silently; same file, no re-prompt; a different file with an error still prompts.
5. Reload the window (`Developer: Reload Window`) and confirm `Ignore` no longer suppresses — `ignoredErrorTexts` is intentionally session-scoped.

**Task scope.** Complete as defined. Outstanding work: none for this task. Pre-existing check-types errors in `viewer-provider-actions.ts` belong to a separate workstream and were present before this task started.
