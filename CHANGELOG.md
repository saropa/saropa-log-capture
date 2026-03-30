# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**Open VSX Registry** - [open-vsx.org / extension / saropa / saropa-log-capture](https://open-vsx.org/extension/saropa/saropa-log-capture)

**GitHub Source Code** - [github.com / saropa / saropa-log-capture](https://github.com/saropa/saropa-log-capture)

For older versions (3.11.0 and older), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

<!-- MAINTENANCE NOTES -- IMPORTANT --

    The format is based on [Keep a Changelog](https://keepachangelog.com/).

    Each version (and [Unreleased]) should open with a short human summary when it helps; only discuss user-facing features.

    **Tagged changelog** — Published versions use git tag **`vx.y.z`**; each section below ends its summary line with **[log](url)** to that snapshot (or a standalone **[log](url)** when there is no summary). Compare to [current `main`](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md).

    **Published version**: See field "version": "x.y.z" in [package.json](./package.json)

-->

---

## [Unreleased]

### Fixed

- SQL density minimap bands used bright blue (`rgba(90,180,255)`) which looked like selection highlights or errors — changed to soft pink (`rgba(200,120,180)`) so the overlay reads as a background annotation
- SQL Query History panel column headers were garbled and required horizontal scrolling — `table-layout: fixed` with `width: 1%` made count and duration columns ~3px wide, causing text to overflow and overlap
- "Hide blank lines" toggle was indented incorrectly in the Hide context submenu — the invisible checkmark span was taking up space in the flex layout, pushing the label right compared to regular menu items

---

## [5.1.0]

Adds adb logcat integration for live Android log streaming, continuation line collapsing for split log output, hidden-lines chevron indicators on the severity bar, smooth toolbar animations, and SQL verb-category filter chips. [log](https://github.com/saropa/saropa-log-capture/blob/v5.1.0/CHANGELOG.md)

### Added

- Hidden-lines chevron indicator on the severity bar — a small `▸` marker appears between visible lines when non-blank lines are hidden by filters, with a tooltip showing the count and filter reasons
- adb logcat integration: live-stream Android system logs alongside debug sessions with PID filtering, level filtering, tag filters, and `.logcat.log` sidecar at session end. Auto-connects for Dart/Flutter sessions when adb is on PATH
- Continuation line collapsing: consecutive log lines with the same timestamp and logcat tag (e.g. Flutter splitting long SQL across 40+ lines) are grouped behind a clickable `[+N lines]` badge. Groups with more than 5 children auto-collapse; click the badge to expand/collapse. Search matches auto-expand collapsed groups

### Changed

- Smooth animations for toolbar UI: search flyout and filter drawer slide down/up, actions dropdown scales from top, accordion sections expand/collapse with height+opacity transitions, and Signals strip smoothly collapses when filter drawer opens. All animations respect `prefers-reduced-motion`
- SQL filter chips replaced: fingerprint-based pattern chips replaced with simple verb-category chips (SELECT, INSERT, UPDATE, DELETE, Transaction, Other SQL) for immediate usability
- Removed `viewerSqlPatternChipMinCount` and `viewerSqlPatternMaxChips` settings (no longer needed with fixed verb categories)
- Toolbar severity dots increased from 10px to 12px for better visibility and click targets
- Filter drawer level buttons are more compact — reduced padding and removed minimum count width
- All tooltips now describe what interactions do — toolbar dots explain click (toggle) and double-click (solo), icon bar buttons say "click to open/close", filename shows click/double-click/long-press actions
- Filter drawer accordion sections use bordered cards with visible expand arrow instead of plain text bullets
- Filter drawer sections arranged in 2-column grid, expanding to full width when opened
- Preset dropdown now has a visible "Preset:" label for context
- "Reset all" button moved to far right of footer row, away from preset dropdown

### Fixed

- Fix severity bar connector gaps — dots now only connect when they share the same severity level, bridging correctly across blank and hidden lines instead of joining mismatched levels

---

Fixes toolbar search and actions menus not responding to clicks, applies standard VS Code themed styling to buttons and dropdowns, and adds an element ID wiring test to catch stale references. [log](https://github.com/saropa/saropa-log-capture/blob/v5.0.3/CHANGELOG.md)

### Changed

- Use standard VS Code themed button styling for level filter All/None buttons, run navigation Prev/Next buttons, and breadcrumb nav buttons instead of custom white/outlined styles
- Add explicit VS Code themed styling for filter drawer preset dropdown
- Add or improve tooltips on all interactive UI elements across toolbar, filter drawer, icon bar, search, find-in-files, bookmarks, options, actions menu, edit modal, and run navigation

### Fixed

- Fix toolbar search button not responding to clicks — document-level click handler immediately closed the flyout because `session-nav-search-outer` (old UI element) no longer exists; updated to use `search-flyout`
- Fix toolbar actions (kebab) menu not responding to clicks — click event bubbled to outside-click handler which closed the dropdown immediately; added `stopPropagation` on both search and actions button handlers
- Fix prev/next session navigation buttons appearing clickable when at start/end of list — disabled buttons are now visually dimmed with suppressed hover effects

### Added

- Add element ID wiring test that cross-references every `getElementById` call in webview scripts against the generated HTML — catches stale references after refactors

## [5.0.2]

Adds two-pass Project Logs loading with shimmer previews, hardens webview scripts with comprehensive null guards after the toolbar refactor, and routes webview errors to the output channel for easier debugging. [log](https://github.com/saropa/saropa-log-capture/blob/v5.0.2/CHANGELOG.md)

### Changed

- Two-pass Project Logs loading: filenames appear instantly with shimmer placeholders while metadata (severity, duration, size) loads in the background

### Fixed

- Fix "Cannot read properties of null (reading 'classList')" crash in `updateSessionNav` — the `#session-nav` element was removed during the toolbar refactor but the script still referenced it
- Add null guards for `sessionNav`, `sessionPrevBtn`, `sessionNextBtn`, `sessionNavCurrentEl`, `sessionNavTotalEl` in session-nav script
- Add null guards for `splitBreadcrumb`, `splitPrevBtn`, `splitNextBtn`, `splitCurrentEl`, `splitTotalEl` in split-nav script
- Add null guards for viewport `children[i]` classList accesses in bar-connection rendering
- Add null guards for `logEl`, `viewportEl` scroll/resize/click listeners in viewer-script
- Add null guard for `footerTextEl` in `updateFooterText()`
- Add null guards for `logEl`, `jumpBtn` in Go to Line overlay
- Add null guards for `copyFloat`, `wrapperEl`, `viewportEl`, `logEl` in copy/selection script
- Add null guards for `searchInputEl`, `matchCountEl`, `search-next`/`search-prev` buttons in search script
- Add null guard for `.hidden-count-text` querySelector result in hidden-lines counter
- Add null guards for `.auto-hide-modal-backdrop`/`-close`/`-list` querySelector results in auto-hide modal
- Add null guard for `logEl` at top of `renderViewport()` in viewport render script
- Add null guard for `footerActionsMenu` classList access in replay footer-actions click handler
- Route webview script errors to the "Saropa Log Capture" output channel (previously only logged to browser console)
- Show full stack trace and copy button in webview error banner for easier debugging

### Removed

- Remove irrecoverable dismiss [x] button from Signals strip — the collapse toggle is the only hide mechanism now
- Delete stale one-off commit message scripts (`write-commit-msg.ps1`, `write-drift-commit.ps1`)

### Changed

- Move `generate-db-detector-embed-merge.mjs`, `check-stores-version.ps1`, and `marketplace-gallery-query-body.json` from `scripts/` root into `scripts/modules/`

---

## [5.0.1]

Fixes webview null-reference crashes introduced in 5.0.0 and restores context menu toggle label visibility. [log](https://github.com/saropa/saropa-log-capture/blob/v5.0.1/CHANGELOG.md)

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

For older versions (3.11.0 and older), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

