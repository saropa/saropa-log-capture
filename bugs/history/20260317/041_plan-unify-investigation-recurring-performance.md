# Plan: Unify into One Concept — Insight

**Status:** Implemented  
**Created:** 2026-03-17  
**Implemented:** 2026-03-17

---

## Implementation summary (2026-03-17)

Phase 1–3 and retirement are complete. **One Insight panel** (icon bar, lightbulb) with three tabs—Cases, Recurring, Performance—replaces the separate Recurring and Performance panels; Investigations moved from Project Logs into Insight → Cases. **Cross-Session Insights WebviewPanel** retired: `showInsightsPanel()` now runs the Open Insight command (viewer’s Insight panel). **Entry points:** `showInsights` and `openInsights` post `openInsight` to the viewer; create/open/add-to-investigation post `openInsight` with tab `cases`; session bar Performance chip opens Insight to Performance tab. **refreshRecurringErrors** command posts `insightRefreshRecurring`; Insight Recurring tab refreshes when visible. **Loading:** Cases and Recurring show "Loading…" / "Loading error data…" while fetching; tab transitions use 0.12s ease. **L10n:** `command.showInsights.title` = "Open Insight". **Docs:** README and CHANGELOG updated. **Out of scope for this implementation:** Unified Insight Model single-view (one scroll, density defaults) and hot files/drill-down in Insight—planned as Phase 2.

---

## Goal

Today **four** separate concepts and UI entry points exist: **Investigations** (list in Project Logs + Investigation panel), **Recurring Errors** (slide-out), **Performance** (slide-out), and **Cross-Session Insights** (separate WebviewPanel with hot files, recurring, environment, drill-down). Unify all four into **one concept**: **Insight**. One name, one entry point, one place. No "investigation or workspace," no separate tabs or panels — one concept called Insight.

---

## Current Architecture (Research Summary)

### 1. Where the four live today

| Concept | UI location | How it’s opened | Backing logic |
|--------|-------------|------------------|----------------|
| **Investigations** | Section at top of **Project Logs** slide-out panel | Click "Project Logs" in icon bar; section shows list + "Create Investigation…"; click item → opens Investigation panel | [viewer-session-panel-html.ts](src/ui/viewer-panels/viewer-session-panel-html.ts), [viewer-session-panel.ts](src/ui/viewer-panels/viewer-session-panel.ts). Messages: `requestInvestigations`, `investigationsList`, `createInvestigationWithName`, `createInvestigationError`, `openInvestigationById`. Handler: [viewer-message-handler.ts](src/ui/provider/viewer-message-handler.ts). Store: [investigation-store.ts](src/modules/investigation/investigation-store.ts). |
| **Recurring Errors** | Dedicated slide-out panel | Icon bar button "Recurring" | [viewer-recurring-panel.ts](src/ui/panels/viewer-recurring-panel.ts) (HTML + script). Messages: `requestRecurringErrors`, `recurringErrorsData`, `setRecurringErrorStatus`. Handlers: [recurring-handlers.ts](src/ui/shared/handlers/recurring-handlers.ts) → `handleRecurringRequest`, `handleSetErrorStatus`. Data: [cross-session-aggregator.ts](src/modules/misc/cross-session-aggregator.ts) `aggregateInsights()` → `recurringErrors`. |
| **Performance** | Dedicated slide-out panel | Icon bar button "Performance"; also "Performance" chip in session nav bar (when log has perf data) | [viewer-performance-panel.ts](src/ui/panels/viewer-performance-panel.ts) (HTML + script). Tabs: Current, Trends, Log. Messages: `requestPerformanceData` → `performanceData`. Handler: [context-handlers.ts](src/ui/shared/handlers/context-handlers.ts) `handlePerformanceRequest`. Data: [perf-aggregator.ts](src/modules/misc/perf-aggregator.ts), session metadata `integrations.performance`. |
| **Cross-Session Insights** | Separate **WebviewPanel** (editor tab) | Command "Cross-Log Insights" or "Open Full Insights" in Recurring panel footer | [insights-panel.ts](src/ui/insights/insights-panel.ts). Hot files, recurring errors (with drill-down), environment, time range, export summary. Data: [cross-session-aggregator.ts](src/modules/misc/cross-session-aggregator.ts) `aggregateInsights(timeRange)`. |

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

