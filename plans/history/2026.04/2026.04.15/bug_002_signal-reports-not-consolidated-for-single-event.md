# Bug 002 — Signal Reports Not Consolidated for Single Event

## Status: Fix Ready

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Problem

When a single underlying event (e.g., one ANR from another app on the emulator) produces multiple log lines at error level, the signals system generates 3+ separate signal report tabs instead of consolidating them into one report. The user has to open and read each report only to discover they all describe the same event from different angles.

Observed in `saropa_bangers` session `20260415_224655_saropa_bangers.log` — a single ANR in `com.saropamobile.app` (PID 3935, not even the target app) produced three separate signal reports:

1. **`anr-risk`** — "ANR risk: high (score 100) — 4 ANR keywords, 12 Choreographer warnings, 12 Dropped frames, 12 Jank indicators"
2. **`error-recent`** — "Error: 04-15 21:49:55.788 ... 74% 3935/com.saropamobile.app: 23% user + 51% kernel / faults: 727 minor 167 major"
3. **`error-recent`** — "Error: 04-15 21:49:55.788 ... full avg10=0.00 avg60=0.01 avg300=0.00 total=5846171"

Reports 2 and 3 are individual lines from the same ANR CPU/IO pressure dump at timestamp `21:49:55.788`. All three reports share identical "Other Signals" and "Cross-Session History" sections, making the redundancy obvious.

## Environment (if relevant)

- Extension version: 7.1.0
- VS Code version: 1.116.0
- OS: Windows 11 Pro (emulator: Pixel 8 android-x64)
- Debug adapter: dart (Flutter)

## Reproduction

1. Run a Flutter debug session on an Android emulator that has another app installed (e.g., `com.saropamobile.app` with a widget provider).
2. Let the other app ANR — Android dumps ~50 `ActivityManager` error-level lines (CPU stats, memory pressure, IO pressure, process list) all at the same timestamp.
3. Open the log viewer's signal analysis.
4. Observe 3 separate signal report buttons/tabs instead of 1 consolidated report.

**Frequency:** Always (any multi-line system dump at error level will produce duplicates)

## Root Cause

The pipeline has three independent points where the same event gets picked up, and the dedup mechanism cannot merge across them because each generator assigns a different `hypothesisKey` prefix:

### 1. Error collection produces multiple hypotheses from the same dump

In `viewer-root-cause-hints-embed-collect.ts:67-78`, the error collector walks `allLines` backwards and collects up to 50 error-level lines. Each line becomes an individual entry in `bundle.errors[]` with its own excerpt.

In `build-hypotheses.ts:66-95`, `errorHypotheses()` groups errors by fingerprint (`hashFingerprint(normalizeLine(excerpt))`) and emits up to 2 ranked hypotheses. Because each `ActivityManager` dump line has different content (CPU stats vs. IO pressure vs. process list), they hash to different fingerprints. Result: 2 separate `error-recent` hypotheses with keys like `err::abc123` and `err::def456`.

### 2. ANR scorer fires independently on the same lines

In `signal-host-collectors.ts`, `enrichBundleWithHostSignals()` calls `collectAnrRisk(fileUri)`, which reads the log file from disk via `vscode.workspace.fs.readFile()` (cached per URI) and passes the full text to `scanAnrRisk()` in `anr-risk-scorer.ts`. The scorer matches five signal patterns — ANR keywords (`anr`, `application not responding`, `input dispatching timed out`), `Choreographer`, GC pauses, dropped/skipped frames, and jank indicators (`jank`, `stutter`, `doing too much work`) — all of which fire on lines from the same ANR event. This produces an `anr-risk` hypothesis with key `anr::risk`.

### 3. `dedupeAndMerge()` cannot merge across key prefixes

In `build-hypotheses.ts:106-125`, dedup merges hypotheses only when `hypothesisKey` matches exactly. Since the three generators produce keys in different namespaces (`anr::risk`, `err::<hash1>`, `err::<hash2>`), no merging occurs. All three pass through to the final output.

### Data flow showing the gap

```
Log lines (same ANR event, same timestamp 21:49:55.788):
  ├─ "ANR in com.saropamobile.app"              ─┐
  ├─ "CPU usage from 246427ms to 0ms ago..."     │  All E-level ActivityManager lines
  ├─ "74% 3935/com.saropamobile.app: 23% user…" │  from a single ANR dump
  ├─ "full avg10=0.00 avg60=0.01..."             ─┘
  │
  ▼ Webview collection (viewer-root-cause-hints-embed-collect.ts:67-78)
  ├─ bundle.errors[] ← each line becomes a separate error entry (no fingerprint yet)
  │     ├─ { lineIndex: 1042, excerpt: "74% 3935/…" }
  │     └─ { lineIndex: 1045, excerpt: "full avg10=…" }
  │
  ▼ Host enrichment (signal-host-collectors.ts → anr-risk-scorer.ts)
  ├─ bundle.anrRisk ← scanAnrRisk() matches ANR patterns → score 100
  │
  ▼ buildHypotheses()
  ├─ errorHypotheses()  ← fingerprints computed here via hashFingerprint(normalizeLine())
  │     → key "err::hash_A"  (templateId: error-recent)
  │     → key "err::hash_B"  (templateId: error-recent)
  ├─ anrHypotheses()             → key "anr::risk"    (templateId: anr-risk)
  │
  ▼ dedupeAndMerge()
  ├─ No matches — all 3 keys are distinct
  │
  ▼ Output: 3 separate signal reports
```

