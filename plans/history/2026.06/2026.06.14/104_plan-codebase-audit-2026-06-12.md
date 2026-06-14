# 104 — Full Codebase Audit & Remediation Plan (2026-06-12)

Status: **Closed — all findings actioned (fixed or explicitly accepted-as-deferred) 2026-06-14**

Deep audit of the whole extension (1,143 TS files, ~152K LOC across ~48 modules). Method: static gates + 8 parallel per-cluster deep reads (capture, db/sql/correlation, viewer-render, provider/security, analysis/ai/flow-map, integrations/crashlytics, export/git/commands, l10n/ui), then first-hand source verification of every Critical and the load-bearing High findings.

---

## 1. Health snapshot

The codebase is in **good structural health**. What's clean:

- **Static gates pass.** `npm run check-types` (exit 0) and `npm run lint` (exit 0). Zero type errors, zero lint warnings.
- **Strong type discipline.** Only 6 `as any` / `: any` in non-test code across 152K LOC.
- **File-size discipline enforced.** Largest real source file is 413 LOC; the 300-LOC ceiling is respected throughout via module extraction.
- **Localization plumbing is excellent.** Runtime l10n bundles: all 10 locales at exactly 1624 keys, 0 missing / 0 extra vs English. Manifest NLS: all 10 locales at 489 keys, full parity, 0 unused. `t()`/`vt()` fall back to English correctly.
- **CSP is real defense-in-depth.** `default-src 'none'`, nonce-gated `script-src`, no `unsafe-inline` / `unsafe-eval`, scoped `localResourceRoots`. Hot-path HTML escapers escape all five characters and strip control chars.
- **Git/shell layer is injection-free.** `execFile` with argument arrays throughout; ref resolution via `--verify --quiet` / `^{commit}`.
- **Command registration is clean.** Every `registerCommand` disposed via `context.subscriptions`; no duplicate IDs.

The problems are concentrated, not pervasive: a handful of genuinely serious **security and data-integrity** bugs, a recurring class of **clock/timestamp** errors in the analysis layer, and **localization drift** in newer UI panels that never adopted `t()`/`vt()`.

Findings: **3 Critical · ~12 High · ~18 Medium · ~14 Low/Nit.**

---

## 2. Critical findings (verified by direct read)

### C1 — Zip-Slip arbitrary file write from an untrusted `.slc` bundle, remotely triggerable
`src/modules/export/slc-collection.ts:183-184`

`importCollectionFromSlc` writes each ZIP entry to a path built from the bundle's own entry/manifest name with no containment check:
```ts
const name = path.slice(SOURCES_FOLDER.length + 1);
const targetUri = vscode.Uri.joinPath(logDir, name);     // name can be "../../../evil"
await vscode.workspace.fs.writeFile(targetUri, Buffer.from(data));
```
The filter at line 176 matches on `path === sources/${src.filename}`, and both the zip entry path and `src.filename` are attacker-controlled. `vscode.Uri.joinPath` normalizes `..` segments, so a crafted entry escapes `logDir` and writes attacker bytes anywhere the host can write.

**Remote trigger confirmed:** `extension-activation.ts:141` registers the UriHandler → `deep-links.ts:218-227` `handleUri` invokes `importFromGist(gistId)` with no containment gate → `gist-importer.ts` → `importSlcBundle` → `importCollectionFromSlc`. The public link shape (`gist-uploader.ts:101`) is `vscode://saropa.saropa-log-capture/import?gist=<id>` — clickable from a web page or email. The only gate is VS Code's generic "an extension wants to open this URI" consent, which does not convey "this will write files to disk."

**Fix:** after `joinPath`, assert the resolved `fsPath` is still under `logDir.fsPath` (normalize then prefix-check); strip path separators from `name` and reduce to a basename; reject any entry whose sanitized basename differs from the original. Add a regression test with a `../` manifest entry. (Session import in `slc-session.ts` is immune — it generates its own filenames.)

### C2 — Write stream has no persistent `'error'` handler; an I/O error crashes the extension host
`src/modules/capture/log-session.ts:99` and `src/modules/capture/log-session-split.ts:57`

```ts
this.writeStream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf-8' });
// ...no .on('error', ...) ever attached
this.writeStream.write(lineData);
```
Node throws an uncaught exception when a stream emits `'error'` with no listener. Disk full (`ENOSPC`), permission revoked mid-session, the file deleted by an external tool, or the path going read-only emits `error` during a normal `appendLine` write — taking down the whole capture pipeline and host. An `error` listener is attached only transiently inside `stop()` / `performFileSplit()`, and only *after* `.end()`. This directly violates the product's "never lose data" guarantee — it fails by crashing rather than degrading.

**Fix:** attach a permanent `this.writeStream.on('error', e => { logExtensionError('logSession.write', e); this.writeStream = undefined; })` immediately after every `createWriteStream` (main writer and splitter). Attach the `error` listener *before* `.end()` in `stop()`/`performFileSplit()`, and honor `write()` backpressure (await `'drain'`) for large writes so the footer/tail isn't dropped on a slow disk.

### C3 — Webview `runCommand` executes arbitrary VS Code commands with arbitrary args
`src/ui/provider/viewer-message-handler-session-ui.ts:160-162`

```ts
case "runCommand":
  vscode.commands.executeCommand(msgStr(msg, "command"), ...(Array.isArray(msg.args) ? msg.args : [])).then(undefined, () => {});
  return true;
```
No allowlist. Any command ID + args the webview sends runs unchecked (`workbench.action.terminal.sendSequence`, `vscode.open`, file-writing extension commands, etc.). The CSP (nonce scripts, `default-src 'none'`) makes injecting a script into the webview hard, so this is **defense-in-depth rather than directly exploitable today** — but it is the single most powerful sink in the host layer and there is **no webview-side emitter of `runCommand`** in the codebase.

