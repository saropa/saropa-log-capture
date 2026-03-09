# Spec: WSL and Linux Logs Integration

**Adapter id:** `linuxLogs`  
**Status:** Implemented
**Design:** Implemented; see provider in `src/modules/integrations/providers/linux-logs.ts` and this spec.

## Goal

Attach dmesg and journalctl output for the session time range when target is WSL or remote Linux.

## Config

- `saropaLogCapture.integrations.adapters` includes `linuxLogs`
- `saropaLogCapture.integrations.linuxLogs.*`: when (wsl | remote | always), sources (dmesg, journalctl), leadMinutes, lagMinutes, maxLines, wslDistro

## Implementation

- **Provider:** `onSessionEnd` only. Detect target WSL or extension on Linux; run `dmesg -T` and `journalctl -b --since/--until` (in WSL from Windows: wsl -e bash -c "..."). Write basename.linux.log.
- **Viewer:** "Linux" tab when sidecar exists.
- **Performance:** Run at end; cap maxLines; non-blocking. Document permission requirements.
- **Status bar:** "Linux logs" when contributed at end.

## UX

- No spinner. Tab when sidecar exists. Message when permissions missing.
