# Changelog

All notable changes to Saropa Log Capture will be documented in this file.

**VS Code Marketplace** - [marketplace.visualstudio.com / saropa.saropa-log-capture](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture)

**Open VSX Registry** - [open-vsx.org / extension / saropa / saropa-log-capture](https://open-vsx.org/extension/saropa/saropa-log-capture)

**GitHub Source Code** - [github.com / saropa / saropa-log-capture](https://github.com/saropa/saropa-log-capture)

For older versions (7.1.1 and prior), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).

<!-- MAINTENANCE NOTES -- IMPORTANT --

    The format is based on [Keep a Changelog](https://keepachangelog.com/).

    Each release (and [Unreleased]) opens with one plain-language line for humans—user-facing only, casual wording—then end it with:
    [log](https://github.com/saropa/saropa-log-capture/blob/vX.Y.Z/CHANGELOG.md)
    substituting X.Y.Z.

    **Tagged changelog** — Published versions use git tag **`vx.y.z`**; compare to [current `main`](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md).

    **Published version**: See field "version": "x.y.z" in [package.json](./package.json)

-->

---

## [7.12.0] - Unreleased

Right-click → **Columns** is now its own submenu where you can flip the per-line column chips on and off (including a new toggle for the source-tag chip like `flutter` or `HWUI`), the activity-bar badge stops piling up while the Logs view is already open, clicking a row in the Signals sidebar actually opens the right session and scrolls to the line, collapsed stack gaps now caption themselves so a hidden run of frames doesn't look like a mystery 8 px gap, and the scrollbar minimap finally shows the same colors as the gutter next to it. [log](https://github.com/saropa/saropa-log-capture/blob/v7.12.0/CHANGELOG.md)

### Added
- **Columns submenu in the right-click menu** — a new top-level **Columns** submenu (above **Layout**) gathers the per-line column toggles in fixed order: Line numbers, Timestamp, Session elapsed, and a new **Tag** toggle for the parsed source-tag chip (e.g. `flutter`, `HWUI`). Layout now keeps only whole-row treatment toggles (wrap, spacing, line height, compression). The Tag toggle is independent of the structured-prefix-strip option — turning the chip off does not put the bracket prefix back into the message text.
- **SQL Query History — `Cumulative across logs` toggle (DB_17 Step 1)** — the panel previously emptied itself whenever the active log lacked Drift output, even though the workspace had captured many SQL fingerprints across other logs. A new toolbar checkbox layers in fingerprints aggregated from every other sidebar log's persisted `driftSqlFingerprintSummary` (the data is already on disk from `DB_10`), so you can see whether a fingerprint was ever observed without hunting through logs one by one. The active log is excluded from the baseline so its live rollup is never double-counted; the toggle hides itself on empty workspaces and persists per-webview via `vscodeApi.setState`. Cross-log rows route their jump button through a new `sqlHistoryCrossLogJump` host message that loads the source log first and then scrolls. **Limitation:** Step 1 cumulative-only rows show the bare fingerprint string instead of readable SQL text — Step 2 will bump the persisted schema to v2 with a sample preview so cross-log rows look as readable as live rows.

### Changed
- **Stack-header expander chevrons dimmed at rest** — the inline `▶` / `▼` chevron on collapsible stack headers used the full `--vscode-descriptionForeground` color, which made it compete with the header text. The chevron now sits at `opacity: 0.5` so it reads as a quiet hint while idle, and returns to full opacity on hover so the affordance is still discoverable.
- **Filter-hidden-gap divider relabeled to a one-word `hidden` chip in the tag column** — the divider that announces a filter-hidden run between two visible rows was a centred pill reading `─── N hidden lines · show ───`. With many gaps in a dense log, the centred pills competed with each other for visual weight and the dashes drew the eye more than the surrounding real log lines. The visible label is now just `hidden`, left-aligned to land in the same x-column as the structured-prefix tag chip on real rows (`--deco-prefix-width-em - 8em`, where `8em` is the 7em tag reservation plus the 1em trailing gap from `applyDecorationLayoutWidth`). The count and per-reason breakdown (`N level-filtered, M excluded, …`) move to the title tooltip, and the resting opacity stays at `0.55` so the chip whispers in the column without disappearing. Hover still lifts to the badge fill so the click target is obvious. Peek-collapse and preview-frames dividers are unchanged — they remain centred because their label IS the divider line.

### Fixed
- **Async-suspension marker is now inline on the prior frame, click-to-expand, copy-safe** — the `⛓️‍💥` glyph that replaces Dart's `<asynchronous suspension>` rendered as its OWN row between every async frame, so an expanded Drift trace was still padded with N empty-looking rows whose only payload was the chain emoji. The glyph now folds onto the preceding frame's row instead — no standalone rows, the trace reads as a compact column of real frames with a small `⛓️` after each one. Clicking the glyph toggles a `.expanded` class that swaps the icon for the readable `<asynchronous suspension>` text inline, so the original phrase is one click away when it actually matters. The bare `)` that closes a `_StringStackTrace (#0 … )` envelope is dropped entirely — pure formatting noise with no payload to expand to, so it gets no row and no icon. Ctrl+C now produces the original `<asynchronous suspension>` text instead of the emoji: the icon comes from a CSS `::before` pseudo-element (which never enters clipboard text), and the verbatim phrase lives in a `.async-gap-text` span styled with the sr-only pattern (`position: absolute; clip: rect(0 0 0 0)`) so `getSelection().toString()` and `stripTags()` both still capture it. The prior frame's `rawText` is also extended with ` <asynchronous suspension>` so Alt+Shift+C (copyAsRawText) and the search index keep hitting the phrase verbatim.
- **Severity gutter connector redesigned — chain bugs structurally eliminated** — the line joining consecutive same-level dots was a JS chain machine: `renderViewport` walked siblings via `findNextDotSibling`, stamped `bar-up`/`bar-down`/`bar-bridge` and a second `level-bar-*` class onto neighbor rows, then CSS painted the stripe from those derived classes. With three layers (dot, stripe, bridge) all reading their own copy of the row's level, they could drift — and they did, producing the "blue line through green dots" symptom where the dot's `--bar-color` cascaded one way and the stripe's another. The whole chain machinery is removed; the connector is now declarative CSS using ten per-level `:has(+ .level-bar-X)::after` rules in `viewer-styles-decoration-bars.ts`. Each row paints its own stripe ONLY when its immediate next sibling shares the level — the browser does the sibling check natively. Same-level runs read as one continuous band; level transitions show as different colors meeting at the row boundary; lone rows show just the dot. The dot (`::before`) and the line (`::after`) read `--bar-color` from the same element via the same `level-bar-*` class, so they cannot disagree. ASCII-art rows excluded from the chain rule so their shimmer `::after` animation is preserved.
- **Activity-bar badge no longer accumulates while the Logs view is open** — the `(94)` count shown next to the **Saropa Log Capture** tab title is the native VS Code view badge for unread keyword-watcher hits. `updateWatchCounts()` was raising `unreadWatchHits` (and the badge) on every hit regardless of whether the view was visible, and `onDidChangeVisibility` only fires on visibility transitions — so hits landing while the panel was already open silently bumped the badge and it kept growing in front of the user. The host now checks `view.visible` before setting the badge: when any view is visible, `unreadWatchHits` is held at zero and the badge stays cleared; when the panel is hidden, the badge tracks the running total as before.
- **Signal panel no longer renders over the Logs/Sessions list with both visible at once** — `#panel-slot` stacks every slide-out panel in a single CSS-grid cell ([viewer-styles.ts:122-136](src/ui/viewer-styles/viewer-styles.ts#L122-L136)); the "only one visible at a time" invariant depended on `.visible` being mutually exclusive, which `setActivePanel()` enforces by calling `closeAllPanels()` first. Any code path that bypassed it — the host's `openSignalPanel` postMessage (used by "Open Full Signals" in the recurring panel, the Performance chip in the toolbar, and similar entry points) routed straight to `openSignalPanel()` which simply added `.visible` — could leave the previous panel (commonly Sessions/Logs) still `.visible`, so its content bled through the Signals panel as overlapping text. Added a `window.hideOtherPanelsInSlot(except)` helper in the icon-bar that strips `.visible` from every sibling panel; `openSignalPanel` and `openSessionPanel` now call it before adding their own `.visible` so the mutex holds regardless of caller.
- **Clicking a row in the Signals sidebar now opens the right session and scrolls to the line** — the cross-session signal trend rows posted only `signalType` (the kind: `error` / `warning` / `perf` / …), and the host resolver tried to find a session by looking up that kind in `signalSummary.counts` — but `SignalKind` values (`error`) never equal `SignalSummaryCounts` keys (`errors`), so the lookup never matched and clicks looked dead. Rows now also carry `data-fingerprint` and `data-detail` (raw example text), the click handler posts the fingerprint, and the host prefers a fingerprint match against `meta.fingerprints` / `warningFingerprints` / `perfFingerprints` / `driftSqlFingerprintSummary` / `signalSummary.entries` (V2). Fallback when no fingerprint match is found uses the typed lists, not the broken counts-key path. After the session loads (or immediately if it's already the active log), the host posts a new `scrollToSignal` message; the webview searches `allLines` for the raw example text — or for the longest non-placeholder segment of the normalized label — and scrolls + pulses that line.
- **Collapse-divider captions on by default, rendered as muted text** — when preview-mode stack collapse hid framework frames between two visible rows, the `.viewer-divider` row that announces the gap stayed in the DOM but its caption pill was suppressed (the accessibility setting `saropaLogCapture.accessibility.showCollapseDividerLabels` defaulted to off). The row's CSS still claimed `max(8px, 0.7em)` of height, so users saw an unexplained 8 px gap between e.g. line 177 and line 181 with no clue that frames 178-180 had been folded. Flipped the default to **on** so every collapsed gap reads as `─── N hidden lines · show ───`, and dimmed `.viewer-divider-label` to opacity `0.55` with a transparent background so the caption whispers instead of competing with real log lines. Hover lifts both the opacity to `1` and restores the badge fill so the click target is still obvious. The opt-out remains for users who prefer rows fully invisible at rest.
- **Scrollbar minimap palette synced with the per-row gutter** — the "rotate Info=blue / Notice=cyan / DB=green" palette change in commit `492d346f` updated `viewer-styles-decoration-bars.ts` but missed the canvas palette in `viewer-scrollbar-minimap-paint.ts`. The same source line painted a blue dot in the row gutter and a green tick on the scroll map (or any of the rotated pairs), so the minimap was unreliable as an overview of the gutter it sits next to. Synced the three rotated slots — info now `#2196f3` charts-blue, notice now `#00bcd4` terminal-cyan, database now `#4caf50` charts-green. Error / warning / performance / todo / debug were untouched by the rotation.

---

## [7.11.2]

Expanded Dart stack frames line up with their header instead of drifting a column to the right, the noisy `<asynchronous suspension>` markers shrink to a tiny broken-chain glyph (with the original phrase still searchable), the severity gutter shows a clear break where adjacent rows have different colors, and gutter line numbers now match the raw file line — not the in-memory position that drifted with every folded stack. [log](https://github.com/saropa/saropa-log-capture/blob/v7.11.2/CHANGELOG.md)

### Fixed
- **Expanded stack frames now line up with the header** — Dart's `StackTrace.toString()` prefixes every continuation frame with six spaces (`      #2  Caller …`), which combined with the viewer's own `.stack-frames .line` padding shifted `#2`, `#3`, … further right than `#1` on the header line. Expanded traces read as if the frames had jumped a column. `tryIngestStackLine` now strips leading whitespace from the frame `html` so the viewer's CSS owns the indent. The regex preserves any leading ANSI dim `<span>` wrapper so framework frames stay dimmed.
- **`<asynchronous suspension>` markers render as a compact broken-chain glyph** — Dart emits one suspension marker between nearly every async frame, so a typical expanded Drift trace was dominated by ~25-char `<asynchronous suspension>` lines and the actual frames were hard to find. Expanded gap markers now show a small `⛓️‍💥` glyph with a hover tooltip explaining what an async suspension is. The original phrase is preserved on the line's `rawText` so search ("asynchronous suspension") still hits the row.
- **Severity gutter break at color transitions reads as a break** — the level-mismatch logic in the connector loop correctly stops stamping `bar-up`/`bar-down` when adjacent dots have different levels, leaving an empty row's worth of gutter between them. But the stripe was painted at 45% opacity, faint enough that the 1-row empty gap blended into a continuous-looking faint line and users perceived the gutter as "joining between colors." Bumped to 70% — the stripe is vivid enough now that its absence at a chain boundary is unmistakably empty space. Same-color chains still connect.
- **Gutter line numbers now match the raw file** — the displayed counter showed the position in the in-memory `allLines` array (which counts hidden stack frames, folded async-gap markers, and synthetic repeat chips), so for the contacts sample log the gutter "537" mapped to file line 583 and drifted further with every stack trace. Plumbed a `sourceLineNo` field through `PendingLine` from the parser (offset by `findHeaderEnd` so the number references the user's raw file, not the post-header content slice), stamped it onto every item a single `addToData` call pushes (handles synthetic chips and stack-frame folds), and updated `getDecorationPrefix` to prefer it over `idx + 1`. Multi-part sessions fall back to the in-memory ordinal because a single offset cannot represent concatenated source files. Test: `viewer-file-loader.test.ts` (3 cases for offset and marker behavior).

### Tests
- **Regression coverage for unwrapped Dart stacks (bug_001)** — the contacts project's `debug()` helper stopped passing `stackTrace:` to `dart:developer.log()` and now embeds the trace as plain `#N` lines in the message body, killing the `_StringStackTrace (…)` wrapper VS Code's debug console rendered. Production already grouped these correctly via `isStackFrameText`'s `^#\d+\s` rule, but the test suite was written entirely against the wrapped fixture. Added `viewer-stack-unwrapped-dart.test.ts` to pin: three unwrapped `#N` frames collapse to one stack-header, no orphan `)` row appears, and an async-gap mid-trace still folds into the group. Also added a `source-linker` test for the workspace-relative `./lib/foo.dart:42:9` shape contacts now emits, so a future regex tightening can't silently break click-to-source. The wrapper-compensation code (`isTraceTail`) is intentionally kept — other Dart projects still emit the wrapped form. No runtime/user-facing change.

---

## [7.11.1]

Stack traces, severity gutters, and the session panel all line up where they should now — long logcat tags get trimmed instead of overlapping the message, the session panel shows your most recent files first and stays open after you pick one, error pills moved into their own gutter column so they stop pushing the log text sideways, and loaded log files with leading timestamps (ISO, syslog, epoch, and more) are recognized and stripped from the message. [log](https://github.com/saropa/saropa-log-capture/blob/v7.11.1/CHANGELOG.md)

### Fixed
- **Test pinning a removed ANSI-foreground span no longer fails CI** — `viewer-broadcaster-live-line.test.ts` asserted that processing `\x1b[31m` (foreground red) produced a `color:` style, but commit `156aab44` deliberately stopped rendering ANSI foreground colors so they cannot disagree with the level-* palette. The test was orphaned: a green `npm test` would never produce a `color:` span, so the assertion could never pass. Swapped to background SGR 41 (still rendered) and added an `\x1b`-absence assertion that exercises the live conversion path. No runtime/user-facing change.
- **Stack-trace headers now align with the message column** — a `_StringStackTrace (#1 …)` header carries no decoration prefix, so it sat at the bare `.stack-header` indent (16px) while every decorated log line starts at the much larger `--deco-prefix-width-em` column. The header jutted far out to the left of the message text and read as corrupted, especially where it wrapped. Stack headers now reserve the same left padding as decorated lines (the `line-deco-spacer-only` affordance already used by repeat chips, gated on decorations being on), so the header's chevron and text land in the content column with its frames.
- **Severity gutter connector no longer runs through unrelated content** — `findNextDotSibling` skipped non-leveled content rows when searching for the next dot, so a connector chain could reach *over* a stack frame or plain output line and stamp `bar-down`/`bar-up` stubs onto same-level dots beyond it — the gutter line appeared to run through content (and across changing colors) it had nothing to do with. It now returns the next real (non-blank, non-divider) row regardless of level; a non-leveled row yields `null`, the same-level check fails, and the chain breaks cleanly at that row. Blank lines and `.viewer-divider` control rows are still skipped so same-level dots pair across genuine gaps. This completes the intent commit `11cb4ca7` documented but never applied to the function.
- **The `)` closing a Dart `_StringStackTrace` no longer renders as a junk line** — Dart's `log(…, stackTrace:)` prints the trace as an object dump that ends with a bare `)` on its own line. That `)` is not a stack frame or async-gap marker, so it failed the stack-frame test, closed the active group, and rendered as a stray `)` row after every trace. It now folds into the open stack group as an `fw=true` continuation frame (same treatment as `<asynchronous suspension>`): hidden while the header is collapsed or in preview, revealed only on full expand. An orphan `)` with no active group still renders as a normal line, and it is excluded from the header's frame count.
- **Long logcat tags no longer overlap the message text** — the type/tag column (`flutter`, `MediaSessionCompat`, `WindowExtensionsImpl`) is a fixed `7em` reservation, but a tag wider than that had no clip and spilled straight over the start of the message (`MediaSessionComCouldn't find…`). The tag is now an inline-block capped at `7em` with `overflow: hidden` and an ellipsis, so it stays inside its column; the full tag remains available on the hover tooltip.
- **Session panel streaming preview now shows recent files first** — the panel's streaming scan walked report directories in the order the filesystem returned them (ascending), so it shimmered through the oldest date folders (`2026.04.13/…`) before reaching the recent ones (`2026.05.14/…`) that the user almost always wants. The scan now visits date-stamped folders and files newest-first (reverse-alphabetical, which for date stamps is reverse-chronological), so the first shimmers fill in with the most relevant files. The final tree order is still mtime-sorted — only the order shimmers appear during the scan changed.
- **Session panel no longer collapses the instant you open a file** — selecting a file rebuilt the list DOM, which detached the clicked node; the click then bubbled to the outside-click handler, whose `panel.contains(node)` test failed on the detached node and closed the panel immediately. The click no longer bubbles past the list, and the panel now stays open for a few seconds after a selection so picking another file to view doesn't require reopening it. Each selection resets that countdown; a manual close cancels it.
- **Session panel resize no longer jumps sideways when grabbed** — the resize drag set the slot width from the absolute mouse X, which is not the slot's current width (it is off by the icon-bar width and any left offset), so the panel snapped sideways the moment the handle was grabbed. The drag now tracks a delta from the start position, so the first move is a no-op and the panel resizes smoothly from where it was.
- **Async-gap markers no longer shatter Dart stack traces** — `<asynchronous suspension>` lines failed the stack-frame test, so each one closed the active stack group; a typical Drift async trace was split into ~15 separate one-frame groups instead of one collapsible block. They now fold into the enclosing stack group as continuation frames — hidden while the header is collapsed or in preview, revealed on full expand so await boundaries stay inspectable. An orphan gap with no active group still renders as a normal line. Stack-line ingestion was extracted from `addToData` into `viewer-data-add-stack-ingest.ts` to stay within the file-size limit.
- **Severity color now always matches the level filter** — a line painted by source ANSI foreground color could read as an error while being classified `info`, so it never appeared under the matching level toggle (and the toggle's count could read zero on a log full of errors). ANSI foreground color is no longer rendered at all — severity color is owned entirely by the line's classified level, so the on-row color and the level filter can never disagree. ANSI background, bold, dim, italic, and underline are still honored. The error classifier was also tightened: a thrown exception printed in call form (`PermissionDeniedException (no OS grant on file)`) and structural failure phrasing (`could not decode …`, `unable to …`, `failed to …`) are now classified instead of silently falling through to `info`.
- **Audit/report `file:line` lists no longer collapse under bogus stack headers** — the generic indented stack-frame rule matched any `  file.ext:line` token, so an audit/analyzer report line like `  foo_utils.dart:11  SomeMethod` (a `file:line` followed by a prose description) was misread as a stack frame and whole report sections were swallowed into one fake collapsed stack block. The rule now requires the line number to be followed by a column, a frame suffix (` +0x…` Go offset, ` (`), a closing bracket, or end-of-line — so real frames (including Go tracebacks) still match while prose lists do not.
- **Error-classification markers no longer shift the line text** — the bug, transient, and ANR badges rendered as inline `🐛 BUG` / `⚡ TRANSIENT` / `⏱ ANR` pills, so every classified line's text was pushed right and broke alignment with the surrounding lines. All three now render as a single emoji in their own absolutely-positioned gutter column — the same treatment `critical` already had — so the log text stays put. The full label is in the hover tooltip and the analysis popover.
- **Decoration prefix column now sizes to the columns actually in use** — the prefix-column width was a static worst-case that always reserved space for the timestamp, PID/TID, and tag columns even when only the line-number counter was shown, leaving a large empty gap between the severity bar and the message text — and that gap got dramatically worse on files that carry none of that data (a markdown or lint-report file has no timestamps, PIDs, or tags at all). The width is now computed from the parts that will *actually render*: a column is reserved only when its toggle is on **and** the loaded log actually contains that data. Each non-rendering part contributes zero, so the gap shrinks to exactly what is shown. The prefix span is pinned to that width (`display: inline-block`) so the message text starts at the same x on every decorated line; the existing `padding-left` / `text-indent` model is otherwise unchanged, so wrapped SQL and error lines still align under the message column.
- **Leading timestamps in loaded log files are now detected across many formats** — files whose lines are prefixed with a timestamp (`2026-05-14T11:50:51.135Z  [CACHE]  HIT  …`, as produced by report tools) had no matching parse rule, so the whole line — timestamp included — fell through to the raw fallback: the timestamp showed inline in the message text and the line carried no timestamp at all (empty time decoration column, no chronological ordering). The file loader now detects a leading timestamp in any of these forms — ISO-8601 (`…T…Z` / `±HH:MM`), space-separated date+time (`YYYY-MM-DD HH:MM:SS.mmm`), clock-time-only (`HH:MM:SS.mmm`), syslog (`Mon DD HH:MM:SS`), bracketed (`[…]`), and Unix epoch (10/13-digit) — parses it into the line's timestamp, and strips it from the message so it shows in the time column instead. The detector runs after the explicit `[bracket]` formats so a bracketed category is never mis-read, and every candidate is validated before it is committed so prose is never mis-stripped. The same detection now also strips the timestamp from external sidecar lines (previously it was parsed but left inline in the text).

---

## [7.11.0]

Signals get a lot smarter — the panel now learns from the levels you switch off, flags brand-new crash types and resolved ones across recent sessions, lets you mute a signal with a reason, and gains three new detectors (severity escalation, silence-then-burst, and frame-budget clusters). The Signals panel adds a time-window filter, inline evidence previews under each row, and a pulse highlight when you jump to a line. Two new one-click bug-report formats land too: GitHub Issue Markdown and a compact handoff bundle for chat. [log](https://github.com/saropa/saropa-log-capture/blob/v7.11.0/CHANGELOG.md)

### Added
- **Noise-learning Phase 4 — filter-out emission + Insights panel suggestions section** — Two coordinated additions plan 053 promised:
  - **`filter-out` emission wired (053-B)** — Previously the `'filter-out'` `InteractionType` enum value had no emitter site. Now every time the user disables a severity level (single toggle, Select None, or Solo-Level), the Signals viewer emits up to 50 `filter-out` interactions for the lines that just became hidden (per-toggle cap, index-based dedupe). The noise-learning extractor was already prepared to consume this type — it just had no source until now.
  - **Filter-suggestions section in the Insights panel (053-A)** — A new collapsible block inside "Across your logs" surfaces pending noise-learning suggestions with Accept and Reject buttons inline. Section self-hides when no pending suggestions exist (no empty-header noise). Accept updates `saropaLogCapture.exclusions` and marks the suggestion accepted; Reject only marks rejected. The existing QuickPick command and notification entry points remain — this is an always-visible *additional* surface, not a replacement.
- **Cross-session regression detector + recovery signal** — Two new entries surface at the top of "Signals in this log" when the open session is compared against the previous 10 sessions.
  - **🆕 New error type (F7)** — error fingerprint present in the current session but absent from the lookback window. High severity. Surfaces as "you just introduced a new crash" — almost always either a real regression or a newly-reachable code path.
  - **✅ Resolved (F8)** — error fingerprint present in past sessions but absent from the current one. Low severity (positive signal, deliberately doesn't crowd out actionable problems). Includes "last seen N sessions ago" so the user knows how recent the fix-or-disappearance was. This is the first **positive** signal in the panel — everything else surfaces problems.
  - Both share storage and queries — same set-difference both ways against persisted error fingerprints (`SessionMeta.fingerprints`). Each side caps at 5 entries to keep the panel scannable.
- **Mute signal with reason** — Right-clicking the "Mute" triage action on an error/warning signal now prompts for a free-text reason (≤80 chars, optional). Pressing OK with a reason mutes the signal AND feeds the reason as a labeled `add-exclusion` interaction into the already-shipped noise-learning system (`src/modules/learning/`); pressing OK with no reason is the existing anonymous mute; pressing Escape cancels the mute entirely (no partial state). The signal label is sent alongside the reason so the pattern extractor has both the signal content and the user's framing of why it's noise.
- **Two new bug-report variants for fast sharing** — Both reuse the same data-collection pipeline as the full report, but format the output differently and send it to the clipboard instead of writing a file.
  - **`Saropa Log Capture: Copy GitHub Issue Markdown`** (E3) — Section ordering and headings match GitHub's default issue template (Summary / Steps to Reproduce / Expected / Actual / Logs / Environment), so paste lands in the right slots. Full output goes inside a `<details>` block which GitHub renders collapsed.
  - **`Saropa Log Capture: Copy Compact Handoff Bundle`** (E4) — Three-section markdown subset (~30 lines target): What happened / Where / What to look at next. Includes the last 12 raw log lines. Designed for paste into a Slack/Discord/Teams "can you look at this?" message without scrolling.
- **Signals panel: time-window filter, inline evidence preview, scroll-lock pulse** — three UX additions to the "Signals in this log" section. Each ships on data already present in the webview, no new collector or extension-host plumbing.
  - **Time-window filter (Fu7)** — Four chips above "Signals in this log": All, Last 5s, Last 30s, Last 5min. Reference time is the latest log line's timestamp in the current session, not wall-clock, so the filter works for both live and replay viewing. Signals lacking a timestamp are hidden under any active window. Cross-session "All signals" further down the panel is intentionally not filtered (no meaningful single-session anchor across sessions).
  - **Inline evidence preview (Fu3)** — Up to three supporting log lines render in a compact sub-block under each signal title, stripped of HTML and truncated at 90 chars. Removes the click-through to verify what the signal is pointing at. Lines with no `lineIndices` (e.g. ANR risk score signals) render without a preview, as expected.
  - **Scroll-lock pulse (Fu2)** — Clicking a "signal-jumpable" row now applies a brief 900ms pulse highlight to lines within ±10 of the jump target, using the existing `--vscode-editor-findMatchHighlightBackground` color. Cue is transient: CSS keyframe returns to transparent at the end, no leftover visual debt.
- **Three new signals on existing log data** — The Signals panel now surfaces three patterns that previously required reading the log line by line. Each runs as a one-pass webview scan and posts results to the host hypothesis builder so the existing UI renders them with no extra wiring. Settings unchanged; thresholds match the rationale in `plans/052_plan-semantic-timeline-capture-and-signal-expansion.md`.
  - **Severity escalation chain (F10)** — When ≥2 warnings precede an error within 5s, the panel reports "Severity escalation: N warnings preceded the error within Xs". Evidence links to the error first, then the warnings in chronological order, so clicking the report goes straight to the failure.
  - **Silence-then-burst (F9)** — Catches frozen-UI unwinds and watchdog events that are invisible to a regular scroll because the *gap* is the signal. Detects a ≥10s silence followed by ≥20 lines in <1s. Confidence promotes from medium → high when the silence reaches ≥30s (that range is hard to explain as user idle).
  - **Frame-budget cluster (F14)** — Builds on the existing slow-operation detector (plan 048): a single 500ms op is forgivable, but ≥5 within 10s is jank visible to the user. Reuses `rchExtractDuration` from the general collector so the PERF regex doesn't get duplicated.

---

## [7.10.0]

Expanding "N × SQL repeated:" no longer overlaps the rows below, chip rows align to the same content column as decorated lines, the redundant `»` separator is gone from line decorations, and the **About Saropa** panel now renders the changelog as formatted markdown (headings, bullets, bold, italic, code, rules) with selectable text, plus a press-and-hold on the "Saropa Log Capture vX.Y.Z" title copies the title to the clipboard. [log](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md)

### Added
- **About panel: long-press title to copy "Saropa Log Capture vX.Y.Z"** — Press and hold the title row in the About Saropa panel for half a second to copy the full product name + version string to the clipboard; the existing copy toast confirms what landed. Useful for pasting into bug reports without retyping the version. Mouse and touch are both wired, and the row dims briefly during the press so the gesture is discoverable.
- **About panel: changelog now renders as formatted markdown** — Recent changes used to show as a plain-text `<pre>` block; the panel now parses headings (`#` through `######`), `**bold**`, `*italic*`, `` `inline code` ``, `-`/`*` bullets, blockquotes, and `---` horizontal rules into styled HTML. Inline `[text](url)` links render as plain underlined text (the "Full changelog on Marketplace" link above remains the single authorized external nav from the panel). Raw HTML inside the changelog is escaped before formatting runs, so untrusted angle brackets can't inject markup.
- **About panel: changelog text is now selectable** — The global `body { user-select: none }` rule (which confines native selection to the main `#viewport`) was suppressing drag-to-select inside the About panel. The changelog container and all its descendants now opt back in to `user-select: text` with a `cursor: text` affordance, so you can highlight a line and use the platform copy menu.

### Fixed
- **N+1 signal confidence badge was double-boxed** — The confidence label (LOW/MEDIUM/HIGH) on "Potential N+1 query" rows had both square brackets in the text and a CSS border on the `.n1-conf` span, producing a redundant double-box. Removed the brackets so only the styled border remains.
- **SQL repeat drilldown no longer overlaps later rows** — Clicking "N × SQL repeated:" expanded an inline panel inside a `.line` element with a strict 1em CSS height; the block-level drilldown overflowed via `overflow: visible` and painted on top of the next several log rows. The row now grows to fit the panel via a new `.line.line-has-block` rule, and `estimateSqlRepeatDrilldownExtraHeight()` baseline jumped from 44 → 122px to match the actual rendered panel (container margins + two meta rows + snippet pre + variant title), so the virtual scroller's prefix sums no longer undercount.
- **Chip rows align to the content column when decorations are on** — Repeat-notification and N+1 chips skipped the decoration prefix and rendered at the left edge of the viewer, breaking the tabular column that decorated lines establish. A new `.line.line-deco-spacer-only` class is applied to chip rows whenever decorations are globally on, so the chip label and any embedded drilldown panel sit at the same content column as message text on regular lines.

### Changed
- **Flutter exception banner: severity dots tucked into the red rail** — Inside a Flutter `══ Exception caught by …` block the per-line severity dot used to sit ~12px right of the banner's red left rail, so the rail and the dot column read as two competing left-side guides. Pulled the dot's `left` from `0.74em` to `0.15em` (and re-centered the `bar-up` / `bar-down` connector under it at `0.30em`) only for `.banner-group-*` rows, closing the gap to ~2-3px so the rail visually flows through the dots.
- **Severity connector now breaks at real content rows** — The connector bar between two same-level dots used to color the gutter of EVERY intermediate row, including non-blank rows that lacked their own severity (stack frames, unleveled stdout, repeat-notification chips). A warning chain that crossed a stack frame painted a continuous yellow line right through that stack frame, falsely claiming it as part of the warning sequence. The bridge loop in `viewer-data-viewport.ts` now only paints across truly empty rows (`.line-blank` and `.viewer-divider`). When a real content row sits between two same-level dots the `bar-down` / `bar-up` stubs on the dots themselves still fire (so the chain reads as "almost connected") but the middle row's gutter is left untouched — producing the clean visual break the user expected when the line crossed color or content boundaries.
- **Flutter banner body/footer rows: line number + timestamp hidden** — Inside a banner block, the same wall-clock timestamp repeats on every row (the whole RenderFlex dump emits in one frame) and the per-row counter on a 50-line block adds noise without information. The `.line-decoration` span on `.banner-group-mid` and `.banner-group-end` is now `visibility: hidden` — the span still occupies its full width (so the `.line:has(.line-decoration)` rule keeps the 14.25em padding-left + hanging-indent and message text stays column-aligned with the banner header) and the idx-based counter still advances, so Copy with decorations / Copy Error continue to produce correctly numbered output. Only the leading header row in each banner shows the visible counter + time.
- **Decoration prefix drops the `»` chevron** — With the hanging-indent content column the separator was visually redundant; trailing whitespace alone now marks the column boundary. Copy output still emits `»` because plain-text paste has no columns to anchor against. The continuation badge splice now targets the trailing `&nbsp;&nbsp;</span>` inside `.line-decoration` instead of the old chevron sentinel.

---

## [7.9.0]

Navigator arrows now use proper VS Code icons and fade when the panel is in the background, signal reports get a two-column layout with collapsible sections and visual polish, and several rendering bugs are squashed. [log](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md)

### Changed
- **Navigator arrows use codicon chevrons** — Replaced Unicode block arrows (⬆/⬇) with `codicon-chevron-up` / `codicon-chevron-down` so the top/bottom jump buttons look like intentional UI, not stray lines.
- **Navigator buttons dim when viewer is unfocused** — Jump-to-top and jump-to-bottom buttons now render at 50% opacity until the log viewer panel has focus, then raise to 85% (full on hover). Reduces visual noise when the panel is in the background.

### Added
- **Signal report two-column layout** — On wide monitors (900px+), the report splits into a primary column (overview, evidence, details, related) and a secondary column (signals, history, recommendations, ecosystem). Stacks to single-column on narrow panels.
- **Signal report collapsible sections** — Every section is now a `<details>` toggle that can be collapsed/expanded. Collapse state persists across tab-group moves.
- **Session start/end timestamps in overview** — The Session Overview now shows formatted start and end times (e.g. `2026-05-13 10:35:40`) alongside the existing duration and outcome fields.
- **Signal report visual polish** — Subtle left-border accent colors per section category, confidence badge glow, hover lift on stat cards, styled evidence metadata, and shadow on evidence blocks.
- **Signal report loading shimmer** — Loading placeholders now pulse with a shimmer animation so the report looks alive while sections populate, not frozen.
- **Signal report toast notifications** — Copy Report and Save Report now show an in-panel toast (success/error) instead of the barely-visible status bar message.

### Fixed
- **Signal report lost content on tab move** — Moving the Signal Report panel to another editor group destroyed and recreated the webview, reverting all sections to loading placeholders. Sections are now persisted via `setState`/`getState` so content survives tab-group moves.
- **Non-error stack traces no longer default to error-red** — Stack headers (e.g. Drift SQL interceptor traces) inherited the error foreground color as their CSS default, making database-level and info-level traces appear red regardless of their actual severity. The base `.stack-header` color is now neutral (`inherit`); error-red is applied only via an explicit `.level-error` rule.
- **Keyword filter clicks broken on collapsible rows** — Clicking a metadata keyword (PID, TID, tag) inside a stack header toggled the collapse instead of activating the filter. The stack-header click handler was checked before the metadata handler, swallowing the event. Reordered so metadata clicks are handled first.
- **1-frame stack headers showed a misleading collapse chevron** — Single-frame stacks (e.g. a lone `GeolocatorAndroid.getLastKnownPosition` trace) rendered a ▶ toggle with nothing to expand. Clicking changed internal state but had zero visual effect. The chevron and toggle are now omitted when `frameCount === 1`; the dedup badge `(xN)` still shows as information.
- **Dedup-hidden stack groups reappeared after filter changes** — `finalizeStackGroup` hid duplicate stacks by setting `height = 0` directly, but `calcItemHeight` had no flag to check, so any `recalcHeights()` call (from toggling filters, expanding groups, etc.) would silently un-hide them. Hidden duplicates now carry `stackDedupHidden = true` so they persist through recalculation.
- **N+1 signal confidence badge was double-boxed** — The confidence label (LOW/MEDIUM/HIGH) on N+1 query signals had both square brackets in the text and a CSS border, creating a redundant double-box. Removed the brackets so only the styled border remains.
- **DB toggle left Drift stack traces visible** — Stack headers like `DriftDebugInterceptor._log` had no recognizable source tag, so they fell into the "other" bucket and stayed visible when the Database source tag was hidden. Stack headers now inherit `sourceTag` from the preceding log line when the frame text has no tag of its own.

<details>
<summary>Maintenance</summary>

- **README conciseness overhaul** — Merged redundant Overview and intro sections into a single "Why Use This?" list. Replaced the detailed Features accordion with high-level category bullets. Moved the full settings tables to `docs/CONFIGURATION.md` (README now shows only the three key settings). Removed the Power Shortcuts and Key Commands tables (README links to `docs/walkthrough/keyboard-shortcuts.md` and keeps only the top 3 shortcuts). Condensed "Full Debug Console Capture" to a tip box, "Remote Development" to two sentences, and the Contributing section.
- **README terminology updated to v7.x** — Replaced "Investigation" with "Collection", "Insights" with "Signals", and "Log Inputs" with "Log Sources" throughout the README per the terminology dictionary.
- **README covers recent features** — Added bullets for structured file support (.md/.json/.csv/.html), floating search overlay, post-capture toasts, typography controls, and the Collections panel.
</details>

---

## [7.8.4]

The keyword watch badge now resets when you look at the panel, so it only shows hits you haven't seen. [log](https://github.com/saropa/saropa-log-capture/blob/v7.8.4/CHANGELOG.md)

### Fixed

- **Watch badge now shows only unseen hits** — The keyword watch badge on the Saropa Log Capture tab previously showed a cumulative total that kept climbing and never meaningfully reset. Now when the panel gains focus, both the badge and the underlying watcher counts reset, so the badge only reflects hits since the user last looked.

---

## [7.8.3]

Post-capture toast gains Always Open and Don't Ask Again buttons, the l10n translation pipeline now auto-syncs and translates all 10 locale bundles with brand-name protection, and context menu items show keyboard shortcut hints. [log](https://github.com/saropa/saropa-log-capture/blob/v7.8.3/CHANGELOG.md)

### Added

- **End-of-capture toast: "Always Open" and "Don't Ask Again" buttons** — The post-capture notification now has four actions: Copy Log Path, Open Log, Always Open, and Don't Ask Again. "Always Open" persists the preference to auto-open future logs in the viewer without asking. "Don't Ask Again" suppresses the notification entirely. Both write to the new `afterCaptureAction` setting.
- **`afterCaptureAction` setting** — Replaces the boolean `autoOpen` setting with a three-way enum: `"ask"` (show notification, default), `"openLog"` (auto-open in the viewer), `"nothing"` (suppress notification). Existing `autoOpen: true` is automatically migrated to `"openLog"`.

<details>
<summary>Maintenance</summary>

- **Organized `scripts/modules/` into subfolders** — Split the flat `scripts/modules/` directory (35+ files) into six purpose-based subfolders: `publish/` (Python publish pipeline), `verify/` (CI verification), `generate/` (code/catalog generators), `test/` (test tooling), `build/` (bundle/clean), and `fix/` (fixers and diagnostics). Updated all Python imports, `package.json` script paths, runtime cross-references, and auto-generated doc headers.
- **l10n translation pipeline** — Added `scripts/translate_l10n.py` to audit, sync, and translate l10n bundles. Audits English bundle against TS source strings, syncs missing/orphan keys, and translates all locale bundles via Google Translate (free tier, `deep-translator`). The publish pipeline (Step 9) now automatically syncs and translates instead of just warning. Brand names (Saropa, GitHub, Loki, etc.) are shielded from translation via placeholder substitution; existing mangled brand translations are automatically detected, reset, and retranslated. Writes timestamped audit reports and gap exports (CSV/JSON) to `reports/`.
- **Publish script: push failure on remote changes** — When `git push` was rejected (non-fast-forward) in Step 11, the fallback `git pull --no-edit` used merge, which could conflict on files both sides touched (e.g. `package.json` version field after a prior publish). Switched to `git pull --rebase` so the release commit is replayed on top of remote changes. If the rebase itself conflicts, it aborts cleanly and tells the user to resolve manually.
</details>

---

## [7.8.2]

Context menu gets positive toggle language, "View" prefixes for navigation actions, tooltips on every item, keyboard shortcut hints, and a renamed "Tall rows" option; icon bar is wider and the session panel shrinks narrower. [log](https://github.com/saropa/saropa-log-capture/blob/v7.8.2/CHANGELOG.md)

### Changed

- **Session panel minimum width reduced** — Lowered the session panel minimum width from 560px to 420px (25% narrower) so users with tight layouts can shrink the panel further via the resize handle. Default width unchanged.
- **Context menu: positive toggle language** — The "Hide blank lines" toggle in the Hide submenu is now "Show blank lines" with inverted checkmark logic (checked = blank lines visible). Reduces confusion between one-shot hide actions and on/off toggles.
- **Context menu: "View" for navigation actions** — Renamed "Show Context", "Show Integration Context", "Show Related Queries", and "Show code quality" to "View Context", "View Integration Context", "View Related Queries", and "View Code Quality". Reserves "Show" for toggle semantics only.
- **Context menu tooltips** — Every context menu item now carries a `title` tooltip describing what it does: copy actions, search actions, hide actions, layout toggles, and all Actions submenu items.
- **"Tall rows" label** — Renamed "Comfortable line height" to "Tall rows" in the Layout submenu. The tooltip explains the actual effect (1.2 → 2.0 line-height).
- **Keyboard shortcut hints in context menus** — Menu items that have keyboard shortcuts now show a right-aligned dimmed hint (e.g. `W`, `Ctrl+C`, `Ctrl+Shift+Scroll`). Covers Copy, Select All, Pin, Bookmark, Word wrap, Visual spacing, Tall rows, Compress, and Show blank lines.

### Fixed

- **Icon bar too narrow** — Widened icon bar from 36px to 44px (closer to VS Code's native 48px activity bar) so icons have horizontal breathing room instead of looking crushed.
- **Orphan separator in Copy & Export** — The horizontal rule between the per-line copy items (Copy Line, Copy Timestamp, etc.) and the "Copy All" group was missing `data-line-action`, so it stayed visible as a top-edge line when right-clicking empty space with no line targeted.

---

## [7.8.1]

Fixes icon bar layout when a horizontal scrollbar is present, a signal panel crash on the PERFORMANCE link, and adds line numbers to the Layout submenu. [log](https://github.com/saropa/saropa-log-capture/blob/v7.8.1/CHANGELOG.md)

### Fixed

- **Icon bar crushed when horizontal scrollbar visible** — Added `min-width` to the icon bar so Chromium's flex layout cannot compress it below its declared width when wide log lines trigger a horizontal scrollbar.
- **Signal panel crash on PERFORMANCE link** — Removed stale calls to `renderRecurringInLog`, `renderErrorsInLog`, and `renderThisLogEmptyState` that were deleted in the signals consolidation refactor but left behind in `applyStateAB`, causing a `ReferenceError` when the panel rendered with an active log.

### Changed

- **Lighter severity gutter** — Severity dots reduced from `0.54em` to `0.44em` and connector stripes from `0.23em` to `0.14em` so the gutter reads as a subtle guide rather than competing with log text for attention.
- **Layout submenu grouping** — Added horizontal separators in the right-click → Layout submenu to visually group related toggles: text display (Word wrap, Line numbers), time (Timestamp, Session elapsed), spacing (Visual spacing, Comfortable line height), and compression (consecutive / non-consecutive dupes).

### Added

- **Line numbers in Layout submenu** — The right-click → Layout submenu now includes a **Line numbers** toggle (checkmark mirrors the Options panel checkbox). Previously only accessible from the Options or Decorations panels.

### Removed

- **Scroll map & scrollbar submenu** — Removed the **Scroll map & scrollbar** submenu from the main right-click context menu. The same toggles remain accessible via right-click directly on the scroll map or native scrollbar.

<details>
<summary>Maintenance</summary>

- **Report organizer script** — Added `reports/organize_reports.py` (shared across Saropa projects) and `.gitignore` exception so the script is version-controlled while report output remains ignored.
</details>

---

## [7.8.0]

Right-click → Copy & Export → Copy Line now copies the line you actually right-clicked, even if there's a stale shift-click selection from earlier in the session, and every copy from the context menu shows an instant in-viewer toast (e.g. `Copied lines 116-225 (1,247 characters)`) so you can confirm what landed on the clipboard at a glance. [log](https://github.com/saropa/saropa-log-capture/blob/v7.8.0/CHANGELOG.md)

### Fixed

- **Severity gutter dot vs vertical connector** — The continuous left gutter stripe (`.bar-down` / `.bar-up` `::after`) used `opacity: 0.45`, which could make Chromium/WebKit paint the stripe on top of the severity dot where they overlap. The stripe now uses `color-mix` for the same translucency so the dot (`::before`, higher `z-index`) stays visually in front.
- **Recent-error proximity band chaining** — The 2-second “recent error context” gutter/tint could chain forward indefinitely (each tinted line becoming the next anchor), so unrelated lines—including normal console output near startup—could stay error-colored. Proximity anchors now skip prior context rows and synthetic/stack-frame neighbors; callers require a primary `error` anchor, finite timestamps, and stack-headers inherit level from the line before a context row. Regression tests guard the embedded script strings.
- **Row selection highlight vs injected dividers** — After a virtual-scroll pass, the blue shift-click / drag-select stripe was reapplied using **viewport child position** (`lastStart + i`) instead of each row’s `data-idx`. Injected `.viewer-divider` rows (hidden-line gaps from filters, peek groups, preview-trimmed stack frames, etc.) sit between real log lines, so indices drifted: the wrong rows picked up `.selected` and the line you were trying to work on no longer matched the stripe—making within-line text selection feel broken next to collapsed or folded ranges. The stripe now keys only on `data-idx`; dividers never receive `.selected`.
- **Copy Line hijacked by stale shift-click selection** — Right-click → Copy & Export → **Copy Line** (and **Copy Line Decorated**) silently copied the previously shift-click-selected range whenever you right-clicked any other row, instead of the line you actually targeted. Multi-line clipboard output now triggers only when the right-click target row is **inside** the active shift-click range (`sel.multiLine`), so line 50 → Copy Line copies line 50 — not lines 5-10 from a selection you made earlier.

### Changed

- **Copy toast feedback** — Every Copy & Export action (`Copy`, `Copy Line`, `Copy Line Decorated`, `Copy Line Number`, `Copy Timestamp`) now flashes an in-viewer toast: `Copied line 178 (87 characters)`, `Copied lines 116-225 (1,247 characters)`, `Copied line number 178`, `Copied timestamp`. The toast is rendered on the webview side for instant feedback (no host round-trip), in addition to the existing status-bar message.

- **DB timestamp burst framing** — Same-time-query bursts no longer render as one green slab after the last SELECT; the viewer adds **database-colored** top and bottom rails with the burst label twice, connects them with cyan left/right borders and a light tint on each included log line so the whole cluster reads as one framed block.

### Added

- **Accessibility: collapse divider captions** — Divider rows between filtered/peek/stack-preview collapsed ranges hide the redundant `─── N hidden lines · show ───` style pill **by default** (the gutter chevron and clickable row remain). Settings → search **Accessibility: show collapse divider captions** or set `saropaLogCapture.accessibility.showCollapseDividerLabels` to restore the pill.
- **Copy Error / Copy Warning** — On error or warning lines, the main context menu (above **Copy & Export**) gains **Copy Error** or **Copy Warning** (`codicon-error` / `codicon-warning`). It copies plain text for the **full adjacent error/warning run** (until severity breaks), **Flutter `════ Exception caught by … ════` blocks** by `bannerGroupId` (full render-overflow / layout dumps, including long stdout bodies), continuation fragments (split long lines), and stack groups with the preceding message line when those touch that band.

- **Copy DB cluster** — On any row that belongs to a **DB timestamp burst** framed block (cyan top/bottom rails and boxed SQL lines), the same menu gains **Copy DB cluster** (`codicon-database`). It copies plain text for the **whole burst** in order: both rail headings plus every clustered database line inside the frame. **Copy Error** / **Warning** and **Copy DB cluster** share one separator strip before **Copy & Export** when either applies; both commands now show the same multi-line copy toast (`Copied lines …`) as Copy Line ranges.

---

## [7.7.0]

Each expand/collapse in the log viewer now has its own dedicated control instead of overloading the severity dot, the Counter toggle is renamed Line numbers and moved to Layout, the permanent 99+ badge on the Logs icon is gone, dragged-in context lines (stack frames, repeat chips) mute correctly under level filters, and within-line text selection in the viewer works again. [log](https://github.com/saropa/saropa-log-capture/blob/v7.7.0/CHANGELOG.md)

### Changed

- **Severity gutter is now read-only — every expand/collapse has its own affordance** — The outlined severity dot was overloaded with four different meanings (filter-hidden gap, expanded peek group, dedup-fold survivor, collapsed stack header) and the dot looked identical for "click to expand" and "click to collapse". That overload is gone. The gutter now shows severity only; clicks pass through. Each concept gets a dedicated, self-describing control:
  - **Filter-hidden gap** — a thin row between the two visible lines reads `── 12 hidden lines · show ──`. Click expands.
  - **Expanded peek group** — leading `── hide 12 revealed · collapse ──` row above the range AND a trailing `── hide 12 revealed (above) · collapse ──` row below it. Either click collapses the whole group, so the user can re-hide from wherever they scrolled to without scrolling back to the top.
  - **Dedup-fold survivor** — inline `×12` pill at the end of the survivor row's text. Click expands the folded duplicates and the badge mutates to `×12 hide`. Click again collapses.
  - **Collapsed / preview stack** — inline `▶` / `▼` chevron inside the stack-header text (IDE convention). Preview-mode also gets a `── 8 more stack frames hidden · show all ──` row below the last visible app frame.

  Plan: `bugs/048_plan-severity-gutter-decoupling.md`. Supersedes the surgical `× hide revealed lines` pill from the prior commit.
- **Line numbers toggle** — Renamed the **Counter** checkbox to **Line numbers** in both the *Options* panel and the *Decorations* panel, and moved the Options-panel row from *Display* into *Layout*. Same underlying toggle (`decoShowCounter`) and same line-number rendering — clearer label, more discoverable spot for a structural layout choice.
- **Removed the count badge from the Logs icon** — Any project with real history sat permanently at "99+", so the badge conveyed nothing and just added clutter. The actual session count is still visible inside the Logs panel.

### Fixed

- **Level filter context lines** — Stack frames, stack headers, repeat chips ("N × SQL repeated"), and N+1 signal chips that were dragged in as context for nearby errors rendered at full color/opacity, looking like primary content even when only **Error** was enabled. They now mute correctly via `.context-line` (opacity 0.4) and drop their level color, so context reads as background. Synthetic analysis chips ("N × SQL repeated", "⚠ Potential N+1 query") are also no longer eligible as context anchors — they describe the surrounding SQL rather than show what led to an error, so the ±N window walks past them to real log lines (stack frames, info lines) that actually carry causality.
- **Log viewer selection** — Restored within-line text selection and stopped the flicker/jump that made selection unusable. Drag-select now only takes over when the cursor leaves the start row (multi-row intent); within-row drags fall through to native browser text selection so half-line, word, and SQL-token selections work again. Live capture's auto-scroll-to-bottom is also paused while a selection is in progress, so streaming lines no longer rewrite the viewport DOM mid-drag and wipe what you were selecting.

---

## [7.6.0]

Native tooltips and an F1 shortcuts hint across the log viewer, a workspace setting for visual spacing; fixes blank lines that were rendering at full height instead of quarter height in the viewer and HTML exports; clicking the footer filename now opens a unified Log file dialog with editor / folder / copy actions. [log](https://github.com/saropa/saropa-log-capture/blob/v7.6.0/CHANGELOG.md)

### Added

- **Log viewer discoverability** — Native tooltips on the log surface, scroll map, session count, and file name explain right-click line actions, long-press to copy session metadata, minimap right-click options, the log file modal, and **F1** for in-viewer shortcuts (defaults).
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

<details>
<summary>Maintenance</summary>

- **Contributor / agent tooling** — `engines.node` (≥22) with `.nvmrc` and `.node-version`; Dev Container (`.devcontainer/devcontainer.json`); [doc/AGENTS.md](doc/AGENTS.md); auto-generated [doc/internal/webview-incoming-message-types.md](doc/internal/webview-incoming-message-types.md) via `npm run generate:webview-catalog` with `verify:webview-catalog` on `npm run compile`; `verify:dist-size` guard on `dist/extension.js`; `npm run analyze-bundle` for esbuild metafile analysis; GitHub PR template and bug report issue form.
- **More dev workflow hardening** — `tsconfig.json` **`noEmit: true`** with test builds using `--noEmit false --outDir out`; [doc/internal/webview-outbound-message-types.md](doc/internal/webview-outbound-message-types.md) + `verify:host-outbound-catalog`; [doc/internal/proposed-api.md](doc/internal/proposed-api.md); `npm run doctor`, `test:file`, **`test:smoke`**, **`preflight`**, **`clean`**, **`verify:node-toolchain`**, [doc/internal/contributes-commands.md](doc/internal/contributes-commands.md) + **`verify:list-commands`**; `verify:release-version`, `verify:release-tag`; Dependabot production patch group; feature-request issue template + issue chooser links; Gitleaks in CI; extension activation smoke test.
</details>

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

Tones down minimap colors after the v7.5.3 per-pixel paint change made the severity, performance, database, and SQL bands too bright. [log](https://github.com/saropa/saropa-log-capture/blob/v7.5.4/CHANGELOG.md)

### Changed

- **Minimap colors rebalanced for per-pixel paint.** Color alphas in `initMmColors` were tuned for the old overdraw model and became too bright after per-pixel reduction. Alphas were lowered across severity/perf/database/SQL bands, and the SQL-density test now pins hue only so alpha can continue to be tuned.

---

## [7.5.3]

Minimap now uses deterministic per-pixel severity reduction so high-severity signals stay visible even when info/debug are hidden, the `Open Log` action on the post-capture notification opens the Log Viewer instead of a hidden editor tab, and the native scrollbar toggle hides and shows reliably. [log](https://github.com/saropa/saropa-log-capture/blob/v7.5.3/CHANGELOG.md)

### Changed

- **Minimap now uses deterministic per-pixel severity reduction.** Instead of stamping every source line and relying on blend behavior, the minimap now stores one winning level per pixel row and paints once. This removes saturation artifacts, keeps bar spacing predictable, and preserves higher-severity signals even when info/debug are hidden.

### Fixed

- **`Open Log` in the `Log Captured` notification now opens the Log Viewer, not a hidden editor tab.** The action was routed through `showTextDocument`; it now calls `saropaLogCapture.openSession` (with fallback to `saropaLogCapture.open`).
- **Native scrollbar hide/show now uses clipping layout instead of pseudo-element toggling.** Chromium cached the `::-webkit-scrollbar` layer, so class toggles were unreliable. A `.log-content-clip` wrapper now controls visibility via box layout, with jump-button inset logic updated to read the clip bounds.

---

## [7.5.2]

The minimap now reads as a true density map with faint gray ticks under severity bars, and icon-bar separators are visible across themes. [log](https://github.com/saropa/saropa-log-capture/blob/v7.5.2/CHANGELOG.md)

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

<details>
<summary>Maintenance</summary>

- **Quality-check line counting now matches ESLint.** `scripts/modules/checks_build.py` now counts non-blank, non-comment lines like `max-lines`, removing false warning mismatches.
</details>

---

## [7.4.0]

Adds a DB-signal marker toggle and hidden-gap click-to-peek, groups Flutter exception banners into one error block, and fixes duplicate log loading plus level-classification edge cases. [log](https://github.com/saropa/saropa-log-capture/blob/v7.4.0/CHANGELOG.md)

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

Logs panel rows now include Reveal in File Explorer, log context actions are grouped under Export/Copy flyouts, and session logs auto-bundle with Drift Advisor/Logcat sidecars into one expandable entry. [log](https://github.com/saropa/saropa-log-capture/blob/v7.3.0/CHANGELOG.md)

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

Adds a dedicated Collections panel, structured viewers for markdown/JSON/CSV/HTML, a floating search overlay, capture on/off status-bar toggle, full F1 shortcuts reference, and richer signal reports (stack traces, fingerprints, cross-session history). [log](https://github.com/saropa/saropa-log-capture/blob/v7.2.0/CHANGELOG.md)

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
### Changed

- **Collections explainer condensed.** The banner is now shorter, dismissible, and the standalone "New Collection" button was removed in favor of context-menu creation.
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

<details>
<summary>Maintenance</summary>

- **Icon bar Bookmarks label test matched wrong structure.** The `getIconBarHtml` test asserted `>Bookmarks</span>` but the label wraps a nested count span; loosened the assertion to `>Bookmarks<`, matching the existing loose pattern for the Logs label.
- **Terminology dictionary added.** `docs/guides/TERMINOLOGY.md` maps user terms to internal names and lists banned terms.
</details>

---

For older versions (7.1.1 and older), see [CHANGELOG_ARCHIVE.md](./CHANGELOG_ARCHIVE.md).
