# 105 Saropa Suite Integration — Log Capture side

## Progress (incremental)

- **Shipped (today, ad-hoc):** SQL Query History shows live **Drift Advisor** database issues and
  runs **Saropa Lints** static-code checks; the Signal panel has a "Drift Advisor" action and a
  "Drift Advisor issues" summary signal; the Drift debug-server ASCII box is recognized; Logs panel
  folds lint reports / audits into Reports rows. The Drift Advisor → Log Capture **bridge** (session
  metadata + JSON sidecar) is consumed.
- **Shipped (suite protocol groundwork):** the typed **Saropa Diagnostic Envelope**
  (`src/modules/diagnostics/`) — produce side writes `.saropa/diagnostics/log-capture.json` on
  session end keyed on `commitSha` (R1); consume side parses sibling `advisor.json`/`lints.json`
  malformed-safe (R2 reader); deep-link **in** via the two public commands `saropaLogCapture.openSignal`
  and `saropaLogCapture.openSqlHistoryForFingerprint` with webview focus/flash (R4); crash-family
  **signatures** emitted on crash diagnostics for the Lints mapping (R3 producer half). Unit-tested.
- **Shipped (deep-link out + attribution):** SQL Query History rows now offer a gated **Explain this
  query in Drift Advisor** action and Lints finding rows a gated **Show rule in Saropa Lints** action
  (R5) — each shown only when the sibling command is actually registered (`getCommands` probe), never a
  dead action; the host executor allowlists the four sibling command ids. The Advisor-issue and
  Lints-violation rows carry a **source tag** chip (R2 render, attribution slice).
- **Shipped (R2 render complete):** the SQL panel now reads the typed offline mirrors
  (`.saropa/diagnostics/advisor.json` / `lints.json`) via the envelope reader and renders them as typed
  rows — live Drift server / live Lints export preferred, the mirror as fallback when the live source is
  absent. Each typed row carries its source tag, severity color, and a fix button when the diagnostic's
  `fix.command` is allowlisted and live. **The entire Log-Capture side of this plan (R1, R2, R3 producer,
  R4, R5) is now implemented.**
- **Not in this repo:** the Lints-side crash-to-rule mapping (R3 consumer half, `saropa_lints`) and the
  joined Drift Health panel (R4 there, `saropa_drift_advisor`) — tracked in the sibling plans.

## Goal

Make Log Capture a first-class **producer and consumer** of the Saropa Diagnostic Envelope so a slow
query or crash it observes at runtime links directly to the live database state (Drift Advisor) and
to the static rule that governs it (Saropa Lints) — and vice versa. One correlated picture across
static code, live data, and runtime behavior, with no product subsuming another.

This is the **Log Capture** half of a three-repo plan. The sibling docs:

- **Drift Advisor** — `D:\src\saropa_drift_advisor\plans\67-saropa-suite-integration.md`
  (repo `saropa/saropa_drift_advisor`). **Owns the canonical shared protocol** (Section 2 there);
  this plan references it rather than restating the schema.
- **Saropa Lints** — `D:\src\saropa_lints\plans\SAROPA_SUITE_INTEGRATION.md`
  (repo `saropa/saropa_lints`).
- **Saropa Dart Utils** — `D:\src\saropa_dart_utils\plans\SAROPA_SUITE_INTEGRATION.md`
  (repo `saropa/saropa_dart_utils`). The remediation layer, not a fourth lens: it ships the safe
  primitives the crash families this doc parses (R3) ultimately resolve to.

### The three lenses

| Tool | Sees | When | Emits |
|------|------|------|-------|
| `saropa_lints` | Static **code** (AST) | Compile-time | findings |
| `saropa_drift_advisor` | Live **DB data + schema** | Debug runtime | issues |
| `saropa-log-capture` (this) | **Behavior / telemetry** (logs, crashes) | Debug + production | signals |

Log Capture is the only one that sees production reality — crashes, real SQL timings, the order
events actually fired. That makes it the source of the "did it actually happen?" leg that the other
two can only predict.

## Shared protocol (canonical: Drift Advisor doc, Section 2)

Log Capture conforms to the **Saropa Diagnostic Envelope** — it does not redefine it. Fields Log
Capture is responsible for:

- `source: "log-capture"`, `severity: "error" | "warning" | "info"` (the Lints triple, suite-wide).
- `ruleId` — the signal / detector id.
- `category` — `crash`, `performance`, `drift`, `security`, …
- `sql` — the normalized query text for DB signals (Log Capture already fingerprints SQL in
  `DB_12` / `DB_15` / `DB_17`).
- `location.file` — workspace-relative. **Already a known trap:** Log Capture previously leaked
  `C:\Users\<name>\…` into bug reports; the envelope forbids absolute home paths, so reuse the
  repository-relative path logic already added for that fix.
- `commitSha` — Log Capture already reads per-session metadata SHAs and diffs against a Git commit
  baseline; populate it.

## Scope

- **In scope (v1):** Drift / SQL signals and crash signals — the categories where the other two tools
  have a counterpart. Produce + consume the envelope; wire deep-links; feed crash signatures to Lints.
