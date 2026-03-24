# Integration API and Framework

This document defines the **API and framework** that integration providers use to contribute data to a log session. The goal is a single contract so that all integration ideas (Windows events, git, database, build/CI, performance, HTTP, terminal, browser, Docker, WSL, crash dumps, packages, test results, security, coverage, environment) plug in the same way.

---

## Overview

- **Integration provider:** A module that contributes **header lines**, **meta fields**, **sidecar files**, and/or **viewer payloads** at defined lifecycle points.
- **Lifecycle:** **Session start** (sync and optional async) and **Session end** (async). Header is written once at start; only sync-at-start data can appear there. Meta and sidecars are written at start (if ready) or at end.
- **Registry:** The extension registers all built-in (and optionally external) providers. Session lifecycle calls the registry at the right times and merges results into the context header, `SessionMeta`, and sidecar files.
- **SessionMeta:** Extended with an optional `integrations?: Record<string, unknown>` so each provider stores its payload under a stable key (e.g. `integrations.buildCi`, `integrations.windowsEvents`). The viewer and bug report read from `meta.integrations` to render integration-specific UI.

---

## Lifecycle

| Phase | When | What providers can do | Where output goes |
|-------|------|------------------------|--------------------|
| **Start (sync)** | Before `logSession.start()` returns | Return header lines, meta payload (if available immediately) | Header string, SessionContext extension or separate header line list |
| **Start (async)** | Right after session start (fire-and-forget) | Fetch data (e.g. API); cannot change header (already written) | Meta only (write later at end) |
| **End** | During `finalizeSession()` after `logSession.stop()` | Return meta payload, sidecar contents, viewer payload | Meta store, sidecar files next to log, viewer when opening log |

**Header constraint:** The main log file header is written once in `LogSession.start()`. So:
- **Sync-at-start** contributions are the only way to add lines to that header. The registry collects header lines from all enabled providers before `start()` and passes them to a header generator that appends after the core block.
- Data that becomes available only at session end (e.g. Windows events, crash dump list) appears only in **meta** and **sidecar**, not in the main header. Optionally one summary line could be written to a **continuation block** at end (future) or we accept "see .events.json" only in meta/viewer.

---

## Contribution Types

### 1. Header contribution (sync at start only)

- **Shape:** `{ kind: 'header'; lines: string[] }`
- **Semantics:** Lines to append to the context header (after the core block, before the divider). Each line should be a single line (no `\n`); the framework adds newlines.
- **Example:** Git describe, lockfile hash, build status (if from file), package summary.

### 2. Meta contribution (start or end)

- **Shape:** `{ kind: 'meta'; key: string; payload: unknown }`
- **Semantics:** Stored under `SessionMeta.integrations[key]`. Key must be stable per provider (e.g. `buildCi`, `windowsEvents`). Payload is JSON-serializable (plain objects, arrays, primitives). Viewer and bug report can read `meta.integrations[key]` to render provider-specific UI.
- **Example:** `{ key: 'buildCi', payload: { status: 'success', buildId: '123', url: '...' } }`.

### 3. Sidecar contribution (usually at end)

- **Shape:** `{ kind: 'sidecar'; filename: string; content: string | Buffer; contentType?: 'utf8' | 'json' }`
- **Semantics:** Write a file next to the log file with the given filename (e.g. `basename.events.json`, `basename.terminal.log`). Same directory as the log file. Content is UTF-8 text or JSON string; contentType hints whether to pretty-print JSON.
- **Example:** Windows events JSON, terminal log, container log, crash dump list.

### 4. Viewer contribution (at end or when opening log)

- **Shape:** `{ kind: 'viewer'; key: string; payload: unknown }`
- **Semantics:** Data to send to the webview when the user opens this log. Stored in meta under `integrations[key]` (same as meta) so that when the viewer loads a log, it reads meta and passes `integrations` to the webview. No separate type needed if we treat "viewer" as "meta that the viewer knows how to render." So **meta and viewer are unified**: provider writes meta; viewer reads `meta.integrations` and, for known keys, renders a tab or panel (e.g. "Build", "Windows events", "Related requests").

---

## Provider Interface

Each provider implements:

```ts
interface IntegrationProvider {
  /** Stable id; used as meta key and for enabling/disabling. */
  readonly id: string;

  /** Whether this provider is enabled (e.g. from config). */
  isEnabled(context: IntegrationContext): boolean | Promise<boolean>;

  /**
   * Called synchronously before LogSession.start().
   * Return header lines and/or meta that are available immediately.
   */
  onSessionStartSync?(context: IntegrationContext): Contribution[] | undefined;

  /**
   * Called after session start (async). Cannot add to header.
   * Return meta (and optionally sidecar) when ready.
   */
  onSessionStartAsync?(context: IntegrationContext): Promise<Contribution[] | undefined>;

  /**
   * Called during finalizeSession(), after logSession.stop().
   * Return meta, sidecar, etc. context has logUri, baseFileName, sessionStartTime, sessionEndTime.
   */
  onSessionEnd?(context: IntegrationEndContext): Promise<Contribution[] | undefined>;
}
```

