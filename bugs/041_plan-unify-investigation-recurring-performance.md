# Plan: Unify Investigation, Recurring, and Performance into One Entity

**Status:** Draft  
**Created:** 2026-03-17

---

## Goal

Today "Investigations," "Recurring Errors," and "Performance" are three separate concepts and three separate UI entry points. Users find this confusing. Unify them into **one named entity, one icon bar entry, and one panel**, with three sub-views (tabs or sections) so there is a single place to go for "working with logs beyond a single session."

---

## Current Architecture (Research Summary)

### 1. Where the three live today

| Concept | UI location | How it’s opened | Backing logic |
|--------|-------------|------------------|----------------|
| **Investigations** | Section at top of **Project Logs** slide-out panel | Click "Project Logs" in icon bar; section shows list + "Create Investigation…"; click item → opens Investigation panel | [viewer-session-panel-html.ts](src/ui/viewer-panels/viewer-session-panel-html.ts), [viewer-session-panel.ts](src/ui/viewer-panels/viewer-session-panel.ts). Messages: `requestInvestigations`, `investigationsList`, `createInvestigationWithName`, `createInvestigationError`, `openInvestigationById`. Handler: [viewer-message-handler.ts](src/ui/provider/viewer-message-handler.ts). Store: [investigation-store.ts](src/modules/investigation/investigation-store.ts). |
| **Recurring Errors** | Dedicated slide-out panel | Icon bar button "Recurring" | [viewer-recurring-panel.ts](src/ui/panels/viewer-recurring-panel.ts) (HTML + script). Messages: `requestRecurringErrors`, `recurringErrorsData`, `setRecurringErrorStatus`. Handlers: [recurring-handlers.ts](src/ui/shared/handlers/recurring-handlers.ts) → `handleRecurringRequest`, `handleSetErrorStatus`. Data: [cross-session-aggregator.ts](src/modules/misc/cross-session-aggregator.ts) `aggregateInsights()` → `recurringErrors`. |
| **Performance** | Dedicated slide-out panel | Icon bar button "Performance"; also "Performance" chip in session nav bar (when log has perf data) | [viewer-performance-panel.ts](src/ui/panels/viewer-performance-panel.ts) (HTML + script). Tabs: Current, Trends, Log. Messages: `requestPerformanceData` → `performanceData`. Handler: [context-handlers.ts](src/ui/shared/handlers/context-handlers.ts) `handlePerformanceRequest`. Data: [perf-aggregator.ts](src/modules/misc/perf-aggregator.ts), session metadata `integrations.performance`. |

### 2. Panel slot and icon bar

- All viewer slide-out panels live in **one container**: `#panel-slot` in [viewer-content.ts](src/ui/provider/viewer-content.ts). Panels are stacked in the same grid cell; only one has `.visible` at a time.
- Panel visibility and width are controlled by [viewer-icon-bar.ts](src/ui/viewer-nav/viewer-icon-bar.ts): `setActivePanel(name)` closes all, sets `activePanel`, calls `updatePanelSlotWidth(name)`, then opens the panel for that name (e.g. `openRecurringPanel()`, `openPerformancePanel()`, `openSessionPanel()`).
- Icon bar buttons: `ib-sessions` (Project Logs), `ib-recurring`, `ib-performance`, etc. Each toggles one panel.

### 3. Separate WebviewPanels (not in viewer)

- **Investigation panel** ([investigation-panel.ts](src/ui/investigation/investigation-panel.ts)): Opens when user opens an investigation from the list or runs `saropaLogCapture.openInvestigation`. A separate `vscode.WebviewPanel` showing pinned sources, search, notes, share/export. **Stays as-is** — it is the detail view for one investigation.
- **Insights panel** ([insights-panel.ts](src/ui/insights/insights-panel.ts)): "Saropa Cross-Session Insights" — separate `vscode.WebviewPanel` with hot files + recurring errors + environment, time range, drill-down. Opened by command `saropaLogCapture.showInsights` or from Recurring panel footer "Open Full Insights." **Name "Insights" is already in use** for this full report.

