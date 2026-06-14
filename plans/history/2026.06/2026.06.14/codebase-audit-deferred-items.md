# Codebase Audit — Deferred & Accepted Items

Carved out of the full codebase audit so the consciously-not-done items are not lost when the audit
itself was closed and archived. Every other audit finding (3 Critical · ~12 High · ~18 Medium · ~14
Low) was fixed. Of the items below, one (D3) remains deferred — blocked on an API capability — four
(D1, D2, D4, D5) were reassessed and built on 2026-06-14, and four (A1–A4) are accepted won't-fix with
a recorded rationale.

Source (closed + archived): `plans/history/2026.06/2026.06.14/104_plan-codebase-audit-2026-06-12.md`.

---

## Deferred — future work that may be revisited

### D3 — Crashlytics regression / new-issue false positives at the top-N paging boundary

Split out into its own focused deferred plan: `plans/deferred/crashlytics-paging-false-positives.md`.
It is blocked on an API capability (an unpaged issue feed or a truncation/total signal the current
Crashlytics read path does not expose), not on effort; a tooltip caveat and KNOWN LIMITATION comments
ship as the mitigation.

---

## Shipped 2026-06-14 — built after the audit closed

Four items originally deferred for "low value / effort" reasons were reassessed and built; only the
API-blocked D3 above remains.

### D1 — Write-stream backpressure (`await 'drain'`) — BUILT
`src/modules/capture/log-session.ts`

Added `writeBackpressured()`: the serialized append queue now awaits `'drain'` when `write()` reports
a full buffer, so a fast producer on a slow disk no longer grows Node's internal buffer without bound.
Resolves on `'error'`/`'close'` as well so a dying stream can't hang the queue. Applied to the header,
queued-line, and queued-raw writes (the footer was already flushed by `end()`). Covered by a
high-volume integrity test plus deterministic drain/error-resolution tests in `log-session.test.ts`.

### D2 — ANR-merge gate — BUILT
`src/modules/root-cause-hints/build-hypotheses.ts`

`mergeErrorsIntoAnr` now gates on the `anr::risk` key alone instead of `confidence === 'high'`, so a
moderate ANR also folds its dump lines into the single ANR hypothesis rather than echoing them as
duplicate "Error:" bullets. The tradeoff (a coincident unrelated error folds under a moderate ANR) is
documented in-code and bounded — no evidence line is dropped, and a session with no ANR leaves errors
untouched. Tests in `build-hypotheses.test.ts` pin both the new merge and the no-ANR survival path.

### D4 — `escapeHtml` consolidation — BUILT
`src/ui/escape-html-script.ts` (new) + host copies in `ansi.ts` consumers

Host side: the duplicate `escapeHtml` copies in `ai-explain-panel.ts` and `crashlytics-help-content.ts`
now import the single exported helper from `ansi.ts`. Webview side: a new `escapeHtmlScript(fnName)`
factory emits one correct `& < > " '` escaper into each isolated webview bundle under its existing
local name (`escapeHtml` / `escapeHtmlText` / `escapeHtmlBasic`), replacing nine hand-written copies so
the escaping can't drift per panel. (The full text-vs-attribute split was not needed — the single
escaper is safe for both contexts; `escapeAttr` helpers were left as-is.)

### D5 — `saropaLogCapture.replay` command — BUILT
`package.json` `contributes.commands` + 11 `package.nls*.json` titles

Contributed the replay command with a translated **Saropa Log Capture: Replay Log** title in all 11
locale files; the command-list reference and NLS parity/coverage gates pass.

---

## Accepted — won't-fix, rationale recorded so it does not resurface

### A1 — `deduplication.ts` kept despite `process()` never being called
`src/modules/capture/deduplication.ts`

Flagged as dead code, but the module has its own test suite and an explicit in-code "kept defensively
in case capture-side folding resurfaces" decision referenced from `stop()`. Removing it for a Nit
would override documented maintainer intent. Kept as-is.

### A2 — Source-link click opens any absolute path from log text
`src/ui/.../viewer-provider-actions.ts` → `source-resolver.ts`

Clicking a source link can open any absolute path appearing in log text. Accepted: the action is
click-gated and read-only, and constraining it to workspace roots would break legitimate
Dart SDK / pub-cache / out-of-workspace source links that users rely on.

### A3 — `commitsMatch` accepts a 7-char prefix match
`src/modules/compare/baseline-match.ts:30-39`

Equal-length hashes already require exact equality via the prefix logic; only genuinely-short SHAs use
prefix matching, which is inherent to short-SHA comparison and guarded by `MIN_PREFIX = 7`. Correct for
the small candidate set; no change.

### A4 — `findFilePrs` wraps filenames in literal quotes
`src/modules/git/github-context.ts:60`

The `"file"` wrapping is GitHub `gh search` exact-phrase syntax, not a stray literal; removing the
quotes would weaken filename matching. No change.

---

## Settled (not deferred — recorded for completeness)

