# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**Open VSX Registry** - [open-vsx.org / extension / saropa / saropa-log-capture](https://open-vsx.org/extension/saropa/saropa-log-capture)

**GitHub Source Code** - [github.com / saropa / saropa-log-capture](https://github.com/saropa/saropa-log-capture)

For older versions (3.4.0 and older), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

<!--

Each version (and [Unreleased]) should open with a short human summary when it helps; only discuss user-facing features.


**Tagged changelog** — Published versions use git tag **`vx.y.z`**; each section below ends its summary line with **[log](url)** to that snapshot (or a standalone **[log](url)** when there is no summary). Compare to [current `main`](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md).

**Published version**: See field "version": "x.y.z" in [package.json](./package.json)

-->

---

## [5.0.2]

### Fixed

- Add null guards for `splitBreadcrumb`, `splitPrevBtn`, `splitNextBtn`, `splitCurrentEl`, `splitTotalEl` in split-nav script
- Add null guards for viewport `children[i]` classList accesses in bar-connection rendering
- Route webview script errors to the "Saropa Log Capture" output channel (previously only logged to browser console)
- Include source URL in webview error banner for easier debugging

### Removed

- Remove irrecoverable dismiss [x] button from Signals strip — the collapse toggle is the only hide mechanism now
- Delete stale one-off commit message scripts (`write-commit-msg.ps1`, `write-drift-commit.ps1`)

### Changed

- Move `generate-db-detector-embed-merge.mjs`, `check-stores-version.ps1`, and `marketplace-gallery-query-body.json` from `scripts/` root into `scripts/modules/`

---

## [5.0.1]

### Fixed

- Fix webview "Cannot read properties of null (reading 'classList')" crash by adding null guards to `footerEl`, `footerTextEl`, `jumpBtn`, `logEl`, `ppTabCurrent`, and `ppTabTrends` accesses in viewer scripts
- Improve webview error banner to show line and column numbers for easier debugging
- Fix context menu toggle labels not rendering: add explicit `context-menu-label` class with font and flex rules so text is always visible beside each icon

---

## [5.0.0]

Consolidates the header, footer, and scattered filter controls into a single persistent toolbar with a collapsible filter drawer and search flyout, adds scroll map enhancements (proportional line width, SQL density, context menus), duplicate line collapsing, and Drift debug server detection in SQL Query History. [log](https://github.com/saropa/saropa-log-capture/blob/v5.0.0/CHANGELOG.md)

### Changed

• **Log viewer — toolbar replaces header + footer** — The old session-nav header and footer bar are consolidated into a **single persistent toolbar** at the top. Fixed-width controls (nav arrows, search/filter/actions icons, level dots, line count, filter badge) are grouped on the **left**; the variable-width filename sits on the **right** with ellipsis overflow. The footer is removed entirely.

• **Log viewer — filter drawer** — All filter controls (level toggles, context slider, app-only, tag chips, exclusions, scope, output channels, presets) are consolidated into a **single filter drawer** that drops below the toolbar. Accordion sections keep the drawer compact. The drawer and the Signals hypotheses bar are **mutually exclusive** — opening the drawer auto-collapses Signals, and closing it restores them.

• **Log viewer — search flyout** — In-log search (Ctrl+F) now opens a **flyout below the toolbar** instead of living inside the session-nav header. Search history and options popovers are inline children — no more `position: fixed` floating panels or IntersectionObserver workarounds.

• **Log viewer — icon bar cleanup** — The **Filters** and **SQL Filter** buttons are removed from the vertical icon bar. Filters now live in the toolbar filter drawer.

### Added

• **Log viewer — actions dropdown** — Replay, Open Quality Report, and Export are accessible from an **actions icon button** in the toolbar that opens a dropdown menu.

• **Log viewer — context menu** — The right-click submenu for word wrap, decorations, timestamps, spacing, and line compression is labeled **Layout** (replacing **Options**) so it is distinct from the footer **Options** panel.

• **Log viewer — duplicate line repeats** — Consecutive duplicate lines (same real-time repeat streak) collapse into **one** summary row whose label updates (**N × Repeated:** or **N × SQL repeated:** with preview), instead of stacking separate **Repeated #2**, **#3**, … rows for every extra occurrence.

• **Log viewer — scroll map width** — `saropaLogCapture.minimapWidth` adds **extra narrow** (28px) and **extra wide** (120px) presets alongside narrow / medium / wide. **Options → Layout → Scroll map width** drives the same workspace setting. The viewport slider (grey overlay) is **slightly more transparent** so severity/search marks show through a bit more clearly.

• **Log viewer — scroll map (SQL activity)** — SQL / slow-SQL density is drawn as a **full-width** vertical wash on the strip beside the log (severity and search ticks still draw on top). The previous **right-rail-only** SQL layer looked like a broken half-width render when few severity ticks were present. The embedded script adds a clearer hover tooltip and `aria-label` for the strip. (This is the **log viewer** scroll map in the Saropa webview, not the VS Code **editor** minimap.)

• **Performance — live log capture** — With both the **sidebar** log viewer and the **pop-out** open, each line’s HTML (ANSI, links, styling) is now built **once** in the extension host and copied to each webview instead of processing every line twice. Live `addLines` posts to the viewer are limited to **800** lines per message (was 2000) to reduce webview stalls during heavy output.

### Added

• **Log viewer — SQL toolbar toggle** — The vertical icon bar includes **SQL (…)** with a **compact line count** of database-tagged (Drift SQL) rows (`999`, `5k`, `1.2M`, `2.5B`, …). Click to **hide or show** those lines (same as **Filters → Log tags → database**). The control is **disabled** when the buffer has no `database` lines yet.

• **Log viewer — scroll map & scrollbar from context menu** — Right-click the **scroll map** strip beside the log or the **native vertical scrollbar** (when **Show native scrollbar** is on) opens a compact menu with the same workspace toggles as **Scroll map & scrollbar** on the main log context menu: proportional line width, native scrollbar, info markers, SQL density, red viewport outline, and outside arrow. Settings still update workspace configuration the same way as **Options → Layout**.

• **Log viewer — scroll map proportional line width** — New setting `saropaLogCapture.minimapProportionalLines` (default **on**) draws minimap ticks with horizontal extent from plain-text length vs log pane width (capped at full strip), similar to an editor minimap silhouette; respects word wrap and pane resize.

• **SQL Query History — Drift debug viewer from log** — When the capture includes Saropa Drift Advisor’s **DRIFT DEBUG SERVER** banner and viewer URL (e.g. `http://127.0.0.1:8642`), the extension records that base URL, shows a short status line in the SQL Query History panel, and checks **`/api/health`** from the extension host so the strip can show reachable vs unreachable. Open-in-browser actions prefer this URL over the default. Clearing the log resets the detected server state.

### Fixed

• **Log viewer — Performance chip** — Clicking the header **Performance** chip when the Insights slide-out was already open did nothing (no navigation, no error, no feedback). The chip called `setActivePanel('insight')` which toggled Insights **off**, then tried to open the panel inside a zero-width slot. The chip now uses `ensureInsightSlideoutOpen()` which skips the toggle when Insights is already open.

• **Log viewer — SQL toolbar count** — Compact count formatter (`999k`, `1.2M`, …) no longer rounds `999,999` up to `"1000k"` at unit boundaries; `Math.floor` replaces `toFixed(0)` for the ≥100 tier so the label stays within its unit (same fix applied to the embedded webview copy).

• **Log viewer — Drift SQL args fold** — The collapsible ` with args [...]` suffix on Drift SQL lines was rendered twice: once inside the fold wrapper (correctly hidden by CSS) and once as plain text after it (always visible). The suffix now appears only inside the fold, so clicking the `…` ellipsis actually toggles visibility.

• **Log viewer — search history (Recent)** — The Recent list only appears while the in-log find session is active; closing search (Escape or click outside) clears it and blurs the field. When the session nav is hidden by scroll (smart header) or the search field leaves the viewport, the fixed dropdown is hidden so it no longer floats over the log. [log](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md)

• **Log viewer — severity bar on framework lines** — Lines tagged as framework noise (`item.fw`) at **debug** / **info** / **notice** / **todo** no longer draw a blue “framework” gutter while the line text uses the real level color (e.g. yellow **debug**). The dot and vertical connector now use `level-bar-{level}` to match `level-{level}` text.

• **Log viewer — ASCII / Unicode banners** — Box-drawing and decorative lines (e.g. Drift debug server frames) are no longer shredded by `word-break: break-all`; separator rows use single-line layout, stack headers and frames use monospace `pre` with normal word breaks, and `#log-content` scrolls horizontally when a line is wider than the pane. Separator detection aligns with the Drift-style `│ … │` pattern and `╭╮╯╰` corners (see `log-viewer-separator-line` tests).

---

## [4.2.0]

Unifies severity bar and line text coloring to use matching VS Code theme tokens, fixes the pop-out viewer to load the full capture on open, and addresses minimap, copy/export, and layout edge cases. [log](https://github.com/saropa/saropa-log-capture/blob/v4.2.0/CHANGELOG.md)

### Changed

• **Log viewer — severity bar vs line color** — The left gutter (dot and vertical connector) now uses the same VS Code theme tokens as the line text for **error**, **warning**, **info**, and **performance** levels, so the bar and body no longer disagree (e.g. yellow bar with blue “info” text). **Performance** lines use chart purple for both bar and text (previously performance text matched generic info coloring). Whole-line level tints follow the same tokens. [log](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md)

### Fixed

• **Log viewer — scrollbar minimap** — When **Show info markers on minimap** is off (default), mostly-**info** logs no longer produce an empty minimap: a neutral content-presence band is drawn so scroll structure stays visible. Tooltip text points to the setting for full severity colors.

• **Log viewer — layout beside minimap** — `#log-content` and the minimap row use explicit flex sizing (`flex: 1 1 0%` on the scroll area, fixed column on the minimap) so the log pane fills width next to the strip and jump/copy anchoring stays aligned.

• **Log viewer — framework performance coloring** — With **Suppress error/warning text coloring on framework log lines** enabled, framework lines at **performance** level (e.g. `I/Choreographer` skipped frames) again use purple line styling. The setting applies only to error/warning text on framework lines; performance signals were incorrectly muted.

• **Signals strip — line links** — “line N” jump controls next to each signal use theme link styling instead of the browser’s default button face (which looked like bright blue-on-white in dark themes).

• **Log viewer — Copy & Export context menu** — **Copy** now falls back to the right-clicked line (and Shift+click multi-line range) when there is no native text selection, matching **Copy Line** behavior for highlight-only selection. **Copy with source (filename + source code)** no longer swallows the action when the browser selection is empty: it falls through to the line-based path that expands context. **Copy to clipboard** from the host now rejects empty payloads with a clear warning, coerces safe primitive `text` values, shows a short status-bar confirmation on success, and surfaces clipboard errors instead of failing silently.

• **Pop-out viewer** — The floating viewer now loads the current log file when opened so it shows the full capture from the start of the session, matching the sidebar, instead of only lines written after the pop-out window was created.

• **Log viewer — Hide submenu** — **Hide blank lines** uses the same closed-eye icon as other Hide actions so the row aligns with the rest of the submenu (the previous invisible placeholder codicon looked empty and threw off layout).

---

## [4.1.0]

Adds Explain with AI alongside session adapters in Integrations (with fallbacks when no chat model is available), classifies captured stderr like other channels by default with an opt-in error override, and polishes the options panel plus stack trace handling (ASCII box banners, expand/collapse cycle). [log](https://github.com/saropa/saropa-log-capture/blob/v4.1.0/CHANGELOG.md)

### Added

• **Integrations — Explain with AI** — Options → **Integrations…** and the Configure integrations quick pick include **Explain with AI**, which toggles `saropaLogCapture.ai.enabled` alongside session adapters (the id is not stored in `integrations.adapters`). If no Language Model API chat model is available (common in some Cursor setups), the error dialog offers **Copy prompt for external chat** and **Open AI settings**. On first start, AI stays off by default unless the user has never set `ai.enabled` and the editor already exposes at least one LM chat model (e.g. Copilot Chat).

### Changed

• **Severity — stderr (default)** — Lines captured with DAP category `stderr` are no longer forced to error level or red “stderr” styling by default; they use the same text-based classification as other channels (logcat letter, Drift SQL traces, keywords). Set `saropaLogCapture.stderrTreatAsError` to **true** to restore the previous “every stderr line is an error” behavior. Applies to the log viewer, CSV/JSON export levels, smart bookmarks’ first-error scan, unified timeline events from the main log, error-breakpoint batch detection, and configuration-change refresh of the viewer.

• **Log viewer — Options panel** — The Integrations and Keyboard shortcuts entry buttons no longer stretch to the full panel width; they size to their labels like normal primary buttons. Reset actions stay full width.

• **Options — Integrations list** — Collapsed descriptions use multi-line clamping to the panel width (replacing a short fixed character preview). Expand control labels are **more** / **less**; **less** sits after the full description, performance line, and “when to disable” line. Performance and “when to disable” match the main blurb’s size and weight (no italic/smaller note style). Intro copy clarifies session capture, third-party tools (Crashlytics, Drift, etc.), and in-editor features.

• **Stack trace preview — ASCII box banners** — Decorative lines with paired vertical box-drawing bars (`│ … │`), e.g. Drift debug banners, are not treated as stack frames so collapsed stack preview does not inject `[+N more]` through banners. New setting `saropaLogCapture.viewerPreserveAsciiBoxArt` (default on) controls the behavior.

• **Log viewer — stack traces** — New stack groups open fully expanded (every frame visible). Click the stack header to cycle: expanded → fully collapsed → preview (`[+N more]`) → expanded.

## [4.0.1]

Refines error tinting so Drift SQL traces stay query/debug output, replaces the signals strip strength label with a compact emoji plus tooltip, and presents SQL Query History as a table with header-driven sorting. [log](https://github.com/saropa/saropa-log-capture/blob/v4.0.1/CHANGELOG.md)

### Changed

• **Log viewer — error tinting and Drift SQL** — Drift `Drift: Sent …` trace lines are classified as query/debug output only (never as runtime errors), including session lines where logcat is not at column 0 and when SQL args contain names such as `ApplicationLogError`. Plain `info` lines within two seconds after a primary error or stack line can still be tinted as error for continuity, but interleaved Drift SQL is skipped when finding that anchor so the band does not break. Such “recent error context” rows are visually distinct (dashed accent, softer color, tooltip) from primary fault lines, and the Level Filters fly-up summarizes the difference.

• **Signals strip — strength indicator** — Hypothesis strength is shown as a compact emoji with a hover tooltip (and screen-reader text) instead of a “confidence:” label.

• **SQL Query History — table + header sorting** — SQL Query History is now presented as a table, and sorting is controlled by clicking the column headers (toggle asc/desc) instead of a dropdown.

## [4.0.0]

Focused on richer cross-source debugging: new database, browser, and security context flows with stronger request-id correlation, plus accessibility and SQL-history reliability polish across the viewer.

### Added

• **Security/audit integration — event summary and configurable settings** — The security provider now produces a categorized event summary in session metadata (e.g. "3 logon, 2 failed logon") instead of bare sidecar filenames. Lead/lag time windows now read from the shared Windows Events config instead of hardcoded values. Two new settings: `includeSummaryInHeader` adds a summary line to the session header, and `includeInBugReport` flags the sidecar for bug reports. All five security settings are now declared in `package.json` for Settings UI discoverability.

• **Database integration — parse mode** — The database query logs provider now supports `mode: "parse"` (the default) which scans the captured session log at session end for inline SQL blocks (SELECT, INSERT, UPDATE, DELETE, etc.). Detected queries are indexed by line number and optional request ID, then written to a `.queries.json` sidecar. A custom `queryBlockPattern` regex can override the built-in SQL detection. All six database settings are now declared in `package.json`.

• **Related Queries popover** — Right-click a log line → Actions → "Show Related Queries" opens a focused, queries-only popover showing all database queries correlated by request ID or time window. Each query has a per-query copy button and the footer has "Copy All". Also available via command palette ("Show Related Queries") which targets the currently focused line.

• **Database queries in context popover** — The `.queries.json` sidecar is now loaded by the context data loader and included in the integration context popover when right-clicking a log line. Queries are filtered by the time window and show query text, line range, optional request ID, and duration. Each query has a copy-to-clipboard button.

• **Security / audit section in context popover** — When the security adapter has captured events, the context popover shows a "Security / Audit" section with the categorized event summary and "Open file" buttons for the security-events and audit sidecar files. Raw events are never shown inline.

• **Security adapter first-time notice** — When `security` is first added to the adapters list, a one-time info message explains that events may contain sensitive data and links to the security settings. Shown once per workspace.

• **Error rate over time chart** — New "Errors" tab in the Performance panel shows a time-bucketed SVG bar chart of errors (red) and warnings (amber) across a session. Click any bar to jump to that time range in the viewer. Spikes are automatically detected via moving-average comparison and flagged with a marker. Three new settings control bucket size (`errorRateBucketSize`), warning inclusion (`errorRateShowWarnings`), and spike detection (`errorRateDetectSpikes`).

• **Browser integration — event normalization** — The browser DevTools provider now validates and normalizes raw events to the `BrowserEvent` schema before writing the sidecar file. Entries with no usable text are dropped and the count is logged to the output channel.

• **Browser integration — context popover** — Browser console events from `.browser.json` sidecars now appear in the integration context popover when right-clicking a log line. Events are filtered by the ±contextWindowSeconds time window, showing level, message, and optional URL.

• **Browser integration — interleaved viewer** — Browser console events from `.browser.json` sidecars now appear as lines in the main log viewer. Each event shows as `[level] message (url)`. A "Browser console" checkbox in the source filter panel toggles their visibility.

• **Request ID correlation for context popover** — All three sidecar loaders (HTTP, database, browser) now match entries by request ID in addition to the time window. When a `requestIdPattern` regex is configured (database, HTTP, or browser settings), the handler extracts a correlation ID from the clicked log line and includes matching sidecar entries even if they fall outside the ±window. Browser entries also match when the request ID appears as a substring of the console message.

• **Browser integration — CDP mode** — The browser integration now supports live capture from a running Chrome/Edge instance via Chrome DevTools Protocol. Set `mode` to `cdp` and provide a `cdpUrl` (e.g. `ws://localhost:9222`). Console events are captured in real time during the debug session and written to the `.browser.json` sidecar at session end. Optional network response capture via `includeNetwork`. Localhost only for security.

• **Browser integration — Settings UI** — All seven browser integration settings are now declared in `package.json` and visible in the VS Code Settings UI: `mode`, `browserLogPath`, `browserLogFormat`, `maxEvents`, `cdpUrl`, `includeNetwork`, and `requestIdPattern`.

### Changed

• **Accessibility — landmarks and labels for all panels** — Every slide-out panel (Find, Bookmarks, Trash, Filters, Crashlytics, About, Keyboard Shortcuts) now has `role="region"` and `aria-label`; icon-only buttons and search inputs have `aria-label`. All standalone panels (Session Comparison, Timeline, Investigation, Bug Report, AI Explain, Vitals, Analysis) now have a `role="main"` landmark. Focus moves into each panel on open and returns to the icon bar button on close. Analysis progress bar uses `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`.

• **Accessibility — focus trap for slide-out panels** — Tab and Shift+Tab now cycle through focusable elements within the active panel only, preventing focus from escaping to the background viewer. Escape closes the active panel.

• **Modularized oversized files** — Split 6 files that exceeded the 300-line code limit into smaller, focused modules: extracted DB tab styles, footer styles, context-menu styles, DB tab timeline/brush script, popover DB-insight section, and merge-parity tests into dedicated files.

• **SQL history — redundant eviction removed** — Eliminated a wasteful O(n) `Object.keys()` scan that ran on every new-fingerprint observation after the LRU pre-check had already ensured the cap.

• **SQL history — expanded rows survive re-render** — Expanded query rows now stay open when the panel re-renders due to sort change, search input, or data refresh.

• **SQL history — accessibility** — Added `role="button"` to expandable rows so screen readers announce expand/collapse behavior.

• **SQL history — skip rebuild on open** — Removed the O(allLines) full rescan that ran every time the panel opened; the data is already maintained incrementally.

• **SQL history — empty state uses `u-hidden`** — Replaced inline `style.display` with the project's `u-hidden` CSS class for consistency.

### Fixed

• **CDP capture — stale WebSocket race condition** — The CDP message handler now verifies the WebSocket identity before buffering events, preventing stale messages from a closing connection from leaking into a new capture session's buffer.

• **CDP capture — zombie state on timeout** — When the CDP connection times out, the module-level capture state is now cleared immediately, so `isCdpCaptureActive()` correctly returns `false` for a dead connection.

• **SQL history — jump-to-line now detects all hidden-line states** — The "target line is hidden" hint now delegates to `calcItemHeight`, catching compress-dup, time-range filter, multi-source filter, blank-line suppression, and app-only mode that were previously missed.

• **SQL history — HTML escaping for fingerprints** — Replaced incomplete `escAttr` (only `&` and `"`) with the global `escapeHtml`, preventing potential HTML injection from fingerprints containing `<` or `>`.

• **SQL history — copy button missing `type="button"`** — Added explicit `type="button"` to the per-row copy button to prevent accidental form submission.

---

## [3.14.0]

Cleans up SQL history (deduplicated rows, HTML entities, copy UX), renames Hypotheses to Signals, and polishes the options panel, search bar, and actions menu. [log](https://github.com/saropa/saropa-log-capture/blob/v3.14.0/CHANGELOG.md)

### Added

• **Copy signal** — Each signal bullet now has a copy button (appears on hover) that copies the signal text to the clipboard.

### Changed

• **SQL Query History — Title Case** — Panel title, icon bar label, tooltip, aria-label, and filter button now use consistent "SQL Query History" capitalization.

• **Actions menu — separators and title case** — Added visual separators between Replay, Open Quality Report, and Export items; fixed "Open quality report" to Title Case.

• **Search bar — constrained width** — The toolbar search input no longer stretches to fill the entire title bar; capped at 350 px so it stays compact.

• **Options panel — primary button style** — "Integrations…" and "Keyboard shortcuts…" buttons now use the standard VS Code primary (blue) button style instead of the secondary (grey) style.

• **Signals strip — renamed from "Hypotheses"** — The root-cause hints panel title, context menu, command palette entry, and all aria labels now read "Signals" instead of "Hypotheses". The "Hypothesis, not fact" disclaimer has been removed.

• **Explain with AI — "Enable" button on disabled prompt** — When AI is not enabled, the notification now offers an "Enable" button that turns on the `saropaLogCapture.ai.enabled` setting directly instead of requiring a manual trip to Settings.

• **Integrations panel — collapse notes into Show more** — Performance and "when to disable" notes are now hidden by default and revealed by the "Show more" toggle, reducing visual clutter.

• **Integrations panel — warning emoji on title** — Integrations with a performance warning now show the ⚠️ emoji as a suffix on the title for at-a-glance visibility.

• **Integrations panel — Title Case headings** — All integration labels now use consistent Title Case (e.g. "Code Coverage", "Terminal Output").

### Fixed

• **SQL history — deduplicated rows** — Each query was rendered twice (preview + fingerprint). Now shows a single collapsed line; click to expand with formatted SQL (indented keywords), a "Jump to line" link, and copy button.

• **SQL history — copy UX** — Header copy button now shows "Copied N rows to clipboard" feedback in the hint bar. Per-row copy button copies a single fingerprint. SQL preview and expanded text are selectable for native Ctrl+C copy.

• **SQL history & repeat previews — HTML entities rendered** — `&quot;`, `&lt;`, `&gt;`, `&#39;`, and `&amp;` now display as their actual characters in the SQL query history panel and repeat notification previews instead of showing as raw entity text.

• **Smart bookmarks — skip prompt for inactive logs** — The "add bookmark at first error" suggestion now only appears for the active (recording) session, not when browsing historical logs.

## [3.13.0]

Major database tooling release: SQL pattern chips, N+1 detection, slow query burst markers, repeat drilldown, minimap SQL density, root-cause hypotheses, session comparison diffs, and noise learning. [log](https://github.com/saropa/saropa-log-capture/blob/v3.13.0/CHANGELOG.md)

### Added

• **Drift Advisor integration — `includeInLogCaptureSession` (Log Capture)** — Built-in provider `driftAdvisorBuiltin` reads Drift’s `driftViewer.integrations.includeInLogCaptureSession` (`none` | `header` | `full`); only `full` contributes meta/sidecar (default when unset). Aligns with the bridge contract in `plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md`. Pure helpers in `drift-advisor-include-level.ts`; integration picker copy updated. Tests: `drift-advisor-include-setting.test.ts`.

• **Log viewer — DB_15 ingest / detector ordering** — Primary SQL session rollup uses **`session-rollup-patch`** (`db.ingest-rollup`) before **`runDbDetectors`**; **`lineItem.dbInsight`** is filled via **`peekDbInsightRollup`** in the embed. Detector outputs apply in **phases** (rollup → **`annotate-line`** → synthetic → marker) with per-phase **`priority`** ordering. Types: **`DbAnnotateLinePayload`** in **`db-detector-types.ts`**; embed: **`viewer-data-add-db-detectors.ts`**, **`viewer-data-n-plus-one-script.ts`**.

• **DB_15 — annotate-line host API & VM coverage** — **`applyDbAnnotateLineResultToLineItems`** / **`applyDbAnnotateLineResultsToLineItems`** in **`db-detector-framework.ts`** for batch/test line arrays; **`runDbDetectorsCompare`** accepts **`annotateTargetLines`** to apply **`annotate-line`** in one call; **`runDefaultSessionDbCompareDetectors`** wraps the default registry. **`compareLogSessionsWithDbFingerprints`** runs batch compare when **database insights** are on; session comparison HTML shows **Detector highlights (batch compare)**. **`viewer-db-detector-annotate-line.test.ts`** runs the real embed chunks in **`node:vm`**. Shared embed helper **`driftSqlSnippetFromPlain`** for dbInsight fallback snippet text.

• **Log viewer — static sources from N+1 row (DB_12)** — N+1 synthetic insight rows add **Static sources** (project index token search + QuickPick; heuristic only). Host: `viewer-message-handler-static-sql.ts`; tokens: `drift-sql-fingerprint-code-tokens.ts`. Strings: `msg.staticSqlSources*`.

• **Performance panel — Database tab (DB_13)** — Insight **Performance** → **Database** tab: Drift session rollup KPIs, **top fingerprints**, **slow-line share** and a compact **duration histogram** where per-line durations exist, and a **time-based** **timeline** using the same **bucket-count formula** as the SQL minimap (`session-time-buckets.ts`; minimap and tab use different reference heights so **N** often differs — see module doc and archived plan **DB_13**). A **viewport band** tracks the visible log time span (read-only); **drag on the timeline** applies an optional **time-range filter** (AND with other filters; counted on the filter badge; cleared via **Reset all filters** or **Clear time filter**). Optional **Drift Advisor** summary row when session meta and/or `{logBase}.drift-advisor.json` is present (`drift-advisor-db-panel-load.ts`, **Open panel** when the extension is available). **Refresh** rebuilds the DB view when that tab is active.

• **Root-cause hypotheses — discoverability (DB_14 phase 3)** — Command **`saropaLogCapture.explainRootCauseHypotheses`**, webview handler `triggerExplainRootCauseHypotheses`, log context menu **Explain root-cause hypotheses**, and `explainRootCauseHypothesesEmpty` when there is nothing to explain. Shared embed path: `runTriggerExplainRootCauseHypothesesFromHost` in `viewer-root-cause-hints-script.ts`.

• **Tests** — `drift-sql-fingerprint-code-tokens.test.ts` (token extraction + false-positive guards); `viewer-script-messages-root-cause.test.ts`; embed assertions for static-sources wiring in `viewer-n-plus-one-embed.test.ts`. DB_12 **`node:test`** suites: `drift-sql-static-orm-patterns.test.ts`, `drift-static-sql-candidates.test.ts` (pure scoring loads no `vscode`; file reads use dynamic `import("vscode")`). DB_13 merge tests: `drift-advisor-db-panel-load.ts` + `drift-advisor-db-panel-load.test.ts`. DB_13 timeline alignment: `session-time-buckets.test.ts`. DB_15: `db-detector-framework.test.ts` asserts embed **`mergeDbDetectorResultsByStableKey`** matches TypeScript in **`node:vm`**.

• **Log viewer — DB detector sub-toggles & baseline hints (DB_15 optional)** — Settings **`viewerDbDetectorNPlusOneEnabled`**, **`viewerDbDetectorSlowBurstEnabled`**, **`viewerDbDetectorBaselineHintsEnabled`** (when master **database insights** is on). SQL baseline from log comparison can trigger a one-time **SQL count above baseline** marker; host **`createBaselineVolumeCompareDetector`** supports **`runDbDetectorsCompare`**. **`session-rollup-patch`** results merge into the session rollup map after each detector pass.

• **Fingerprint summaries — slow query counts (DB_10)** — **`slowQueryCount`** per fingerprint (threshold = **`viewerSlowBurstSlowQueryMs`**) in scans, persist v1, merges, and the session comparison table (**Slow A / B / Δ slow** when logs include **`[+Nms]`** metadata).

• **Noise learning (Plan 025)** — Workspace-local learning from log viewer actions: stack-group **dismiss**, new **exclusions**, **bookmarks** (explicit keep), optional **fast-scroll** signal; persisted batches + suggested `saropaLogCapture.exclusions` patterns; QuickPick review; commands **Review / Clear / Check Filter Suggestions**; settings `saropaLogCapture.learning.*`. Implementation: `src/modules/learning/` (see `README.md` there), viewer `trackInteraction`, `setLearningOptions`. QA: `examples/noise-learning-sample-interactions.txt`.

• **Tests — Drift SQL fingerprint summary persist (DB_10)** — `drift-sql-fingerprint-summary-persist.test.ts` covers v1 validation (including rejecting **`fingerprints` arrays** as malformed), round-trip maps, baseline record shapes, **`trimSummaryForPersistence`** caps, and explicit **before/after** exclusion of low-count keys when trimming.

• **Examples — session comparison QA** — `examples/session-comparison-drift-sql-qa.txt` notes how to validate the **Database (Drift SQL)** comparison section, jump actions, and optional SQL baseline buttons.

• **Log viewer — slow query burst markers (DB_08)** — For **`database`**-tagged Drift lines with per-line **`[+Nms]`** duration metadata, **five or more** queries at or above a configurable slow threshold (default **50ms**) inside a rolling window (default **2s**) insert a **Slow query burst** marker row; clicking scrolls to the line that completed the threshold. Cooldown (default **10s** log time) limits marker spam. Requires **`saropaLogCapture.viewerDbInsightsEnabled`**. Settings: **`viewerSlowBurstSlowQueryMs`**, **`viewerSlowBurstMinCount`**, **`viewerSlowBurstWindowMs`**, **`viewerSlowBurstCooldownMs`**. Implementation: `drift-db-slow-burst-detector.ts`, `viewer-db-detector-framework-script.ts`, `viewer-data-add-db-detectors.ts`. QA: **`examples/drift-slow-burst-sample-lines.txt`**.

• **Log viewer — SQL repeat drilldown (DB_06)** — Fingerprint-keyed **SQL repeated #N** rows include an expand control: inline fingerprint, time span, monospaced SQL snippet, and up to **10** `with args` variants (first-seen order) with a truncation note. **Escape** collapses when focus is on that line. Non-SQL **Repeated #** rows unchanged. Implementation: `viewer-data-helpers-core.ts`, `viewer-data-add.ts`, `viewer-script.ts`, `viewer-styles-sql-repeat-drilldown.ts`; VM tests in `viewer-sql-repeat-compression.test.ts`.

• **Log viewer — automatic root-cause hypotheses (DB_14)** — When the log has enough correlated signal (recent errors, N+1 insight rows, or high-volume SQL fingerprints), a **Hypotheses** strip appears above the log with short template bullets, a **Hypothesis, not fact** disclaimer, optional **low/medium** confidence labels, evidence **line** buttons that scroll to valid indices only, and session-scoped **dismiss**. Shared deterministic logic lives in `src/modules/root-cause-hints/` (tests in `build-hypotheses.test.ts`, false-threshold guards); the webview embed mirrors the same constants. QA: `examples/root-cause-hypotheses-sample.txt`.

• **Tests — SQL repeat compression (DB_03)** — VM-backed suite **`viewer-sql-repeat-compression.test.ts`** exercises production `addToData` + `parseSqlFingerprint` embed chunks: fingerprint merge/split, `repeatWindowMs` streak reset, non–`database` Drift-shaped false positives, null-fingerprint fallback (mocked), and marker/`cleanupTrailingRepeats` cleanup. See **`examples/drift-repeat-collapse-thresholds.txt`** and **`plans/history/20260323/DB_03_sql-repeat-compression.md`**.

• **DB detector framework — batch fingerprint summary (DB_15 / DB_10 prep)** — Extension-side helpers to build **`DbFingerprintSummaryEntry`** maps from **`DbDetectorContext`** batches, merge summaries, diff baseline vs target, and run optional detector **`compare`** hooks via **`runDbDetectorsCompare`** (same merge and disable-on-error rules as streaming ingest). See `src/modules/db/db-fingerprint-summary.ts` and `db-detector-framework.ts`.

• **Compare logs — database fingerprint diff (DB_10)** — The **Saropa Log Comparison** panel (two sessions side by side) adds an expandable **Database (Drift SQL)** section: normalized fingerprint counts for session A vs B, change badges (new / gone / more / less / same), optional avg-ms deltas when lines include `[+Nms]`, and up to 60 rows sorted by impact. Uses one UTF-8 read per file together with the line diff via **`compareLogSessionsWithDbFingerprints`** (`diff-engine.ts`, `db-session-fingerprint-diff.ts`).

• **Log viewer — SQL pattern chips & fingerprint guardrails (DB_02)** — Drift `Sent` SQL fingerprints now normalize literals, UUIDs, numbers, and keyword casing via `drift-sql-fingerprint-normalize.ts` (shared with the webview embed). The filters panel adds fingerprint chips for repeated shapes, an **Other SQL** bucket for rare or unparsed database lines, and filtering via `sqlPatternFiltered` composed with existing height logic. See `viewer-sql-pattern-tags.ts`, `viewer-data-add.ts`, `viewer-data.ts`, and `examples/sql-fingerprint-guardrails-sample.txt`.

• **Log viewer — Top SQL Patterns (DB_05)** — The filters section title is **Top SQL Patterns**. Tune **`saropaLogCapture.viewerSqlPatternChipMinCount`** (1–50, default 2) and **`saropaLogCapture.viewerSqlPatternMaxChips`** (1–100, default 20); changes apply live in open viewers without reload.

• **Log viewer — integration context popover — database insight** — For **`database`**-tagged lines (Drift `Sent` SQL), **Show integration context** includes a **Database insight** section: normalized fingerprint, session **seen** count, optional avg/max duration when lines carry `elapsedMs`, truncated **SQL** with full text on hover, and **Open in Drift Advisor** when that extension is installed. The popover can open on DB lines even when the ±time window has no HTTP/perf sidecar data. Context menu **Open in Drift Advisor** also applies to database-tagged lines. See `viewer-context-popover-script.ts`, `viewer-data-add.ts`, `context-handlers.ts`, and `examples/integration-context-popover-db-sample.txt`.

• **Log viewer — minimap SQL density** — Optional right-edge **blue** (SQL activity) and **amber** (slow-SQL signal) density bands on the scrollbar minimap, composed under severity and search markers. Toggle **`saropaLogCapture.minimapShowSqlDensity`** (default on) from **Options → Layout** or settings. The minimap `title` tooltip includes SQL/slow hit counts for quick legend-style context. Shared heuristics live in `viewer-scrollbar-minimap-sql-heuristics.ts` (embedded into the webview script) with unit tests in `viewer-scrollbar-minimap-sql-heuristics.test.ts`.

• **Log viewer — N+1 query hint (Drift SQL)** — Bursts of the same normalized `Drift: Sent …` statement with **different** `with args` payloads inside a short window can insert a synthetic insight line with confidence (low/medium/high), plus **Focus DB** (database source tag) and **Find fingerprint** (in-log search). Detection is wrapped so it **cannot throw** and block line ingest. See `src/modules/db/drift-n-plus-one-detector.ts` and `examples/drift-n-plus-one-sample-lines.txt` for QA samples.

• **Log viewer — adaptive repeat collapse for Drift SQL** — Real-time duplicate collapse keys **`database`** Drift lines by **normalized SQL fingerprint** (same shape, different args still count as one streak). **SELECT / WITH / PRAGMA** use a lower default minimum count than **BEGIN / COMMIT / ROLLBACK**, and **INSERT / UPDATE / DELETE** use a higher default so writes stay visible longer. Tune with **`saropaLogCapture.repeatCollapseGlobalMinCount`**, **`repeatCollapseReadMinCount`**, **`repeatCollapseTransactionMinCount`**, and **`repeatCollapseDmlMinCount`** (each ≥ 2, capped at 50). Non-SQL lines use the global setting only. Sparse repeats may not reach a high threshold inside the existing repeat time window.

### Changed

• **Drift Advisor — contract `schemaVersion`** — Log Capture’s built-in snapshot mapping sets optional **`schemaVersion`** on **`meta.integrations['saropa-drift-advisor']`** and on **`{logBase}.drift-advisor.json`** (default **`1`** via **`DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION`** when the Drift snapshot omits it; preserves Drift-supplied values). JSON schema and [docs/integrations/README.md](docs/integrations/README.md) updated. See [plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md](plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md) §4.3–4.4.

• **DB_15 — embed merge codegen** — `mergeDbDetectorResultsByStableKey` is implemented once in **`db-detector-merge-stable-key.ts`**; **`npm run generate:db-detector-embed-merge`** emits **`src/ui/viewer/generated/db-detector-embed-merge.generated.ts`** for the webview embed. **`npm run compile`** runs codegen first.

• **Docs — Saropa Drift Advisor integration** — Added [docs/integrations/README.md](docs/integrations/README.md) (user index: adapter, setting, links to [plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md](plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md) and [plans/integrations/drift-advisor-session.schema.json](plans/integrations/drift-advisor-session.schema.json)). Published-history Drift bullet now uses those paths (replacing broken `docs/integrations/*.schema.json` / design links). Integration plan §12 and §2–§5.4 updated for current `saropa_drift_advisor` behavior.

• **Compare logs — webview implementation** — Session comparison HTML and embedded script live in **`session-comparison-html.ts`** and **`session-comparison-webview-script.ts`** (ESLint `max-lines` / `max-params`); the webview sets **`localResourceRoots`** to the extension URI for consistency with other panels. Embedded scroll/sync handlers guard missing DOM nodes; **`isPersistedDriftSqlFingerprintSummaryV1`** rejects array **`fingerprints`** values (JS **`typeof [] === 'object'`** false positive).

• **Log viewer — Drift SQL ingest** — `addToData` calls `parseSqlFingerprint(plain)` **once** per normal log line; repeat hashing, optional `dbInsight` rollup, and **`emitDbLineDetectors`** (N+1 / DB_15) all reuse the same `sqlMeta`. Embed regressions live in `viewer-data-add-embed.test.ts`.

• **Footer — Actions menu** — **Replay**, **Export**, and **Open quality report** (when the **codeQuality** integration has data) sit under one **Actions** control in the footer bar instead of a standalone Replay control. **Options → Actions** no longer lists **Export current view**; use **Actions → Export** or the log context menu. **Open quality report** stays disabled until the session exposes quality data.

• **Filters panel (slide-out sidebar)** — **Sources** is renamed **Log Streams** with short intro copy so it is obvious this is debug / terminal / external file inputs. **Code Location Scope** is a separate section (debugger file paths), with hints when narrowing hides most lines or many lines lack paths. External sidecar sources are grouped under **External sidecars (N)** with readable labels. Workspace / package / directory / file radios stay hidden until an active editor file exists; when the editor closes, scope resets to **All logs**.

• **Options — Configure integrations** — **Search** field filters the adapter list. Long descriptions show a **short preview** with **Show more** for full text. **Performance** notes use a dedicated warning marker (split from body text for layout and accessibility); adapters are listed in alphabetical order.

• **Source tags — Drift SQL** — `Drift: Sent …` statement lines (common SQL verbs) map to the **`database`** tag in the extension parser (`source-tag-parser.ts`) and the log viewer, so filtering and DB-oriented tooling agree on the same bucket.

• **Log tags — chip row** — Tag chips use the same eligibility rules as the section summary (minimum occurrence threshold; no chip for the synthetic catch-all bucket), instead of listing every raw key from counts.

• **Line decorations — wide counters** — When the counter (or counter-on-blank) is on, prefix width and hanging indent scale with **5+ digit** sequence numbers via CSS variables, and layout skips redundant style writes until digit width changes.

• **Context menu — Options / Hide** — Toggle rows now show a **leading codicon** (e.g. word wrap, clock, fold) in addition to the checkmark, so every option row has a clear visual icon.

• **Filters — Code Location Scope hint** — Contextual “empty log” guidance under location narrowing is **debounced** from virtual-scroll `recalcHeights` (avoids an O(n) line scan on every layout pass) while **flushing immediately** after user-driven scope changes (`applyScopeFilter` / `syncScopeUi` / context messages). See `viewer-scope-filter.ts` and `viewer-scope-filter-hint.test.ts`.

• **Drift SQL false-positive severity in log viewer** — `I/flutter ... Drift: Sent ...` lines are no longer promoted to **error** just because SQL args contain tokens such as `ApplicationLogError`. Drift statement logs now keep their logcat-driven level (`info` for `I/`, `debug` for `D/`/`V/`), so informational DB traffic does not render as red errors.

• **Context menu — code quality** — **Show code quality** is **disabled** (with tooltip) when the **codeQuality** session integration is not enabled, instead of opening an empty popover.

• **Compress lines (×N)** — Consecutive and non-consecutive duplicate collapse only counts lines that would still be visible under the active level, source, search, scope, app-only, and blank-line rules, so filtered-out duplicates no longer inflate **(×N)** on a surviving row.

• **Log viewer — `dbInsight` on unparsed database lines** — **`database`**-tagged lines that do not yield a parsed SQL fingerprint still get a **`dbInsight`** object with a truncated **Drift:** snippet so the integration popover can show context (`viewer-data-add-db-detectors.ts`).

## [3.12.1]

Adds an always-show search toggles setting, switches session-nav buttons to icon-only, and repositions the compress-lines control. [log](https://github.com/saropa/saropa-log-capture/blob/v3.12.1/CHANGELOG.md)

### Added

• **`saropaLogCapture.viewerAlwaysShowSearchMatchOptions`** — When `true`, the log viewer always shows **match case**, **whole word**, and **regex** toggles in the session-bar search field. Default `false`: toggles appear only while the field is focused or has text (keeps the title bar compact).

### Changed

• **Session bar log navigation** — **Previous / next log** use **icon-only** chevron buttons (tooltips and `aria-label` unchanged: “Previous log (older)” / “Next log (newer)”).

• **Session bar layout** — Session nav can **wrap** to a second row when space is tight; match-option toggles use **progressive disclosure** unless the new setting above is enabled.

• **Find-in-files hook** — `window.setupFromFindInFiles` moved to a dedicated injected script chunk (`viewer-search-setup-from-find.ts`) so the main search script stays within lint line limits; load order is unchanged (after search + toggles + history).

• **Compress lines control** — The toggle moved from the **activity icon bar** to a **fixed button at the top-left of the log pane** (same viewport-based positioning as Jump Top/Bottom). **Options → Layout**, the log **context menu → Options**, and behavior (blanks hidden, consecutive duplicate lines collapsed with **(×N)**) are unchanged.

---

## [3.12.0]

Introduces compress lines (consecutive duplicate collapse with xN badges), moves in-log search to a compact title-bar field, and fixes jump-button placement and search-history cleanup. [log](https://github.com/saropa/saropa-log-capture/blob/v3.12.0/CHANGELOG.md)

### Added

• **Regression tests (session-nav search)** — `viewer-session-nav-search.test.ts` asserts viewer body wiring (no slide-out `#search-bar`, no `getSearchPanelHtml`), panel-slot ordering, icon-bar width skip for search, and stable search DOM ids.

• **Compress lines** — Options › Layout, the **activity bar Compress** icon (collapse-all codicon, next to Filters), and the log context menu (**Options** submenu) toggle **Compress lines**: blank lines are hidden and **consecutive identical** normal log rows collapse to the **last** occurrence with an **(×N)** badge. Markers, stack blocks, run separators, and other non-line rows **break** dedupe runs so structure stays intact. Live capture recomputes layout when this mode is on so new lines merge correctly with the previous row. When compress mode is **off**, **20 consecutive duplicate lines** (O(1) per line) can show a **one-time suggestion banner** under the session bar with **Enable** / dismiss — cleared logs reset the hint.

### Changed

• **Session bar in-log search** — The compact find field and options popover no longer inherit the thick bordered “Prev / Next” nav button style (that rule is scoped to `.session-nav-controls` only). Controls use **borderless toolbar icons**, **editor widget** border/shadow tokens (`widget.shadow` where available), and **find-panel–style** active toggles so the strip matches the rest of VS Code.

• **Info line color in the log viewer** — Lines classified as **info** (e.g. `I/flutter` / Drift SQL) now use **`debugConsole.infoForeground`**, the same VS Code theme token as the Debug Console info tint and in-log “Info” highlights, instead of terminal yellow.

• **Log search in the title bar** — In-log search is a compact filter field on the **right side of the session nav** (same row as log prev/next and context), similar to VS Code’s filter input, instead of a wide slide-out panel. Match case, whole word, regex, and highlight vs filter mode live under the **funnel** button; recent terms still appear in a floating list when the field is focused and empty. The activity bar **Search** control and **Ctrl+F** focus this field without opening the side panel.

### Fixed

• **Search history floating panel** — When the recent-queries list is cleared (typing in the field or empty history), inline styles from `positionSearchFloatingPanels` are reset so a stale `position: fixed` box does not linger on screen.

<!-- cspell:ignore ENOENT scandir -->

• **Developer console noise on activation (Crashlytics cache)** — Workspaces that never had a legacy **`{logDirectory}/crashlytics`** folder no longer trigger a failed **`readdir`** during the one-time migration to **`.saropa/cache/crashlytics`**; the extension **`stat`**s the old folder first so the host does not log **`ENOENT`** / **`scandir`** for a missing path. The Crashlytics CodeLens cache scan uses the same **`stat`**-first pattern for **`.saropa/cache/crashlytics`**.

• **Jump Top / Bottom horizontal placement** — Prior fixes still left `position: absolute` + `right` resolving on the **wrong** edge in the embedded webview. Jump controls now use **`position: fixed`** with **`syncJumpButtonInset()`** driven by **`#log-content.getBoundingClientRect()`** and **`window.innerWidth`/`innerHeight`** (viewport coordinates, no containing-block guesswork). Replay-bar visibility, **icon bar side**, resize, minimap width, and scrollbar visibility trigger a sync; jump fade-in animation is **opacity-only** so `transform` does not fight layout.

---

## [3.11.0]

Adds clear Settings UI titles for every extension option; fixes the Performance chip, virtual-scroll flicker, jump-button placement, and context-menu submenu clipping. [log](https://github.com/saropa/saropa-log-capture/blob/v3.11.0/CHANGELOG.md)

### Changed

• **Settings UI titles for all extension options** — Every `saropaLogCapture.*` configuration key now has a **`title`** in addition to its description, so VS Code Settings shows a clear row label and search matches work better. English titles are derived from each setting’s description (non-English `package.nls.*.json` files use the same strings until translated).

### Fixed

• **Performance chip / title bar control** — The nav **Performance** control opens the Performance block inside **Insights › Session details**. The panel script still looked for the old standalone `#performance-panel` node (removed when Performance moved into Insights), so the control did nothing; the script now targets the embedded `insight-pp-*` markup. Visibility is also stricter now: the chip appears only when session metadata has meaningful performance snapshot metrics or a real samples file path, not just a placeholder snapshot object.

• **Log viewer scroll flicker (filters, tail, end of log)** — Virtual-scroll “hysteresis” used line-index slack, which fails when many lines are height 0: every small scroll rebuilt the viewport DOM and caused flashing. Rebuilds are skipped only when the visible line range is unchanged. Tail-follow (`autoScroll`) now uses a Schmitt-trigger band so distance-to-bottom jitter does not flip follow mode every frame.

• **Jump Top / Bottom on wrong horizontal edge** — Some 3.10.0 installs still used older `left: 8px` positioning. Jump buttons are anchored to the log wrapper’s **right** (clear of minimap / scrollbar) again, with a final CSS block so placement cannot be overridden.

• **Context menu submenu clipped at top (short webviews)** — If the viewer is short enough that both vertical flip rules applied, a later CSS rule canceled the “safe top” submenu offset; the offset now takes precedence so flyouts stay below panel chrome.

### Removed

• **Icon bar Replay button** — Session replay is opened from the footer **Replay** control and the log-area replay bar only, not from a sidebar/toolbar entry.

---

## [3.10.0]

This release makes Log Capture more useful day to day with broader ecosystem support and smoother cross-source debugging. [log](https://github.com/saropa/saropa-log-capture/blob/v3.10.0/CHANGELOG.md)

### Added

• **Application / file logs (Phase 3)** — When **Application / file logs** is enabled in integrations and paths are set under `integrations.externalLogs.paths`, the extension **tails** each existing file during the debug session (new lines only after session start), then writes **`basename.<label>.log`** sidecars at session end. The log viewer loads those sidecars with source ids **`external:<label>`** alongside Debug and Terminal; use **Filters → Sources** to show or hide them. Commands: **Saropa Log Capture: Add external log path** (appends to workspace `paths`) and **Saropa Log Capture: Open external logs for this session** (opens sidecars for the log currently loaded in the viewer; shows a short progress notification when there are multiple files). If tailers did not run, session end still falls back to reading the last N lines from each path. See [docs/integrations/application-file-logs.md](docs/integrations/application-file-logs.md) and [docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md](docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md).

• **Unified session log (Phase 4)** — Optional **`saropaLogCapture.integrations.unifiedLog.writeAtSessionEnd`**: after integrations write sidecars, the extension writes **`basename.unified.jsonl`** next to the main log (one JSON line per row: `source` + `text`). Order: full main log, then terminal sidecar, then external sidecars. **`integrations.unifiedLog.maxLinesPerSource`** (default 50k) truncates each stream from the tail if needed. The unified viewer load also computes **run navigation** boundaries and **smart bookmarks** like normal `.log` loads. Open the `.unified.jsonl` file in the log viewer to use the same **Sources** filter as a multi-file session. See [docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md](docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md).

• **Saropa Lints integration (Phase 3 — Log Capture)** — When generating a bug report, if `violations.json` (or extension API data) is missing or older than 24 hours and the Saropa Lints extension exposes `runAnalysis`, an information message offers **Continue without refresh**, **Run full analysis**, and **Analyze stack-trace files only** (when the stack has app frames). Analysis runs in a progress notification; stack-scoped runs use `runAnalysisForFiles` when present, otherwise `runAnalysis({ files })`. After refresh, lint data is re-read on the same collect pass.

• **Saropa Lints integration (Phase 4 — Log Capture)** — Health score params for bug report headers prefer `reports/.saropa_lints/consumer_contract.json` (`healthScore.impactWeights` + `healthScore.decayRate`) when present; fallback order is consumer contract → Saropa Lints extension API → built-in constants.

• **Saropa Lints integration (Phase 5)** — Bug report lint tables include an **Explain** link per violation that opens Saropa Lints’ **Explain rule** panel. Bug report key findings also highlight critical/high OWASP-mapped issues in the crash file. When adding a session to an investigation, the extension can pin `reports/.saropa_lints/violations.json` so exported investigation bundles keep a lint snapshot.

• **Saropa Lints integration (Phases 1–2)** — Optional integration with the Saropa Lints extension: bug report **Known Lint Issues** section can be filtered by impact level (setting `saropaLogCapture.lintReportImpactLevel`: essential = critical+high only; recommended = +medium; full = all). Section heading shows the filter in use (e.g. “Known Lint Issues (critical + high only)”). When the Saropa Lints extension is installed and exposes its API, Log Capture uses it for violations data and health score params instead of reading the file; otherwise it reads `reports/.saropa_lints/violations.json` and uses built-in constants. Commands **Show code quality for frame** and **Open quality report** are only enabled when the Saropa Lints extension is installed. Design: [docs/integrations/SAROPA_LINTS_INTEGRATION.md](docs/integrations/SAROPA_LINTS_INTEGRATION.md).

• **Saropa Drift Advisor integration** — Optional integration with the Drift Advisor extension: **Drift Advisor** appears in Configure integrations (adapter id `driftAdvisor`). When the Drift Advisor extension is installed, right-click a log line with category `drift-perf` or `drift-query` to show **Open in Drift Advisor** (invokes the Drift Advisor command). The **Show Integration Context** popover shows a **Drift Advisor** block (query count, avg duration, slow count, health) and an **Open in Drift Advisor** button when the session has `meta.integrations['saropa-drift-advisor']`. **Built-in provider (Phase 5–6):** With **driftAdvisor** enabled, session end tries Drift’s `getSessionSnapshot()` (5s timeout) or reads workspace `.saropa/drift-advisor-session.json`, then writes session meta and `{logBase}.drift-advisor.json` (Drift’s bridge overwrites if it runs later). Schema: [plans/integrations/drift-advisor-session.schema.json](plans/integrations/drift-advisor-session.schema.json). Short user index: [docs/integrations/README.md](docs/integrations/README.md). No dependency on Drift Advisor at install time; when only one extension is installed, no errors. Design: [plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md](plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md).

• **Multi-source view and source filter** — When a log has a `.terminal.log` sidecar (from the Terminal integration), the viewer shows both Debug Console and Terminal output. A **Sources** section in the Filters panel (Filters → Sources) lets you show only Debug output, only Terminal, or both. Quick Filter presets **"Just debug output"** and **"Complete (all sources)"** apply the source filter in one click. Presets can now store a `sources` filter (e.g. `["debug"]`). Reset all filters restores all sources.

### Changed

• **Viewer: blank lines and line numbers** — Blank lines no longer show a severity dot (the vertical severity bar still runs through them for continuity). The line-number counter is hidden on blank lines by default so “double line break” gaps are visually minimal. **Decoration settings** (gear next to the Deco button) now include **Show line number on blank lines** (off by default): when enabled, blank lines show their file line number so references like “see line 53” and Go to Line match the file. The displayed counter uses file line number (idx+1) when available so the sequence never skips.

• **Performance: unified JSONL writer** — When `saropaLogCapture.integrations.unifiedLog.writeAtSessionEnd` is enabled, the unified log writer tails the main log and sidecars from disk instead of reading full files into memory.

• **Performance: external log tailing** — The external log adapter batches `fs.watch` change bursts (debounce) to reduce extension-host stalls under high log churn.

### Fixed

• **Context menu submenu cropped at top (terminal)** — The Copy & Export (and other) submenu could still have its top cut off when the right-click menu was opened near the top of the viewer (e.g. in the terminal panel under the tab bar). The safe top margin is increased (12px → 48px) and the “near top” threshold widened (80px → 100px) so the submenu flyout is pushed down enough to stay below toolbars and panel headers.

---

## [3.9.1]

Fixes footer path gestures: double-click opens the log’s containing folder (not its parent), and hold-to-copy path shows a status bar confirmation. [log](https://github.com/saropa/saropa-log-capture/blob/v3.9.1/CHANGELOG.md)

### Fixed

• **Footer: double-click to open folder** — Double-clicking the path in the log viewer footer now opens the folder that contains the current log file (e.g. `reports/20260316`) instead of its parent (`reports`). The extension now reveals the current file in the OS so the file manager opens the correct containing folder.

• **Footer: hold to copy path feedback** — After holding on the footer path to copy it to the clipboard, a status bar message (“File path copied to clipboard”) is shown for 2 seconds so users get clear confirmation that the copy succeeded.

---

## [3.9.0]

Improves the log viewer with Insights in a tab, markdown copy, and scrollbar control; fixes text selection while tailing and refines session elapsed display and jump-button placement. [log](https://github.com/saropa/saropa-log-capture/blob/v3.9.0/CHANGELOG.md)

### Fixed

• **Code quality** — Addressed multiple findings: merged duplicate config imports and combined `context.subscriptions.push()` calls in activation; replaced nested ternary in smart bookmarks with explicit if/else; iterated `Set` directly in log viewer (no array copy); refactored viewer action dispatch into two handlers plus small helpers to reduce cognitive complexity and switch case count; introduced `msgStr()` for safe message field string coercion; replaced `void` with `.then(undefined, () => {})` and `parseInt` with `Number.parseInt`. Behavior unchanged.

• **Performance panel script (code quality)** — Replaced negated condition in `getPerformancePanelScript` with a positive check so ID prefix selection satisfies Sonar rule S7735; behavior unchanged.

• **Text selection during tailing** — Selecting text in the log viewer while the log is being written to no longer fails: the viewport uses the existing hysteresis so it skips a full DOM re-render when the visible line range is unchanged, preserving the user’s selection. Spacer heights are still updated so scroll height stays correct.

### Changed

• **Session elapsed display format** — Session elapsed time in the log viewer no longer uses clock-style `T+M:SS` (e.g. `T+5:15`). It now uses duration-style text with unit suffixes (e.g. `45s`, `5m 15s`, `1h 5m 15s`, `2d 1h 5m 15s`) so it is unambiguous as elapsed time. Labels in the decoration settings and context menu (Options) were updated from "Session time (T+)" / "Log time (T+)" to "Session elapsed".

• **Jump-to-top / jump-to-bottom buttons** — Buttons are now positioned on the right side of the log area so they do not cover the scrollbar minimap or the native vertical scrollbar when it is enabled. Right offset uses CSS variables `--mm-w` and `--scrollbar-w` so layout stays correct for all minimap sizes and scrollbar settings.

### Added

• **Open Insights in New Tab** — The Insights panel can be opened as a main editor tab for easier reading in a large view. Use the **Open in new tab** (link-external) button in the Insights panel header, or the command **Saropa Log Capture: Open Insights in New Tab**. The tab shows the same content as the sidebar (Cases, Recurring, Hot files, Performance, Environment) and stays in sync with the current log. Close via the tab’s × or the panel’s Close button.

• **Insights panel: Copy to Markdown** — A copy button in the Insights panel header copies the full case to the clipboard as markdown: current log name, errors/warnings summary, Session details (Performance groups and events from the Current tab), This log (errors and recurring), Your cases, Across your logs (recurring errors and hot files), and Environment. Uses the same `copyToClipboard` message as other viewer copy actions; no loading state (builds synchronously from in-memory state and Performance DOM).

• **Performance panel (Log tab): right-click to copy message** — When the log has no performance data, the explanatory message block in the Log tab is copyable: right-click it and choose **Copy message** to copy the full text to the clipboard. The message wording was clarified (this log file / if Performance is enabled) so it does not imply the user has not enabled the integration.

• **Show scrollbar setting** — New setting `saropaLogCapture.showScrollbar` (default: false) controls whether the native vertical scrollbar is shown in the log viewer. When off, the minimap is the only scroll indicator; when on, the native scrollbar is visible (10px) and the jump buttons keep clear of it.

---

## [3.8.0]

Adds code quality metrics in the viewer, regression hints (blame and first-seen), and smart bookmark suggestions; fixes context menu and selection behavior. [log](https://github.com/saropa/saropa-log-capture/blob/v3.8.0/CHANGELOG.md)

### Fixed

• **Row selection on right-click** — Shift-click row selection in the log viewer no longer disappears when opening the context menu. The viewport re-render after right-click now re-applies the selection highlight so Copy Line, Hide Selection, and other selection-based actions work as expected.

• **Stack trace icons** — Collapsible stack headers in the log viewer now show the correct Unicode triangles (▶ ▼ ▷) instead of the literal escape text `\u25b6` / `\u25bc` / `\u25b7`.

• **Context menu submenu cropped at top** — When the right-click menu was opened near the top of the view (e.g. under a toolbar), the Copy & Export (and other) submenu flyout could have its top cut off. The menu now applies a vertical offset so submenu content stays below a safe viewport margin; when the menu is also near the bottom, the existing “open upward” behavior still wins.

### Added

• **Code quality metrics (Phase 3)** — **Show code quality for frame:** right-click a stack frame in the log viewer → **Show code quality** to open a popover with line coverage %, lint warnings/errors, and doc density for that file. **Open quality report:** open the session’s `basename.quality.json` sidecar from the context menu or command palette. **Heatmap:** stack frame lines show a subtle coverage tint (green/yellow/red) when quality badges are enabled. **Bug reports:** new setting `saropaLogCapture.integrations.codeQuality.includeInBugReport` (default false) adds a "Code Quality (referenced files)" section for files with low coverage or lint issues. The viewer receives `meta.integrations.codeQuality` when loading a log. Plan [100](bugs/history/20260318/100_code-quality-metrics.md) implemented.

• **Regression hints** — Correlate errors with Git history for "Introduced in commit X". **Blame-based:** for a source line (e.g. from a stack frame), show "Last changed in commit X" with optional link in the Analysis panel source section and in the error hover. **First-seen:** for recurring errors, show "Introduced in commit X" on Insights recurring cards (and "Recurring in this log") when the first session where the error appeared had Git integration (commit stored in session meta). Commit links respect `saropaLogCapture.integrations.git.commitLinks`. New module: `regression-hint-service` (blame + first-seen session→commit); Git provider now stores `commit` at session start and in session-end meta. Plan [034](bugs/history/20260318/034_plan-regression-hints.md) implemented.

• **Smart bookmarks** — When you open a log file, the extension can suggest adding a bookmark at the first error (or first warning) line if that line is not already bookmarked. One suggestion per file per session; notification shows "First error at line N. Add bookmark?" with **Add bookmark** and **Dismiss**. Settings: `saropaLogCapture.smartBookmarks.suggestFirstError` (default true), `saropaLogCapture.smartBookmarks.suggestFirstWarning` (default false). Plan [038](bugs/history/20260318/038_plan-smart-bookmarks.md) implemented.

---

## [3.7.1]

Stabilizes Project Logs and extension development by fixing a crash, wiring proposed APIs correctly, and aligning Insight → Insights naming. [log](https://github.com/saropa/saropa-log-capture/blob/v3.7.1/CHANGELOG.md)

### Fixed

• **Session panel crash** — Project Logs no longer throws "escapeHtmlText is not defined". Shared helpers `escapeAttr` and `escapeHtmlText` are defined once in the session panel bootstrap; inlined fragments (rendering, events) use them. A runtime test runs the same script combination the webview uses and dispatches a sessionList message to catch missing dependencies.

• **Extension development** — Launch configs include `--enable-proposed-api=saropa.saropa-log-capture` so F5 can use the terminal proposed API when enabled locally. **Publishing:** The extension no longer declares `enabledApiProposals` in `package.json`, so it can be published to the Marketplace. Terminal capture (integrated terminal output) uses the proposed API when available and is skipped gracefully when not (try/catch in `terminal-capture.ts`).

### Changed

• Rename **Insight** menu and panel labels to **Insights** (lightbulb icon in the viewer and command palette entry) for consistency with cross-session Insights terminology.

### Administration

• **Modularized 4 files over 300-line limit.** Split to satisfy the project’s 300-line file limit. No behavior or API changes. New/updated modules: `investigation-commands-helpers` (resolve/pick investigation, format insight payload); `session-manager-internals` (applyStartResult, broadcast/watcher helpers); `session-manager-stop` (buildStopSessionDeps); `viewer-insight-panel-script-part-a/b/c` (Insight panel IIFE fragments); `viewer-styles-insight-layout`, `viewer-styles-insight-sections`, `viewer-styles-insight-hero`. Entry points unchanged: `commands-investigation`, `session-manager`, `viewer-insight-panel-script`, `viewer-styles-insight`.

---

## [3.7.0]

Major UX release focused on webview accessibility, a unified Insights panel, smarter Flutter/Dart memory classification, and modularizing large files. [log](https://github.com/saropa/saropa-log-capture/blob/v3.7.0/CHANGELOG.md)

### Added

• **Webview accessibility (a11y)** — Viewer: main landmark on primary content, `aria-live` on line-count so filter/load updates are announced; level flyup "All"/"None" are buttons for keyboard use. Options, Project Logs, and Integrations panels: `role="region"` and `aria-label` on containers; key controls labeled. Focus moves into Options and Project Logs on open and returns to the icon bar on close (Escape or Close). README documents keyboard and screen-reader use; audit at `bugs/028_webview-a11y-audit.md`. Plan [028](bugs/028_plan-webview-accessibility.md) in progress (focus trap and remaining panels pending).

• **Unified Insight panel (single view)** — One scroll, no tabs. The **Insight** panel (icon bar, lightbulb) is a single narrative: **Active Cases** (top 3 + View All), **Recurring errors** (top 5), **Frequently modified files** (collapsed), **Environment** (platforms, SDK, debug adapters; collapsed), and **Performance** (when a log is open). Context-aware: with no log selected you see Cases, Recurring, Hot files, Environment; with a log selected **Performance** (with scope label "Current log: &lt;filename&gt;") and **Recurring in this log** (filtered to errors that appear in the current session) move to the top. **Inline add-to-case:** "+" on each recurring card and hot file opens the Cases section so you can add a session. **requestInsightData** returns errors, statuses, hot files, platforms, sdkVersions, debugAdapters, **recurringInThisLog**, **errorsInThisLog**, and **errorsInThisLogTotal** (when a log is open). **currentLogChanged** triggers refresh of performance and insight data. **14 UX enhancements:** empty states (Cases, Recurring, Hot files); loading states; "This log" single empty message; keyboard nav on section headers (Arrow Up/Down, Enter/Space); scroll into view after add-to-case and create-case; Session details hint; recurring/errors text truncation with full tooltip; "Top 3 of N" for errors-in-log; cases list "N source(s) · Updated X ago"; hero 0/0 and no-data message; sparkline "Session trend" label; export confirmation. Plan 041 (Unified Insight Model) implemented; see `bugs/history/20260317/041_plan-unify-investigation-recurring-performance.md`.

• **Flutter/Dart memory classification** — Memory-related log lines (e.g. memory pressure, heap/VM gen, leak hints) are classified as **Performance** and shown in the Performance panel **Memory** group only when the line has Flutter/Dart context (logcat `I/flutter`/`D/dart` or `package:flutter`/`package:dart`) and a high-confidence phrase (`Memory: N`, memory pressure/usage/leak, old/new gen, retained N, leak detected, potential leak). Reduces false positives from generic "memory"/"heap" in other runtimes. Heuristics are best-effort; see `bugs/001_integration-specs-index.md`.

### Administration

• **Modularized 11 files over 300-line limit.** Split into smaller modules to satisfy ESLint `max-lines` (300, excluding blanks/comments). No behavior or API changes. New modules: `commands-export-insights`, `commands-export-helpers`; `log-session-helpers` (extended); `investigation-search-file`, `investigation-store-io`, `investigation-store-workspace`; `session-manager-routing`, `session-manager-start`, `session-manager-stop`; `viewer-content-body`, `viewer-content-scripts`; `viewer-message-handler-actions`, `viewer-message-handler-investigation`; `log-viewer-provider-state`; `viewer-performance-trends`, `viewer-performance-session-tab`; `viewer-replay-timing`, `viewer-replay-controls`; `viewer-session-panel-investigations`, `viewer-session-panel-events`. Callers still import from the original entry files where applicable.

---

## [3.6.2]

Empty log fixes (late-start fallback for Dart run, 30s recent-child window, runbook and diagnostic message); Project Logs recent-updates indicators and last-viewed tracking; investigation UX improvements. [log](https://github.com/saropa/saropa-log-capture/blob/v3.6.2/CHANGELOG.md)

### Added

• **Late-start fallback** — when output is buffered and no log session exists (e.g. Dart run or Cursor never fired `onDidStartDebugSession`), the extension starts capture using the active debug session so logs are still written.

• **Recent-child alias window** — parent/child fallback now aliases when exactly one owner was created in the last 30s (was 15s) to reduce two-file races for Dart/Flutter.

• **Recent-updates indicators in Project Logs** — Session list shows an **orange** dot for logs that have new lines since you last viewed them, and a **red** dot for logs updated in the last minute. "Last viewed" is updated when you open a session from the list or panel; the list refreshes periodically while a session is recording so the red indicator stays accurate. Active (recording) session continues to use the recording icon only.

• **Investigation UX** — In Project Logs, clicking "+ Create Investigation..." now shows an inline name field in the panel (instead of the VS Code input at the top of the window) so focus stays where the user is looking. Create/Cancel buttons and Enter/Escape keyboard support; loading state ("Creating…") prevents double-submit. Short hint under the Investigations header explains: "Pin sessions and files to search and export together." README clarifies how Investigations differ from Recurring (error-pattern analysis) and Performance (perf analysis).

### Documentation

• Runbook [010](bugs/010_runbook-missing-or-empty-logs.md): clearer steps when a log file is empty or near-empty (enable `diagnosticCapture` to inspect the pipeline; runbook reorganized with first steps up front).

---

## [3.6.1]

Empty log file fixes and capture safeguards: replay all early output, single- and multi-session fallbacks, race guard, buffer timeout warning, and optional diagnosticCapture. [log](https://github.com/saropa/saropa-log-capture/blob/v3.6.1/CHANGELOG.md)

### Added

• **`saropaLogCapture.diagnosticCapture`** (default `false`) — when enabled, logs capture pipeline events (new session, output buffered, output written) to the "Saropa Log Capture" output channel.

• **Single-session fallback** — DAP output for an unknown session id is routed to the single active log session when exactly one exists.

• **Replay all early output for first session** — when creating the first log session, all buffered output (every session id) is replayed into it.

• **Race guard** — if exactly one session was created in the last 5 seconds, a new session is aliased to it instead of creating a second file.

• **Multi-session fallback** — output for an unknown session id with 2+ active sessions is routed to the most recently created session.

• **Buffer timeout warning** — after 30s of buffered output with no log session for that id, a one-time warning is logged to the Saropa Log Capture output channel.

### Fixed

• Empty logs / dropped output regression introduced in 3.1.3 (replay and session routing).

---

## [3.6.0]

Enhanced error analysis with hover popups and inline triage controls. [log](https://github.com/saropa/saropa-log-capture/blob/v3.6.0/CHANGELOG.md)

### Added

• **Error hover popup** — hovering over error badges (CRITICAL/TRANSIENT/BUG) in the log viewer shows a floating popup with classification, crash category, cross-log history, triage status, and fingerprint hash. Includes an "Analyze" button to open the full analysis panel.

• **Error analysis in Analysis Panel** — when analyzing an error/warning line, the panel now includes error-specific sections: classification header with triage controls (open/closed/muted), cross-log timeline sparkline, log occurrence count, and an action bar with Copy Context, Bug Report, Export (.slc/JSON/CSV), and AI Explain buttons.

• **Clickable error badges** — error classification badges in the log viewer are now clickable to open the analysis panel directly for that error line.

• **Per-file coverage badges** — stack frame lines in the viewer now show a coverage percentage badge (green/yellow/red) when a coverage report is configured. Toggleable via Decoration Settings. Badges render on both stack-header and stack-frame lines.

• **Quality sidecar** — session end writes a `quality.json` sidecar with per-file coverage data for referenced code.

• **Coverage parser improvements** — single file read for both aggregate and per-file parsing, Cobertura attribute order flexibility, safe JSON parsing, ambiguous basename guard.

• **Code Quality Metrics integration design doc** — per-file coverage, lint, and doc density overlay for code referenced in log stack traces (`bugs/100_code-quality-metrics.md`).

• **Code Quality Metrics provider** — `codeQuality` integration provider assembles per-file coverage, lint warnings/errors (ESLint JSON), and comment density into an enriched `quality.json` sidecar at session end.

• **Lint report reader** — parses ESLint `--format json` output to extract per-file warning/error counts for log-referenced files.

• **Comment density scanner** — scans referenced source files for comment-to-code ratio and JSDoc/dartdoc coverage on exported symbols.

• **Code quality settings** — `integrations.codeQuality.lintReportPath`, `scanComments`, and `coverageStaleMaxHours` settings for configuring quality data sources.

• **AI module tests** — unit tests for JSONL parser, line formatter, prompt builder, and type helpers (ai-jsonl-parser, ai-jsonl-types, ai-line-formatter, ai-prompt).

• **Bug report tests** — unit tests for keyword extraction and thread-aware stack trace formatting (report-file-keywords, bug-report-thread-format).

• **Crashlytics event parser tests** — unit tests for structured thread parsing, raw trace parsing, device/custom key extraction.

• **Insights export format tests** — unit tests for CSV and JSON export serialization.

### Changed

• **Terminology standardization** — replaced user-facing "session" with "log" across all locales, webview UI, context menus, performance panel, error analysis, error hover, walkthrough docs, and setting descriptions (per CONTRIBUTING.md). Fixed grammatical gender/case/particle agreement in de, ru, es, pt-br, it, ko locale files. Internal identifiers, setting keys, command IDs, and "debug session" (VS Code concept) are unchanged.

• **Updated feature discipline rule** in `.claude/rules/global.md` — replaced stale reference to non-existent `docs/PLAN_SAROPA_LOG_CAPTURE.md` with references to `ROADMAP.md` and `bugs/*.md` plans.

• **Added nyc coverage configuration** with Istanbul instrumentation, text/lcov/HTML reporters, and 50% threshold gates. Uses nyc instead of c8 because c8 cannot collect V8 coverage from VS Code's Extension Host process.

• **CI now runs coverage** instead of plain tests, and uploads the coverage report as an artifact (14-day retention).

• **Added coverage badge** to README linking to CI runs.

## [3.5.4]

Replay controls redesigned for a cleaner, less intrusive UX. [log](https://github.com/saropa/saropa-log-capture/blob/v3.5.4/CHANGELOG.md)

### Changed

• **Replay panel is now horizontal and anchored to the bottom-right** of the log area, replacing the tall vertical strip that obscured content.

• **Top/Bottom jump buttons moved to the left side** so they no longer overlap the scrollbar minimap.

• **Replay button added to the viewer footer** (before the version number) for quick access without the floating toggle.

### Removed

• **Removed the floating replay toggle button** that overlapped the top-right corner. Replay is now triggered from the footer button or the icon bar.

## [3.5.3]

[log](https://github.com/saropa/saropa-log-capture/blob/v3.5.3/CHANGELOG.md)

### Fixed

• **Resolved all 32 eslint warnings across the codebase.** Addressed strict equality (`!==`), unused variables, missing curly braces, excessive nesting (`max-depth`), too many function parameters (`max-params`), and files exceeding the 300-line limit (`max-lines`). Extracted helper functions and split large files to improve maintainability.

• **Replay controls no longer overlap the minimap.** The replay toggle and panel now offset by the minimap width, respecting all size settings (small/medium/large).

### Changed

• **Consolidated three status bar items into one.** Pause icon, line count, and watch counts now appear in a single status bar entry instead of separate items. Pause/resume remains available via command palette.

• **More integrations enabled by default.** New installs now start with `packages`, `git`, `environment`, `performance`, and `terminal` enabled (previously only `packages` and `performance`). All are lightweight, broadly applicable, and no-op when not relevant.

• **Clearer integration performance notes.** Each adapter now shows a warning icon when it has meaningful performance cost, needs external configuration, or is platform-specific. "When to disable" text updated to explain prerequisites (e.g. "you haven't configured a report path").

• **Removed integration adapter names from status bar.** The status bar no longer lists which adapters are active — it was cluttering the bar and confusing users. Integration info is still available in the Options panel.

### Removed

• **Standalone Crashlytics status bar indicator.** The always-visible Crashlytics status bar item has been removed to reduce clutter. Crashlytics setup status is still available in the viewer panel.

### Added

• **Session time (T+) toggle in context menu.** Options submenu now includes a quick toggle for session elapsed time, matching the gear panel checkbox.

---

## [3.5.2]

[log](https://github.com/saropa/saropa-log-capture/blob/v3.5.2/CHANGELOG.md)

### Fixed

• **Publish script spawns unwanted windows on Windows.** Extension listing now reads the filesystem (`~/.vscode/extensions/`, `~/.cursor/extensions/`) instead of calling `code --list-extensions` / `cursor --list-extensions`, which spawned persistent editor windows. Added `CREATE_NO_WINDOW` flag to all subprocess calls to suppress cmd.exe console flashes. Marketplace browser open after publish is now prompted instead of automatic.

• **Stray .meta.json files polluting user projects.** A fallback code path wrote `.meta.json` sidecar files next to arbitrary files across workspace folders instead of using the central metadata store. Removed the sidecar write path entirely — all metadata now goes through `.session-metadata.json` only. On activation the extension scans for and deletes orphan `.meta.json` sidecars that match its format, cleaning up affected projects automatically.

### Added

• **Getting Started walkthrough command.** Added `Saropa Log Capture: Getting Started` command to open the VS Code walkthrough directly, plus an "About Saropa" step with ecosystem and company info. The walkthrough auto-opens on first install.

• **OWASP Security Context in bug reports.** Bug reports now include a "Security Context" section when crash-related files have OWASP-mapped lint violations, showing categories (M1–M10, A01–A10) with affected rules. OWASP findings also appear in Key Findings.

## [3.5.1]

Replay controls now live in a compact floating vertical panel instead of a full-width horizontal bar. [log](https://github.com/saropa/saropa-log-capture/blob/v3.5.1/CHANGELOG.md)

### Added

• **Create Bug Report File.** Right-click selected lines in the log viewer and choose "Create Bug Report File" to auto-create a comprehensive `.md` report. Includes selected text, session info, full decorated output (in a collapsible block), cross-session analysis, environment details, and user-fillable sections. Also available from the Command Palette (without selection).

• **`saropaLogCapture.reportFolder` setting.** Configure where bug report files are created (default: `bugs/`, relative to workspace root).

### Changed

• **Replay bar: collapsible vertical layout.** The replay controls (play/pause/stop, mode, speed, scrubber) are now a floating vertical panel toggled by an icon in the top-right corner of the log area. The bar is hidden by default — no more wasted vertical space when you're not replaying. The vertical scrubber stretches to fill the available height.

## [3.5.0]

Track elapsed session time with T+ decorations in the log viewer, and get instant codebase context from project health scores and lint breakdowns in bug reports. [log](https://github.com/saropa/saropa-log-capture/blob/v3.5.0/CHANGELOG.md)

### Added

• **Session time (T+) decoration.** New "Session time (T+)" checkbox in the decoration settings panel shows elapsed time from the first log line (e.g., `T+0:00`, `T+3:42`, `T+1:23:42`). Hours appear only when elapsed exceeds 1 hour; days appear only past 24 hours. Respects the existing milliseconds toggle. Can be shown independently of or alongside the wall-clock timestamp.

• **Project health score in bug report header.** Shows "Project health: N/100" with tier and total violation count when lint data is available.

• **Per-impact breakdown in Known Lint Issues section.** Lists non-zero violation counts by impact level (critical, high, medium, low, opinionated) above the violations table.

### Changed

• Bug report staleness message now says "Run analysis in Saropa Lints" instead of `dart run custom_lint` when the Saropa Lints VS Code extension is detected in the workspace.

### Removed

• **Cursor IDE warning.** Removed the startup warning for Cursor IDE users — log capture works fine in Cursor.

--

## [3.4.3]

Auto-hide patterns let you permanently suppress matching log lines with a right-click, plus a management modal to review and remove patterns. [log](https://github.com/saropa/saropa-log-capture/blob/v3.4.3/CHANGELOG.md)

### Added

• **Auto-hide patterns.** Select text in the log viewer, right-click > Hide, and choose "Hide Selection (Always)" to permanently suppress matching lines across all sessions. Patterns are stored in `saropaLogCapture.autoHidePatterns` setting. "Hide Selection" and "Hide Selection (This Session)" hide for the current session only.

• **Auto-hide pattern management modal.** Double-click the hidden counter in the footer to view and remove auto-hide patterns (both session and persistent).

### Changed

• Renamed "Hide Lines" context submenu to "Hide".

• Hidden counter in footer now shows icon + count only (no background pill or "hidden" text), matching the style of other filter indicators.

• Peek mode now reveals both manually hidden and auto-hidden lines.

### Fixed

• Auto-hide now applies to stack headers and repeat notifications, not just regular lines.

• Hidden counter no longer double-counts lines that are both manually hidden and auto-hidden.

• Session auto-hide patterns are cleared when the viewer is cleared.

• Removed redundant "Hide Selection" context menu item (kept "This Session" and "Always").

• Single-quote characters in auto-hide patterns are now HTML-escaped in the management modal.

• Auto-hidden count is decremented before splice in trimData, preventing incorrect counts after trim.

---

## [3.4.2]

Tames the overflowing context menu by grouping copy and export actions into a submenu, and splits six files that exceeded the 300-line limit into focused modules. [log](https://github.com/saropa/saropa-log-capture/blob/v3.4.2/CHANGELOG.md)

• **Viewer context menu: Copy & Export submenu.** The right-click menu was too long and could overflow the screen. Copy, Copy Line, Copy All, Copy All Decorated, Copy as snippet, Copy with source, Select All, and Export current view are now under a **Copy & Export** submenu; **Copy to Search** is in the same submenu after a separator. Behavior and visibility rules are unchanged; existing tests pass.

• **Modularized files over 300-line limit.** Split investigation commands (share/export into `investigation-commands-share.ts`, `investigation-commands-export.ts`), l10n strings into `l10n/strings-a.ts` and `l10n/strings-b.ts`, .slc bundle logic into `slc-types.ts`, `slc-session-files.ts`, `slc-session.ts`, and `slc-investigation.ts`, Build/CI API fetchers into `build-ci-api.ts`, and viewer-styles (Crashlytics setup/diagnostic, options integrations/shortcuts) into dedicated style modules. No behavior changes; existing tests and public API unchanged.

---

For older versions (3.4.0 and older), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).
