# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

---
## [Unreleased]

### Fixed
- **Find in Files icon missing:** Replaced invalid `codicon-search-view` (not in codicons 0.0.44) with `codicon-list-filter` so the icon bar button renders correctly.

### Changed
- **Session panel Tidy icon:** Replaced `codicon-text-size` with `codicon-edit` on the Tidy toggle button. The "Aa" glyph had more visual mass than the calendar, tree, and arrow icons on adjacent buttons.

---
## [0.2.6] - 2026-02-03

### Added
- **Configurable file types (`saropaLogCapture.fileTypes`):** The session history, search, file retention, delete, and comparison features now recognize configurable file extensions beyond `.log`. Default: `.log`, `.txt`, `.md`, `.csv`, `.json`, `.jsonl`, `.html`. Drop a `.txt` or `.md` into the reports directory and it appears in the session list. The setting is an array of dot-prefixed extensions; reload the window after changes.
- **Find in Files panel (Ctrl+Shift+F):** New "Find in Files" icon in the activity bar searches all log files in the reports directory concurrently. Shows matched files with match count badges. Click a file to open it and jump to the first match; click again to cycle through subsequent matches. Supports case-sensitive, whole-word, and regex toggles matching the in-file search options. Results update with 300ms debounce as you type.
- **Bookmarks panel:** New "Bookmarks" tab in the Saropa Log Capture panel. Right-click any log line and choose "Bookmark Line" to save it with an optional note. Bookmarks are grouped by file, persist across sessions via workspace state, and clicking a bookmark navigates back to that line. Includes search/filter, edit note, delete individual or all bookmarks with confirmation dialogs.
- **Context lines slider in level flyup:** The level filter fly-up menu now includes a slider (0–10) to adjust how many preceding context lines are shown when filtering by level. Replaces the static VS Code setting default for real-time control.
- **Source link context menu:** Right-clicking a filename/source reference (e.g. `lib/main.dart:42`) now shows file-specific actions: Open File, Copy Relative Path, and Copy Full Path. Previously showed the browser's default Cut/Copy/Paste menu.
- **Copy Line and Copy All in context menu:** Right-click a log line to see Copy Line and Copy All at the top of the menu. Decorated variants (Copy Line Decorated, Copy All Decorated) include the level emoji, sequence counter, and timestamp prefix.
- **Inline Go to Line (Ctrl+G):** Replaced the VS Code input box round-trip with an inline overlay that scrolls instantly while typing. Numbers-only input, Escape reverts to original position, Enter confirms. Animated slide-down appearance.

### Fixed
- **Right-click line detection:** Log line elements were missing `data-idx` attributes, so the context menu could never identify which line was right-clicked. All line-specific menu items (Copy Line, Pin, etc.) now appear correctly.
- **Ctrl+A selecting footer:** Added `user-select: none` to the footer bar so Ctrl+A only selects log content, not the status bar.
- **False "performance" classification:** Removed overly generic `slow` and `lag` keywords from the performance-level regex. Words like "slow-cooked" in normal log data no longer trigger the performance filter.
- **Unformatted line counts:** Footer line count, level filter dot counts, fly-up circle counts, and VS Code status bar now display comma-separated numbers (e.g., `12,868` instead of `12868`).
- **Level filter dots hard to see:** Increased dot size from 9px to 10px with `min-width`/`min-height` guarantees and wider gap (1px → 3px) between dot and count for clearer visibility.
- **Footer filename not actionable:** Clicking the log filename in the footer now reveals and selects the file in the Session History tree view. The filename shows a dotted underline and turns blue on hover to indicate it is clickable.
- **Minimap markers not updating:** Markers now show for all non-info severity levels (error, warning, performance, todo, debug, notice) with distinct colors. Added direct `scheduleMinimap()` calls in the data flow so the minimap rebuilds reliably when new lines arrive or data is cleared, independent of the monkey-patch hook on `renderViewport`.
- **Minimap click vs drag:** Clicking the minimap immediately entered drag mode, so any mouse movement after a click caused unwanted scrolling. Now a single click navigates to that position and stops; drag mode only activates after 3px of movement while holding the mouse button.
- **Minimap drag scrolling broken:** Dragging the minimap caused erratic viewer movement because `suppressScroll` was reset immediately, allowing the RAF-debounced scroll handler to fire mid-drag and trigger `renderViewport` DOM changes that destabilized the scroll position. Now `suppressScroll` stays true for the entire drag operation, with viewport rendering done synchronously in `scrollToMinimapY`.
- **Minimap scroll mapping used stale height:** Click and drag positions were mapped using `minimapCachedHeight` which could be 120ms stale. Now uses a `mmHeight()` helper that falls back to the always-current `totalHeight` global.
- **Minimap wheel deltaMode not handled:** Forwarded `deltaY` as raw pixels regardless of `e.deltaMode`, so line-mode or page-mode scroll events barely moved the content. Now multiplies by `ROW_HEIGHT` or `clientHeight` for modes 1 and 2.
- **Minimap markers hidden behind viewport indicator:** Added `z-index: 1` to `.minimap-marker` so colored severity markers paint above the semi-transparent viewport overlay.

---
## [0.2.5] - 2026-02-02

### Added
- **Right-click context menu:** Custom context menu on log lines with Copy (line text), Search Codebase, Search Past Sessions, Open Source File, Show Context, Pin Line, Add Note, Add to Watch List, and Add to Exclusions. Global actions (Copy selection, Select All) appear regardless of click target. Line-specific items auto-hide when right-clicking empty space.
- **Show Context in context menu:** The inline peek (surrounding context lines) is now triggered via right-click → "Show Context" instead of double-click. Double-click now performs native word selection as expected.
- **Go to Line (Ctrl+G):** Opens a VS Code input box to jump to a specific line number. Scrolls the virtual viewport to the target line.
- **Page Up / Page Down:** PgUp and PgDn keys scroll the log content by 80% of the viewport height.
- **Keyboard font zoom:** Ctrl+= / Ctrl+- adjust font size by 1px. Ctrl+0 resets to 13px default.
- **Ctrl+scroll zoom:** Hold Ctrl and scroll the mouse wheel to increase/decrease font size.
- **Ctrl+A scoped to log content:** Ctrl+A selects only the visible log lines in the viewport, not the entire webview UI (icon bar, panels, footer).
- **Tab navigation and focus indicators:** Icon bar buttons are now keyboard-navigable via Tab. Focus-visible outlines use `--vscode-focusBorder` for accessibility.
- **Search match persistence:** Closing the search panel no longer clears match positions. Reopening restores the previous query and match index, so F3 continues from where you left off.
- **CSS animations throughout the viewer:** Context menu fades in with a subtle scale, level flyup slides up from the footer, log line hover backgrounds transition smoothly, footer buttons blend on hover, filter badges pop in when activated, search current-match pulses on navigation, minimap viewport glides instead of jumping, inline peek slides open, jump-to-bottom button fades in, and pinned items slide in from the left. All pure CSS with short durations (0.08–0.4s) to feel responsive without sluggishness.

