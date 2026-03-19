# Drift Advisor ↔ Log Capture Integration

**Document version:** 1.0 · **Status:** Draft · **Last updated:** 2025-03-19  
**Repositories:** `saropa-log-capture`, `saropa_drift_advisor`

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
- **Config:** `config.integrationsAdapters`; adapters listed in `INTEGRATION_ADAPTERS` in `integrations-ui.ts`. No `driftAdvisor` today; no built-in provider that reads from Drift Advisor.
- **Public API:** `registerIntegrationProvider(provider)` for other extensions.

### 2.2 Saropa Drift Advisor

- **LogCaptureBridge** (`extension/src/debug/log-capture-bridge.ts`): Gets Log Capture via `getExtension('saropa.saropa-log-capture')`, registers provider id `saropa-drift-advisor` with **minimal** contract — `isEnabled(): true`, `onSessionStartSync()` (header lines), `onSessionEnd()` **no parameters**, returns **header lines only** (performance summary). No meta/sidecar; does not receive `IntegrationEndContext`. Uses `writeLine` with `drift-perf`, `drift-query`, `drift-link`, `drift-edit`.
- **DriftApiClient:** `performance()`, `anomalies()`, `schemaMetadata()`, `health()`, `indexSuggestions()`, `sizeAnalytics()`, `compareReport()`, etc.
- **DiagnosticManager:** Collects issues into a VS Code diagnostic collection; does **not** expose last collected issues to the bridge.
- **Extension API:** Not exposed (`contributes.api` / `context.exports`).
- **Config:** `driftViewer.performance.logToCapture` (`off` | `slow-only` | `all`). No setting yet for “how much to include in Log Capture session”.

### 2.3 Gaps

| Gap | Owner | Description |
|-----|--------|-------------|
| Bridge uses minimal provider contract | Drift Advisor | `onSessionEnd()` has no context, returns only header; no meta/sidecar. |
| No issues in session | Drift Advisor | DiagnosticManager does not expose last issues. |
| No driftAdvisor in Integrations UI | Log Capture | User cannot enable/disable in Configure integrations. |
| No viewer action for drift lines | Log Capture | No “Open in Drift Advisor” for `drift-perf` / `drift-query`. |
| No optional pull path | Both | Log Capture has no built-in provider that pulls from Drift API or file. |
| No shared contract | Both | Snapshot shape undocumented; no JSON schema. |

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

- Shared npm package; correlation (error + Drift queries in window); deep-link commands with args; file-based contract as primary integration path (optional file contract remains in scope as follow-up; see §7 and Phase 6).

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

- Add an entry to `INTEGRATION_ADAPTERS` in `integrations-ui.ts` with `id: 'driftAdvisor'` (and label, description, optional descriptionLong, performanceNote, whenToDisable). The config key `saropaLogCapture.integrations.adapters` does not enforce a fixed list; the UI list defines which adapters users can enable. Bridge’s `isEnabled(context)` should check `context.config.integrationsAdapters.includes('driftAdvisor')` so disabling in UI stops contributions.

### 5.2 Drift Advisor

- **Existing:** `driftViewer.performance.logToCapture`: `'off' | 'slow-only' | 'all'`.
- **New:** `driftViewer.integrations.includeInLogCaptureSession`: `'none' | 'header' | 'full'`
  - `none`: no contributions (or do not register provider).
  - `header`: header lines only.
  - `full`: header + meta + sidecar (default).

---

## 6. Exposing “issues” (diagnostics)

Diagnostics live in `DiagnosticManager` and are applied to the VS Code collection; the bridge has no access today.

**Recommended (Option A):** In `diagnostic-manager.ts`, after each refresh store `_lastIssues: IDiagnosticIssue[]` and expose `getLastCollectedIssues(): IDiagnosticIssue[]`. Pass a getter (or DiagnosticManager) into LogCaptureBridge; in `onSessionEnd` serialize issues (file path, code, message, severity) into `issuesSummary` (meta) and `issues` array (sidecar).

**Optional (Option B):** `DiagnosticManager.collectSnapshot()` that runs providers without applying to the collection; bridge calls it at session end for a fresh snapshot (slower).

**Optional (Option C):** Future server-side “linter” API if the Drift server ever exposes it.

---

## 7. Optional: Extension API and file contract

**Extension API:** Add `contributes.api` (e.g. `"api": "driftViewer"`). In `activate()`, set `context.exports` to an object with `getSessionSnapshot()` that gathers performance, anomalies, schema summary, health, issues (via DiagnosticManager) and returns `DriftAdvisorSnapshot | null`. Log Capture can then have a built-in provider that calls this when the adapter is enabled and the extension is present.

**File contract:** Optional file `.saropa/drift-advisor-session.json` with the same snapshot shape. Drift Advisor can write it on session end or on command; Log Capture’s built-in provider could read it when the extension is not available. Pros: no activation order dependency. Cons: file can be stale; define when to write.

---

## 8. Phased implementation plan

### Phase 1: Contract alignment and rich meta/sidecar (Drift Advisor)

