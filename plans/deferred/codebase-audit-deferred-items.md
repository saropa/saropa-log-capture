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
`src/modules/crashlytics/crashlytics-issue-signals.ts` (`detectRegressedIds`, `newSinceLastSnapshot`)

"Regressed" / "new issue" alerts can false-positive when an issue crosses the tracked top-N paging
boundary — it drops below the cutoff, then returns, which is indistinguishable from a true
stop-and-restart because snapshots hold only the fetched top issues and don't record whether the page
was truncated. Shipped mitigation: the "Regressed" badge tooltip states the caveat
(`viewer.crashlytics.badge.regressedTip`) and both derivation paths carry a KNOWN LIMITATION comment.
A true fix needs an **unpaged issue feed (or a total/truncation signal) from the API**, which the
current Crashlytics read path does not expose — hence still deferred (it is blocked on an API
capability, not on effort).

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
