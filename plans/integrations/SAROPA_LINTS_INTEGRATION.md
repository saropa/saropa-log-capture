# Saropa Lints ↔ Log Capture: Integration Design and Plan

**Status:** Draft  
**Repositories:** saropa-log-capture (this repo), saropa_lints (extension + Dart package)

This document is the single source for (1) design and rationale and (2) the full execution plan with phases, tasks, and acceptance criteria.

**Implementation status (saropa-log-capture):**
- **Phase 1 — Done.** Setting `lintReportImpactLevel`, impact filter and section label in bug report, when-clause on lint-related commands (showCodeQualityForFrame, openQualityReport).
- **Phase 2 (Log Capture) — Done.** TypeScript API types (`saropa-lints-api.ts`), violations from extension API when present else file, health score params from extension API when present else built-in. *Extension side (B1–B7) is in saropa_lints repo.*
- **Phase 3 (Log Capture) — Done.** Staleness/missing prompt before bug report collect (`saropa-lints-refresh-prompt.ts`): `runAnalysis`, `runAnalysisForFiles` or `runAnalysis({ files })`, progress notification, 24h threshold, stack paths capped at 50. *Extension B8–B9 (`runAnalysisForFiles` implementation) is in saropa_lints repo.*
- **Phase 4 (Log Capture) — Done.** Health-score params for the bug report header prefer `reports/.saropa_lints/consumer_contract.json` when present; fallback order is consumer contract → Saropa Lints extension API → built-in constants.
- **Phase 5 (Bug report / Investigation) — Done.** Add per-violation “Explain” action link in the bug report lint table (invokes `saropaLints.explainRule`), add an executive-summary one-liner for critical/high OWASP in the crash file, and optionally pin a lint snapshot (`reports/.saropa_lints/violations.json`) when adding a session to an investigation.

---

# Part I — Design and rationale

## 1. Executive summary and principles

### 1.1 Purpose

Implement **optional but tighter** integration between **Saropa Log Capture** and **Saropa Lints**:

- Log Capture can use an extension API when Saropa Lints is installed (cached data, health score params, run analysis).
- Lint data can be refreshed for **stack-trace files only** when generating bug reports.
- Bug reports can **filter** lint issues by impact (essential → full), reducing “noise” from pedantic/opinionated rules.
- Health score constants live in **one place** (extension or consumer manifest).
- Staleness prompts, explain-rule links, and optional lint snapshots improve the workflow without breaking the current file-only contract.

### 1.2 Principles

- **Optional:** Log Capture must work without the Saropa Lints extension; all new integration is additive.
- **File contract remains:** `reports/.saropa_lints/violations.json` stays the primary contract; API and manifest are enhancements when present.
- **No breaking changes:** Existing consumers of the violation export and Log Capture’s bug report format remain supported.

### 1.3 Goals and non-goals

| Goals | Non-goals |
|-------|-----------|
| Expose a stable API from Saropa Lints extension for Log Capture (and future consumers). | Hard dependency of Log Capture on Saropa Lints. |
| Allow “run analysis on stack-trace files” from Log Capture. | Changing how `dart analyze` works. |
| Filter bug-report lint section by impact (essential / recommended / full). | Changing saropa_lints tier definitions. |
| Single source of truth for health score constants (extension API or manifest). | Removing the file-based contract. |
| Staleness prompt and one-click refresh when generating bug reports. | Supporting every IDE; focus remains VS Code. |
| Optional: explain-rule deep link, when-clauses for lint UI, documentation. | Implementing file-scoped export (Option B/C) in the first release; deferred to backlog. |

---

## 2. Extending saropa_lints to expose more to Log Capture

### 2.1 Current state

- **Contract today:** File-only. Log Capture reads `reports/.saropa_lints/violations.json`; no dependency on the Saropa Lints extension. The extension does not return an API from `activate()`.
- **Health score:** Log Capture has a ported copy of constants (`IMPACT_WEIGHTS`, `DECAY_RATE`) that must stay in sync with `saropa_lints/extension/src/healthScore.ts`.

### 2.2 Extension API (Saropa Lints side)

**Saropa Lints extension** can expose an optional API so Log Capture (and other consumers) get structured data and actions without re-reading the file every time.