### Why this matters beyond ANR

The same pattern will occur for any multi-line system dump at error level: crash stack traces with multiple error-tagged lines, OOM kills with memory stats, `StrictMode` violations with context. Any event that Android logs as multiple `E`-level lines with varying content will fan out into multiple hypotheses.

## Changes Made

**Implemented Option B (merge variant)** — cross-signal consolidation in `buildHypotheses()`.

Added `mergeErrorsIntoAnr()` in `build-hypotheses.ts` (called between `dedupeAndMerge()` and the final sort/slice). When an `anr::risk` hypothesis exists with `confidence: 'high'`, all `error-recent` hypotheses are removed and their `evidenceLineIds` are merged into the ANR hypothesis. The ANR report now links to the actual dump lines (CPU stats, IO pressure, process list) instead of those lines appearing as separate reports. No information is lost — just consolidated.

**Affected file:** `src/modules/root-cause-hints/build-hypotheses.ts`

### Approach options (reference)

**Option A — Timestamp-based clustering in error collection (webview side)**

In `collectRootCauseHintBundleEmbedded()`, when consecutive error lines share the same timestamp (or fall within a short window, e.g., ≤100ms), group them into a single bundle error entry. Use the first line as the excerpt and merge line indices. This prevents the fan-out before it reaches hypothesis generation.

Affected file: `src/ui/viewer/viewer-root-cause-hints-embed-collect.ts`

**Option B — Cross-signal suppression in `buildHypotheses()` (host side)**

After generating all hypotheses, if an `anr::risk` hypothesis exists, suppress or absorb `error-recent` hypotheses whose evidence lines fall within the ANR's timestamp window. The ANR report already covers the event; the individual error lines are just its diagnostic dump.

Affected file: `src/modules/root-cause-hints/build-hypotheses.ts`

**Option C — Causality-aware dedup in `dedupeAndMerge()` (host side)**

Extend `dedupeAndMerge()` to accept a consolidation strategy. When hypotheses from different generators share overlapping `evidenceLineIds` or fall within the same timestamp cluster, merge them into the highest-tier hypothesis (keeping the others as "contributing factors" in the merged report's detail).

Affected file: `src/modules/root-cause-hints/build-hypotheses.ts`

**Recommendation:** Option B is the most surgical — it doesn't change collection and doesn't require timestamp parsing in the dedup layer. When `anr::risk` is present with high confidence, suppress `error-recent` hypotheses entirely (or demote them to "contributing factors" inside the ANR report).

**Caveats to address during implementation:**

- `anrHypotheses()` in `build-hypotheses-general.ts:180` returns `evidenceLineIds: []` — the ANR scorer tracks no line indices, so overlap-based merging won't work without first adding line tracking to `scanAnrRisk()`.
- Error excerpts come from `stripTags(row.html)` and may not contain the `ActivityManager` tag — the observed excerpts ("74% 3935/..." and "full avg10=0.00...") have no source tag. Matching on excerpt content alone is fragile.
- A simpler suppression rule: when `anr::risk` exists with `confidence: 'high'`, drop all `error-recent` hypotheses. ANR dumps overwhelmingly dominate the error list, and the ANR report already conveys the event. If a genuine non-ANR error also happened in the same session, it would be a separate concern — but in practice the error collector's top-2 slots will be consumed by the dump lines, so they're already lost.

## Tests Added

`src/test/modules/root-cause-hints/build-hypotheses.test.ts` — 3 new tests:

1. **high-confidence ANR absorbs error-recent evidence lines** — bundle with score 100 ANR + two error excerpts produces only the ANR report (zero error-recent), and the ANR hypothesis carries both error line indices
2. **medium-confidence ANR does NOT merge error-recent** — bundle with score 30 ANR + error excerpt produces both ANR and error-recent reports independently
3. **high ANR merge does not affect non-error hypothesis types** — bundle with score 100 ANR + errors + fingerprint leaders: errors merged into ANR, fingerprint-leader survives independently

## Commits

<!-- Add commit hashes as fixes land. -->