- **Later:** non-Drift performance signals, broader signal categories, the cross-commit timeline UI.
- **Out of scope:** Log Capture reading source AST (that is Lints' boundary) or inspecting a live DB
  directly (that is Advisor's) — Log Capture only ever sees logs/telemetry and links *out* to those
  tools.

## Implementation Plan

1. **Produce the envelope (R1).** On session end (and on demand), write current signals to
   `<workspace>/.saropa/diagnostics/log-capture.json` (envelope, `source: "log-capture"`). This is the
   offline mirror the siblings read. Extend the existing Drift Advisor sidecar export to also carry
   this envelope keyed on `commitSha`.
2. **Consume sibling envelopes (R2).** Read `.saropa/diagnostics/advisor.json` and
   `.saropa/diagnostics/lints.json`. In SQL Query History and the Signal panel, replace today's
   bespoke "Drift Advisor issues" / "Lints checks" rows with typed envelope rows: correct
   attribution, severity color, and a `fix` action. The existing "Checking…/error" states for these
   sections stay.
3. **Deep-link command ids — public API (R4).** Contribute and never rename:
   `saropaLogCapture.openSignal { id }`,
   `saropaLogCapture.openSqlHistoryForFingerprint { sql | fingerprint }`. A sibling envelope's
   `fix.command` targeting Log Capture uses one of these.
4. **Deep-link out (R5).** A slow-query or DB signal offers, as inline actions when those extensions
   are present: `driftViewer.openExplainForSql { sql, table }` (Advisor) and
   `saropaLints.explainRule { ruleId }` / `saropaLints.enableRule` (Lints). This extends `DB_12`'s
   "Find in codebase" with two runtime-confirmation targets.
5. **Crash-to-rule feed (R3, Lints consumes).** For each crash family Log Capture already parses
   (StateError `.first`, RangeError `[index]`, the Crashlytics issue families, Flutter exception
   blocks), emit a stable `crash` signature in the signal's `ruleId`/`detail` so Lints can map it to
   the preventing rule and prompt "enable rule X." Log Capture owns the *signature*; Lints owns the
   *mapping*.
6. **Drift Health loop (Advisor doc, Section 5).** Log Capture is leg 1: detect the N+1 / slow query
   in SQL Query History and emit the signal that seeds the joined panel Advisor hosts.

## UX Rules

- Typed envelope rows must keep today's progress/error states (a reachable-but-erroring Drift check is
  not "clean").
- Cross-tool actions appear only when the target extension is installed and the diagnostic carries the
  needed fields (`sql` for EXPLAIN, `ruleId` for rule explain); never show a dead action.
- Attribution is always visible: a row from Advisor/Lints reads as theirs, not as a Log Capture
  finding.

## Test Plan

- **Unit:** signal → envelope serialization (workspace-relative path, `commitSha`, `category`
  mapping); envelope → SQL-History/Signal row rendering.
- **Integration (light):** fixture `.saropa/diagnostics/{advisor,lints}.json` → rows render with
  correct source/severity and a working `fix.command`; missing fields hide the action rather than
  erroring.
- **Regression:** sibling files absent or malformed → no uncaught host errors; sections show the
  existing empty/error states.

## Risks

- Stale offline mirrors (a `.saropa/diagnostics/*.json` from an old commit). Mitigate by surfacing the
  `commitSha`/`generatedAt` and dimming rows whose commit differs from the current HEAD.
- Schema drift between tools — mitigated by `schemaVersion` (consumers ignore unknown fields, refuse a
  higher major).

## Done Criteria

- A slow query in SQL Query History opens its EXPLAIN in Drift Advisor and its governing rule in
  Saropa Lints in one click; a parsed crash family produces an "enable rule X" prompt in Lints; all
  three tools' diagnostics align by `commitSha`.

## Shared infrastructure (cross-repo — identical Section in all three docs)

Duplicated across the three TypeScript extensions; extract to internal shared packages (path/git
deps, not a monorepo merge):

- **`saropa-vscode-i18n`** — NLLB-then-Google fallback, real-coverage audits, day-bucketed report
  paths, untranslated-locale notices (Log Capture's `058_plan-expand-translation-locales.md` and the
  one-time coverage notice are direct inputs). Sharing tooling only; running a translation job stays
  separately authorized.
- **`saropa-vscode-ui`** — theme tokens + dashboard kit (KPI cards, sortable tables, sparklines,
  axe-checked light/dark/high-contrast). All three shipped the same "fixed color washes out" bug
  class.
- **`saropa-release-tools`** (Python) — `publish.py` orchestrator (Log Capture already has the
  never-run-NLLB publish guard in `checks_build.py`), dependency-import gate, American-English gate,
  changelog conventions. All three already converged.

## Related Plans

- Sibling: `saropa_drift_advisor` — `D:\src\saropa_drift_advisor\plans\67-saropa-suite-integration.md`
  (canonical protocol + Drift Health loop + commit correlation)
- Sibling: `saropa_lints` — `D:\src\saropa_lints\plans\SAROPA_SUITE_INTEGRATION.md`
  (crash-to-rule mapping, holistic dashboard)
- Sibling: `saropa_dart_utils` — `D:\src\saropa_dart_utils\plans\SAROPA_SUITE_INTEGRATION.md`
  (remediation layer: the crash signatures R3 emits resolve, via Lints, to its safe helpers)
- Internal: `DB_12_static-orm-code-analysis.md` (the "Find in codebase" entry point R5 extends),
  `DB_17_cumulative-sql-history-across-logs.md`, `054_plan-app-quality-insights.md`,
  `001_integration-specs-index.md` (add a suite row), `058_plan-expand-translation-locales.md`.