### 6. Data and behavior (no change in this plan)

- Investigation store, recurring aggregator, performance aggregator, and all backend logic remain unchanged. Only UI and navigation are unified.

---

## Naming: Insight

The one concept is **Insight** (singular). User-facing name everywhere: Insight. Icon bar, panel title, commands, docs. One concept: Insight.

---

## Decisions: Critical Questions Resolved

The following decisions are fixed before implementation to avoid contradictions and architectural corners.

### 1. Naming collision and Webview fate

**Decision: Retire the separate Cross-Session Insights WebviewPanel in this work.**

- We do **not** keep a second "Full Insights" or "Insights" panel. Having both an "Insight" slide-out and an "Insights" WebviewPanel would confuse users.
- The existing [insights-panel.ts](src/ui/insights/insights-panel.ts) (Saropa Cross-Session Insights) is **retired**. Its features are absorbed into the single Insight surface:
  - **Hot files**, **environment distribution**, **time range**, **drill-down**, and **Export summary** are implemented (or reimplemented) inside the Insight panel (e.g. as part of the Recurring/content area or a dedicated "Summary" surface within Insight).
- Commands `saropaLogCapture.showInsights` and `saropaLogCapture.exportInsightsSummary`: **retarget** to open/focus the Insight panel and trigger the appropriate action (e.g. export from within Insight). No separate WebviewPanel is opened.
- The Recurring-panel footer "Open Full Insights" and "Export summary" are removed as separate actions; they become "Open Insight" (if not already open) and "Export summary" from within Insight.

### 2. Context: local vs global state

**Decision: Make scope explicit in the UI; Performance (current log) updates with the active log.**

- **Performance** (especially "Current" and "Log" sub-views) is **local** to the currently active session/log. When the user switches to a different log in the viewer, the Performance tab (or the Current/Log portion) **updates** to reflect the new log. Implementation: when the active document/URI changes and the Insight panel is open on the Performance tab, post or re-request performance data for the new URI.
- **Cases** and **Recurring** are **global** (all sessions / workspace). They do not change when the user switches logs.
- **UI:** Add minimal scope cues so the user understands the difference: e.g. a short label on the Performance tab or its "Current" section like "Current log: &lt;filename&gt;" (or "No log open"), and for Recurring/Cases a cue like "All sessions" or no label (global is the default). No heavy redesign—just enough to avoid confusion.

### 3. Tabs vs single narrative

**Decision: Tabs are an optional Phase 1 stepping-stone. The design target is the Unified Insight Model (one scroll, one story; see below).**

- **Design target:** The **Unified Insight Model** (one vertical dashboard, context-aware, Cases as destination with inline add-to-case) is the intended final UX. No tabs in the target; data in the panel talks to each other. Open design decisions (Hero, density, add-to-case mechanic) must be resolved before implementing the single view.
- **Phase 1 options:** (a) **Tabbed** panel (Cases | Recurring | Performance) to ship the merge with minimal risk and reuse; then refactor to the single view. (b) **Single view first:** implement the Unified Insight Model in Phase 1 using the guidelines and resolved decisions; no tabs. Current plan text assumes (a); switching to (b) uses the Unified Insight Model section as the spec.

### 4. Discoverability

**Decision: "Add to Investigation" opens Insight and focuses the Cases tab. Default tab favors discoverability.**

- **Context menu:** When the user chooses "Add to Investigation" from the session context menu, the extension opens the Insight panel (if not already open) and **switches to the Cases tab** so the user sees where the add happened and can create or pick an investigation. No silent add with no visual feedback.
- **Commands:** When `createInvestigation` or `openInvestigation` is run from the palette, open/focus Insight and show the **Cases** tab so the user lands in the right place.
- Default tab when opening Insight (see below) is **Cases** to keep "Create Investigation" discoverable despite the extra click to open Insight.

