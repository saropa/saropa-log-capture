# 057 — Cumulative feed: per-file letter codes

## Problem

The live Logs viewer is a **cumulative cross-session feed**: every broadcast line from
every debug session in the window's lifetime is appended to one continuous view
(`broadcaster.addLine` → line listeners; never cleared at session boundaries — only
`loadFromFile()` / `dispose()` call `clear()`). Meanwhile the footer header is re-pointed
to each new session's file on `onDidStartDebugSession`
(`applySessionStartedState` → `setFilename` / `setCurrentFile`).

Consequence: the viewer can show e.g. 2266 lines under a header naming a single
`…_115123_contacts.log` that holds only 87 lines on disk. Each session wrote its own file
correctly; the viewer just doesn't scope its content (all sessions) to its label
(current file). When a user copies lines to share, the clipboard carries **no file
provenance at all** ([viewer-copy.ts](../src/ui/viewer/viewer-copy.ts) emits text only),
and the gutter number is a global cumulative index that matches no file.

Decision (with user): **keep the cumulative feed**, fix the labeling so provenance is
visible and shareable.

## Three numbering systems (the trap)

The same line has three non-agreeing numbers:

1. **Viewer display index** — global, cumulative (the gutter `1139`, "Log 2265 of 2266").
2. **Per-session output ordinal** — `LineData.lineCount`, counts user-output lines in one session.
3. **Physical `.log` file line** — offset by the header block, DAP protocol lines, markers,
   and collapsed-repeat folding.

A shared "line 1139" lands differently in all three. Line numbers alone are the wrong anchor.

## Solution: per-file letter codes

Each distinct log file in the feed gets a sequential code: `A, B, … Z, AA, AB, … ZZ, AAA …`.
`A` = first file seen. A file split (`_002.log`) is a new file → next letter. Codes reset to
`A` only when the feed is explicitly cleared.

- **Gutter:** `A1, A2 … B1, B2 …` — letter = file, number resets to 1 at each file's first row.
- **Footer label:** `…_115123_contacts.log (4)` — `(n)` = count of accumulated files.
  Clicking the label opens a **files-list dialog**: one row per file (letter, name, entry
  count, time range). Clicking a row's letter opens the existing per-file actions modal
  ([viewer-log-file-modal.ts](../src/ui/viewer/viewer-log-file-modal.ts)) scoped to that file.
- **Copy:** each line prefixed with its code; block topped with a legend mapping codes to
  full paths:
  ```
  # A = reports/20260609/20260609_115123_contacts.log
  # B = reports/20260609/20260609_130627_contacts.log
  A1139  I/Choreographer(16769): Skipped 39 frames!...
  B12    DRIFT: VM Service WebSocket connect failed...
  ```

### Accepted limitation

`A1139` is a stable handle **inside the Saropa viewer**. Opening the raw `.log` in a plain
editor, line 1139 will not match (physical-line offset above). The legend supplies the exact
path and the copied text carries the content, so sharing works; jump-to-line in a non-Saropa
editor does not transfer. Inherent to a folded/cumulative view — not worth fighting.

## Data flow

