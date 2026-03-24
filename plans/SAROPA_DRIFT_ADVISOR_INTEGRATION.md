# Drift Advisor ↔ Log Capture Integration

**Document version:** 1.2 · **Status:** Active · **Last updated:** 2026-03-23  
**Repositories:** `saropa-log-capture` (this repo), `saropa_drift_advisor` (Drift Advisor sources)  
**Drift Advisor VS Code extension id:** `saropa.drift-viewer` (package/repo names may differ).

This is the single design and implementation plan for optional, tighter integration between the two extensions.

---

## 1. Executive summary

### 1.1 Goals

- **Optional integration:** No hard dependency either way; both extensions work independently. When both are installed, users can enable tighter integration via configuration.
- **Tighter integration:** When enabled, each Log Capture session carries rich Drift Advisor data (query performance, anomalies, schema summary, health, diagnostics/issues) in session metadata and sidecar files, and the log viewer can surface that data and link to Drift Advisor.
- **Extensibility:** Clear contracts (provider contract, optional extension API, optional file contract) so future changes stay backward-compatible and other tools can consume the same data.

### 1.2 Non-goals

- Making Log Capture depend on Drift Advisor at install time (`extensionDependencies`).
- Changing the Drift debug server (Dart package) API; all data comes from existing extension and server APIs.
- Real-time streaming of Drift data into the log (only session start/end contributions and existing `writeLine`/`insertMarker`).

### 1.3 Success criteria

- With both extensions installed and integration enabled: at session end, `meta.integrations['saropa-drift-advisor']` contains a structured summary and a sidecar file (e.g. `{baseFileName}.drift-advisor.json`) exists; user can see “Drift Advisor” in Log Capture’s Integrations list and enable/disable it; for lines with category `drift-perf` or `drift-query`, “Open in Drift Advisor” is available when Drift Advisor is installed; the context popover shows the Drift Advisor summary when this meta is present.
- When only one extension is installed, no errors and no broken UI.

---

## 2. Current state

### 2.1 Saropa Log Capture

- **Integration API:** `src/modules/integrations/` — types (`IntegrationContext`, `IntegrationEndContext`, `Contribution`, `IntegrationProvider`), registry, `createIntegrationContext` / `createIntegrationEndContext`. Session finalize calls `runOnSessionEnd(endContext, metadataStore)`; meta is merged into `SessionMeta.integrations[key]`, sidecars written under `logDirUri`.
- **Config:** `config.integrationsAdapters`; adapters listed in `INTEGRATION_ADAPTERS` in `integrations-ui.ts`. **`driftAdvisor`** is listed; users enable it in Configure integrations.
- **Built-in provider:** `driftAdvisorBuiltin` (`providers/drift-advisor-builtin.ts`) calls Drift’s `getSessionSnapshot()` when the extension API exists, else reads `.saropa/drift-advisor-session.json`, only when `driftViewer.integrations.includeInLogCaptureSession` is `full` (default if unset); registered from `activation-integrations.ts`. See Appendix C and §5.4.
- **Viewer:** Context menu “Open in Drift Advisor” for `drift-perf` / `drift-query` when `saropa.drift-viewer` is installed; command `saropa.drift-viewer.openWatchPanel`. Context popover / insights surface `meta.integrations['saropa-drift-advisor']`.
- **Public API:** `registerIntegrationProvider(provider)` for other extensions (Drift Advisor bridge registers here).

### 2.2 Saropa Drift Advisor

*Aligned with `saropa_drift_advisor` extension sources (e.g. v2.8.x).*

