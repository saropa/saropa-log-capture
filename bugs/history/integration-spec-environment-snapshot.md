# Spec: Environment and Config Snapshot Integration

**Adapter id:** `environment`  
**Status:** Implemented  
**Design:** Implemented; see provider in `src/modules/integrations/providers/environment-snapshot.ts` and this spec.

## Goal

Attach env checksum and config file hashes for reproducibility without storing secrets.

## Config

- `saropaLogCapture.integrations.adapters` includes `environment`
- `saropaLogCapture.integrations.environment.*`: includeEnvChecksum, configFiles[], includeInHeader

## Implementation

- **Provider:** `onSessionStartSync`: compute hash of launch config env (redacted); for each configFiles path read file and hash; return header line(s) + meta. No raw env or config content.
- **Viewer:** "Environment" section with checksums; optional "Compare config" command.
- **Performance:** Sync; small reads. Only hashes.
- **Status bar:** "Environment" when contributed.

## UX

- No spinner. Checksums only; no sensitive data.