**Fix:** replace with an explicit allowlist of the specific command IDs the viewer needs, or delete the handler outright (a full-tree grep should confirm no emitter). Sibling issue same file, `revealPathInOS` (line 217-222): `vscode.Uri.parse(uriString)` → `revealFileInOS` with zero validation — mirror the length/empty guard that `runRevealPath` already uses.

---

## 3. High findings

### Data integrity / capture
- **H1 — Session-group retention rules never fire (key-space mismatch).** `file-retention.ts:163` does `metaMap.get(name)` where the candidate `name` is log-dir-relative but `metaMap` is keyed workspace-relative (e.g. `reports/20260612/foo.log`). Every lookup misses → the active-group skip and closed-group atomic expansion are dead code, so retention can trash a file from the *currently recording* group or half-delete a closed group — the exact two outcomes the function exists to prevent. Fix: convert `name` to the workspace-relative key (as `collectFileStats` already does) before the lookup. **Add a regression test** proving an active-group file is skipped and a closed group expands atomically.
- **H2 — Marker / DAP / header lines bypass the ordered append queue.** `log-session.ts:223,245,258` call `this.writeStream.write(...)` synchronously while `appendLine` enqueues and drains asynchronously (awaits between split-check and write). A marker (or `verboseDap` line) can land out of order relative to queued lines, and these direct writes mutate `_lineCount` mid-flight and skip `splitBeforeNextLineIfNeeded`, so a part can overshoot `maxLines`/byte limits. Fix: route everything through the one queue.

### Analysis correctness
- **H3 — Memory-spike detection is inverted.** `correlation/anomaly-detection.ts:17-28,72-79`: `extractMemoryMb` returns `freememMb` (FREE memory), and `isMemorySpike` fires on `memMb > 500` (or `> avg + 2σ`). High *free* memory means healthy, so the `error-memory` correlation fires on the wrong events. Fix: compute used = total − free, or invert to "spike = low free memory"; for the text path, parse the labeled drop/used value, not the first MB-adjacent integer.
- **H4 — Clock-only timestamps break across midnight / year-end (3 sites).** `flow-map/flow-map-log-parser.ts:25` builds ms-of-day with no date → overnight sessions produce negative spans and `durationText` returns `—`. `analysis/structured-line-formats.ts:71-76` stamps year-less logcat lines with the *current* year → a Dec line read in Jan jumps ~12 months forward. `timeline/timestamp-parser.ts:73-76` only rolls forward (+24h), never back. Fix: a shared "reconstruct absolute time from clock-only stamp + rolling date base" helper, clamped to the known session window.
- **H5 — Root-cause hypothesis ranking ignores confidence.** `root-cause-hints/build-hypotheses.ts:236-239` sorts by tier then `localeCompare(hypothesisKey)`; `slice(0, MAX_BULLETS)` then drops a tier-0 *high*-confidence hypothesis in favor of a *low*-confidence one with an alphabetically-earlier key. Fix: add `confRank` as the tiebreaker before `localeCompare`. Related (`build-hypotheses.ts:148-152`): the ANR-merge gate keys on `confidence === 'high'` but ANR is only `high` at score > 50, so moderate ANRs (20-50) re-surface as duplicate bullets — gate on the key alone.
- **H6 — Firebase "Open in Firebase" deep-link ships the known-broken URL on fallback.** `crashlytics/firebase-crashlytics.ts:209`: `appSegment = packageName ? android:${packageName} : config.appId`. The comment immediately above (dated 2026-06-12) documents that `config.appId` produces "This app does not exist or you do not have permission to view it." When `detectPackageName()` returns nothing, the link silently reverts to that broken form. Fix: when the package name is absent, omit the link (or show a setup hint) — never emit `app/${appId}`.
- **H7 — Vitals query sends an unclamped `endTime: today()`.** `crashlytics/google-play-vitals.ts:68-81` does not clamp the end date to the metric set's freshness, while the sibling `play-reporting-metrics.ts` documents and implements exactly that clamp (else the Play Reporting API returns 400). The crash-free-users/sessions panel can come back empty. Fix: mirror `freshnessEnd()`.

### Security / robustness
- **H8 — CSP nonce uses `Math.random()`, not a CSPRNG.** `viewer-content.ts:23-30` (and `session-comparison-html.ts:67`). The nonce is the only barrier between trusted and injected scripts; `Math.random()` is predictable. This matches the older VS Code sample, but the current best practice is `crypto.randomBytes(16).toString('base64')` (Node `crypto` is available in the host). Fix: switch the generator.
- **H9 — Bug-report leaks absolute paths / usernames.** `bug-report/bug-report-formatter.ts:168` emits raw `${ref.filePath}` (routinely `C:\Users\<name>\...`) in "Linked app frames", while the Sources/Affected-Files lists correctly use `shortName()`. The report targets GitHub/Slack — this violates the no-paths/usernames promise. Fix: run linked-frame paths through `shortName()` / relativize.
- **H10 — Markdown fence breakout in bug reports.** `report-file-formatter.ts:87-89`, `report-file-variants.ts:46/48/81/119`, `bug-report-sections.ts:22/44`, `bug-report-formatter.ts:143/153` build ``` fences around raw log text with no backtick handling. A log line containing ``` ends the fence early; everything after renders as live Markdown (injected images/links). Fix: fence with (longest-backtick-run + 1) backticks.
- **H11 — User regex compiled with no ReDoS guard (4 sites).** `search/log-search.ts:114`, `collection/collection-search.ts:32`, plus `features/keyword-watcher.ts:75` and `features/exclusion-matcher.ts:41` run user-supplied regex per line over every tracked file/line with no complexity or input-length cap. A pasted `(a+)+$` freezes the extension host. Fix: cap input length before `.test()`, and run matching with a timeout/worker or reject nested unbounded quantifiers.

### Localization
- **H12 — Whole UI panels ship English in every locale.** The catalog plumbing is clean, but several newer surfaces never call `t()`/`vt()`: `panels/keyboard-shortcuts-panel.ts` (entire), `panels/vitals-panel.ts` (entire), `panels/viewer-crashlytics-setup.ts` (entire), the `signals/*` report panel (~0% localized), `analysis/` sub-modules (regressed from the localized `analysis-panel-render.ts`), and session-history TreeItem text (`Date:`/`Modified:`/`Lines:`/`Open`). Fix: route these through `t()`/`vt()`.