- **LogCaptureBridge** (`extension/src/debug/log-capture-bridge.ts`): Resolves `saropa.saropa-log-capture`, registers provider id `saropa-drift-advisor` with `onSessionStartSync` (headers) and **`onSessionEnd(endContext)`** returning contributions: headers, **`meta`** key `saropa-drift-advisor`, and **`sidecar`** `{baseFileName}.drift-advisor.json` when `driftViewer.integrations.includeInLogCaptureSession` is `full`; `header` returns header fetch only; `none` returns an empty array from `onSessionEnd`. Full mode uses **parallel** `performance()`, `anomalies()`, `schemaMetadata()`, `health()`, `indexSuggestions()` with shared timeouts. Still uses `writeLine` for `drift-perf`, `drift-query`, `drift-link`, `drift-edit` per `logToCapture`.
- **Issues (Phase 2):** Bridge accepts optional `getLastCollectedIssues`; **`DiagnosticManager.getLastCollectedIssues()`** is wired from `extension.ts` so meta/sidecar can include issues.
- **Session file:** `writeSessionFile` in `log-capture-session-serialization.ts` writes **`.saropa/drift-advisor-session.json`** (best-effort) after building the sidecar for tools and Log Capture’s file fallback.
- **DriftApiClient:** `performance()`, `anomalies()`, `schemaMetadata()`, `health()`, `indexSuggestions()`, etc.
- **Extension API:** `createDriftAdvisorApi` / **`getSessionSnapshot()`** in `log-capture-api.ts`, assigned on **`context.exports`** in `extension.ts` (Log Capture built-in calls it when enabled). No `contributes.api` entry in `package.json`; optional future addition for discoverability only.
- **Config:** `driftViewer.performance.logToCapture` (`off` | `slow-only` | `all`); **`driftViewer.integrations.includeInLogCaptureSession`** (`none` | `header` | `full`) in Drift **`extension/package.json`**.

**`isEnabled` nuance:** The bridge’s `isEnabled` checks that Log Capture’s adapters include `driftAdvisor`. It does **not** also require `includeInLogCaptureSession !== 'none'`; when mode is `none`, **`onSessionEnd` returns `[]`** (session-start headers may still be contributed). Tightening registration to match §5.3 literally is optional product work.

### 2.3 Gaps

**Core integration (both repos): implemented** — end context, meta + sidecar, issues, session file, `getSessionSnapshot`, and Log Capture built-in + viewer (Appendix C).

**Remaining polish (Drift Advisor repo — documentation / visibility)**

| Item | Notes |
|------|--------|
| **Changelog depth** | Root `CHANGELOG.md` / `extension/CHANGELOG.md` **[2.7.1]** mentions Log Capture session-end improvements (parallel fetch, shared helpers) but does **not** spell out meta/sidecar, **`includeInLogCaptureSession`**, issues in export, **`getSessionSnapshot`**, or **`.saropa/drift-advisor-session.json`** for end users. Implementation is in source; release notes could catch up. |
| **README** | High-level “Log Capture bridge” bullet may still read like headers/summaries only; worth aligning with meta/sidecar and settings. |
| **`contributes.api`** | Optional manifest entry; exports already work via `context.exports`. |

**saropa-log-capture:** `driftAdvisor` in Integrations UI; viewer actions and popover; built-in provider; JSON schema at `plans/integrations/drift-advisor-session.schema.json`; user index at `docs/integrations/README.md`.

---

## 3. Requirements

### 3.1 Functional

- **FR-1** Drift Advisor’s provider must accept full end context in `onSessionEnd(context)` and return contributions that may include `meta` and `sidecar`.
- **FR-2** At session end: at least one meta contribution (key `saropa-drift-advisor`) with structured summary (performance, anomalies, schema, health) and one sidecar (e.g. `{baseFileName}.drift-advisor.json`) with full data.
- **FR-3** Optionally include “issues” summary/list from Drift Advisor diagnostics.
- **FR-4** Log Capture lists “Drift Advisor” (adapter id `driftAdvisor`) in Integrations and persists in `saropaLogCapture.integrations.adapters`.
- **FR-5** Viewer shows “Open in Drift Advisor” for `drift-perf` / `drift-query` lines when Drift Advisor is installed.
- **FR-6** Both extensions behave correctly when the other is not installed.

### 3.2 Non-functional