**Contribution** is a discriminated union:

```ts
type Contribution =
  | { kind: 'header'; lines: string[] }
  | { kind: 'meta'; key: string; payload: unknown }
  | { kind: 'sidecar'; filename: string; content: string | Buffer; contentType?: 'utf8' | 'json' };
```

**IntegrationContext** (start):

- `sessionContext: SessionContext` (date, projectName, config, workspaceFolder, devEnvironment, etc.)
- `workspaceFolder: vscode.WorkspaceFolder`
- `config: SaropaLogCaptureConfig`
- `outputChannel: vscode.OutputChannel` (for diagnostic messages)

**IntegrationEndContext** (end):

- Everything in IntegrationContext, plus:
- `logUri: vscode.Uri` (current log file URI)
- `baseFileName: string` (e.g. `20250228_143022_myproject` for sidecar naming)
- `sessionStartTime: number` (timestamp)
- `sessionEndTime: number` (timestamp)
- `logDirUri: vscode.Uri` (directory containing the log file)

---

## Registry

- **IntegrationRegistry** holds a list of providers. Methods:
  - `register(provider: IntegrationProvider): void`
  - `getHeaderContributions(context: IntegrationContext): string[]` — runs all enabled providers’ `onSessionStartSync`, collects `kind: 'header'`, returns flattened lines.
  - `runOnSessionEnd(context: IntegrationEndContext): Promise<void>` — runs all enabled providers’ `onSessionEnd`, collects meta and sidecar; merges meta into `SessionMeta.integrations`, writes sidecar files under `logDirUri` with `baseFileName + provider-chosen suffix`.
- **Session lifecycle** calls:
  - Before `logSession.start()`: get header contributions and pass to header generator (see below).
  - In `finalizeSession()` after `logSession.stop()`: build `IntegrationEndContext`, call `registry.runOnSessionEnd(context)`. Registry loads meta for `logUri`, merges contributions into `meta.integrations`, saves meta; writes each sidecar to `logDirUri` with filename from contribution.

---

## Header Generation Change

Current: `generateContextHeader(ctx, config)` returns one string. We need to append integration header lines.

**Option A (recommended):** Add an optional parameter: `generateContextHeader(ctx, config, extraLines?: string[])`. If present, append `extraLines` before the `==========================================` line. Session lifecycle: `extraLines = registry.getHeaderContributions(integrationContext)`; pass to generator. No change to LogSession constructor; we pass extraLines from the caller (session-lifecycle) when building the header. So we need to change the call site: currently `LogSession` calls `generateContextHeader(this.context, this.config)` inside `start()`. We could either:
- Pass `extraLines` into `LogSession.start(extraLines?)` and have LogSession call `generateContextHeader(ctx, config, extraLines)`, or
- Have the **caller** (session-lifecycle) call `generateContextHeader(ctx, config, extraLines)` and pass the full header string to `LogSession` (e.g. `start(headerOverride?)`). That would require LogSession to accept a precomputed header. Cleaner separation: lifecycle builds header (including integration lines), passes to LogSession.start(header).

**Option B:** Keep `generateContextHeader` as-is; in session-lifecycle, before creating LogSession, build `sessionContext` and call a new `appendIntegrationHeaderLines(sessionContext, config)` that runs the registry sync and returns lines; then create a combined header string and pass it to a new `LogSession.startWithHeader(header)` so the session doesn’t call generateContextHeader itself. That’s a bigger change to LogSession.

**Recommended:** Option A with minimal change: add `extraLines?: string[]` to `generateContextHeader`. Session-lifecycle: before `logSession.start()`, build `IntegrationContext`, call `registry.getHeaderContributions(context)`, then build `sessionContext` and call `generateContextHeader(ctx, config, extraLines)` to get the full header. But currently the header is built **inside** `LogSession.start()`. So we need to either:
1. Move header building out of LogSession into the caller: caller computes header (with integration lines) and calls `logSession.start(header)`. LogSession.start(header?) writes that header (or if not provided, uses generateContextHeader(ctx, config) for backward compat).
2. Or pass integration registry (or extraLines) into LogSession and have start() call registry.getHeaderContributions and then generateContextHeader(ctx, config, extraLines).