### 4. Commands and entry points

- **Investigation:** `createInvestigation`, `openInvestigation`, `closeInvestigation`, `switchInvestigation`, `addToInvestigation`, `removeFromInvestigation`, `deleteInvestigation`, `shareInvestigation`, `exportInvestigation`, `newInvestigationFromSessions` (package.json, [commands-investigation.ts](src/commands-investigation.ts), share/export commands).
- **Session context menu** (right-click session in Project Logs): "Add to Investigation" → `addToInvestigation` with item URI ([viewer-session-context-menu.ts](src/ui/viewer-context-menu/viewer-session-context-menu.ts), [viewer-handler-sessions.ts](src/ui/provider/viewer-handler-sessions.ts)).
- **Recurring:** No dedicated command in palette; `saropaLogCapture.refreshRecurringErrors` is invoked from [session-lifecycle-finalize.ts](src/modules/session/session-lifecycle-finalize.ts) after metadata scans (no UI button).
- **Performance:** No dedicated command; opened only via icon bar or session bar "Performance" chip.
- **Insights (full):** `saropaLogCapture.showInsights`, `saropaLogCapture.exportInsightsSummary`; Recurring panel footer "Open Full Insights" / "Export summary" post `openInsights` / `exportInsightsSummary` ([viewer-message-handler-panels.ts](src/ui/provider/viewer-message-handler-panels.ts)).

### 5. Styles

- Session panel (including Investigations section): [viewer-styles-session-panel.ts](src/ui/viewer-styles/viewer-styles-session-panel.ts), composed in [viewer-styles-session.ts](src/ui/viewer-styles/viewer-styles-session.ts).
- Recurring: [viewer-styles-recurring.ts](src/ui/viewer-styles/viewer-styles-recurring.ts).
- Performance: [viewer-styles-performance.ts](src/ui/viewer-styles/viewer-styles-performance.ts).
- All composed in [viewer-styles.ts](src/ui/viewer-styles/viewer-styles.ts).

### 6. Data and behaviour (no change in this plan)

- Investigation store, recurring aggregator, performance aggregator, and all backend logic remain unchanged. Only UI and navigation are unified.

---

## Naming Constraint

**"Insights" is already used** for the separate Cross-Session Insights WebviewPanel (hot files + recurring errors + env). So the unified **slide-out** panel needs a different umbrella name. Options:

| Name | Pros | Cons |
|------|------|------|
| **Workspace** | One place for “your log workspace” | Might sound like “workspace folder” |
| **Overview** | Clear, neutral | Slightly vague |
| **Summary** | Suggests aggregated view | Could clash with “Export summary” |
| **Dashboard** | Familiar pattern | Might imply more widgets than we have |
| **Log hub** | Distinct | Informal |

**Recommendation:** **Overview** — one word, clear, and not overloaded in the codebase. Tab labels inside: **Cases** (investigations), **Recurring errors**, **Performance**.

(If the product later renames the Cross-Session panel to e.g. "Full report," the slide-out could be renamed to "Insights" then.)

---

## Target Architecture

### One entity, one name, one UI

- **One icon bar button:** e.g. "Overview" (replaces Recurring and Performance buttons; Investigations section is removed from Project Logs).
- **One slide-out panel:** "Overview" with a **tab strip** at the top: **Cases** | **Recurring errors** | **Performance**.
- **Cases tab:** Same content as current Investigations section (list of investigations, create form, click to open investigation). Same messages and handlers.
- **Recurring errors tab:** Same content as current Recurring panel (list, refresh, footer with "Open Full Insights" and "Export summary"). Same messages and handlers.
- **Performance tab:** Same content as current Performance panel (Current / Trends / Log sub-tabs). Same messages and handlers.

### What stays unchanged