- **NFR-1** Session-end integration work completes within a bounded time (e.g. 5s) or contributes partial results and logs timeout/failures; parallel fetches and timeouts/fallbacks.
- **NFR-2** Contracts documented (types and/or JSON schema).
- **NFR-3** New config keys documented with sensible defaults.

### 3.3 Out of scope

- Shared npm package; correlation (error + Drift queries in window); deep-link commands with structured args beyond the single “open panel” command.
- Users are **not** required to use a workspace file as the only way to get Drift data: the optional `.saropa/drift-advisor-session.json` contract is a **fallback** when the extension API is unavailable (see §7). The bridge remains the preferred path when both extensions run together.

---

## 4. Data contracts

### 4.1 Log Capture provider contract (for Drift Advisor bridge)

```ts
// In Log Capture, context properties are readonly (see src/modules/integrations/types.ts).
interface IntegrationContext {
  readonly sessionContext: SessionContext;
  readonly workspaceFolder: vscode.WorkspaceFolder;
  readonly config: SaropaLogCaptureConfig;  // includes integrationsAdapters
  readonly outputChannel: vscode.OutputChannel;
  readonly extensionContext?: vscode.ExtensionContext;
}

interface IntegrationEndContext extends IntegrationContext {
  readonly logUri: vscode.Uri;
  readonly baseFileName: string;
  readonly sessionStartTime: number;
  readonly sessionEndTime: number;
  readonly logDirUri: vscode.Uri;
  readonly debugProcessId?: number;
}

type Contribution =
  | { kind: 'header'; lines: readonly string[] }
  | { kind: 'meta'; key: string; payload: unknown }
  | { kind: 'sidecar'; filename: string; content: string | Buffer; contentType?: 'utf8' | 'json' };

interface IntegrationProvider {
  readonly id: string;
  isEnabled(context: IntegrationContext): boolean | Promise<boolean>;
  onSessionStartSync?(context: IntegrationContext): Contribution[] | undefined;
  onSessionStartAsync?(context: IntegrationContext): Promise<Contribution[] | undefined>;
  onSessionEnd?(context: IntegrationEndContext): Promise<Contribution[] | undefined>;
}
```

Bridge must accept `IntegrationContext` / `IntegrationEndContext` and return full `Contribution[]`.

### 4.2 Data sources (DriftApiClient — all existing)

| Data | API method | Meta (summary) | Sidecar (full) |
|------|------------|----------------|----------------|
| Query performance | `client.performance()` | totalQueries, avgDurationMs, slowCount, top N | Full `PerformanceData` |
| Anomalies | `client.anomalies()` | count by severity | Full list |
| Schema | `client.schemaMetadata()` | table count, names | Table list + row counts |
| Health | `client.health()` | ok, extensionConnected | Full `HealthResponse` |
| Index suggestions | `client.indexSuggestions()` | count | Full list |
| Size analytics | `client.sizeAnalytics()` (optional) | totalSizeBytes, tableCount | Optional full |
| Compare report | `client.compareReport()` (optional) | schemaSame, tableCounts length | Optional summary |

Implementation: run in parallel (`Promise.allSettled`); on failure of one, still contribute what succeeded; gate on config.

### 4.3 Meta payload: `meta.integrations['saropa-drift-advisor']`

Log Capture adds `capturedAt` and `sessionWindow`. Provider payload shape:

```ts
interface DriftAdvisorMetaPayload {
  baseUrl: string;
  performance: {
    totalQueries: number;
    totalDurationMs: number;
    avgDurationMs: number;
    slowCount: number;
    topSlow: Array<{ sql: string; durationMs: number; rowCount?: number; at?: string }>;
  };
  anomalies: {
    count: number;
    bySeverity: { error: number; warning: number; info: number };
  };
  schema: { tableCount: number; tableNames?: string[] };
  health: { ok: boolean; extensionConnected?: boolean };
  indexSuggestionsCount?: number;
  issuesSummary?: {
    count: number;
    byCode: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}
```