(1) is cleaner: one place (session-lifecycle) builds the full header and passes it in. So: `LogSession.start(header?: string)`. If `header` is provided, use it; else use `generateContextHeader(this.context, this.config)`. Session-lifecycle will build header = generateContextHeader(ctx, config, registry.getHeaderContributions(...)) and pass it to start(header).

---

## Meta and Sidecar Flow (Session End)

1. `finalizeSession()` calls `registry.runOnSessionEnd(integrationEndContext)`.
2. Registry iterates enabled providers, awaits `provider.onSessionEnd(context)` for each, collects Contribution[].
3. For each `kind: 'meta'`: load meta for logUri, set `meta.integrations[contribution.key] = contribution.payload`, save meta. (Merge all meta contributions into one load/save to avoid races.)
4. For each `kind: 'sidecar'`: write file to `vscode.Uri.joinPath(logDirUri, contribution.filename)`. Filename must be safe (e.g. `basename.events.json`). Provider receives `baseFileName` in context so it can return `filename: `${baseFileName}.events.json``.
5. Non-blocking: if a provider throws, log to outputChannel and continue with other providers. Never fail finalizeSession due to integration errors.

---

## SessionMeta Extension

Extend `SessionMeta` (session-metadata.ts) with:

```ts
/** Integration provider payloads keyed by provider id (e.g. buildCi, windowsEvents). */
integrations?: Record<string, unknown>;
```

SessionMetadataStore: when saving, persist `integrations` as-is. When loading, include in returned meta. No new setter needed if we merge in finalizeSession via load → modify integrations → save. Alternatively add `setIntegrationPayload(logUri, key, payload)` that does load, set meta.integrations[key] = payload, save. Registry can call that for each meta contribution.

---

## Viewer and Bug Report

- **Viewer:** When loading a log, the extension reads meta (already does). If `meta.integrations` is present, send it to the webview (e.g. as part of the existing "session meta" or "context" message). The viewer script can then show tabs or sections for known keys (e.g. `buildCi` → "Build" tab with link; `windowsEvents` → "Windows events" with count and "Open file").
- **Bug report:** Bug report collector can include a section "Integrations" that lists or formats `meta.integrations` (e.g. "Build: success #123", "Windows events: 3 errors; see sidecar") so that shared bug reports carry integration context.

---

## Configuration

**Adapter selection:** Users choose which integrations to enable via `saropaLogCapture.integrations.adapters`: an array of adapter ids (e.g. `["packages", "buildCi"]`). Default is `["packages"]` or `[]`. Each provider’s `isEnabled(context)` checks `context.config` (or a dedicated config key) for inclusion in that list. Only enabled adapters run; no work is done for disabled ones.

**Per-adapter settings:** Optional per-id settings live under `saropaLogCapture.integrations.<id>.*` (e.g. `integrations.packages.includeHash`) for provider-specific options.

---

## Performance, Load, and UX

- **CPU / HD load:** Adapters are opt-in. Sync work (e.g. lockfile hash) is kept minimal (single read + hash). Heavy work (Windows Event Log, API calls) runs at session **end** in the background so it does not block the session start or DAP handling. Consider timeouts and line/size caps for file reads and API responses.
- **Background work:** `onSessionStartAsync` and `onSessionEnd` must not block the main flow. Run I/O in async; never spin or do large sync work in `onSessionStartSync`. Use `runOnSessionEnd` for all heavy providers so the session is already stopped and the user sees “Session stopped” before sidecars are written.
- **Loading states:** For the viewer, when opening a log that has `meta.integrations` but some data is loaded lazily, show a **shimmer** or “Loading…” for that section until the payload is ready. Prefer **gradual enhancement**: render header and log first, then integrate panels (e.g. “Build”, “Windows events”) when meta is available; optional spinners only for async-loaded sections.
- **Status bar:** When at least one adapter contributes (sync at start or at end), show a **status bar icon** and/or label so it’s clear an adapter is active. Example: “$(package) Packages” or “$(check-all) 2 adapters” with tooltip listing active adapter names. Clear the indicator when the session ends or when no adapters contributed. This gives users immediate feedback that their chosen adapters ran.
- **Gradual enhancements:** Ship adapters that do one thing well. Add loading shimmers/spinners only where data is fetched asynchronously (e.g. Build API, Windows events). Keep sync adapters (e.g. packages) instant with no spinner.

- **id:** `buildCi`
- **isEnabled:** `config.get('saropaLogCapture.buildCi.enabled') === true` (or read from a generic integrations config object).
- **onSessionStartSync:** If source is "file", read `.saropa/last-build.json`; if present and fresh, return `{ kind: 'header', lines: ['Last build: success (Run #123)', 'Build link: ...'] }` and `{ kind: 'meta', key: 'buildCi', payload: { status, buildId, url } }`.
- **onSessionEnd:** If source is "api", fetch last run for commit (async); return meta + optional no header (header already written). Write only meta contribution.
- **Viewer:** When meta.integrations.buildCi exists, show "Build: success" with link.

