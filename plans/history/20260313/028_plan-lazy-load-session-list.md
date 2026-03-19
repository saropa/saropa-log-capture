# Plan 028: Lazy load session list — completed

**Summary:** Implemented **pagination** for the Project Logs session list so 100+ sessions load and scroll without lag. Virtualization and infinite scroll were considered; pagination was chosen for simplicity and fit with the existing filter-and-pick workflow.

**Implemented:**
- **Data/options:** `SessionDisplayOptions.sessionListPageSize` (default 100), persisted with display options; config `saropaLogCapture.sessionListPageSize` (10–500) for user setting.
- **UI:** Project Logs panel shows only the current page of sessions; bar displays "Showing X–Y of Z" with Previous/Next when more than one page. Bar hidden when total ≤ page size. Page resets to 1 when list is refreshed or filters/display options change.
- **Loading:** Existing loading state (shimmer, "Loading…") unchanged; list still fetched once from extension; only the visible page is rendered in the DOM.
- **Docs:** CHANGELOG, ROADMAP updated; plan moved here.

**Files touched:** `session-display.ts`, `config-types.ts`, `config.ts`, `extension-activation.ts`, `package.json`, `viewer-session-panel-html.ts`, `viewer-session-panel-rendering.ts`, `viewer-session-panel.ts`, `viewer-styles-session-list.ts`.
