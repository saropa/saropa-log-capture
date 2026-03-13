# Plan: Export Insights summary

**Status:** Implemented.

**Feature:** Export a summary of recurring errors and hot files (CSV/JSON) for use in reports or tooling.

---

## Summary of implementation

- **Data:** Reused cross-session aggregator; added `loadMetasForPaths` in metadata-loader and `buildInsightsFromMetas` in cross-session-aggregator to support scope by path (current session, investigation). New module `src/modules/insights/insights-summary.ts` builds `ErrorSummary`/`FileSummary`/`InsightsSummary` from `CrossSessionInsights` with optional caps (default 500 errors, 500 files).
- **Export formatters:** `src/modules/export/insights-export-formats.ts` — CSV (two sections: errors, then files) and JSON; CSV escaping uses shared `escapeCsvField` from `export-formats.ts`.
- **Command:** `saropaLogCapture.exportInsightsSummary` — Quick pick scope (current session / current investigation / last 7 days / all), then format (CSV/JSON), then save-as. Progress notification during aggregation. Trigger also from Cross-Session Insights panel (“Export summary” button) and Recurring Errors slide-out (“Export summary” link).
- **L10n:** All user-facing strings in l10n and package.nls.*; command title localized in all locales.
- **Tests:** Unit tests for `buildInsightsSummary`, `formatInsightsSummaryToCsv`, `formatInsightsSummaryToJson` in `src/test/modules/insights/insights-summary.test.ts`. CSV escape tests now use exported `escapeCsvField` from export-formats.

## Original plan (reference)

- Recurring errors / analysis panel; error grouping and fingerprinting existed.
- Needed: insights aggregation across sessions or investigation; CSV/JSON export; command or panel button with scope and format choice; save-as.
- Considerations: privacy (error messages and paths in export); size (cap top 500).
