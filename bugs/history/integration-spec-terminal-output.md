# Spec: Terminal Output Integration

**Adapter id:** `terminal`  
**Status:** Implemented
**Design:** Implemented; see provider in `src/modules/integrations/providers/terminal-output.ts`, capture in `src/modules/integrations/terminal-capture.ts`, and this spec.

## Goal

Capture Integrated Terminal output during the debug session and write to sidecar so terminal and debug output are together.

## Config

- `saropaLogCapture.integrations.adapters` includes `terminal`
- `saropaLogCapture.integrations.terminal.*`: whichTerminals (all | active | linked), writeSidecar, prefixTimestamp, maxLines, preserveAnsi

## Implementation

- **Provider:** At session start subscribe to terminal write events (vscode.window.onDidWriteTerminalData or equivalent); buffer per terminal. `onSessionEnd`: flush to basename.terminal.log. Respect whichTerminals and maxLines.
- **Viewer:** "Terminal" tab when sidecar exists; load and render (ANSI if preserveAnsi).
- **Performance:** Buffer in memory; cap maxLines; do not block. Commands "Capture this terminal" / "Stop capturing" to link/unlink.
- **Status bar:** "Terminal" when adapter enabled and capturing.

## UX

- No spinner. Status "Capturing terminal" during session. Tab appears when sidecar exists.