### Removed
- **Source preview hover popup:** Removed the floating tooltip that appeared when hovering over source links in stack traces. The popup was easily triggered accidentally and obscured log content. Single-click on source links (or right-click → Open Source File) already navigates to the file.
- **Watch count chips in footer:** Removed the red/yellow keyword watch chips from the viewer footer. They duplicated the level classification counts and confused the UX. Watch counts remain visible in the VS Code status bar.
- **Minimap toggle:** The scrollbar minimap is now always on — there is no reason not to have it. Removed the `opt-minimap` checkbox from the Options panel, the `toggleMinimap()` function, and the `minimap-active` CSS class. Native scrollbar is always hidden; the minimap panel is the only scrollbar.

### Changed
- **Clickable level filter dots:** Each colored dot in the footer now directly toggles its level filter on click (e.g., click the red dot to hide/show errors). Previously, clicking anywhere on the dots opened the fly-up menu.
- **Level dot counts:** Footer dots now show live counts next to each dot when > 0, so you can see at a glance how many errors, warnings, etc. exist.
- **Fly-up menu trigger:** The fly-up filter menu (with Select All/None and text labels) is now opened by clicking the "All"/"3/7" label text instead of the dots.
- **Status bar opens log file:** Clicking the status bar line count now opens the active log file in the editor instead of just focusing the sidebar viewer tab. Follows the "counts are promises" principle — if the bar shows a count, clicking reveals the underlying data.
- **Inline exclusion input:** Exclusion patterns can now be added directly in the Options panel via a text input + Add button. Replaces the previous "Configure in Settings" link that opened VS Code's JSON settings.
- **Visual spacing enabled by default:** Breathing room between log sections is now on by default for easier reading. Toggle off via the options panel.
- **Word wrap disabled by default:** Log lines no longer wrap by default, preserving original formatting. Toggle on via the options panel or press W.
- **Double-click restores native behavior:** Removed the double-click handler that opened the inline peek context modal. Double-click now selects words normally, matching standard text editor behavior.

### Fixed
- **App-only filter had no effect on regular log lines:** The "App only (hide framework)" toggle only hid framework stack frames (`    at ...` lines), ignoring regular output. Android logcat lines (`D/FlutterJNI`, `D/FirebaseSessions`, `I/Choreographer`, etc.) passed through unfiltered. Extended line classification to detect Android logcat tags and launch boilerplate, stored `fw` flag on all line items, and rewired the toggle to use `recalcHeights()` so it composes with all other filters. `I/flutter` lines (app output) remain visible while framework/system noise is hidden.
- **Severity bar never showed framework color:** `renderItem()` checked `item.isFramework` (never set) instead of `item.fw` for the severity bar CSS class.
- **Scrollbar minimap redesigned as always-on interactive panel:** The minimap was an invisible 8px overlay hidden behind the opaque native scrollbar. Redesigned as a 60px wide always-on flex-sibling panel that replaces the native scrollbar entirely. Supports click-to-scroll (centers viewport on clicked position), drag-to-scroll, and mouse wheel forwarding. Shows a draggable viewport indicator.
- **Minimap markers for hidden lines:** Error/warning markers were generated for all lines regardless of filter state, creating phantom marks at wrong positions for lines with `height === 0` (filtered, collapsed). Now skips hidden lines and stack-frame lines (previously every frame in a stack trace generated its own red marker).
- **Minimap missing performance markers:** Only errors and warnings were shown. Added purple markers for performance-level lines using `--vscode-editorOverviewRuler-infoForeground`.
- **Scroll position redesign:** Complete rewrite of the virtual scrolling system. Toggling filters, collapsing stack traces, or changing font size no longer jumps the view to a random position — the first visible line stays anchored. Auto-scroll to bottom no longer causes double-render feedback loops. Prefix-sum array replaces O(n) linear scans with O(log n) binary search for viewport calculations. Stack frame height lookup is now O(1) via cached group headers instead of O(n²) nested scans. Row height is measured from the DOM instead of hardcoded, so spacer heights stay correct after font/line-height changes. Trimming old lines (50K limit) now adjusts scroll position by the removed height.
- **Footer level label blank:** The static "Levels" label next to the filter dots gave no indication of active state. Now shows "All" when all 7 levels are enabled, "N/7" when partially filtered, or "None" when all disabled. Footer dots also gained `flex-shrink: 0` to prevent collapsing in the flex layout.
- **"All" not highlighted in level flyup:** The All/None links in the level flyup had no active state, making it unclear whether all levels were enabled. Both links now highlight (using VS Code button colors) when their respective state is active.
- **Level flyup text center-aligned:** Button text in the level flyup defaulted to browser center alignment, making labels hard to scan. Added explicit left alignment (`justify-content: flex-start`, `text-align: left`) while keeping counts right-aligned.
- **Level flyup missing title:** The flyup opened directly into All/None links with no context. Added a "Level Filters" title header above the links to clarify purpose and resolve "levels vs filters" terminology confusion.

---
## [0.2.4] - 2026-02-02

### Changed
- **Search toggles match VS Code:** Match Case, Match Whole Word, and Use Regular Expression buttons now use codicon icons (`codicon-case-sensitive`, `codicon-whole-word`, `codicon-regex`) positioned inline inside the search input, matching VS Code's native search layout. Active state uses VS Code's `--vscode-inputOption-*` theme variables.
- **Search history arrow navigation:** Up/Down arrow keys in the search input cycle through recent search terms, matching VS Code and terminal conventions. Clickable history list below the input is retained.

### Removed
- **Clear search button:** Removed the `×` clear button from the search input. Use Escape to close (which clears), or select-all and delete.

---
## [0.2.3] - 2026-02-02

### Fixed
- **Stats counters not resetting on file load:** Level counts (e.g., "125 info") accumulated across sessions because the stats script only listened for 'reset' messages, not 'clear'. Now resets on both, fixing phantom counts that misled users about current file content.
- **Filter badge stretches footer:** Added `line-height: 1` to `.filter-badge` to prevent the badge from being taller than the footer bar.