- **Project Logs** panel: Session list, toggles, date range, tags, pagination only. No Investigations section.
- **Investigation panel** (WebviewPanel): Still opens when user opens a case; no change.
- **Insights panel** (WebviewPanel): Still "Saropa Cross-Session Insights"; "Open Full Insights" from Recurring tab still opens it.
- All commands (`createInvestigation`, `openInvestigation`, `addToInvestigation`, etc.): Behaviour unchanged; they may open the Overview panel and switch to Cases tab when relevant (see below).
- Session context menu "Add to Investigation": Unchanged; can open Overview and focus Cases if needed.

---

## Implementation Outline

### Phase 1: New Overview panel shell

1. **New files**
   - `src/ui/panels/viewer-overview-panel.ts` (or `viewer-panels/` if preferred): exports `getOverviewPanelHtml()`, `getOverviewPanelScript()`. HTML: one container with header "Overview", tab strip (Cases, Recurring errors, Performance), and three tab panes. Only the active tab pane is visible (or content is injected on tab switch).
   - `src/ui/viewer-styles/viewer-styles-overview.ts`: Styles for overview container, tab strip, and tab panes (reuse or wrap existing panel styles).

2. **Reuse existing content**
   - **Option A (recommended):** In the Overview panel HTML, **include the same DOM structure** as the current Recurring and Performance panels (and the Investigations block from the session panel) inside the three tab panes. Reuse existing panel scripts by calling the same `open*`/`close*` logic only when that tab is active (e.g. when "Recurring errors" tab is selected, call the equivalent of `openRecurringPanel()` to show loading and post `requestRecurringErrors`; when switching away, no need to "close" — just hide the pane). Script: Overview script handles tab clicks and show/hide panes; for each pane it invokes or inlines the existing render/request logic (requestInvestigations, requestRecurringErrors, requestPerformanceData when tab becomes active).
   - **Option B:** Keep Recurring and Performance as separate HTML chunks but **hide them in the main viewer** and **clone or reference their content** inside the Overview panel. More complex and may duplicate state.
   - **Option C:** Extract the "content" part of each panel (without the outer panel header/close) into shared fragments; Overview panel composes the three fragments and adds one header + tab strip. Cleaner long-term but more refactor.

   For minimal risk and clear rollback, **Phase 1 should use Option A**: one Overview panel that contains three tab panes; each pane’s content is the same structure and script behaviour as the current standalone panel (investigations list + form, recurring list + footer, performance current/trends/log). Script loading: Overview script can embed or require the same request/render logic (e.g. when Cases tab is shown, run `requestInvestigations()` and on message `investigationsList` run the same `renderInvestigationsList`; when Recurring tab is shown, post `requestRecurringErrors` and on `recurringErrorsData` render the list). Shared message listener in the viewer already dispatches by `msg.type`, so no change to message handlers.

3. **Viewer content and icon bar**
   - In [viewer-content.ts](src/ui/provider/viewer-content.ts): Add `getOverviewPanelHtml()` and `getOverviewPanelScript()` to the panel-slot; **remove** `getRecurringPanelHtml()` and `getPerformancePanelHtml()` from the slot (and their script tags). So the slot now contains Search, Session, Find, Bookmark, Trash, Filters, Options, Crashlytics, **Overview**, About.
   - In [viewer-icon-bar.ts](src/ui/viewer-nav/viewer-icon-bar.ts): Remove `ib-recurring` and `ib-performance` buttons. Add one `ib-overview` button (icon + label "Overview"). In `iconButtons`, remove `recurring` and `performance`, add `overview`. In `closeAllPanels`, call `closeOverviewPanel` instead of `closeRecurringPanel` and `closePerformancePanel`. In `setActivePanel`, when `name === 'overview'` call `openOverviewPanel()`. Remove click handlers for recurring and performance; add click handler for overview.
   - Ensure `openOverviewPanel` and `closeOverviewPanel` are defined in the Overview panel script and registered on `window` (same pattern as other panels).

### Phase 2: Remove Investigations from Project Logs