### 4.4 Sidecar: `{baseFileName}.drift-advisor.json`

```ts
interface DriftAdvisorSidecar {
  generatedAt: string;
  baseUrl: string;
  performance: PerformanceData;
  anomalies: Anomaly[];
  schema: TableMetadata[];
  health: HealthResponse;
  indexSuggestions?: IndexSuggestion[];
  sizeAnalytics?: ISizeAnalytics;
  compareReport?: ICompareReport;
  issues?: Array<{
    code: string;
    message: string;
    file: string;
    range?: { start: number; end: number };
    severity: string;
  }>;
}
```

Use existing types from Drift Advisor `api-types.ts` where applicable.

**Privacy / size:** Sidecars may contain SQL, file paths, and diagnostic messages. Document this for users; consider truncation or redaction in Drift Advisor if payloads grow large. When evolving shapes, add an optional `schemaVersion` field to meta and/or sidecar so consumers can branch safely.

### 4.5 Optional: Drift Advisor extension API

```ts
interface DriftAdvisorSnapshot {
  performance: PerformanceData | null;
  anomalies: Anomaly[] | null;
  schemaSummary: { tableCount: number; tableNames: string[] } | null;
  health: HealthResponse | null;
  indexSuggestionsCount: number;
  issuesSummary?: { count: number; byCode: Record<string, number>; bySeverity: Record<string, number> };
  issues?: Array<{ code: string; message: string; file: string; severity: string }>;
}

interface DriftAdvisorApi {
  getSessionSnapshot(): Promise<DriftAdvisorSnapshot | null>;
}
```

`context.exports` in Drift Advisor would implement `DriftAdvisorApi`; Log Capture can call it for a built-in provider (optional phase).

---

## 5. Configuration

### 5.1 Log Capture

- Entry in `INTEGRATION_ADAPTERS` (`integrations-ui.ts`) with `id: 'driftAdvisor'` (label, description, optional `descriptionLong`, `performanceNote`, `whenToDisable`). The config key `saropaLogCapture.integrations.adapters` does not enforce a fixed list; the UI list defines which adapters users can enable.

### 5.2 Drift Advisor

- **Existing:** `driftViewer.performance.logToCapture`: `'off' | 'slow-only' | 'all'`.
- **New:** `driftViewer.integrations.includeInLogCaptureSession`: `'none' | 'header' | 'full'`
  - `none`: no contributions (or do not register provider).
  - `header`: header lines only.
  - `full`: header + meta + sidecar (default).

### 5.3 When the bridge contributes (both settings)

The Drift Advisor bridge should contribute **only if all** of the following hold:

1. **`driftAdvisor` is enabled in Log Capture:** `(context.config.integrationsAdapters ?? []).includes('driftAdvisor')`.
2. **Drift’s session depth is not `none`:** `includeInLogCaptureSession !== 'none'` (per Drift Advisor config).

There is no override between (1) and (2): both must pass. If either fails, the bridge should not write headers/meta/sidecar (and may skip registering the provider when permanently `none`).

**Log Capture built-in (`driftAdvisorBuiltin`):** Uses the same Drift key via `getConfiguration('driftViewer', workspaceFolder.uri)`. It contributes meta/sidecar **only** when `includeInLogCaptureSession === 'full'`. For `none` or `header`, `isEnabled` is false so session end does not activate Drift or read `.saropa/drift-advisor-session.json` for this provider. Unknown/missing values normalize to `full` (see `drift-advisor-include-level.ts`).

---

## 5.4 Quick wins — status