### 5. State retention

**Decision: Default tab = Cases. Remember last active tab across close/reopen and reload.**

- **Default tab:** When a user clicks the Insight icon for the first time (or has no persisted state), the **Cases** tab is active. This supports discoverability of investigations.
- **Persistence:** The last active tab is **persisted** (e.g. in webview state or `workspaceState`). When the user reopens the Insight panel after closing it, or after reloading VS Code, the panel restores the **last active tab** (Cases, Recurring, or Performance). Implementation: save tab id on tab change; on `openInsightPanel()` read and apply saved tab (or default to Cases).

---

## Target Architecture

### One concept, one name, one UI

- **One icon bar button:** **Insight** (replaces Recurring and Performance buttons; Investigations section is removed from Project Logs).
- **One panel:** **Insight** — single place for working with logs beyond a single session. Target UX is the **Unified Insight Model**: one scroll, one story; context-aware (reacts to selected log); Cases as the basket with inline add-to-case. See **Unified Insight Model (Design Target)** below. No tabs in the target design.
- Current behaviors (pinned cases, recurring errors, performance, hot files, export) live under this one entry point; one concept, Insight.

### What gets retired or merged

- **Project Logs:** Investigations section removed; session list only.
- **Recurring slide-out:** Removed; its behavior becomes part of Insight.
- **Performance slide-out:** Removed; its behavior becomes part of Insight.
- **Cross-Session Insights WebviewPanel:** Retired or merged into Insight; no second "Insights" surface.
- **Investigation panel** (WebviewPanel): Replaced or merged into Insight so opening a case is opening Insight (e.g. with that case in context); one concept, one UI.
- Commands and context menu ("Add to Investigation", etc.): Retarget to Insight; naming can be updated to "Insight" where appropriate.

---

## Unified Insight Model (Design Target)

The Insight panel is not just a container for four former surfaces—it is a **smart dashboard** that reacts to what the user is doing. One scroll, one story; no tabs, no mental context-switching. Data in the panel talks to each other.

### Guidelines

1. **One scroll, one story (the vertical dashboard)**  
   A single top-down narrative flow:
   - **Top (macro/global):** Overarching project state—active Cases and top Hot Files / Recurring Errors across all sessions.
   - **Middle (the intersection):** How the **currently selected log** relates to global state (e.g. "This session contains 2 of your top recurring errors").
   - **Bottom (micro/local):** Deep dive into the current log—Performance trends and local anomalies.

2. **Smart surfacing (context-aware UI)**  
   The panel reacts instantly to Project Logs selection:
   - **No log selected:** Show purely global data (Cross-Session Insights, Hot Files, active Cases).
   - **Log selected:** Re-sort and filter. Bring Performance to the forefront; filter/highlight global Recurring errors to show only what is relevant to **this** session.

3. **Cases as the ultimate destination**  
   Investigations/Cases are not a separate management tool—they are the basket. Every data point (recurring error, performance dip, hot file) has an **inline, frictionless action** (e.g. quick "+" or swipe) to attach it to an active Case.

### Open design decisions (to resolve before implementation)

These choices determine how the single narrative is built and how ruthless we are with density and add-to-case.

| # | Question | Options | Recommendation / note |
|---|----------|---------|------------------------|
| **1. Hero of the panel** | When the user opens Insight with a specific log selected, what dominates the top? | **A:** This log’s health (performance dips, errors in this run). **B:** Global context (active cases, cross-session recurring that appear here). | **Context-dependent:** With a log selected, lead with **this log’s relevance** (Option A) so the "intersection" (middle) and "local" (bottom) feel connected. With no log selected, lead with global (Cases + Hot Files + Recurring). Smart surfacing implies the hero changes by context. |
| **2. Information density** | Four data sets in one vertical view risk endless scrolling. How to avoid clutter? | **Accordion:** Collapsible sections (e.g. "› Active Cases (3)", "› Performance Dips"). **Ruthless limit:** Only top N (e.g. 2 Cases, 3 Errors, miniature sparkline). | **Locked in:** Progressive disclosure (accordion) with **strict default limits** per context. Exact counts and expansion states are defined in **Density defaults & expansion states** below. |
| **3. Add-to-case mechanic** | With no dedicated Cases tab, how does the user build an investigation? | **Drag-and-drop:** Drag a metric/recurring error onto a "Pinned Case" zone at top. **Inline:** Small "Add to Case" (or "+") next to every metric. | **Inline actions first:** Lower implementation cost and works on all surfaces (no drop zone to maintain). Optional: add drag-and-drop in a follow-up if usage shows demand. Decide default (e.g. "+" icon with case picker dropdown). |