1. In [viewer-session-panel-html.ts](src/ui/viewer-panels/viewer-session-panel-html.ts): Remove the entire Investigations block (header "Investigations", hint, list, create row, create form).
2. In [viewer-session-panel.ts](src/ui/viewer-panels/viewer-session-panel.ts): Remove all investigations-related script: `requestInvestigations`, `createInvestigationInProgress`, `setCreateInvestigationLoading`, `showCreateInvestigationForm`, `renderInvestigationsList`, `bindCreateInvestigationForm`, and the message handling for `investigationsList`, `createInvestigationError`. Remove the call to `requestInvestigations()` from `openSessionPanel`. Remove `bindCreateInvestigationForm()`.
3. In [viewer-styles-session-panel.ts](src/ui/viewer-styles/viewer-styles-session-panel.ts): Remove styles for `.session-investigations*` and the create form.
4. **Message handler** ([viewer-message-handler.ts](src/ui/provider/viewer-message-handler.ts)): **Keep** `requestInvestigations`, `openInvestigationById`, `createInvestigationWithName`, and `postInvestigationsList` — the Overview panel’s Cases tab will send these messages. No change to handler logic.

### Phase 3: Entry points and commands

1. **Commands that open "an investigation" or "recurring/performance":**
   - If a command currently opens the Recurring or Performance panel (none in palette today), change it to open Overview with the right tab (e.g. post `openOverviewTab` with `tab: 'recurring'`).
   - Optional: When `createInvestigation` or `openInvestigation` is run from the palette, focus the viewer (or ensure Overview is open) and switch to Cases tab — so the user sees where their list lives. Same for any future "Open Performance" command: open Overview and switch to Performance tab.

2. **Session bar "Performance" chip:** Currently opens the Performance panel. Change to open the Overview panel and switch to the Performance tab (e.g. post a message that Overview script interprets as "open and select Performance tab").

3. **Recurring panel footer "Open Full Insights":** Still posts `openInsights`; handler runs `showInsights`. No change. The Recurring **tab** inside Overview will have the same footer.

4. **refreshRecurringErrors** (session-lifecycle-finalize): Today it runs a command; if that command is removed, either keep a command that posts a refresh to the webview (e.g. "Overview refresh recurring") or have the extension post a message to the viewer when recurring data should refresh; Overview panel script, when Recurring tab is visible, can then call `requestRecurringErrors` again. Prefer keeping a lightweight command that the viewer can react to if open.

### Phase 4: L10n and docs

1. Add strings for "Overview," "Cases," and any updated tooltips. Reuse existing "Recurring errors" and "Performance" for tab labels.
2. Update README and CHANGELOG: describe Overview as the single place for cases, recurring errors, and performance; Project Logs is session list only.

### Phase 5: Cleanup and testing

1. Remove dead code: any script or style that was only used by the standalone Recurring or Performance panels and is now fully in Overview.
2. Verify: Open Overview → Cases: list loads, create works, open investigation opens Investigation panel. Recurring tab: list loads, status and footer work. Performance tab: Current/Trends/Log work, session bar chip opens Overview on Performance tab.
3. Verify: Project Logs shows only session list; no Investigations section. Session context menu "Add to Investigation" still works (opens Investigation or prompts; optional: open Overview to Cases).

---

## File-by-File Impact Summary

