# Codebase Audit — Deferred & Accepted Items

Carved out of the full codebase audit so the consciously-not-done items are not lost when the audit
itself was closed and archived. Every other audit finding (3 Critical · ~12 High · ~18 Medium · ~14
Low) was fixed; the items below are the ones deliberately deferred to future work or accepted as
won't-fix with a recorded rationale.

Source (closed + archived): `plans/history/2026.06/2026.06.14/104_plan-codebase-audit-2026-06-12.md`.

---

## Deferred — future work that may be revisited

### D1 — Write-stream backpressure (`await 'drain'`) — perf, capture
`src/modules/capture/log-session.ts` (and `log-session-split.ts`)

The crash-class bug (no persistent `'error'` listener) was fixed (audit C2). Still deferred as a
separate performance item: large writes don't honor `write()` backpressure, so on a slow disk a big
footer/tail block could be dropped or buffer without awaiting `'drain'`. Add backpressure handling
(await the `'drain'` event) for large writes. Low urgency — the data-loss-on-error path is already
closed; this is throughput hygiene under disk pressure.

### D2 — ANR-merge gate keys on `confidence === 'high'` — duplicate root-cause bullets
`src/modules/root-cause-hints/build-hypotheses.ts:148-152`

The ANR-merge gate keys on `confidence === 'high'`, but an ANR hypothesis is only `high` above score
50, so moderate ANRs (score 20–50) bypass the merge and re-surface as duplicate bullets. Gate the
merge on the hypothesis key alone (not the confidence). Lower-impact follow-up split off from the
H5 root-cause-ranking fix (which shipped).

### D3 — Crashlytics regression / new-issue false positives at the top-N paging boundary
`src/modules/crashlytics/crashlytics-issue-signals.ts` (`detectRegressedIds`, `newSinceLastSnapshot`)

"Regressed" / "new issue" alerts can false-positive when an issue crosses the tracked top-N paging
boundary — it drops below the cutoff, then returns, which is indistinguishable from a true
stop-and-restart because snapshots hold only the fetched top issues and don't record whether the page
was truncated. Shipped mitigation: the "Regressed" badge tooltip states the caveat
(`viewer.crashlytics.badge.regressedTip`) and both derivation paths carry a KNOWN LIMITATION comment.
A true fix needs an **unpaged issue feed (or a total/truncation signal) from the API**, which the
current Crashlytics read path does not expose — hence deferred.

### D4 — Consolidate the divergent `escapeHtml` copies behind one helper
~8 webview files under `src/ui/`

There are several near-duplicate `escapeHtml` implementations across the webview render files, some
escaping only `&<>` and some also `"`. The genuinely risky divergence — attribute-context escapers
that omitted quote-escaping — was already fixed (audit L4). What remains is a full consolidation
behind a single helper with explicit text vs attribute variants. Deferred: a large mechanical refactor
touching many files for low remaining correctness value now that the unsafe cases are closed.

### D5 — Contribute the `saropaLogCapture.replay` command (or remove it)
`src/modules/commands/commands-session.ts` (registration; no `contributes.commands` entry)

`saropaLogCapture.replay` is registered but not contributed, so it has no command-palette entry and no
menu. Replay is already reachable via the viewer's replay controls, so it is not dead — just an
un-surfaced palette shortcut. Contributing it properly requires an NLS command title added across all
11 `package.nls*.json` locale files, which is disproportionate for a Low. Deferred: either contribute
it with the locale titles, or remove the unreachable registration (the no-delete convention argues for
contributing rather than removing).

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