- **Return an API from `activate()`:**
  - `getViolationsData(): ViolationsData | null` — in-memory/cached data (same shape as `violationsReader.readViolations`). Avoids disk read when extension already has it.
  - `getViolationsPath(): string | null` — workspace-root-relative or absolute path to `violations.json` (for when Log Capture still wants to read the file).
  - `getHealthScoreParams(): { impactWeights: Record<string, number>; decayRate: number } | null` — single source of truth for health score; no more duplicated constants in Log Capture.
  - `runAnalysis(options?: { files?: string[] }): Promise<boolean>` — run full analysis or, if supported later, analysis focused on given files (see §3).
  - `getVersion(): string` — extension or package version for attribution and compatibility checks.

- **Implementation sketch (extension):**
  - In `extension.ts`, after building the extension context, create an object implementing the above and return it from `activate()`:
    - `getViolationsData`: call existing `readViolations(getProjectRoot())` (or equivalent).
    - `getHealthScoreParams`: export from `healthScore.ts` (e.g. `IMPACT_WEIGHTS`, `DECAY_RATE`).
    - `runAnalysis`: wrap existing `runAnalysis(context)`, optionally passing `files` when supported.
  - In `package.json`, add `"api": "main"` (or the entry that exposes the extension’s API) so other extensions can request it.

**Log Capture side (optional use):** On bug-report or health-score flow: `const ext = vscode.extensions.getExtension<SaropaLintsApi>('saropa.saropa-lints');` if present, call `ext.exports.getViolationsData()` (and/or `getHealthScoreParams()`) instead of only reading the file. Fallback: keep current file-based read and built-in constants.

### 2.3 Dart package: consumer manifest (optional)

To avoid Log Capture (or any consumer) duplicating health-score constants and to make schema/version explicit:

- **Saropa Lints (Dart plugin)** already writes `reports/.saropa_lints/violations.json` with `schema`, `version`, `config.tier`, `summary.byImpact`, etc.
- **Optional addition:** write a small **consumer manifest** alongside the export, e.g. `reports/.saropa_lints/consumer_contract.json`:
  - `schemaVersion`: same as in violations.json.
  - `healthScore`: `{ "impactWeights": { "critical": 8, ... }, "decayRate": 0.3 }` — generated from the same source as the extension’s health score. The canonical source will be defined in Phase 4 (Work stream C1); the extension will stay in sync via a script or documented manual process.
  - Optional: `tierRuleSets`: which rules belong to which tier (e.g. `essential`, `recommended`, …) for “show only essential-tier issues” in Log Capture.

- **Log Capture:** when this file exists, read health weights and decay from it; otherwise use built-in defaults. No dependency on the extension required.

### 2.4 Summary: what to add in saropa_lints

| Where              | What to expose |
|--------------------|----------------|
| **Extension**      | Optional API: `getViolationsData`, `getHealthScoreParams`, `runAnalysis`, `getViolationsPath`, `getVersion`. |
| **Dart / plugin**  | Optional `consumer_contract.json` with `schemaVersion`, `healthScore`, and optionally `tierRuleSets`. |
| **VIOLATION_EXPORT_API.md** | Document the manifest and any new fields so consumers stay in sync. |

---

## 3. Running saropa_lints against specific files (e.g. stack-trace files)

### 3.1 Current state

- **Extension:** `runAnalysis()` runs `dart analyze` (or `flutter analyze`) with **no file arguments** — whole project only.
- **Dart analyzer:** `dart analyze lib/a.dart lib/b.dart` is supported: the analyzer runs in that context and **reports diagnostics only for the listed files** (and their type-resolution dependencies). So from a **reporting** perspective, “analyze these files” is already supported by the CLI.
- **Plugin behavior:** The native plugin is driven by the analysis server. When you run `dart analyze file1.dart file2.dart`, the server typically still analyzes the full context (for resolution); the current **violations.json is written from the full consolidated run** (all batches), so it’s **full-project**. So today we do **not** have “violations only for these N files” from the plugin path.
- **ScanRunner (standalone):** `dart run saropa_lints:scan [path]` runs `ScanRunner` over a **directory**; it discovers all Dart files via `_findDartFiles`. It does **not** accept a list of specific files. It writes a `.log` report, not the same JSON shape as `violations.json`.

