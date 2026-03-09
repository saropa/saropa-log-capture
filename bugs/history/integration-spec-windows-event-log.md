# Spec: Windows Event Log Integration

**Adapter id:** `windowsEvents`  
**Status:** Implemented  
**Design:** Implemented; see provider in `src/modules/integrations/providers/windows-event-log.ts` and this spec.

## Goal

Optionally attach time-bounded Windows Event Log entries (Application, System, optionally Security) to the session so "what else happened" during the run is visible. Windows only.

## Config

- `saropaLogCapture.integrations.adapters` includes `windowsEvents`
- `saropaLogCapture.integrations.windowsEvents.*`: logs (Application, System), levels, lead/lag minutes, maxEvents, includeSecurity (default false), output (sidecar/header/both)

## Implementation

- **Provider:** `onSessionEnd` only. Query via PowerShell `Get-WinEvent` or wevtapi; time range from `context.sessionStartTime` / `sessionEndTime` + lead/lag.
- **Output:** Sidecar `basename.events.json`; optional one summary line in meta. No sync header (data not available at start).
- **Performance:** Run after session stop; cap maxEvents; do not block finalize. Log errors to output channel.
- **Status bar:** Show "Windows events" when this adapter is in `integrations.adapters` and contributed (end-phase); registry returns contributorIds from runOnSessionEnd.

## UX

- Loading: no spinner at start; at end write sidecar in background. Viewer shows "Open Windows events" when sidecar exists.
- Clear in settings when adapter disabled.
