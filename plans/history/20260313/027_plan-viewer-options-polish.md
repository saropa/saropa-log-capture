# Plan: Viewer / Options optional polish

**Status:** Implemented.

**Feature:** Small UX improvements: Export in Options → Actions; rename "Presets" to "Quick Filters" in UI copy.

---

## What exists

- Export available via context menu "Export current view…".
- Options panel has Quick Filters (presets), Display (word wrap, etc.), Integrations, Layout, Audio, Actions (reset to default, reset extension settings).
- Footer & Filter UX consolidation is complete; Filters panel holds presets, Output Channels, Log Tags, Noise Reduction.

## What's missing

1. **Export in Options → Actions** — Add an Export button to the Options panel Actions section so users can export without opening the context menu.
2. **"Presets" → "Quick Filters" UI copy** — Any remaining labels or strings that still say "Preset(s)" should say "Quick Filters" for consistency.

## Implementation

### 1. Export button in Options Actions

- In the Options panel HTML (e.g. `viewer-options-panel-html.ts` or equivalent), add a button in the Actions section: "Export current view" that triggers the same flow as the context menu export.
- Wire the button to the existing export command or handler (e.g. `saropaLogCapture.exportHtml` or the handler used by "Export current view…").
- Ensure the button is only enabled when a log/session is available to export.

### 2. Rename Presets → Quick Filters in copy

- Search codebase and l10n for "Preset", "Presets"; replace user-facing strings with "Quick Filters" where they refer to the filter presets dropdown/section.
- Do not change variable or config names unless they are user-visible (e.g. preset IDs can stay).

## Files to modify

| File | Change |
|------|--------|
| Options panel HTML/script (viewer-options-panel-*) | Add Export button in Actions; wire to export |
| `l10n.ts` + bundles | Add string for "Export current view" in Options if needed; ensure "Quick Filters" used for preset section title |
| Any viewer UI that still shows "Preset" | Replace with "Quick Filters" |

## Effort

**1–2 days.** Low risk; additive.