### 3.2 Making “analyze only these files” useful for Log Capture

**Option A: Extension runs `dart analyze` with file list (minimal change)**

- **Saropa Lints extension:** add a command or API: `runAnalysisForFiles(files: string[])`.
  - Implementation: `runInWorkspace(workspaceRoot, cmd, ['analyze', ...files])` with paths relative to workspace (or absolute).
- **Effect:** Those files (and their deps) are analyzed; the plugin still writes **one** `violations.json` for the run. So the export may still contain the whole project’s violations, but at least the **stack-trace files are guaranteed to be up to date** for that run. Log Capture can filter the “Known Lint Issues” section to show only violations for stack-trace files; health score and OWASP summary continue to use the full violations set from violations.json. This mainly improves freshness for the crash-relevant files.
- **Log Capture:** when generating a bug report, if Saropa Lints extension is present, offer “Run Saropa Lints analysis on stack-trace files” and call `runAnalysisForFiles(stackTraceFilePaths)`.

**Option B: Plugin writes a file-scoped export (Dart plugin change)**

- **Idea:** When the analysis run was requested with a restricted set of files (e.g. via an env var or a well-known file like `reports/.saropa_lints/focus_files.txt`), the plugin could write a **second** export, e.g. `reports/.saropa_lints/violations_focus.json`, containing only violations for those files (same schema as violations.json, but filtered).
- **Challenges:** The analysis server may not pass “requested file set” to the plugin; the plugin would need a way to know the “focus set” (env var or file written before `dart analyze`). **Deferred to backlog.**

**Option C: ScanRunner accepts a file list and outputs JSON (CLI path)**

- **Saropa Lints (Dart):** ScanRunner could accept `restrictToFiles: List<String>?` and `--files file1.dart file2.dart` in `bin/scan.dart`; add `--output json` that writes the same shape as ViolationExporter (requires ScanDiagnostic to carry impact and OWASP from the rule). **Deferred to backlog.**

**Recommendation:** Implement **Option A** in the plan (extension runs `dart analyze` with file list). Improves freshness for stack files with minimal change. Option B or C can follow in a later phase.

---

## 4. Using detection levels: obvious → pedantic (“possibly bullshit”)

### 4.1 Concepts in saropa_lints

- **Tiers (cumulative):** essential → recommended → professional → comprehensive → pedantic. Each tier adds more rules (see `getRulesForTier` in `tiers.dart`). The **current** run’s tier is in `violations.json` as `config.tier`.
- **Impact (per violation):** critical | high | medium | low | opinionated. Already in every violation in the export and in `summary.byImpact`. “Opinionated” is the usual home of “pedantic / possibly bullshit” rules (stylistic, naming, etc.).

Two axes: **Tier** = which rules were enabled for this run; **Impact** = how serious each finding is. Filtering by impact is the direct way to hide “noise” in bug reports.

### 4.2 What Log Capture can do (no schema change)

- **Filter by impact in the bug report:** Only include violations with impact in a chosen set:
  - **Essential:** critical, high.
  - **Recommended:** critical, high, medium.
  - **Full:** critical, high, medium, low, opinionated.
- **Setting:** e.g. `saropaLogCapture.lintReportImpactLevel`: `"essential" | "recommended" | "full"` (default `"recommended"`). When building the “Known Lint Issues” section, drop violations whose `impact` is below the chosen level.
- **Label in the report:** e.g. “Known Lint Issues (critical + high only)” or “(up to medium)” so the reader knows what they’re seeing.

### 4.3 Optional: tier-aware display (backlog)

- If the export (or consumer_contract.json) included `ruleToTier` or `essentialRuleNames`, Log Capture could offer “Show only essential-tier issues” so you hide pedantic/opinionated even when the project runs comprehensive/pedantic. **Deferred** until manifest or export includes this.

---

## 5. What else can we do?