| Win | Repo | Status |
|-----|------|--------|
| Honor `includeInLogCaptureSession` in built-in provider (dual gate with `driftAdvisor` adapter) | saropa-log-capture | **Done** — `drift-advisor-builtin.ts`, `drift-advisor-include-level.ts`, tests `drift-advisor-include-setting.test.ts`, integrations picker copy, `plans/history/20260228/INTEGRATION_API.md`. |
| Declare `driftViewer.integrations.includeInLogCaptureSession` in Drift `package.json`; bridge honors `none` / `header` / `full` in `onSessionEnd` | saropa_drift_advisor | **Done** — `extension/package.json`, `log-capture-utils.ts`, `log-capture-bridge.ts`. |
| `getSessionSnapshot()` for Log Capture built-in | saropa_drift_advisor | **Done** — `log-capture-api.ts`, wired in `extension.ts` (`context.exports`). |
| Write `.saropa/drift-advisor-session.json` (file fallback) | saropa_drift_advisor | **Done** — `writeSessionFile` in `log-capture-session-serialization.ts`. |
| Rich meta + sidecar + issues at session end | saropa_drift_advisor | **Done** — bridge `_onSessionEnd`, `getLastCollectedIssues` from DiagnosticManager. |
| User-facing changelog / README depth for the above | saropa_drift_advisor | **Todo** (see §2.3 and §12) |

---

## 6. Exposing “issues” (diagnostics)

Diagnostics live in `DiagnosticManager` and are applied to the VS Code collection; the bridge has no access today.

**Recommended (Option A):** In `diagnostic-manager.ts`, after each refresh store `_lastIssues: IDiagnosticIssue[]` and expose `getLastCollectedIssues(): IDiagnosticIssue[]`. Pass a getter (or DiagnosticManager) into LogCaptureBridge; in `onSessionEnd` serialize issues (file path, code, message, severity) into `issuesSummary` (meta) and `issues` array (sidecar).

**Optional (Option B):** `DiagnosticManager.collectSnapshot()` that runs providers without applying to the collection; bridge calls it at session end for a fresh snapshot (slower).

**Optional (Option C):** Future server-side “linter” API if the Drift server ever exposes it.

---

## 7. Optional: Extension API and file contract

**Extension API:** Add `contributes.api` (e.g. `"api": "driftViewer"`). In `activate()`, set `context.exports` to an object with `getSessionSnapshot()` that gathers performance, anomalies, schema summary, health, issues (via DiagnosticManager) and returns `DriftAdvisorSnapshot | null`. Log Capture’s built-in provider (`driftAdvisorBuiltin`, id `driftAdvisorBuiltin`) calls this at session end when the **driftAdvisor** adapter is enabled and the extension is installed; `getSessionSnapshot()` is awaited with a **5s** timeout. If the API is missing, the provider falls back to the file below.

**File contract:** Workspace file **`.saropa/drift-advisor-session.json`** (relative to the workspace folder used for the debug session) with the same loose snapshot shape as §4.5. Drift Advisor should write it on session end or on command. Log Capture’s built-in provider reads it when the extension API does not return a snapshot. **JSON schema:** [plans/integrations/drift-advisor-session.schema.json](./integrations/drift-advisor-session.schema.json) (in this repo). Pros: no activation-order dependency. Cons: file can be stale; document when Drift Advisor writes it.

**Merge order:** Built-in providers register at startup; Drift Advisor’s `registerIntegrationProvider` runs when that extension activates, so under normal activation the **bridge’s `onSessionEnd` runs after** the built-in provider’s. For the same meta key `saropa-drift-advisor` and sidecar `{baseFileName}.drift-advisor.json`, the **bridge overwrites** (last writer wins). If activation order ever differed, treat merge as undefined except “last write wins”; prefer relying on the bridge when both extensions are active. If only the built-in runs, users still get meta/sidecar when API or file supplies data.

---

## 8. Phased implementation plan

### Phase 1: Contract alignment and rich meta/sidecar (Drift Advisor)