| File | Change |
|------|--------|
| **New** `src/ui/panels/viewer-overview-panel.ts` | Overview panel HTML + script (tabs + three panes reusing current behaviour). |
| **New** `src/ui/viewer-styles/viewer-styles-overview.ts` | Styles for overview + tab strip; may import or duplicate recurring/performance/session-investigation styles for the panes. |
| [viewer-content.ts](src/ui/provider/viewer-content.ts) | Add Overview panel HTML/script; remove Recurring and Performance panel HTML/script from slot. Compose overview styles. |
| [viewer-styles.ts](src/ui/viewer-styles/viewer-styles.ts) | Add `getOverviewPanelStyles()` (or overview styles); can remove or keep `getRecurringPanelStyles` and `getPerformancePanelStyles` if inlined into overview. |
| [viewer-icon-bar.ts](src/ui/viewer-nav/viewer-icon-bar.ts) | One Overview button; remove Recurring and Performance buttons; update iconButtons, closeAllPanels, setActivePanel, click handlers. |
| [viewer-session-panel-html.ts](src/ui/viewer-panels/viewer-session-panel-html.ts) | Remove Investigations block. |
| [viewer-session-panel.ts](src/ui/viewer-panels/viewer-session-panel.ts) | Remove all investigations-related script and message handling. |
| [viewer-styles-session-panel.ts](src/ui/viewer-styles/viewer-styles-session-panel.ts) | Remove investigations and create-form styles. |
| [viewer-message-handler.ts](src/ui/provider/viewer-message-handler.ts) | No structural change; Overview Cases tab will send same messages. Optional: handle `openOverviewTab` to switch tab from extension. |
| [viewer-script-messages.ts](src/ui/viewer/viewer-script-messages.ts) | If session bar Performance chip or integration adapter visibility toggles "Performance" panel, update to open Overview + Performance tab. |
| [viewer-performance-panel.ts](src/ui/panels/viewer-performance-panel.ts) | Logic (tab switching, requestPerformanceData, render) may be inlined or required from Overview script; or panel script is kept and only invoked when Overview Performance tab is active. Same for [viewer-recurring-panel.ts](src/ui/panels/viewer-recurring-panel.ts). |
| package.json, package.nls.*.json | Add "Overview" where needed; remove or repurpose Recurring/Performance menu items if any. |
| README.md, CHANGELOG.md | Describe Overview; document that Investigations/Cases live in Overview. |

---

## Data Flow (Unchanged)

- **Cases:** Webview posts `requestInvestigations` → handler calls `postInvestigationsList(ctx, store)`. Posts `createInvestigationWithName` → handler creates, sets active, shows Investigation panel, posts `investigationsList`. Posts `openInvestigationById` → handler sets active, shows Investigation panel. No change.
- **Recurring:** Webview posts `requestRecurringErrors` → `handleRecurringRequest(post)`. Posts `setRecurringErrorStatus` → `handleSetErrorStatus`. No change.
- **Performance:** Webview posts `requestPerformanceData` → `handlePerformanceRequest(post, currentFileUri)`. No change.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Duplicated or inconsistent state between "old" panel scripts and Overview | Prefer inlining or single source of truth: one Overview script that owns all three tab contents and reuses the same message types and handlers. |
| Performance tab depends on current log URI | Handler already receives `ctx.currentFileUri`; Overview script does not change that. When Performance tab is active, ensure `requestPerformanceData` is sent so session data is loaded. |
| Recurring panel footer "Open Full Insights" | Keep same message `openInsights`; no change to handler. |
| Session bar "Performance" chip | Update to open Overview and set active tab to Performance (e.g. postMessage to set active tab, then open Overview). |
| refreshRecurringErrors after session finalize | Keep command or equivalent so extension can trigger refresh; Overview Recurring tab can listen or refresh when tab is focused. |

---

## Alternatives Considered

1. **Rename "Insights" and use it for the unified panel:** Would require renaming the Cross-Session Insights WebviewPanel (e.g. to "Full report") and updating all references. Doable but larger change; deferred.
2. **Sections instead of tabs:** All three visible with scroll. Simpler DOM but longer scroll and more visual noise; tabs keep one focus at a time.
3. **Keep Investigations in Project Logs, only merge Recurring + Performance:** Reduces confusion between Recurring and Performance but leaves "Investigation" in a different place; user asked for one entity for all three.

---

## Success Criteria

- One icon bar button and one panel name ("Overview") for Cases, Recurring errors, and Performance.
- Project Logs contains only the session list (and toggles/tags/pagination).
- All existing behaviour preserved: create/open investigation, add to investigation from context menu, recurring list and status, performance Current/Trends/Log, "Open Full Insights," export summary.
- No regression in Investigation panel or Insights panel.

---

## Out of Scope

- Changing the Investigation panel (WebviewPanel) or the Insights panel (WebviewPanel).
- Changing investigation store, recurring aggregator, or performance aggregator logic.
- Adding new features to Cases, Recurring, or Performance content.