- **Staleness and one-click refresh:** When generating a bug report, if `violations.json` is missing or older than a threshold (24h for the initial release; making the threshold configurable is backlog) and the Saropa Lints extension is installed, show a prompt: “Run Saropa Lints analysis to include up-to-date lint context” and call `saropaLints.runAnalysis()` or `runAnalysisForFiles(stackFiles)` when available. **In plan Phase 3.**
- **Health score single source of truth:** Use extension API `getHealthScoreParams()` or consumer manifest `healthScore`. **In plan Phases 2 and 4.**
- **Deep link to “Explain rule”:** In the bug report, for each violation, add a link that invokes the Saropa Lints “Explain rule” VS Code command with the rule id (if the extension exposes such a command). **In plan Phase 5.**
- **Investigation bundle:** When adding a session to an investigation, optionally snapshot lint state (copy `violations.json` or summary). **In plan Phase 5 (optional).**
- **OWASP in executive summary:** One line when the crash file has critical/high OWASP violations. **In plan Phase 5 (optional).**
- **When-clauses:** In Log Capture’s `package.json`, show lint-related UI only when `extension:saropa.saropa-lints` is installed. **In plan Phase 1.**
- **Extension pack:** Publish an optional “Saropa Log Capture + Lints” extension pack. **Backlog.**
- **CI / scripted use:** Document that Log Capture’s lint integration works best when `violations.json` exists (e.g. from `dart analyze` or `dart run saropa_lints:scan`). **In plan Phase 5 docs.**

---

# Part II — Execution plan

## 6. Scope (in / out)

### 6.1 In scope

- **Saropa Lints extension (VS Code):** Public API from `activate()`: getViolationsData, getViolationsPath, getHealthScoreParams, runAnalysis, getVersion. New API: runAnalysisForFiles(files). package.json exposes API.
- **Saropa Lints Dart package (optional, later phase):** Optional consumer manifest `reports/.saropa_lints/consumer_contract.json` (schemaVersion, healthScore, optionally tierRuleSets). VIOLATION_EXPORT_API.md updated.
- **Log Capture:** Use API when extension present; setting lintReportImpactLevel; filter and label “Known Lint Issues”; staleness prompt and “Run analysis” / “Run on stack-trace files”; when-clauses; optional explain-rule, OWASP summary, lint snapshot in investigation, docs.

### 6.2 Out of scope (this plan)

- Plugin-side file-scoped export (focus_files.txt + violations_focus.json).
- ScanRunner `--files` + JSON export (Option C).
- Extension pack “Saropa Log Capture + Lints”.
- Tier-based filter in Log Capture (ruleToTier / essentialRuleNames) until manifest or export includes it.

### 6.3 Dependencies and prerequisites

- **VS Code:** Both extensions target the same engine (e.g. ^1.74.0).
- **Dart analyzer:** `dart analyze file1.dart file2.dart` is supported.
- **Existing contract:** violations.json schema 1.0 and VIOLATION_EXPORT_API.md remain the authority; new files (e.g. consumer_contract.json) are additive and documented.
- **Ordering:** Phase 1 (impact filter + when-clauses) can be done in parallel with Phase 2 (extension API). Phase 3 (runAnalysisForFiles + staleness) depends on Phase 2. Phase 4 (consumer manifest) can be parallel to Phase 2/3.

---

## 7. Phases and milestones

### Phase 1 — Log Capture: impact filter and when-clauses (no saropa_lints change)

**Goal:** Users can reduce lint “noise” in bug reports and only see lint UI when Saropa Lints is installed.

| Milestone | Description |
|-----------|-------------|
| M1.1 | Setting `lintReportImpactLevel` added and respected in bug report lint section. |
| M1.2 | Section label reflects filter (e.g. “Known Lint Issues (critical + high only)”). |
| M1.3 | Lint-related contributions (e.g. “Run analysis” in report flow) gated by when-clause `extension:saropa.saropa-lints`. |

**Deliverables:** Log Capture release with new setting, filtered section, and when-clauses.

---

### Phase 2 — Saropa Lints extension: public API

**Goal:** Extension exposes a stable API so Log Capture can get violations, health params, and trigger analysis without re-reading the file.

| Milestone | Description |
|-----------|-------------|
| M2.1 | API type defined (e.g. SaropaLintsApi interface) and documented. |
| M2.2 | activate() returns API object with getViolationsData, getViolationsPath, getHealthScoreParams, runAnalysis, getVersion. |
| M2.3 | package.json exposes API (e.g. "api": "main" or equivalent). |
| M2.4 | Log Capture optionally consumes API when extension present; fallback to file read and built-in constants. |