Once these are fixed, they become part of **Decisions** and the Implementation Outline (and any tabbed Phase 1) should align with the Unified Insight Model so that a later refactor from tabs → single view, or a single-view-first Phase 1, uses this section as the spec.

### Density defaults & expansion states

To keep the single-column design scannable and low-cognitive-load, the Unified Insight panel **enforces strict limits** on what is rendered by default. Hard constraints force good UX. Expansion state and visible counts depend on **context**: no log selected (global) vs log selected (local + intersection).

**State A: No log selected (global context)**

| Section | Default state | Visible content | Expansion |
|--------|----------------|-----------------|-----------|
| **Active Cases** | Expanded | Top **3** most recently modified cases | "View All (X)" link to open full list |
| **Recurring Errors** | Expanded | Top **5** cross-session errors by frequency/impact | — |
| **Hot Files** | Collapsed | Summary only: "X files frequently modified/implicated." | Expanding shows Top **5** |

**State B: Log selected (local + intersection context)**

| Section | Default state | Visible content | Expansion |
|--------|----------------|-----------------|-----------|
| **Performance** | Expanded (Hero) | 1 compact sparkline (e.g. overlaid CPU/Memory trend); up to **3** key metrics (e.g. Duration, Max Memory, Error Count) | — |
| **Errors in this log** | Expanded | Top **3** anomalies/errors in this session only | — |
| **Global intersection (Recurring)** | Collapsed | Summary only: e.g. "2 of your top Recurring Errors appear in this log." | Expanding shows **only those** recurring errors that appear in this log |
| **Active Cases** | Collapsed | Summary/count only | Expanding shows list; user’s primary action here is inline "+" on metrics above, so case list is minimized to save vertical space |

**Why this works:** With a log selected, collapsing Active Cases dedicates top-of-screen real estate to the immediate problem (Performance & local errors). The user doesn’t need the full case list to investigate a specific log—they use the inline "+" to route findings into a case. With no log selected, Cases and Recurring stay expanded so the global picture is visible.

---

## Implementation Outline

### Phase 1: New Insight panel shell

**If building the single view first:** Use the **Unified Insight Model** section as the spec; resolve the remaining open design decisions (Hero, add-to-case) if not already fixed; apply **Density defaults & expansion states** (State A / State B) for section visibility and counts; implement one scroll, context-aware layout, and inline add-to-case. No tab strip.

**If building tabs first (below):** Implement tabbed panel; later refactor to Unified Insight Model.

1. **New files**
   - `src/ui/panels/viewer-insight-panel.ts` (or `viewer-panels/` if preferred): exports `getInsightPanelHtml()`, `getInsightPanelScript()`. HTML: one container with header "Insight". **Tabbed variant:** only the active tab pane is visible. **Single-view variant:** one vertical layout per Unified Insight Model (Top = global, Middle = intersection, Bottom = current log).
   - `src/ui/viewer-styles/viewer-styles-insight.ts`: Styles for Insight container, tab strip, and tab panes (reuse or wrap existing panel styles).