---

## Example: Windows Events Provider

- **id:** `windowsEvents`
- **onSessionStartSync:** Return nothing (cannot query at start).
- **onSessionEnd:** Query Windows Event Log for session time range (sessionStartTime, sessionEndTime from context). Build sidecar content (JSON). Return `{ kind: 'sidecar', filename: `${baseFileName}.events.json`, content: jsonString, contentType: 'json' }` and `{ kind: 'meta', key: 'windowsEvents', payload: { summary: '3 Errors, 12 Warnings', sidecar: `${baseFileName}.events.json` } }`. Viewer shows "Windows events: 3 errors" and "Open file" using sidecar filename from meta.

---

## File Layout (Implemented)

- `src/modules/integrations/types.ts` — Contribution, IntegrationProvider, IntegrationContext, IntegrationEndContext.
- `src/modules/integrations/registry.ts` — IntegrationRegistry (register, getHeaderContributions, runOnSessionEnd, runOnSessionStartAsync).
- `src/modules/integrations/context.ts` — createIntegrationContext, createIntegrationEndContext.
- `src/modules/integrations/index.ts` — Public API.
- `src/modules/integrations/providers/` — One file per built-in provider (to be added).
- `SessionMeta.integrations` — Extended in session-metadata.ts.
- `generateContextHeader(ctx, config, extraLines?)` — Optional third parameter for integration header lines.

## Wiring (How to Plug the Registry In)

1. **Create a singleton registry** (e.g. in extension or session-manager):  
   `const integrationRegistry = new IntegrationRegistry();`  
   Optionally register built-in providers: `integrationRegistry.register(buildCiProvider);`

2. **Session start (session-lifecycle.ts, initializeSession):**  
   - Build `sessionContext` as today.  
   - Build `integrationContext = createIntegrationContext(sessionContext, config, outputChannel)`.  
   - `extraLines = integrationRegistry.getHeaderContributions(integrationContext)`.  
   - Build header: `header = generateContextHeader(sessionContext, config, extraLines)`.  
   - Pass header into LogSession: either add `LogSession.start(header?: string)` and use it when provided, or add `logSession.setExtraHeaderLines(extraLines)` and have `LogSession.start()` call `generateContextHeader(ctx, config, this.extraHeaderLines)`.  
   - After `logSession.start()`, call `integrationRegistry.runOnSessionStartAsync(integrationContext)` (fire-and-forget).

3. **Session end (session-lifecycle.ts, finalizeSession):**  
   - After `logSession.stop()`, build `integrationEndContext = createIntegrationEndContext(integrationContext, logSession.fileUri, baseFileName, sessionStartTime, sessionEndTime)`.  
   - `await integrationRegistry.runOnSessionEnd(integrationEndContext, metadataStore)`.

4. **Viewer / bug report:** Read `meta.integrations` when loading a log or building a bug report; render per-key (e.g. buildCi → Build tab, windowsEvents → Windows events link).

---

## Drift Advisor built-in (`driftAdvisorBuiltin`)

The built-in provider `src/modules/integrations/providers/drift-advisor-builtin.ts` writes meta key `saropa-drift-advisor` and `{baseFileName}.drift-advisor.json` when the Log Capture adapter `driftAdvisor` is enabled **and** the Drift Advisor workspace setting `driftViewer.integrations.includeInLogCaptureSession` is `full` (missing/invalid values are treated as `full` for backward compatibility). Values `none` and `header` disable this provider so session end does not call Drift’s API or read `.saropa/drift-advisor-session.json` for meta/sidecar. Normalization lives in `drift-advisor-include-level.ts`. Drift’s LogCaptureBridge should use the same setting and the Log Capture adapter flag (see `plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md` §5.3).

---

## Summary

- **One provider interface** with `id`, `isEnabled`, optional `onSessionStartSync`, `onSessionStartAsync`, `onSessionEnd`.
- **Three contribution kinds:** header (sync only), meta (any phase), sidecar (usually end). Viewer uses meta.
- **Registry** aggregates providers and is invoked at session start (sync) and session end; it merges header lines into header generation and merges meta + writes sidecars at end.
- **SessionMeta.integrations** holds provider payloads; viewer and bug report consume them.
- **Backward compatible:** If no providers are registered or all return nothing, behavior is unchanged. Header generation gains an optional `extraLines` parameter; LogSession gains optional `start(header?: string)` or caller builds header and passes it in.