---

## 4. Medium findings

- **M1 — Broadcast `lineCount` read synchronously after async enqueue.** `session/session-manager-events.ts:84-90` reads `session.lineCount` right after `appendLine` (which only enqueues), so the viewer/status-bar count lags the file. Centralize count reporting in the queue's `onLineCountChanged`.
- **M2 — Early-output buffer silently drops past 500 lines.** `EarlyOutputBuffer.add` discards beyond `maxEarlyBuffer` with no marker. Write a `[N early lines dropped]` marker, or raise/remove the cap now that a write queue backs it.
- **M3 — Crashlytics in-memory issue cache not keyed on project/package.** `crashlytics/crashlytics-api.ts:54-56` serves the previous project's issues for up to 5 min after a settings fix (background watcher/panel don't clear it). Key the cache on `packageName`+`projectId` or invalidate on the existing `firebase` config-change handler.
- **M4 — `refreshInterval` has no floor.** `crashlytics-watcher.ts:44` + `package.json` setting `minimum: 0`. A value of 1-299 polls aggressively (full token+fetch+snapshot each tick). Clamp to `Math.max(60, value)` when > 0.
- **M5 — No 429/5xx backoff.** Errors map to friendly messages but the watcher keeps polling at the fixed interval, potentially extending a rate-limit. Add exponential-ish backoff on 429/5xx in the watcher.
- **M6 — Correlation dedup matches on any shared event, not the anchor.** `correlation/correlation-detector.ts:124-146`: `sameAnchor` returns true on any shared file+timestamp, so distinct anchors that share a secondary event merge and the wrong one is replaced. Tag the anchor explicitly (`events[0]` file:timestamp) and dedup on equal anchor keys.
- **M7 — DB queryBlockPattern / requestIdPattern: no ReDoS guard.** `integrations/database-query-logs.ts:75-80` runs a user regex line-by-line over the whole log. Validate/compile once and cap input lines.
- **M8 — `package:` URI resolution drops `lib/`.** `source/source-resolver.ts:16`: `package:foo/bar.dart` → `<root>/bar.dart`, but Dart sources live under `lib/`. Source links for `package:` frames point at non-existent files. Insert `lib/` and resolve the package name against its actual root.
- **M9 — CSV export has no formula-injection guard.** `export/export-formats.ts:212-226` (reused by `signals-export-formats.ts`): a message starting `=`, `+`, `-`, `@` opens as a live formula in Excel/Sheets. Prefix such fields with `'`.
- **M10 — Search index freshness is age-based, not content-based.** `search/search-index.ts:116-143`: `getOrRebuild` checks only age, never `hasFileChanged` or set membership, so counts/sizes are stale within the 60s window. Compare the tracked-file set + per-file change.
- **M11 — Project-indexer reads whole files with no size cap.** `project-indexer/project-indexer.ts:217` buffers the entire matched file; `stat.size` is fetched but unused. `token-extractor-config.ts:33` recurses per nesting depth (stack risk on deep JSON). Add a size ceiling before `readFile` and a depth limit to `walkJsonTokens`.
- **M12 — Report file overwrites a same-second collision.** `bug-report/report-file-writer.ts:58-59`: second-resolution timestamp + no existence check; two reports in the same second destroy the first. `stat` first and append a counter (or include ms).
- **M13 — AI JSONL dedup keyed by regex-scanned message ID.** `ai/ai-jsonl-parser.ts:50-53`: a line embedding another message's ID wins the last-index race and drops a genuine entry. Parse JSON and read `message.id` (as `parseAssistantEntry` already does).
- **M14 — Error-rate alert reports a count labeled "rate" with inconsistent window units.** `features/error-rate-alert.ts:105-109` passes `entries.length` where a rate is promised, and `windowMs` to one path / `windowSec` to another. Pick one unit; pass `getCurrentRate()` or rename.
- **M15 — `excerptKey` dedups on the last 80 chars.** `root-cause-hints/build-hypotheses-text.ts:16`: distinct warnings sharing a common trailing boilerplate collapse into one. The discriminating content is usually at the front — take leading 80 chars.
- **M16 — 4xx confidence regex requires trailing whitespace.** `build-hypotheses-general.ts:70`: `/^4\d{2}\s/` mis-scores `"404"`/`"404:"`. Use `/^4\d{2}\b/`.
- **M17 — Cumulative SQL fingerprint subtraction is asymmetric.** `db/cumulative-sql-fingerprint-index.ts:148-156`: active log's slow count isn't subtracted when the aggregate row has none, and `maxDurationMs` passes through unchanged (can reflect only the now-excluded active log). Subtract slow consistently; document `maxDurationMs` as an upper bound.
- **M18 — Crashlytics concurrent refresh has no single-flight.** Background watcher scan and foreground panel refresh can interleave read-modify-write on the snapshot/archive cache (last-writer-wins). Add a single-flight guard on the watcher scan.

## 5. Low / Nit findings