### Changed
- **Level flyup redesigned:** Level filter circles now show left-aligned rows with emoji, text label, and count (e.g., `🔴 Error 2`). All/None links restyled as bordered buttons. Flyup min-width increased for labels.
- **Level dot trigger visible:** Footer level dots enlarged from 7px to 9px, inactive opacity raised from 0.2 to 0.3, and "Levels" text label added for discoverability. Hover shows border to signal interactivity.
- **Filter badge opens level flyup:** When the only active filter is a level filter, clicking the badge now opens the level flyup instead of the options panel. Mixed filters still open options.
- **Footer filename opens Project Logs:** Clicking the footer text (line count + filename) now opens the Project Logs session panel.

---
## [0.2.2] - 2026-02-02

### Fixed
- **Line prefix sub-options misplaced:** Decoration sub-options (severity dot, counter, timestamp, etc.) appeared below the minimap checkbox instead of under their parent "Line prefix" checkbox. Moved to correct position and changed from show/hide to always-visible with disabled styling when line prefix is off.
- **Inline context option non-functional:** Removed the "Show inline context (file >> function)" option — context data was only extracted for stack frames, so it never worked for regular log lines.
- **Audio preview CSP blocked:** Preview sound buttons did nothing because the Content Security Policy `media-src` used the audio directory URI instead of the webview's `cspSource` authority. Fixed to use `cspSource` for consistent resource authorization.
- **Codicon icons invisible in webview:** The v0.2.1 CSP fix added `font-src` but the codicon font was never loaded — webviews are sandboxed and don't inherit VS Code's fonts. Now bundles `@vscode/codicons` and loads the stylesheet via a `<link>` tag, with `style-src` extended to allow it. Fixes all icons in the icon bar, context menu, and session panel.

### Added
- **Source location in log files:** New `includeSourceLocation` setting (off by default) appends the originating file and line number to each log line, e.g. `[app.ts:42]`. Requires the debug adapter to supply source info in DAP OutputEvents.
- **Elapsed time in log files:** New `includeElapsedTime` setting (off by default) prefixes each log line with the delta since the previous line, e.g. `[+125ms]`. Useful for spotting performance gaps.
- **Verbose DAP protocol logging:** New `verboseDap` setting (off by default) logs all raw DAP protocol messages (requests, responses, events) to the log file. Directional prefixes distinguish outgoing (`[dap->]`), incoming (`[dap<-]`), and event (`[dap:event]`) messages. JSON payloads are truncated at 500 characters.
- **Pop-out viewer:** New icon-bar button (link-external icon) and command (`Saropa Log Capture: Pop Out Viewer to New Window`) that opens the log viewer as a floating editor panel, movable to a second monitor. The pop-out coexists with the sidebar — both receive the same live data via a broadcast architecture. Closing and reopening the pop-out preserves the connection. Also available from the view title bar.
- **Session display options:** Four toggle buttons in the Project Logs panel header control how session filenames are displayed: **Dates** (show/hide leading and trailing datetime patterns — hidden by default), **Tidy** (normalize to Title Case with spaces — enabled by default), **Days** (group sessions under colored day headings like "Tue, 3rd Mar 2026" — enabled by default), and **Sort** (toggle between newest-first and oldest-first with a dynamic arrow icon). All options persist per-workspace via `workspaceState`. The same transforms apply to both the webview session panel and the native tree view. The panel stays open when selecting a file.
- **File modification date+time in session list:** Session items now show the file's last-modified date and time (e.g. "Feb 2, 4:13pm") before the file size in the metadata line. When day headings are shown, only the time is displayed to avoid redundancy.
- **Seconds trimmed from session filenames:** Filenames like `20260202_143215_session.log` are automatically displayed as `20260202_1432_session.log` for compactness. Always applied, independent of the display option toggles.

### Changed
- **Session info moved to icon bar:** The ℹ️ session info button is now in the right-side icon bar (between Search and Options) instead of the header bar. Click to open a slide-out panel showing full session metadata. Uses the same mutual-exclusion pattern as the other icon bar panels. The compact prefix line at the top of the log content is unchanged.
- **Header bar removed:** The viewer header bar (filename + collapse toggle) is removed entirely. The log filename and extension version now appear in the footer status text as `·`-separated segments (e.g., `● 42 lines · dart_session.log · v0.2.2`), reclaiming vertical space.
- **Marketplace banner image 404:** README banner pointed to the wrong GitHub repository (`saropa_lints`). Corrected URL to `saropa-log-capture`.
- **README: invite contributions:** Added GitHub activity badges (stars, forks, last commit, issues, license), a feedback callout linking to the issue tracker, an expanded Contributing section with quick-start steps and issue-reporting guidance, a Documentation table linking to CONTRIBUTING.md / CHANGELOG.md / ROADMAP.md / STYLE_GUIDE.md, and a footer with project links.

---
## [0.2.1] - 2026-02-02

### Fixed
- **Icon bar icons invisible in dark mode:** The Content Security Policy blocked the codicon font from loading (`default-src 'none'` with no `font-src`). Now passes `webview.cspSource` to the CSP so VS Code can inject its icon font.
- **Search mode toggle resets search text and breaks filter/clear:** Clicking any button inside the search panel (mode toggle, regex, case, clear) could trigger the document-level click-outside handler, closing the panel and clearing state. Toggle buttons were especially affected because `textContent` assignment detaches the original click target text node, making `contains()` fail. Fixed by stopping event propagation at the search bar boundary so internal clicks never reach the outside-click handler.
- **Scrollbar minimap disappears on scroll:** The minimap was positioned absolute inside the scrollable `#log-content` container, causing it to scroll away with the content. Wrapped `#log-content` in a non-scrolling `#log-content-wrapper` and moved the minimap to the wrapper so it stays viewport-fixed.