**Deliverables:** Saropa Lints extension release with API; Log Capture release that uses it when available.

---

### Phase 3 — Run analysis on stack-trace files and staleness

**Goal:** User can refresh lint data for stack-trace files before generating a bug report; Log Capture prompts when data is stale.

| Milestone | Description |
|-----------|-------------|
| M3.1 | Saropa Lints extension: runAnalysisForFiles(files: string[]) in API; implementation runs `dart analyze ...files` in workspace. |
| M3.2 | Log Capture: when generating bug report, if violations.json missing or older than threshold (24h for initial release) and extension present, show prompt with “Run analysis” and “Run analysis on stack-trace files” (when stack has app frames). |
| M3.3 | Log Capture: actions call runAnalysis() or runAnalysisForFiles(stackTraceFilePaths); then re-read violations (file or API). |

**Deliverables:** Extension with runAnalysisForFiles; Log Capture with staleness prompt and file-scoped analysis action.

---

### Phase 4 — Consumer manifest (optional, saropa_lints Dart)

**Goal:** Health score (and optionally tier metadata) can be read from a manifest file so consumers don’t duplicate constants and don’t require the extension.

| Milestone | Description |
|-----------|-------------|
| M4.1 | ViolationExporter (or shared report step) writes `reports/.saropa_lints/consumer_contract.json` with schemaVersion, healthScore (impactWeights, decayRate). |
| M4.2 | VIOLATION_EXPORT_API.md updated with manifest schema and semantics. |
| M4.3 | Log Capture: when building health score, prefer consumer_contract.json healthScore if present; else extension API; else built-in constants. |

**Deliverables:** saropa_lints package release writing consumer_contract.json; Log Capture reading it when present; docs updated.

---

### Phase 5 — Polish and backlog

**Goal:** Explain-rule link, OWASP in executive summary, lint snapshot in investigations, and docs/CI guidance.

| Milestone | Description |
|-----------|-------------|
| M5.1 | Log Capture: in bug report lint table, add “Explain” link per violation that invokes the Saropa Lints “Explain rule” VS Code command with the rule id (if the extension exposes such a command). |
| M5.2 | Log Capture: optional one-line in executive summary when crash file has critical/high OWASP violations. |
| M5.3 | Log Capture: when adding session to investigation, optionally copy violations.json (or summary) into investigation bundle. |
| M5.4 | Documentation: README or docs section on lint integration, CI (run analysis before reports), and extension pack mention. |

**Deliverables:** Log Capture polish release; documentation updates.

---

## 8. Work streams and task breakdown

### 8.1 Work stream A: Log Capture

| ID | Task | Phase | Dependencies | Acceptance criteria |
|----|------|--------|--------------|---------------------|
| A1 | Add setting `saropaLogCapture.lintReportImpactLevel`: "essential" \| "recommended" \| "full", default "recommended". | 1 | — | Setting appears in UI; persisted. |
| A2 | In bug report formatter, filter lint violations by impact using the setting (essential = critical+high; recommended = +medium; full = all). | 1 | A1 | Only violations at or above selected level appear in “Known Lint Issues”. |
| A3 | Update “Known Lint Issues” section title/label to include filter (e.g. “(critical + high only)”). | 1 | A2 | Label matches selected level. |
| A4 | Add when-clause `extension:saropa.saropa-lints` to any contribution that is only relevant when Saropa Lints is installed. | 1 | — | Those contributions hidden when extension not installed. |
| A5 | Define TypeScript type for Saropa Lints API and document in code or docs. | 2 | — | Type matches extension’s exports. |
| A6 | In lint-violation-reader (or bug-report flow), try getExtension('saropa.saropa-lints'); if present and exports API, use getViolationsData() for current workspace; else read violations.json from disk. | 2 | M2.2 | When extension present, data can come from API; otherwise file. |
| A7 | For health score: when extension present, use getHealthScoreParams(); else (later) consumer_contract.json; else built-in constants. | 2 | M2.2, optional M4 | No duplicate constants when API or manifest available. |
| A8 | When generating bug report, if violations missing or stale (threshold: 24h for initial release; configurable threshold is backlog) and Saropa Lints extension present: show InformationMessage with “Run analysis” and “Run analysis on stack-trace files” (if stack has app frames). | 3 | M3.1 | Prompt appears in defined conditions. |
| A9 | “Run analysis” action calls runAnalysis(); “Run analysis on stack-trace files” calls runAnalysisForFiles(stackTraceFilePaths). After run, re-read lint data (API or file) and refresh report. | 3 | A8, M3.1 | Actions work and report updates. |
| A10 | When building health score, if consumer_contract.json exists in reports/.saropa_lints, read healthScore from it; else API; else built-in. | 4 | M4.1 | Single source of truth when manifest present. |
| A11 | In lint section table, add “Explain” for each violation that invokes the Saropa Lints “Explain rule” command with the rule name (if the extension exposes such a command). | 5 | — | Link/button invokes explain. |
| A12 | Optional: executive summary line when crash file has critical/high OWASP violations. | 5 | — | One line in summary when applicable. |
| A13 | Optional: investigation bundle includes lint snapshot (violations.json or summary) when adding session. | 5 | — | Investigation stores lint state. |
| A14 | Docs: lint integration, CI (run analysis before reports), optional extension pack. | 5 | — | README or docs updated. |

