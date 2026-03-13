# Plan: Investigation Mode

**Status:** ✅ IMPLEMENTED (Phases 3 & 4)

**Implemented:** 2026-03-12

---

## Implementation Summary

**Phase 3 (Export and integration):** SLC manifest v3 and `type: 'investigation'` in `slc-bundle.ts`. `exportInvestigationToSlc()` builds a ZIP with manifest, investigation.json, and sources/ (main logs + sidecars). `importSlcBundle()` dispatches by manifest type; investigation import extracts to log dir and returns new investigation (commands create it in store and open panel). Bug report: `collectInvestigationContext()`, `InvestigationContext` in collector; formatter adds "Investigation Context" section; panel "Generate Bug Report" and viewer report pass extension context. Export/import use `withProgress` for user feedback.

**Phase 4 (UX polish):** Project Logs panel shows an "Investigations" section (requestInvestigations → investigationsList); click to open, "Create Investigation…" runs command. Session context menu "Add to Investigation" runs addToInvestigation with item URI. New command "New Investigation from Sessions…" multi-selects sessions from history and creates investigation. Drag-and-drop to add sources was not implemented (optional). New strings localized (en + placeholders in other locales).

**Key files changed:** `slc-bundle.ts` (manifest v3, export/import), `commands-export.ts`, `commands-investigation.ts`, `bug-report-collector.ts`, `bug-report-formatter.ts`, `bug-report-panel.ts`, `viewer-message-handler.ts`, `viewer-handler-sessions.ts`, `investigation-panel.ts`, `investigation-panel-html.ts`, `viewer-session-context-menu.ts`, `viewer-session-panel*.ts`, `viewer-styles-session-panel.ts`, `l10n.ts`, `package.json`, all `package.nls.*.json`.

---

## Original plan (reference)

**Feature:** Pin multiple sessions and sources into a persistent "investigation" that can be searched together and exported as a bundle.

**Problems Solved:**
- Session ≠ Investigation: bugs span sessions, need terminal + system state bundled together
- Search is siloed: can't search terminal + perf + HTTP together

---

## What exists

- Session list in Project Logs panel (single-session view)
- Find-in-files searches only log files, not sidecars
- `.slc` bundle exports single session with sidecars (added in quick wins)
- Session metadata with integration data
- Bookmarks feature for individual lines
- **Investigation model, store, panel, cross-source search (Phases 1–2, pre-existing)**

## What was missing (now done)

1. ~~Investigation model~~ ✅
2. ~~Active investigation state~~ ✅
3. ~~Cross-source search~~ ✅
4. ~~Investigation panel~~ ✅
5. ~~Investigation export~~ ✅ (Phase 3)
6. ~~Investigation import~~ ✅ (Phase 3)
7. ~~Bug report integration~~ ✅ (Phase 3)
8. ~~Investigations in Project Logs, context menu, New from Sessions~~ ✅ (Phase 4)

---

*(Full sub-feature specs, phases, and success criteria remain as in the original plan document; omitted here for brevity.)*