### Changed
- **Status bar split into two items:** The status bar is now two separate clickable items: a pause/resume icon that toggles capture state, and a text display (line count + watch counts) that focuses the sidebar viewer panel. Follows the VS Code convention where clicking a count reveals the associated view.
- **Watch chips are clickable:** Footer watch count chips (e.g., "error: 4") now open the search panel pre-filled with the keyword and navigate to the first match. Adds pointer cursor and hover effect to signal interactivity.
- **Native Session History tree view hidden:** The separate tree view below the Log Viewer is replaced by the in-webview Project Logs panel accessible from the icon bar.
- **Session panel renamed:** "Sessions" panel renamed to "Project Logs" with matching icon bar tooltip.
- **Icon bar sessions icon:** Changed from history (clock) to files icon to better represent project log files.
- **Dev script rewritten as publish pipeline:** `scripts/dev.py` now supports a gated analyze-then-publish workflow (16 steps) with `--analyze-only` for local dev builds and full publish to VS Code Marketplace + GitHub releases. Retains all original dev toolkit features (VS Code extension installs, global npm packages, version sync, local .vsix install prompts).
- **Dev script split into modules:** `scripts/dev.py` (1756 lines) refactored into 9 focused modules under `scripts/modules/` (constants, display, utils, checks_prereqs, checks_environment, checks_project, publish, report, install) with a layered dependency graph and no circular imports. `dev.py` remains the entry point with CLI parsing and orchestration.

---
## [0.2.0] - 2026-02-02

### Added
- **Icon bar:** VS Code activity-bar-style vertical icon bar on the right edge of the log viewer with icons for Session History, Search, and Options. Clicking an icon toggles its slide-out panel with mutual exclusion (only one panel open at a time). Uses codicon icons with an active indicator bar matching VS Code's activity bar pattern.
- **Session history panel:** New in-webview slide-out panel listing past log sessions from the reports directory. Shows filename, debug adapter, file size, and date. Clicking a session loads it into the viewer. Active (recording) sessions are highlighted. Panel refreshes on each open.

### Changed
- **Footer simplified:** Removed Search and Options buttons from the footer — these are now accessible from the icon bar. The footer retains line count, level filter dots, watch chips, and filter badge.
- **Body layout restructured:** The webview body is now a flex-row containing the main content column and the icon bar column, instead of a single flex-column.

### Added
- **Historical log file timestamps:** Opening a log file from Session History now parses the `[HH:MM:SS.mmm]` timestamps from each line (using the `Date:` header for the date component), enabling elapsed time and timestamp decorations on historical files. Previously timestamps were discarded during file loading.
- **Timestamp availability gating:** Time-related decoration options (Timestamp, Show milliseconds, Elapsed time) are automatically disabled and grayed out when viewing a log file that has no parsed timestamps. Re-enabled when switching to a file with timestamps or starting a live session.
- **Session history timestamp icons:** Sessions in the history tree now show a `history` icon (clock) when the file contains timestamps, or an `output` icon (plain text) when it does not. Active recording sessions retain the red `record` icon. Tooltip includes "Timestamps: Yes/No".

### Fixed
- **Warning and Performance level toggles had no visual feedback:** The button IDs used abbreviated names (`level-warn-toggle`, `level-perf-toggle`) but `toggleLevel()` constructed IDs from the full level name (`level-warning-toggle`, `level-performance-toggle`). The `getElementById` returned null, so the `active` class never toggled. Also fixed the same stale IDs in `resetLevelFilters()`.
- **Visual spacing option had no visible effect:** The spacing logic ran after early returns for markers, stack-headers, and stack-frames — so it never applied to those item types. CSS selectors were also scoped to `.line` only. Moved computation before early returns, broadened conditions to trigger on any level change, separator lines, markers, and new stack traces, and widened CSS selectors to all element types.
- **Level circle counts invisible in dark mode:** The `.level-circle` buttons didn't set an explicit `color`, so count numbers used the browser default (black) instead of the VS Code theme foreground. Added `color: inherit` so counts adapt to light and dark themes.
- **Session Info modal persists across session loads:** The `clear` handler dismissed the context peek but not the Session Info modal. Once opened, the modal stayed visible every time a new log was selected. Now `hideSessionInfoModal()` is called on clear.
- **Search input unresponsive during typing:** `updateSearch()` ran synchronously on every keystroke — iterating all lines for regex matching, height recalculation, and DOM rendering — blocking the browser from repainting the input. Characters appeared not to register on large log files. Search is now debounced (150 ms) so characters appear instantly.
- **Search filter persists after clearing text:** Removing all search text or closing the search panel while in highlight mode left stale `searchFiltered` flags on lines, hiding them until a manual filter reset. Now always clears the search filter regardless of search mode.

### Changed
- **Level filters moved to fly-up menu:** The 7 inline level-circle buttons in the footer are replaced by a compact row of colored dots. Clicking the dots opens a fly-up popup with the full toggle buttons plus Select All / Select None links. The popup stays open while toggling and closes on click-away or Escape.
- **Exclusions UX overhaul:** Replaced the bare "Enable exclusions" checkbox with a richer section. The toggle label now shows the pattern count (e.g. "Exclusions (3)"). Each configured pattern is displayed as a removable chip below the toggle. Chips dim when exclusions are toggled off. When no patterns are configured, an empty state with a "Configure in Settings" link is shown. Removing a chip persists the change to workspace settings.

### Added
- **Per-file level filter persistence:** Level filter toggle state is saved per log file in workspace storage. When switching between files or reloading, each file's filter state is automatically restored.
- **Tooltips on all options panel controls:** Every checkbox, slider, dropdown, and button in the Options panel now has a descriptive `title` attribute that explains what the option does on hover.
- **Search clear button:** An × button appears inside the search input when text is present, following standard textbox conventions. Click to clear and reset the search.
- **Search history:** Last 10 search terms shown below the input when the search panel opens. Click any term to re-run that search. Persists across webview reloads via webview state.
- **Scroll position memory per file:** When switching between log files, the viewer remembers where you were scrolled to. Positions are saved when not at the bottom; files you were following at the bottom stay at the bottom on return.
- **Whole-line coloring for all severity levels:** Previously only error and warning lines received a background tint; all other levels (info, performance, todo, debug, notice) were ignored, making the feature appear broken. Now all 7 levels get a distinct tint color. Opacity increased from 8% to 6–12% (14–20% on hover) so the effect is actually visible.

---
## [0.1.15]

### Fixed
- **Scroll flickering from ResizeObserver loop:** The `ResizeObserver` on `#log-content` called `renderViewport(true)` unconditionally, bypassing the visible-range bail-out check. Every DOM replacement triggered another resize observation, creating a feedback loop. Now RAF-debounced and uses `renderViewport(false)` so no-op re-renders are skipped.
- **Layout thrashing in scroll handler:** `jumpBtn.style.display` write was sandwiched between DOM reads and `renderViewport`'s internal reads, forcing a synchronous reflow on every scroll frame. Moved the write after all reads complete.
- **Broad `transition: all` causing render stutter:** `#viewer-header` and `#error-badge` used `transition: all 0.2s ease`, keeping the compositor busy animating layout properties during re-renders. Replaced with specific property transitions (`min-height`, `padding`, `border-bottom` for header; `background` for badge).