- **LogCaptureBridge:** (1) Type provider so `onSessionEnd(context)` receives end context (minimal duplicated type if no dependency on saropa-log-capture). (2) In `onSessionEnd(context)`: parallel fetch `performance()`, `anomalies()`, `schemaMetadata()`, `health()`, `indexSuggestions()`; build meta + sidecar; return meta + sidecar contributions (keep header if desired). (3) Honor `driftViewer.integrations.includeInLogCaptureSession` (`none` | `header` | `full`). (4) `isEnabled(context)` requires **both** `includeInLogCaptureSession !== 'none'` and `(context.config.integrationsAdapters ?? []).includes('driftAdvisor')` (see §5.3).
- **Config:** Add `driftViewer.integrations.includeInLogCaptureSession` in Drift Advisor `package.json`, default `'full'`.
- **Tests:** Bridge receives context; returns meta + sidecar; sidecar filename uses `context.baseFileName`; config none/header/full.
- **Effort:** 1–2 days (Drift Advisor).

### Phase 2: Expose diagnostics (issues) in session (Drift Advisor)

- **DiagnosticManager:** Store last collected issues; add `getLastCollectedIssues(): IDiagnosticIssue[]`.
- **LogCaptureBridge:** Accept optional issues getter; in `onSessionEnd` add `issuesSummary` and `issues` to meta/sidecar.
- **Tests:** getLastCollectedIssues; bridge with mock getter includes issues in payload.
- **Effort:** ~1 day (Drift Advisor).

### Phase 3: Log Capture — Integrations UI and viewer action

- **INTEGRATION_ADAPTERS:** Add `id: 'driftAdvisor'`, label/description/descriptionLong (and optional performanceNote, whenToDisable). Keep opt-in (do not add to default list).
- **Viewer:** “Open in Drift Advisor” for lines with category `drift-perf` or `drift-query`, visible when `vscode.extensions.getExtension('saropa.drift-viewer')` is defined. **Canonical command id (current):** `saropa.drift-viewer.openWatchPanel` — confirm in Drift Advisor `package.json` if renaming.
- **Tests:** Adapter in list; action appears and runs when Drift installed; hidden when not.
- **Effort:** 1 day (Log Capture).

### Phase 4: Context popover / insights (Log Capture)

- **Viewer/insights:** Render block for `meta.integrations['saropa-drift-advisor']` (summary + link to sidecar or “Open in Drift Advisor”).
- **Effort:** 0.5–1 day (Log Capture).

### Phase 5 (Optional): Drift Advisor API + Log Capture built-in provider

- **Drift Advisor:** `contributes.api`, `context.exports` with `getSessionSnapshot()`. *(Still required in saropa_drift_advisor for API path.)*
- **Log Capture (done):** Provider `driftAdvisorBuiltin` in `providers/drift-advisor-builtin.ts`; `isEnabled` when **driftAdvisor** adapter is on, **`includeInLogCaptureSession` is `full`**, and (Drift Advisor extension installed **or** session file exists); `onSessionEnd` tries API then file, builds meta + sidecar; registered in `activation-integrations.ts`. Constants in `drift-advisor-constants.ts` / include-level in `drift-advisor-include-level.ts`; mapping in `drift-advisor-snapshot-map.ts`.
- **Effort:** 1 day (both).

### Phase 6 (Optional): File contract and shared types

- **Log Capture (done):** Documented §7; JSON schema in this repo: `plans/integrations/drift-advisor-session.schema.json`. Shared npm package for types remains optional (not added).
- **Effort:** 0.5–1 day.

---

## 9. Task breakdown by repository

### 9.1 saropa_drift_advisor

| # | Task | File(s) | Phase |
|---|------|---------|-------|
| 1 | Bridge: end context in onSessionEnd; return meta + sidecar | `extension/src/debug/log-capture-bridge.ts` | 1 |
| 2 | Config includeInLogCaptureSession; gate contributions | `extension/package.json`, `log-capture-bridge.ts` | 1 |
| 3 | Parallel fetch and build meta/sidecar | `log-capture-bridge.ts` | 1 |
| 4 | isEnabled(context) and check driftAdvisor in adapters | `log-capture-bridge.ts` | 1 |
| 5 | DiagnosticManager: store last issues; getLastCollectedIssues() | `extension/src/diagnostics/diagnostic-manager.ts` | 2 |
| 6 | Pass issues getter to bridge; include issues in meta/sidecar | `extension-providers.ts`, `extension.ts`, `log-capture-bridge.ts` | 2 |
| 7 | (Optional) Extension API getSessionSnapshot; context.exports | `package.json`, `extension.ts` or `api.ts` | 5 |
| 8 | Tests: bridge, DiagnosticManager, API | `test/log-capture-bridge.test.ts`, etc. | 1, 2, 5 |

