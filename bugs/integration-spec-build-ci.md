# Spec: Build and CI Integration

**Adapter id:** `buildCi`  
**Status:** Implemented  
**Design:** Implemented; see provider in `src/modules/integrations/providers/build-ci.ts` and this spec.

## Goal

Attach last build/CI run (status, build ID, link) to the session from file or API (GitHub Actions, Azure, GitLab).

## Config

- `saropaLogCapture.integrations.adapters` includes `buildCi`
- `saropaLogCapture.integrations.buildCi.*`: source (file | github | azure | gitlab), buildInfoPath, githubToken (secret), azurePat, etc.

## Implementation

- **Provider:** `onSessionStartSync` (file): read buildInfoPath JSON; if fresh, return header lines + meta. `onSessionStartAsync` or `onSessionEnd` (API): fetch last run for commit/branch; write meta only (header already written).
- **Viewer:** Show "Build: success #123" with link from meta.integrations.buildCi.
- **Performance:** File read sync and fast. API: async, timeout; do not block start. Store token in secretStorage.
- **Status bar:** "Build" when adapter contributed (sync or async; for async may update after session start if we report end-phase contributors).

## UX

- Loading: "Build: …" with spinner or "Loading…" when source is API; then "Build: success" or "Build: failed". Gradual enhancement.