---
## [0.1.14]

- Dev build

---
## [0.1.13]

### Changed
- **Footer UI consolidation:** Slimmed footer to just: line count, level circles, filter badge, search button, and options button. Removed 7 toggle buttons (wrap, exclusions, app-only, decorations, audio, minimap, export) that are now in the options panel.
- **Category filter redesign:** Replaced the `<select multiple>` dropdown with dynamic checkboxes in the new Output Channels section of the options panel.
- **Source tags moved to options panel:** Source tag chip strip removed from above the log content. Tags now live in a Log Tags section inside the options panel with the same All/None toggle and count chips.
- **Options panel reorganized:** Consolidated all settings into logical sections — Quick Filters (presets + reset), Output Channels, Log Tags, Noise Reduction (exclusions + app-only), Display, Layout, Audio, and Actions (export).
- **Footer buttons use text labels:** Export and Search buttons now show text instead of emoji (💾 → "Export", 🔍 → "Search").
- **Clearer footer status text:** Replaced ambiguous "Viewing: 24 lines" with just "24 lines". Recording shows "● 24 lines" (red dot), paused shows "⏸ 24 lines".
- **Merged stats + level filters:** The separate stats counters (🔴 4, 🟠 95) and level filter circles (🟢🟠🔴🟣⚪🟤🟦) are now a single set of circles that show counts AND act as toggle filters.

### Added
- **Filter badge:** Footer shows an active filter count badge (e.g. "3 filters") that opens the options panel when clicked. Auto-updates via hooks on `recalcHeights()` and `toggleAppOnly()`.
- **Reset all filters button:** Quick Filters section includes a "Reset all filters" button that clears every filter type (levels, categories, exclusions, app-only, source tags, search) in one click.
- **`setExclusionsEnabled()` function:** Presets can now programmatically enable/disable exclusions (was missing, causing presets to silently fail for exclusion state).
- **Scrollbar minimap option in Options panel:** New "Scrollbar minimap" checkbox in the Display section.
- **Decoration sub-options in Options panel:** Added "Show milliseconds" and "Severity bar (left border)" checkboxes for feature parity with the decoration settings popover.
- **STYLE_GUIDE.md:** Documents UI patterns, font sizes, button styles, spacing, color conventions, and anti-patterns for the log viewer webview.

### Fixed
- **Options panel reading undefined `exclusionsActive`:** The exclusion checkbox was reading a non-existent `exclusionsActive` variable instead of `exclusionsEnabled`, causing the checkbox to never reflect actual state.
- **Preset "None" not resetting filters:** Selecting "None" in the preset dropdown now calls `resetAllFilters()` instead of just clearing the preset name.
- **Duplicate `#export-btn` CSS:** Was defined in both `viewer-styles-modal.ts` (14px) and `viewer-styles-overlays.ts` (10px). Consolidated into a single `.footer-btn` class.
- **Mouse wheel scroll hijacking:** A custom `wheel` event listener intercepted native scrolling, applied a 0.5x multiplier, and called `preventDefault()` — killing browser-native smooth/inertia scrolling and causing choppy, erratic scroll behavior. Removed the handler so `#log-content` uses standard `overflow-y: auto` scrolling.

### Removed
- **Dead code:** Removed unused `exclusionsActive` variable, dead `getPresetDropdownHtml()` export, and orphaned `#preset-select` CSS from overlay styles.

---
## [0.1.12]  - 2026-02-01

- Dev Build

---
## [0.1.11]  - 2026-02-01

### Fixed
- **Source preview popup not dismissible:** The hover preview over stack trace source links had no close affordance — it only auto-hid when the mouse moved away. Added a close button (×), Escape key, and click-outside dismissal.
- **Decoration counter showing `#&nb` instead of numbers:** `padStart(5, '&nbsp;')` used the 6-character literal HTML entity as a JavaScript padding string, causing truncated gibberish. Now pads with Unicode non-breaking space (`\u00a0`).
- **Inconsistent datetime in log filenames:** Filename format now uses compact datetime (`YYYYMMDD_HHMMSS_name.log`) for uniqueness and consistency. Rename and metadata parsing handle both legacy (`HH-MM`, `HH-MM-SS`) and current (`HHMMSS`) formats.
- **Session info expander always blank:** The collapsible session header never displayed data because (1) header lines were stripped before reaching the webview and (2) the JavaScript hook referenced a non-existent `handleSetContent` function. Redesigned as a compact prefix line at the top of the log content (showing adapter, project, config, date) with an ℹ️ icon button in the header bar that opens a modal with full session metadata. Now works for both live sessions and historical file loads.
- **Viewer flickering and inability to scroll:** The scrollbar minimap wrapped `renderViewport` with `setTimeout(updateMinimap, 50)` on every call, including scroll-only renders. This created a feedback loop (scroll → render → 50ms minimap DOM rebuild → layout recalc → scroll) that caused constant flickering and unwanted auto-scrolling to bottom via the ResizeObserver. Fixed by only scheduling minimap rebuilds on data changes (`force=true`), debouncing rapid updates, and using cached heights for the scroll handler.
- **Scrollbar minimap O(n²) performance:** Minimap marker placement re-iterated all preceding lines for each marker to compute cumulative height. Replaced with a single O(n) pre-computed array. The scroll-time viewport indicator now uses cached total height (O(1)) instead of recalculating on every frame.

### Added
- **Copy File Path:** Right-click a session in Session History and select "Copy File Path" to copy the full filesystem path to clipboard.

### Refactored
- **Split oversized commands module:** Extracted session comparison commands from `commands.ts` (305 lines) into `commands-comparison.ts` to comply with the 300-line file limit.

### Changed
- **Decorations enabled by default:** The `saropaLogCapture.showDecorations` setting now defaults to `true` so new users see line prefixes (severity dot, counter, timestamp) out of the box.
- **Emoji toggle buttons:** Replaced text-based footer toggles (`Deco: OFF`, `Audio: OFF`, `Minimap: ON`) with emoji buttons (🎨, 🔔/🔕, 🗺️). Active state shown at full opacity; inactive at 35% opacity. Tooltips explain current state and action.
- **Clearer options panel label:** Renamed "Show decorations" to "Line prefix (🟢 #N T00:00:00)" so users can see exactly what the toggle controls.
- **Search is now a slide-out panel:** Converted the inline search bar to a toggleable slide-out panel from the right edge, matching the options panel pattern. Added a 🔍 toolbar button in the footer. Keyboard shortcuts (Ctrl+F, F3, Escape) still work. Search and options panels are mutually exclusive — opening one closes the other.
- **Version inline with filename:** Version string now sits immediately after the filename in the header bar instead of floating as a separate right-aligned element.

