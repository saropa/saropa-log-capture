# Integrations (user index)

Optional **Saropa Log Capture** integration adapters add session headers, metadata, and sidecar files. Enable them under **Options → Integrations** (or the **Session integrations** QuickPick).

## Saropa Drift Advisor

- **Adapter id:** `driftAdvisor` (shown as **Drift Advisor** in the picker).
- **What you get:** At session end, structured Drift data can appear in session metadata and a `{logBase}.drift-advisor.json` file next to your log when both extensions are set up for it. In the log viewer, **Open in Drift Advisor** appears on relevant lines when the Drift extension is installed.
- **Drift setting:** `driftViewer.integrations.includeInLogCaptureSession` — `none` | `header` | `full` (controls how much Drift contributes; Log Capture’s built-in meta/sidecar path only runs when this is **full**, defaulting to full if unset).
- **Full design and contracts:** [plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md](../../plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md)
- **JSON schema (sidecar / snapshot shape):** [plans/integrations/drift-advisor-session.schema.json](../../plans/integrations/drift-advisor-session.schema.json)
