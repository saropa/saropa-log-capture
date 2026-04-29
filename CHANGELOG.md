# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**Open VSX Registry** - [open-vsx.org / extension / saropa / saropa-log-capture](https://open-vsx.org/extension/saropa/saropa-log-capture)

**GitHub Source Code** - [github.com / saropa / saropa-log-capture](https://github.com/saropa/saropa-log-capture)

For older versions (5.0.3 and older), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

<!-- MAINTENANCE NOTES -- IMPORTANT --

    The format is based on [Keep a Changelog](https://keepachangelog.com/).

    Each release (and [Unreleased]) opens with one plain-language line for humans—user-facing only, casual wording—then end it with:
    [log](https://github.com/saropa/saropa-log-capture/blob/vX.Y.Z/CHANGELOG.md)
    substituting X.Y.Z.

    **Tagged changelog** — Published versions use git tag **`vx.y.z`**; compare to [current `main`](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md).

    **Published version**: See field "version": "x.y.z" in [package.json](./package.json)

-->

---

## [7.6.0] - unreleased

### Added

- **Contributor / agent tooling** — `engines.node` (≥22) with `.nvmrc` and `.node-version`; Dev Container (`.devcontainer/devcontainer.json`); [doc/AGENTS.md](doc/AGENTS.md); auto-generated [doc/internal/webview-incoming-message-types.md](doc/internal/webview-incoming-message-types.md) via `npm run generate:webview-catalog` with `verify:webview-catalog` on `npm run compile`; `verify:dist-size` guard on `dist/extension.js`; `npm run analyze-bundle` for esbuild metafile analysis; GitHub PR template and bug report issue form.
- **More dev workflow hardening** — `tsconfig.json` **`noEmit: true`** with test builds using `--noEmit false --outDir out`; [doc/internal/webview-outbound-message-types.md](doc/internal/webview-outbound-message-types.md) + `verify:host-outbound-catalog`; [doc/internal/proposed-api.md](doc/internal/proposed-api.md); `npm run doctor`, `test:file`, `verify:release-version`, `verify:release-tag`; Dependabot production patch group; feature-request issue template + issue chooser links; Gitleaks in CI; extension activation smoke test.
- **Workspace setting `saropaLogCapture.logViewerVisualSpacing`** — Persists log viewer visual spacing (same behavior as **V** / Options). Host seeds the webview on load and on config change; toggling in the viewer updates the workspace setting.

### Fixed

- **Log viewer blank lines now render at quarter height.** `calcItemHeight` already used quarter height for scroll math, but `.line` CSS forced every row to full line-box height, so whitespace-only lines looked full-sized and could skew scroll totals. `.line.line-blank` now matches the JS contract (`max(4px, ~¼ of the normal line box)`).
- **Blank-line detection** — NBSP, ZWSP, BOM, common `&nbsp;` / `&#160;` spellings, HTML numeric/hex entities that denote Unicode whitespace (e.g. `&#32;`, `&#x20;`), and similar invisibles are normalized before a line counts as blank, so quarter height and “hide blank lines” match real tool output.
- **Structured format mode (Format on)** — Markdown / JSON / CSV / HTML preview rows now get `line-blank` when empty, so quarter-height CSS applies the same as in plain log mode.

### Changed

- **Log file path in the viewer footer** — Clicking the log filename (or **Ctrl+Shift+E**) opens a **Log file** dialog with **Open in editor**, **Open containing folder**, and **Copy path**, replacing separate click / long-press / double-click gestures on the footer name.
- **Visual spacing defaults off** — The log viewer starts in a denser, IDE-like layout; **V** / Options toggle breathing room between sections. The choice is stored in workspace setting `saropaLogCapture.logViewerVisualSpacing` (default off).
- **Interactive HTML export** — Blank body lines use the same quarter-height `.line.line-blank` styling as the viewer.
- **Simple HTML export** (`Export HTML`) — Body lines are emitted as `#log-content` rows with class `line` / `line-blank` instead of a single `<pre>`, matching quarter-height blanks and the same decoration model as the viewer / interactive export.
- **Scroll map (minimap)** — Quarter-height blank lines no longer paint severity ticks, so the strip reflects substantive lines more closely.

---

## [7.5.7]

Session-group primary row favors the app log whose `Project:` header matches the workspace folder that contains the log directory when several captures share a session group, instead of picking only by timestamp; repeated identical stack headers collapse into an `N × stack repeated` chip; copy on collapsed SQL-repeat rows expands to the full underlying lines. [log](https://github.com/saropa/saropa-log-capture/blob/v7.5.7/CHANGELOG.md)

### Changed

- **Session group primary row** — When several captures share a session group, the tree’s primary row **prefers the log whose header `Project:` matches the workspace folder that contains the log directory** (case-insensitive), resolved via `getWorkspaceFolder(logDir)`. If no member’s header matches, behavior is unchanged (DAP `debugAdapterType` first, then earliest `mtime`). This avoids showing an integration sidecar (e.g. logcat) as the main row when your app log lists the open project but has a later file timestamp.

### Fixed

- **Repeated identical stacks now collapse into an `N × stack repeated` chip.** Stack headers previously bypassed repeat collapse because they returned early in `viewer-data-add.ts`. New stack-header repeat handling hides the anchor/group, emits a repeat notification row, and restores state correctly on cleanup boundaries.
- **Copy on collapsed SQL-repeat rows now expands to the underlying SQL lines.** Copy paths now use captured hidden-anchor text and repeat count so clipboard output includes all repeated lines (not just the header), with selection/toast counts updated accordingly.

---

## [7.5.5]

Toolbar footer level chips show letter codes beside each dot, DB-signal markers honor level filters, prefixless Android `system_server` noise respects Device tier, and drag-select / streaming tail rendering are more reliable. [log](https://github.com/saropa/saropa-log-capture/blob/v7.5.5/CHANGELOG.md)

### Changed

- **Toolbar level filter dots now include letter labels (`E`, `W`, `I`, `P`, `T`, `N`, `D`, `DB`).** This improves readability and accessibility versus color-only dots. Footer chips now show dot+letter+count, disabled levels fade, and click/double-click behavior is unchanged.

### Fixed

- **DB-signal markers now respect level filters.** Orphaned markers (missing SQL anchors in `allLines`) no longer stay visible under filtered views. `isDbSignalLevelDisabled()` now gates marker visibility in recalc and marker creation.
- **Prefixless Android `system_server` lines now hide under Device filters.** Common framework messages now classify as `device-other` (instead of falling back to Flutter tier), while explicit logcat prefixes still win.
- **Plain mouse drag now selects log lines for copy.** Drag selection now uses the indexed selection model with thresholding, robust row hit-testing, and edge autoscroll, so selection survives virtualized re-renders.
- **Drag-select now releases safely on focus-loss and missed mouseup scenarios.** This prevents stuck drag state and runaway autoscroll after out-of-window mouseup events.
- **Viewer no longer flickers near bottom during streaming.** After auto-scroll snap, a second viewport render now runs in the same frame so large batches paint correctly at the tail.

---

## [7.5.4]

### Changed

- **Minimap colors rebalanced for per-pixel paint.** Color alphas in `initMmColors` were tuned for the old overdraw model and became too bright after per-pixel reduction. Alphas were lowered across severity/perf/database/SQL bands, and the SQL-density test now pins hue only so alpha can continue to be tuned.

---

## [7.5.3]

### Changed

- **Minimap now uses deterministic per-pixel severity reduction.** Instead of stamping every source line and relying on blend behavior, the minimap now stores one winning level per pixel row and paints once. This removes saturation artifacts, keeps bar spacing predictable, and preserves higher-severity signals even when info/debug are hidden.

### Fixed

- **`Open Log` in the `Log Captured` notification now opens the Log Viewer, not a hidden editor tab.** The action was routed through `showTextDocument`; it now calls `saropaLogCapture.openSession` (with fallback to `saropaLogCapture.open`).
- **Native scrollbar hide/show now uses clipping layout instead of pseudo-element toggling.** Chromium cached the `::-webkit-scrollbar` layer, so class toggles were unreliable. A `.log-content-clip` wrapper now controls visibility via box layout, with jump-button inset logic updated to read the clip bounds.

---

## [7.5.2]

The minimap now reads as a true density map with faint gray ticks under severity bars, and icon-bar separators are visible across themes. [log](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md)

### Fixed

- **Minimap no longer shows black gaps when info/debug/notice ticks are hidden.** A neutral low-alpha presence layer is now painted first, so density remains visible even when info markers are off.
- **Icon-bar separators are now visible across themes.** Separator color now uses border tokens (not doubly-faded inactive foreground), and `flex: 0 0 1px` prevents collapse in flex layout.

---

## [7.5.1]

Adds live font-size/line-height controls, tighter default row spacing, better minimap color balance, and a reliable native-scrollbar toggle. [log](https://github.com/saropa/saropa-log-capture/blob/v7.5.1/CHANGELOG.md)

### Added

- **Typography now uses two settings:** `saropaLogCapture.logFontSize` (13, 4–42) and `saropaLogCapture.logLineHeight` (1.1, 0.5–4.0). Runtime updates sync to the webview, and reset shortcuts now return to configured values.
- **Ctrl/Cmd+Shift+wheel now adjusts line height in 0.1 steps.** The gesture mirrors font zoom behavior, rounds to one decimal, and avoids triggering font-size handling.

### Changed

- **Default log line height is now 1.1 (from 1.5).** This removes excess row gap while preserving readability; defaults are aligned across JS, CSS fallback, and `package.json`.
- **Minimap ticks now match footer level-chip colors.** `initMmColors` now mirrors canonical `.level-dot-*` hues (including database cyan) with tuned alpha for visual balance.

### Fixed

- **`Show native scrollbar` can now be turned off reliably.** Scrollbar width styling is now host-scoped (`#log-content.show-scrollbar`) and toggled directly on the scroll container.

---

## [7.5.0]

Captured files now keep every line, repeat collapse uses click-to-expand outlined dots, stack traces default to collapsed, ASCII banners render as a tight block, streaming lines honor filters on arrival, and the context menu adds Copy Line Number/Timestamp. [log](https://github.com/saropa/saropa-log-capture/blob/v7.5.0/CHANGELOG.md)

### Added

- **Captured files now write every raw line.** Capture-side dedup was removed from `LogSession.appendLine`, so timestamps and line numbers stay 1:1 with emitted output; repeat folding now happens only in the viewer.
- **Dedup folds are now click-to-expand.** Survivors now carry dedup metadata and use `peekDedupFold()` so users can expand/re-fold a specific fold without toggling global compression.
- **Preview-mode stack trim now marks the last visible frame, not the header.** Hidden-frame state (`.bar-hidden-rows` + tooltip) is now attached where hidden content begins.
- **Removed dead `.hidden-chevron` / `.peek-collapse` CSS and stale viewport skips.** Obsolete selectors and tests were replaced with assertions that these classes no longer exist.
- **Cross-type deduplication now includes stack frames.** `Compress lines` now folds repeated stack-frame rows too, and survivors use outlined-dot state plus tooltip count instead of inline `(×N)` badges.
- **Stack headers no longer use `▶ / ▼ / ▷` or `[+N]` text suffixes.** Collapsed/preview state now uses outlined-dot styling with tooltips; stack-header rendering was split into `viewer-data-helpers-render-stack-header.ts`.
- **Stack-header text is selectable again.** Removed `user-select: none` so users can copy header text while preserving click-to-toggle behavior.
- **Default `stackDefaultState` is now `Collapsed` (was `Expanded`).** This reduces noisy first paint in stack-heavy logs; users can still choose Expanded/Preview in decorations.
- **Retired `▼` hidden-chevron and `−` peek-collapse glyphs.** Hidden runs are now represented by outlined-dot state on the following visible row (`.bar-hidden-rows` + data attributes), and click handling moved to that shared target.
- **Added outlined severity-dot state (`.bar-hidden-rows`) for rows associated with hidden content.** The larger outlined ring replaces several legacy glyph cues and scales with zoom.
- **Added `Copy Line Number` and `Copy Timestamp` to right-click Copy & Export.** Timestamp copy uses ISO-8601 and is hidden when a line has no timestamp.

### Fixed

- **Streaming lines now honor level filters immediately.** New items now get `levelFiltered` at birth via `calcLevelFiltered(lvl)`, so hidden levels no longer flash visible until the next full filter pass.
- **DB burst markers now hide immediately when their anchor line is filtered.** Anchor-visibility checks now run at marker creation time, setting `markerHidden` and zero height for orphaned markers.
- **ASCII-art banners now render as one tight, aligned block.** Art rows use compact line-height/height with matching virtual-scroll math, and start-line indent is fixed so box corners and vertical bars stay aligned.

### Internal

- **Quality-check line counting now matches ESLint.** `scripts/modules/checks_build.py` now counts non-blank, non-comment lines like `max-lines`, removing false warning mismatches.

---

## [7.4.0]

Adds a DB-signal marker toggle and hidden-gap click-to-peek, groups Flutter exception banners into one error block, and fixes duplicate log loading plus level-classification edge cases. [log](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md)

### Added

- **`Show DB signal markers` toggle** in Filters → SQL Commands. Turning it off now hides all DB burst markers immediately, without requiring settings edits or reload.
- **Click hidden-line chevrons to peek one gap.** The `⋮` indicator now reveals only that hidden run, adds a local un-peek marker, and leaves global filter state unchanged.

### Changed

- **DB signal markers now follow line visibility.** If the anchor DB line is filtered out, its marker is hidden too, so visible markers are always actionable.
- **Adjacent identical DB markers now collapse into one `×N` marker.** Consecutive marker-only runs merge for readability and split again when visible lines appear between them.

### Fixed

- **`[console]` now parses correctly on timestamp-prefixed lines.** After ignoring noisy leading timestamp brackets, parsing continues to inline tags so `console`/`log` chips appear as expected.
- **Flutter `Exception caught by` banners now classify as one error block.** The opening/closing banner is detected, all lines in the block are forced to error level, and the group stays visible under error filters.
- **`W/ActivityManager: Slow operation …` now classifies as performance.** Performance pattern matching now runs before the generic `W/` warning fallback.
- **Hidden-lines indicator is now clearly visible.** The tiny `▸` was replaced with a centered `⋮` gap marker in the severity timeline.
- **Hidden-lines glyph no longer appears in copied text.** It is now rendered via CSS pseudo-content, so it never enters clipboard output.
- **Hidden/collapsed DB markers now truly collapse.** `calcItemHeight` now returns `0` when marker flags indicate hidden or collapsed.
- **Primary log is no longer reloaded as an external sidecar.** Sidecar discovery now excludes `<baseName>.log`, preventing duplicate rows and bad prefix/ANSI rendering paths.

## [7.3.0]

Logs panel rows now include Reveal in File Explorer, log context actions are grouped under Export/Copy flyouts, and session logs auto-bundle with Drift Advisor/Logcat sidecars into one expandable entry.

### Added

- **Reveal in File Explorer button on Logs rows.** Hover shows a folder icon that opens the file’s containing folder; row-body click behavior is unchanged.
- **Session Groups: auto-bundle main logs with sidecars.** Files created around a DAP session share a `groupId` and render as one collapsible entry with persisted collapse state and configurable time windows.
- **Session Groups: manual Group/Ungroup actions added.** Users can regroup selected rows or ungroup whole groups from context menu or command palette.
- **Session Groups: Open as Merged Group.** Loads all group files into one merged stream, with cross-basename members tagged as external sources.
- **Session Groups: Add Group to Collection.** Groups can be pinned as one logical source and resolve to current group membership at search/export time.
- **Session retention is now group-aware.** Active groups are preserved, and closed groups are trimmed atomically to avoid partial orphaned sets.

### Changed

- **Scroll map bars now keep a 1px row gap when possible.** Bar height is capped to `pitch − 1`, preserving separation at roomy scales without changing dense-log behavior.
- **Logs context actions now use `Export ▸` and `Copy ▸` flyouts.** Actions and multi-select behavior are unchanged; flyouts auto-flip near the viewport edge.

### Fixed

- **Critical badge no longer overlaps text or duplicates the severity dot.** It now renders as a gutter fire icon with existing hover/click behavior preserved.
- **Analyze now finds tokens in identifier-heavy lines.** When classic token patterns miss, fallback extraction now captures useful PascalCase/camelCase identifiers with noise guards.
- **File Scope radios no longer gray out when the viewer has focus.** Scope context now ignores `undefined` editor-change events from non-text surfaces and preserves the last valid source-file context.
- **`Show native scrollbar` now toggles off reliably.** The toggle now forces a safe display/reflow cycle on `#log-content` so Chromium rebuilds scrollbar styling.
- **Log Sources radios now affect Flutter DAP output correctly.** Unclassified debug-source lines now default to `tier='flutter'`, so All/Warn+/None works as intended.
- **Ungroup/Open-as-merged now resolves sibling files correctly.** URI reconstruction now uses `keyToLogUri(...)`, so fan-out actions target all group members reliably.
- **ASCII box-drawing detection failed on Drift Debug Server v3.3.3 banners and other non-light-corner variants.** The `isAsciiBoxDrawingDecorLine` helper (and its webview mirror) only paired `│` (U+2502) and `║` (U+2551) as bar chars, so the rounded top/bottom rules (`╭──╮`, `╰──╯`) and T-connector divider (`├──┤`) introduced by Drift v3.3.3 fell through to the 0.6 art-char ratio fallback. That fallback had a hand-picked char list that happened to include the corners but missed heavy variants (`┏━┓`, `┃`, `┣━┫`, `┗━┛`), mixed light/heavy (`┍━┑`, `┕━┙`), mixed light/double (`╒══╕`, `╞══╡`, `╘══╛`), and dashed bars (`╎`, `╏`). The URL stripper `stripAsciiBoxNoise` (both TS and webview copies) had the same subset gap and couldn't extract the viewer URL from a rounded-corner frame. All three locations now use ranges: the bar-pair regex accepts any of `│┃║╎╏╽╿`; a new pure-box-rule branch matches lines whose non-whitespace characters are entirely in U+2500–U+257F (covering every corner, T-connector, half-line, and diagonal in the Unicode box-drawing block); the ratio fallback accepts the full U+2500–U+257F plus block-elements U+2580–U+259F (for shaded art like `░▒▓█`); and `stripAsciiBoxNoise` strips the full U+2500–U+257F range. ASCII `|` is intentionally excluded from the bar-pair set so markdown tables still read as plain text. `+---+ | text |` ASCII banners still classify via the ratio fallback. Added 33 new unit tests covering rounded/heavy/mixed variants, indented banners, boxen-style title-in-rule, and regression guards against markdown-table and single-box-char false-positives.

[log](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md)

---

## [7.2.2]

Reorganizes the icon bar into clearer groups, renames the Find icon to Find in Files, and stops count badges from doubling up next to button labels. [log](https://github.com/saropa/saropa-log-capture/blob/v7.2.2/CHANGELOG.md)

### Changed

- **Icon bar reorganized into clearer groups.** Core log tools sit above the first separator; support/management tools below; settings/info separated at the bottom.
- **Renamed "Find" icon to "Find in Files"** and changed its glyph from `list-filter` to `search` (magnifying glass) to match the panel title and better convey its purpose.

### Fixed

- **Duplicate icon-bar counts fixed in labels-visible mode.** Overlay badges are now suppressed when labels are visible, so only inline `(N)` appears.

---

## [7.2.1]

Fixes the duplicate end-of-capture notifications that could appear after a single debug run, and renames that notification from "Session Complete" to "Log Captured". [log](https://github.com/saropa/saropa-log-capture/blob/v7.2.1/CHANGELOG.md)

### Fixed

- **Duplicate `Log Captured` notifications fixed for concurrent session starts.** Start flow now uses a per-workspace async lock (`withStartLock`) so only one session owner initializes the log file.

### Changed

- **End notification title renamed to `Log Captured: <filename>`.** This aligns with user-facing terminology guidance; internal code identifiers are unchanged.

---

## [7.2.0]

Adds a dedicated Collections panel, structured viewers for markdown/JSON/CSV/HTML, a floating search overlay, capture on/off status-bar toggle, full F1 shortcuts reference, and richer signal reports (stack traces, fingerprints, cross-session history). [log](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md)

### Added

- **Structured file modes added for non-log documents (`.md`, `.json/.jsonl`, `.csv`, `.html`).** These files now bypass log analysis and use format-aware rendering with a toolbar Format toggle.
- **Collapse All now toggles to Expand All.** The title-bar button flips icon/state using `saropaLogCapture.allCollapsed`.
- **Maximize Panel button.** A `$(screen-full)` button in the view title bar toggles VS Code's maximized-panel mode for the log viewer.
- **Floating search overlay added in the title bar.** It includes case/word/regex toggles, match navigation, and inline clear behavior.
- **Toolbar decoration toggle added.** One click disables/restores all decorations, preserving prior state (defaulting to elapsed time when no prior state exists).
- **Capture on/off status-bar toggle added.** A persistent icon flips `saropaLogCapture.enabled` for the workspace and warns when capture is off.
- **Icon-bar buttons now show item counts.** Labels-visible mode shows inline counts; icon-only mode uses badges; values cap at `99+`.
- **Collections now have a dedicated slide-out panel.** It includes onboarding copy, inline rename, and merge support.
- **Auto-generated collection names.** When creating a collection via "Add to Collection", the filename is converted to a human-readable name (e.g. `flutter_debug_2024-01-15.log` → `Flutter Debug 2024-01-15`) and pre-filled in the name input.
- **23 new keyboard shortcuts added.** Total rebindable shortcuts increase from 22 to 45 across panels, display controls, navigation, zoom/line-height, bookmarking, and file actions.
- **Standalone keyboard shortcuts reference (F1) added.** Opens a full-page searchable shortcut table grouped by category with live match counts.

### Fixed

- **Hide blank lines now keeps a tiny gap instead of fully removing rows.** This preserves paragraph breaks while reducing wasted space.
- **File views no longer auto-collapse into continuation groups.** Continuation grouping is skipped for loaded files with shared load timestamps.
- **Stack group toggle is now two-state (collapsed/expanded).** Removed the extra preview cycle for faster interaction.
- **Session-list metadata now loads progressively.** Workers now await per-item build/send, producing smooth top-to-bottom detail hydration.
- **Decoration-toggle load crash fixed.** Script load order now defines decoration settings before `areDecorationsOn()` reads them.
- **False-positive error signals on config properties.** `isErrorLine()` and `isWarningLine()` used naive substring matching, so identifiers like `__breakOnConditionalError` or `showWarningDialog` triggered false error/warning signals. Now uses word-boundary regex plus explicit PascalCase compound-type patterns (TypeError, NullPointerException, DeprecationWarning) so real errors still match but embedded substrings in camelCase identifiers do not.
- **Signal report: 12 debugging improvements.** The signal report now includes substantially more diagnostic context for error debugging:
  - **Stack trace extraction.** Evidence sections use an asymmetric context window (10 lines before, 10 after + up to 30 extra lines extending through stack trace frames). The markdown export now matches the HTML panel. Previously the markdown used a symmetric ±5 window that cut off stack traces.
  - **Error classification shown.** Each error's crash category (fatal, anr, oom, native, non-fatal) is now displayed as a badge in the related-lines section and all-errors listing, so the developer can immediately gauge severity.
  - **All errors in session listed.** The Session Overview section now lists every error in the session (up to 10) with line numbers, excerpts, and category badges — not just a count.
  - **Confidence explanation.** The report header shows a human-readable reason for the confidence level (e.g. "fatal crash, 3 occurrences") instead of just "medium."
  - **Session duration and timeline position.** The overview shows session duration (parsed from header/footer timestamps) and each evidence block shows where the error sits in the session (e.g. "Line 25 of 59 (42%, mid-session)").
  - **Fingerprint transparency.** Each error group in the related-lines section shows the normalized fingerprint key — the text after timestamps, UUIDs, paths, and numbers are stripped — so the developer can see what the grouping algorithm matched on.
  - **What changed since last clean session.** The cross-session history section compares the current session header (extension version, VS Code version, debug adapter, git branch/commit, OS) against the most recent session that did NOT have this signal, and highlights what differs.
  - **Framework vs app classification.** Error lines are classified as "framework," "app," or "config-dump" based on their content and position in the log. Config-dump lines (inside the session header) are explicitly flagged so the developer knows they're not real errors.
  - **Session outcome.** The overview shows whether the session ended cleanly (footer present) or was interrupted (no footer — possible crash or force-quit).
  - **Preceding action context.** Each evidence block shows the most recent user-initiated action (hot reload, build step, file sync, etc.) found by scanning backwards up to 50 lines from the error.
  - **Contextual recommendations.** The Recommendations section now branches on the error's crash category instead of showing generic advice. For example, "fatal" errors get "check the stack trace for the throw site and add a top-level error handler," while "oom" errors get "profile heap usage, check for retained references."
  - **Related lines grouped by fingerprint.** Errors in the Related Lines section are grouped by fingerprint hash instead of listed individually. Each group shows the occurrence count, category badge, origin classification, and normalized fingerprint key.
- **Icon bar not scrollable.** When the viewport is short, bottom icon bar items (Signals, About) were clipped and unreachable. The icon bar now scrolls vertically when buttons exceed the available height.
- **Icon bar separator barely visible.** The horizontal divider between the upper and lower icon groups used the panel border color, which is invisible in many themes. Now uses the inactive foreground color at reduced opacity so it is visible across light and dark themes.
- **Minimap viewport red outline not visible.** The red outline on the minimap viewport slider was invisible because the canvas compositing layer obscured the `box-shadow`. Fixed by adding `z-index: 1` to the viewport element and switching from `inset box-shadow` to a real `border` for reliable rendering.
- **Continuation collapse button moved left of `»` chevron.** The `+N` / `−N` expand/collapse button was positioned to the right of the `»` chevron, overlapping with the timestamp. It is now injected into the decoration prefix before the `»` so it sits near the line numbers and cannot overlap other elements. The standalone contBadge token in the render string was also moved to sit after `deco` (not before), so the art-continuation fallback path — where `deco` is empty and the splice is skipped — matches the invariant that the badge never precedes the decoration prefix.
- **Compress lines dedup missed structured-prefix lines.** The dedup key compared the full HTML text including structured prefixes (timestamps, PIDs, logcat tags). Lines with identical message bodies but different timestamps produced different keys and were not compressed. Now strips the structured prefix (and source-tag brackets) before comparing, matching what the user sees on screen. Also added `metadataFiltered` to the eligibility check so metadata-filtered lines are excluded from dedup grouping (mirrors `calcItemHeight`).
- **Compress lines toggles were not reversible.** The streaming repeat tracker permanently swallowed non-SQL consecutive duplicates (never stored them in `allLines`), so unchecking "Compress lines" could not expand them back. Non-SQL duplicates are now always stored individually in `allLines`, and the compress dedup algorithm (`applyCompressDedupModes`) handles grouping when compress mode is toggled on. Unchecking compress now expands all lines. SQL fingerprint repeats retain their existing drilldown notification row behavior.
- **Icon bar Bookmarks label test matched wrong structure.** The `getIconBarHtml` test asserted `>Bookmarks</span>` but the label wraps a nested count span (`<span class="ib-label">Bookmarks<span id="ib-bookmarks-count">...</span></span>`) to display the bookmark count next to the label. Loosened the assertion to `>Bookmarks<`, matching the existing loose pattern already used for the Logs label (which has the same nested count structure).

### Changed

- **Collections explainer condensed.** The banner is now shorter, dismissible, and the standalone "New Collection" button was removed in favor of context-menu creation.
- **Terminology dictionary added.** `docs/guides/TERMINOLOGY.md` maps user terms to internal names and lists banned terms.
- **Terminology standardized across UI.** `Project Logs` → `Logs`, `Code Origins` → `Source Classes`, and `filter preset` → `Quick Filter`.
- **Source Classes tab shows selected count.** The tab header and body summary now display the number of selected (visible) tags instead of the total count. Shows nothing when no tags are selected (never shows zero).
- **Log Sources layout improved.** Tier radios now sit below source titles with clearer spacing and padding.
- **Font zoom range widened from 8–22px to 4–42px.** Applies to keyboard shortcuts, Ctrl+wheel, and the Options slider.
- **`Investigation` renamed to `Collection` everywhere.** Commands, UI, types, and filenames were updated; `.saropa/collections.json` format is unchanged.
- **Collections removed from Signal panel.** The "Your cases" section and "Create Investigation" button no longer appear inside the Signals slide-out. Collections are now managed in their own dedicated panel.
- **Repeated non-SQL lines now show inline `(×N)` badges.** This removes separate repeat rows while preserving SQL fingerprint drilldown behavior.
- **Log Sources panel layout improved.** Source type descriptions (stdout, stderr, console / Logcat, Android system logs / etc.) now appear inline after the tier name with a dash separator instead of on a separate line. Device and External tiers have visual spacing separators.
- **Filters panel redesigned as a full-height slide-out with vertical tabs.** It replaces the old accordion + Tags/Origins split layout and removes the Tags icon-bar button.
- **Date group headings show file count.** Collapsible day sections in the Project Logs panel now display the number of files in each group, right-aligned as a subtle badge.
- **Presets moved from filter drawer to kebab menu.** Saved filters now appear in a `Presets` flyout with per-preset tooltips.
- **Kebab dropdown aligned to button.** The actions dropdown now opens directly below the three-dot icon instead of anchoring to the far right of the page.
- **Session summary button order swapped.** "Copy Log Path" now appears before "Open Log" in the post-session notification dialog.

---

## [7.1.1]

Stops false-positive HTTP signals from Android PID numbers, restricts extension-side signal scanning to error-level logcat lines, scales continuation and category badges with zoom, and consolidates duplicate ANR reports. [log](https://github.com/saropa/saropa-log-capture/blob/v7.1.1/CHANGELOG.md)

### Fixed

- **Network failure signals no longer false-positive on Android PIDs.** The HTTP status code detector (e.g. 502) now requires an HTTP context keyword (HTTP, status, response, GET, POST, etc.) on the same line. Previously, bare numbers in logcat CPU dumps (e.g. PID 502 in `3% 502/android.hardware.sensors`) matched as HTTP 502 "Bad Gateway".
- **Extension-side signal scanner now filters by logcat level.** Network, memory, permission, and error pattern matching is restricted to error-class logcat lines (E/F/A). Info-level system noise like ActivityManager process starts no longer contributes to signal counts. Slow-op detection still runs at any level.
- **Continuation badge no longer overlaps timestamp text.** The `[+]` badge used fixed `font-size: 10px` which didn't scale with zoom and could overlap the decoration prefix. Now uses `0.75em` so it scales with the viewer's font size.
- **Continuation badge now shows count inline.** Changed from `[+]` (count hidden in tooltip) to `+7` / `−7` so the user sees how many lines are collapsed without hovering.
- **Category badge (`category-badge`) now scales with zoom.** Changed from fixed `9px` / `4px` to em-based units (`0.7em` / `0.3em`).
- **Signal reports no longer triplicate for a single ANR event.** When a high-confidence ANR hypothesis exists, redundant `error-recent` hypotheses (typically ANR dump lines like CPU stats and IO pressure) are merged into the ANR report. The user sees one consolidated report with evidence links to all the dump lines.

---

## [7.1.0]

Simplifies the filter drawer to three core sections, adds a dedicated Tags & Origins slide-out panel for chip-heavy browsing, and renames log input categories for clarity. [log](https://github.com/saropa/saropa-log-capture/blob/v7.1.0/CHANGELOG.md)

### Fixed

- **CI coverage thresholds adjusted after v7.0.0 code growth.** Functions threshold lowered from 48% to 43%, branches from 40% to 37%, statements held at 48%. New tests for anomaly detection (10 functions) and crash category classification bring coverage back above the new thresholds.

### Changed

- **Filter drawer simplified.** Removed Message Tags, Code Origins, and SQL Commands accordion sections from the narrow filter dropdown. Only filtering controls remain: Log Sources (tier radios), Text Exclusions, and File Scope.
- **Tags & Origins slide-out panel.** New icon bar button (Tags) opens a dedicated side panel for chip-heavy browsing sections: Message Tags, Code Origins, SQL Commands, and Individual Sources placeholder. These sections get room to breathe instead of being crammed into tiny accordions.
- **"Log Inputs" renamed to "Log Sources".** The accordion section name now describes what it controls more clearly.
- **"Flutter App" renamed to "Flutter DAP".** The tier radio label now includes a tooltip explaining what the Debug Adapter Protocol is. Hint text added below: "stdout, stderr, console".
- **"Exclusions" renamed to "Text Exclusions".** Clarifies that these patterns filter by text content, not by source or category.
- **"Preset: None" replaced by "Saved Filters: Default".** Footer label and default option renamed. The redundant "Reset all" button was removed — selecting "Default" resets everything.
- **Modularized 7 oversized files to meet the 300 LOC limit.** Extracted severity keywords CSS, logcat classifier tests, session panel test helpers, session metadata I/O, session manager listeners, signal accumulators, and viewer-specific activation handlers into dedicated modules. No behavior changes.

---

## [7.0.0]

Overhauls the filter panel into focused sections with a dedicated Tags & Origins side panel, adds drag-to-resize scroll map, and replaces the old Insights panel with a unified Signals system — cross-session trends, co-occurrence detection, severity classification, recurring signal notifications, full markdown reports with evidence context and stack traces, and Drift Advisor integration for SQL signals. [log](https://github.com/saropa/saropa-log-capture/blob/v7.0.0/CHANGELOG.md)

### Changed

- **Project Logs now shows file names immediately during scan.** Sidecar migration and metadata loading no longer block first-name visibility.
- **Exclusion checkbox moved inline with textbox.** The toggle now sits in the input row to save vertical space.
- **Filter panel redesigned into focused sections.** Core controls stay in the drawer; chip-heavy controls moved to the dedicated Tags & Origins side panel.
- **Log Sources now uses three tier radios with clearer labels and defaults:** Flutter DAP (All), Device (Warn+), and External (Warn+).
- **External tier now includes all non-Flutter, non-device sources.** Previously un-tiered AI/drift-perf lines now filter correctly under External.
- **Exclusions renamed to "Text Exclusions"** to clarify that these patterns filter by text content, not by source or category.
- **Saved Filters replaces the Preset dropdown.** Footer label is now `Saved Filters: Default`, and selecting `Default` resets all filters.
- **Signal report `Related Lines` now lists concrete items.** It shows line numbers and text (up to 20 rows) instead of count-only summaries.
- **Signal report evidence context expanded to 10 lines** (from 5).
- **Signal report evidence now includes contiguous stack traces.** Context extends past normal radius to capture nearby Dart/Flutter and Java/Kotlin frames.
- **Signal report now reads the log file once per panel.** Sections share one read to reduce I/O.
- **Double-click now solos filter chips.** Double-click a Message Tag or Code Origin to isolate it; double-click again to restore prior state.
- **Signal trends: lint rule link.** Signals with saropa_lints context now show a `📋 Rule` button that opens VS Code settings for that rule.
- **Signal trends: Drift Advisor link for SQL signals.** SQL signals now show a `🔍 DA` button for one-click panel open.
- **SQL signals now include Drift Advisor table metadata.** When available, schema/table/index context is shown directly in the Signals panel.
- **`RecurringError` was removed in favor of unified `RecurringSignalEntry`.** All host/webview/analysis/export/test paths now use one recurring-signal type.
- **Internal `dbInsight` identifiers were renamed to `dbSignal`.** This is an internal consistency cleanup with no user-facing behavior change.
- **Remaining `insight` naming was removed in favor of `signal`.** Function names, command IDs, comments, and docs are now consistent.
- **Signal trend analysis added.** Recurring signals now show increasing/stable/decreasing direction with colored trend arrows.
- **`PersistedSignalSummaryV2` now stores real entries, not just counts.** Cross-session aggregation uses richer V2 details with V1 fallback support.
- **Recurring signal notification.** Finalization now shows a VS Code info notice when a signal appears in 5+ sessions, with an `Open Signals` action.
- **Cross-signal co-occurrence detection added.** Signal pairs with high Jaccard overlap are persisted in `CrossSessionSignals.coOccurrences`.
- **Unified signals now track versions.** Error/warning signals include `firstSeenVersion` and `lastSeenVersion` from session `appVersion`.
- **Signals panel consolidated into unified lists.** `This log` and `Across your logs` now avoid duplicate sections and include inline triage controls.
- **Extension-side scanner now writes V2 signal entries even when viewer is unopened.** Sessions persist deduped per-pattern entries (not count-only summaries).
- **Related Signals section added.** Co-occurring signal pairs now render under `Across your logs` with overlap and shared-session counts.
- **Signal jump-to-line added.** Signals with line indices now jump to their first occurrence in the current log.

### Added

- **Drag-to-resize scroll map added.** Minimap width is now draggable (20–160px), persisted per workspace, and reset by preset changes.
- **`Works best with` section added to README.** It lists companion Saropa extensions and links to the Saropa Suite pack.
- **Companion extensions in Integrations panel.** Options → Integrations now shows install links for Saropa Lints, Drift Advisor, Claude Guard, and the Saropa Suite pack.
- **Signal report now includes a `Companion Extensions` section.** It shows Drift Advisor/Lints context when available and install prompts when missing.
- **Signal report `Session Overview` section added.** It surfaces top-level session stats (errors, warnings, SQL bursts/N+1, ANR risk, Drift issues).
- **Signal report `Signal Details` section added.** It includes type-specific details plus occurrence distribution (first/last/span/cluster pattern).
- **Signal report: Other Signals section.** Shows other hypotheses from the same session with confidence badges.
- **Signal report markdown export is now full-fidelity.** Copy/Save includes all report sections instead of header + evidence only.
- **Signal summaries now persist to session metadata on finalize.** Root-cause bundles are compacted and saved for cross-session analysis.
- **Signal trends in Insights panel.** `Across your logs` now aggregates persisted summaries and opens the latest matching session on click.
- **Signal report `Cross-Session History` section added.** It lists past sessions with the same signal and supports click-to-open navigation.
- **Trend badges on signals.** Hypotheses now show `↻N` when the same signal appears in 2+ past sessions.
- **Warning fingerprinting added.** Warnings are now normalized, hashed, and persisted at finalization for cross-session tracking.
- **Unified `All Signals` view added.** `Across your logs` now merges recurring errors/trends into one impact-sorted list across error/warning/perf/SQL and summary signal types.
- **`Insights` was renamed to `Signals` across the UI and commands.** User-facing terminology is now consistent.
- **Automated signal severity classification added.** Recurring signals are labeled critical/high/medium/low and sorted with visual priority indicators.
- **`All signals in this log` section added.** It shows unified current-session errors/warnings/perf/SQL summaries from session metadata.
- **Unified signals now ingest Drift Advisor data when available.** Slow queries and diagnostic issues appear alongside log-derived signals.
- **Standalone insights panel retired.** Legacy `src/ui/insights/` webview panel is removed; functionality lives in the built-in Signals panel/tab.
- **Extension-side general signal scanning added at finalize.** Non-webview sessions now still get network/memory/slow-op/permission/classified signal data.
- **Signals now include lint diagnostic enrichment.** File-referenced signals pull VS Code diagnostics (with bounded background analysis) including rule/source/severity details.

### Fixed

- **Warning detection now recognizes logcat `W/` prefixes.**
- **Error detection now recognizes logcat `E/`, `F/`, and `A/` prefixes.**
- **`Show native scrollbar` toggle now applies immediately.** Toggle state updates optimistically and forces a safe reflow so cached Chromium scrollbar styling refreshes.
- **Jump buttons now clear the native scrollbar.** Inset now reads `--scrollbar-w` directly instead of unreliable geometry.
- **Context-menu checkmarks no longer mimic submenu arrows.** Check icons now render inline by label (VS Code convention) instead of right-edge arrow position.
- **`DriftDebugInterceptor` SQL lines are now recognized.** SQL tagging/fingerprinting/history/N+1 paths now support both Drift log formats across extension and webview parsers.
- **Dot-separated project names now display correctly.** Dots are now treated as word separators in both tree and webview session panels.
- **Bracket-prefixed metadata is now fully stripped.** Parser logic now skips multiple leading bracket groups so actual log format/message content is parsed and displayed correctly.
- **Continuation badge no longer overlaps log text.** It is now an inline compact pill by the line counter.
- **Signal reports now open in separate tabs.** Reports no longer replace each other, making side-by-side comparison possible.
- **Signals panel text now wraps correctly.** Flex layout keeps icon/actions pinned while long descriptions wrap inside available width.
- **Device-other lines are no longer re-promoted by recent-error context.** Framework noise stays demoted to info as intended.
- **Recent-error-context border no longer shifts content.** The visual indicator now uses inset `box-shadow` instead of padding changes.

<details>
<summary>Maintenance</summary>

- **adb logcat Phase 2: streaming provider pattern.** Logcat spawning now uses `IntegrationProvider` hooks (`onSessionStartStreaming`, `onProcessId`) instead of hardcoded session-init logic.
- **`ROADMAP.md` now redirects to `plans/`.** It points to `plans/` for upcoming work and `plans/history/` for completed work.
- **README restructured for faster grokking.** Installation & Quick Start moved to the top of the page, a hyperlinked Table of Contents added, the Integration adapters wall-of-text broken into scannable sub-bullets, and the Configuration table split into six categorized tables (Capture, Viewer & Display, Filter & Search, Alert & Diagnostics, File Splitting Rules, Advanced).
- **README hero section rewritten to explain the feature set.** The intro and overview now lead with the value proposition (zero-config capture, diagnostic workstation, error intelligence, SQL diagnostics) instead of reading like technical documentation. Added coverage for signals, structured log parsing, ASCII art detection, and Drift SQL diagnostics. Fixed stale documentation links to use `plans/`.
</details>

---

For older versions (6.2.1 and older), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).
