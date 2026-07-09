
NOTE: include crashlytics. this means background loading the data

ref: D:\src\saropa-log-capture\bugs\PLAN_BUILD a KILL SWITCH.md

# Feature Specification: Trouble Mode Dashboard (`saropa-trouble-mode`)

## Overview & Objective

This specification details the implementation of **Trouble Mode**, a dedicated three-pane diagnostic dashboard within the `saropa-log-capture` extension. 

Modern observability and vulnerability platforms suffer from severe alert fatigue; presenting developers with thousands of lines of nominal data obscures the actual faults. Trouble Mode solves this by implementing a strict **zero-context triage philosophy**. It strips away all nominal context lines and presents a live, graphical heartbeat of application health alongside a rigidly filtered feed of Errors, Warnings, Performance bottlenecks, and Signals. Selecting an issue instantly opens a detailed diagnostic report within the same view, ready for analysis or export.

---

## 1. Iconography, State, & Navigation Updates

To properly represent this dashboard without cluttering the view, the viewer's activity bar and state management must be updated.

* **Iconography Reassignment:** Trouble Mode will claim the `$(pulse)` (heart-monitor) icon, as it perfectly aligns with the live stacked chart it introduces. The existing "Signals" entry point will be reassigned to `$(lightbulb)` to distinguish standard signal lists from the live diagnostic graph.
* **Webview State Management:** Toggling Trouble Mode overrides the standard log viewer. The webview state will track this via `acquireVsCodeApi().setState({ troubleModeActive: true })`.
* **Message Catalog Hooks:** Following project conventions, opening the dashboard dispatches a new `troubleModeActivated` message routed through `src/ui/provider/viewer-message-handler.ts`.

---

## 2. Three-Pane Dashboard Architecture

Trouble Mode replaces the standard log viewer with a rigid, responsive three-column CSS Grid layout designed for rapid triage.

### Column 1: Live Heart-Monitor Chart (Left Pane)
This pane visualizes the density and severity of log events over time, acting as a real-time health indicator.

* **Rendering Strategy:** To maintain the extension's strict bundle size constraints and avoid heavy third-party charting libraries, the chart will be rendered using raw SVG DOM manipulation. This mirrors the successful, zero-dependency approach currently used by `flow-map-svg.ts`.
* **Data Bucketing:** The host extension will aggregate events into 1-second or 5-second tumbling windows (configurable via `saropaLogCapture.troubleMode.chartInterval`).
* **Visual Encoding:** The chart will be a stacked bar graph utilizing the canonical Saropa dashboard design tokens:
    * **Errors:** `--accent-critical` (Red)
    * **ANR / Signals:** `--brand-2` (Purple)
    * **Warnings:** `--accent-warning` (Amber)
    * **Performance:** `--accent-info` (Blue)
* **Interactivity:** Clicking a bar in the SVG will automatically scroll the Center Pane to the corresponding timestamp bucket.

### Column 2: Zero-Context Issue Feed (Center Pane)
This column acts as the raw feed, displaying *only* lines classified as anomalous. 

* **Aggressive Filtering:** The data provider will aggressively drop any line mapped as `info`, `debug`, or `notice`. It relies on the optimized linear `O(N)` regex severity scanner introduced in `level-classifier.ts` to prevent Extension Host CPU lockups during high-volume streaming.
* **Zero Context Guarantee:** Preceding and succeeding nominal log lines are explicitly dropped from the virtualized render array. The feed relies entirely on the density of the issues themselves. Stack traces (e.g., `TimeoutException`) will still collapse into a single toggleable row, maintaining the grid alignment fixes applied to stack headers.
* **Selection Mechanics:** Clicking a row applies an inset shadow highlight (to avoid nudging the target row layout) and triggers the rendering of the Right Pane.

### Column 3: Detailed Report & Export (Right Pane)
Hidden by default, this pane slides in when an issue in the Center Pane is selected, providing deep diagnostic breakdown.

* **Component Reuse:** This pane will structurally reuse the HTML generation logic from the existing Saropa Signal Report, specifically importing the `Session Overview`, `Evidence`, and `Cross-Session History` sections.
* **Health Score Parsing:** If the selected item is a Signal (e.g., *ANR risk: medium (score 50)*), the panel will explicitly render the deductions (e.g., `2 errors -20`, `6 networkFailures -15`) that contributed to the session's overall health score.

---

## 3. The "Copy Report" Action & LLM Handoff

To seamlessly bridge the gap between logging and AI-assisted debugging, the UI provides a frictionless way to extract the isolated issue for external tools (e.g., pasting into an LLM context or ticketing system).

* **UI Trigger:** A **Copy Report** button will be attached to the header of Column 3, and as a right-click context menu item on rows in Column 2.
* **Payload Optimization:** The clipboard payload will format as clean Markdown. 
* **Strict Context Boundary:** The copied text will explicitly enforce the zero-context rule. It will contain *only*:
    1.  The Event Type & Severity.
    2.  Environmental metadata (App version, OS, Device, Git Commit).
    3.  The exact fault lines (e.g., `Drift SLOW 505ms SELECT...` or the `TimeoutException` trace).
* **Rationale:** By stripping the surrounding noise, we prevent LLM token-window bloat and eliminate hallucinations caused by irrelevant background threads.

---

## 4. Required Catalog Updates

Following the strict rules in `CONTRIBUTING.md` and `CLAUDE.md`, the following internal tracking files must be updated prior to the PR:

1.  **`webview-outbound-message-types.md`:** Register the new `troubleModeRenderData` payload structure.
2.  **`l10n/` Bundles:** All new UI strings (e.g., "Copy Report", "Trouble Mode") must be added to the English source bundle so they can be processed by the NLLB-200-3.3B translation pipeline for the 10 supported locales.
3.  **Command Palette:** Register a new command `saropaLogCapture.troubleMode.toggle` in `package.json`.

```text
// Example: Strict Payload extraction logic for Copy Report
export function formatTroublePayload(issueLine: LogLine, sessionMeta: SessionMeta): string {
    return `
### Diagnostic Report
**Severity:** ${issueLine.severity}
**Timestamp:** ${issueLine.timestamp}
**Environment:** ${sessionMeta.os} | ${sessionMeta.deviceName}
**Commit:** ${sessionMeta.gitCommit}

**Fault Evidence:**
${issueLine.rawText}
    `.trim();
}
```