---
## [0.1.10]  - 2026-02-01

### Fixed
- **Viewer blank due to regex SyntaxError:** An invalid character class range in `isSeparatorLine` (`[=\\-+...]` produced range `\` to `+` with start > end) caused a SyntaxError that killed the entire webview script block. Fixed by moving `-` to end of character class.
- **Double-escaped regexes in viewer scripts:** `extractContext` in data helpers and decoration-stripping regexes in the export script used `\\\\s`/`\\\\d` which produced literal `\s`/`\d` instead of whitespace/digit classes. Fixed to single-escaped.
- **Export join produced literal `\n`:** `lines.join('\\\\n')` in export script produced literal backslash-n instead of newline. Fixed to `\\n`.
- **Session file loading race condition:** Loading a historical log file while webview was re-resolving (tab switch) could silently fail. Added generation counter and pending-load retry.

### Added
- **Script fault isolation:** Split the single `<script>` block (33 concatenated scripts) into separate `<script>` blocks per feature. A SyntaxError in one feature no longer kills the entire viewer.
- **Global error handler:** New first-loaded script catches uncaught errors, shows a visible red banner in the webview, and reports errors to the extension host via `console.warn`.
- **Build-time syntax validation test:** New test extracts all `<script>` blocks from the generated HTML and validates each with `new Function()`, catching SyntaxErrors before release.

---
## [0.1.9]  - 2026-02-01

- Development build

---
## [0.1.8] - 2026-02-01

### Fixed
- **Options panel button unresponsive:** The slide-out options panel used `right: -25%` to hide off-screen, but with `min-width: 280px` it remained partially visible in narrow sidebar viewports (z-index 250), silently intercepting clicks on footer buttons including the options toggle. Changed to `right: -100%` with `pointer-events: none` when closed.
- **Duplicate error breakpoint elements:** `getErrorBreakpointHtml()` was called twice in the viewer HTML template, creating duplicate `error-badge` and `error-modal` elements with the same IDs. Removed the stray call outside the footer.
- **Missing `escapeHtml()` in webview:** The function was called by repeat notifications, edit modal, and session header scripts but was only defined in the TypeScript extension host (not injected into the webview). Added the function to the webview data helpers script.
- **Dead audio mute code:** Removed `audioMuted` variable, `toggleAudioMute()`, and `updateAudioMuteButton()` which referenced a nonexistent `audio-mute-toggle` element with no corresponding HTML or event wiring.
- **Split breadcrumb shows wrong part number:** `setSplitInfo(totalParts, totalParts)` passed `totalParts` for both arguments, so the breadcrumb always showed "Part N of N" after a split instead of the actual current part number. Now passes the correct `partNumber`.
- **Audio files never loaded (doubled path):** `initAudio()` appended `/audio/` to a URI that already pointed to the `audio/` directory, creating an invalid path like `audio/audio/swipe_low.mp3`. Removed the redundant segment.
- **Version string type assertion:** `as string ?? ''` made TypeScript treat the version as always a string, so the nullish fallback was unreachable. Replaced with `String(... ?? '')` for safe runtime conversion.

### Added
- **Version display in viewer header:** The extension version number (e.g., "v0.1.7") now appears in the log viewer header bar.

## [0.1.6] - 2026-01-31

<!-- cspell:ignore ECONNREFUSED -->
### Added
- **Smart Error Classification:** Automatically classifies error log lines into three categories: 🔥 CRITICAL (NullPointerException, AssertionError, FATAL, etc.), ⚡ TRANSIENT (TimeoutException, SocketException, ECONNREFUSED, etc.), and 🐛 BUG (TypeError, ReferenceError, SyntaxError, etc.). Visual badges appear inline before the log message. Two new settings: `saropaLogCapture.suppressTransientErrors` (default: false) hides expected transient errors via filtering, and `saropaLogCapture.breakOnCritical` (default: false) triggers VS Code notifications when critical errors appear. Helps quickly identify severe issues vs. expected network hiccups.

## [0.1.5] - 2026-01-31

### Added
- **Stack Trace Preview Mode:** Stack traces now show first 3 non-framework frames by default (collapsible preview mode) instead of completely collapsed. Click the header to cycle through: preview → fully expanded → fully collapsed → preview. Framework frames are filtered out in preview mode. Toggle indicator shows ▷ (preview), ▼ (expanded), or ▶ (collapsed).
- **Milliseconds Display:** Added "Show milliseconds" checkbox to decoration settings panel (⚙ gear button). When enabled, timestamps show `.000` milliseconds after the seconds (e.g., `T14:32:15.234`). Works with existing timestamp decoration toggle.
- **Audio Volume Control:** Expanded audio options panel with volume slider (0-100%, default 30%), rate limiting selector (none/0.5s/1s/2s/5s/10s), and preview sound buttons (🔴 Error / 🟠 Warning) to test settings. Volume and rate limiting apply immediately. Rate limiting prevents audio spam by enforcing minimum time between sounds of the same level.
- **Inline Tag Parsing:** Extended source tag filter to extract `[TagName]` patterns anywhere in log lines (not just at the start). Tags like `[API]`, `[Database]`, `[Auth]` are now automatically detected and added to the collapsible Sources panel for filtering. Works alongside existing Android logcat and bracket prefix patterns.
- **Session Info Header:** Collapsible session metadata block appears at the top of the viewer (below split breadcrumb) when loading log files. Shows project name, debug adapter type, configuration name, platform, VS Code version, and extension version. Parsed from the context header block in log files. Click to expand/collapse. Hidden for live sessions (only shows when loading files).
- **Real-Time Repeat Notifications:** Duplicate log lines now show immediate repeat notifications instead of being batched. Shows `"🔴 Repeated log #5 (Connection Refused...)"` with first 85 characters of message preview. Uses smart hash-based detection (`level::message`) instead of exact string matching. Repeat counter resets when a new unique message arrives. 3-second detection window (configurable).
- **Multi-Level Classification:** Added three new log levels with automatic detection and filtering:
  - **TODO Level** (⚪ White): Detects TODO, FIXME, HACK, XXX in logs for task tracking
  - **Debug/Trace Level** (🟤 Brown): Detects breadcrumb, trace, debug keywords for diagnostic logging
  - **Notice Level** (🟦 Blue Square): Detects notice, note, important for informational highlights
  - Each level has dedicated toggle button in footer, checkbox in options panel, color styling, and emoji indicator. All levels work with existing filter presets and context line display.
- **Inline Context Metadata:** Extracts and displays file path, function name, and line number from stack traces as inline breadcrumbs. Shows shortened file paths (last 2 segments) and function names in format `utils/auth.ts:42 » login()`. Toggle on/off via "Show inline context" checkbox in options panel. Automatically parses common stack trace formats (V8, Mozilla, etc.) and displays context for both stack headers and frames.
- **Per-Level Export/Save:** Export filtered logs to file with preset templates or custom level selection. Templates include "Errors Only", "Warnings + Errors", "Production Ready", "Full Debug", and "Performance Analysis". Export options allow including/excluding timestamps, decorations, and ANSI codes. Preview shows line count before export. Accessible via 💾 button in footer.
- **Layout Improvements:** Four new customization features for better readability:
  - **Font Size Adjustment:** Slider control (10-20px) in options panel to adjust log font size independently of VS Code editor settings
  - **Line Height Adjustment:** Slider control (1.0-2.5) in options panel to adjust vertical spacing between log lines
  - **Severity Bar Mode:** Colored left borders (3px) for each log level instead of/alongside emoji dots. Creates continuous vertical bars for consecutive same-level lines. Toggle via decoration settings panel
  - **Visual Spacing (Breathing Room):** Heuristic spacing adds 8px margins before/after key transitions: level changes to errors/warnings, before/after markers. Helps separate logical sections without adding actual newlines. Toggle in options panel

### Refactored
- **File Size Compliance:** Split 6 oversized UI modules (630-391 lines each) into 17 smaller modules (all under 300 lines). Improved code organization by extracting logical sections: modal styles, decoration styles, search/UI components, helper functions, and HTML/script templates. No functional changes — behavior, API surface, and build output are identical.

## [0.1.4] - 2026-01-31

### Added
- **Error Breakpoints:** Configurable visual and audio alerts when errors appear in logs. Features: flash red border around viewer, play alert sound, increment error counter badge (clickable to clear), and optional modal popup. Toggle on/off via footer button. Detects errors via `stderr` category or error keywords (`error`, `exception`, `failed`, `fatal`, `panic`, `critical`). Only triggers once per batch to avoid spam.
- **Search Enhancements:** Added case sensitivity toggle (Aa/AA) and whole word match toggle (\b) to search bar. Both buttons show bold text when active and work in combination with existing regex mode toggle.
- **Live Statistics Counters:** Real-time running totals displayed in footer showing counts for errors (🔴), warnings (🟠), performance issues (🟣), and framework/info logs (🟢). Updates incrementally as lines arrive and resets on session reset.
- **Enhanced Performance Detection:** Extended performance pattern matching to detect Choreographer frame skips (`skipped N frames`), `choreographer`, `doing too much work`, `gc pause`, `anr`, and `application not responding` patterns for better Android/Flutter debugging.
- **Edit Line Modal:** Right-click any log line and select "Edit Line" to open a modal with editable textarea. Changes are saved back to the log file with proper validation. Shows warning badge when debug session is active to prevent concurrent write conflicts. Reloads viewer after successful edit.
- **Scrollbar Minimap:** Visual overview overlay on the scrollbar (8px wide, right edge) showing search match locations (yellow marks), current match (bright orange), error locations (red marks), warning locations (orange marks), and viewport position indicator. Updates automatically when searching or scrolling. Toggle on/off via footer button.
- **Copy All to Clipboard:** Added Ctrl+Shift+A keyboard shortcut and `copyAllToClipboard()` function to copy all visible log lines to clipboard in plain text format.
- **Copy to Search:** Added "Copy to Search" action to right-click context menu. Opens search bar and populates it with the clicked line's text, automatically running the search.
- **ASCII Art Detection:** Enhanced separator line detection to recognize box-drawing characters (─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬) in addition to standard ASCII patterns (===, ---, +---). Lowered threshold to 60% for better detection. Detected separators are styled in yellow with reduced opacity.
- **Minimap Toggle Button:** Added "Minimap: ON/OFF" button to footer for controlling scrollbar minimap visibility.

### Fixed
- **Session History Empty Viewer:** Fixed issue where selecting log files from session history panel resulted in empty viewer. Added retry loop to wait for webview initialization before loading file content (up to 1 second wait).
- **Level Filter Visual Feedback:** Enhanced inactive level filter buttons with three visual indicators: reduced opacity (0.25), grayscale filter (0.8), and strike-through text. Makes toggle state immediately obvious.
- **Session History Sorting:** Fixed incorrect sorting of mixed-format filenames by sorting on file modification time instead of date strings. Ensures newest sessions always appear first regardless of filename format.
- **Double-Click Viewport Jumping:** Fixed random viewport jumping when double-clicking lines to open context peek. Replaced problematic `scrollIntoView` with proper scroll calculation that positions the peeked line consistently at the top of the view.

### Changed
- **Search Bar Width:** Increased minimum width of search input to 200px to prevent it from becoming too narrow when multiple toggle buttons are present.
- **Session State Tracking:** Extension now tracks debug session active/inactive state and currently displayed file URI. Viewer receives `sessionState` messages to enable intelligent warnings and safe file editing.

## [0.1.3] - 2026-01-31

### Refactored
- **File Size Compliance:** Split 12 TypeScript files that exceeded the 300-line limit into 29 files (12 original + 17 new extraction files). All source files now comply with the project's hard limit. No functional changes — behavior, API surface, and build output are identical.

### Changed
- **Enhanced Color Palette:** Updated ANSI color rendering to use VS Code's vibrant terminal color palette, matching the Debug Console appearance. Standard and bright colors (red, green, yellow, blue, cyan, magenta) are now significantly more vibrant and easier to distinguish.
- **Automatic Log Level Coloring:** Log lines are now automatically color-coded by severity — errors appear in red, warnings in yellow, and info lines use the default foreground color for better visual scanning.
- **Panel Location:** Moved the Log Viewer and Session History from the sidebar (Activity Bar) to the bottom panel, next to Output and Terminal tabs. Provides more horizontal space for log lines.

### Added
- **Source Tag Filter:** Collapsible "Sources" panel above the log lines that auto-discovers source tags from Android logcat prefixes (e.g. `D/FlutterJNI`, `I/flutter`) and bracket prefixes (e.g. `[log]`). Each tag appears as a chip with a line count; click to toggle visibility. Includes All/None bulk actions. Tags are grouped by name only (ignoring level prefix), sorted by frequency. Panel stays hidden until tags are detected. Composes with all existing filters (category, exclusion, level).
- **Full Debug Console Capture:** Added `saropaLogCapture.captureAll` setting and UI toggle ("App Only: OFF") to capture all Debug Console output, bypassing category and exclusion filters. When enabled, all system, framework, and app logs are captured. Toggle via the viewer or settings.
- **Line Decorations:** Added `saropaLogCapture.showDecorations` setting and footer "Deco" toggle to prefix each viewer line with a colored severity dot (🟢/🟠/🔴), sequential counter (#N), and wall-clock timestamp. A gear button (⚙) opens a settings popover to toggle individual parts and enable "Whole line" coloring mode (subtle background tint by severity). Viewer-only — log files are not modified.
- **Level Filter:** Added All/Errors/Warn+ segmented buttons in the footer to filter log lines by severity. Configurable context lines (`saropaLogCapture.filterContextLines`) shown dimmed around matches.
- **Inline Peek:** Double-click any log line to expand an inline peek showing surrounding context lines. Press Escape to dismiss. Configurable range via `saropaLogCapture.contextViewLines`.
- **Expanded Highlight Rules:** Default highlight patterns now include Fatal, TODO/FIXME, Hack/Workaround, Deprecated, Info, and Debug in addition to Error, Warning, and Success.
- **Historical Log Viewing:** Opening a session from Session History now loads it into the panel viewer instead of as a raw text file.
- **Developer Toolkit** (`scripts/dev.py`): One-click script replacing `init_environment.py` and `build_and_install.py`. Runs the full pipeline automatically: prerequisites, deps, compile, quality checks, package .vsix. Interactive prompts only at the end (install via CLI, open report). Features Saropa ASCII logo, colored output, per-step timing bar chart, and automatic reports to `reports/`.

### Fixed
- **ANSI Color Rendering:** Updated Content Security Policy to allow inline styles (`'unsafe-inline'`), fixing blocked ANSI color rendering in the log viewer and session comparison views. Colors from debug output now display correctly.
- **Viewer Controls:** Fixed all non-working buttons and controls (Excl ON, App Only, All/Errors/Warn+, Preset dropdown, category filter, Deco toggle, settings panel) by removing inline event handlers that were blocked by Content Security Policy. Converted all `onclick`/`onchange` handlers to proper `addEventListener` calls.
- **Historical Log Viewing:** Skips context header block, parses `[category]` prefixes for proper stderr coloring, detects markers, and sends lines in async batches to avoid UI freezing. Footer shows "Viewing:" instead of "Recording:" for historical files.
- **Filter Coordination:** Category, exclusion, and level filters now respect each other's state via shared `recalcHeights()`. Previously, applying one filter could override another's visibility decisions.
- **Inline Peek on Double-Click:** Fixed DOM index mapping when lines have gap markers or annotations — `querySelectorAll` now counts only line-level elements.
- **Inline Peek on Clear:** Peek is now closed when the viewer is cleared, preventing stale content.
- **Context Line Settings:** Setting `filterContextLines` or `contextViewLines` to 0 is now honored (previously treated as default due to falsy-zero).
- **Success Highlight:** Pattern now matches "successfully" and "successful" in addition to "success", "passed", and "succeeded".
- **Config Timing:** Highlight rules and presets are cached and sent when the webview initializes, so historical file views get proper coloring even without a prior debug session.

## [0.1.0] - 2026-01-28

First public release on the VS Code Marketplace.

### Core Features

- **Auto-capture**: Debug Console output saved to `.log` files automatically when debugging starts
- **Live sidebar viewer**: Real-time log streaming with virtual scrolling (100K+ lines)
- **ANSI color support**: Full color rendering in viewer, raw codes preserved in files
- **Click-to-source**: Click `file.ts:42` patterns to jump to source; Ctrl+Click for split editor
- **Collapsible stack traces**: Auto-detected and grouped; press `A` for app-only mode
- **Search**: Ctrl+F with regex support, F3/Shift+F3 navigation, match highlighting
- **Session history**: Browse past sessions with metadata (adapter type, size, date)

### Session Management

- **Rename sessions**: Right-click to set display names (also renames file on disk)
- **Tag sessions**: Add `#tags` for organization; auto-tags with `~prefix` from content patterns
- **Annotations**: Press `N` to annotate lines; persisted and exported
- **Pin lines**: Press `P` to pin important lines to sticky header
- **Deep links**: Share `vscode://` URLs that open specific sessions and lines

### Export Options

- **HTML export**: Static or Interactive with search, filters, and theme toggle
- **CSV export**: Structured columns (timestamp, category, level, line_number, message)
- **JSON export**: Array of log entry objects with full metadata
- **JSONL export**: Line-delimited JSON for streaming tools

### Filtering & Search

- **Category filter**: Filter by DAP category (stdout, stderr, console)
- **Exclusion patterns**: Hide lines matching string or `/regex/` patterns
- **Keyword watch**: Track patterns with live counters, flash alerts, and badges
- **Filter presets**: Save and apply filter combinations; built-in presets included
- **Cross-session search**: Search all log files via Quick Pick

### Visual Features

- **Highlight rules**: Color lines matching patterns (configurable colors, labels)
- **Elapsed time**: Show `+Nms` between lines; slow gaps highlighted
- **JSON rendering**: Embedded JSON shown as collapsible pretty-printed elements
- **Inline decorations**: Show log indicators next to source lines in editor

### Advanced Features

- **Session comparison**: Side-by-side diff view with color highlighting
- **Session templates**: Save/load project-specific configurations (Flutter, Node.js, Python built-in)
- **Auto file split**: Split by line count, size, keywords, duration, or silence
- **Flood protection**: Suppress rapid repeated messages (>100/sec)
- **Deduplication**: Identical rapid lines grouped as `Message (x54)`

### Infrastructure

- Context header with launch.json config, VS Code version, OS, adapter type
- Status bar with live line counter and watch hit counts
- File retention with configurable `maxLogFiles`
- Gitignore safety check on first run
- First-run walkthrough for new users

## [0.0.1]

- Initial scaffold via `yo code`
