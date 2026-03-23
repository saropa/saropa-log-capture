# DB_01 Drift Advisor Context Popover Upgrade

## Goal
Show richer database context in the existing line popover for `database`-tagged lines, with a first-class handoff to Drift Advisor.

## Scope
- In scope: popover enrichment for DB lines, summary stats, existing "Open in Drift Advisor" affordance.
- Out of scope: new timeline/minimap visuals, cross-session diffs.

## Implementation Plan
1. Add DB insight shape to viewer line metadata (fingerprint, seen count, optional duration stats).
2. Extend popover rendering to show a compact "Database insight" section only when DB metadata exists.
3. Keep current Drift Advisor availability checks; gate CTA visibility on extension presence.
4. Add copy-friendly SQL snippet rendering (trim long text, keep full value available via tooltip/title).

## UX Rules
- Do not show DB section for non-DB lines.
- Keep section compact: fingerprint, count, avg/max duration (if available), action button.
- Reuse existing visual language in popover sections.

## Test Plan
- Unit: popover HTML includes DB section only when DB metadata exists.
- Unit: button visibility respects Drift Advisor availability.
- Contract: existing popover sections still render in same order.

## Risks
- Popover can become too dense; mitigate with truncation and concise labels.

## Done Criteria
- DB lines show meaningful context in popover.
- "Open in Drift Advisor" remains stable and discoverable.

---

## Implementation summary (done)

- **Line metadata:** `dbInsight` on `sourceTag === 'database'` rows (`viewer-data-add.ts` + `parseSqlFingerprint` / `updateDbInsightRollup` in `viewer-data-n-plus-one-script.ts`). Single `parseSqlFingerprint` per line shared with N+1 detection.
- **Popover:** `buildDatabaseInsightPopoverSection` in `viewer-context-popover-script.ts` (fingerprint, safe seen count, avg/max ms, truncated SQL + `title`, Drift CTA if `driftAdvisorAvailable`). Styles in `viewer-context-popover-styles.ts`.
- **Host:** `hasDatabaseLine` on `showIntegrationContext`; `handleIntegrationContextRequest` allows empty window when DB line or Drift meta (`context-handlers.ts`, `shouldPostNoIntegrationDataError` for tests).
- **Context menu:** Open in Drift Advisor for `database` source tag when extension present (`viewer-context-menu.ts`).
- **Tests:** `viewer-context-popover-db-insight.test.ts`, `context-handlers-integration-popover-gate.test.ts`, N+1 / drift fingerprint tests updated.
- **Samples:** `examples/integration-context-popover-db-sample.txt` for manual QA.
