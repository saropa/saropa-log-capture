# Unified Plan: View Title Search and Filter UX

## Summary

This plan merges:

- `TITLE_BAR_SEARCH.md` (search-focused feasibility)
- `view-title-filter-bar.md` (broader title-bar filter discussion)

Goal: improve discoverability and speed for common search/filter actions while
keeping the existing high-power filter UI.

## Motivation

Built-in VS Code panels (Problems, Output, Debug Console) expose quick filtering
controls in or near the title/toolbar area. Saropa Log Capture currently relies
on icon-bar buttons plus slide-out panels, which are powerful but less
discoverable.

## API Constraints (Confirmed)

For `WebviewView`, `contributes.menus > view/title` supports command icons only.

Supported:

- command buttons in title bar
- conditional visibility via `when`
- inline placement via `group: "navigation"` and overflow menus

Not supported:

- text inputs in the native title bar
- dropdowns in the native title bar
- custom HTML/widgets in title bar
- native built-in filter widget used by VS Code internal views

Conclusion: a true native title-bar input is not possible for this extension.

## Current State

Current capabilities already exceed native panels in several areas:

- rich search (case, whole word, regex, history)
- level filtering across 7 levels plus context lines
- exclusions with rule-based filtering
- app-only filtering
- filter presets
- active filter indicators

Core issue is discoverability and one-click access, not raw capability.

## Unified Recommendation

Use a hybrid model:

1. add high-value command icons to `view/title` for quick access
2. keep all detailed controls in existing webview panels
3. modernize search presentation by docking search as a top strip inside webview

This gives VS Code-familiar affordances without trying to replicate unsupported
native title-bar inputs.

## UX Model

### Title Bar (extension host commands)

Inline icons (priority order):

1. Search (`focusSearch`)
2. Toggle exclusions (`toggleExclusions`)
3. Toggle app-only (`toggleAppOnly`)
4. Level quick pick (`quickPickLevel`)
5. Existing actions (trash, pop-out) remain

Notes:

- Keep total inline icons to about 4-5 where possible.
- Move lower-priority actions to overflow if crowding occurs.

### Webview (state + rich controls)

Search UI moves from left slide-out to top docked strip:

- compact single-row search controls
- no content overlap
- viewport offset while open
- same search engine and keyboard shortcuts (`Ctrl+F`, `F3`, `Escape`)

Detailed filters (levels panel, exclusions editor, presets, sliders) remain in
existing panels.

## Implementation Plan

### 1) Commands and Menus (`package.json`)

Add commands:

- `saropaLogCapture.focusSearch`
- `saropaLogCapture.toggleExclusions`
- `saropaLogCapture.toggleAppOnly`
- `saropaLogCapture.quickPickLevel`

Add `view/title` menu entries with:

- `when: "view == saropaLogCapture.logViewer"`
- `group: "navigation"` for top-priority inline actions

Optional active/inactive icon swap pattern:

- duplicate menu items with opposite `when` clauses
- use alternate commands/icons (for example, filter on/off)

### 2) Extension Command Handlers

Register handlers that post messages to webview:

- `focusSearch`
- `toggleExclusions`
- `toggleAppOnly`
- `requestLevelState` / `setLevelFilter`

### 3) Webview Message Handling

Handle command messages by calling existing filter/search functions.

After state changes, post back:

- `exclusionsActive`
- `appOnlyActive`
- `levelFilterActive`

### 4) Context Keys for Toolbar State

Update via `setContext`:

- `saropaLogCapture.exclusionsActive`
- `saropaLogCapture.appOnlyActive`
- `saropaLogCapture.levelFilterActive`

### 5) Top-Docked Search Strip

Rework existing search panel layout to top strip:

- anchored at top of webview content area
- collapses to zero height when closed
- shifts viewport top offset when open

No search logic rewrite required; this is mostly HTML/CSS wiring.

### 6) Level Quick Pick

`quickPickLevel` opens multi-select quick pick:

- items: `Verbose`, `Debug`, `Info`, `Warning`, `Error`, `Fatal`, `Unknown`
- preselect current visible levels (fetched via webview round-trip)
- apply by posting selected levels back to webview
- include `Configure...` to open full level panel

## Data Flow

1. user clicks title bar icon
2. extension command posts message to webview
3. webview updates internal state
4. webview sends updated filter-state message
5. extension updates context keys for icon state

## Scope Estimate

Approximate effort:

- `package.json` commands/menus: small
- extension command wiring: small
- webview message plumbing: small
- top-search-strip HTML/CSS + viewport offset: medium
- level quick pick + sync: small/medium

Total: moderate, low risk, mostly UI/plumbing.

## Risks and Mitigations

- Icon crowding in title bar
  - Mitigation: prioritize search + 2 toggles inline, overflow the rest.
- Mixed interaction model confusion
  - Mitigation: keep quick actions in toolbar, detailed config in panels.
- State drift between extension and webview
  - Mitigation: always emit `filterStateChanged` on every relevant mutation.

## Acceptance Criteria

- Search is discoverable via title bar icon and opens top-docked strip.
- `Ctrl+F`, `F3`, and `Escape` behaviors remain intact.
- Exclusions and app-only can be toggled from title bar.
- Level quick pick can set visible levels and reflect current state.
- Toolbar icon states update based on active filter context keys.
- Existing detailed filter panels continue to work unchanged.

## Priority

Low to medium. This is a UX discoverability and convenience enhancement, not a
functional blocker.

## References

- https://code.visualstudio.com/api/ux-guidelines/views
- https://code.visualstudio.com/api/references/contribution-points
- https://github.com/microsoft/vscode/issues/50062
- https://github.com/microsoft/vscode/issues/161753

