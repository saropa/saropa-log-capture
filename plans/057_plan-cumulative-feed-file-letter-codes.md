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