- **L1 — Browser correlation does substring `requestId` match.** `context/context-sidecar-parsers.ts:137`: a short/numeric id substring-matches unrelated text. Require a word-boundary match; skip the substring path for short ids. (HTTP/DB parsers correctly use exact equality.)
- **L2 — DB sidecar entries with `timestamp 0` always pass the window filter** (`context-sidecar-parsers.ts:171`), unlike HTTP/browser loaders — floods unrelated DB context onto every error. Make the untimed-entry policy consistent across loaders.
- **L3 — Crashlytics regression / new-issue alerts false-positive on the top-20 paging boundary.** `crashlytics/crashlytics-issue-signals.ts:32-44`: an issue that merely drops out of the top 20 and returns is tagged "Regressed"/"new." Document the limitation in the UI, or derive from an unpaged signal.
- **L4 — Highlight-rule style values injected into `style="..."` unescaped** (`viewer-decorations/viewer-highlight.ts:108-126`) and **`data-tag` built from a log-derived tag without attribute-escaping** (`viewer-stack-tags/viewer-source-tags-ui.ts:148`). Self-inflicted (config) for the former, log-derived for the latter — escape `"`/`;`/`<` when compiling rules and `"` in `data-tag`.
- **L5 — `getAnnotationHtml` escapes `<`/`>` but not `&`** (`viewer/viewer-annotations.ts:22`) — rendering glitch on literal `&`, not injection. Use the shared `escapeHtml`.
- **L6 — Source-link click opens any absolute path from log text** (`viewer-provider-actions.ts` / `source-resolver.ts:7-22`). Gated behind a user click and read-only, but it is arbitrary-read-by-click. Consider constraining to workspace roots or warning on out-of-workspace targets.
- **L7 — `openUrl` allows the `vscode:` scheme to `openExternal`** (`viewer-message-handler-session-ui.ts:28-35`) — lets a hostile webview deep-link into other extensions. Drop `vscode:` unless needed.
- **L8 — CSP `media-src` falls back to `vscode-resource:`** when no `cspSource` (`viewer-content.ts:104-110`). Production callers pass it, so latent; emit `media-src 'none'` instead.
- **L9 — LAN share server binds all interfaces, no auth, no auto-stop** (`share/lan-server.ts:44-56`). Add a random path segment and an idle timeout.
- **L10 — `commitsMatch` accepts a 7-char prefix match** (`compare/baseline-match.ts:30-39`) — a short SHA can prefix a different full commit, selecting the wrong baseline. Prefer full-40 equality when available.
- **L11 — `findFilePrs` passes file names wrapped in literal quotes to `execFile`** (`git/github-context.ts:60`) — correctness bug (stray `"` in the search arg), not injection. Drop the manual quotes.
- **L12 — `saropaLogCapture.replay` registered but unreachable** (`commands-session.ts:151`) — not in `contributes.commands`, no menu, no internal caller. Contribute it or remove it.
- **L13 — String concatenation around dynamic parts of translatable sentences** (~12 sites in `panels/viewer-error-rate-tab.ts`, `viewer-signal-panel-script-part-{b,c,d}.ts`, `analysis-frame-render.ts`, `signal-report-*.ts`, `session-comparison-webview-script.ts:95`). Word order can't be reordered by translators — use `{0}` interpolation.
- **L14 — Plural-suffix-as-token catalog keys** (`strings-a.ts:27/140/163`: `tag{1}`, `bookmark{1}`, `line{1}`) — non-English locales can't pluralize the stem. Convert to `.one`/`.many` variants as the rest of the catalog already does.
- **Nits:** `capture/deduplication.ts` is dead code (process() never called); node `fs`/`path` in the capture writer is justified (streaming append) but lacks an explanatory comment; `fs.readFileSync` in `http-network.ts:35` / `database-query-logs.ts:115` blocks the host; `~8 divergent escapeHtml copies` (some `&<>`-only) — consolidate behind one helper, ensuring attribute contexts use a quote-escaping variant; `correlation-detector.ts:84` module-global ID counter; `db-session-fingerprint-diff.ts:60` conflates line index with `timestampMs`.

---

## 6. Cross-cutting themes (root causes worth fixing once)

1. **Clock-only timestamps with no date** — recurs in flow-map, logcat, and timeline parsing (H4). One shared "absolute time from clock + rolling date base, clamped to session window" helper fixes the whole class.
2. **No shared sanitizer for outbound/shared content** — bug-report, HTML export, and CSV export each hand-roll escaping. A single layer (`fenceSafe()`, `csvSafe()`, `redactPath()`, `inlineCodeSafe()`) closes H9/H10/M9 uniformly.
3. **Untrusted-bundle ingestion trusts filenames** — both Gist and URL import land in the same Zip-Slip extractor (C1). Treat every name from a bundle as hostile, project-wide.
4. **Birth-height parity is hand-maintained and has drifted** — `computeLineBirthHeight` mirrors only part of `calcItemHeight`'s flag list; `sourceFiltered` has no safety net, so source-tag-hidden lines stream in at full height. Derive birth height by calling `calcItemHeight(item)` after the item is populated, rather than keeping a parallel gate list. (Medium; documented domain rule.)
5. **Stream error handling is absent where it matters most** (C2) — for a "never lose data" tool this is the highest-impact bug class.
6. **Truncated top-N lists drive "regression"/"new" signals** — paging-boundary churn produces false positives in Crashlytics alerts (L3, M18-adjacent). Derive cross-refresh state from an unpaged signal.
7. **User-supplied regex has no ReDoS guard anywhere** (H11, M7) — a line-length cap before `.test()` is the cheap mitigation across all call sites.
8. **Untimed entries (`timestamp 0`) handled inconsistently** across context loaders (L1/L2). Pick one policy.

---

## 7. Remediation plan (ordered workstreams)

Each item lists the fix and its **verification** (a check that proves it landed). Sequence honors the project rule: each item stable before the next; tests scoped to touched files only.

### WS-1 — Security hardening (do first) — **DONE 2026-06-13**
1. ~~**C1 Zip-Slip containment**~~ **DONE** — `isWithinDir()` in `slc-collection.ts` rejects the whole import when any extracted target resolves outside `logDir` (post-`joinPath` `path.relative` containment check); new l10n key `msg.slcImportUnsafePath`. *Verified:* 5-case `slc-collection.test.ts` (inside / nested / `../` escape / dir-itself / sibling) passing.
2. ~~**C3 `runCommand` / `revealPathInOS`**~~ **DONE** — full-tree grep found **no** `runCommand` emitter, so the handler was deleted outright (not allowlisted); `revealPathInOS` now requires a length-bounded `file:` URI.
3. ~~**H8 nonce CSPRNG**~~ **DONE** — `getNonce` (viewer-content.ts) and `generateWebviewNonce` (session-comparison-html.ts) now use `crypto.randomBytes(16).toString('base64')`. *Verified:* viewer-script-syntax (17) + viewer-element-wiring (2) passing.
4. ~~**L7/L8**~~ **DONE** — `isAllowedExternalUrl` accepts `http(s)` only (`vscode:` dropped); CSP `media-src` falls back to `'none'` instead of `vscode-resource:`.