- **C1 import-confirmation prompt** — built and shipped (a modal consent now gates `/import?gist=` and
  `/import?url=` deep links before files are written). Not deferred.
- **M15 `excerptKey`** — changed to leading-80-chars (the distinguishing content). Resolved.
- **Markdown copy-export / GitHub-issue body** — kept English by design (maintainer paste artifact).
  Resolved, not deferred.

---

## Finish Report (2026-06-14)

Four audit items originally held back for "low value / effort" reasons were reassessed against the
actual code and built; one item that is blocked on an external API capability was split into its own
focused deferred plan. With every audit finding now either fixed, accepted as won't-fix, or carried
forward in a dedicated plan, this carve-out file is fully resolved and archived.

### What shipped

- **D5 — `saropaLogCapture.replay` contributed to the Command Palette.** The command was registered in
  `src/commands-session.ts` but absent from `contributes.commands`, so it had no palette entry. A
  command entry was added to `package.json` (icon `$(debug-restart)`, title `%command.replay.title%`)
  and a translated title was added to all eleven `package.nls*.json` files. The command-list reference
  (`plans/reference/contributes-commands.md`) was regenerated; `verify-nls` reports 507 keys aligned
  across 11 files and `verify:nls-coverage` passes.

- **D2 — ANR root-cause merge no longer skips moderate ANRs.** `mergeErrorsIntoAnr` in
  `src/modules/root-cause-hints/build-hypotheses.ts` gated on `confidence === 'high'`, but the ANR
  scorer only marks `high` above score 50, so a moderate ANR (score `ROOT_CAUSE_ANR_MIN_SCORE`–50)
  bypassed the merge and its dump lines (CPU/IO/process stats) re-surfaced as duplicate `error-recent`
  bullets. The gate now keys on the `anr::risk` hypothesis alone: an ANR is the root cause at any
  confidence above the emit threshold, and its surrounding errors are consequences. The tradeoff (a
  coincident unrelated error folds under a moderate ANR) is documented in-code and bounded — no
  evidence line is dropped, and a session with no ANR leaves `error-recent` untouched.

- **D1 — log-file writes honor backpressure.** `src/modules/capture/log-session.ts` pushed every line
  to the write stream the instant it arrived; on a slow disk `write()` returns `false` and Node grows
  its internal buffer without bound (memory pressure). A new `writeBackpressured()` helper awaits the
  `'drain'` event when the buffer is full, pacing the serialized append queue to disk throughput. It
  resolves on `'error'`/`'close'` as well as `'drain'` so a stream that dies mid-await cannot hang the
  queue. Applied to the header, queued-line, and queued-raw writes; the footer was already flushed by
  `end()`.

- **D4 — webview HTML-escaping unified behind one source.** Nine webview bundles each hand-wrote an
  `escapeHtml` / `escapeHtmlText` / `escapeHtmlBasic` function and had drifted — several escaped only
  `& < >` and omitted the quote characters that matter in attribute contexts (the divergence behind
  audit L4). A new `src/ui/escape-html-script.ts` exports `escapeHtmlScript(fnName)`, which emits one
  correct `& < > " '` escaper (with null-coercion) into each isolated bundle under that bundle's
  existing function name, so call sites are unchanged and the rules can no longer diverge. The two
  host-side copies (`ai-explain-panel.ts`, `crashlytics-help-content.ts`) now import the single
  exported `escapeHtml` from `ansi.ts`. `escapeAttr` helpers were left as-is (separate concern).

### Verification

`npm run check-types` clean; `npm run compile` passes all gates (NLS parity 507 keys, `verify:l10n-keys`
2280 keys resolve, command-list reference, host/webview catalogs, dist-size 4.84 MiB). Targeted tests:
`build-hypotheses.test.ts` 23/23 (includes the rewritten moderate-ANR merge test and a new no-ANR
survival test), `log-session.test.ts` 8/8 (adds a high-volume integrity test plus deterministic
drain- and error-resolution tests for `writeBackpressured`), and the escaper consumers
`ansi.test.ts` (29), `viewer-session-panel-runtime.test.ts` (13, confirms `escapeHtmlText` resolves in
the assembled bundle), `viewer-sql-query-history-panel-script.test.ts` (28), and
`crashlytics-in-app-content.test.ts` (4) all pass.

### Known pre-existing condition

`src/ui/viewer/viewer-data-helpers-core.ts` trips the 300-line `max-lines` lint warning (it was already
over the limit on HEAD; the escaper change reduced it from 341 to 336 raw lines). Clearing it requires a
module extraction, out of scope for the escaper consolidation.

### Remaining

D3 (Crashlytics top-N paging-boundary false positives) is the only audit item still open. It is blocked
on an unpaged issue feed or a truncation/total signal the current Crashlytics read path does not expose,
not on effort, and now lives in `plans/deferred/crashlytics-paging-false-positives.md` with its shipped
tooltip-caveat mitigation recorded.