### 8.2 Work stream B: Saropa Lints extension

| ID | Task | Phase | Dependencies | Acceptance criteria |
|----|------|--------|--------------|---------------------|
| B1 | Define public API interface (e.g. SaropaLintsApi): getViolationsData(), getViolationsPath(), getHealthScoreParams(), runAnalysis(), getVersion(). | 2 | — | Interface documented and implemented. |
| B2 | getViolationsData: call existing readViolations(getProjectRoot()); return null if no project root or read fails. | 2 | B1 | Returns same shape as violations.json. |
| B3 | getViolationsPath: return path to reports/.saropa_lints/violations.json for project root, or null. | 2 | B1 | Path valid when project root exists. |
| B4 | getHealthScoreParams: export IMPACT_WEIGHTS and DECAY_RATE from healthScore.ts; return { impactWeights, decayRate }. | 2 | B1 | Matches current health score formula. |
| B5 | runAnalysis: wrap existing runAnalysis(context); return Promise<boolean>. | 2 | B1 | Same behavior as “Run Analysis” command. |
| B6 | getVersion: return extension or package version from package.json. | 2 | B1 | Non-empty string. |
| B7 | activate(): build API object, return it. package.json: "api": "main" (or correct key for extension API). | 2 | B2–B6 | Other extensions can getExtension and use exports. |
| B8 | runAnalysisForFiles(files: string[]): in API; run runInWorkspace(workspaceRoot, cmd, ['analyze', ...files]); paths relative to workspace. | 3 | B7 | dart analyze receives file list; violations.json updated after run. |
| B9 | Export runAnalysisForFiles on the same API object. | 3 | B8 | Log Capture can call it. |

### 8.3 Work stream C: Saropa Lints Dart package (optional)

| ID | Task | Phase | Dependencies | Acceptance criteria |
|----|------|--------|--------------|---------------------|
| C1 | Define canonical health score constants in one place (Dart or generated); ensure extension’s healthScore.ts stays in sync (e.g. script or doc). | 4 | — | Single source for weights and decay. |
| C2 | After ViolationExporter.write, write consumer_contract.json to same directory with schemaVersion, healthScore (impactWeights, decayRate). | 4 | C1 | File created on every export. |
| C3 | Optional: add tierRuleSets or essentialRuleNames to manifest for future tier filter in Log Capture. | 4 | — | Documented in VIOLATION_EXPORT_API. |
| C4 | Update VIOLATION_EXPORT_API.md with consumer_contract.json schema and when it’s written. | 4 | C2 | Consumers can rely on doc. |

---

## 9. Testing strategy

### 9.1 Log Capture