- **LogCaptureBridge:** (1) Type provider so `onSessionEnd(context)` receives end context (minimal duplicated type if no dependency on saropa-log-capture). (2) In `onSessionEnd(context)`: parallel fetch `performance()`, `anomalies()`, `schemaMetadata()`, `health()`, `indexSuggestions()`; build meta + sidecar; return meta + sidecar contributions (keep header if desired). (3) Honor `driftViewer.integrations.includeInLogCaptureSession` (`none` | `header` | `full`). (4) `isEnabled(context)` accept context and return `(context.config.integrationsAdapters ?? []).includes('driftAdvisor')`.
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
- **Viewer:** Add “Open in Drift Advisor” for lines with category `drift-perf` or `drift-query`, visible when `getExtension('saropa.drift-viewer')` is defined. Invoke the appropriate command via `vscode.commands.executeCommand`; the exact command IDs must match Drift Advisor’s `package.json` `contributes.commands` (e.g. a command such as `driftViewer.openWatchPanel` or `driftViewer.showQueryDetail` — implementors should confirm IDs in the Drift Advisor repo).
- **Tests:** Adapter in list; action appears and runs when Drift installed; hidden when not.
- **Effort:** 1 day (Log Capture).

### Phase 4: Context popover / insights (Log Capture)

- **Viewer/insights:** Render block for `meta.integrations['saropa-drift-advisor']` (summary + link to sidecar or “Open in Drift Advisor”).
- **Effort:** 0.5–1 day (Log Capture).

### Phase 5 (Optional): Drift Advisor API + Log Capture built-in provider

- **Drift Advisor:** `contributes.api`, `context.exports` with `getSessionSnapshot()`.
- **Log Capture:** New provider `drift-advisor.ts`; `isEnabled` when adapter + extension present; `onSessionEnd` calls API, builds meta + sidecar. Register in `activation-integrations.ts`. Document that bridge and built-in may both run (last writer or accept duplicate).
- **Effort:** 1 day (both).

### Phase 6 (Optional): File contract and shared types

- Document `.saropa/drift-advisor-session.json`; optional JSON schema; optional shared npm package for types.
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
| 4 | (Optional) Built-in driftAdvisor provider; register | `providers/drift-advisor.ts`, `activation-integrations.ts` | 5 |
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

- Log Capture: document “Drift Advisor” adapter and “Open in Drift Advisor” action; reference this doc.
- Drift Advisor: document `includeInLogCaptureSession` and optional API; snapshot shape.
- Rollout: additive; changelog per phase.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Type duplication for context | Minimal context interface in Drift Advisor; no dependency on saropa-log-capture. |
| Session end slow if Drift server slow | Promise.allSettled + timeout; contribute what’s available; log failures. |
| Duplicate meta/sidecar (bridge + built-in) | Same key/sidecar name (last writer) or document acceptable duplicate. |
| Diagnostics not ready at session end | Issues optional; omit if getLastCollectedIssues empty. |

---

## 14. Summary table

| Area | Action |
|------|--------|
| **Drift Advisor** | 1) Full provider contract (end context, meta + sidecar). 2) onSessionEnd: parallel fetch performance, anomalies, schema, health, index suggestions; contribute meta + sidecar. 3) DiagnosticManager.getLastCollectedIssues(); include issues in meta/sidecar. 4) Config includeInLogCaptureSession; isEnabled(context) checks driftAdvisor. 5) Optional: extension API getSessionSnapshot(); optional file contract. |
| **Log Capture** | 1) driftAdvisor in INTEGRATION_ADAPTERS. 2) Viewer “Open in Drift Advisor” for drift-perf/drift-query. 3) Context popover section for Drift meta. 4) Optional: built-in provider calling Drift API or file. |
| **Both** | Shared snapshot type/JSON schema; config knobs; optional shared npm package. |

---

## 15. Appendix

### A. References

- Log Capture: `docs/history/INTEGRATION_API.md`, `src/modules/integrations/types.ts`, `context.ts`, `session-lifecycle-finalize.ts`
- Drift Advisor: `extension/src/debug/log-capture-bridge.ts`, `api-client.ts`, `api-types.ts`, `diagnostics/diagnostic-manager.ts`, `diagnostic-types.ts`

### B. Glossary

- **Adapter:** Logical integration (e.g. `driftAdvisor`) in Configure integrations; stored in `integrations.adapters`.
- **Bridge:** LogCaptureBridge in Drift Advisor; registers the provider with Log Capture.
- **Meta:** Data in `SessionMeta.integrations[key]` shown in viewer/insights.
- **Sidecar:** File next to the log (e.g. `*.drift-advisor.json`).
- **Snapshot:** Structured export (performance, anomalies, schema, health, issues) for meta, sidecar, and optional API.

### C. Implementation status (saropa-log-capture)

**Phase 3 and Phase 4** are implemented in this repo. Changes: `INTEGRATION_ADAPTERS` includes `driftAdvisor`; webview receives `setDriftAdvisorAvailable` when the Drift Advisor extension is present; context menu shows “Open in Drift Advisor” for lines with category `drift-perf` or `drift-query` when available; message handler executes `saropa.drift-viewer.openWatchPanel` (see `drift-advisor-integration.ts` for the constant); context popover includes `integrationsMeta` and renders a Drift Advisor block with summary and “Open in Drift Advisor” button. Extension ID and command ID are in `src/ui/provider/drift-advisor-integration.ts`; update the command ID there when Drift Advisor’s `package.json` defines it.