### 9.2 saropa-log-capture

| # | Task | File(s) | Phase |
|---|------|---------|-------|
| 1 | Add driftAdvisor to INTEGRATION_ADAPTERS | `src/modules/integrations/integrations-ui.ts` | 3 |
| 2 | Viewer “Open in Drift Advisor” for drift-perf / drift-query | Viewer context menu / message handler | 3 |
| 3 | Context popover: render meta.integrations['saropa-drift-advisor'] | Viewer / insights | 4 |
| 4 | (Optional) Built-in driftAdvisor provider; register | `providers/drift-advisor-builtin.ts`, `activation-integrations.ts` | 5 |
| 5 | Tests: adapter list, viewer action, context section | Unit/integration | 3, 4 |

---

## 10. Dependencies and ordering

- Phase 1 first. Phases 2 and 3 can run in parallel (different repos). Phase 3 after Phase 1 for adapter id and `isEnabled(context)`. Phase 4 after Phase 1. Phase 5 after Phase 1 (snapshot shape). Phase 6 anytime after Phase 1.

---

## 11. Testing strategy

- **Unit (Drift):** Bridge context, meta, sidecar, config; DiagnosticManager getter; API snapshot.
- **Unit (Log Capture):** driftAdvisor in list; built-in provider with mock API.
- **Integration:** Both installed; session with Drift; verify meta, sidecar, “Open in Drift Advisor”, integration context section.
- **Negative:** Only one extension; adapter disabled — no errors, no broken UI.

---

## 12. Documentation and rollout

### Saropa Log Capture (this repo)

| Artifact | Purpose |
|----------|---------|
| **`docs/integrations/README.md`** | Short user index: Drift adapter id, what you get, link to Drift setting, links to this plan + JSON schema. |
| **`plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md`** | Canonical design, contracts, and implementation status (this file). |
| **`plans/integrations/drift-advisor-session.schema.json`** | Sidecar / snapshot shape reference. |
| **`CHANGELOG.md`** | User-facing shipped notes; fixed schema link to `plans/integrations/…`; Drift integration bullets reference this plan and `docs/integrations/README.md`. |
| **`integrations-ui.ts`** | Configure integrations copy for `driftAdvisor` (label **Drift Advisor**, description / `descriptionLong`). |

### Saropa Drift Advisor (separate repo)

- **Settings UI:** `driftViewer.integrations.includeInLogCaptureSession` is declared in `extension/package.json`.
- **Changelog check (2026-03-23):** `CHANGELOG.md` and `extension/CHANGELOG.md` **[2.7.1]** include **“Log Capture integration (extension)”** (parallel fetch, shared timeout helpers, tests note) but **do not** yet document meta/sidecar, the **`includeInLogCaptureSession`** knob, diagnostic issues in export, **`getSessionSnapshot`**, or **`.saropa/drift-advisor-session.json`** by name. **Implementation is ahead of those release notes** — treat changelog/README polish as optional follow-up there, not “missing code.”
- **README:** Bridge bullet can be expanded to mention structured session meta + sidecar and the setting above.

### Rollout