- **Unit:** Filtering by lintReportImpactLevel (essential / recommended / full) produces correct subset of violations; section label matches.
- **Unit:** Health score computation: with built-in constants, with mock API getHealthScoreParams(), with mock consumer_contract (when implemented); same inputs give same score.
- **Integration (manual or automated):** With Saropa Lints extension installed, bug report uses API when available; with extension disabled or absent, file read and built-in constants used.
- **Integration:** Staleness prompt appears when violations.json old/missing and extension present; “Run analysis” and “Run analysis on stack-trace files” execute and report updates.

### 9.2 Saropa Lints extension

- **Unit:** getHealthScoreParams() returns object matching healthScore.ts constants.
- **Integration:** Another extension (or test host) can getExtension and call getViolationsData, runAnalysis, runAnalysisForFiles; violations.json path and content consistent.

### 9.3 Saropa Lints Dart

- **Unit:** consumer_contract.json written after ViolationExporter.write; contains expected keys and types.
- **Doc:** VIOLATION_EXPORT_API.md examples match actual output.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Extension API shape changes and breaks Log Capture. | Define and document the API in both repos; use a minimal interface; Log Capture falls back to file if API missing or throws. |
| runAnalysisForFiles with many files could hit command-line length limits. | Cap the number of files (e.g. 50); document; optionally run full analysis if over cap. |
| Consumer manifest and extension get out of sync on health constants. | Single source in Dart or generated artifact; extension imports or regenerates from it; add test or CI check. |
| When-clause hides UI users expect. | Only gate “Run analysis” / “Run on stack-trace files”; keep “Known Lint Issues” section whenever violations.json exists (no when-clause on the section itself). |

---

## 11. Documentation and release

### 11.1 Documentation

- **Log Capture:** README or docs section on “Lint integration” (file contract, optional extension, setting lintReportImpactLevel, staleness prompt, CI).
- **Saropa Lints:** Extension README: “API for other extensions” (getViolationsData, getHealthScoreParams, runAnalysis, runAnalysisForFiles, getVersion).
- **Saropa Lints:** VIOLATION_EXPORT_API.md: consumer_contract.json schema, healthScore, optional tierRuleSets.

### 11.2 Release order

1. **Phase 1:** Log Capture release (impact filter + when-clauses). No saropa_lints change required.
2. **Phase 2:** Saropa Lints extension release (API); then Log Capture release (API consumption + health params from API).
3. **Phase 3:** Saropa Lints extension (runAnalysisForFiles); Log Capture (staleness prompt + actions).
4. **Phase 4:** Saropa Lints Dart (consumer_contract.json + doc); Log Capture (read manifest for health score when present).
5. **Phase 5:** Log Capture polish (explain-rule, OWASP summary, lint snapshot, docs).

### 11.3 Changelog and versioning

- Log Capture: CHANGELOG entries for new setting, API use, staleness prompt, run-on-files action, manifest support, explain-rule, docs.
- Saropa Lints extension: CHANGELOG for public API and runAnalysisForFiles.
- Saropa Lints package: CHANGELOG for consumer_contract.json and VIOLATION_EXPORT_API updates.
- No breaking changes to violations.json schema; optional fields in manifest are additive.

---

## 12. Backlog (later phases)

- **Tier-based filter in Log Capture:** “Show only essential-tier issues” once export or manifest includes ruleToTier / essentialRuleNames.
- **File-scoped export (Option B):** focus_files.txt + violations_focus.json in plugin.
- **ScanRunner --files + JSON export (Option C):** dart run saropa_lints:scan --files ... --output json for true file-only violations without full analyze.
- **Extension pack:** “Saropa Log Capture + Lints” for one-click install and discovery.
- **CI examples:** Sample workflow (e.g. GitHub Action) that runs analysis then generates Log Capture report.

---

## 13. References

- [VIOLATION_EXPORT_API.md](https://github.com/saropa/saropa_lints/blob/main/VIOLATION_EXPORT_API.md) (in saropa_lints) — violation export schema. Use the current saropa_lints repo root if working from a fork or private clone.
- Log Capture: `src/modules/misc/lint-violation-reader.ts`, `src/modules/bug-report/bug-report-lint-section.ts`, `src/modules/misc/health-score.ts`.
- Saropa Lints extension: `extension/src/extension.ts`, `extension/src/setup.ts`, `extension/src/violationsReader.ts`, `extension/src/healthScore.ts`.