2. **Reuse existing content**
   - **Option A (recommended):** In the Insight panel HTML, **include the same DOM structure** as the current Recurring and Performance panels (and the Investigations block from the session panel) inside the three tab panes. Reuse existing panel scripts by calling the same `open*`/`close*` logic only when that tab is active (e.g. when "Recurring errors" tab is selected, call the equivalent of `openRecurringPanel()` to show loading and post `requestRecurringErrors`; when switching away, no need to "close" — just hide the pane). Script: Insight script handles tab clicks and show/hide panes; for each pane it invokes or inlines the existing render/request logic (requestInvestigations, requestRecurringErrors, requestPerformanceData when tab becomes active).
   - **Option B:** Keep Recurring and Performance as separate HTML chunks but **hide them in the main viewer** and **clone or reference their content** inside the Insight panel. More complex and may duplicate state.
   - **Option C:** Extract the "content" part of each panel (without the outer panel header/close) into shared fragments; Insight panel composes the three fragments and adds one header + tab strip. Cleaner long-term but more refactor.

   For minimal risk and clear rollback, **Phase 1 should use Option A**: one Insight panel that contains three tab panes; each pane’s content is the same structure and script behavior as the current standalone panel (investigations list + form, recurring list + footer, performance current/trends/log). Script loading: Insight script can embed or require the same request/render logic (e.g. when Cases tab is shown, run `requestInvestigations()` and on message `investigationsList` run the same `renderInvestigationsList`; when Recurring tab is shown, post `requestRecurringErrors` and on `recurringErrorsData` render the list). **Cross-Session features** (hot files, environment, time range, drill-down, export summary) are absorbed into the Insight panel—e.g. integrated into the Recurring tab content or a shared "Summary" block—so the separate [insights-panel.ts](src/ui/insights/insights-panel.ts) WebviewPanel can be retired. Shared message listener already dispatches by `msg.type`.

   **State and scope (see Decisions §2, §5):** (a) Persist last active tab in webview/workspace state; on open restore it or default to Cases. (b) When the active log file changes and the Performance tab is visible, re-request performance data for the new `currentFileUri` so the "Current log" view updates. (c) Add minimal scope labels (e.g. "Current log: …" on Performance, "All sessions" on Recurring/Cases as needed).

3. **Viewer content and icon bar**
   - In [viewer-content.ts](src/ui/provider/viewer-content.ts): Add `getInsightPanelHtml()` and `getInsightPanelScript()` to the panel-slot; **remove** `getRecurringPanelHtml()` and `getPerformancePanelHtml()` from the slot (and their script tags). So the slot now contains Search, Session, Find, Bookmark, Trash, Filters, Options, Crashlytics, **Insight**, About.
   - In [viewer-icon-bar.ts](src/ui/viewer-nav/viewer-icon-bar.ts): Remove `ib-recurring` and `ib-performance` buttons. Add one `ib-insight` button (icon + label "Insight"). In `iconButtons`, remove `recurring` and `performance`, add `insight`. In `closeAllPanels`, call `closeInsightPanel` instead of `closeRecurringPanel` and `closePerformancePanel`. In `setActivePanel`, when `name === 'insight'` call `openInsightPanel()`. Remove click handlers for recurring and performance; add click handler for insight.
   - Ensure `openInsightPanel` and `closeInsightPanel` are defined in the Insight panel script and registered on `window` (same pattern as other panels).

### Phase 2: Remove Investigations from Project Logs

1. In [viewer-session-panel-html.ts](src/ui/viewer-panels/viewer-session-panel-html.ts): Remove the entire Investigations block (header "Investigations", hint, list, create row, create form).
2. In [viewer-session-panel.ts](src/ui/viewer-panels/viewer-session-panel.ts): Remove all investigations-related script: `requestInvestigations`, `createInvestigationInProgress`, `setCreateInvestigationLoading`, `showCreateInvestigationForm`, `renderInvestigationsList`, `bindCreateInvestigationForm`, and the message handling for `investigationsList`, `createInvestigationError`. Remove the call to `requestInvestigations()` from `openSessionPanel`. Remove `bindCreateInvestigationForm()`.
3. In [viewer-styles-session-panel.ts](src/ui/viewer-styles/viewer-styles-session-panel.ts): Remove styles for `.session-investigations*` and the create form.
4. **Message handler** ([viewer-message-handler.ts](src/ui/provider/viewer-message-handler.ts)): **Keep** `requestInvestigations`, `openInvestigationById`, `createInvestigationWithName`, and `postInvestigationsList` — the Insight panel’s Cases tab will send these messages. No change to handler logic.