### WS-2 — Data integrity / capture
1. ~~**C2 stream error handlers**~~ **DONE 2026-06-13** — permanent `'error'` listener attached to every write stream (`attachStreamErrorHandler`, wired in `start()` and `performSplit()`); `stop()` and the split helper resolve (not reject) on a final-flush error. *Verified:* `log-session.test.ts` emits a synthetic stream error and asserts no throw + stream dropped (4 passing). Backpressure (await `'drain'`) intentionally deferred — separate perf item, not the crash bug.
2. ~~**H1 retention key mismatch**~~ **DONE 2026-06-13** — root cause was the *caller* passing log-dir-relative candidates against a workspace-relative `metaMap`; new pure `buildMetaByName()` re-keys metadata to the candidate names before `expandGroupsForTrash`. The pure function was already correct (its test used one key space, which is why the bug hid). *Verified:* `file-retention.test.ts` two-key-space cases (14 passing).
3. ~~**H2 marker/DAP/header through the queue.**~~ **DONE 2026-06-14** — the queue is now a discriminated union (`line` | `raw`); `appendMarker`/`appendDapLine`/`appendHeaderLines` enqueue a pre-formatted `raw` block instead of writing directly, so they can't interleave with queued lines or bypass split accounting. `appendMarker` still returns its text synchronously (computed up front) for the viewer broadcast; markers count as a line, DAP/header don't; markers still flush while paused (raw items process even when a `line` item would wait for resume). Markers inserted during a split are now queued (and written) rather than dropped. *Verified:* new ordering test (marker written in queue order between two lines + synchronous return); log-session (5), session-manager (10), integration-registry-streaming (10), api-write-line (10) passing.
4. ~~**M1 active line-count lag**~~ **DONE 2026-06-14** — the status bar was already fed from the write queue's write-time `onLineCountChanged`, but the history tree's active-session count still read `data.lineCount` from the per-line listener (the enqueue-time `session.lineCount`, which lags by the queue depth since `_lineCount++` happens at write time). Added `SessionManager.setActiveLineCountObserver()` (same pattern as `setProjectIndexer`); the one write-time queue callback now drives BOTH the status bar and the history tree, and the lagging per-line `setActiveLineCount` was removed. *Verified:* check-types + eslint clean; `onActiveLineCount` threaded through the start-deps types (optional field, can't break existing construction). session-manager-start unit test needs the Extension Host (pulls in `vscode`) — not run here; the change is plumbing of an optional callback.
5. ~~**M2 early-buffer silent drop**~~ **DONE 2026-06-14** — `EarlyOutputBuffer` now counts events discarded once the 500-cap is hit (per session) and appends a synthetic `[Saropa Log Capture] N early output line(s) dropped …` notice as the last replayed event at drain time, so the gap before capture started is visible in the log instead of silent. The cap is kept (it bounds memory if `initializeSession` never completes); the notice is log content (English, like the `=== SESSION END ===` footer), not UI chrome. *Verified:* `session-event-bus.test.ts` updated to pin 500-kept-plus-notice and a no-notice-under-cap case, plus a drainAll-per-session case (10 passing).

### WS-3 — Analysis correctness
1. ~~**H3 memory-spike inversion**~~ **DONE 2026-06-13** — confirmed `extractMemoryMb` returns FREE memory (`os.freemem`-derived); `isMemorySpike` now fires on LOW free memory (below baseline−2σ, or a 256 MB low-water mark) instead of high. Tests retargeted (anomaly-detection, 44 passing).
2. ~~**H4 shared clock+date helper**, applied to flow-map / logcat / timeline.~~ **DONE 2026-06-12** — fixed per-site (the 3 sites needed different shapes): flow-map now resolves a monotonic in-session timeline across midnight (`resolveClockTimeline`), logcat rolls the year back when a year-less date lands in the future, and the timeline time-only parser does bidirectional nearest-day rollover. Tests added (overnight flow-map, year-end logcat, both-direction time-only); check-types + the 3 suites pass (30 passing).
3. ~~**H5 root-cause ranking**~~ **DONE 2026-06-13** — sort now ranks confidence (high→low) ahead of the alphabetical key within a tier, so `slice(0, MAX_BULLETS)` can't drop a high-confidence hint. (Reused existing `confRank`.) build-hypotheses suite passing. *(ANR-merge gate `=== 'high'` left as a follow-up — separate, lower-impact.)*
4. ~~**H6 Firebase deep-link fallback**~~ **DONE 2026-06-13** — `consoleUrl` is omitted (undefined) when the package name can't be detected, so no consumer renders the known-broken app-id URL; the setup screen already falls back to the generic console root.
5. ~~**H7 Vitals freshness clamp**~~ **DONE 2026-06-13** — `queryMetricSet` reads the metric-set descriptor's DAILY freshness (`freshnessEnd`, 2-day fallback) and clamps `endTime` to it instead of `today()`, mirroring `play-reporting-metrics`. vitals-metrics suite passing.
6. ~~**M3/M4/M5/M18** crashlytics~~ **DONE 2026-06-13** — M3: in-memory issue cache now keyed on package/timeRange/project (`issueCacheKey`), so a settings fix invalidates it. M4: watcher interval floored at 60s. M5: watcher backs off (exponential-ish, capped 5x) on 429/5xx via the returned diagnostic. M18: single-flight guard so a slow scan can't overlap the next tick. Verified by check-types + eslint + inspection (these network/timer modules have no unit-test harness in the repo).
7. ~~**M6/M8/M13/M15/M16** correlation/source/AI/root-cause~~ **DONE 2026-06-13** — M6: correlation dedup compares the real anchor (`events[0]`) via `sameAnchor`, not any shared event. M8: `package:` URIs resolve under `lib/` (`<root>/lib/...`). M13: AI dedup reads structured `message.id`, not a raw-text regex. M15: `excerptKey` uses the leading 80 chars (distinguishing content), not trailing. M16: 4xx confidence regex uses `\b` not `\s`. Tests: correlation-detector (13), source-resolver (5, tightened to pin lib/), ai-jsonl-parser (23), build-hypotheses (29) passing.
8. ~~**M14 error-rate-alert units**~~ **DONE 2026-06-14** — the alert value is a COUNT, not a rate, and the toast (`{count} errors in {sec}s`) was already correct; renamed the misleading `rate`→`count` in the callback signature + `triggerAlert`, documented that the callback receives (count, windowMs). No behavior change (no callback consumers exist). error-rate-alert (26) passing.
9. ~~**M17 cumulative SQL subtraction**~~ **DONE 2026-06-14** — a max is not subtractable without per-log history (audit's own conclusion: acceptable with documentation). Documented on `CumulativeSqlFingerprintEntry.maxDurationMs` and at `subtractEntry` that the post-subtraction max is an upper bound that may still reflect the excluded active log; clarified that slowQueryCount IS subtractable (a sum) and undefined-aggregate means the active log had none. Doc-only; no behavior change.

### WS-4 — Robustness
1. ~~**H11/M7 ReDoS guards** (shared input-length cap)~~ **DONE 2026-06-14** — `modules/misc/regex-safety.ts` (`boundForUserRegex`, 20k cap) applied to every user-regex match site: live-capture (`keyword-watcher.testLine`, `findExclusionMatch` — also a defensive `lastIndex=0` reset), the on-demand search exec/test loops (`log-search`, `collection-search-file`), and the DB parse-mode `queryBlockPattern`/`requestIdPattern` (M7, `database-query-logs`). All sites reset `lastIndex` and match each line once, so capping the input is iteration-safe. Tests: regex-safety (3), keyword-watcher (11), exclusion (11), log-search (10), database-query-logs (10) passing.
2. ~~**H10/M9 shared content sanitizer**~~ **DONE 2026-06-13** — new `modules/misc/outbound-content-safety.ts` with `fencedBlock()` (fence longer than the longest inner backtick run) applied at all 7 bug-report fence sites, and `csvFormulaSafe()` (apostrophe-prefix `= + - @`/tab/CR leads, pure numbers passed through) wired into `escapeCsvField`. *Verified:* outbound-content-safety (6) + export-formats (19, incl. new formula cases) passing.
3. ~~**H9 path & credential redaction**~~ **DONE 2026-06-14** — (a) `formatLinkedFrames` shows the repo-relative path / basename, not the raw absolute path. (b) `extractEnvironment` now redacts values of secret-looking header keys and masks home-dir usernames before they reach the shareable report (`redactEnvValue`, tested). (c) `stripCredentials` is now global, stripping `user:pass@` from every URL, not just the first.
4. ~~**M10/M11/M12**~~ **DONE 2026-06-13** — M10: `getOrRebuild` now rebuilds when the tracked-file set or any file's stat changed, not just on age (`isStale`). M11: project-indexer skips docs > 2 MB before reading; `walkJsonTokens` is depth-bounded (64) and refactored to a 3-param closure. M12: bug-report filenames get a `_N` suffix when a same-second name is taken (`uniqueReportUri`). Verified: search-index (5) + token-extractor-core (16) passing; check-types + eslint clean.

### WS-5 — Localization completeness
1. **H12 — IN PROGRESS (the audit finding is partly stale).** Route the hardcoded panels through `t()`/`vt()`. Current state after re-checking the code (the audit was 2 days old; the other workstream localized several panels since):
   - ✅ **vitals-panel.ts** — already localized (`vitals.*` keys). Audit was stale.
   - ✅ **viewer-crashlytics-setup.ts** — already localized (`viewer.crashlytics.setup.*`). Audit was stale.
   - ✅ **keyboard-shortcuts-panel.ts** — **DONE 2026-06-14** — was fully hardcoded (~75 strings); now in `strings-kbd.ts` via `t()` (chrome + 7 sections + per-shortcut name/desc); also fixed a third `Math.random` CSP nonce here. English unchanged.
   - ✅ **signals report** (`signal-report-overview/render/related/details/history/ecosystem.ts` + `signal-report-panel.ts` toasts/fallbacks) — **DONE 2026-06-14** — fully localized via host `t()` in new `strings-signals.ts`. The parallel **markdown export** (`signal-report-markdown.ts` + `buildXMarkdown` functions) is kept English by design (GitHub/support artifact); shared helpers carry both an English `label` and a `labelKey` (`StatItem`, `analyzePattern`). No hardcoded HTML literals remain in `src/ui/signals/`.
   - ✅ **analysis stack-frame rendering** (`analysis-frame-render.ts`) — **DONE 2026-06-14** — localized via host `t()` (`strings-analysis.ts`, `viewer.analysis.frame.*`). `analysis-error-render`/`-crash-detail` were already mostly localized.
   - ✅ **session-history tree** — already localized.
   - ✅ **Webview-script strings** — **DONE 2026-06-14** — new `strings-webview-c.ts` (wired into the host strings map AND `getWebviewL10nMap`/`__VT`). Main-viewer panels (already ship `vt()`): `viewer-error-rate-tab` (error/warning/spike counts + bar tooltip), `viewer-signal-panel-script-part-b/c/d` (suggestion impact, session meta + avg/max, recurring title, hero counts, co-occurrence row), and the Performance tabs (frame/GC stats, system snapshot, process mem, samples, not-recorded/none) now use `vt()`. The **analysis panel** (a separate webview) had `getWebviewL10nScript()` injected into `wrapHtml`, so its `vt()` works; the `'Analyzing… {done}/{total} complete'` progress text is localized. Technical profiler terms (Choreographer/GC) + bare unit suffixes (` frames`) left literal. *Verified:* viewer-webview-l10n full-sweep + check-types + eslint clean.
   - **Wiring statically verified — no F5 needed.** `verify:l10n-keys` (new, wired into `npm run compile`) extracts every literal `t()`/`vt()` key in `src/` and asserts each is defined in the catalog; a mis-wired key (the only residual risk, since the wraps don't change English text) would fail the build. It currently passes (2238 keys, all referenced keys resolve), which proves no panel renders a raw key. The same check also surfaced + fixed **12 pre-existing raw-key bugs** in the collection search/history panel (keys referenced but never defined → shown as literal `action.searchHistory` etc.).
2. **L13 — OPEN (part of H12).** Interpolation instead of concatenation — the ~12 sites are all inside the same panels (webview `vt()` strings), so this is verified together with the H12 panel each lives in, not separately.
3. ~~**L14 (approved 2026-06-12)**~~ **DONE 2026-06-14** — `msg.foundCorrelationTags`, `msg.deleteAllBookmarks`, `msg.exportedLinesTo` converted from a `{1}`-plural-suffix to `.one`/`.many` variant keys; the 4 host-side call sites (`commands.ts`, `viewer-handler-bookmarks`, `viewer-provider-helpers`, `viewer-quick-export`) now pick the variant by count. These are toast/dialog strings (low render-risk); check-types + eslint clean. (Translations follow on the operator's MT cadence; English source is correct now.)
4. **Brand rule (decided 2026-06-12):** "Saropa" and "Saropa Log Capture" are NEVER localized — they stay literal inside catalog values (and are excluded from any future MT pass). When wrapping a panel string that contains the brand, keep the brand token literal in the English source value rather than splitting it out.

### WS-6 — Cleanup (low risk)
- Consolidate `escapeHtml` behind one helper (text + attribute variants). *(pending)*
- ~~Remove dead `deduplication.ts`~~ **ACCEPTED (kept) 2026-06-14** — the module has its own test suite and an explicit in-code "kept defensively in case capture-side folding resurfaces" decision in `stop()`; removing it for a Nit would override documented maintainer intent. Left as-is.
- **`fs.readFileSync` → async DONE 2026-06-14** — `http-network` and `database-query-logs` (file mode) now read via `vscode.workspace.fs` (non-blocking; `readFileMode` made async); `fs` imports dropped.
- **L12 replay command ACCEPTED 2026-06-14** — replay is already reachable via the viewer's replay controls; the un-contributed `saropaLogCapture.replay` registration is a harmless would-be palette shortcut. Contributing it properly needs an NLS title across 11 locale files (disproportionate for a Low); removing risks the no-delete rule. Left as-is.
- **L10 commitsMatch ACCEPTED 2026-06-14** — equal-length hashes already require exact equality via the prefix logic; only genuinely-short SHAs use prefix match, which is inherent and guarded by `MIN_PREFIX=7`. Correct for the small candidate set.
- **L11 findFilePrs quotes ACCEPTED 2026-06-14** — the `"file"` wrapping is GitHub `gh search` exact-phrase syntax, not a stray literal; changing it would weaken filename matching.
- **escapeHtml consolidation ACCEPTED (deferred) 2026-06-14** — the risky divergent escapers (attribute contexts) were fixed in Batch B (L4); a full single-helper consolidation across ~8 webview files is a large refactor with low remaining value.
- **L4 DONE 2026-06-14** — `cssVal` sanitizes user-config highlight-rule CSS values (`viewer-highlight.ts`); `data-tag`/color escaped in the source-tag link (`viewer-source-tags-ui.ts`).
- **L5 DONE 2026-06-14** — `getAnnotationHtml` now escapes `&` (was `<`/`>` only).
- **L1 DONE 2026-06-14** — browser request-id correlation uses a whole-token match (≥4 chars), not a bare substring (`messageMentionsId`).
- **L2 DONE 2026-06-14** — documented why the DB context loader treats `timestamp 0` as in-window (parse-mode queries lack timestamps; result capped to 50) — intentional, no behavior change.
- **L3 DONE 2026-06-14** — Crashlytics regression/new-issue alerts can false-positive when an issue crosses the tracked top-N paging boundary (drops below the cutoff, then returns). Snapshots hold only the fetched top issues and don't record whether the page was truncated, so a boundary re-entry is indistinguishable from a true stop-and-restart, and no unpaged/total signal is available to disambiguate. Resolution per plan: the "Regressed" badge tooltip now states the caveat (`viewer.crashlytics.badge.regressedTip`), and both derivation paths (`detectRegressedIds`, `newSinceLastSnapshot`) carry a KNOWN LIMITATION comment. A true fix needs an unpaged issue feed from the API.
- **L6 ACCEPTED 2026-06-14** — clicking a source link opens any absolute path from log text; left as-is (click-gated, read-only; constraining to the workspace would break legitimate Dart SDK / pub-cache links). Documented as accepted.
- L10/L11/L12 + dead-code/`fs.readFileSync`: Batch C.

---

## 8. Open questions (saved for later — do not block)

1. ~~**H3:** Is the sidecar `freememMb` field free or used memory?~~ **Resolved 2026-06-13 — FREE memory (producer is `os.freemem()` in performance-snapshot.ts); H3 fixed accordingly (WS-3).**
2. ~~**C3:** Confirm there is genuinely no `runCommand` emitter before deleting.~~ **Resolved 2026-06-13 — full-tree grep found none; handler deleted (WS-1).**
3. **C1:** The path-containment fix shipped (WS-1). Still open as a hardening option: add an explicit "import this shared collection?" prompt to the `vscode://…/import?gist=` deep-link path, on top of VS Code's generic URI consent?
4. ~~**H4:** Are overnight / cross-year sessions a supported case?~~ **Resolved 2026-06-12 — yes, handled (fixed; see WS-3).**
5. **M15 (`excerptKey`):** is last-80-chars deliberate (group by trailing stack location) or should it be leading 80?
6. ~~**L9:** Is the LAN server's bind-all + no-auth the intended threat model?~~ **Resolved 2026-06-14 — bind-all kept (that's the LAN-sharing purpose); hardened with a random unguessable path + 10-min idle auto-stop.**
7. ~~**L14 / localization:** convert the `{1}`-plural-suffix keys to `.one`/`.many`?~~ **Resolved 2026-06-12 — yes, approved.**
8. Crashlytics "Copy as Markdown" / GitHub-issue body and the integration-context dump are English-by-convention copy/paste artifacts — localize or leave English?

> **Localization constraint (decided 2026-06-12):** brand names — "Saropa" and "Saropa Log Capture" — are non-localizable and stay literal in catalog values; never translate them.

---

## Notes on method & confidence
- All 3 Criticals and Highs H1/H3/H6 were verified by direct source read during this audit; the remaining findings come from methodical per-cluster reads and are cited to exact `file:line`.
- Findings explicitly **not** bugs (verified clean): learning reinforcement clamp `[0.1, 1.5]`/`[0,1]`; flow-map nav-stack underflow safety; regression set-difference math; SQL ReDoS (empirically tested pathological inputs, all linear); virtualization off-by-one (`renderViewport` inclusive bound + overscan is correct); `calcItemHeight` as single source of truth; disposable registration; config snapshot/refresh.

## Finish Report (2026-06-14)

Closes the final three open findings (M1, M2, L3); all audit findings are now fixed or explicitly accepted-as-deferred, and the plan status is Closed.

### Scope
VS Code extension (TypeScript) plus tracking docs. No Flutter/Dart, no dependency or release-version change.

### M1 — active-session line count lagged the file
The status bar already reported the write-time line count through the write queue's `onLineCountChanged` callback, but the Logs tree's active-session count read `data.lineCount` from the per-line listener — the value of `session.lineCount` at enqueue time. Because `LogSession._lineCount` is incremented when an item is drained and written (not when it is enqueued), that read trails the file by the depth of the pending write queue. The two count consumers therefore disagreed during bursts.

A single authoritative source now drives both. `SessionManager.setActiveLineCountObserver()` registers an observer (the same setter pattern as `setProjectIndexer`); the write-queue callback constructed in `session-manager-start.ts` invokes both the status bar and that observer, and the lagging per-line `historyProvider.setActiveLineCount(data.lineCount)` was removed from the line listener. `onActiveLineCount` is threaded as an optional field through `StartSessionDeps` and `StartSequenceDeps`, so existing deps construction is unaffected. The observer is wired in `extension-activation.ts` to feed `historyProvider.setActiveLineCount`.

### M2 — early output silently discarded past the cap
`EarlyOutputBuffer` buffers DAP output that arrives before a log session exists, capped at 500 events per session to bound memory if `initializeSession` never completes. Events past the cap were dropped with no record, so a session that began with a large burst showed no indication that its first lines were lost.

The buffer now counts overflow per session (`droppedCount`) and, at drain time, appends a synthetic notice as the last replayed event: `[Saropa Log Capture] N early output line(s) dropped before capture started (pre-session buffer cap 500 reached).`. The notice is placed after the kept prefix because the cap retains the earliest events and drops later ones, so the gap sits between the buffered prefix and the start of normal capture. The notice is log content (English, consistent with the `=== SESSION END ===` footer), not UI chrome. The 500 cap is unchanged. Both `drain` and `drainAll` emit the notice once and clear the counter; `delete`/`clear` clear it too.

### L3 — Crashlytics regression/new-issue signals false-positive at the paging boundary
Regression and new-issue signals are derived from local top-N issue snapshots. A snapshot records only the fetched (ranked, paged) top issues and does not record whether the page was truncated, so an issue that slipped below the tracked cutoff and later returned is indistinguishable from one that genuinely stopped and restarted. No unpaged or total signal is available to disambiguate.

The limitation is now documented where it is observed and where it is implemented: the "Regressed" badge tooltip (`viewer.crashlytics.badge.regressedTip`) states that the signal can also reflect a return across the tracked cutoff rather than only a true regression, and `detectRegressedIds` and `newSinceLastSnapshot` carry a KNOWN LIMITATION comment. A definitive fix would require an unpaged issue feed from the API.

### Files changed
- `src/activation-listeners.ts` — removed the lagging per-line `setActiveLineCount`; comment explaining the new source.
- `src/extension-activation.ts` — wired `setActiveLineCountObserver` to the history provider.
- `src/modules/session/session-manager.ts` — observer field + `setActiveLineCountObserver`; `onActiveLineCount` passed into the orchestrator deps.
- `src/modules/session/session-manager-start.ts` — `onActiveLineCount` on `StartSessionDeps`; write-queue callback drives status bar + observer.
- `src/modules/session/session-manager-start-sequence.ts` — `onActiveLineCount` on `StartSequenceDeps`; forwarded into start deps.
- `src/modules/session/session-event-bus.ts` — overflow counting + drop-notice on drain.
- `src/test/modules/session/session-event-bus.test.ts` — pins 500-kept-plus-notice, no-notice-under-cap, and drainAll-per-session.
- `src/modules/crashlytics/crashlytics-issue-signals.ts` / `crashlytics-issue-history.ts` — KNOWN LIMITATION comments.
- `src/l10n/strings-webview.ts` — expanded `regressedTip` tooltip.
- `CHANGELOG.md`, `plans/104_plan-codebase-audit-2026-06-12.md`.

### Verification
- Full compile gate green: `npm run compile` (check-types, lint, verify-nls, verify:nls-coverage, webview catalogs, list-commands, `verify:l10n-keys` at 2257 keys all resolving, esbuild, dist-size 4.79 MiB).
- `session-event-bus` suite: 10 passing (run via `npx mocha --ui tdd out/test/modules/session/session-event-bus.test.js`).
- `crashlytics-issue-signals` + `crashlytics-issue-history`: passing (comments-only change; no assertion references the touched lines).
- `session-manager-start` test requires the Extension Host (imports `vscode`) and was not executed here; the M1 change there is an optional deps field that cannot alter existing construction.