`logFileUri` added to `LineData` ([session-event-bus.ts:15](../src/modules/session/session-event-bus.ts#L15)),
stamped from `session.fileUri` in
[session-manager-events.ts:72](../src/modules/session/session-manager-events.ts#L72) and the
API `writeOneLine` path. Splits change `fileUri` mid-session, so per-line stamping handles
`_002.log` correctly. The viewer assigns letters in the order distinct URIs arrive and tracks
a per-file running line number on each line item in `addToData`.

## Work items

1. **Extension — carry provenance.** Add `readonly logFileUri?: string` to `LineData`; set it
   in `processOutputEvent` and `writeOneLine` from `session.fileUri.fsPath`. (Marker/flood
   summary lines inherit the same session's file.)
2. **Webview — letter registry.** A small ordered map `path → {letter, perFileLineNo}` built
   as lines arrive in `addToData`. Expose `codeForLine(item)` → `"A1139"`. Reset on viewer clear.
3. **Gutter render.** Prefix the per-row number with the file letter. Single-file feeds (one
   distinct path) may omit the letter to avoid noise — show bare numbers, add letters only
   when ≥2 files are present.
4. **Footer counter.** Render `(n)` next to the filename; `n` = distinct file count. Hidden
   when `n <= 1`.
5. **Files-list dialog.** New modal listing accumulated files with letter, name, entry count,
   time range. Row click → open existing per-file modal for that path.
6. **Generalize `log-file-modal`.** Accept a target filename/path argument instead of always
   reading the footer DOM, so it can act on any letter's file.
7. **Copy format.** Prepend the code per line and a legend block. Applies to plain / markdown /
   snippet / raw / decorated / copy-all. Single-file feeds skip the legend and prefix.
8. **NLS strings** for the new dialog + labels; `verify-nls` clean.

## Quality gates

`npm run check-types`, `npm run lint`, `npm run compile`, tests pass. Manual F5: run two debug
sessions, confirm gutter shows `A…`/`B…`, footer shows `(2)`, dialog lists both, copy carries
legend + codes.

## Finish Report (2026-06-09)

**Reviewed by another AI.**

### Scope

(B) VS Code extension (TypeScript). No Flutter/Dart (A) and not docs-only (C) — so the
Flutter l10n section and the Linter-integrity section are out of scope.

### Trigger

User report: the live Logs viewer showed "Log 2265 of 2266" under a footer naming
`reports/20260609/20260609_115123_contacts.log`, but that file held only 87 lines. Diagnosis
confirmed the file was complete for its (short, mostly-idle) session; the viewer never clears
at debug-session boundaries, so it accumulates every run's broadcast lines under one filename
header. The user chose to keep the cumulative feed and fix the labeling with per-file letter
codes, and asked how copied line numbers / paths reconcile across files.

### Deep review notes

- **Logic & safety:** `fileCodeLetter` is bijective base-26 (verified A/Z/AA/AB/AZ/BA). The
  per-file counter lives on the registry entry, not a global, so interleaved files keep
  independent ordinals. `stampFileCodeOnNewItems` is a no-op when `logFileUri` is absent
  (loaded single file / in-memory stream), so it cannot disturb the existing single-file path.
  Stamp guards `fileLineNo` to content rows (`line`/`doc`/`stack-header`); markers and
  synthetic chips inherit the letter only.
- **Architecture:** mirrors the established post-hoc stamp pattern (`stampSourceLineNoOnNewItems`)
  and the modal-script pattern (`viewer-log-file-modal.ts`). Reused the existing single-file
  actions modal by generalizing `handleLogFileAction` with an optional `targetPath` instead of
  forking a second handler. Copy helpers were extracted to `viewer-copy-file-codes.ts` to keep
  `viewer-copy.ts` under the 300-LOC cap.
- **Performance:** registry is two small structures keyed by path; lookups are O(1). No extra
  per-render scans — letters/numbers are stamped once at line arrival and read during render.
- **Error boundary:** every webview call site guards with `typeof fn === 'function'` so a
  missing helper degrades to the prior bare-number behavior rather than throwing.
- **Refactoring:** no out-of-scope cleanups taken.

### Testing

- **Audit of existing tests (mandatory):** grepped for the touched symbols — `LineData`,
  `PendingLine`, `buildPendingLineFromLineData`, `handleLogFileAction`, `getLogFileModalScript`,
  `openLogFileActionsModal`, `getDecorationPrefix`/`buildDecoParts`, `lineToPlainText`/
  `lineToRawText`/`linesToDecoratedText`, `updateFooterText`. Ran the affected suites via
  `npm run test:file`: `viewer-log-file-modal` (7 pass, incl. the now-generalized
  `openLogFileActionsModal`), `viewer-script-null-guards` (21 pass, incl. footer + modal
  guards), `viewer-copy-decorated` (9), `viewer-sql-repeat-copy-expansion` (4),
  `viewer-copy-all-filtered` (6), `extension-smoke` (1). No assertion pinned a value this change
  altered (the copy prefix/legend are inert for single-file feeds, which is what those tests
  exercise).
- **New behavior:** added `src/test/ui/viewer-file-code-stamp.test.ts` (5 cases) covering the
  base-26 letters, first-seen letter assignment + per-file line-number reset, the ≥2-file gate
  on copy prefix/legend, registry reset, and the unstamped single-file path. All pass via
  `npm run test:file`.
- **Gates:** `check-types` clean; `lint` 0 errors (9 pre-existing warnings, none introduced —
  `viewer-copy.ts` pulled back under 300 LOC by the extraction); full `compile` with all verify
  steps (NLS 476 keys, webview catalogs, host-outbound catalog, command list, dist-size) green.

### Files changed

Feature commit `b916c032` (21 files):
`src/modules/session/session-event-bus.ts`, `src/modules/session/session-manager-events.ts`,
`src/ui/provider/log-viewer-provider-batch.ts`, `src/ui/viewer/viewer-file-loader.ts`,
`src/ui/viewer/viewer-file-code-stamp.ts` (new), `src/ui/viewer/viewer-script-messages.ts`,
`src/ui/viewer-decorations/viewer-deco-content.ts`, `src/ui/viewer/viewer-script-footer.ts`,
`src/ui/viewer/viewer-files-list-modal.ts` (new), `src/ui/provider/viewer-content-body.ts`,
`src/ui/provider/viewer-content-scripts.ts`, `src/ui/provider/viewer-log-file-actions.ts`,
`src/ui/provider/viewer-message-handler-session-ui.ts`, `src/ui/viewer/viewer-log-file-modal.ts`,
`src/ui/viewer/viewer-copy.ts`, `src/ui/viewer/viewer-copy-file-codes.ts` (new),
`src/l10n/strings-viewer-d.ts`, `src/l10n/strings-webview-b.ts`,
`src/ui/viewer-styles/viewer-styles-modal.ts`, `CHANGELOG.md`,
`plans/057_plan-cumulative-feed-file-letter-codes.md` (this file).
Finish commit (follow-up): `src/test/ui/viewer-file-code-stamp.test.ts` (new) + this report.

### Maintenance

- CHANGELOG: updated (Unreleased → Added).
- README verified — no updates needed (feature documented in CHANGELOG; README is product overview).
- `package.json` / lockfile: unchanged (no release / dependency change).
- guides reviewed — no user-facing guide affected.
- `docs/LAUNCH_TEST.md`: not present in this repo (VS Code extension, no Flutter launch-test doc) — SKIPPED [B-NOT-IN-SCOPE].
- Roadmap: SKIPPED [B-NOT-IN-SCOPE].
- Bug archival: No bug archive — task did not close a `bugs/*.md` file (originated from a chat report; no bug file existed).

### Outstanding

None functionally. Accepted limitation (documented above): `A1139` is a stable handle inside
the Saropa viewer; opening the raw `.log` in a plain editor will not land on physical line 1139
(header/DAP/fold offset). The legend's absolute path + the copied text carry the provenance;
only jump-to-line in a non-Saropa editor does not transfer. On-device/manual F5 walkthrough is
the user's to run (see "What to test").

Finish report appended: plans/057_plan-cumulative-feed-file-letter-codes.md
