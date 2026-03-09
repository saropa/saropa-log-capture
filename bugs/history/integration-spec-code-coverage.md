# Spec: Code Coverage Integration

**Adapter id:** `coverage`  
**Status:** Implemented  
**Design:** Implemented; see provider in `src/modules/integrations/providers/code-coverage.ts` and this spec.

## Goal

Attach last coverage run summary (line %) and link to coverage report.

## Config

- `saropaLogCapture.integrations.adapters` includes `coverage`
- `saropaLogCapture.integrations.coverage.*`: reportPath (e.g. coverage/lcov.info), includeInHeader

## Implementation

- **Provider:** `onSessionStartSync`: read reportPath; parse lcov or Cobertura summary (line-rate); return header line + meta with linePercent and reportPath.
- **Viewer:** "Coverage: 78%" with "Open report" link.
- **Performance:** Sync read; parse only summary section; cap read size.
- **Status bar:** "Coverage" when contributed.

## UX

- No spinner. Single line and link. Optional future: line-level covered/uncovered on "Go to source."