### Phase 3: Entry points and commands

1. **Commands that open an investigation or recurring/performance:**
   - When `createInvestigation` or `openInvestigation` is run from the palette: open/focus the Insight panel and **switch to the Cases tab** so the user sees where their list lives.
   - Any command that previously opened Recurring or Performance (or "Full Insights") opens Insight and switches to the appropriate tab (e.g. post `openInsightTab` with `tab: 'recurring'` or `'performance'`).
   - "Add to Investigation" from the session context menu: after adding, **open Insight and switch to Cases tab** for visual feedback (see Decisions §4).

2. **Session bar "Performance" chip:** Open Insight and switch to the Performance tab (e.g. post a message that Insight script interprets as "open and select Performance tab").

3. **Former "Open Full Insights" / showInsights:** Retire the separate WebviewPanel. Command `saropaLogCapture.showInsights` and any "Open Full Insights" or "Export summary" entry points **open or focus the Insight panel** (and optionally switch to the tab that shows recurring/hot files/summary). Export summary runs from within Insight. No second panel.

4. **refreshRecurringErrors** (session-lifecycle-finalize): Today it runs a command; if that command is removed, either keep a command that posts a refresh to the webview (e.g. "Insight refresh recurring") or have the extension post a message to the viewer when recurring data should refresh; Insight panel script, when Recurring tab is visible, can then call `requestRecurringErrors` again. Prefer keeping a lightweight command that the viewer can react to if open.

### Phase 4: L10n and docs

1. Add strings for "Insight," "Cases," and any updated tooltips. Reuse existing "Recurring errors" and "Performance" for tab labels.
2. Update README and CHANGELOG: describe Insight as the single place for cases, recurring errors, and performance; Project Logs is session list only.

### Phase 5: Cleanup and testing

1. Remove dead code: any script or style that was only used by the standalone Recurring or Performance panels and is now fully in Insight.
2. Verify: Open Insight → Cases: list loads, create works, open investigation opens Investigation panel. Recurring tab: list loads, status and footer work. Performance tab: Current/Trends/Log work, session bar chip opens Insight on Performance tab.
3. Verify: Project Logs shows only session list; no Investigations section. Session context menu "Add to Investigation" still works (opens Investigation or prompts; optional: open Insight to Cases).

---

## File-by-File Impact Summary

| File | Change |
|------|--------|
| **New** `src/ui/panels/viewer-insight-panel.ts` | Insight panel HTML + script (tabs + three panes reusing current behavior). |
| **New** `src/ui/viewer-styles/viewer-styles-insight.ts` | Styles for Insight + tab strip; may import or duplicate recurring/performance/session-investigation styles for the panes. |
| [viewer-content.ts](src/ui/provider/viewer-content.ts) | Add Insight panel HTML/script; remove Recurring and Performance panel HTML/script from slot. Compose Insight styles. |
| [viewer-styles.ts](src/ui/viewer-styles/viewer-styles.ts) | Add `getInsightPanelStyles()` (or Insight styles); can remove or keep `getRecurringPanelStyles` and `getPerformancePanelStyles` if inlined into Insight. |
| [viewer-icon-bar.ts](src/ui/viewer-nav/viewer-icon-bar.ts) | One Insight button; remove Recurring and Performance buttons; update iconButtons, closeAllPanels, setActivePanel, click handlers. |
| [viewer-session-panel-html.ts](src/ui/viewer-panels/viewer-session-panel-html.ts) | Remove Investigations block. |
| [viewer-session-panel.ts](src/ui/viewer-panels/viewer-session-panel.ts) | Remove all investigations-related script and message handling. |
| [viewer-styles-session-panel.ts](src/ui/viewer-styles/viewer-styles-session-panel.ts) | Remove investigations and create-form styles. |
| [viewer-message-handler.ts](src/ui/provider/viewer-message-handler.ts) | No structural change; Insight Cases tab will send same messages. Optional: handle `openInsightTab` to switch tab from extension. |
| [viewer-script-messages.ts](src/ui/viewer/viewer-script-messages.ts) | If session bar Performance chip or integration adapter visibility toggles "Performance" panel, update to open Insight + Performance tab. |
| [viewer-performance-panel.ts](src/ui/panels/viewer-performance-panel.ts) | Logic (tab switching, requestPerformanceData, render) may be inlined or required from Insight script; or panel script is kept and only invoked when Insight Performance tab is active. Same for [viewer-recurring-panel.ts](src/ui/panels/viewer-recurring-panel.ts). |
| package.json, package.nls.*.json | Add "Insight" where needed; remove or repurpose Recurring/Performance menu items if any. |
| README.md, CHANGELOG.md | Describe Insight; document that Investigations/Cases live in Insight. |

