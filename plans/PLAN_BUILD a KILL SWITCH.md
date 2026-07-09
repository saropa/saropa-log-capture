# Feature Specification: Global Tracking & Capture Kill Switch (`saropa-log-capture`)

## Overview & Objective

This specification details the implementation of a comprehensive **Kill Switch** for the `saropa-log-capture` extension workspace. This feature provides a single unified toggle to suspend or resume all active log processing, live stream captures, OpenTelemetry trace aggregations, background external file tailing, and data-flow queue allocations[cite: 4]. 

When triggered, it eliminates background performance overhead entirely, ensuring zero log footprint during sensitive data tasks or high-throughput local operations[cite: 4].

Following the conventions laid out in the `BUG_REPORT_GUIDE.md`, this specification serves as the blueprint for the feature plan `057_plan-global-kill-switch.md`[cite: 3].

---

## 1. User Experience & UI Integration

The kill switch will be exposed via three primary surfaces within the VS Code Extension to ensure ease of access.

### 1a. View Title & Status Bar Controls
* **Status Bar Indicator:** While active, a new status item will appear alongside the tracking stats indicating `$(shield) Capture Active` or `$(circle-slash) Capture Killed`. Clicking this indicator prompts a quick-pick selection to flip states.
* **Viewer Options Drawer:** A master checkbox labeled "Enable Log Collection & Monitoring" will be placed at the absolute top of the **Options Panel** (under the Capture category group)[cite: 4].

### 1b. Command Palette
Two new explicitly localized commands will be added to `package.json`[cite: 4]:
* `Saropa Log Capture: Suspend All Logging and Monitoring` (`saropaLogCapture.monitoring.suspend`)
* `Saropa Log Capture: Resume All Logging and Monitoring` (`saropaLogCapture.monitoring.resume`)

---

## 2. Configuration & Settings

A new global workspace configuration key will govern all stream parsing loops[cite: 4]:

```json
"saropaLogCapture.enableCaptureAndMonitoring": {
  "type": "boolean",
  "default": true,
  "description": "When set to false, instantly closes external tailed logs, flushes pending queues, drops input streams, and suspends sidecar telemetry generation."
}
```

---

## 3. Technical Architecture & Stream Isolation

To guarantee that a disabled state enforces zero CPU overhead and prevents Out of Memory crashes in high-volume environments, critical pipeline drops must be handled upstream[cite: 4].

```
       DAP / Debug Console Output Stream
                       |
                       v
         +-------------+-------------+
         |     Is Switch Enabled?    |
         +-------------+-------------+
                       |
            +----------+----------+
            |                     |
         [ Yes ]               [ No ]
            |                     |
            v                     v
   Ingest to Queue          Flush Queues
   Run Classifiers         Kill FS Watches
   Emit to Webview         Zero Allocations
```

### 3a. Staging Queue Purging & Back-Pressure Control
When `enableCaptureAndMonitoring` switches to `false`:
* The `pendingLines` staging queue must be cleared immediately, freeing up occupied space beneath the standard 20,000 line threshold to prevent V8 heap leakage[cite: 4].
* The batch flush timer must be decoupled and cleared rather than shortening or lengthening intervals[cite: 4].

### 3b. External Log Tailing Disruption
The Application / File Logs integration loop must aggressively wind down system interactions[cite: 4]:
* All active file system watchers spawned by `integrations.externalLogs.paths` or globs must be unlinked and shut down[cite: 4].
* The **Tailing N logs** status-bar item must be removed from view[cite: 4].

### 3c. Sidecar Telemetry & API Abortion
* **OpenTelemetry Adaption:** Trace extraction engines will abort immediately before evaluating W3C `traceparent` regex closures, preventing the generation of `.traces.json` sidecars[cite: 4].
* **Database Interception:** Live query streaming via `integrations.database.liveTail` turns off, and time-range payloads will skip passing execution blocks to any configured `apiUrl` backend[cite: 4].

---

## 4. Quality Gates & Fix Requirements

Implementation code must satisfy the rigid constraints dictated by the `BUG_REPORT_GUIDE.md` prior to merging into `main`[cite: 3, 4]:

### Code Structure Controls
* **Function Limits:** No individual routine introduced may exceed 30 lines of code or carry more than 4 parameters[cite: 3].
* **File Footprint:** The absolute length of any new manager structure must stay $\le$ 300 lines[cite: 3].
* **Null-Safety Guardrails:** Avoid unsafe type evaluations. The implementation must use robust truthiness syntax patterns instead of relying on broken type assumptions (e.g., avoid `typeof x !== 'undefined'` pitfalls on potential null properties)[cite: 3].

### Pre-Flight Verification
```bash
# Must pass cleanly without warnings before staging changes
npm run check-types
npm run lint
npm run compile
npm test
```

### Documentation Update Required
Upon successful verification, updates must be added to the `CHANGELOG.md` file under the `[Unreleased]` section header using a dedicated `### Changed` or `### Added` entry[cite: 4].
