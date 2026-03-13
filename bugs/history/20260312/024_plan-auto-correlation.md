# Plan: Auto-Correlation Detection

**Status:** ✅ IMPLEMENTED (Phases 1–3)

**Implemented:** 2026-03-12

---

## Implementation Summary

**Core:** New `src/modules/correlation/` module: `correlation-types.ts` (Correlation, CorrelatedEvent, CorrelationType), `anomaly-detection.ts` (extractors and predicates from TimelineEvent summary/detail), `correlation-detector.ts` (sliding-window detection, meetsMinConfidence, deduplicateCorrelations), `correlation-store.ts` (in-memory per-session store, getCorrelationByLocation). Detection runs after timeline load with a "Detecting correlations…" loading phase; race guard ensures results apply only to the session still open.

**UI:** Timeline panel shows ▶ badge on correlated event rows; click highlights all events in the same correlation. Log viewer receives setCorrelationByLineIndex when loading a session log and shows ▶ on lines that are part of a correlation. A **Correlations** block inside the timeline panel (below the toolbar) lists detected correlations for the current session with "Jump to event" links; the block is shown only when correlations exist. (Originally a separate sidebar view; integrated into the timeline panel for a single, cohesive view.)

**Config:** Settings `correlation.enabled`, `correlation.windowMs`, `correlation.minConfidence`, `correlation.types`, `correlation.maxEvents`. L10n for config and view; correlation panel uses inline strings (could be wired to host t() for full i18n later).

**Key files:** All under `src/modules/correlation/`, `timeline-panel.ts`, `timeline-panel-script.ts`, `timeline-panel-styles.ts`, `log-viewer-provider-load.ts`, `viewer-script.ts`, `viewer-script-messages.ts`, `viewer-data-helpers-render.ts`, `viewer-styles-content.ts`, `activation-providers.ts`, `package.json`, `package.nls*.json`, `l10n.ts`. Unit tests: `src/test/modules/correlation/correlation-detector.test.ts`.

**Phase 4 (learning/feedback)** not implemented.

---

## Original plan (reference)

**Feature:** Automatically detect and highlight events that appear related across sources (e.g., HTTP 500 and memory spike occurring within 1 second).

**Depends on:** Unified Timeline (Task 102 / plan 020) for timestamped events from all sources.

---

## What exists

- Timeline View (planned) provides events from all sources with timestamps
- Error fingerprinting identifies recurring error patterns
- Performance fingerprinting identifies slow operations
- Session metadata stores integration data with `capturedAt` timestamps

## What's missing

1. **Correlation algorithm**: Detect events that co-occur within a time window
2. **Correlation types**: Define what relationships to look for
3. **Confidence scoring**: Rank correlations by likelihood
4. **UI indicators**: Show correlation badges/links in viewer and timeline
5. **Correlation panel**: View all detected correlations for a session

---

*(Rest of original plan content omitted for brevity; see git history for full document.)*