---

## Data Flow (Unchanged)

- **Cases:** Webview posts `requestInvestigations` → handler calls `postInvestigationsList(ctx, store)`. Posts `createInvestigationWithName` → handler creates, sets active, shows Investigation panel, posts `investigationsList`. Posts `openInvestigationById` → handler sets active, shows Investigation panel. No change.
- **Recurring:** Webview posts `requestRecurringErrors` → `handleRecurringRequest(post)`. Posts `setRecurringErrorStatus` → `handleSetErrorStatus`. No change.
- **Performance:** Webview posts `requestPerformanceData` → `handlePerformanceRequest(post, currentFileUri)`. No change.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Duplicated or inconsistent state between "old" panel scripts and Insight | Prefer inlining or single source of truth: one Insight script that owns all three tab contents and reuses the same message types and handlers. |
| Performance tab depends on current log URI | Handler already receives `ctx.currentFileUri`; Insight script does not change that. When Performance tab is active, ensure `requestPerformanceData` is sent so session data is loaded. |
| Former "Open Full Insights" / showInsights | Retire WebviewPanel; `showInsights` and "Open Full Insights" open/focus Insight panel instead. |
| Session bar "Performance" chip | Update to open Insight and set active tab to Performance (e.g. postMessage to set active tab, then open Insight). |
| refreshRecurringErrors after session finalize | Keep command or equivalent so extension can trigger refresh; Insight Recurring tab can listen or refresh when tab is focused. |

---

## Alternatives Considered

1. **Keep the Cross-Session Insights WebviewPanel and rename it:** Rejected to avoid two surfaces ("Insight" panel vs "Insights" panel). Decision: retire the WebviewPanel and absorb its features into Insight.
2. **Sections instead of tabs:** All content visible in one scroll (Unified Insight Model). Design target; Phase 1 may use tabs as a stepping-stone or implement the single view first.
3. **Keep Investigations in Project Logs, only merge Recurring + Performance:** Rejected; user asked for one concept for all four.

---

## Success Criteria

- One icon bar button and one panel name: **Insight**. One concept, one entry point. No second "Insights" panel.
- Project Logs contains only the session list (and toggles/tags/pagination).
- All existing behavior preserved or retargeted: create/open investigation (from Insight Cases tab), add to investigation from context menu (opens Insight to Cases), recurring list and status, performance Current/Trends/Log, hot files, environment, drill-down, export summary—all from within Insight.
- Cross-Session Insights WebviewPanel retired; `showInsights` / "Open Full Insights" open Insight instead.
- Performance "Current log" updates when the active log changes; scope (current log vs all sessions) is clear in the UI. Last active tab is persisted across close/reopen and reload; default tab is Cases.
- **When the single-view (Unified Insight Model) is implemented:** One scroll, one story; panel reacts to selected log (smart surfacing); inline add-to-case on relevant data points; **Density defaults & expansion states** (State A / State B) applied as specified; Hero and add-to-case decisions applied as specified.

---

## Out of Scope (for this plan)

- Changing investigation store, recurring aggregator, or performance aggregator **logic** (only UI and navigation change).
- Phase 2 (if Phase 1 is tabbed): refactoring the tabbed Insight panel into the Unified Insight Model (single coherent view); spec is the Unified Insight Model section + resolved design decisions.
