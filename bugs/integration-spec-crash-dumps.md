# Spec: Crash Dumps Integration

**Adapter id:** `crashDumps`  
**Status:** Not implemented  
**Full design:** [docs/integrations/crash-dumps.md](../docs/integrations/crash-dumps.md)

## Goal

Discover crash dump files (.dmp, .core) created in the session time window and attach list/link to session.

## Config

- `saropaLogCapture.integrations.adapters` includes `crashDumps`
- `saropaLogCapture.integrations.crashDumps.*`: searchPaths[], extensions, leadMinutes, lagMinutes, maxFiles, copyToSession, includeInHeader

## Implementation

- **Provider:** `onSessionEnd`: scan searchPaths for files matching extensions and mtime in [sessionStart - lead, sessionEnd + lag]; write meta (and optional sidecar) with paths; optionally copy to session folder.
- **Viewer:** "Crash dumps" section with "Open" / "Reveal in folder" per file.
- **Performance:** Scan only configured paths; limit depth and maxFiles. Run at end.
- **Status bar:** "Crash dumps" when any found.

## UX

- No spinner. Section appears when meta has crashDumps list. No sensitive data in header.