- Additive releases; avoid breaking `saropa-drift-advisor` meta key or sidecar filename without migration notes.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Type duplication for context | Minimal context interface in Drift Advisor; no dependency on saropa-log-capture. |
| Session end slow if Drift server slow | Promise.allSettled + timeout; contribute what’s available; log failures. |
| Duplicate meta/sidecar (bridge + built-in) | Same key/sidecar name (last writer); see §7 merge order. |
| Diagnostics not ready at session end | Issues optional; omit if getLastCollectedIssues empty. |
| Sensitive or large sidecar payloads | Document contents; truncate/redact in Drift if needed (§4.4). |
| Stale session file | Document when Drift writes `.saropa/drift-advisor-session.json`; prefer API/bridge when available. |

---

## 14. Summary table

| Area | Action |
|------|--------|
| **Drift Advisor** | **Done (code):** full provider contract; `onSessionEnd` parallel fetch; meta + sidecar; issues; `includeInLogCaptureSession`; `getSessionSnapshot` on exports; `.saropa/drift-advisor-session.json`. **Optional polish:** deeper changelog/README; manifest `contributes.api`. See §2.3, §5.4, §12. |
| **Log Capture** | **Done:** `driftAdvisor` in INTEGRATION_ADAPTERS; viewer “Open in Drift Advisor”; context popover; built-in provider (API + file); `docs/integrations/README.md`; changelog + schema links. |
| **Both** | Shared snapshot type/JSON schema; config knobs; optional shared npm package. |

---

## 15. Appendix

### A. References

- Log Capture: `plans/history/20260228/INTEGRATION_API.md`, `src/modules/integrations/types.ts`, `context.ts`, `session-lifecycle-finalize.ts`
- Drift Advisor: `extension/src/debug/log-capture-bridge.ts`, `log-capture-api.ts`, `log-capture-session-serialization.ts`, `log-capture-utils.ts`, `api-client.ts`, `api-types.ts`, `diagnostics/diagnostic-manager.ts`, `diagnostic-types.ts`

### B. Glossary

- **Drift Advisor extension id:** VS Code marketplace / `package.json` `name`-style id: `saropa.drift-viewer` (used by `getExtension` and command ids).
- **Adapter:** Logical integration (e.g. `driftAdvisor`) in Configure integrations; stored in `integrations.adapters`.
- **Bridge:** LogCaptureBridge in Drift Advisor; registers the provider with Log Capture.
- **Meta:** Data in `SessionMeta.integrations[key]` shown in viewer/insights.
- **Sidecar:** File next to the log (e.g. `*.drift-advisor.json`).
- **Snapshot:** Structured export (performance, anomalies, schema, health, issues) for meta, sidecar, and optional API.

### C. Implementation status

*As of 2026-03-23.*

**Saropa Log Capture — Phases 3–6 (this repo)** are implemented. **Phase 3–4:** `INTEGRATION_ADAPTERS` includes `driftAdvisor`; webview `setDriftAdvisorAvailable`; context menu “Open in Drift Advisor” for `drift-perf` / `drift-query`; message handler runs `DRIFT_ADVISOR_OPEN_COMMAND` (`saropa.drift-viewer.openWatchPanel`) from `drift-advisor-constants.ts` (re-exported via `src/ui/provider/drift-advisor-integration.ts`); context popover `integrationsMeta` + Drift block. **Phase 5–6:** Built-in provider `driftAdvisorBuiltin` registers in `activation-integrations.ts`; at session end calls Drift `getSessionSnapshot()` (5s timeout) or reads `.saropa/drift-advisor-session.json`; writes meta key `saropa-drift-advisor` and `{baseFileName}.drift-advisor.json` when `driftViewer.integrations.includeInLogCaptureSession` is `full` (default if unset). JSON schema: `plans/integrations/drift-advisor-session.schema.json`. User index: `docs/integrations/README.md`.

**Saropa Drift Advisor — Phases 1–2, session file, and API (separate repo)** are implemented in source (`log-capture-bridge.ts`, `log-capture-api.ts`, `log-capture-session-serialization.ts`, `package.json` setting, DiagnosticManager issues). **Quick wins table:** §5.4. **Remaining:** changelog/README polish on the Drift side (§2.3, §12).
