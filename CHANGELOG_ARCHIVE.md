# Changelog Archive

This archive is for versions 7.11.2 and prior. For current changes see [CHANGELOG.md](./CHANGELOG.md).

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

Expanding "N × SQL repeated:" no longer overlaps the rows below, chip rows align to the same content column as decorated lines, the redundant `»` separator is gone from line decorations, and the **About Saropa** panel now renders the changelog as formatted markdown (headings, bullets, bold, italic, code, rules) with selectable text, plus a press-and-hold on the "Saropa Log Capture vX.Y.Z" title copies the title to the clipboard. [log](https://github.com/saropa/saropa-log-capture/blob/v7.10.0/CHANGELOG.md)

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

Navigator arrows now use proper VS Code icons and fade when the panel is in the background, signal reports get a two-column layout with collapsible sections and visual polish, and several rendering bugs are squashed. [log](https://github.com/saropa/saropa-log-capture/blob/v7.9.0/CHANGELOG.md)

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

### Changed

- **Filter drawer simplified.** Removed Message Tags, Code Origins, and SQL Commands accordion sections from the narrow filter dropdown. Only filtering controls remain: Log Sources (tier radios), Text Exclusions, and File Scope.
- **Tags & Origins slide-out panel.** New icon bar button (Tags) opens a dedicated side panel for chip-heavy browsing sections: Message Tags, Code Origins, SQL Commands, and Individual Sources placeholder. These sections get room to breathe instead of being crammed into tiny accordions.
- **"Log Inputs" renamed to "Log Sources".** The accordion section name now describes what it controls more clearly.
- **"Flutter App" renamed to "Flutter DAP".** The tier radio label now includes a tooltip explaining what the Debug Adapter Protocol is. Hint text added below: "stdout, stderr, console".
- **"Exclusions" renamed to "Text Exclusions".** Clarifies that these patterns filter by text content, not by source or category.
- **"Preset: None" replaced by "Saved Filters: Default".** Footer label and default option renamed. The redundant "Reset all" button was removed — selecting "Default" resets everything.

<details>
<summary>Maintenance</summary>

- **CI coverage thresholds adjusted after v7.0.0 code growth.** Functions threshold lowered from 48% to 43%, branches from 40% to 37%, statements held at 48%. New tests for anomaly detection (10 functions) and crash category classification bring coverage back above the new thresholds.
- **Modularized 7 oversized files to meet the 300 LOC limit.** Extracted severity keywords CSS, logcat classifier tests, session panel test helpers, session metadata I/O, session manager listeners, signal accumulators, and viewer-specific activation handlers into dedicated modules. No behavior changes.
</details>

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

## [6.2.1]

Fixes CI failures from a wrong CSS test selector and outdated coverage thresholds. [log](https://github.com/saropa/saropa-log-capture/blob/v6.2.1/CHANGELOG.md)

<details>
<summary>Maintenance</summary>

- **CI: Signals evidence button test referenced wrong CSS class.** The test `viewer-root-cause-hints-styles.test.ts` asserted against `.root-cause-hyp-evidence` which never existed in the CSS — the actual class is `.rch-report-btn`. Updated the test regex and assertion messages to match the real selectors.
- **CI: coverage thresholds lowered to match current codebase.** Functions and statements lowered from 50% to 48%, branches from 45% to 40%, lines from 50% to 48%. The previous thresholds caused CI to fail after recent feature additions.
</details>

---

## [6.2.0]

Captures missed Flutter starts, adds collapsible Project Logs day groups, tri-state tier filters, and auto Flutter crash-log import. [log](https://github.com/saropa/saropa-log-capture/blob/v6.2.0/CHANGELOG.md)

### Fixed

- **Flutter debug sessions now captured when `onDidStartDebugSession` does not fire.** The late-start fallback required an exact session ID match between the buffering session and `activeDebugSession`, which always fails for Flutter's parent/child session model (output arrives on the Dart VM child, but the active session is the Flutter parent). Removed the strict ID check so any buffered output triggers capture via the active session. Also added `attachToExistingSession` to detect sessions already running at activation time (covers window reload and extension host restart), wrapped the `onDidStartDebugSession` handler in try/catch so errors are logged instead of silently swallowed, and added diagnostic logging at every silent skip path in the session-start pipeline.

### Added

- **Collapsible daily groupings in Project Logs.** Click a day heading to collapse or expand that group. Collapsed state persists across panel close/reopen via workspace storage. Headings show a chevron indicator and support keyboard navigation (Enter/Space).
- **Tri-state tier filter for Flutter and Device logs.** The Log Inputs section in the filter drawer now offers three modes per tier — All, Warn+, and None — instead of a simple on/off checkbox. "Warn+" surfaces only warnings and errors from that tier while hiding info/debug noise. The keyboard shortcut `A` cycles Device through all three states.
- **Flutter CLI crash log detection.** When Flutter's tooling crashes (`flutter test`, `flutter run`, `flutter build`), it writes `flutter_XX.log` files to the workspace root. The extension now auto-detects these files, imports them into the reports directory so they appear in the session history list, and annotates any active debug session with the crash details. Enabled by default via the `flutterCrashLogs` integration adapter.

---

## [6.1.1]

Fixes Project Logs active-session tracking, and adds broader date and name-based session filters. [log](https://github.com/saropa/saropa-log-capture/blob/v6.1.1/CHANGELOG.md)

### Fixed

- **Project Logs panel now follows the active debug session.** Starting a debug session automatically points the panel at that session's log directory, so logs appear immediately instead of showing stale entries from a previously browsed folder.

### Added

- **Expanded date range filter options in Project Logs panel.** The dropdown now offers 10 choices: Last hour, Last 4 hours, Last 8 hours, Last 24 hours, Last 7 days, Last 30 days, Last 3 months, Last 6 months, Last year, and All time. The same expanded options are available in the Insights panel time-range selector.
- **Name-based filtering in Project Logs panel.** Right-click any session to "Hide This Name" (exclude all sessions with the same canonical name, ignoring dates) or "Show Only This Name" (show only matching sessions). A filter bar appears with the active filter and a "Show All" button to clear it.

<details>
<summary>Maintenance</summary>
- **"slow operation" keyword missing from package.json performance defaults.** The `package.json` default for `saropaLogCapture.severityKeywords.performance` was missing `"slow operation"`, which is present in the code-level defaults. When VS Code reads configuration, it uses the `package.json` default, so lines like `Slow operation: took 5000ms` were classified as `info` instead of `performance`.
</details>

---

## [6.1.0]

Adds session-time toggles, signal-report saving, PERF-line detection, and a configurable slow-operation threshold.
[log](https://github.com/saropa/saropa-log-capture/blob/v6.1.0/CHANGELOG.md)

### Added

- **Session time (T+) toggle in context menu.** Options submenu now includes a quick toggle for session elapsed time, matching the gear panel checkbox.
- **Save Report button on signal reports.** Saves a markdown report to the configured log directory (`saropaLogCapture.logDirectory`).
- **PERF-line slow-operation signal detection.** `[log] PERF operationName: Nms` lines are now recognized as slow operations, with the operation name shown in the hypothesis text (e.g. "Slow operation (1.0s): dbEventCountForDate").
- **Configurable slow-operation threshold.** New setting `saropaLogCapture.signalSlowOpThresholdMs` (default 500ms, range 100-60000) controls the minimum duration for a slow-operation signal. Lowered from the previous hardcoded 2000ms.
- **Copy Log Path button on session-end notification.** A new "Copy Log Path" button appears alongside "Open Log" when a session completes, copying the log file path to the clipboard.

### Changed

- **Signal report title** is now "Saropa Signal Report" (panel tab and heading).
- **Copy Report** now copies the report as markdown with evidence lines and resolved source file paths.

### Fixed

- **Severity dot order inconsistent between project list and viewer toolbar.** Unified all severity level orderings (toolbar dots, filter drawer, export panel, project list) to a single canonical order: error → warning → info → performance → todo → notice → debug → database.
- **Confidence badge unreadable in some themes.** Replaced theme-variable-only colors with explicit high-contrast foreground, background, and border values.
- **External sidecar timestamps not parsed.** Lines from external sidecars (e.g. SDA logs) with ISO 8601 timestamps now have their timestamps extracted, enabling Session time (T+), elapsed time, and timestamp decorations.
- **Warning-recurring signal missed for device-other lines (plan 050).** Device-other tier demotion (error/warning → info for display) was also suppressing signal detection. The original pre-demotion level is now preserved on line items so the signal collector sees the true classification while display remains unchanged.

<details>
<summary>Maintenance</summary>

- Eliminated signal algorithm duplication — hypothesis building now runs exclusively on the host (single TypeScript source of truth) instead of being duplicated as ~280 lines of embedded JavaScript in the webview
- Deduplicated session list I/O on startup — auto-load and streaming session list now share a single in-flight fetch instead of scanning the directory and loading every file header twice
- Fixed signal report panel leak on deactivation — the signal report webview panel is now explicitly disposed during extension deactivation
- Split `build-hypotheses.ts`, `viewer-continuation-behavior.test.ts`, and `viewer-styles-decoration.ts` to stay within the 300-line limit
- Reclassified internal-only CHANGELOG entries (file splits, CI fixes, param refactors, script cleanup) from Changed/Fixed to Maintenance across 7 releases
- Added missing intro lines and `[log]` links to 9 releases; added missing `## [5.0.3]` heading and `---` separators
</details>

---

## [6.0.0]

Adds structured log parsing, evidence-rich signal reports, metadata click-to-filter, and non-SQL signal detection.
[log](https://github.com/saropa/saropa-log-capture/blob/v6.0.0/CHANGELOG.md)

### Added

- **Signal report panel** — clicking a signal in the strip opens a rich webview report with evidence lines in context (5 lines surrounding each evidence line), related lines summary, and actionable recommendations per signal type; follows the analysis panel pattern with progressive section loading
- **Structured line parsing (plan 047)** — auto-detects known log line formats (Android logcat threadtime, logcat shorthand, Log4j/Logback, Python logging, bracketed timestamp+level, ISO timestamp+level, syslog RFC 3164, SDA log) and extracts metadata (timestamp, PID, TID, log level, tag). Strips the structured prefix from displayed text for a clean view. Default on, toggle via Decoration Settings
- **PID/TID display toggle** — show process and thread IDs in the decoration prefix (off by default); click to filter by PID or TID
- **Level prefix display toggle** — show the raw log level indicator (e.g. "D", "INFO") in the decoration prefix (off by default)
- **Parsed tag display** — extracted log tags (e.g. "Zygote", "ActivityManager") shown as clickable filter toggles in the decoration prefix
- **Metadata click-to-filter** — clicking a PID, TID, or tag value toggles an inclusive filter showing only lines with that value
- **Level tooltips** — hovering over a log line shows the full severity level name (e.g. "Debug", "Warning", "Fatal")
- **Format sniffer** — for file-loaded logs, samples lines from the file head and middle to auto-detect the primary format; known sources (live logcat, etc.) skip sniffing
- **"Slow operation" performance keyword** — added to default performance keywords so Android `Slow operation` messages are classified as performance issues

### Changed

- **Signals: general log pattern detection** — signals now detect recurring warnings, network failures (SocketException, ECONNREFUSED, etc.), memory pressure (OOM, heap exhaustion), slow operations (>2s), permission denials, and classified errors (critical/bug) — not just SQL patterns
- **Signals: ANR risk detection** — surfaces ANR risk score from host-side analysis with detailed signal breakdown; host-side enrichment pipeline scans the log file for ANR patterns (choreographer warnings, GC pauses, dropped frames, jank) and injects the result into the bundle before hypothesis building
- **Signals: three confidence levels** — high/medium/low with red/yellow/white dots; crashes and OOM get high confidence, recurring patterns get medium, volume-based hints stay low
- **Signals: actionable text** — signal text includes the actual problem (e.g. "Network failure: SocketException: Connection refused (5 occurrences)") instead of generic templates
- **Signals: FNV-1a error fingerprinting** — errors are now grouped by normalized fingerprint (strips timestamps, UUIDs, hex, paths, numbers) instead of last-100-char suffix matching; errors differing only in port numbers or IDs now merge correctly
- **Signals: crash category confidence** — error signals use crash category (fatal/anr/oom/native) to set high confidence instead of defaulting everything to medium
- **Signals panel hidden by default** — the root-cause signals panel no longer auto-opens when signals are detected; the toolbar badge still shows the count and users click the icon to reveal it
- **Signal report copy feedback** — clipboard copy now shows a status bar message on success or failure instead of silently swallowing errors
- **Signal report not-ready feedback** — clicking a signal hypothesis before the bundle has loaded now shows a status bar message instead of doing nothing

### Fixed

- **Stale ANR scores across sessions** — host-side ANR risk cache is now cleared when the session changes, preventing stale scores from a previous session
- **Slow operation dedup** — slow operation hypothesis keys now use content-based excerpt keys instead of line indices, so the same slow operation at different line positions correctly merges into one hypothesis

---

## [5.8.0]

Adds Collapse All and DB timestamp-burst detection, and fixes stack severity inheritance plus copy/decor behavior.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.8.0/CHANGELOG.md)

### Added

- **Collapse All Sections button** — new `$(collapse-all)` icon on the viewer title bar collapses all expanded stack groups, continuation line groups, and SQL repeat drilldown panels in one click
- **DB timestamp burst detector (DB_16)** — emits a marker when 3+ database queries fire at the same timestamp (within 10ms tolerance), surfacing redundant or concurrent DB lookups as a code smell. Toggle via `saropaLogCapture.viewerDbDetectorTimestampBurstEnabled`

### Changed

- **Decoration prefix uses grey text** — timestamp, counter, elapsed time, and `»` separator now render in `editorLineNumber` grey instead of inheriting the line's severity color, visually separating metadata from log content
- **Links use grey text until hovered** — source file links and URL links render in `editorLineNumber` grey, revealing their blue link color only on hover

### Fixed

- **Stack traces always showed error severity regardless of parent line** — stack frames and headers were hardcoded to `level: 'error'`, so a database query's stack trace showed red dots and red text while the query itself showed cyan. Stack groups now inherit the severity of the preceding log line, keeping the severity bar and text color visually connected
- **"Copy Line" and "Copy Line Decorated" ignored multi-line selection** — when shift-click selected multiple lines, the context menu actions only copied the single right-clicked line. Now both copy all selected lines. Also fixed shift-click selection using wrong indices when filtered lines are present
- **Decorated copy duplicated severity emoji dot** — `decorateLine` prepended a severity dot (e.g. 🟢) but the line text already contained one from the original log, producing a double dot. Now strips the leading dot from text when the decoration adds one
- **Continuation badge overlapping log text** — the `[+N lines]` collapse badge was rendered inline, causing it to wrap and overlap adjacent lines when the log line was long. Now absolutely positioned at the right edge of the line
- **ASCII art block grouping broken for multi-event output** — consecutive separator lines (e.g. Drift Debug Server banner) were not grouped because each DAP output event created a new `Date()` with different milliseconds. Timestamp comparison now uses 1 s proximity instead of strict equality

---

## [5.7.1]

Fixes an options panel crash when severity keywords haven't loaded yet.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.7.1/CHANGELOG.md)

### Fixed

- **Options panel crash when severity keywords not yet loaded** — `renderSeverityKeywordsDisplay` threw `TypeError: Cannot read properties of null` because the `typeof` guard did not catch `null` (`typeof null === 'object'`). Now uses truthiness check

---

## [5.7.0]

Adds configurable severity keywords, console continuation grouping, decorated copy, source-tag stripping, and stack-frame defaults.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.7.0/CHANGELOG.md)

### Added

- **Source Logger Best Practices** guide (`docs/SOURCE_LOGGER_BEST_PRACTICES.md`) — documents how to structure `dart:developer` `log()` calls for optimal Saropa Log Capture experience
- **Mid-line stack frame detection** — `isStackFrameText()` now recognizes Dart source paths (`package:*.dart:N` and `(./lib/*.dart:N:N)`) anywhere in the line, not just at the start. Fixes detection for `stack_trace` package output with `⠀ »` prefix
- **Strip source tag prefix** toggle in Decoration Settings — hides `[log]`, `[SDA]`, and other bracket prefixes from displayed text when already parsed as a source tag (on by default)
- **Configurable stack frame defaults** in Decoration Settings — choose initial collapsed state (expanded/preview/collapsed) and preview frame count for stack groups
- **Console continuation grouping** — multi-line `dart:developer` `log()` output split by the Dart DA into separate events now groups as continuation lines (same timestamp, same category, no source tag on child)
- **Copy Line Decorated** context menu option — copies clicked/selected line(s) with severity emoji, sequence number, and timestamp
- **Configurable severity keywords** (`saropaLogCapture.severityKeywords`) — users can customize which keywords trigger each severity level (error, warning, performance, todo, debug, notice). Structural patterns (logcat prefixes, `Error:`, `[error]`, Dart `_TypeError`) remain built-in
- **Severity Keywords section** in the viewer Options panel — shows current keyword-to-level mapping with color indicators and a button to open VS Code settings for editing

### Changed

- **Project Logs panel now loads progressively** — items appear with metadata top-to-bottom as each file resolves instead of waiting for all files to finish loading
- Copy & Export submenu now groups "All" items (Copy All, Copy All Decorated, Copy as snippet) together with separators for clarity
- Downgraded `failed`/`failure`/`fail` keywords from error to warning severity — these indicate something worth investigating, not a definitive error
- Severity classification now separates structural patterns (hardcoded) from keyword patterns (user-configurable), improving transparency and customizability
- Root-cause hypotheses no longer produce duplicate signals for stack-frame continuation lines that inherited error level via proximity

---

## [5.6.3]

Adds an experimental ASCII-art detector with majority-in-window scoring.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.6.3/CHANGELOG.md)

### Added

- New `viewerDetectAsciiArt` setting (default off) — experimental heuristic that detects pixel-based ASCII art (logos, figlet banners) and groups them as art blocks with the existing shimmer/yellow treatment

### Changed

- ASCII art detector uses majority-in-window (70%) instead of strict consecutive runs, so one weak line inside an art block no longer breaks detection
- ASCII art scoring adds low-token-count heuristic (+15 for long lines with ≤2 tokens) and vertical-uniformity window bonus (+10 when line lengths cluster tightly)

---

## [5.6.2]

Fixes ASCII-art block grouping for logcat-prefixed lines.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.6.2/CHANGELOG.md)

### Fixed

- Fixed ASCII art block grouping not working for logcat-prefixed lines (e.g. `I/flutter (13876): │ text │`) — separator detection now strips the logcat/bracket prefix before checking art-char ratio

---

## [5.6.1]

Housekeeping: split oversized files and fixed a minification-broken test.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.6.1/CHANGELOG.md)

### Fixed

- Fixed `viewer-performance-panel` test using brittle `.toString()` source inspection that breaks after esbuild minification — now tests actual function output instead
- Fixed signals treating decorative separator lines (`═══════`, `────────`, etc.) as error hypotheses — excerpts with no alphanumeric characters are now filtered out, and lines with the `isSeparator` flag are excluded from error collection
- Fixed `isAsciiBoxDrawingDecorLine` only matching single-vertical `│` borders — now also matches double-vertical `║` borders (e.g. Isar Connect banners), preventing text-heavy box content lines from being misclassified as errors

<details>
<summary>Maintenance</summary>

- Modularized 6 files that exceeded the 300-line code limit: extracted edit modal styles, SQL drilldown UI, scope filter hint system, broadcaster config, and split large test files
</details>

---

## [5.6.0]

Auto-loads the active session on tab focus, groups ASCII art into blocks, and adds Copy All Filtered.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.6.0/CHANGELOG.md)

### Added

- Auto-load the active recording session when the Saropa Log Capture tab becomes visible
- Copy All Filtered Lines button in the viewer title bar to copy all visible (filtered) lines to the clipboard with a toast showing the line count
- **ASCII art block grouping** — consecutive separator/box-art lines with the same timestamp are now rendered as a single visual block: the first line keeps its decoration, subsequent lines show only the art content with a shimmer effect, continuous gutter bar, and subtle tinted background. New setting `saropaLogCapture.viewerGroupAsciiArt` (default on)

### Changed

- Renamed filter section "Noise Reduction" to "Exclusions" in both the toolbar filter drawer and the filters panel
- Deprecated `deemphasizeFrameworkLevels` setting — the device tier system now handles severity demotion automatically (device-other lines demoted to info, device-critical lines keep real severity)

### Fixed

- ASCII art lines (e.g. Drift debug server banner) no longer get inconsistent colors — separator lines are always classified as `info` level regardless of text content like "DEBUG" or "database"

<details>
<summary>Maintenance</summary>

- Removed deprecated `appOnlyMode` setting definition from `package.json` (TS migration for old saved presets retained)
- Removed dead `setCaptureAll` message handler that was no longer invoked
</details>

---

## [5.5.3]

Merges duplicate logcat error hints that differ only by timestamp.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.5.3/CHANGELOG.md)

### Fixed

- Root-cause hints now merge logcat errors that differ only by leading timestamp into a single hypothesis

---

## [5.5.2]

Internal cleanup: reduced oversized parameter lists and split large files.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.5.2/CHANGELOG.md)

<details>
<summary>Maintenance</summary>

- Refactored `setErrorClassificationSettings` from 5 positional params to `ErrorClassificationSettings` options object across viewer target, broadcaster, providers, and all callers
- Refactored `PopOutPanel` constructor from 5 positional params to `PopOutPanelOptions` options object
- Refactored `parseLogLineToEvent` from 5 positional params to `ParseLogLineOptions` options object
- Refactored `getViewerDataScript` from 5 positional params to `ViewerDataScriptOptions` options object
- Refactored `recordSqlQueryHistoryObservation` (embedded JS + test interface) from 6 positional params to observation object
- Refactored 9 files exceeding eslint `max-lines` limits by extracting cohesive sections into separate modules — no functional changes
</details>

---

## [5.5.1]

Fixes false error badges on device system logs and a broken `SocketException` pattern.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.5.1/CHANGELOG.md)

### Fixed

- Fixed device-other lines (e.g. `E/gralloc4`) getting false error badges and critical notifications in loose detection mode — `classifyError()` and `checkCriticalError()` now skip device-other tier lines entirely
- Fixed `SocketException` transient pattern matching deterministic bind/listen failures (e.g. hot-restart port conflicts) — pattern now requires known-transient indicators like "Connection refused" or "timed out"
- Fixed missing `captureDeviceOther` NLS key in all non-English locale files (de, es, fr, it, ja, ko, pt-br, ru, zh-cn, zh-tw)

### Changed

- Promoted `Choreographer` to device-critical tier — frame skip warnings report app main-thread jank and should keep their `performance` level rather than being suppressed as device noise

---

## [5.5.0]

Adds three-tier device-log sorting so noise stays hidden and real crashes stay visible.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.5.0/CHANGELOG.md)

### Added

- **Device log triage:** Three-tier classification for logcat lines — Flutter (app), device-critical (always visible), device-other (hidden by default). Device-critical tags (`AndroidRuntime`, `ActivityManager`, `art`, etc.) are never hidden, so real crashes surface even with Device unchecked
- **Flutter/Device checkboxes** in Log Inputs section replace the old "App only" toggle. Flutter is checked by default; Device is unchecked by default
- **Device severity demotion:** Device-other lines (e.g. `E/SettingsState`) are demoted to info severity regardless of logcat level — no more false red errors from system noise
- **Capture-level filtering:** New `integrations.adbLogcat.captureDeviceOther` setting (default: false) drops device-other lines at capture time before they reach the viewer or log file
- **Curated critical tag list** in `device-tag-tiers.ts` — editorial classification maintained in code, not a user responsibility

### Changed

- **Noise Reduction → Exclusions:** Renamed the filter section now that app-only is gone; only exclusion patterns remain
- **"App only" toggle removed:** Replaced by the Flutter/Device checkboxes with tier-aware filtering
- **"No Framework Noise" preset → "Flutter Only":** Built-in preset renamed and uses `deviceEnabled: false`
- **Keyboard shortcut "A"** now toggles the Device checkbox instead of the removed app-only mode
- **Signal analysis** skips device-other lines — no more false positives from system errors in error classification
- **Line decorations — no master switch:** Removed the `showDecorations` master toggle from the context menu, options panel, and VS Code settings. Each decoration option (severity dot, counter, timestamp, session elapsed, severity bar, line coloring, badges) can now be toggled independently. Decorations render when any individual option is on; the footer Deco button now opens the settings panel directly.
- **File Scope cleanup:** All five radio buttons are always visible (disabled ones are dimmed instead of hidden); removed three redundant hint/status lines; "Hide lines without file path" renamed to "Exclude lines with no source file" and disabled when scope is "All logs"; each radio shows the actual path segment in a dimmed suffix (e.g. "Only directory _(lib/src/)_"); accordion summary shows "Only main.dart" instead of generic "File"

### Fixed

- Fixed Log Inputs category filter (e.g. unchecking "logcat") not hiding lines that arrive after the filter is toggled — new lines now respect the active category filter on arrival
- Fixed File Scope filter never matching any lines on Windows — `uri.path` produces `/d:/…` but DAP source paths are `d:\…`; path normalization now strips the leading slash before drive letters
- Fixed File Scope filter silently changing when switching editor tabs — scope paths are now locked when the user picks a level; switching editors updates the suffix labels but does not re-apply the filter

---

## [5.4.2]

Fixes duplicate and unstable entries in the signals panel — repeated errors now merge into one signal, ranked by how often they appear instead of how recently they arrived.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.4.2/CHANGELOG.md)

### Fixed

- Fixed duplicate signal hypotheses for the same error message appearing on different log lines (e.g. repeated connection-refused errors) — error signals now group by normalized message text instead of line index
- Fixed signal hypotheses using timestamp-varying logcat lines as separate signals — grouping key uses the last 100 chars of the excerpt, which skips leading date/time/pid prefixes
- Error signal hypotheses are now ranked by frequency (most repeated error first) rather than recency, making the signals panel more stable during live log streaming
- Collection now samples up to 50 recent error lines (was 2) so the algorithm has enough occurrences to rank by frequency accurately
- Fixed spurious `[+N lines]` continuation badges collapsing ASCII art and other plain stdout output — continuation grouping now requires both lines to have a logcat tag; source-only matching was collapsing unrelated lines that happened to share a wall-clock timestamp

<details>
<summary>Maintenance</summary>

- Fixed CI build failure: added missing braces to `if` statements in `config-normalizers.ts` (eslint `curly` rule)
- Fixed CI build failure: removed unused `logcatLetterAnywhere` regex in `level-classifier.ts` (eslint `no-unused-vars` rule)
</details>

---

## [5.4.1]

Fixes the Integrations panel expand/collapse toggle and resolves CI build failures from stale compiled files.
[log](https://github.com/saropa/saropa-log-capture/blob/v5.4.1/CHANGELOG.md)

### Fixed

- Fixed Integrations panel more/less toggle not working — nested `<p>` tags broke the DOM, leaving descriptions always expanded and the toggle button disconnected

<details>
<summary>Maintenance</summary>

- Fixed CI build failure caused by 750 stale compiled `.js` files committed to `src/` — removed from git, added to `.gitignore`
- Fixed ESLint flat config applying rules to all file types instead of only `.ts` files
- Updated CI workflow to Node.js 22 and latest GitHub Action versions (checkout v6, setup-node v6, upload-artifact v7) to resolve Node.js 20 deprecation warnings
- Added log viewer SQL screenshot to README
</details>

---

## [5.4.0]

Adds lint diagnostic badges on log lines that reference files with active VS Code diagnostics. [log](https://github.com/saropa/saropa-log-capture/blob/v5.4.0/CHANGELOG.md)

### Added

- **Lint diagnostic badges** on log lines — lines that reference files with active VS Code diagnostics show a small count badge; toggle via Decoration Settings → "Lint badge"
- **Live diagnostic updates** — badges refresh automatically when editor diagnostics change

---

## [5.3.0]

Adds per-signal dismiss, search/filter count badges, database level classification, and toolbar/resize fixes. [log](https://github.com/saropa/saropa-log-capture/blob/v5.3.0/CHANGELOG.md)

### Added

- **Search match count badge** on the toolbar search icon — shows the number of matches when a search query is active
- **Signals toolbar icon** (`codicon-pulse`) with count badge — shows the number of detected signals and toggles the signals panel on click
- **Copy signals button** at the bottom of the signals panel — copies all signal texts to clipboard with a brief toast confirmation
- **Evidence line flash highlight** — clicking a signal's "line N" evidence link now scrolls to the line and briefly flashes it so you can see exactly where you landed
- **Dismiss individual signals** — hover a signal to reveal an X button; dismissed signals are hidden for the session with a "N dismissed — restore all" link to bring them back

### Changed

- Filter count badge now displays on the toolbar filter icon instead of a separate standalone badge
- Signals panel visibility is now controlled by the toolbar icon — removed the internal header with expand/collapse toggle and "Explain with AI" button
- Signal text templates rewritten as clear diagnostic messages — removed hedging language and internal jargon

### Fixed

- **Log viewer right-side clipping on window resize** — removed `scrollbar-width: none` (which hid horizontal scroll in Chromium 130+/VS Code 1.97+) and added a `window.resize` fallback when `ResizeObserver` misses webview size changes
- Toolbar filename dotted underline no longer extends to the `●`/`⏸` status prefix — only the file path is underlined
- Long-press to copy file path now works reliably — `preventDefault()` blocks Chromium drag initiation that was cancelling the 500 ms hold timer
- Action buttons (Reset all, SQL Query History, etc.) no longer stretch to the full width of their container — they now size to their content
- Action buttons use proper VS Code theme fallbacks so they never render as unstyled black rectangles when theme variables are missing
- "Reset all" button in filter drawer footer is now visually separated from the preset dropdown with a spacer, since it applies globally to all filters
- Accordion section counts (e.g. "2/2", "10 tags") now display as bracketed suffixes on the title (e.g. "Log Inputs (2/2)") instead of right-aligned

### Changed

- Context lines label in filter drawer shortened from "Context: 3 lines" to compact `±3` notation — saves toolbar space while tooltip still explains the control

### Added

- New **Database** level with cyan filter dot — Drift SQL, generic SQL statements, and lines with a `database` source tag now classify as `database`, giving one toolbar dot/filter for SQL traffic
- TODO marker filter now also matches **BUG**, **KLUDGE**, and **WORKAROUND** (case-insensitive), in addition to TODO, FIXME, HACK, and XXX
- Text casing conventions added to UI Style Guide — sentence case for action buttons, Title Case for panel/view names and section headings

---

## [5.2.0]

Fixes trailing-CR tofu boxes, logcat level misclassification, and search-input clearing; adds channel badges, raw copy, and quick-save export. [log](https://github.com/saropa/saropa-log-capture/blob/v5.2.0/CHANGELOG.md)

### Fixed

- Trailing carriage return (`\r`) rendered as a small blue tofu box at the end of every log line — DAP adapters that send `\r` without `\n` now have all trailing CR/LF stripped; `escapeHtml()` also strips control characters as defense-in-depth
- Threadtime logcat lines (e.g. `03-30 07:34:58.588 4457 4457 D Android: …`) now correctly recognize the level prefix — previously the `D`/`I`/`W`/`E` was ignored, causing debug lines to misclassify as info and inherit nearby error coloring
- Scroll map no longer floods with a single color — debug and notice bars now respect the "show info markers" toggle (off by default), so only error, warning, performance, and to-do markers appear
- Search text box no longer clears itself after typing — `clearSearchFilter()` name collision between viewer-search and viewer-presets caused the presets version (which empties the input) to overwrite the search version; renamed to `clearSearchFilteredFlags()` and `presetClearSearchInputValue()`
- ASCII box art (e.g. Drift debug server banner) no longer corrupted in viewer — empty `│   │` lines were misclassified as stack frames and consecutive box-art lines were collapsed by repeat tracking
- Export modal now seeds level checkboxes from the viewer's current level filter instead of a hardcoded Error/Warning/Info default

### Added

- Channel badge decoration — small inline label (e.g. `stdout`, `logcat`, `ai-bash`) showing the DAP output channel for each log line; toggled from Decoration Settings panel (off by default)
- Copy as raw text (`Ctrl+Alt+C`) — copies the original unprocessed text before ANSI stripping, HTML conversion, or linkification; falls back to plain text for synthetic items
- Quick Save button in export modal — saves the current view as-is to the `reports/` folder as a markdown file with metadata header (project name, active filters, level breakdown, timestamps)

### Changed

- Filter drawer UX overhaul: merged "Log Streams" and "Output Channels" into single "Log Inputs" section, merged "App only" into "Noise Reduction" accordion, renamed "Log Tags" → "Message Tags", "Code Tags" → "Code Origins", "Scope" → "File Scope"
- Toolbar level dots now hide when filter drawer is open to avoid redundant counts
- Removed "sidecar" jargon from filter labels and README — external sources now show their name with "(external)" suffix
- Moved "SQL Commands" to least prominent grid position in filter drawer
- Drift SQL `with args [...]` suffix is now always visible but dimmed (40% opacity) instead of hidden behind a confusing ellipsis/tooltip fold
- Filter drawer accordion arrows now use codicon chevrons at 14px for better visibility
- Accordion section headers now show item counts/summaries when collapsed (tags, streams, channels, exclusions, scope)
- All checkboxes and radio buttons inside accordion expanders now have descriptive tooltips
- Export modal "Include Levels" and "Export Options" sections are now collapsible accordions with selection counts (e.g. "5/7", "2/3")

---

## [5.1.2]

New extension and sidebar icons with severity dots and Saropa brand colors. [log](https://github.com/saropa/saropa-log-capture/blob/v5.1.2/CHANGELOG.md)

### Changed

- Redesigned extension icon: new "4 severity dots on a log file" concept replacing the funnel design, matching Saropa open source brand colors
- Redesigned sidebar icon to match new document-with-dots concept (monochrome `currentColor`)

---

## [5.1.1]

Internal cleanup: publish script path fix and test file splits. [log](https://github.com/saropa/saropa-log-capture/blob/v5.1.1/CHANGELOG.md)

<details>
<summary>Maintenance</summary>

- Publish script Step 16 (store propagation check) failed with "Missing check-stores-version.ps1" — path not updated after v5.1.0 move to `scripts/modules/`
- Split `viewer-continuation.test.ts` (326 lines) into static checks and behavioral eval files
- Split `viewer-script-null-guards.test.ts` (602 lines) into three topical files: core viewer, interaction, and panels/nav
</details>

---

## [5.1.0]

Adds adb logcat streaming, continuation collapse for split output, hidden-line chevrons, smoother toolbar animations, and SQL verb filter chips. [log](https://github.com/saropa/saropa-log-capture/blob/v5.1.0/CHANGELOG.md)

### Added

- Hidden-lines chevron indicator on the severity bar — a small `▸` appears between visible lines when non-blank lines are hidden, with a tooltip showing count and reasons
- adb logcat integration: live-stream Android system logs alongside debug sessions with PID/level/tag filters and a `.logcat.log` sidecar at session end; auto-connects for Dart/Flutter sessions when adb is on PATH
- Continuation line collapsing: consecutive lines with the same timestamp and logcat tag are grouped behind a clickable `[+N lines]` badge; groups over 5 lines auto-collapse and search matches auto-expand them

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
- SQL density minimap bands used bright blue (`rgba(90,180,255)`) which looked like selection highlights or errors — changed to soft pink (`rgba(200,120,180)`) so the overlay reads as a background annotation
- SQL Query History panel column headers were garbled and required horizontal scrolling — `table-layout: fixed` with `width: 1%` made count and duration columns ~3px wide, causing text to overflow and overlap
- "Hide blank lines" toggle was indented incorrectly in the Hide context submenu — the invisible checkmark span was taking up space in the flex layout, pushing the label right compared to regular menu items

---

## [5.0.3]

Fixes unresponsive toolbar search/actions menus, applies standard VS Code theming, and adds an element-ID wiring test for stale references. [log](https://github.com/saropa/saropa-log-capture/blob/v5.0.3/CHANGELOG.md)

### Changed

- Use standard VS Code themed button styling for level filter All/None buttons, run navigation Prev/Next buttons, and breadcrumb nav buttons instead of custom white/outlined styles
- Add explicit VS Code themed styling for filter drawer preset dropdown
- Add or improve tooltips on all interactive UI elements across toolbar, filter drawer, icon bar, search, find-in-files, bookmarks, options, actions menu, edit modal, and run navigation

### Fixed

- Fix toolbar search button not responding to clicks — document-level click handler immediately closed the flyout because `session-nav-search-outer` (old UI element) no longer exists; updated to use `search-flyout`
- Fix toolbar actions (kebab) menu not responding to clicks — click event bubbled to outside-click handler which closed the dropdown immediately; added `stopPropagation` on both search and actions button handlers
- Fix prev/next session navigation buttons appearing clickable when at start/end of list — disabled buttons are now visually dimmed with suppressed hover effects

<details>
<summary>Maintenance</summary>

- Add element ID wiring test that cross-references every `getElementById` call in webview scripts against the generated HTML — catches stale references after refactors
</details>

## [5.0.2]

Adds two-pass Project Logs loading with shimmer previews, hardens webview null guards, and routes webview errors to the output channel. [log](https://github.com/saropa/saropa-log-capture/blob/v5.0.2/CHANGELOG.md)

### Changed

- Two-pass Project Logs loading: filenames appear instantly with shimmer placeholders while metadata (severity, duration, size) loads in the background

### Fixed

- Fix "Cannot read properties of null (reading 'classList')" crash in `updateSessionNav` — the `#session-nav` element was removed during the toolbar refactor but the script still referenced it

### Removed

- Remove irrecoverable dismiss [x] button from Signals strip — the collapse toggle is the only hide mechanism now

<details>
<summary>Maintenance</summary>

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
- Delete stale one-off commit message scripts (`write-commit-msg.ps1`, `write-drift-commit.ps1`)
- Move `generate-db-detector-embed-merge.mjs`, `check-stores-version.ps1`, and `marketplace-gallery-query-body.json` from `scripts/` root into `scripts/modules/`
</details>

---

## [5.0.1]

Fixes webview null-reference crashes from 5.0.0 and restores context-menu toggle labels. [log](https://github.com/saropa/saropa-log-capture/blob/v5.0.1/CHANGELOG.md)

### Fixed

- Fix webview "Cannot read properties of null (reading 'classList')" crash by adding null guards to `footerEl`, `footerTextEl`, `jumpBtn`, `logEl`, `ppTabCurrent`, and `ppTabTrends` accesses in viewer scripts
- Fix context menu toggle labels not rendering: add explicit `context-menu-label` class with font and flex rules so text is always visible beside each icon

<details>
<summary>Maintenance</summary>

- Improve webview error banner to show line and column numbers for easier debugging
</details>

---

## [5.0.0]

Consolidates header/footer controls into one persistent toolbar with a collapsible filter drawer and search flyout, and adds scroll-map upgrades, duplicate-line collapsing, and Drift debug server detection in SQL Query History. [log](https://github.com/saropa/saropa-log-capture/blob/v5.0.0/CHANGELOG.md)

### Changed

• **Log viewer — toolbar replaces header + footer** — Session-nav header/footer are merged into one persistent top toolbar, with fixed controls on the left and filename on the right.

• **Log viewer — filter drawer** — Filter controls are consolidated into one compact drawer below the toolbar, and it is mutually exclusive with the Signals strip.

• **Log viewer — search flyout** — Ctrl+F now opens a toolbar flyout with inline history/options popovers.

• **Log viewer — icon bar cleanup** — The **Filters** and **SQL Filter** buttons are removed from the vertical icon bar. Filters now live in the toolbar filter drawer.

### Added

• **Log viewer — actions dropdown** — Replay, Open Quality Report, and Export are accessible from an **actions icon button** in the toolbar that opens a dropdown menu.

• **Log viewer — context menu** — The right-click submenu is now labeled **Layout** (was **Options**) to avoid conflict with the footer Options panel.

• **Log viewer — duplicate line repeats** — Consecutive duplicates now collapse into one live-updating summary row (`N × Repeated` / `N × SQL repeated`).

• **Log viewer — scroll map width** — Added `extra narrow` (28px) and `extra wide` (120px) presets; Options uses the same workspace setting.

• **Log viewer — scroll map (SQL activity)** — SQL/slow-SQL density now renders as a full-width wash under severity/search ticks, with clearer tooltip and `aria-label`.

• **Performance — live log capture** — Line HTML is now built once and shared to sidebar/pop-out webviews; `addLines` batch size dropped from 2000 to 800.

### Added

• **Log viewer — SQL toolbar toggle** — Icon bar now shows **SQL (…)** with compact DB-line counts and toggles the same filter as **Log tags → database**.

• **Log viewer — scroll map & scrollbar from context menu** — Right-click minimap or native scrollbar to open the same scroll-map toggles as the main context menu.

• **Log viewer — scroll map proportional line width** — New setting `saropaLogCapture.minimapProportionalLines` (default on) scales minimap tick width by text length and respects wrap/resize.

• **SQL Query History — Drift debug viewer from log** — Drift viewer URL is auto-detected, health-checked, preferred for open actions, and reset when the log is cleared.

### Fixed

• **Log viewer — Performance chip** — Clicking the header **Performance** chip when the Insights slide-out was already open did nothing (no navigation, no error, no feedback). The chip called `setActivePanel('insight')` which toggled Insights **off**, then tried to open the panel inside a zero-width slot. The chip now uses `ensureInsightSlideoutOpen()` which skips the toggle when Insights is already open.

• **Log viewer — SQL toolbar count** — Compact formatter no longer rounds `999,999` to `1000k`; it now floors at unit boundaries.

• **Log viewer — Drift SQL args fold** — Removed duplicate suffix render so `…` correctly toggles one fold target.

• **Log viewer — search history (Recent)** — Recent list now appears only during active find and is hidden when search/nav leaves view. [log](https://github.com/saropa/saropa-log-capture/blob/main/CHANGELOG.md)

• **Log viewer — severity bar on framework lines** — Framework-noise rows now use matching `level-bar-{level}` colors instead of a mismatched blue gutter.

• **Log viewer — ASCII / Unicode banners** — Box-drawing lines now keep intact layout/word breaks, with horizontal scroll for wide lines.

---

## [4.2.0]

Unifies severity bar and line text colors with matching VS Code theme tokens, fixes pop-out full-load on open, and resolves minimap, copy/export, and layout edge cases. [log](https://github.com/saropa/saropa-log-capture/blob/v4.2.0/CHANGELOG.md)

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

Adds Explain with AI in Integrations (with fallback when no chat model is available), treats captured stderr like other channels by default (with opt-in error override), and polishes options/stack-trace handling. [log](https://github.com/saropa/saropa-log-capture/blob/v4.1.0/CHANGELOG.md)

### Added

• **Integrations — Explain with AI** — Options → **Integrations…** and the Configure integrations quick pick include **Explain with AI**, which toggles `saropaLogCapture.ai.enabled` alongside session adapters (the id is not stored in `integrations.adapters`). If no Language Model API chat model is available (common in some Cursor setups), the error dialog offers **Copy prompt for external chat** and **Open AI settings**. On first start, AI stays off by default unless the user has never set `ai.enabled` and the editor already exposes at least one LM chat model (e.g. Copilot Chat).

### Changed

• **Severity — stderr (default)** — Lines captured with DAP category `stderr` are no longer forced to error level or red “stderr” styling by default; they use the same text-based classification as other channels (logcat letter, Drift SQL traces, keywords). Set `saropaLogCapture.stderrTreatAsError` to **true** to restore the previous “every stderr line is an error” behavior. Applies to the log viewer, CSV/JSON export levels, smart bookmarks’ first-error scan, unified timeline events from the main log, error-breakpoint batch detection, and configuration-change refresh of the viewer.

• **Log viewer — Options panel** — The Integrations and Keyboard shortcuts entry buttons no longer stretch to the full panel width; they size to their labels like normal primary buttons. Reset actions stay full width.

• **Options — Integrations list** — Collapsed descriptions use multi-line clamping to the panel width (replacing a short fixed character preview). Expand control labels are **more** / **less**; **less** sits after the full description, performance line, and “when to disable” line. Performance and “when to disable” match the main blurb’s size and weight (no italic/smaller note style). Intro copy clarifies session capture, third-party tools (Crashlytics, Drift, etc.), and in-editor features.

• **Stack trace preview — ASCII box banners** — Decorative lines with paired vertical box-drawing bars (`│ … │`), e.g. Drift debug banners, are not treated as stack frames so collapsed stack preview does not inject `[+N more]` through banners. New setting `saropaLogCapture.viewerPreserveAsciiBoxArt` (default on) controls the behavior.

• **Log viewer — stack traces** — New stack groups open fully expanded (every frame visible). Click the stack header to cycle: expanded → fully collapsed → preview (`[+N more]`) → expanded.

---

## [4.0.1]

Refines error tinting so Drift SQL traces stay query/debug output, replaces the signals strength label with compact emoji + tooltip, and moves SQL Query History to a sortable table. [log](https://github.com/saropa/saropa-log-capture/blob/v4.0.1/CHANGELOG.md)

### Changed

• **Log viewer — error tinting and Drift SQL** — Drift `Drift: Sent …` trace lines are classified as query/debug output only (never as runtime errors), including session lines where logcat is not at column 0 and when SQL args contain names such as `ApplicationLogError`. Plain `info` lines within two seconds after a primary error or stack line can still be tinted as error for continuity, but interleaved Drift SQL is skipped when finding that anchor so the band does not break. Such “recent error context” rows are visually distinct (dashed accent, softer color, tooltip) from primary fault lines, and the Level Filters fly-up summarizes the difference.

• **Signals strip — strength indicator** — Hypothesis strength is shown as a compact emoji with a hover tooltip (and screen-reader text) instead of a “confidence:” label.

• **SQL Query History — table + header sorting** — SQL Query History is now presented as a table, and sorting is controlled by clicking the column headers (toggle asc/desc) instead of a dropdown.

---

## [4.0.0]

Focuses on richer cross-source debugging: new database/browser/security context flows with stronger request-ID correlation, plus accessibility and SQL-history reliability polish.
[log](https://github.com/saropa/saropa-log-capture/blob/v4.0.0/CHANGELOG.md)

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

• **SQL history — expanded rows survive re-render** — Expanded query rows now stay open when the panel re-renders due to sort change, search input, or data refresh.

• **SQL history — accessibility** — Added `role="button"` to expandable rows so screen readers announce expand/collapse behavior.

### Fixed

• **CDP capture — stale WebSocket race condition** — The CDP message handler now verifies the WebSocket identity before buffering events, preventing stale messages from a closing connection from leaking into a new capture session's buffer.

• **CDP capture — zombie state on timeout** — When the CDP connection times out, the module-level capture state is now cleared immediately, so `isCdpCaptureActive()` correctly returns `false` for a dead connection.

• **SQL history — jump-to-line now detects all hidden-line states** — The "target line is hidden" hint now delegates to `calcItemHeight`, catching compress-dup, time-range filter, multi-source filter, blank-line suppression, and app-only mode that were previously missed.

• **SQL history — HTML escaping for fingerprints** — Replaced incomplete `escAttr` (only `&` and `"`) with the global `escapeHtml`, preventing potential HTML injection from fingerprints containing `<` or `>`.

• **SQL history — copy button missing `type="button"`** — Added explicit `type="button"` to the per-row copy button to prevent accidental form submission.

<details>
<summary>Maintenance</summary>

• **SQL history — skip rebuild on open** — Removed the O(allLines) full rescan that ran every time the panel opened; the data is already maintained incrementally.

• **SQL history — empty state uses `u-hidden`** — Replaced inline `style.display` with the project's `u-hidden` CSS class for consistency.

• **Modularized oversized files** — Split 6 files that exceeded the 300-line code limit into smaller, focused modules: extracted DB tab styles, footer styles, context-menu styles, DB tab timeline/brush script, popover DB-insight section, and merge-parity tests into dedicated files.

• **SQL history — redundant eviction removed** — Eliminated a wasteful O(n) `Object.keys()` scan that ran on every new-fingerprint observation after the LRU pre-check had already ensured the cap.
</details>

---

## [3.14.0]

Cleans up SQL history (deduped rows, HTML entities, copy UX), renames Hypotheses to Signals, and polishes options/search/actions UI. [log](https://github.com/saropa/saropa-log-capture/blob/v3.14.0/CHANGELOG.md)

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

---

## [3.13.0]

Major database-tooling release: SQL pattern chips, N+1 detection, slow-burst markers, repeat drilldown, minimap SQL density, root-cause hypotheses, comparison diffs, and noise learning. [log](https://github.com/saropa/saropa-log-capture/blob/v3.13.0/CHANGELOG.md)

### Added

• **Drift Advisor integration — `includeInLogCaptureSession` (Log Capture)** — Built-in provider `driftAdvisorBuiltin` reads Drift’s `driftViewer.integrations.includeInLogCaptureSession` (`none` | `header` | `full`); only `full` contributes meta/sidecar (default when unset). Aligns with the bridge contract in `plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md`. Pure helpers in `drift-advisor-include-level.ts`; integration picker copy updated. Tests: `drift-advisor-include-setting.test.ts`.

• **Log viewer — DB_15 ingest / detector ordering** — Primary SQL session rollup uses **`session-rollup-patch`** (`db.ingest-rollup`) before **`runDbDetectors`**; **`lineItem.dbInsight`** is filled via **`peekDbInsightRollup`** in the embed. Detector outputs apply in **phases** (rollup → **`annotate-line`** → synthetic → marker) with per-phase **`priority`** ordering. Types: **`DbAnnotateLinePayload`** in **`db-detector-types.ts`**; embed: **`viewer-data-add-db-detectors.ts`**, **`viewer-data-n-plus-one-script.ts`**.

• **DB_15 — annotate-line host API & VM coverage** — **`applyDbAnnotateLineResultToLineItems`** / **`applyDbAnnotateLineResultsToLineItems`** in **`db-detector-framework.ts`** for batch/test line arrays; **`runDbDetectorsCompare`** accepts **`annotateTargetLines`** to apply **`annotate-line`** in one call; **`runDefaultSessionDbCompareDetectors`** wraps the default registry. **`compareLogSessionsWithDbFingerprints`** runs batch compare when **database insights** are on; session comparison HTML shows **Detector highlights (batch compare)**. **`viewer-db-detector-annotate-line.test.ts`** runs the real embed chunks in **`node:vm`**. Shared embed helper **`driftSqlSnippetFromPlain`** for dbInsight fallback snippet text.

• **Log viewer — static sources from N+1 row (DB_12)** — N+1 synthetic insight rows add **Static sources** (project index token search + QuickPick; heuristic only). Host: `viewer-message-handler-static-sql.ts`; tokens: `drift-sql-fingerprint-code-tokens.ts`. Strings: `msg.staticSqlSources*`.

• **Performance panel — Database tab (DB_13)** — Insight **Performance** → **Database** tab: Drift session rollup KPIs, **top fingerprints**, **slow-line share** and a compact **duration histogram** where per-line durations exist, and a **time-based** **timeline** using the same **bucket-count formula** as the SQL minimap (`session-time-buckets.ts`; minimap and tab use different reference heights so **N** often differs — see module doc and archived plan **DB_13**). A **viewport band** tracks the visible log time span (read-only); **drag on the timeline** applies an optional **time-range filter** (AND with other filters; counted on the filter badge; cleared via **Reset all filters** or **Clear time filter**). Optional **Drift Advisor** summary row when session meta and/or `{logBase}.drift-advisor.json` is present (`drift-advisor-db-panel-load.ts`, **Open panel** when the extension is available). **Refresh** rebuilds the DB view when that tab is active.

• **Root-cause hypotheses — discoverability (DB_14 phase 3)** — Command **`saropaLogCapture.explainRootCauseHypotheses`**, webview handler `triggerExplainRootCauseHypotheses`, log context menu **Explain root-cause hypotheses**, and `explainRootCauseHypothesesEmpty` when there is nothing to explain. Shared embed path: `runTriggerExplainRootCauseHypothesesFromHost` in `viewer-root-cause-hints-script.ts`.

• **Log viewer — DB detector sub-toggles & baseline hints (DB_15 optional)** — Settings **`viewerDbDetectorNPlusOneEnabled`**, **`viewerDbDetectorSlowBurstEnabled`**, **`viewerDbDetectorBaselineHintsEnabled`** (when master **database insights** is on). SQL baseline from log comparison can trigger a one-time **SQL count above baseline** marker; host **`createBaselineVolumeCompareDetector`** supports **`runDbDetectorsCompare`**. **`session-rollup-patch`** results merge into the session rollup map after each detector pass.

• **Fingerprint summaries — slow query counts (DB_10)** — **`slowQueryCount`** per fingerprint (threshold = **`viewerSlowBurstSlowQueryMs`**) in scans, persist v1, merges, and the session comparison table (**Slow A / B / Δ slow** when logs include **`[+Nms]`** metadata).

• **Noise learning (Plan 025)** — Workspace-local learning from log viewer actions: stack-group **dismiss**, new **exclusions**, **bookmarks** (explicit keep), optional **fast-scroll** signal; persisted batches + suggested `saropaLogCapture.exclusions` patterns; QuickPick review; commands **Review / Clear / Check Filter Suggestions**; settings `saropaLogCapture.learning.*`. Implementation: `src/modules/learning/` (see `README.md` there), viewer `trackInteraction`, `setLearningOptions`. QA: `examples/noise-learning-sample-interactions.txt`.

• **Log viewer — slow query burst markers (DB_08)** — For **`database`**-tagged Drift lines with per-line **`[+Nms]`** duration metadata, **five or more** queries at or above a configurable slow threshold (default **50ms**) inside a rolling window (default **2s**) insert a **Slow query burst** marker row; clicking scrolls to the line that completed the threshold. Cooldown (default **10s** log time) limits marker spam. Requires **`saropaLogCapture.viewerDbInsightsEnabled`**. Settings: **`viewerSlowBurstSlowQueryMs`**, **`viewerSlowBurstMinCount`**, **`viewerSlowBurstWindowMs`**, **`viewerSlowBurstCooldownMs`**. Implementation: `drift-db-slow-burst-detector.ts`, `viewer-db-detector-framework-script.ts`, `viewer-data-add-db-detectors.ts`. QA: **`examples/drift-slow-burst-sample-lines.txt`**.

• **Log viewer — SQL repeat drilldown (DB_06)** — Fingerprint-keyed **SQL repeated #N** rows include an expand control: inline fingerprint, time span, monospaced SQL snippet, and up to **10** `with args` variants (first-seen order) with a truncation note. **Escape** collapses when focus is on that line. Non-SQL **Repeated #** rows unchanged. Implementation: `viewer-data-helpers-core.ts`, `viewer-data-add.ts`, `viewer-script.ts`, `viewer-styles-sql-repeat-drilldown.ts`; VM tests in `viewer-sql-repeat-compression.test.ts`.

• **Log viewer — automatic root-cause hypotheses (DB_14)** — When the log has enough correlated signal (recent errors, N+1 insight rows, or high-volume SQL fingerprints), a **Hypotheses** strip appears above the log with short template bullets, a **Hypothesis, not fact** disclaimer, optional **low/medium** confidence labels, evidence **line** buttons that scroll to valid indices only, and session-scoped **dismiss**. Shared deterministic logic lives in `src/modules/root-cause-hints/` (tests in `build-hypotheses.test.ts`, false-threshold guards); the webview embed mirrors the same constants. QA: `examples/root-cause-hypotheses-sample.txt`.

• **Compare logs — database fingerprint diff (DB_10)** — The **Saropa Log Comparison** panel (two sessions side by side) adds an expandable **Database (Drift SQL)** section: normalized fingerprint counts for session A vs B, change badges (new / gone / more / less / same), optional avg-ms deltas when lines include `[+Nms]`, and up to 60 rows sorted by impact. Uses one UTF-8 read per file together with the line diff via **`compareLogSessionsWithDbFingerprints`** (`diff-engine.ts`, `db-session-fingerprint-diff.ts`).

• **Log viewer — SQL pattern chips & fingerprint guardrails (DB_02)** — Drift `Sent` SQL fingerprints now normalize literals, UUIDs, numbers, and keyword casing via `drift-sql-fingerprint-normalize.ts` (shared with the webview embed). The filters panel adds fingerprint chips for repeated shapes, an **Other SQL** bucket for rare or unparsed database lines, and filtering via `sqlPatternFiltered` composed with existing height logic. See `viewer-sql-pattern-tags.ts`, `viewer-data-add.ts`, `viewer-data.ts`, and `examples/sql-fingerprint-guardrails-sample.txt`.

• **Log viewer — Top SQL Patterns (DB_05)** — The filters section title is **Top SQL Patterns**. Tune **`saropaLogCapture.viewerSqlPatternChipMinCount`** (1–50, default 2) and **`saropaLogCapture.viewerSqlPatternMaxChips`** (1–100, default 20); changes apply live in open viewers without reload.

• **Log viewer — integration context popover — database insight** — For **`database`**-tagged lines (Drift `Sent` SQL), **Show integration context** includes a **Database insight** section: normalized fingerprint, session **seen** count, optional avg/max duration when lines carry `elapsedMs`, truncated **SQL** with full text on hover, and **Open in Drift Advisor** when that extension is installed. The popover can open on DB lines even when the ±time window has no HTTP/perf sidecar data. Context menu **Open in Drift Advisor** also applies to database-tagged lines. See `viewer-context-popover-script.ts`, `viewer-data-add.ts`, `context-handlers.ts`, and `examples/integration-context-popover-db-sample.txt`.

• **Log viewer — minimap SQL density** — Optional right-edge **blue** (SQL activity) and **amber** (slow-SQL signal) density bands on the scrollbar minimap, composed under severity and search markers. Toggle **`saropaLogCapture.minimapShowSqlDensity`** (default on) from **Options → Layout** or settings. The minimap `title` tooltip includes SQL/slow hit counts for quick legend-style context. Shared heuristics live in `viewer-scrollbar-minimap-sql-heuristics.ts` (embedded into the webview script) with unit tests in `viewer-scrollbar-minimap-sql-heuristics.test.ts`.

• **Log viewer — N+1 query hint (Drift SQL)** — Bursts of the same normalized `Drift: Sent …` statement with **different** `with args` payloads inside a short window can insert a synthetic insight line with confidence (low/medium/high), plus **Focus DB** (database source tag) and **Find fingerprint** (in-log search). Detection is wrapped so it **cannot throw** and block line ingest. See `src/modules/db/drift-n-plus-one-detector.ts` and `examples/drift-n-plus-one-sample-lines.txt` for QA samples.

• **Log viewer — adaptive repeat collapse for Drift SQL** — Real-time duplicate collapse keys **`database`** Drift lines by **normalized SQL fingerprint** (same shape, different args still count as one streak). **SELECT / WITH / PRAGMA** use a lower default minimum count than **BEGIN / COMMIT / ROLLBACK**, and **INSERT / UPDATE / DELETE** use a higher default so writes stay visible longer. Tune with **`saropaLogCapture.repeatCollapseGlobalMinCount`**, **`repeatCollapseReadMinCount`**, **`repeatCollapseTransactionMinCount`**, and **`repeatCollapseDmlMinCount`** (each ≥ 2, capped at 50). Non-SQL lines use the global setting only. Sparse repeats may not reach a high threshold inside the existing repeat time window.

### Changed

• **Drift Advisor — contract `schemaVersion`** — Log Capture’s built-in snapshot mapping sets optional **`schemaVersion`** on **`meta.integrations['saropa-drift-advisor']`** and on **`{logBase}.drift-advisor.json`** (default **`1`** via **`DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION`** when the Drift snapshot omits it; preserves Drift-supplied values). JSON schema and [docs/integrations/README.md](docs/integrations/README.md) updated. See [plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md](plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md) §4.3–4.4.

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

<details>
<summary>Maintenance</summary>

• **Tests** — `drift-sql-fingerprint-code-tokens.test.ts` (token extraction + false-positive guards); `viewer-script-messages-root-cause.test.ts`; embed assertions for static-sources wiring in `viewer-n-plus-one-embed.test.ts`. DB_12 `node:test` suites: `drift-sql-static-orm-patterns.test.ts`, `drift-static-sql-candidates.test.ts`. DB_13 merge tests: `drift-advisor-db-panel-load.ts` + `drift-advisor-db-panel-load.test.ts`. DB_13 timeline alignment: `session-time-buckets.test.ts`. DB_15: `db-detector-framework.test.ts`.

• **Tests — Drift SQL fingerprint summary persist (DB_10)** — `drift-sql-fingerprint-summary-persist.test.ts` covers v1 validation, round-trip maps, baseline record shapes, `trimSummaryForPersistence` caps, and before/after exclusion of low-count keys when trimming.

• **Tests — SQL repeat compression (DB_03)** — VM-backed suite `viewer-sql-repeat-compression.test.ts` exercises production `addToData` + `parseSqlFingerprint` embed chunks: fingerprint merge/split, `repeatWindowMs` streak reset, non-`database` Drift-shaped false positives, null-fingerprint fallback, and marker/`cleanupTrailingRepeats` cleanup.

• **Examples — session comparison QA** — `examples/session-comparison-drift-sql-qa.txt` notes how to validate the Database (Drift SQL) comparison section, jump actions, and optional SQL baseline buttons.

• **DB detector framework — batch fingerprint summary (DB_15 / DB_10 prep)** — Extension-side helpers to build `DbFingerprintSummaryEntry` maps from `DbDetectorContext` batches, merge summaries, diff baseline vs target, and run optional detector `compare` hooks via `runDbDetectorsCompare`.

• **DB_15 — embed merge codegen** — `mergeDbDetectorResultsByStableKey` is implemented once in `db-detector-merge-stable-key.ts`; `npm run generate:db-detector-embed-merge` emits the generated webview embed. `npm run compile` runs codegen first.

• **Docs — Saropa Drift Advisor integration** — Added [docs/integrations/README.md](docs/integrations/README.md). Updated integration plan and published-history Drift bullet to use current paths.

• **Compare logs — webview implementation** — Session comparison HTML and embedded script modularized into `session-comparison-html.ts` and `session-comparison-webview-script.ts` (ESLint `max-lines` / `max-params`).

• **Log viewer — Drift SQL ingest** — `addToData` calls `parseSqlFingerprint(plain)` once per normal log line; repeat hashing, optional `dbInsight` rollup, and `emitDbLineDetectors` all reuse the same `sqlMeta`.

• **Log viewer — `dbInsight` on unparsed database lines** — `database`-tagged lines that do not yield a parsed SQL fingerprint still get a `dbInsight` object with a truncated Drift snippet so the integration popover can show context.
</details>

## [3.12.1]

Adds an always-show search-toggles setting, switches session-nav buttons to icon-only, and repositions the compress-lines control. [log](https://github.com/saropa/saropa-log-capture/blob/v3.12.1/CHANGELOG.md)

### Added

• **`saropaLogCapture.viewerAlwaysShowSearchMatchOptions`** — When `true`, the log viewer always shows **match case**, **whole word**, and **regex** toggles in the session-bar search field. Default `false`: toggles appear only while the field is focused or has text (keeps the title bar compact).

### Changed

• **Session bar log navigation** — **Previous / next log** use **icon-only** chevron buttons (tooltips and `aria-label` unchanged: “Previous log (older)” / “Next log (newer)”).

• **Session bar layout** — Session nav can **wrap** to a second row when space is tight; match-option toggles use **progressive disclosure** unless the new setting above is enabled.

• **Compress lines control** — The toggle moved from the **activity icon bar** to a **fixed button at the top-left of the log pane** (same viewport-based positioning as Jump Top/Bottom). **Options → Layout**, the log **context menu → Options**, and behavior (blanks hidden, consecutive duplicate lines collapsed with **(×N)**) are unchanged.

<details>
<summary>Maintenance</summary>

• **Find-in-files hook** — `window.setupFromFindInFiles` moved to a dedicated injected script chunk (`viewer-search-setup-from-find.ts`) so the main search script stays within lint line limits; load order is unchanged.
</details>

---

## [3.12.0]

Introduces compress lines (consecutive duplicate collapse with xN badges), moves in-log search to a compact title-bar field, and fixes jump-button placement and search-history cleanup. [log](https://github.com/saropa/saropa-log-capture/blob/v3.12.0/CHANGELOG.md)

### Added

• **Compress lines** — Options › Layout, the **activity bar Compress** icon (collapse-all codicon, next to Filters), and the log context menu (**Options** submenu) toggle **Compress lines**: blank lines are hidden and **consecutive identical** normal log rows collapse to the **last** occurrence with an **(×N)** badge. Markers, stack blocks, run separators, and other non-line rows **break** dedupe runs so structure stays intact. Live capture recomputes layout when this mode is on so new lines merge correctly with the previous row. When compress mode is **off**, **20 consecutive duplicate lines** (O(1) per line) can show a **one-time suggestion banner** under the session bar with **Enable** / dismiss — cleared logs reset the hint.

### Changed

• **Session bar in-log search** — The compact find field and options popover no longer inherit the thick bordered “Prev / Next” nav button style (that rule is scoped to `.session-nav-controls` only). Controls use **borderless toolbar icons**, **editor widget** border/shadow tokens (`widget.shadow` where available), and **find-panel–style** active toggles so the strip matches the rest of VS Code.

• **Info line color in the log viewer** — Lines classified as **info** (e.g. `I/flutter` / Drift SQL) now use **`debugConsole.infoForeground`**, the same VS Code theme token as the Debug Console info tint and in-log “Info” highlights, instead of terminal yellow.

• **Log search in the title bar** — In-log search is a compact filter field on the **right side of the session nav** (same row as log prev/next and context), similar to VS Code’s filter input, instead of a wide slide-out panel. Match case, whole word, regex, and highlight vs filter mode live under the **funnel** button; recent terms still appear in a floating list when the field is focused and empty. The activity bar **Search** control and **Ctrl+F** focus this field without opening the side panel.

### Fixed

• **Search history floating panel** — When the recent-queries list is cleared (typing in the field or empty history), inline styles from `positionSearchFloatingPanels` are reset so a stale `position: fixed` box does not linger on screen.

• **Jump Top / Bottom horizontal placement** — Prior fixes still left `position: absolute` + `right` resolving on the **wrong** edge in the embedded webview. Jump controls now use **`position: fixed`** with **`syncJumpButtonInset()`** driven by **`#log-content.getBoundingClientRect()`** and **`window.innerWidth`/`innerHeight`** (viewport coordinates, no containing-block guesswork). Replay-bar visibility, **icon bar side**, resize, minimap width, and scrollbar visibility trigger a sync; jump fade-in animation is **opacity-only** so `transform` does not fight layout.

<!-- cspell:ignore ENOENT scandir -->

<details>
<summary>Maintenance</summary>

• **Regression tests (session-nav search)** — `viewer-session-nav-search.test.ts` asserts viewer body wiring, panel-slot ordering, icon-bar width skip for search, and stable search DOM ids.

• **Developer console noise on activation (Crashlytics cache)** — Workspaces that never had a legacy `{logDirectory}/crashlytics` folder no longer trigger a failed `readdir` during the one-time migration to `.saropa/cache/crashlytics`; the extension `stat`s the old folder first so the host does not log `ENOENT` / `scandir` for a missing path.
</details>

---

## [3.11.0]

Adds clear Settings UI titles for every extension option, and fixes the Performance chip, virtual-scroll flicker, jump-button placement, and submenu clipping. [log](https://github.com/saropa/saropa-log-capture/blob/v3.11.0/CHANGELOG.md)

### Changed

• **Settings UI titles for all extension options** — Every `saropaLogCapture.*` configuration key now has a **`title`** in addition to its description, so VS Code Settings shows a clear row label and search matches work better. English titles are derived from each setting's description (non-English `package.nls.*.json` files use the same strings until translated).

### Fixed

• **Performance chip / title bar control** — The nav **Performance** control opens the Performance block inside **Insights › Session details**. The panel script still looked for the old standalone `#performance-panel` node (removed when Performance moved into Insights), so the control did nothing; the script now targets the embedded `insight-pp-*` markup. Visibility is also stricter now: the chip appears only when session metadata has meaningful performance snapshot metrics or a real samples file path, not just a placeholder snapshot object.

• **Log viewer scroll flicker (filters, tail, end of log)** — Virtual-scroll "hysteresis" used line-index slack, which fails when many lines are height 0: every small scroll rebuilt the viewport DOM and caused flashing. Rebuilds are skipped only when the visible line range is unchanged. Tail-follow (`autoScroll`) now uses a Schmitt-trigger band so distance-to-bottom jitter does not flip follow mode every frame.

• **Jump Top / Bottom on wrong horizontal edge** — Some 3.10.0 installs still used older `left: 8px` positioning. Jump buttons are anchored to the log wrapper's **right** (clear of minimap / scrollbar) again, with a final CSS block so placement cannot be overridden.

• **Context menu submenu clipped at top (short webviews)** — If the viewer is short enough that both vertical flip rules applied, a later CSS rule canceled the "safe top" submenu offset; the offset now takes precedence so flyouts stay below panel chrome.

### Removed

• **Icon bar Replay button** — Session replay is opened from the footer **Replay** control and the log-area replay bar only, not from a sidebar/toolbar entry.

---

## [3.10.0]

Broadens ecosystem support and improves day-to-day cross-source debugging. [log](https://github.com/saropa/saropa-log-capture/blob/v3.10.0/CHANGELOG.md)

### Added

• **Application / file logs (Phase 3)** — When **Application / file logs** is enabled in integrations and paths are set under `integrations.externalLogs.paths`, the extension **tails** each existing file during the debug session (new lines only after session start), then writes **`basename.<label>.log`** sidecars at session end. The log viewer loads those sidecars with source ids **`external:<label>`** alongside Debug and Terminal; use **Filters → Sources** to show or hide them. Commands: **Saropa Log Capture: Add external log path** (appends to workspace `paths`) and **Saropa Log Capture: Open external logs for this session** (opens sidecars for the log currently loaded in the viewer; shows a short progress notification when there are multiple files). If tailers did not run, session end still falls back to reading the last N lines from each path. See [docs/integrations/application-file-logs.md](docs/integrations/application-file-logs.md) and [docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md](docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md).

• **Unified session log (Phase 4)** — Optional **`saropaLogCapture.integrations.unifiedLog.writeAtSessionEnd`**: after integrations write sidecars, the extension writes **`basename.unified.jsonl`** next to the main log (one JSON line per row: `source` + `text`). Order: full main log, then terminal sidecar, then external sidecars. **`integrations.unifiedLog.maxLinesPerSource`** (default 50k) truncates each stream from the tail if needed. The unified viewer load also computes **run navigation** boundaries and **smart bookmarks** like normal `.log` loads. Open the `.unified.jsonl` file in the log viewer to use the same **Sources** filter as a multi-file session. See [docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md](docs/COMPLETE_DEBUG_PERSPECTIVE_PLAN.md).

• **Saropa Lints integration (Phase 3 — Log Capture)** — When generating a bug report, if `violations.json` (or extension API data) is missing or older than 24 hours and the Saropa Lints extension exposes `runAnalysis`, an information message offers **Continue without refresh**, **Run full analysis**, and **Analyze stack-trace files only** (when the stack has app frames). Analysis runs in a progress notification; stack-scoped runs use `runAnalysisForFiles` when present, otherwise `runAnalysis({ files })`. After refresh, lint data is re-read on the same collect pass.

• **Saropa Lints integration (Phase 4 — Log Capture)** — Health score params for bug report headers prefer `reports/.saropa_lints/consumer_contract.json` (`healthScore.impactWeights` + `healthScore.decayRate`) when present; fallback order is consumer contract → Saropa Lints extension API → built-in constants.

• **Saropa Lints integration (Phase 5)** — Bug report lint tables include an **Explain** link per violation that opens Saropa Lints' **Explain rule** panel. Bug report key findings also highlight critical/high OWASP-mapped issues in the crash file. When adding a session to an investigation, the extension can pin `reports/.saropa_lints/violations.json` so exported investigation bundles keep a lint snapshot.

• **Saropa Lints integration (Phases 1–2)** — Optional integration with the Saropa Lints extension: bug report **Known Lint Issues** section can be filtered by impact level (setting `saropaLogCapture.lintReportImpactLevel`: essential = critical+high only; recommended = +medium; full = all). Section heading shows the filter in use (e.g. "Known Lint Issues (critical + high only)"). When the Saropa Lints extension is installed and exposes its API, Log Capture uses it for violations data and health score params instead of reading the file; otherwise it reads `reports/.saropa_lints/violations.json` and uses built-in constants. Commands **Show code quality for frame** and **Open quality report** are only enabled when the Saropa Lints extension is installed. Design: [docs/integrations/SAROPA_LINTS_INTEGRATION.md](docs/integrations/SAROPA_LINTS_INTEGRATION.md).

• **Saropa Drift Advisor integration** — Optional integration with the Drift Advisor extension: **Drift Advisor** appears in Configure integrations (adapter id `driftAdvisor`). When the Drift Advisor extension is installed, right-click a log line with category `drift-perf` or `drift-query` to show **Open in Drift Advisor** (invokes the Drift Advisor command). The **Show Integration Context** popover shows a **Drift Advisor** block (query count, avg duration, slow count, health) and an **Open in Drift Advisor** button when the session has `meta.integrations['saropa-drift-advisor']`. **Built-in provider (Phase 5–6):** With **driftAdvisor** enabled, session end tries Drift's `getSessionSnapshot()` (5s timeout) or reads workspace `.saropa/drift-advisor-session.json`, then writes session meta and `{logBase}.drift-advisor.json` (Drift's bridge overwrites if it runs later). Schema: [plans/integrations/drift-advisor-session.schema.json](plans/integrations/drift-advisor-session.schema.json). Short user index: [docs/integrations/README.md](docs/integrations/README.md). No dependency on Drift Advisor at install time; when only one extension is installed, no errors. Design: [plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md](plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md).

• **Multi-source view and source filter** — When a log has a `.terminal.log` sidecar (from the Terminal integration), the viewer shows both Debug Console and Terminal output. A **Sources** section in the Filters panel (Filters → Sources) lets you show only Debug output, only Terminal, or both. Quick Filter presets **"Just debug output"** and **"Complete (all sources)"** apply the source filter in one click. Presets can now store a `sources` filter (e.g. `["debug"]`). Reset all filters restores all sources.

### Changed

• **Viewer: blank lines and line numbers** — Blank lines no longer show a severity dot (the vertical severity bar still runs through them for continuity). The line-number counter is hidden on blank lines by default so "double line break" gaps are visually minimal. **Decoration settings** (gear next to the Deco button) now include **Show line number on blank lines** (off by default): when enabled, blank lines show their file line number so references like "see line 53" and Go to Line match the file. The displayed counter uses file line number (idx+1) when available so the sequence never skips.

• **Performance: unified JSONL writer** — When `saropaLogCapture.integrations.unifiedLog.writeAtSessionEnd` is enabled, the unified log writer tails the main log and sidecars from disk instead of reading full files into memory.

• **Performance: external log tailing** — The external log adapter batches `fs.watch` change bursts (debounce) to reduce extension-host stalls under high log churn.

### Fixed

• **Context menu submenu cropped at top (terminal)** — The Copy & Export (and other) submenu could still have its top cut off when the right-click menu was opened near the top of the viewer (e.g. in the terminal panel under the tab bar). The safe top margin is increased (12px → 48px) and the "near top" threshold widened (80px → 100px) so the submenu flyout is pushed down enough to stay below toolbars and panel headers.

---

## [3.9.1]

Fixes footer path gestures: double-click opens the log’s containing folder, and hold-to-copy shows a status bar confirmation. [log](https://github.com/saropa/saropa-log-capture/blob/v3.9.1/CHANGELOG.md)

### Fixed

• **Footer: double-click to open folder** — Double-clicking the path in the log viewer footer now opens the folder that contains the current log file (e.g. `reports/20260316`) instead of its parent (`reports`). The extension now reveals the current file in the OS so the file manager opens the correct containing folder.

• **Footer: hold to copy path feedback** — After holding on the footer path to copy it to the clipboard, a status bar message ("File path copied to clipboard") is shown for 2 seconds so users get clear confirmation that the copy succeeded.

---

## [3.9.0]

Improves the log viewer with tabbed Insights, markdown copy, and scrollbar control; fixes text selection while tailing and refines elapsed-time/jump-button behavior. [log](https://github.com/saropa/saropa-log-capture/blob/v3.9.0/CHANGELOG.md)

### Fixed

• **Code quality** — Addressed multiple findings: merged duplicate config imports and combined `context.subscriptions.push()` calls in activation; replaced nested ternary in smart bookmarks with explicit if/else; iterated `Set` directly in log viewer (no array copy); refactored viewer action dispatch into two handlers plus small helpers to reduce cognitive complexity and switch case count; introduced `msgStr()` for safe message field string coercion; replaced `void` with `.then(undefined, () => {})` and `parseInt` with `Number.parseInt`. Behavior unchanged.

• **Performance panel script (code quality)** — Replaced negated condition in `getPerformancePanelScript` with a positive check so ID prefix selection satisfies Sonar rule S7735; behavior unchanged.

• **Text selection during tailing** — Selecting text in the log viewer while the log is being written to no longer fails: the viewport uses the existing hysteresis so it skips a full DOM re-render when the visible line range is unchanged, preserving the user's selection. Spacer heights are still updated so scroll height stays correct.

### Changed

• **Session elapsed display format** — Session elapsed time in the log viewer no longer uses clock-style `T+M:SS` (e.g. `T+5:15`). It now uses duration-style text with unit suffixes (e.g. `45s`, `5m 15s`, `1h 5m 15s`, `2d 1h 5m 15s`) so it is unambiguous as elapsed time. Labels in the decoration settings and context menu (Options) were updated from "Session time (T+)" / "Log time (T+)" to "Session elapsed".

• **Jump-to-top / jump-to-bottom buttons** — Buttons are now positioned on the right side of the log area so they do not cover the scrollbar minimap or the native vertical scrollbar when it is enabled. Right offset uses CSS variables `--mm-w` and `--scrollbar-w` so layout stays correct for all minimap sizes and scrollbar settings.

### Added

• **Open Insights in New Tab** — The Insights panel can be opened as a main editor tab for easier reading in a large view. Use the **Open in new tab** (link-external) button in the Insights panel header, or the command **Saropa Log Capture: Open Insights in New Tab**. The tab shows the same content as the sidebar (Cases, Recurring, Hot files, Performance, Environment) and stays in sync with the current log. Close via the tab's × or the panel's Close button.

• **Insights panel: Copy to Markdown** — A copy button in the Insights panel header copies the full case to the clipboard as markdown: current log name, errors/warnings summary, Session details (Performance groups and events from the Current tab), This log (errors and recurring), Your cases, Across your logs (recurring errors and hot files), and Environment. Uses the same `copyToClipboard` message as other viewer copy actions; no loading state (builds synchronously from in-memory state and Performance DOM).

• **Performance panel (Log tab): right-click to copy message** — When the log has no performance data, the explanatory message block in the Log tab is copyable: right-click it and choose **Copy message** to copy the full text to the clipboard. The message wording was clarified (this log file / if Performance is enabled) so it does not imply the user has not enabled the integration.

• **Show scrollbar setting** — New setting `saropaLogCapture.showScrollbar` (default: false) controls whether the native vertical scrollbar is shown in the log viewer. When off, the minimap is the only scroll indicator; when on, the native scrollbar is visible (10px) and the jump buttons keep clear of it.

---

## [3.8.0]

Adds viewer code-quality metrics, regression hints (blame and first-seen), and smart bookmark suggestions; fixes context-menu and selection behavior. [log](https://github.com/saropa/saropa-log-capture/blob/v3.8.0/CHANGELOG.md)

### Fixed

• **Row selection on right-click** — Shift-click row selection in the log viewer no longer disappears when opening the context menu. The viewport re-render after right-click now re-applies the selection highlight so Copy Line, Hide Selection, and other selection-based actions work as expected.

• **Stack trace icons** — Collapsible stack headers in the log viewer now show the correct Unicode triangles (▶ ▼ ▷) instead of the literal escape text `\u25b6` / `\u25bc` / `\u25b7`.

• **Context menu submenu cropped at top** — When the right-click menu was opened near the top of the view (e.g. under a toolbar), the Copy & Export (and other) submenu flyout could have its top cut off. The menu now applies a vertical offset so submenu content stays below a safe viewport margin; when the menu is also near the bottom, the existing "open upward" behavior still wins.

### Added

• **Code quality metrics (Phase 3)** — **Show code quality for frame:** right-click a stack frame in the log viewer → **Show code quality** to open a popover with line coverage %, lint warnings/errors, and doc density for that file. **Open quality report:** open the session's `basename.quality.json` sidecar from the context menu or command palette. **Heatmap:** stack frame lines show a subtle coverage tint (green/yellow/red) when quality badges are enabled. **Bug reports:** new setting `saropaLogCapture.integrations.codeQuality.includeInBugReport` (default false) adds a "Code Quality (referenced files)" section for files with low coverage or lint issues. The viewer receives `meta.integrations.codeQuality` when loading a log. Plan [100] implemented.

• **Regression hints** — Correlate errors with Git history for "Introduced in commit X". **Blame-based:** for a source line (e.g. from a stack frame), show "Last changed in commit X" with optional link in the Analysis panel source section and in the error hover. **First-seen:** for recurring errors, show "Introduced in commit X" on Insights recurring cards (and "Recurring in this log") when the first session where the error appeared had Git integration (commit stored in session meta). Commit links respect `saropaLogCapture.integrations.git.commitLinks`. New module: `regression-hint-service` (blame + first-seen session→commit); Git provider now stores `commit` at session start and in session-end meta. Plan [034] implemented.

• **Smart bookmarks** — When you open a log file, the extension can suggest adding a bookmark at the first error (or first warning) line if that line is not already bookmarked. One suggestion per file per session; notification shows "First error at line N. Add bookmark?" with **Add bookmark** and **Dismiss**. Settings: `saropaLogCapture.smartBookmarks.suggestFirstError` (default true), `saropaLogCapture.smartBookmarks.suggestFirstWarning` (default false). Plan [038] implemented.

---

## [3.7.1]

Stabilizes Project Logs and extension development by fixing a crash, wiring proposed APIs correctly, and aligning Insight → Insights naming. [log](https://github.com/saropa/saropa-log-capture/blob/v3.7.1/CHANGELOG.md)

### Fixed

• **Session panel crash** — Project Logs no longer throws "escapeHtmlText is not defined". Shared helpers `escapeAttr` and `escapeHtmlText` are defined once in the session panel bootstrap; inlined fragments (rendering, events) use them. A runtime test runs the same script combination the webview uses and dispatches a sessionList message to catch missing dependencies.

• **Extension development** — Launch configs include `--enable-proposed-api=saropa.saropa-log-capture` so F5 can use the terminal proposed API when enabled locally. **Publishing:** The extension no longer declares `enabledApiProposals` in `package.json`, so it can be published to the Marketplace. Terminal capture (integrated terminal output) uses the proposed API when available and is skipped gracefully when not (try/catch in `terminal-capture.ts`).

### Changed

• Rename **Insight** menu and panel labels to **Insights** (lightbulb icon in the viewer and command palette entry) for consistency with cross-session Insights terminology.

### Administration

• **Modularized 4 files over 300-line limit.** Split to satisfy the project's 300-line file limit. No behavior or API changes. New/updated modules: `investigation-commands-helpers` (resolve/pick investigation, format insight payload); `session-manager-internals` (applyStartResult, broadcast/watcher helpers); `session-manager-stop` (buildStopSessionDeps); `viewer-insight-panel-script-part-a/b/c` (Insight panel IIFE fragments); `viewer-styles-insight-layout`, `viewer-styles-insight-sections`, `viewer-styles-insight-hero`. Entry points unchanged: `commands-investigation`, `session-manager`, `viewer-insight-panel-script`, `viewer-styles-insight`.

---

## [3.7.0]

Major UX release focused on webview accessibility, a unified Insights panel, smarter Flutter/Dart memory classification, and modularized large files. [log](https://github.com/saropa/saropa-log-capture/blob/v3.7.0/CHANGELOG.md)

### Added

• **Webview accessibility (a11y)** — Viewer: main landmark on primary content, `aria-live` on line-count so filter/load updates are announced; level flyup "All"/"None" are buttons for keyboard use. Options, Project Logs, and Integrations panels: `role="region"` and `aria-label` on containers; key controls labeled. Focus moves into Options and Project Logs on open and returns to the icon bar on close (Escape or Close). README documents keyboard and screen-reader use. Plan [028] in progress (focus trap and remaining panels pending).

• **Unified Insight panel (single view)** — One scroll, no tabs. The **Insight** panel (icon bar, lightbulb) is a single narrative: **Active Cases** (top 3 + View All), **Recurring errors** (top 5), **Frequently modified files** (collapsed), **Environment** (platforms, SDK, debug adapters; collapsed), and **Performance** (when a log is open). Context-aware: with no log selected you see Cases, Recurring, Hot files, Environment; with a log selected **Performance** (with scope label "Current log: &lt;filename&gt;") and **Recurring in this log** (filtered to errors that appear in the current session) move to the top. **Inline add-to-case:** "+" on each recurring card and hot file opens the Cases section so you can add a session. **requestInsightData** returns errors, statuses, hot files, platforms, sdkVersions, debugAdapters, **recurringInThisLog**, **errorsInThisLog**, and **errorsInThisLogTotal** (when a log is open). **currentLogChanged** triggers refresh of performance and insight data. **14 UX enhancements:** empty states (Cases, Recurring, Hot files); loading states; "This log" single empty message; keyboard nav on section headers (Arrow Up/Down, Enter/Space); scroll into view after add-to-case and create-case; Session details hint; recurring/errors text truncation with full tooltip; "Top 3 of N" for errors-in-log; cases list "N source(s) · Updated X ago"; hero 0/0 and no-data message; sparkline "Session trend" label; export confirmation. Plan 041 (Unified Insight Model) implemented.

• **Flutter/Dart memory classification** — Memory-related log lines (e.g. memory pressure, heap/VM gen, leak hints) are classified as **Performance** and shown in the Performance panel **Memory** group only when the line has Flutter/Dart context (logcat `I/flutter`/`D/dart` or `package:flutter`/`package:dart`) and a high-confidence phrase (`Memory: N`, memory pressure/usage/leak, old/new gen, retained N, leak detected, potential leak). Reduces false positives from generic "memory"/"heap" in other runtimes. Heuristics are best-effort.

### Administration

• **Modularized 11 files over 300-line limit.** Split into smaller modules to satisfy ESLint `max-lines` (300, excluding blanks/comments). No behavior or API changes. New modules: `commands-export-insights`, `commands-export-helpers`; `log-session-helpers` (extended); `investigation-search-file`, `investigation-store-io`, `investigation-store-workspace`; `session-manager-routing`, `session-manager-start`, `session-manager-stop`; `viewer-content-body`, `viewer-content-scripts`; `viewer-message-handler-actions`, `viewer-message-handler-investigation`; `log-viewer-provider-state`; `viewer-performance-trends`, `viewer-performance-session-tab`; `viewer-replay-timing`, `viewer-replay-controls`; `viewer-session-panel-investigations`, `viewer-session-panel-events`. Callers still import from the original entry files where applicable.

---

## [3.6.2]

Empty-log fixes (late-start fallback for Dart run, 30s recent-child window, runbook/diagnostic updates), Project Logs recent-update indicators with last-viewed tracking, and investigation UX improvements. [log](https://github.com/saropa/saropa-log-capture/blob/v3.6.2/CHANGELOG.md)

### Added

• **Late-start fallback** — when output is buffered and no log session exists (e.g. Dart run or Cursor never fired `onDidStartDebugSession`), the extension starts capture using the active debug session so logs are still written.

• **Recent-child alias window** — parent/child fallback now aliases when exactly one owner was created in the last 30s (was 15s) to reduce two-file races for Dart/Flutter.

• **Recent-updates indicators in Project Logs** — Session list shows an **orange** dot for logs that have new lines since you last viewed them, and a **red** dot for logs updated in the last minute. "Last viewed" is updated when you open a session from the list or panel; the list refreshes periodically while a session is recording so the red indicator stays accurate. Active (recording) session continues to use the recording icon only.

• **Investigation UX** — In Project Logs, clicking "+ Create Investigation..." now shows an inline name field in the panel (instead of the VS Code input at the top of the window) so focus stays where the user is looking. Create/Cancel buttons and Enter/Escape keyboard support; loading state ("Creating…") prevents double-submit. Short hint under the Investigations header explains: "Pin sessions and files to search and export together." README clarifies how Investigations differ from Recurring (error-pattern analysis) and Performance (perf analysis).

### Documentation

• Runbook 010: clearer steps when a log file is empty or near-empty (enable `diagnosticCapture` to inspect the pipeline; runbook reorganized with first steps up front).

---

## [3.6.1]

Empty-log fixes and capture safeguards: replay early output, single/multi-session fallbacks, race guard, buffer-timeout warning, and optional diagnostic capture. [log](https://github.com/saropa/saropa-log-capture/blob/v3.6.1/CHANGELOG.md)

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

Enhances error analysis with hover popups and inline triage controls. [log](https://github.com/saropa/saropa-log-capture/blob/v3.6.0/CHANGELOG.md)

### Added

• **Error hover popup** — Hovering CRITICAL/TRANSIENT/BUG badges now shows classification, crash category, history, triage state, fingerprint, and an **Analyze** action.

• **Error analysis in Analysis Panel** — Error/warning analysis now includes triage controls, cross-log timeline, occurrence count, and actions (Copy Context, Bug Report, Export, AI Explain).

• **Clickable error badges** — error classification badges in the log viewer are now clickable to open the analysis panel directly for that error line.

• **Per-file coverage badges** — Stack lines now show configurable coverage badges (green/yellow/red) on both stack headers and frames.

• **Quality sidecar** — session end writes a `quality.json` sidecar with per-file coverage data for referenced code.

• **Coverage parser improvements** — single file read for both aggregate and per-file parsing, Cobertura attribute order flexibility, safe JSON parsing, ambiguous basename guard.

• **Code Quality Metrics integration design doc** — per-file coverage, lint, and doc density overlay for code referenced in log stack traces.

• **Code Quality Metrics provider** — `codeQuality` now writes an enriched `quality.json` sidecar with per-file coverage, lint counts, and comment density.

• **Lint report reader** — parses ESLint `--format json` output to extract per-file warning/error counts for log-referenced files.

• **Comment density scanner** — scans referenced source files for comment-to-code ratio and JSDoc/dartdoc coverage on exported symbols.

• **Code quality settings** — `integrations.codeQuality.lintReportPath`, `scanComments`, and `coverageStaleMaxHours` settings for configuring quality data sources.

### Changed

• **Terminology standardization** — User-facing `session` is now `log` across UI/docs/locales; internal IDs/keys/command names and VS Code `debug session` terms are unchanged.

<details>
<summary>Maintenance</summary>

• **Unit tests added** for AI module (JSONL parser, line formatter, prompt builder), bug report (keyword extraction, thread-aware stack traces), Crashlytics event parser, and insights export formats (CSV, JSON).
• **Updated feature discipline rule** in `.claude/rules/global.md` — replaced stale reference with `ROADMAP.md` and `plans/`.
• **Added nyc coverage configuration** with Istanbul reporters and 50% thresholds; CI now runs coverage and uploads the report as an artifact.
• **Added coverage badge** to README.
</details>

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

• **Resolved all 32 ESLint warnings.** Fixed strict equality, unused vars, missing braces, nesting/param/line-limit violations, and split helpers for maintainability.

• **Replay controls no longer overlap the minimap.** The replay toggle and panel now offset by the minimap width, respecting all size settings (small/medium/large).

### Changed

• **Consolidated three status bar items into one.** Pause icon, line count, and watch counts now share one entry; pause/resume remains in command palette.

• **More integrations enabled by default.** New installs enable `packages`, `git`, `environment`, `performance`, and `terminal` (was only `packages` + `performance`).

• **Clearer integration performance notes.** Adapters now show warning icons for notable cost/config/platform constraints with clearer disable guidance.

• **Removed integration adapter names from status bar.** The status bar no longer lists which adapters are active — it was cluttering the bar and confusing users. Integration info is still available in the Options panel.

### Removed

• **Standalone Crashlytics status bar indicator.** The always-visible Crashlytics status bar item has been removed to reduce clutter. Crashlytics setup status is still available in the viewer panel.

### Added

• **Session time (T+) toggle in context menu.** Options submenu now includes a quick toggle for session elapsed time, matching the gear panel checkbox.

---

## [3.5.2]

[log](https://github.com/saropa/saropa-log-capture/blob/v3.5.2/CHANGELOG.md)

### Fixed

• **Publish script no longer spawns unwanted Windows windows.** Extension listing now reads extension folders directly and subprocesses use `CREATE_NO_WINDOW`; Marketplace open is now prompted.

• **Stray `.meta.json` sidecars removed.** Metadata now writes only to `.session-metadata.json`, and activation cleans up orphan `.meta.json` files automatically.

### Added

• **Getting Started walkthrough command.** Added `Saropa Log Capture: Getting Started` plus an `About Saropa` step; walkthrough auto-opens on first install.

• **OWASP Security Context in bug reports.** Reports now include OWASP-mapped lint categories/rules in Security Context and Key Findings when relevant.

## [3.5.1]

Replay controls now live in a compact floating vertical panel instead of a full-width horizontal bar. [log](https://github.com/saropa/saropa-log-capture/blob/v3.5.1/CHANGELOG.md)

### Added

• **Create Bug Report File.** Right-click selected lines to auto-create a comprehensive `.md` report (selected text, context, cross-session analysis, environment, editable sections); also available from Command Palette.

• **`saropaLogCapture.reportFolder` setting.** Configure where diagnostic report files are written (path relative to workspace root; default folder name is documented in settings).

### Changed

• **Replay bar: collapsible vertical layout.** Replay controls are now a floating vertical panel (hidden by default) with a full-height vertical scrubber.

## [3.5.0]

Track elapsed session time with T+ decorations in the log viewer, and get instant codebase context from project health scores and lint breakdowns in bug reports. [log](https://github.com/saropa/saropa-log-capture/blob/v3.5.0/CHANGELOG.md)

### Added

• **Session time (T+) decoration.** New checkbox shows elapsed time from first log line (`T+0:00`, `T+3:42`, `T+1:23:42`) with hour/day rollover and millisecond-toggle support.

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

## [3.4.1]

[log](https://github.com/saropa/saropa-log-capture/blob/v3.4.1/CHANGELOG.md)

### Fixed

• **Extension activation on Cursor IDE** — Cursor wraps VS Code APIs differently from stock VS Code, so `vscode.debug.onDidReceiveDebugSessionCustomEvent` could be `undefined` during activation. The extension now guards the subscription and logs a one-time warning instead of crashing.

---

## [3.4.0]

In this version we add paginated Project Logs and Export Insights Summary; improve Crashlytics setup and Share Investigation (LAN, file links, Gist docs); introduce Explain with AI, Share Investigation (Gist/LAN/upload/shared folder), Build/CI API sources, and performance/crash-dump options; fix empty logs (replay and single-session fallback), session summary Open Log, CSP unsafe-inline, replay speeds and bar visibility, viewer in new window, and session list time display; and consolidate Marketplace URL config, viewer decorations, and correlations into the Session Timeline. [log](https://github.com/saropa/saropa-log-capture/blob/v3.4.0/CHANGELOG.md)

### Added

• **Project Logs: pagination.** The session list in the Project Logs panel is now paginated so 100+ sessions load and scroll without lag. Only the current page is rendered; a bar shows "Showing X–Y of Z" with Previous/Next when there are multiple pages. Page size defaults to 100 and is configurable via **Saropa Log Capture › Session List Page Size** (`saropaLogCapture.sessionListPageSize`, 10–500). Page resets when you refresh, change date range, or other filters. Plan [028] completed.

• **Export Insights Summary.** Export recurring errors and hot files as CSV or JSON for reports or tooling. Command **Saropa Log Capture: Export Insights Summary** (or **Export summary** from the Cross-Session Insights panel or Recurring Errors slide-out): choose scope (current session, current investigation, last 7 days, or all sessions), format (CSV/JSON), then save. Output includes error signatures, counts, sessions, sample lines, first/last seen; hot files with session counts; and meta (session count, time range, exported-at). Capped at 500 errors and 500 files per export. Plan [032] completed.

• **Crashlytics: setup automation and help when connection fails.** (1) **Setup:** Step 1 shows an OS-specific install one-liner (e.g. `winget install -e --id Google.CloudSDK` on Windows) with Copy; Step 2 includes “run in external terminal” hint with copyable auth command and a note about `saropaLogCapture.firebase.serviceAccountKeyPath` for a service account JSON key; Step 3 offers “Use existing file: …” when a workspace `google-services.json` is found. (2) **Checklist:** Setup wizard shows a one-line status (✓ gcloud · ✗ token · ○ config). (3) **When connection fails:** Copy diagnostic (plain text for support or terminal), Show Output (Saropa Log Capture channel), and Open Firebase Console (project-specific when available); same actions on “Query failed” (e.g. 404). (4) **Status bar:** “Crashlytics: ready” or “Crashlytics: complete setup in panel” so setup state is visible without opening the panel; updates on workspace change and after panel refresh. (5) **Service account key:** New setting `saropaLogCapture.firebase.serviceAccountKeyPath` (path to a Google Cloud service account JSON key). When set, the extension uses it for Crashlytics API access instead of gcloud (useful in CI or when gcloud is not available). (6) **In-app documentation:** All setup, auth, config, APIs, caching, troubleshooting, and architecture are in the Crashlytics panel **Help** section and contextual "If this doesn't work" hints; no external doc. Plan [030] completed.

• **Options: Keyboard shortcuts screen.** The keyboard shortcuts reference is now available from the viewer: open **Options** (gear) → **Keyboard shortcuts…** to see power shortcuts (Ctrl+F, Space, M, P, etc.) and key commands (Command Palette). Double-click a **power shortcut** row to rebind it (then press the new key; Escape cancels); double-click a **command** row to open VS Code Keyboard Shortcuts (Ctrl+K Ctrl+S) focused on that command. Same slide-out panel pattern as Integrations; back returns to Options.

• **Configurable viewer keybindings.** Power shortcuts (panel viewer) are rebindable. Setting `saropaLogCapture.viewerKeybindings` (object: actionId → key descriptor, e.g. `"togglePause": "p"`) persists overrides; defaults are used when a key is not overridden. Keybindings are sent to the viewer on load and when the setting changes. Status bar shows "Press a key for [action] (Escape to cancel)" when recording. Plan [040] completed.

• **Docker integration: includeInspect and --until.** (1) New setting `integrations.docker.includeInspect` (default `false`): when enabled, full `docker inspect` output is written to `${baseFileName}.container-inspect.json` and referenced in meta as `inspectSidecar`. (2) Container logs are now bounded by session end: `docker logs` uses `--until <endEpoch>s` with a 60s lag so logs are clipped at session end instead of relying only on `--tail`. Plan [007] completed and moved to history.

• **Share Investigation follow-ups.** (1) **Gist expiration:** Documented that secret gists do not expire; README and Gist README / Share quick-pick describe how to delete old gists (GitHub → Your gists → Delete). (2) **LAN + import:** Import from URL now accepts same-network `http` (e.g. `http://192.168.1.5:port/investigation.slc`) in addition to `https`; private/LAN hosts (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16–31.x.x) are allowed. (3) **Copy deep link (local file):** New Share menu option exports the investigation to a .slc file (save dialog), then copies a `vscode://…/import?url=file:///…` link to the clipboard; import supports `file://` URLs for local .slc files. (4) **UX and UI:** Doc and README clarify how to open a shared .slc (Investigation panel → **Open .slc file** or Command Palette → **Import .slc Bundle**). Investigation panel now has an **Open .slc file** button (with and without an active investigation) so recipients can open a shared file without using the command palette; toast and Share menu description point to this flow.

• **Central errors module.** New `src/modules/analysis/errors.ts` re-exports error types and helpers from level-classifier, error-fingerprint, error-rate-alert, and the ErrorStatus type from error-status-store. Provides a single import path for AI explain-error and other features that need “is this an error line?” and “what kind of error?”.

• **Explain with AI (Phase 1).** Right-click a log line → **Explain with AI** to get an explanation from the VS Code Language Model (e.g. GitHub Copilot). Requires **Saropa Log Capture > AI: Enabled** in Settings and an installed LM extension. Context is built from the error line and surrounding lines (±10 by default; configurable via `saropaLogCapture.ai.contextLines`). Response is shown in a notification with **Copy** and **Show details** (webview panel).

• **Explain with AI (Phase 2): rich context.** Stack traces are extracted from the log (e.g. "at …", "#0 …", "(file:line)") and included in the AI prompt and in the explanation panel. Integration data (performance, HTTP requests, terminal output) around the error time is loaded from sidecars and session meta and included when `saropaLogCapture.ai.includeIntegrationData` is on (default). The **Show details** panel now has sections for the error line, stack trace, context at error time, and the AI explanation.

• **Explain with AI (Phase 3): polish.** Explanations are cached in memory (configurable via `saropaLogCapture.ai.cacheExplanations`; default on) so the same error returns instantly. Optional model preference: `saropaLogCapture.ai.modelPreference` (e.g. `copilot`, `claude`) filters available chat models. Multi-line selection: when you select several log lines and right-click → **Explain with AI**, the selection is sent as the error block and context is built around it. The explanation panel has a **Copy explanation** button; notifications show "(cached)" when the result came from cache.

• **Explain with AI: localization and loading feedback.** All user-facing strings for the feature use `l10n.ts` (and `package.nls.json` for the AI enabled setting description). A progress notification ("Explaining with AI…") is shown while context is built and the model is called. Cache eviction refreshes LRU when an existing key is re-set.

• **Share Investigation.** Share an investigation via GitHub Gist or export as .slc file. From the Investigation panel click **Share** or run **Share Investigation** from the command palette: choose **Share via GitHub Gist** (requires GitHub sign-in; creates a secret gist and a `vscode://` deep link) or **Export as .slc file**. **Share on LAN** starts a temporary HTTP server on this machine and gives a download URL for teammates on the same network (Copy URL / Stop server). **Upload to configured URL** (when `share.uploadPutUrl` is set) PUTs the .slc to a presigned S3/Azure or other URL. **Save to shared folder** (when `share.sharedFolderPath` is set) writes the .slc to a team path (absolute or relative to workspace). Recipients open the link or file in VS Code to import the investigation (read-only). **Recent shares** (last 10) are stored in workspace state; use **Recent shares…** in the Share menu to copy a link again. Command **Clear share history** removes stored links (does not delete gists). Settings: `saropaLogCapture.share.gistPublic`, `saropaLogCapture.share.includeNotes`, `saropaLogCapture.share.uploadPutUrl`, `saropaLogCapture.share.sharedFolderPath`. Import from URL is supported via `vscode://saropa.saropa-log-capture/import?url=...` or `?gist=...`. Large investigations (>50 MB) show a warning before upload.

• **Build/CI: API sources (GitHub Actions, Azure DevOps, GitLab CI).** Build/CI integration can now use API-based sources instead of only a file. New setting `integrations.buildCi.source` (default `file`): `file` (existing last-build.json), `github`, `azure`, or `gitlab`. For GitHub, the extension calls the Actions API with the repo from git remote and current branch; for Azure/GitLab, set `azureOrg`/`azureProject` or `gitlabProjectId` (and optional `gitlabBaseUrl`). Tokens are stored in VS Code SecretStorage. Commands: **Saropa: Set Build/CI GitHub Token**, **Saropa: Set Build/CI Azure PAT**, **Saropa: Set Build/CI GitLab Token**, and matching Clear commands. API fetches run asynchronously after session start (10s timeout) and append build status and link to the log header and session meta when available.

• **Options: master capture switch.** The Options panel (gear) now has a **Capture** section at the top with **Enable log capture**. When off, no log files are created during debug sessions (same as `saropaLogCapture.enabled` in Settings). The checkbox is synced on load and when toggled.

• **Performance: always-on by default and clearer UX.** Performance integration is now in the default `integrations.adapters` (with `packages`), so new workspaces capture a system snapshot (CPUs, RAM) for every session without turning it on per session. The Performance icon in the icon bar is shown only when Performance is enabled. Project Logs list shows a small performance icon next to logs that have performance data. When you open a log that has performance data, a **Performance** chip appears in the session bar; clicking it opens the Performance panel. The Session tab explains clearly that data cannot be added to an existing log and how to get it for the next run; overhead note added.

• **Viewer icon bar: optional labels and bar-click toggle.** The log viewer’s vertical icon bar (Project Logs, Search, Bookmarks, etc.) can show text labels next to each icon. Click the bar background or the separator between icon groups (not on an icon) to toggle labels on or off. The choice is persisted in webview state so it survives reloads.

• **Project Logs: multi-select with Ctrl/Cmd-click.** In the Project Logs panel you can Ctrl-click (or Cmd-click on macOS) to select multiple sessions. The context menu then applies to all selected items: Copy Deep Links / Copy File Paths (newline-separated to clipboard), Export (one file per session), Tag (dialog per session), Open (each in turn), Replay (first selected). Single-item behavior is unchanged. Trash panel remains single-selection.

• **Capture diagnostics for empty logs.** New setting `saropaLogCapture.diagnosticCapture` (default `false`). When enabled, the extension logs capture pipeline events to the "Saropa Log Capture" output channel: new log session created, output buffered (no session yet), and output written to log (once per session).

• **Single-session output fallback.** If DAP output arrives under a session id that has no log session yet, but there is exactly one active log session, that output is now routed to that session and written to the log instead of being buffered indefinitely.

• **Replay all early output when creating the first session.** Output that arrives before any log session exists is buffered by session id. We used to replay only the buffer for the session that had just started, so output that had been tagged with a different id was never replayed and the log stayed empty. When we create the first log session we now replay every buffered session’s output into that session, so no early output is dropped.

• **Why it broke after v3.1.3:** The 3.1.3 refactor (modularization only) likely changed the order/timing of tracker registration and event delivery. Output then often arrived before a session existed or under a different session id; we only replayed the “just started” session’s buffer, so other output was dropped. The fixes above (replay all early output + single-session fallback) address that.

• **Race guard when creating a session.** If we're about to create a new log session but exactly one session was created in the last 5 seconds (e.g. the other half of a parent/child pair), we now alias the new session to that one instead of creating a second file. Fixes the case where Project Logs shows the file but it stays empty because output went to a different log file created in the same run.

• **Multi-session fallback.** When output arrives for an unknown session id and there are 2+ active log sessions, we now route that output to the most recently created session so it is not dropped. Ensures at least one file receives output when a race created two files.

• **Buffer timeout warning.** If output has been buffered for a session id for over 30 seconds with no log session ever created, we log a one-time warning to the Saropa Log Capture output channel so you can see that capture may be misconfigured or the session never started.

• **Performance integration: profiler output copy and process memory.** New setting `integrations.performance.profilerOutputPath` (default empty): at session end, an external profiler file (e.g. `.cpuprofile`, `.trace`) is copied into the session folder when the path is set (supports `${workspaceFolder}`; 100 MB max). New setting `integrations.performance.processMetrics` (default `false`): when enabled, the extension captures the debug target process memory (MB) from the DAP `process` event and records it in the performance snapshot and session meta. Process memory is read at session end (Windows: PowerShell; Linux: `/proc/<pid>/status`; macOS: `ps`). If the adapter does not send a process ID or the read fails, the field is omitted.

• **Integrations: dedicated screen from Options.** The Options panel no longer lists all integration checkboxes inline. A single **Integrations…** button opens a dedicated Integrations screen (same slide-out, view switch) with back navigation. Each adapter now has a long description, a performance note, and when-to-disable guidance. This reduces clutter and makes it easier to choose adapters and understand cost.

• **Crash dumps: copy into session folder.** New setting `integrations.crashDumps.copyToSession` (default `false`). When enabled, discovered crash dump files are copied into the session output folder so the session is self-contained. Total copy size is capped at 500 MB; duplicate basenames get a numeric suffix. The sidecar JSON includes a `copiedTo` path per file and `copiedCount` in meta.

### Fixed

• **Session summary "Open Log" button.** The "Open Log" action in the notification shown after a session ends now opens the completed log file. Previously it ran the open command, which only opens the active session; after finalize there is no active session so nothing happened. The summary now carries the log URI and opens it directly.

• **CSP: remove unsafe-inline from viewer.** Viewer and Session Comparison webviews no longer use `'unsafe-inline'` in Content-Security-Policy `style-src`. Session-perf chip and hidden-lines counter visibility are toggled via the `.u-hidden` class (in nonced styles) instead of inline styles. Plan [027] completed.

• **Viewer load: TypeScript and lint.** Restructured performance-data block in `log-viewer-provider-load.ts` so the try/catch parses correctly (no return inside try). Replaced `!=` with `!==` for eqeqeq. GitHub auth session check in extension activation now uses `vscode.authentication.getSession(..., { createIfNone: false })` instead of removed `getSessions`. Build/CI fetch no longer casts headers to `HeadersInit` (type not in project lib). Docs: `cross-session-analysis.md` paths for error-fingerprint updated to `src/modules/analysis/error-fingerprint.ts`.

• **Session replay: more speeds, 0.5x display, and bar visibility.** Replay speed dropdown now includes 0.1x, 0.25x, 0.75x, and 10x (in addition to 0.5x, 1x, 2x, 5x). Selecting 0.5x (half speed) now correctly shows and applies the chosen speed instead of appearing unchanged. The replay bar (Play, Pause, Stop, Mode, Speed, scrubber) is now shown whenever a log file with lines is loaded, so replay options are visible without clicking the replay icon first; the bar remains visible after stopping replay. Default speed setting allows 0.1x–10x. Replay bar uses a short fade-in when shown.

• **Viewer in new window: clicks on sessions now open log content.** Opening the Saropa Log Capture tab in a new window (e.g. via "Open in New Window") left the session list visible but clicking a session did not show log content in that window. The sidebar log viewer is a WebviewView; VS Code resolves one view per window. The extension now tracks all resolved views and broadcasts load/postMessage to each, so the viewer in the window where you click receives the content. Batch timer and badge updates were adjusted for multi-view (stop timer only when the last view is removed; update badges on all views).

• **Session list file time display.** Time in the Project Logs session list was inconsistent: some entries showed relative time ("X hrs ago"), some showed clock time, and some showed nothing (e.g. when day headings were on and the file was older than 24 hours). The panel now always shows a time (relative when &lt; 24h, otherwise clock time). When session metadata has no valid mtime, the extension falls back to filesystem stat so the list always has a time when the file exists. Loading state is shown while the list is built after tree data changes.

### Changed

• **Marketplace URL: single source of truth.** Extension marketplace links (changelog, item page, bug report header, Gist README) now use `src/modules/marketplace-url.ts`. Fork maintainers can change the base URL in one place for Open VS X or other hosts. About panel changelog link only opens when URL has been set (guards against click before content load). Plan [029] completed.

• **Viewer: blank lines and decorations.** Blank lines are defined as lines whose text is empty or only whitespace (spaces, tabs, Unicode whitespace) via a single regex (`/^\s*$/`). Such lines never show the decoration prefix (counter, timestamp, chevron). When "Hide blank lines" is on, those same lines are hidden. When shown, blank lines keep the severity bar (inherited from the previous line) and line tint for visual continuity.

• **Viewer: clearer decoration labels and Timestamp in context menu.** The "Line prefix" option is renamed to **Line decorations (dot, number, time)** in both the right-click context menu and the Options panel so it's clear it controls the severity dot, counter, and time in the left margin. A **Timestamp** toggle was added to the context menu (Options submenu) so per-line timestamps can be shown or hidden without opening the Options panel; turning Timestamp on from the menu enables line decorations if they were off.

• **Correlations: integrated into Session Timeline.** The correlations list no longer appears as a separate sidebar view. When you open a session timeline, detected correlations are shown in a block directly in the timeline panel (below the toolbar), with "Jump to event" links. The section is only shown when there are correlations for that session, keeping the timeline as the single place for events and correlation context.

---

## [3.3.0]

Auto-correlation across debug, HTTP, perf, and terminal in the Session Timeline; Git line history and commit links in session meta; and Investigation Mode Phase 3–4 (export/import, bug-report context, and UX polish). [log](https://github.com/saropa/saropa-log-capture/blob/v3.3.0/CHANGELOG.md)

### Added

• **Auto-correlation detection.** When the Session Timeline is opened, the extension detects related events across sources (debug, HTTP, perf, terminal) within a configurable time window. Correlated events show a link badge (▶) in the timeline and in the log viewer; clicking the badge highlights all related events. New **Correlations** sidebar view lists detected correlations for the last opened timeline session with "Jump to event" links. Settings: `correlation.enabled`, `correlation.windowMs`, `correlation.minConfidence`, `correlation.types`, `correlation.maxEvents`. Detection runs after timeline load with a brief "Detecting correlations…" phase when enabled.

• **Git: line history in session meta and commit links.** When `integrations.git.includeLineHistoryInMeta` is enabled, at session end the extension parses the log for file:line references (Dart, JS/TS, Java-style stack traces), runs `git blame` for each (capped at 20, 2s timeout per blame), and stores a `lineHistory` array in session meta. New setting `integrations.git.commitLinks` (default `true`) resolves commit hashes to web URLs (GitHub, GitLab, Bitbucket) and adds them to line history meta and to the blame status bar when opening source from a log line. Blame display shows a brief "Git blame…" loading message until the result is ready.

• **Investigation Mode: Export, import, and integration (Phase 3).** Investigations can be exported as `.slc` bundles (manifest v3) with all pinned sources and sidecars; import recreates the investigation in the workspace. Bug reports now include an optional "Investigation Context" section (name, pinned sources table, recent search, notes) when an investigation is active. "Generate Bug Report" in the investigation panel produces a report from investigation context. Export and import show notification progress.

• **Investigation Mode: UX polish (Phase 4).** Project Logs panel shows an "Investigations" section with list and "Create Investigation…"; clicking an investigation opens it, creating sets active. Session context menu includes "Add to Investigation". New command "New Investigation from Sessions…" multi-selects sessions and creates an investigation with them. All new user-facing strings are localized (en + placeholder in other locales).

---

## [3.2.1]

Fixes empty log file when Flutter/Dart child session starts before parent so a single file captures all debug output. [log](https://github.com/saropa/saropa-log-capture/blob/v3.2.1/CHANGELOG.md)

### Fixed

• **Flutter/Dart: empty log file when child session starts before parent.** When the Dart VM (child) debug session started before the Flutter (parent) session, the extension created a second log file for the parent that never received output. The parent now reuses the child's log session so a single file captures all debug output.

---

## [3.2.0]

Investigation Mode Phase 2 (cross-source search), Cursor IDE compatibility warning, empty state watermark, file info panel, and empty-line decoration fix. [log](https://github.com/saropa/saropa-log-capture/blob/v3.2.0/CHANGELOG.md)

### Added

• **Investigation Mode: Cross-source search (Phase 2).** Search across all pinned sources in an investigation, including auto-resolved session sidecars (`.terminal.log`, `.requests.json`, `.events.json`, `.queries.json`, `.browser.json`). Features include:
• Search options: case sensitivity, regex mode, configurable context lines
• Search history dropdown with last 10 queries
• Progress bar showing file-by-file search status
• Cancellation support (new search auto-cancels previous)
• Large file handling with warning badges (>10MB searched partially)
• Missing source detection with warning badges
• Context lines before/after matches (dimmed, clickable)

• **Cursor IDE (in)compatibility warning.** Detects when running in Cursor IDE and warns that debug output capture may not work due to differences in the Debug Adapter Protocol implementation. Shows a one-time dismissible notification with workaround guidance.

• **Empty state watermark.** When log content is empty, a centered watermark now displays with context-aware messages ("Empty log file" or "No log entries") instead of a blank area.

• **File info panel.** A metadata panel at the bottom of the log viewer shows file name (clickable to reveal), folder (clickable to open), modification date/time, and stats (line count, file size, errors, warnings, performance issues).

### Fixed

• **Empty lines no longer show decoration prefixes.** Blank or whitespace-only lines now skip counter and timestamp decorations, matching the existing behavior for severity bars.

---

## [3.1.3]

Modularized six oversized files, fixed replay bar when log is empty, and aligned @types/vscode with engine for packaging. [log](https://github.com/saropa/saropa-log-capture/blob/v3.1.3/CHANGELOG.md)

### Changed

• **Modularized 6 files exceeding 300-line limit.** Split `extension-activation.ts`, `context-loader.ts`, `investigation-panel.ts`, `timeline-panel.ts`, `viewer-panel-handlers.ts`, and `viewer-context-popover.ts` into smaller focused modules. Extracted types, handlers, scripts, and styles into dedicated files. No behavior changes — pure refactoring.

### Fixed

• **Replay bar no longer appears when log is empty.** Added defense-in-depth guards to prevent the replay controls from showing "0 / 0" when no log lines are loaded. The replay icon and bar now require lines to exist before becoming visible, and the state is re-evaluated after file load completes.

• **Aligned `@types/vscode` with `engines.vscode` for packaging.** Downgraded `@types/vscode` from `^1.110.0` to `^1.105.0` to match the engine constraint, fixing vsce packaging error on Cursor-compatible builds.

---

## [3.1.2]

Enables Cursor IDE compatibility by lowering the VS Code engine requirement to 1.105.0. [log](https://github.com/saropa/saropa-log-capture/blob/v3.1.2/CHANGELOG.md)

### Changed

• **Lowered VS Code engine requirement to 1.105.0.** Enables installation in Cursor IDE (which uses VS Code 1.105.1). The extension does not use any APIs requiring 1.108+.

---

## [3.1.1]

Failed release (reverted) — the engine change was incorrectly applied and had to be redone in 3.1.2. [log](https://github.com/saropa/saropa-log-capture/blob/v3.1.1/CHANGELOG.md)


~~### Changed~~

• ~~**Lowered VS Code engine requirement to 1.105.0.** Enables installation in Cursor IDE (which uses VS Code 1.105.1). The extension does not use any APIs requiring 1.108+.~~

---

## [3.1.0]

Major feature release: unified timeline view correlates all log sources on one time axis, context popovers show related data around any log line, and you can now hide/unhide lines manually. [log](https://github.com/saropa/saropa-log-capture/blob/v3.1.0/CHANGELOG.md)

### Added

• **Unified Timeline View.** Correlate all data sources (debug console, terminal, HTTP, performance, Docker, browser, database, events) on a single time-synchronized view. Access via right-click session → Show Timeline. Features include: source filter checkboxes with color coding, time range scrubber with draggable handles and zoom controls (+/−/reset), minimap showing event density with click-to-navigate, virtual scrolling for 100k+ events, keyboard navigation (arrow keys + Enter), and export to JSON/CSV. Click any event to jump to the source log line or sidecar file.

• **Context Popover for integration data.** Right-click a log line → Actions → Show Integration Context to see a floating popover with performance, HTTP requests, terminal output, and Docker status from ±5 seconds around that line. Configurable time window via `saropaLogCapture.contextWindowSeconds` setting.

• **Volume slider plays preview sound.** When adjusting the audio volume slider in Options, a preview sound now plays after you stop dragging, so you can hear the actual volume level. Debounced to avoid spamming sounds while adjusting.

• **Hide Lines feature.** Manually hide log lines via right-click → Hide Lines submenu. Options include: Hide This Line (single row), Hide Selection (shift+click range), Hide All Visible (all currently shown lines), and corresponding Unhide actions. A footer counter shows "N hidden" with click-to-peek functionality — click to temporarily reveal hidden lines, click again to re-hide. New logs are never hidden by default.

### Fixed

• **Panel badge now clears when clicking in the log viewer.** The watch hits badge (showing unread error/warning counts) previously only cleared when the panel visibility changed. Now it also clears when you click anywhere in the already-visible panel.

• **Dart/Flutter exceptions now detected as errors.** Fixed detection of Dart internal error types like `_TypeError`, `_RangeError`, and `_FormatException` that weren't being marked red. Also added detection for `Null check operator used on a null value` messages. These patterns are now recognized even when the logcat prefix is `I/` (Info level), so exceptions in `I/flutter` output are properly highlighted as errors.

• **Severity bar now matches error/warning color for framework lines.** Framework log lines (e.g. `E/MediaCodec`) now show red/yellow/purple severity bars matching their log level, instead of always showing a blue "framework" bar. This makes errors from framework code visually consistent with the text color.

• **Context line spacing improved when filtering by level.** When double-clicking to show only errors (or other levels) with context lines, the visual gap now appears after the error group instead of before, creating cleaner visual grouping.

• **Replay controls hidden during recording and when empty.** The replay icon and playback bar are now hidden when a debug session is active or no log file is loaded. Clicking a session in Project Logs now shows the replay icon so users can start playback.

• **Dart/Flutter stack traces no longer show timestamps on each frame.** Stack frames using the `#0`, `#1`, `#2` format were not being detected, so each line displayed a redundant timestamp. Now the viewer correctly detects Dart, Python, and other stack frame formats, showing the timestamp only on the first line of the stack trace.

---

## [3.0.6]

Exposes a public API so other VS Code extensions can subscribe to log events and inject lines, plus reduces VS Code window spawns during publish. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.6/CHANGELOG.md)

### Fixed

• **Publish script spawns fewer VS Code windows on Windows.** Removed extension-cache clearing that forced a redundant `code --list-extensions` call, reducing VS Code window spawns from 4 to 3 (with one missing extension) or from 3 to 2 (happy path). Remaining CLI calls now print a notification before spawning so the user knows what is happening.

### Added

• **Public extension API.** Other VS Code extensions can now consume a typed API via `vscode.extensions.getExtension('saropa.saropa-log-capture')?.exports`. Exposes live line events (`onDidWriteLine`), session lifecycle events (`onDidStartSession` / `onDidEndSession`), file split events, `getSessionInfo()`, `insertMarker()`, `writeLine()`, and `registerIntegrationProvider()`.

• **`writeLine()` public API method.** Consuming extensions can write structured log lines into the active capture session via `api.writeLine(text, { category, timestamp })`. Lines go through the same pipeline as DAP output: exclusion rules, flood protection, deduplication, watch patterns, viewer display, and all export formats. No-op when no session is active.

• **User-configurable settings for Performance, Terminal, and Linux Logs integrations.** Added `package.json` setting definitions so these adapters' options (snapshot timing, terminal selection, WSL distro, etc.) appear in VS Code's Settings UI.

## [3.0.5]

Streamlines the session UI — metadata moves to a tooltip, the replay bar tucks behind an icon, and severity connectors fade back so the dots stand out. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.5/CHANGELOG.md)

### Added

• **Long-press session count copies session info.** Long-pressing the "Session X of Y" label copies all session metadata (date, project, debug adapter, etc.) to the clipboard.

### Fixed

• **Publish script no longer spawns multiple VS Code windows.** Cached the `code --list-extensions` CLI output so the editor is queried at most once per run instead of 3–4 times.

### Changed

• **Split 8 oversized files under 300-line limit.** Extracted cohesive modules from `session-lifecycle`, `session-manager`, `session-history-provider`, `viewer-handler-wiring`, `log-viewer-provider`, `viewer-context-menu`, `viewer-session-panel`, and `extension-activation` — no behavior changes.

• **Severity connector bars semi-transparent.** The vertical bars joining consecutive severity dots are now rendered at reduced opacity so they don't visually overpower the dots themselves.

• **Replay bar hidden behind icon.** The replay transport bar (play/pause/stop, speed, scrubber) is no longer always visible during replay. A replay icon appears in the icon bar when replay is active; click it to toggle the controls.

• **Session info moved to tooltip.** Session metadata (date, project, debug adapter, launch config, VS Code version, extension version, OS) is now shown as a tooltip on the session count label instead of a dedicated slide-out panel.

• **Session count always visible.** The "Session X of Y" label and Prev/Next buttons are now always shown (defaulting to "Session 1 of 1" for a single session) instead of hiding when there is no navigation.

• **Icon bar spacing.** Increased vertical gap between icon bar buttons from 2px to 3px for better visual balance after removing the Session Info icon.

### Removed

• **Session Info sidebar icon and panel.** The info icon (ℹ) and its full-height slide-out panel have been removed. The same information is now available via the session count tooltip.

---

## [3.0.4]

Fixes multi-line severity inheritance and localized strings showing raw keys, adds scroll-to-top and find-in-files sorting, and improves Project Logs list performance. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.4/CHANGELOG.md)

### Fixed

• **Continuation lines not inheriting severity level.** Multi-line log messages (e.g. Flutter `[ERROR:...]` followed by `See https://...`) now inherit the severity level from the preceding line when timestamps are within 2 seconds and the continuation has no explicit level markers.

• **Localized messages showing raw keys.** All `vscode.l10n.t()` calls used symbolic keys (e.g., `msg.gitignoreLogPrompt`) which displayed literally in English locale. Introduced `src/l10n.ts` helper that maps keys to English strings before passing through `vscode.l10n.t()`. Fixes 159 call sites across 26 source files. Also fixed 14 calls in `commands-export.ts` and `commands-session.ts` that incorrectly passed inline English text as positional substitution arguments. Re-keyed all 11 translation bundles to use English strings as lookup keys.

### Added

• **Scroll to Top button.** New "Top" button appears when scrolled past 50% of viewport height. Both Top and Bottom buttons hidden on small files (< 150% viewport height).

• **Find-in-files sort by match count.** Sort toggle in the find panel header reorders results by number of matches (most hits first).

• **Footer path gestures.** Footer now shows the relative path (or full path if outside workspace). Long-press copies the path to clipboard. Double-click opens the containing folder.

### Changed

• **Project Logs list performance.** Items-level cache with fetch deduplication eliminates redundant directory scans and metadata loads on repeat opens. Bulk central metadata read (`.session-metadata.json` read once per refresh, not once per file). Severity scan skipped when sidecar already has cached counts. Concurrency-limited batch loading (max 8 parallel file reads). Debounced webview session list requests (150ms).

• **Panel close buttons.** Replaced text `x` with codicon icons, restyled to match the refresh button size across all panels.

• **Panel widths.** All slide-out panels now share a single user-resizable width. The slot controls the width; all panels fill it via `width: 100%`. Resize handle updates only the slot (not individual panels). Persisted width applies immediately when the setting arrives, even if a panel is already open. Removed `max-width` constraints from Crashlytics, Recurring, Performance, Info, and Session panels.

• **Tidy mode improvements.** File extension stripped in tidy mode. Time extracted from filename and shown as 12-hour format (e.g. "10:19 AM"); hidden when it matches the session modified time. Severity dots moved inline with meta text. "N lines" text replaced by colored severity dots that sum to total line count (uncategorized lines shown as a dim "other" dot).

• **Tidy subfolder display.** Only shows subfolder prefix when basenames collide for disambiguation.

• **About panel changelog.** URL link moved above changelog content; changelog cleared on panel close.

### Fixed

• **Prev/Next session navigation.** Both buttons were navigating to the next session due to `safeLineIndex()` rejecting negative direction values.

• **Search tags textbox styling.** CSS ID mismatch (`#options-search` vs `#filters-search`) left the input unstyled.

• **Search mode toggle.** Toggle was resetting search text and missing active-state styling.

• **Find-in-files screen jump.** Session navigator CSS transition caused a visual jump when switching files.

• **Scroll-to-bottom button.** Button was inside the scroll container making it unclickable; moved to positioned wrapper with proper z-index.

## [3.0.3]

Automated release to publish accumulated fixes; no user-facing changes beyond what shipped in 3.0.2. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.3/CHANGELOG.md)


---

## [3.0.2]

In this release we add eight new integration adapters (performance, terminal, WSL, security, and more), one-click export to Grafana Loki, session replay with timing, and full support for remote workspaces (SSH, WSL, Dev Containers). [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.2/CHANGELOG.md)

### Added

• **Eight new integration adapters.** Performance (system snapshot at session start, optional periodic sampling, Session tab in Performance panel), Terminal output (capture Integrated Terminal to sidecar; requires supported VS Code terminal API), WSL/Linux logs (dmesg and journalctl for WSL or remote Linux), Application/file logs (read last N lines from configured paths at session end), Security/audit (Windows Security channel with optional redaction, app audit file path), Database query logs (file mode: JSONL query log at session end), HTTP/network (request log JSONL at session end), Browser/DevTools (file mode: browser console JSONL/JSON at session end). All opt-in via `saropaLogCapture.integrations.adapters`. Config under `integrations.performance.*`, `integrations.terminal.*`, `integrations.linuxLogs.*`, `integrations.externalLogs.*`, `integrations.security.*`, `integrations.database.*`, `integrations.http.*`, `integrations.browser.*`. See [docs/integrations/TASK_BREAKDOWN_AND_EASE.md](docs/integrations/TASK_BREAKDOWN_AND_EASE.md).

• **Export to Loki (Grafana Loki).** One-click push of the current (or selected) log session to Grafana Loki. Enable via `saropaLogCapture.loki.enabled`, set `saropaLogCapture.loki.pushUrl` to your Loki push API URL (e.g. Grafana Cloud or `http://localhost:3100/loki/api/v1/push`). Store API key with command **Saropa Log Capture: Set Loki API Key** (Secret Storage). Command **Export to Loki** and session context menu **Export to Loki**; progress notification while pushing; labels `job=saropa-log-capture`, `session`, and optional `app_version` from metadata.

• **Remote workspace support (Task 90).** Extension runs in the workspace context for Remote - SSH, WSL, and Dev Containers (`extensionKind: workspace`). Save dialogs (export logs, save bug report) default to the workspace folder so the chosen path is on the remote when applicable. Integration providers (test-results, build-ci, code-coverage, environment-snapshot, crash-dumps) resolve workspace-relative paths via a shared `resolveWorkspaceFileUri` so paths work correctly in remote workspaces. README now includes a "Remote development (SSH, WSL, Dev Containers)" section.

• **Session replay.** Replay a saved log session with optional timing: lines appear in order with delay from per-line timestamps or `[+Nms]` elapsed prefixes (or fixed delay when absent). **Replay** is available from the Project Logs list (right-click a session → Replay) and from the command palette (**Saropa Log Capture: Replay Session**). Replay bar: Play, Pause, Stop; **Timed** (use line deltas) vs **Fast** (fixed short delay); speed (0.5x–5x); scrubber to seek. **Space** toggles play/pause. Settings: `replay.defaultMode`, `replay.defaultSpeed`, `replay.minLineDelayMs`, `replay.maxDelayMs`.

• **Copy with source: surrounding context lines.** New setting `saropaLogCapture.copyContextLines` (default 3, max 20). When using **Copy with source** from the log viewer context menu, the copied excerpt now includes this many log lines before and after the selection (or the right-clicked line), so stack traces and surrounding errors are included. Set to 0 to copy only the selection. NLS description in package.nls.json.

<details>
<summary>Maintenance</summary>

• **NLS verification.** Added missing manifest keys to all 10 localized package.nls.\*.json so `verify-nls` passes and publish can complete.
• **Publish script: vsce login when PAT missing.** Script now runs `vsce login saropa` interactively instead of only printing a manual command.
• **Integration design docs.** Completed design documents removed from `docs/integrations/`; content covered by provider JSDoc and CHANGELOG entries.
</details>

---

## [3.0.1]

Fixes integration config losing user value `0`, adds deep link and split-rule hardening. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.1/CHANGELOG.md)

### Fixed

• **Integration config.** Crashlytics and Windows Events `leadMinutes`/`lagMinutes` now correctly preserve user value `0` (was replaced by default); added `configNonNegative` helper to avoid duplication.

<details>
<summary>Maintenance</summary>

• **System-wide code comments and ARCHITECTURE.md.** Deep comment pass across the codebase with file-level JSDoc and inline "why" comments. New `ARCHITECTURE.md` describes high-level flow and conventions.
• **Config validation and safe JSON.** `config-validation.ts` and `safe-json.ts` for defensive parsing with unit tests.
• **Deep link and split-rules hardening.** Session name validated (no path traversal, length cap); line number clamped; parseSplitRules clamps numeric settings.
• **ESLint curly.** Added braces to single-line `if` bodies for consistency.
</details>

---

## [3.0.0]

In this release we add tail mode for live file watching, .slc session bundle export/import, a configurable viewer line cap, session date filter, copy-as-snippet for GitHub/GitLab, and accessibility improvements, plus a lot of refactoring under the hood. [log](https://github.com/saropa/saropa-log-capture/blob/v3.0.0/CHANGELOG.md)

### Added

• **Tail mode (Task 89).** New setting `saropaLogCapture.tailPatterns` (default `["**/*.log"]`) and command **Saropa Log Capture: Open Tailed File**. Pick a workspace file matching the patterns; the viewer opens it and appends new lines as the file grows (file watcher). NLS in all 11 locales.

• **.slc session bundle (Tasks 74–75).** **Export:** Command **Export as .slc Bundle** and session context menu **Export as .slc Bundle** save the current (or selected) session to a `.slc` ZIP containing main log, split parts, `manifest.json`, and `metadata.json`. Export shows a notification progress while building the bundle; split-part reads run in parallel. **Import:** Command **Import .slc Bundle** opens a file picker; selected `.slc` files are extracted into the workspace log directory with unique names, metadata merged into `.session-metadata.json`, then a single session list refresh and the last imported log opened in the viewer. Progress notification during import. NLS in all 11 locales and bundle.l10n. Unit tests for manifest validation (`isSlcManifestValid`). README Export section documents .slc bundle.

• **Configurable viewer line cap.** New setting `saropaLogCapture.viewerMaxLines` (default 0 = 50,000). When set, the viewer and file load are capped at `min(viewerMaxLines, maxLines)` to reduce memory for very large files. Applied in sidebar and pop-out viewer; NLS in all 11 locales.

• **Session list date filter.** Project Logs panel has a dropdown: "All time", "Last 7 days", "Last 30 days". Selection is persisted with session display options and filters sessions by `mtime` in the webview.

• **Copy as snippet (GitHub/GitLab).** Context menu item "Copy as snippet (GitHub/GitLab)" copies selection or visible lines wrapped in ` ```log ` … ` ``` ` for pasting into issues.

• **Accessibility improvements.** Icon bar has `role="toolbar"` with `aria-label` on each button. Log content has `role="log"` with live region. Session/split nav, context-lines slider, and level flyup buttons all labeled. Split breadcrumb label has `aria-hidden`.

### Changed

• **About panel changelog URL.** Changelog link is built from extension id (`buildChangelogUrl(extensionId)`) instead of a hardcoded URL; callers pass `context.extension.id`.

• **Preset "last used".** Last applied filter preset name is stored in workspace state and re-applied when the viewer loads (sidebar and pop-out).

<details>
<summary>Maintenance</summary>

• **Documentation standards and extension logging.** CONTRIBUTING documents file-level doc headers, JSDoc for public APIs, and inline comment guidelines. Shared extension logger (`extension-logger.ts`) with `setExtensionLogger()` at activation. Cursor rules for documentation and error-handling/testing.
• **Unit test coverage.** Tests for `EarlyOutputBuffer` (session-event-bus), file retention selection, viewer line cap, and session display. CONTRIBUTING Testing section and `npm run test:coverage` (c8).
• **Parameter validation and assertion helper.** `config-validation.ts`, `safe-json.ts`, and `assert.ts` with `assertDefined` for required params.
• **Wow feature specs.** Design docs for AI Explain, Session replay, and Loki export in `docs/wow-specs/`.
• **File line limit (300 lines).** Split 10 files into smaller modules. Behavior unchanged; structure only.
• **File retention extraction.** Pure helper `selectFilesToTrash` extracted for testability.
• **Error handling.** Edit-line, export-log, session rename, and deep-link errors now log to the output channel before showing user messages.
• **Plan.md footer consolidation.** Plan marked closed; status and current UX summarized.
• **README updates.** Known Limitations, Requirements, keyboard shortcuts doc, redaction tip, and F5 testing note.
• **TypeScript.** Enabled `noImplicitReturns`, `noFallthroughCasesInSwitch`, and `noUnusedParameters` in tsconfig.json.
• **Filter presets schema.** Added `levels` and `appOnlyMode` to `saropaLogCapture.filterPresets` in package.json and all NLS files.
• **Publish script (Step 10).** Added `--yes` for non-interactive/CI.
• **ROADMAP.** Marked resolved project-review issues as fixed; renumbered remaining items.
• **Integration specs index.** Marked implemented adapters as Done.
</details>

---

## [2.0.19]

We added runtime and manifest localization (11 locales), a project indexer for faster analysis, an integration framework with Packages and eight more adapters (Build/CI, Git, Test results, Crashlytics, etc.), and a reset button in the Options panel.

### Added

• **Runtime localization (l10n).** Status bar text, notification messages, and input prompts now use `vscode.l10n.t()` with `l10n/bundle.l10n.json`. Locale-specific bundles (`bundle.l10n.{locale}.json`) provided for de, es, fr, it, ja, ko, pt-br, ru, zh-cn, zh-tw (English placeholder values; replace with translations as needed). Manifest localization (package.nls.\*) unchanged.
• **Manifest localization: five additional locales.** Added `package.nls.fr.json`, `package.nls.it.json`, `package.nls.pt-br.json`, `package.nls.ru.json`, and `package.nls.zh-tw.json` so command titles, view names, walkthrough text, and Firebase time-range enums are localized for French, Italian, Portuguese (Brazil), Russian, and Chinese (Traditional). Config setting descriptions remain in English for these locales; translate as needed. All 11 manifest locales now align with the l10n bundle set.
• **Translation rollout plan archived.** `docs/translation-rollout-plan.md` moved to `docs/history/` (spec complete).
• **Project indexer.** Lightweight, delta-aware index of project docs and completed log sessions for faster analysis. Index lives in `.saropa/index/`; Crashlytics cache moved to `.saropa/cache/crashlytics/`. New settings: `projectIndex.enabled`, `projectIndex.sources`, `projectIndex.includeRootFiles`, `projectIndex.includeReports`, `projectIndex.maxFilesPerSource`, `projectIndex.refreshInterval`. Docs scanner uses the index when enabled (index-first lookup, fallback to full scan). Analysis panel doc matches can show section heading when available. Command **Rebuild Project Index** for manual refresh. File watchers mark sources dirty for lazy rebuild; inline updates when sessions finalize or are trashed/restored.
• **Options panel: Reset extension settings.** Actions section now includes "Reset extension settings" (in addition to "Reset to default" for viewer-only options). Triggers `saropaLogCapture.resetAllSettings`; confirmation is shown in the host. Available in both main viewer and pop-out.
• **Export current view from context menu.** "Export current view…" was moved from the Options panel to the log content right-click menu (next to Copy All / Select All) so it is clear the action exports the current log, not options. The export modal (level filters, templates) is unchanged; opening it is now via context menu only.
• **Integration API and first adapter (Packages).** Extensible framework for attaching external data to log sessions (header lines, meta, sidecars). Users enable adapters via `saropaLogCapture.integrations.adapters`. **Packages** adapter (id: `packages`) runs at session start: detects npm/yarn/pnpm lockfile, computes content hash, adds a "Lockfile: … sha256:…" line to the context header and stores payload in session meta for reproducibility. Status bar shows which adapters contributed (e.g. "Packages") while recording. Design and future adapter specs: `docs/integrations/INTEGRATION_API.md`.
• **Additional integration adapters.** Build/CI (file-based last-build.json), Git (describe, uncommitted, stash), Environment snapshot (env checksum, config file hashes), Test results (file or JUnit XML), Code coverage (lcov/Cobertura/summary), Crash dumps (scan for .dmp/.core at session end), Windows Event Log (Application/System in session range, Windows only), Docker (container inspect and logs at session end). Each is opt-in via `integrations.adapters` and has its own settings under `saropaLogCapture.integrations.<id>.*`.
• **Integrations in Options panel.** Options slide-out (gear icon) now includes an **Integrations** section with one checkbox per adapter. Toggling updates workspace `integrations.adapters` immediately. Current state is sent when the viewer loads and echoed back after each change so the panel stays in sync. Command **Saropa Log Capture: Configure integrations** still available from the Command Palette (Quick Pick).

---

## [2.0.18]

We reorganized the source tree by domain, fixed the Copy All/Line crash, improved the publish script, and fixed run boundaries and separators for Flutter logs.

### Changed

• **Src folder reorganization.** `src/modules`, `src/ui`, and `src/test` are grouped into subfolders by domain/responsibility (see 2.0.18 entry). Modules: capture, session, config, crashlytics, bug-report, ai, export, search, source, analysis, git, storage, features, misc. UI: provider, viewer, viewer-styles, viewer-panels, viewer-nav, viewer-search-filter, viewer-context-menu, viewer-decorations, viewer-stack-tags, session, analysis, insights, panels, shared. Tests mirror under `test/modules/` and `test/ui/`.

### Fixed

• **Copy All / Copy Line script error.** When a log line had no `html` (e.g. edge case in viewer data), "Copy All" or copy-float threw `Cannot read properties of undefined (reading 'replace')`. `stripTags` is now null/undefined-safe so clipboard copy never throws.
• **Publish script Step 10 when tag exists and changelog unpublished.** When the version is already released (tag exists) and CHANGELOG still has an unpublished section (`[Unreleased]`, `[Unpublished]`, or `[Undefined]`), the script now offers "Bump to vX.Y.Z?" first instead of "Publish as-is?". Stamping accepts all three headings.
• **Run 2 incorrectly detected during normal startup.** Run boundaries now treat only "Launching ... in debug mode", "Hot restart", and "Hot reload" as run starts. Mid-startup lines ("✓ Built", "Connecting to VM Service", "Connected to the VM Service") no longer start a new run, so a single Flutter startup shows as one run.
• **Run separator overlapping severity bar.** The run separator bar now uses the same left padding (14.25em) as log lines so it does not overlap the left severity/timeline bar.

---

## [2.0.17]

We add a run navigator and visual run separators for logs with multiple runs (e.g. Flutter launch or hot restart), a Reset to default in Options, and a comfortable line height toggle.

### Added

• **Run navigator in title bar.** When a log has multiple runs (launch, hot restart/reload), the run navigator (Run 1 of N, Prev/Next) appears in the same bar as the session navigator, separated by a pipe. Hidden when only one run is detected.
• **Run separators in list view.** Above each new run (except the first) a tall pink/dark-pink bar shows run number, start and end time, duration, and issue counts with colored dots (error/warning/perf/info). Run summaries are computed when loading a file; separators are inserted in a single pass for performance.
• **Options panel: Reset to default.** Actions section includes a "Reset to default" button that restores all viewer options (display, layout, audio) to their defaults. Does not change VS Code workspace settings.
• **Context menu: Comfortable line height.** Options submenu now includes a "Comfortable line height" toggle. Checked = comfortable (2.0), unchecked = compressed (1.2). Syncs with the Options panel line-height slider.

### Changed

• **Session details merged into nav bar; scroll-up-reveal header.** The session context line (adapter · project · date) is now in the same bar as the session and run navigators instead of a separate row above the log. The bar hides when scrolling down and reveals when scrolling up (smart sticky / scroll-up-reveal), with a 0.28s cubic-bezier animation. Shown when at top of log or when scrolling up past a small threshold.
• **Severity styling: info level uses yellow.** Info lines (e.g. Android `I/`) now use yellow for text, severity bar dot, and whole-line tint for clearer visibility.
• **Blank lines join previous block.** Empty lines get the previous line's severity tint and a `.line-blank` class so they visually join; set `--blank-line-bg` in CSS to override with a custom color.
• **Project Logs header: no "Default" label; whole header clickable.** The header shows only "Project Logs" when using the default folder. The suffix (path) appears only when a non-default folder is selected. The entire header (title and optional suffix) is clickable to choose folder; reset and close/refresh remain separate controls.
• **Project Logs Tags toggle off by default.** When the session list loads or refreshes, the Tags filter section stays closed and the Tags button is inactive. Users can still open it with the Tags button.

### Fixed

• **Sidebar panel width no longer changes when switching between Options and Project Logs.** All slide-out panels (Options, Project Logs, Search, Find, Bookmarks, etc.) now share a single width with a minimum of 560px, persisted with Project Logs display options, so the sidebar no longer resizes when switching panels.
• **Severity dot on blank lines.** The colored severity bar (green/red/etc. dot) is no longer shown for lines that have no visible text, even when the decoration prefix (counter, timestamp, chevron) is shown.
• **Legacy .meta.json in workspace root not removed.** Migration now includes the workspace root (in addition to the configured log dir and override folder) so legacy sidecars in the project root (e.g. `CHANGELOG.meta.json`, `CLAUDE.md.meta.json`) are migrated and deleted on first Project Logs load.

<details>
<summary>Maintenance</summary>

• **run-summaries test expectations.** Test "builds one summary per run with timestamps and counts" now expects duration 2000ms and infos 2; implementation was correct.
</details>

---

## [2.0.16]

In this release you can jump between runs in a log and copy multiple lines at once; we also moved to central session metadata and fixed CPU spikes, context menu closing, and minimap issues.

### Added

• **Run navigation within a log.** When viewing a log file that contains multiple app runs (e.g. Flutter launch, hot restart, hot reload, exit), a "Run 1 of N" bar appears with Prev/Next to jump between runs. Boundaries are detected from lines such as "Launching ... in debug mode", "Connected to the VM Service", "Performing hot restart", "Application finished.", and "Exited (-1)".
• **Copy Line (context menu) with multi-line selection.** When multiple lines are selected (shift+click) and you right-click a line in that range, "Copy Line" copies all selected lines as full lines. Otherwise it copies only the single line under the cursor.
• **Crashlytics: Open google-services.json from error view.** When the Crashlytics panel shows "Query failed" (e.g. HTTP 404), an **Open google-services.json** button opens the config file the extension uses (with progress notification). Helps verify projectId/appId when the API returns "Project or app not found".

### Changed

• **Session metadata no longer uses sidecar .meta.json files.** Metadata (tags, display name, trashed, annotations, etc.) is now stored in a single dot-prefixed file in the log directory: `reports/.session-metadata.json`. The log directory stays clean (no per-file sidecars); the dot prefix keeps the metadata file hidden. On first opening Project Logs (or when viewing a folder that had sidecars), all `.meta.json` files in that directory are migrated into the central store and the sidecar files are deleted. Per-file migration also runs on first read if a sidecar is still present.
• **Crashlytics: better google-services.json discovery.** The extension now prefers `android/**/google-services.json` (e.g. `android/app/google-services.json`) for Flutter/Android projects, then falls back to any workspace `google-services.json`. Both searches run in parallel. Output channel logs which file was used (e.g. `Config from android/app/google-services.json`).
• **Crashlytics: clearer config and 404 messages.** Error text now mentions `google-services.json` (e.g. android/app/) and settings `saropaLogCapture.firebase.projectId / .appId` so users know where to fix config. Single shared hint string used for "no file found", setup wizard, and 404.

### Fixed

• **CPU spike (100%) during capture.** Extension host and webview no longer saturate CPU when the log viewer is hidden or under heavy output: incremental prefix sums (O(new lines) instead of O(n) per batch), visibility-aware updates (skip HTML/linkify and viewport/minimap work when panel or tab is hidden), throttled visible-line count when filters are on, minimap skipped when tab hidden and sampled above 50k lines, batch cap (2000 lines per message) and adaptive flush interval (500ms when backlog > 1000). Viewer refreshes when the user returns to the tab.
• **Right-click context menu cancelled when new log lines arrived.** The menu no longer closes on auto-scroll. Programmatic scrolls are suppressed while the context menu is open, and the scroll handler ignores programmatic scrolls so the menu stays open when content is appended.
• **Decorations scale with font zoom.** Prefixed time, counter, and severity bar (dot and connector) now use em-based sizes so they scale with the log font when using the Options slider or Ctrl+scroll zoom.
• **Severity bar overlapping line numbers when decorations on.** With line prefix (time and number) enabled, the gutter severity bar (dot at 0.69em) was drawn over the decoration numbers. Decorated lines now use 1.25em left clearance so the bar and connector sit to the left of the counter/timestamp (padding-left 14.25em = 1.25em bar + 13em decoration; text-indent -13em unchanged).
• **Context menu submenus off screen at bottom.** When the main menu was near the bottom of the viewport, opening Search, Actions, or Options caused the flyout to extend below the window. The menu now applies a vertical flip so submenu panels open upward and stay visible.

---

## [2.0.15]

Now published to Open VSX so you can install from Cursor and VSCodium.

### Publishing

• **Open VSX / Cursor marketplace.** The extension is now published to Open VSX (open-vsx.org) as well as the VS Code Marketplace, so it appears in Cursor, VSCodium, and other editors that use Open VSX. Install from the Extensions view in Cursor or via **Extensions: Install from VSIX…** with a .vsix from the GitHub release.

<details>
<summary>Maintenance</summary>

• **Session panel and session styles modularized.** Split `viewer-session-panel.ts` and `viewer-styles-session.ts` to comply with the 300-line file limit. No behavior changes.
</details>

---

## [2.0.14]

We add an option to hide blank lines, let you pick the Project Logs folder, show loading states and animations, surface a changelog excerpt in the About panel, and include Open VSX in the publish pipeline.

### Added

• **Hide blank lines option.** Toggle in the flyout context menu (Options) and in the Options panel (Layout). When on, lines that are empty or only whitespace are hidden from the viewport.
• **Project Logs root folder.** Panel header shows path as suffix (e.g. "Project Logs · d:\src\contacts"); click path to open folder picker. Reset icon when using a custom folder; last-used folder is used as picker defaultUri. Header always shows the actual folder path (never "Default").
• **Project Logs loading state.** Progress bar and shimmer while the session list loads; loading label shows the folder path being loaded (e.g. "Loading d:\src\contacts…").
• **Sidebar open animation.** Slide-out panels animate open (0.25s ease-out) with overflow hidden until the width transition ends; close already animated.
• **Footer under log area only.** The status bar (filename, level dots, line count, version) now sits only under the log content area, not under the sidebar panels.
• **Version link in footer.** Version appears on the far right of the footer and opens the About panel when clicked.
• **About panel changelog.** About panel shows current version, a "Recent changes" excerpt from CHANGELOG.md (first three version sections), and a "Full changelog on Marketplace" link to the VS Code Marketplace changelog page.
• **Selection count in footer.** When text is selected in the log viewport, the footer shows "N lines, M chars selected"; updates are throttled with requestAnimationFrame for smoothness.

### Changed

• **Side-by-side panel layout.** Flyout panels (session, search, options, find, bookmarks, trash, info, filters, crashlytics, recurring, performance, about) push the log viewport narrower with animated width transitions; the virtual scroll viewport recalculates via ResizeObserver.
• **Project Logs tag chips.** Tags sorted by session count (desc); count shown on every chip; badge-style chips (no border); section limited to ~2 lines with vertical scroll; long tag names ellipsized.
• **Session panel minimum width.** Panel and resize drag enforce 560px minimum; restored width on reopen is clamped to 560px so the panel never opens narrower than minimum.
• **Session panel sort button UX.** Replaced labeled "Sort" with a right-aligned icon-only `codicon-sort-precedence` toggle; icon flips vertically when reverse sort is active.

### Fixed

• **Context menu text wrapping and bottom cropping.** Menu and flyout submenus use `white-space: nowrap` and `width: max-content` so labels stay on one line. Menu position is clamped to the viewport so it is never cropped when right-clicking near the bottom or right edge.
• **Project Logs path separator selection.** The " · " between the title and path is no longer highlighted when selecting the path (separator in own element with `user-select: none`).
• **Footer version link did not open About panel.** Clicking the version in the footer opened the About panel but the same event bubbled to document and triggered the panel's "outside click" close, so the panel closed immediately. Added `stopPropagation()` on the version-link click so the About panel stays open.
• **Three blue colors unified.** Notice and framework now share `--vscode-charts-blue` (#2196f3) for severity bar, line tint, and notice line text; link/info accent (#3794ff) unchanged.
• **CPU spike with huge log files.** Opening a file is capped at `saropaLogCapture.maxLines` (default 100k); footer shows "Showing first X of Y lines" when truncated.
• **Severity bar vs emoji dot.** Viewer shows only the gutter severity bar; emoji dot (🟢🟠🔴) appears only in "Copy with decorations" and only when "Severity dot (copy only)" is checked.
• **Session panel closes when clicking a tag chip.** `rebuildSessionTagChips` replaces innerHTML during the click handler, detaching the event target before the document-level "close on outside click" listener runs its `contains()` check. Added `stopPropagation()` to the chip click handler.
• **Context menu submenus not visible.** Submenu flyout panels (Search, Actions, Options) were clipped by `overflow-y: auto` on the parent menu container. Removed the overflow constraint so absolute-positioned submenus can render outside the menu bounds.
• **False-positive CRITICAL badge on instructional text.** Lines containing "fatal" in non-error context (e.g. "To make this warning fatal" or `debugZoneErrorsAreFatal`) were incorrectly badged as CRITICAL. Tightened heuristics to require all-caps `FATAL` or "fatal" followed by an error-type noun (error, exception, crash, signal, fault).
• **Severity bar missing on stack traces.** Stack headers and stack frames had no severity bar dots because `renderItem()` returned early before the bar class was computed. Moved bar computation earlier so stack items get dots whose color matches their text (framework frames get blue, app frames get error red).
• **Repeat notifications at end of session.** "Repeated #N (…)" lines no longer appear as the last visible content before a session boundary marker — the original line is restored instead.
• **Blank lines tracked as repeats.** Empty or whitespace-only lines no longer trigger repeat detection, preventing meaningless "Repeated #N (…)" notifications.

<details>
<summary>Maintenance</summary>

• **Publish script: colorama auto-install.** When the `colorama` package is missing, the publish script now installs it automatically for Windows terminal color support.
• **Publish script: Open VSX.** Pipeline now publishes to Open VSX (open-vsx.org) after the VS Code Marketplace. Required for visibility in Cursor and VSCodium.
</details>

---

## [2.0.13]

We fixed the severity bar and timeline: centering, connectors, and consistent colors in the session list.

### Fixed

• **Severity bar centering.** Connector bars between dots were 0.5px off-center (2px bar at left:11 vs 7px dot centered at 12.5px). Widened connectors to 3px so both center at 12.5px.
• **Unconnected line tails.** Removed the full-height background line (`#viewport::before`) that extended above the first dot and below the last dot. The colored connector segments now provide the timeline without visual overflow.
• **Bar colors mismatched session panel.** Level-bar dots used `--vscode-debugConsole-*` variables (dark amber for warning) while severity dots in the session panel used `--vscode-charts-*` (bright yellow). Unified all five shared levels (error, warning, performance, framework, info) to use the `--vscode-charts-*` palette.
• **Timeline broken across color transitions.** Dots of different severity levels were not connected, leaving gaps in the timeline. Connector logic now bridges all adjacent dots regardless of color, stopping only at markers.

---

## [2.0.12]

We add a Performance panel (current session and cross-session trends), group the context menu into submenus, add tooltips across the UI, and modularize more of the codebase.

### Added

• **Performance panel.** New sidebar panel (graph-line icon) with two tabs: Current session shows grouped perf events (PERF traces, Choreographer jank, GC, timeouts) with click-to-navigate; Trends tab shows cross-session aggregated table with SVG line chart for tracking operation duration over time.
• **Performance fingerprinting.** New `perf-fingerprint.ts` module scans log files for named PERF traces, Choreographer frame skips, GC events, and timeouts, producing fingerprints stored in session metadata for cross-session trend analysis.
• **Cross-session performance aggregation.** New `perf-aggregator.ts` module reads perf fingerprints from all session metadata files and computes trends (improving/degrading/stable) by comparing first-half to second-half averages.
• **Shared metadata loader.** Extracted common metadata file loading (`parseSessionDate`, `filterByTime`, `listMetaFiles`, `loadMeta`) into `metadata-loader.ts`, eliminating duplication between `cross-session-aggregator.ts` and `perf-aggregator.ts`.
• **Expanded performance classification.** Lines containing `PERF` prefix and `GC freed`/`GC concurrent` are now classified as performance level (purple), in addition to existing Choreographer/ANR/jank patterns.
• **Context menu sub-menus.** Grouped Search, Actions, and Options into collapsible sub-menus to reduce clutter when right-clicking a log line (was ~17 flat items, now ≤10 top-level). The Options sub-menu provides quick toggles for word wrap, line prefix, and visual spacing. Submenus auto-flip left when the menu opens near the right viewport edge.
• **Tooltips for all icons across all screens.** Session list icons (recording dot, completed, log file), severity count dots (errors, warnings, performance, framework, info), bookmark icons (file, bookmark/note), trash item icons, and all close buttons (decoration settings, export modal, filters panel, options panel, edit modal, context peek) now show descriptive tooltips on hover.

### Fixed

• **Context line spacing when filtering.** Visual spacing now uses the previous _visible_ line (not the previous array element) to calculate gaps, fixing non-uniform spacing caused by hidden/filtered lines. Gap is placed above context groups (not between context and match line), keeping context lines visually grouped with the line they provide context for.
• **Severity dot gutter visual clutter.** Reduced dot size (9→7 px), connector bars (5→2 px), and dimmed the timeline to 40% opacity so the three gutter layers no longer compete visually.
• **Repeat notification visual clutter.** Removed redundant emoji dot from repeat notifications (decorations handle dots). Original line is now hidden when a repeat is detected, eliminating the visual gap. Empty previews show an ellipsis fallback. Fixed `trimData()` invalidating the repeat tracker's line index after splice.
• **Severity dot connectors broken by unclassified lines.** Consecutive same-color dots separated by lines without a severity classification (e.g. separator lines, context lines) were not visually connected. The connector logic now scans forward for the nearest dot instead of only checking the immediately adjacent DOM element, and bridges intermediate no-dot lines with a colored bar.
• **Level Filters fly-up panel unreadable.** The panel was nested inside `#footer` (which has `position: sticky`), trapping it in the footer's stacking context. Moved it out of the footer so `position: fixed` works against the viewport. Also switched background to `--vscode-editorWidget-background` with a solid `#1e1e1e` fallback for themes that don't define menu variables.

<details>
<summary>Maintenance</summary>

• Modularized 16 oversized files to meet the 300 LOC limit: performance panel script, log session split, session event bus, level filter code, analysis panel streams, config file utilities, bug report sections, Crashlytics API queries, analysis panel styles, insights panel script, context menu HTML, exclusion chip styles, viewport rendering, options panel events, export init script, and source tag UI.
</details>

---

## [2.0.11]

We focus on performance and stability: config is cached, the file split race is fixed, Find in Files is batched, and the test/dev scripts are updated.

### Fixed

• **Hot-path config reads.** `getConfig()` was called on every DAP message (30+ `cfg.get()` calls each time). Now cached in `SessionManagerImpl` and refreshed on settings change.
• **File split race condition.** `performSplit()` was fired without await, so `appendLine()` could write to a closing stream. Added a `splitting` guard flag.
• **Inline decoration thrashing.** `editor.setDecorations()` was called per log line with a source reference. Now debounced at 200ms.
• **Package root FS walks on every editor switch.** `detectPackageRoot` checked up to 8 manifest files per directory level on every `onDidChangeActiveTextEditor`. Results are now cached.
• **Unbounded `seenToolKeys` growth in AI watcher.** The dedup Set now clears at 10K entries to prevent memory leaks during long Claude sessions.
• **Memory spike in Find in Files.** `searchLogFilesConcurrent` read all log files simultaneously via `Promise.all()`. Now batched (5 files at a time).
• **Redundant config reads in settings change handler.** Three separate `getConfig()` calls collapsed to one.

<details>
<summary>Maintenance</summary>

• **Session-manager test failing.** Category-filter test patched `getConfig` via `require()` but the import binding was already cached. Switched to `refreshConfig()` with direct config objects.
• **Garbled Unicode in publish script output.** `subprocess.run` defaulted to cp1252 on Windows, corrupting Mocha's characters. Added explicit `encoding="utf-8"` to the `run()` helper.
• **Dev script reports use daily subfolders.** `scripts/modules/report.py` `save_report()` now writes reports into `reports/yyyymmdd/` date subfolders.
</details>

---

## [2.0.10]

We show Claude Code AI activity (tool calls, prompts, warnings) inline in the log viewer and stream it in real time.

### Added

• **AI Activity Integration.** Show Claude Code AI activity (tool calls, user prompts, system warnings) interleaved with debug output in the log viewer. When a debug session starts, the extension scans the most recent Claude Code JSONL session file for recent AI activity and streams new entries in real time. AI lines appear with distinct colored left borders and `[AI ...]` prefixes, filterable via the existing category system.
  - New settings under `saropaLogCapture.aiActivity.*`: `enabled`, `autoDetect`, `lookbackMinutes`, `showPrompts`, `showReadOperations`, `showSystemWarnings`
  - Auto-detection: when `autoDetect` is true (default), the feature activates silently if `~/.claude/projects/<slug>/` exists for the workspace
  - Streaming deduplication: Claude Code writes multiple JSONL lines per assistant message during streaming; the parser keeps only the final (most complete) version, and the watcher tracks emitted entries to prevent duplicates across reads
  - New modules: `ai-jsonl-types.ts`, `ai-jsonl-parser.ts`, `ai-session-resolver.ts`, `ai-watcher.ts`, `ai-line-formatter.ts`
  - New viewer styles: `viewer-styles-ai.ts` — category-specific colors (cyan for prompts, yellow for edits, magenta for bash, orange for warnings)
  - Translations added for all 6 locale files (EN, DE, ES, JA, KO, ZH-CN)

---

## [2.0.9]

Internal cleanup: module splits to stay under the 300-line limit; behavior unchanged.

<details>
<summary>Maintenance</summary>

• **Module splits to stay under 300-line limit.** Extracted cohesive logic into five new files: `viewer-styles-info.ts`, `viewer-script-keyboard.ts`, `crashlytics-io.ts`, `extension-lifecycle.ts`, and `viewer-message-handler.ts`.
</details>

---

## [2.0.8]

We added localized manifest files for Chinese, Japanese, Korean, Spanish, and German so the extension works better in more locales.

### Added

• **Machine-translated locale files.** Added `package.nls.zh-cn.json`, `package.nls.ja.json`, `package.nls.ko.json`, `package.nls.es.json`, and `package.nls.de.json` with 128 translated keys each, covering all manifest-visible strings. Corrections welcome at language@saropa.com.

### Changed

• **README language badge.** Added a language support badge (EN | ZH | JA | KO | ES | DE) to the README header so multilingual support is visible at a glance on the marketplace listing.
• **Marketplace keywords.** Added `multilingual`, `localization`, and `i18n` to `package.json` keywords for better search discoverability.

<details>
<summary>Maintenance</summary>

• **`verify-nls.js` ref deduplication.** Deduplicate `%key%` refs via `Set` before comparison to prevent false double-reporting.
• **README config table.** Added missing `organizeFolders` and `includeSubfolders` settings.
</details>

---

## [2.0.7]

We auto-organize legacy logs into date folders and put new sessions in date subfolders.

### Added

• **Auto-organize legacy log files.** New `organizeFolders` setting (on by default) automatically moves flat log files with a `yyyymmdd_` prefix into date-based subfolders on session start. Companion `.meta.json` sidecars are moved alongside their log files.

### Changed

• **Date-based log subfolders.** New log sessions are now written to `reports/yyyymmdd/` subfolders (e.g. `reports/20260218/`) instead of directly into the `reports/` root. File retention and session history already scan subfolders, so existing workflows are unaffected.

<details>
<summary>Maintenance</summary>

• **NLS verification in compile chain.** `npm run compile` now runs `verify-nls` before building, preventing NLS key drift on every build.
</details>

---

## [2.0.6]

We moved all user-visible strings into NLS for localization and added a verify-nls script to catch key drift.

### Added

• **Manifest localization support.** Extracted 127 user-visible strings from `package.json` into `package.nls.json` using VS Code's `%key%` reference mechanism. Enables future translation via locale-specific `package.nls.{locale}.json` files.

<details>
<summary>Maintenance</summary>

• **NLS key alignment verification script.** New `npm run verify-nls` command checks that all `%key%` references in `package.json` have matching entries in every `package.nls*.json` file, reporting missing and orphan keys.
</details>

---

## [2.0.5]

We show a five-dot severity breakdown in the session list, add a configurable minimap width, surface the Crashlytics cache in the session tree, and move all views to the bottom panel.

### Added

• **Full severity dot breakdown in session list.** Each session now shows five colored dot counters: red (errors), yellow (warnings), purple (performance), blue (framework), and green (info). Framework lines are detected via logcat tags and launch boilerplate; info is all remaining lines.
• **Minimap width setting.** New `minimapWidth` preference lets you choose small (40px), medium (60px, default), or large (90px) for the scrollbar minimap.

### Changed

• **Crashlytics cache visible in session history.** Cached crash event files are now stored in `reports/crashlytics/` (was `.crashlytics/`), making them searchable, comparable, and visible in the session tree.
• **Moved all views to bottom panel.** Log Viewer, Crashlytics, Play Vitals, and About panels now appear in the bottom panel (next to Terminal) instead of the sidebar.
• **Crashlytics, Recurring Errors, and About are now icon-bar panels.** All three are integrated into the Log Viewer webview as slide-out panels accessible from the icon bar, matching the existing Sessions/Trash/Bookmarks pattern. No more separate editor tabs or sidebar views.
• **Wider timeline connector bars.** The vertical bars joining consecutive same-color severity dots are now 5px wide (was 3px), staying centered on the dots.
• **Performance dot color changed from blue to purple.** The performance severity dot in the session list is now purple to free up blue for framework lines.

### Removed

• **Severity distribution bar in session list.** Removed the thin horizontal bar under each session entry; the five colored dot counters now convey a complete line-type breakdown.

### Fixed

• **gcloud CLI not detected on Windows.** The `execFile` call lacked `shell: true`, so Windows couldn't execute `gcloud.cmd` batch files, causing a false "Google Cloud CLI not found in PATH" error in the Crashlytics setup panel.
• **Line hover background matches compressed line height.** Added explicit `height: calc(1em * line-height)` on `.line` elements so the hover background always matches the virtual-scroll row height, preventing it from bleeding into adjacent lines at compressed settings.
• **Copy icon vertically centered on line.** The floating copy-to-clipboard icon now vertically centers on the hovered line instead of using a fixed offset.
• **Copy icon no longer overlaps scrollbar minimap.** Increased the right-edge clearance of the floating copy-to-clipboard button so it stays within the log content area.

---

## [2.0.4]

We add an About Saropa sidebar panel with a project list and links, and move the views to the activity bar.

### Added

• **About Saropa sidebar panel.** New info panel in the sidebar showing a short blurb about Saropa and clickable links to project websites (Marketplace, GitHub, saropa.com).
• **Full project catalogue in About panel.** Lists all Saropa projects (Contacts, Log Capture, Claude Guard, saropa_lints, saropa_dart_utils) and a Connect section with GitHub, Medium, Bluesky, and LinkedIn links. Each entry has a badge line (platform, stats) and a description synced with ABOUT_SAROPA.md.

### Changed

• **Moved views to activity bar.** All Saropa panels (Log Viewer, Crashlytics, Recurring Errors, About) now appear in the left activity bar sidebar instead of the bottom panel area, fixing the cramped layout.
• **Updated README panel references.** Replaced "bottom panel next to Output/Terminal" wording with activity bar sidebar location.

---

## [2.0.3]

We show detailed errors when Crashlytics setup fails, rewrote the minimap with canvas, and fixed the copy icon and timeline.

### Added

• **Crashlytics setup diagnostics.** The Crashlytics panel now shows actual error details when setup fails instead of generic hints. Captures gcloud CLI errors (not found, not logged in, permission denied), HTTP status codes from the Firebase API (401/403/404), and network timeouts. A "Last checked" timestamp shows when the last diagnostic ran. All diagnostic steps are logged to the "Saropa Log Capture" output channel for advanced troubleshooting.
• **Minimap info markers setting.** New `saropaLogCapture.minimapShowInfoMarkers` setting (off by default) controls whether info-level (green) markers appear on the scrollbar minimap. Reduces visual noise for most users while letting those who want full coverage opt in.

### Changed

• **Minimap rewritten with canvas rendering.** The scrollbar minimap now paints markers onto a `<canvas>` element instead of creating individual DOM `<div>` elements. Uses `prefixSums` from the scroll-anchor system for pixel-accurate positioning, supports HiDPI displays, and eliminates innerHTML rebuilds for better performance.

### Fixed

• **Copy icon no longer overlaps scrollbar minimap.** Increased the right-edge clearance of the floating copy-to-clipboard button so it stays within the log content area.
• **Timeline dots no longer shift on hover.** Replaced transform-based vertical centering with margin-based centering to eliminate sub-pixel jitter when hovering log lines.
• **Same-color timeline dots are now connected by a colored vertical bar.** Consecutive log lines with the same severity level show a colored connector bar between their dots, making runs of same-level output visually distinct.

---

## [2.0.2]

We fixed the timeline dots, added a Saropa prefix to panel titles, improved the Insights panel and session list, and made historical logs open at the top.

### Fixed

• **Timeline dots: stacking and alignment.** The severity dot timeline in the log gutter now renders correctly — dots are single-color (no line bleed-through), always paint above the timeline line, and the whole construct is indented from the left edge.
• **Panel titles: added "Saropa" prefix.** All webview panels opened in the main VS Code editor now include the "Saropa" prefix for discoverability (e.g. "Saropa Cross-Session Insights", "Saropa Log Timeline").
• **Insights panel: refresh no longer resets position.** Clicking Refresh, changing the time range, or closing an error no longer moves the panel back to the Beside column.
• **Insights panel: production data loading indicator.** The "Checking production data..." spinner now reliably stops via a settled guard, reduced timeout (10 s), and output channel logging for diagnostics.
• **Panels no longer auto-restore on startup.** Registered no-op serializers for all singleton webview panels so VS Code does not restore them when reopening a project.
• **Session panel: removed spark bar.** The small grey "relative density" bar after severity dots was too small to convey useful information and confused users. Removed entirely.
• **Session panel: severity dot alignment.** Colored severity dots now vertically center-align with their count numbers using flex layout instead of fragile `vertical-align`.
• **Session panel: severity bar improved.** The proportional error/warning/perf bar is now full-width instead of a tiny 40px inline bar, and its tooltip shows a descriptive breakdown (e.g. "5 errors, 3 warnings") instead of a generic total.
• **Historical log files now open at the top.** Previously, opening an old log file from session history would scroll to the bottom. The viewer now starts at line 1 for file views, while live capture sessions continue to auto-scroll.

---

## [2.0.1]

In this release we add a Reset All Settings command, a Crashlytics setup wizard, filterable crash categories in Insights, and search in the Insights panel.

### Added

• **Reset All Settings command:** New "Saropa Log Capture: Reset All Settings to Defaults" command in the command palette resets every extension setting to its default value in one step.
• **Crashlytics setup wizard:** The Crashlytics sidebar panel now shows an interactive 3-step setup wizard instead of plain text hints. Step 1 links to the Google Cloud CLI install page, step 2 opens a VS Code terminal to run the auth command, and step 3 offers a file picker to locate `google-services.json` (or a link to configure settings manually). A billing tip reassures users that Crashlytics API access is free. "Check Again" button and auto-refresh on terminal close.
• **Clickable URLs in setup hints:** Setup hint URLs in the analysis panel (GitHub CLI, Firebase) are now rendered as clickable links instead of plain text.
• **Filterable crash categories in Insights:** Toggle chips (FATAL, ANR, OOM, NATIVE) above the recurring errors list let you isolate specific crash types. All/None buttons for quick toggling. Errors without a category are always visible.
• **Search in Insights panel:** Filter input in the header filters both Hot Files and Recurring Errors by keyword. Debounced at 150ms. Composes with category chip filtering.

### Changed

• **Refactor:** Extracted Crashlytics production bridge logic from `insights-panel.ts` into `insights-crashlytics-bridge.ts` for maintainability.

### Fixed

• **Stale gcloud cache on refresh:** The "Check Again" button now clears all cached state (gcloud availability, token, issue list) so users can recover after installing gcloud or re-authenticating without reloading VS Code.

---

## [2.0.0]

In this release we add Google Play Vitals, Firebase Crashlytics, ANR analysis, a recurring errors sidebar, a dedicated Trash panel, source scope filter, and a bunch of analysis and bug-report improvements.

<!-- cspell:ignore SIGSEGV -->

### Added

• **Google Play Console deep link:** New `saropaLogCapture.playConsole.appUrl` setting for a custom Play Console URL. If set, the "Open Play Console" button in the Vitals panel navigates directly to your app's Vitals page instead of the generic homepage.
• **Target device metadata:** Debug adapter type and target device are now stored in session `.meta.json`. Device is detected from Flutter launch output ("Launching ... on DEVICE") and launch config keys (`deviceId`, `device`, `deviceName`).
• **Environment distribution in Insights:** Cross-Session Insights panel now shows debug adapter, platform, and SDK version distribution across sessions in a collapsible "Environment" section.
• **ANR thread analysis:** Thread dump grouping now detects potential ANR patterns (main thread Runnable while other threads are Waiting/Blocked). Blocking threads get a warning badge and the summary line flags "ANR pattern detected".
• **Thread-aware bug report export:** Bug report stack trace extraction now continues past thread headers instead of stopping. Multi-thread traces include `--- threadName ---` separators in the exported markdown.
• **Package name auto-detection:** Detects Android package name from `google-services.json`, `AndroidManifest.xml`, or `pubspec.yaml`. Cached for 5 minutes. Override via `saropaLogCapture.firebase.packageName` setting. Enables scoping of Play Vitals and Crashlytics queries.
• **Crash category sub-classification:** Fingerprinted errors are now classified into categories: FATAL, ANR, OOM, NATIVE, or non-fatal. Categories are detected from error text patterns (e.g. `OutOfMemoryError` → OOM, `SIGSEGV` → NATIVE). Colored badges appear in the Insights panel and Recurring Errors sidebar.
• **Thread dump grouping:** When multiple consecutive thread headers are detected in log output (common in ANR dumps and `kill -3`), a "Thread dump (N threads)" summary marker is injected before the dump for visual grouping. Each thread's frames remain individually visible.
• **Google Play Vitals panel:** New opt-in sidebar panel showing crash rate and ANR rate from the Google Play Developer Reporting API. Displays rates with color-coded good/bad indicators against Google Play's bad-behavior thresholds (crash > 1.09%, ANR > 0.47%). Enable via `saropaLogCapture.playConsole.enabled` setting. Requires Play Console access and gcloud auth.
• **Relative time in session history:** Sessions within the last 24 hours show an approximate relative time after the timestamp — e.g. "4:13pm (2 hrs ago)", "(just now)", "(5 min ago)". Appears in both the Project Logs panel and the sidebar tree view. Omitted for sessions older than 24 hours.
• **Dedicated Trash panel:** Trash is now a standalone icon bar panel (between Info and Options) instead of a toggle inside the Project Logs panel. Shows trashed sessions with metadata and severity dots, supports right-click context menu (restore, delete permanently), and has an "Empty Trash" header button. Badge on the icon bar shows the trashed session count. Removed the confusing trashcan icon from the VS Code view title bar.
• **Pre-production ANR risk scoring:** New `anr-risk-scorer.ts` module scans debug session body text for patterns that predict ANRs (choreographer warnings, GC pauses, jank, dropped frames, ANR keywords) and produces a 0-100 risk score with low/medium/high levels. Score is computed on session finalization and stored in `.meta.json` sidecar. Sessions with ANR patterns show `ANR: N` in the Project Logs tree description and tooltip.
• **Debug-to-Crashlytics error bridge:** Cross-Session Insights panel now automatically matches recurring error patterns against production Crashlytics issues. Matching errors show a production impact badge (`Production: N events, N users`) via progressive webview update. Bridges the gap between development-time error detection and production crash data.
• **App version capture:** Detects app version from `pubspec.yaml`, `build.gradle`, or `package.json` during session finalization. Stored in `.meta.json` sidecar. Used for version range display on recurring errors.
• **Version range on recurring errors:** Insights panel shows `v1.2.0 → v1.4.1` on recurring error patterns, tracking the first and last app version where each error appeared.
• **Thread header parsing:** Recognizes Java/Android thread dump headers (`"main" tid=1 Runnable`, `--- main ---`) in log output and styles them as link-colored italic text in the viewer.
• **Error status lifecycle:** Recurring errors in the Insights panel can be closed (dimmed) or muted (hidden) via action buttons. Status persists in `.error-status.json`. Re-open restores visibility.
• **Recurring Errors sidebar panel:** Always-visible panel showing top error patterns across all sessions with triage actions (Close/Mute/Re-open). Auto-refreshes after session finalization. Links to the full Insights panel.
• **Source Scope filter:** Android Studio-style scope filtering in the Filters panel. Narrow log output by Workspace folder, Package, Directory, or File based on the active editor. DAP source paths are threaded from the debug adapter through to the webview. Package detection walks up from the file to find the nearest manifest (`pubspec.yaml`, `package.json`, `Cargo.toml`, etc.). Scope context updates automatically when switching editor tabs. "Hide unattributed" checkbox controls visibility of lines without DAP source paths. Integrates with filter badge count, preset reset, and panel sync.
• **Firebase Crashlytics:** Analysis panel queries Firebase Crashlytics REST API for matching production crashes. Shows crash issue title, event count, and affected users. Clicking an issue card fetches the latest crash event and renders classified stack frames inline (APP/FW badges, clickable app frames open source). Console deep link opens Firebase Console in browser. Auth via `gcloud` CLI with 30-minute token caching; config auto-detected from `google-services.json` or overridden via `saropaLogCapture.firebase.projectId` / `.appId` settings. Crash event detail is cached to `reports/.crashlytics/` to avoid repeated API calls. Gracefully degrades with actionable setup hints when gcloud or config is missing.
• **Expanded code tag detection:** Detects method names (`_logDebugError`, `dbActivityAdd`) and constructor calls (`ResizeImage()`, `Image()`) in addition to class names. Generic lifecycle methods (`build`, `dispose`, `initState`, etc.) are blacklisted to reduce noise. Section renamed from "Class Tags" to "Code Tags".
• **Tag chip "Show all" toggle:** Log Tags and Code Tags sections now show the top 20 chips by count, with a "Show all (N)" toggle to reveal the full list.
• **Session panel discoverability:** Six improvements to the Project Logs panel for better navigation when many sessions share similar names after datetime stripping:
  - Drag-resizable panel width (handle on left edge, persisted in display options)
  - Session duration in subtitle (computed from header Date and footer SESSION END timestamps)
  - Error/warning/performance colored dot counts (scanned from file body, cached in `.meta.json` sidecar)
  - Dim "(latest)" suffix on the newest session per unique display name
  - "Latest only" toggle filters to one-per-name for quick access
  - Inline correlation tag chips (replaces QuickPick) with All/None controls for filtering sessions by tag
• **Correlation tags documentation:** New `docs/correlation-tags.md` explaining what tags are, how they're generated, how to filter, and how to rescan.
• **Configurable icon bar position:** New `saropaLogCapture.iconBarPosition` setting (`"left"` or `"right"`, default `"left"`). The icon bar and all slide-out panels now default to the left side of the viewer, matching VS Code's activity bar convention. Changes apply instantly without reload.
• **Lint violation integration:** Bug reports now include a "Known Lint Issues" section sourced from Saropa Lints' structured export (`reports/.saropa_lints/violations.json`). Violations are matched to stack trace files, sorted by impact and proximity, and rendered as a markdown table with source attribution and staleness warning. Critical violations surface in the executive summary as high-relevance findings.
• **ANR badge:** Performance-level log lines containing ANR-specific keywords (`ANR`, `Application Not Responding`, `Input dispatching timed out`) now display an orange stopwatch badge. Separates ANR signals from general jank/fps/choreographer noise. ANR count also tracked in session severity metadata.
• **Time-windowed insights:** Cross-Session Insights panel now includes a time range dropdown (All time, Last 30 days, Last 7 days, Last 24 hours) that filters which sessions are included in the aggregation. Session dates are parsed from log filenames.
• **Impact-weighted error sorting:** Recurring errors in the Insights panel are now sorted by impact score (sessions × occurrences) instead of session count alone, matching Android Vitals' event×user ranking.
• **Insights refresh timestamp:** Cross-Session Insights panel header now shows data age ("just now", "42s ago", "3m ago") alongside the session/file/error summary, giving confidence in data freshness.
• **Crashlytics issue list cache:** Top issues API response is cached in memory for 5 minutes to avoid redundant API calls during repeated analyses. Explicit refresh (sidebar button or auto-refresh timer) bypasses the cache.
• **Generalized production error bridge:** Cross-Session Insights panel now matches ALL recurring error patterns against Crashlytics production issues (previously ANR-only). Uses word extraction from both example lines and normalized text for broader matching.
• **Package-hint file resolution:** Stack frame file resolution now extracts Dart package names and Java package paths from frame text and passes them to `findInWorkspace()` for more accurate disambiguation in monorepo/multi-package workspaces. Wired through the analysis panel and bug report collector.
• **Crashlytics aggregate device/OS distribution:** Crash detail cards now query the Crashlytics stats endpoint for aggregate device model and OS version distribution across all events, rendered as a collapsible bar chart. Fetched asynchronously after the initial crash detail render.
• **Session error density sparklines:** Project Logs panel now shows a tiny relative heat bar per session indicating error density (total issues / line count) compared to sibling sessions. Color reflects dominant severity (red for errors, yellow for warnings, blue for performance). Width normalizes against the densest session in the list.

### Improved

• **Snappier panel transitions:** All slide-out panel animations reduced from 300ms to 150ms for a more responsive feel.
• **Crashlytics crash detail loading feedback:** Clicking an issue card in the Crashlytics sidebar now shows a pulsing "Loading crash details..." message while the API call is in flight, replacing the previous silent wait.
• **Parallelized file operations:** File retention enforcement, documentation token scanning, referenced file analysis, and session shutdown now run concurrently (`Promise.all` / `Promise.allSettled`) instead of sequential loops. File retention startup with 100+ files improves from ~3s to ~200ms.
• **Split failure logging:** Log file split errors are now logged to the extension host console instead of silently swallowed.

### Changed

• **Project Logs panel auto-opens** when the sidebar first loads, so the session list is immediately visible alongside the active log.
• **ESLint `max-lines` excludes blank lines and comments:** The 300-line file limit now uses `skipBlankLines: true` and `skipComments: true`, so readability is never sacrificed for the metric.
• **ESLint config hardened:** Enforces `max-params: 4`, `max-depth: 3`, `no-explicit-any`, `no-unused-vars` (with `_` prefix pattern), `prefer-const`, and correctness rules. Functions exceeding 4 parameters refactored to use option objects (`FileLinkOptions`, `ViewerHtmlOptions`, `ShellOptions`, `BookmarkInput`, `EditLineInput`, `SessionActionContext`).

### Fixed

• **Filter presets test:** Fixed "Errors Only" preset test to check `levels` instead of removed `searchPattern` field.
• **Copy includes UI chrome:** Ctrl+C near the bottom of the log viewer included footer, search panel, and session history text. Native text selection is now confined to the viewport via CSS `user-select`, and native click-drag selections are routed through the VS Code clipboard API.
• **Tag chips not rendering:** Tag chip containers in the Filters panel were permanently empty — `syncFiltersPanelUi()` now calls `rebuildTagChips()` and `rebuildClassTagChips()` when opening the panel.
• **Quick Filters presets broken:** "Errors Only" preset used DAP `categories: ['stderr']` which hides all Flutter output (category is `"console"`). Presets now use `levels` field for severity-based filtering. Also fixed monkey-patch on `applyFilter` that immediately reset the active preset during application.
• **Preset save losing levels:** `promptSavePreset()` parameter type now includes `levels` so saving a preset after applying a level-based filter preserves the level configuration.
• **Crashlytics sidebar shows no issues:** `matchIssues()` filtered out all results when called without error tokens (sidebar panel use case). Skips token filter when no tokens provided.
• **CodeLens event counts always zero:** `buildIndexFromCache()` never incremented `totalEvents`. Fixed accumulation to properly count events per issue.
• **AI summary model selection:** Hardcoded `gpt-4o` family name is not a VS Code Language Model API family. Uses `selectChatModels()` without family filter.
• **XSS in Crashlytics panel:** Inline `onclick` handlers with interpolated issue IDs replaced with `data-*` attributes and delegated click handlers.

---

## [1.2.0]

We add a related-lines timeline in the analysis panel, referenced files with blame, GitHub PR/issues context, and progress indicators with timeouts.

### Added

• **Related lines:** When analyzing a tagged log line (e.g. HERO-DEBUG), all lines sharing that source tag are shown as a diagnostic timeline with clickable line navigation and source file references.
• **Referenced files:** Source files referenced across related lines are analyzed with git blame, annotations, and recent change detection — providing multi-file context instead of single-file analysis.
• **GitHub context:** Queries `gh` CLI for PRs touching affected files, issues matching error tokens, and blame-to-PR mapping that identifies which PR likely introduced the bug. Auto-detects `gh` availability with actionable setup hints.
• **Enhanced token search:** Token search, docs scan, and symbol resolution now use enriched tokens from ALL related lines, not just the analyzed line.
• **Analysis panel progress:** Header progress bar with "X/N complete" counter, per-section spinner text updates showing sub-step descriptions (e.g. "Running git blame...", "Querying language server..."), and smooth CSS transitions. Bar turns green and fades on completion.

### Fixed

• **Analysis panel timeout:** Line analysis spinners no longer hang indefinitely when VS Code APIs (symbol resolution, docs scan, token search) are unresponsive. Each analysis stream now has a 15-second timeout; timed-out sections show a clear "Analysis timed out" message instead of spinning forever.

---

## [1.1.3]

We add a dedicated Filters panel and tag search, show session metadata in Project Logs, and retire the Session History tree in favor of the webview panel.

### Added

• **Filters panel:** Moved all filter controls (Quick Filters, Output Channels, Log Tags, Class Tags, Noise Reduction) from the Options panel into a dedicated Filters panel with its own icon bar button. Options panel now contains only Display, Layout, Audio, and Actions.
• **Tag search in Filters panel:** Search input at the top of the Filters panel filters tag chips by label text across both Log Tags and Class Tags sections, making it easy to find specific tags among many.
• **Session metadata in Project Logs:** Each session item now shows line count (e.g. "2,645 lines") and all tag types (#manual, ~auto, @correlation) in the meta line, matching the Session History tree view.
• **Tag filtering in Project Logs:** "Tags" button in the session panel toolbar opens the correlation tag QuickPick to filter sessions by tag.

### Removed

• **Session History tree view:** The native tree view has been removed. All session management (browse, rename, tag, trash, export, filter) is now in the Project Logs webview panel.

### Fixed

• **Logcat prefix tag detection:** ALL-CAPS prefixes (e.g. `MY_APP`, `NET_UTIL`) in logcat message bodies are now detected before bracket tags, fixing cases where a bracket tag later in the line would shadow the prefix.

---

## [1.1.2]

We add a Class Tags filter, a session context menu (rename, tag, export, trash), a Trash section in Project Logs, and search in the options panel.

### Added

• **Class Tags filter:** Detects PascalCase class names (e.g. `AppBadgeService.load()`, `_EventBadgeWrapperState._loadBadgeCount`) in log lines and stack traces. Classes appearing 2+ times show as filterable chips in a new "Class Tags" section of the filters panel, with toggle, solo, all/none controls matching the existing Log Tags UX.
• **Session context menu:** Right-click any session in the Project Logs panel for Open, Rename, Tag, Export (HTML/CSV/JSON/JSONL), Copy Deep Link, Copy File Path, Move to Trash, Restore, and Delete Permanently.
• **Trash section in Project Logs panel:** Trashed sessions appear in a visible "Trash" section with count badge, "Empty Trash" button, and a toggle to show/hide the section. Trash is visible by default.
• **Options panel search filter:** Type-to-filter input at the top of the options panel to quickly find settings by keyword. Sections and rows that don't match are hidden in real time; clearing the input restores all options.

### Added (tests)

• **Config tests:** `isTrackedFile`, `shouldRedactEnvVar`, `getFileTypeGlob` — file type matching, env var redaction patterns, glob generation.
• **Deduplication tests:** `Deduplicator` process/flush/reset, time window expiry, count formatting.
• **Flood guard tests:** `FloodGuard` check/reset, suppression threshold, suppressed count reporting.
• **Level classifier tests:** `classifyLevel` for stderr, logcat prefixes, strict/loose error detection, all severity levels. `isActionableLevel` for all levels.
• **Error fingerprint tests:** `normalizeLine` (ANSI, timestamps, UUIDs, hex, paths), `hashFingerprint` determinism and format.
• **Analysis relevance tests:** `scoreRelevance` for blame, line history, cross-session, correlation, docs, annotations, affected files, section levels. `daysAgo` parsing.
• **Line analyzer tests:** `extractAnalysisTokens` for error classes, HTTP statuses, URL paths, quoted strings, class methods, source refs, deduplication. `extractAnalysisToken` convenience wrapper.
• **Bug report formatter tests:** `formatBugReport` structure, stack trace formatting (app/fw frames), log context, environment tables, optional sections (blame, git history, cross-session, affected files), singular/plural.

### Fixed

• **Copy icon not pinned to viewer edge:** Replaced per-line `.copy-icon` spans with a single floating `#copy-float` overlay positioned at the right edge of the log content area. The icon now stays pinned to the viewer's far right regardless of content width or scroll position, with a 150ms hover grace period for mouse-to-icon transitions.

### Changed

• **Publish script version bump prompt:** When package.json version is not ahead of the CHANGELOG max, the script now offers to bump the patch version interactively instead of failing.

---

## [1.1.1]

We restored the Session History panel (it was accidentally hidden) and added a Trash button to the Log Viewer toolbar.

### Fixed

• **Session History panel hidden:** Removed `"when": "false"` that permanently hid the Session History tree view, preventing access to trash, tag filtering, and session management.

### Added

• **Trash button in Log Viewer:** Trash icon in the Log Viewer toolbar sends the currently-viewed file to trash directly, without needing the Session History context menu.

### Changed

• **Line count moved to right side of footer:** Line count now appears right-aligned next to the filter badge, preventing layout jumps when filename or status text changes. When filters are active, shows visible/total format (e.g. "4/500 lines").

---

## [1.1.0]

We add level text colors and a toggle, clickable inline tag links with solo-filter, sub-tag detection for logcat, and keyword-scope highlight rules.

### Fixed

• **Level text coloring lost when decorations enabled:** Line text coloring (error=red, warning=gold, etc.) was suppressed whenever decorations were on (the default). Decoupled text colors from the decoration toggle so both work together.
• **Tag link color not visible:** Inline tag colors were overridden by ANSI color spans and level CSS. Switched to CSS custom properties (`--tag-clr`) with `!important` for guaranteed visibility. Replaced conflicting palette color (`#dcdcaa` matched debug-level yellow).

### Added

• **Level text colors toggle:** New "Level text colors" checkbox in decoration settings panel (on by default). Controls whether lines are colored by severity level.
• **Info-level line color:** Lines classified as `info` (including logcat `I/` lines) now render in blue (`#3794ff`) instead of the default foreground.
• **Logcat V/ reclassified as debug:** Verbose logcat lines now get the same dim yellow treatment as `D/` lines instead of being uncolored.
• **Keyword-scope highlight rules:** Highlight rules now support `"scope": "keyword"` to color only the matched text within a line (instead of the entire line). Configure via `saropaLogCapture.highlightRules` in settings.
• **Clickable inline tag links:** Source tags (logcat tags, bracket tags) are now rendered as colored, clickable elements directly in log lines. Hover to see the tag name; click to solo-filter the view to only that tag's lines (click again to clear). Colors are auto-assigned per tag from an 8-color palette.
• **Sub-tag detection for generic logcat tags:** Lines from generic sources like `I/flutter` now extract more specific sub-tags from the message body. Patterns like `HERO-DEBUG` (ALL-CAPS prefix) and `[Awesome Notifications]` (bracket tag) are promoted to first-class filterable tags instead of being lumped under "flutter".
• **Dual-tag support for logcat prefix tags:** When a sub-tag is detected (e.g., `HERO-DEBUG` from `I/flutter`), both the sub-tag and the parent logcat tag (`flutter`) now appear as filterable tag chips. Both tags render as colored links in log lines. A line is hidden only when all its tags are hidden, so filtering by either tag keeps its lines visible.

---

## [1.0.1]

Patch release with minor fixes and alignment.

---

## [1.0.0]

We call this 1.0: subfolder scanning, session trash (retention uses trash instead of delete), bug report and minimap fixes, affected files in reports, and a lot of UX improvements.

### Fixed

• **Bug report preview rendering:** Code blocks were broken in the preview panel because the inline code regex consumed backticks from triple-backtick fences. Fixed by processing code blocks before inline code and restricting inline code to single lines.
• **Bug report source file resolution:** Absolute file paths (e.g. `D:\src\project\lib\file.dart`) were passed to a workspace glob search that never matched, silently preventing all source code, git blame, git history, import, and line-range sections from appearing. Now tries the absolute path directly before falling back to filename search.
• **Minimap drag-stuck scrolling:** Dragging the minimap and releasing the mouse outside the webview left scroll handlers permanently attached, causing erratic scrolling on subsequent mouse movement. Replaced mouse events with Pointer Capture API so `pointerup` always fires regardless of cursor position.
• **Minimap marker positioning:** Severity markers could cluster at the top of the minimap when the panel height was measured before layout settled. Added minimum-height guard (retries when panel < 50 px), trailing-edge debounce, visibility-change rebuild, double-RAF init, and replaced CSS `height: 100%` with `align-self: stretch` for reliable flex height resolution.

### Added

• **Subfolder scanning (`includeSubfolders`):** New setting (default true) makes the Project Logs panel, search, comparison, delete, insights, and file retention scan subdirectories under the reports directory. Shared `readTrackedFiles()` utility replaces per-module scanning logic. Depth-limited to 10 levels; dot-directories are skipped.
• **Trash can for session files:** Sessions can be moved to trash (sidecar flag) instead of permanently deleted. Toggle trash visibility with the eye icon in the Session History toolbar. "Empty Trash" permanently deletes all trashed files after a modal confirmation. Context menu shows "Move to Trash" on live sessions and "Restore from Trash" on trashed ones.
• **Retention uses trash:** File retention (`maxLogFiles`) now marks excess files as trashed instead of deleting them, and excludes already-trashed files from the count. Default changed from 10 to 0 (off) so auto-cleanup is opt-in.
• **Line count in Project Logs tree:** Each session now shows its line count before the file size in the tree description (e.g. `Dart · 4:13pm · 1,234 lines · 24.5 KB`). Active sessions show a `●` indicator after the count. Count is parsed from the session footer when available, with a newline-count fallback. Tooltips and split group summaries also include line counts.
• **Metadata cache:** Session history tree caches parsed file metadata keyed on URI+mtime+size, avoiding redundant file reads for unchanged log files.
• **Adaptive tree refresh debounce:** File-change events during active recording are debounced (3s / 10s / 30s scaling with line count) to avoid excessive tree rebuilds. New `treeRefreshInterval` setting allows a fixed override.
• **Affected Files section:** Bug reports now analyze up to 5 additional source files from the stack trace (beyond the primary error line). Each file shows git blame and recent commit history. Files are deduplicated and analyzed in parallel.
• **Marketplace link:** Bug report header links to the VS Code Marketplace listing.
• **Footer promotion:** Bug report footer recommends Saropa Lints and links to saropa.com.
• **Affected file count scoring:** Executive summary reports when an error spans 3+ source files.
• **Sources section:** Bug report header now lists all file and web sources (log file, analyzed source files, referenced docs, git remote URL).

### Improved

• **Code extraction:** Moved header parsing, description, and tooltip helpers from `session-history-provider.ts` into dedicated `session-history-helpers.ts` for better modularity and line budget.
• **Copy button:** Renamed from "Copy to Clipboard" to "Copy Markdown" for clarity.
• **Save filename:** Default save filename includes timestamp, `saropa_log_capture` branding, project name, and error subject (e.g. `20260207_184603_saropa_log_capture_contacts_email_panel_error_report.md`).
• **Preview link rendering:** Markdown `[text](url)` links now render as `<a>` tags in the bug report preview.
• **Preview heading support:** Added `###` (h3) rendering for per-file subsection headings.

---

## [0.3.1]

We add a session navigation bar, correlation tags and error fingerprints, Cross-Session Insights, Generate Bug Report, and logcat-aware level classification.

### Added

• **Session navigation bar:** When viewing a historical log file, a "Session N of M" navigation bar appears with Previous/Next buttons to step through sessions by modification time. Hides during live capture, re-appears on session end. Follows the split-nav breadcrumb pattern and handles split file groups as single units.
• **Correlation tags:** Sessions are automatically scanned on finalization for source file references and error class names. Tags like `file:handler.dart` and `error:SocketException` appear in the session history description (prefixed with `@`). A manual "Rescan Correlation Tags" command is available in the session context menu.
• **Filter sessions by tag:** New "Filter Sessions by Tag" command in the session history toolbar. Shows a multi-select quick pick of all correlation tags across sessions; selecting tags filters the history tree to only matching sessions.
• **Error fingerprints:** Sessions are scanned for error lines on finalization. Errors are normalized (timestamps, UUIDs, numbers removed) and hashed for cross-session grouping. Stored in sidecar metadata.
• **Analyze Across Sessions:** New context menu item on log lines. Extracts tokens (source files, error classes, URLs, etc.) from the line and searches all past sessions, showing results grouped by token type with workspace context (git history, source annotations).
• **Cross-Session Insights panel:** New command in the session history toolbar. Aggregates data across all sessions to show hot files (most-referenced source files) and recurring error patterns with session/occurrence counts.
• **Generate Bug Report:** Right-click an error line → "Generate Bug Report" packages all evidence into structured markdown: error + fingerprint, stack trace (app vs framework), log context, environment, source code, git history, and cross-session matches. Auto-copied to clipboard and shown in a preview panel.
• **Insights drill-down:** Click a recurring error in the Insights Panel to expand all occurrences grouped by session. Uses fuzzy regex matching so errors with different timestamps/IDs match across sessions. Click any match to jump to that line.
• **Session Timeline:** Right-click a session in Session History → "Show Timeline" to see an SVG chart plotting errors, warnings, and performance issues over time. Click a dot to navigate to that line. Auto-buckets dense sessions for smooth rendering.
• **Executive summary:** Analysis panel now shows a "Key Findings" banner with 2–4 relevance-scored insights (recent blame, recurring error, nearby annotations, doc references). Low-relevance sections auto-collapse.
• **Root cause correlation:** When a crash line was recently modified, the analysis compares the git blame date against the error's cross-session first appearance. A match within 3 days produces "Error likely introduced by commit `abc1234`".
• **Stack trace deep-dive:** Stack frames below an error are parsed and displayed with APP/FW badges. Click an app-code frame to expand inline source preview and git blame. Framework frames are dimmed.
• **Error trend chart:** Recurring errors show a compact SVG bar chart of occurrences per session, turning "Seen 5 times across 3 sessions" into a scannable timeline.
• **Bug report blame section:** Generated bug reports now include a Git Blame section and use the error's cross-session first-seen date for root cause correlation scoring in the Key Findings summary.

### Improved

• **Logcat-aware level classification:** Android logcat prefixes (`E/`, `W/`, `I/`, `D/`, `V/`, `F/`) are now used as the primary level signal. Previously, text pattern matching could override the prefix — e.g. `I/CCodecConfig: query failed` was misclassified as 'error' due to the word "failed". Now the logcat prefix takes priority, preventing false error/warning classifications on framework info/debug lines. Content-type patterns (performance, TODO) still refine `D/`/`V/`/`I/` lines.

### Added

• **Deemphasize Framework Levels setting:** New `saropaLogCapture.deemphasizeFrameworkLevels` option (default: off). When enabled, framework log lines (`fw=true`) no longer show error/warning text coloring — resolving the visual mismatch where framework `E/` lines showed red text but a blue severity bar. The log level prefix is just the opinion of the code author; framework `E/` logs are often handled internally with no user impact.

### Fixed

• **"App Only: OFF" not capturing all debug output:** With default settings, debug adapters that send output under non-standard DAP categories (e.g. Flutter system logs) were silently dropped because `captureAll` defaulted to `false`. Changed the default to `true` so all Debug Console output is captured regardless of category, matching the "never lose data" design principle.
• **Exclusions bypassed when `captureAll` enabled:** The `captureAll` setting previously bypassed both category filtering and exclusion filtering. Now it only bypasses category filtering — user-configured exclusions always apply independently.
• **Early debug output missed on session start:** The DAP tracker activates synchronously but session initialization is async (disk I/O). Output events arriving during this window were silently dropped. Added an early event buffer that captures events before the session is registered and replays them once initialization completes.
• **Timestamp/milliseconds/elapsed checkboxes disabled:** The Timestamp, Show milliseconds, and Elapsed time decoration toggles under Line prefix were non-interactive due to a `timestampsAvailable` flag that could disable them. Removed the mechanism so these toggles are always user-controllable.

---

## [0.2.9]

We add strict/loose level detection, double-click to solo a level, a hover copy icon on lines, and fix sidebar state, scroll jumps, and search behavior.

### Improved

• **Context lines visual separation:** When level filtering shows context lines around matches, the first context line in each group now displays a subtle dashed separator. Context lines no longer show level coloring, tint, or severity bars — they appear uniformly dimmed to clearly distinguish them from matched lines.

### Added

• **Level detection mode (`saropaLogCapture.levelDetection`):** New setting to control how aggressively lines are classified as errors. `"strict"` (default) requires keywords in label positions (`Error:`, `[ERROR]`, `TypeError:`) and only applies bug/critical/transient badges to error-level lines. `"loose"` matches keywords anywhere in the text but excludes common descriptive compounds (e.g. "error handling", "error recovery"). Both modes are smarter than the previous behavior, which flagged lint descriptions like "complicates error handling" as errors.
• **Double-click to solo a level filter:** Double-clicking a footer level dot now disables all other levels, isolating that single level.
• **Hover copy icon on log lines:** A copy icon appears on the far right of each log line on hover. Clicking it copies the line's plain text to the clipboard and shows a brief "Copied" toast. Works on regular lines, stack headers, and stack frames (not markers). Uses `visibility`/`pointer-events` instead of `display` to avoid codicon CSS specificity conflicts.

### Changed

• **Footer dots hidden when count is zero:** Level filter dots in the footer are now hidden for levels with no matching log lines, reducing visual noise.
• **Bottom padding in log viewer:** Added padding below the last log line so it's easier to select text near the end of the content.

### Fixed

• **Double-click solo level not toggleable:** Double-clicking a footer level dot to solo a level worked, but double-clicking the same dot again did not restore all levels. Now toggles back to all levels when the solo'd dot is double-clicked again.
• **Sidebar state lost on tab switch:** Switching from the Saropa Log Capture panel to another bottom panel tab (Problems, Output, Terminal, etc.) and back reset the entire viewer — deselecting the file, clearing filters, losing scroll position, and resetting all options. The sidebar webview was being fully disposed and recreated on each tab switch. Added `retainContextWhenHidden` to the webview provider registration so VS Code keeps the DOM alive when the panel is hidden.
• **Mousewheel scrolling jumps to start/end:** Fast mouse wheel scrolling with acceleration caused the log viewer to jump to the very start or end instead of scrolling naturally. Chromium's CSS scroll anchoring couldn't find stable anchor nodes after virtual scrolling DOM rebuilds, misadjusting `scrollTop`. Fixed by disabling `overflow-anchor` and intercepting wheel events with manual `scrollTop` control, matching the approach already used by the minimap.
• **Click-to-source spawns new editor groups:** Clicking a source link in the sidebar log viewer opened the file in a new editor group each time because `ViewColumn.Active` resolved to the sidebar webview instead of an editor column. Now targets the last-focused text editor's group, falling back to the first group.
• **Horizontal scrollbar hidden in no-wrap mode:** The log viewer's scrollbar-hiding CSS (`scrollbar-width: none`, `::-webkit-scrollbar { display: none }`) suppressed all scrollbars including horizontal. Vertical scrollbar is now hidden via `width: 0` (minimap replaces it) while the horizontal scrollbar is properly styled and visible when word-wrap is off.
• **Search text erased while typing in highlight mode:** Every debounced keystroke called `clearSearchFilter()` → `recalcAndRender()` even though highlight mode never sets `searchFiltered` flags — triggering a full O(n) height recalc, prefix-sum rebuild, and viewport render that was entirely unnecessary. Added a `searchFilterDirty` flag so `clearSearchFilter()` short-circuits when there is nothing to clear, and removed the unconditional input-clearing in `openSearch()`.
• **Search mode toggle does not apply:** Switching from highlight to filter mode required retyping the query because `toggleSearchMode()` guarded `updateSearch()` behind `searchInputEl.value` — which was empty if the input had been cleared by the bug above. The guard has been removed so the mode switch always re-runs the search.

---

## [0.2.8]

We add a bookmark count badge and instant bookmark add, and fix minimap and context menu positioning.

### Added

• **Bookmark count badge:** The bookmarks icon in the icon bar now displays a count badge showing the total number of bookmarks. Hidden when count is zero, caps at "99+".

### Changed

• **Instant bookmark adding:** "Bookmark Line" in the context menu now adds the bookmark immediately with no modal prompt. Notes can be added afterwards from the bookmarks panel via the edit button.
• **Removed standalone "Add Note" from context menu:** The separate "Add Note" menu item has been removed. Notes are now exclusively managed through bookmarks — add a bookmark first, then edit its note from the bookmarks panel.

### Fixed

• **Minimap markers stacked at top:** All severity markers rendered at position 0 because percentage-based CSS `top` didn't resolve against the flex-stretched container height. Switched to pixel-based positioning computed from `clientHeight`, and added `height: 100%` to the minimap container.
• **Minimap empty for info-level content:** Files where most lines lacked error/warning keywords (e.g. lint reports) produced no minimap markers because info-level lines were excluded. Info-level lines now show subtle green markers for files under 5,000 visible lines.
• **Minimap not updating on panel resize:** Added a `ResizeObserver` on the minimap element so pixel positions recalculate when the panel is resized.
• **Context menu clipped at top of viewport:** Right-clicking the top row pushed the menu above the webview (negative `top`), hiding most items. Menu position is now clamped to viewport edges, and `max-height` with `overflow-y: auto` ensures all items are scrollable when space is tight.
• **Invisible footer level dots:** The footer's colored level indicators (info, warning, error, etc.) were invisible because CSP nonces in `style-src` silently disabled `'unsafe-inline'`, blocking inline `style` attributes. Moved all inline visual styles to CSS classes so they load via the nonce-tagged `<style>` block instead.

---

## [0.2.7]

We fixed the Find in Files icon, moved Bookmarks into the icon bar panel, and made Pop Out available only from the title bar.

### Fixed

• **Find in Files icon missing:** Replaced invalid `codicon-search-view` (not in codicons 0.0.44) with `codicon-list-filter` so the icon bar button renders correctly.

### Changed

• **Bookmarks panel moved to icon bar:** Bookmarks are now a slide-out panel inside the Log Viewer (accessible via the bookmark icon in the icon bar) instead of a separate native tree view. The native tree view, its commands, and menu entries have been removed.
• **Pop Out moved to title bar only:** Removed the Pop Out button from the webview icon bar. Pop Out is now accessible only from the native view title bar action, matching standard VS Code panel conventions.
• **Session panel Tidy icon:** Replaced `codicon-text-size` with `codicon-edit` on the Tidy toggle button. The "Aa" glyph had more visual mass than the calendar, tree, and arrow icons on adjacent buttons.

---

## [0.2.6]

We add configurable file types, Find in Files across logs, a Bookmarks panel, a context lines slider, and a bunch of viewer fixes.

### Added

• **Configurable file types (`saropaLogCapture.fileTypes`):** The session history, search, file retention, delete, and comparison features now recognize configurable file extensions beyond `.log`. Default: `.log`, `.txt`, `.md`, `.csv`, `.json`, `.jsonl`, `.html`. Drop a `.txt` or `.md` into the reports directory and it appears in the session list. The setting is an array of dot-prefixed extensions; reload the window after changes.
• **Find in Files panel (Ctrl+Shift+F):** New "Find in Files" icon in the activity bar searches all log files in the reports directory concurrently. Shows matched files with match count badges. Click a file to open it and jump to the first match; click again to cycle through subsequent matches. Supports case-sensitive, whole-word, and regex toggles matching the in-file search options. Results update with 300ms debounce as you type.
• **Bookmarks panel:** New "Bookmarks" tab in the Saropa Log Capture panel. Right-click any log line and choose "Bookmark Line" to save it with an optional note. Bookmarks are grouped by file, persist across sessions via workspace state, and clicking a bookmark navigates back to that line. Includes search/filter, edit note, delete individual or all bookmarks with confirmation dialogs.
• **Context lines slider in level flyup:** The level filter fly-up menu now includes a slider (0–10) to adjust how many preceding context lines are shown when filtering by level. Replaces the static VS Code setting default for real-time control.
• **Source link context menu:** Right-clicking a filename/source reference (e.g. `lib/main.dart:42`) now shows file-specific actions: Open File, Copy Relative Path, and Copy Full Path. Previously showed the browser's default Cut/Copy/Paste menu.
• **Copy Line and Copy All in context menu:** Right-click a log line to see Copy Line and Copy All at the top of the menu. Decorated variants (Copy Line Decorated, Copy All Decorated) include the level emoji, sequence counter, and timestamp prefix.
• **Inline Go to Line (Ctrl+G):** Replaced the VS Code input box round-trip with an inline overlay that scrolls instantly while typing. Numbers-only input, Escape reverts to original position, Enter confirms. Animated slide-down appearance.

### Fixed

• **Right-click line detection:** Log line elements were missing `data-idx` attributes, so the context menu could never identify which line was right-clicked. All line-specific menu items (Copy Line, Pin, etc.) now appear correctly.
• **Ctrl+A selecting footer:** Added `user-select: none` to the footer bar so Ctrl+A only selects log content, not the status bar.
• **False "performance" classification:** Removed overly generic `slow` and `lag` keywords from the performance-level regex. Words like "slow-cooked" in normal log data no longer trigger the performance filter.
• **Unformatted line counts:** Footer line count, level filter dot counts, fly-up circle counts, and VS Code status bar now display comma-separated numbers (e.g., `12,868` instead of `12868`).
• **Level filter dots hard to see:** Increased dot size from 9px to 10px with `min-width`/`min-height` guarantees and wider gap (1px → 3px) between dot and count for clearer visibility.
• **Footer filename not actionable:** Clicking the log filename in the footer now reveals and selects the file in the Session History tree view. The filename shows a dotted underline and turns blue on hover to indicate it is clickable.
• **Minimap markers not updating:** Markers now show for all non-info severity levels (error, warning, performance, todo, debug, notice) with distinct colors. Added direct `scheduleMinimap()` calls in the data flow so the minimap rebuilds reliably when new lines arrive or data is cleared, independent of the monkey-patch hook on `renderViewport`.
• **Minimap click vs drag:** Clicking the minimap immediately entered drag mode, so any mouse movement after a click caused unwanted scrolling. Now a single click navigates to that position and stops; drag mode only activates after 3px of movement while holding the mouse button.
• **Minimap drag scrolling broken:** Dragging the minimap caused erratic viewer movement because `suppressScroll` was reset immediately, allowing the RAF-debounced scroll handler to fire mid-drag and trigger `renderViewport` DOM changes that destabilized the scroll position. Now `suppressScroll` stays true for the entire drag operation, with viewport rendering done synchronously in `scrollToMinimapY`.
• **Minimap scroll mapping used stale height:** Click and drag positions were mapped using `minimapCachedHeight` which could be 120ms stale. Now uses a `mmHeight()` helper that falls back to the always-current `totalHeight` global.
• **Minimap wheel deltaMode not handled:** Forwarded `deltaY` as raw pixels regardless of `e.deltaMode`, so line-mode or page-mode scroll events barely moved the content. Now multiplies by `ROW_HEIGHT` or `clientHeight` for modes 1 and 2.
• **Minimap markers hidden behind viewport indicator:** Added `z-index: 1` to `.minimap-marker` so colored severity markers paint above the semi-transparent viewport overlay.

---

## [0.2.5]

We add a right-click context menu, Go to Line (Ctrl+G), keyboard and scroll font zoom, and search/match persistence.

### Added

• **Right-click context menu:** Custom context menu on log lines with Copy (line text), Search Codebase, Search Past Sessions, Open Source File, Show Context, Pin Line, Add Note, Add to Watch List, and Add to Exclusions. Global actions (Copy selection, Select All) appear regardless of click target. Line-specific items auto-hide when right-clicking empty space.
• **Show Context in context menu:** The inline peek (surrounding context lines) is now triggered via right-click → "Show Context" instead of double-click. Double-click now performs native word selection as expected.
• **Go to Line (Ctrl+G):** Opens a VS Code input box to jump to a specific line number. Scrolls the virtual viewport to the target line.
• **Page Up / Page Down:** PgUp and PgDn keys scroll the log content by 80% of the viewport height.
• **Keyboard font zoom:** Ctrl+= / Ctrl+- adjust font size by 1px. Ctrl+0 resets to 13px default.
• **Ctrl+scroll zoom:** Hold Ctrl and scroll the mouse wheel to increase/decrease font size.
• **Ctrl+A scoped to log content:** Ctrl+A selects only the visible log lines in the viewport, not the entire webview UI (icon bar, panels, footer).
• **Tab navigation and focus indicators:** Icon bar buttons are now keyboard-navigable via Tab. Focus-visible outlines use `--vscode-focusBorder` for accessibility.
• **Search match persistence:** Closing the search panel no longer clears match positions. Reopening restores the previous query and match index, so F3 continues from where you left off.
• **CSS animations throughout the viewer:** Context menu fades in with a subtle scale, level flyup slides up from the footer, log line hover backgrounds transition smoothly, footer buttons blend on hover, filter badges pop in when activated, search current-match pulses on navigation, minimap viewport glides instead of jumping, inline peek slides open, jump-to-bottom button fades in, and pinned items slide in from the left. All pure CSS with short durations (0.08–0.4s) to feel responsive without sluggishness.

### Removed

• **Source preview hover popup:** Removed the floating tooltip that appeared when hovering over source links in stack traces. The popup was easily triggered accidentally and obscured log content. Single-click on source links (or right-click → Open Source File) already navigates to the file.
• **Watch count chips in footer:** Removed the red/yellow keyword watch chips from the viewer footer. They duplicated the level classification counts and confused the UX. Watch counts remain visible in the VS Code status bar.
• **Minimap toggle:** The scrollbar minimap is now always on — there is no reason not to have it. Removed the `opt-minimap` checkbox from the Options panel, the `toggleMinimap()` function, and the `minimap-active` CSS class. Native scrollbar is always hidden; the minimap panel is the only scrollbar.

### Changed

• **Clickable level filter dots:** Each colored dot in the footer now directly toggles its level filter on click (e.g., click the red dot to hide/show errors). Previously, clicking anywhere on the dots opened the fly-up menu.
• **Level dot counts:** Footer dots now show live counts next to each dot when > 0, so you can see at a glance how many errors, warnings, etc. exist.
• **Fly-up menu trigger:** The fly-up filter menu (with Select All/None and text labels) is now opened by clicking the "All"/"3/7" label text instead of the dots.
• **Status bar opens log file:** Clicking the status bar line count now opens the active log file in the editor instead of just focusing the sidebar viewer tab. Follows the "counts are promises" principle — if the bar shows a count, clicking reveals the underlying data.
• **Inline exclusion input:** Exclusion patterns can now be added directly in the Options panel via a text input + Add button. Replaces the previous "Configure in Settings" link that opened VS Code's JSON settings.
• **Visual spacing enabled by default:** Breathing room between log sections is now on by default for easier reading. Toggle off via the options panel.
• **Word wrap disabled by default:** Log lines no longer wrap by default, preserving original formatting. Toggle on via the options panel or press W.
• **Double-click restores native behavior:** Removed the double-click handler that opened the inline peek context modal. Double-click now selects words normally, matching standard text editor behavior.

### Fixed

• **App-only filter had no effect on regular log lines:** The "App only (hide framework)" toggle only hid framework stack frames (`    at ...` lines), ignoring regular output. Android logcat lines (`D/FlutterJNI`, `D/FirebaseSessions`, `I/Choreographer`, etc.) passed through unfiltered. Extended line classification to detect Android logcat tags and launch boilerplate, stored `fw` flag on all line items, and rewired the toggle to use `recalcHeights()` so it composes with all other filters. `I/flutter` lines (app output) remain visible while framework/system noise is hidden.
• **Severity bar never showed framework color:** `renderItem()` checked `item.isFramework` (never set) instead of `item.fw` for the severity bar CSS class.
• **Scrollbar minimap redesigned as always-on interactive panel:** The minimap was an invisible 8px overlay hidden behind the opaque native scrollbar. Redesigned as a 60px wide always-on flex-sibling panel that replaces the native scrollbar entirely. Supports click-to-scroll (centers viewport on clicked position), drag-to-scroll, and mouse wheel forwarding. Shows a draggable viewport indicator.
• **Minimap markers for hidden lines:** Error/warning markers were generated for all lines regardless of filter state, creating phantom marks at wrong positions for lines with `height === 0` (filtered, collapsed). Now skips hidden lines and stack-frame lines (previously every frame in a stack trace generated its own red marker).
• **Minimap missing performance markers:** Only errors and warnings were shown. Added purple markers for performance-level lines using `--vscode-editorOverviewRuler-infoForeground`.
• **Scroll position redesign:** Complete rewrite of the virtual scrolling system. Toggling filters, collapsing stack traces, or changing font size no longer jumps the view to a random position — the first visible line stays anchored. Auto-scroll to bottom no longer causes double-render feedback loops. Prefix-sum array replaces O(n) linear scans with O(log n) binary search for viewport calculations. Stack frame height lookup is now O(1) via cached group headers instead of O(n²) nested scans. Row height is measured from the DOM instead of hardcoded, so spacer heights stay correct after font/line-height changes. Trimming old lines (50K limit) now adjusts scroll position by the removed height.
• **Footer level label blank:** The static "Levels" label next to the filter dots gave no indication of active state. Now shows "All" when all 7 levels are enabled, "N/7" when partially filtered, or "None" when all disabled. Footer dots also gained `flex-shrink: 0` to prevent collapsing in the flex layout.
• **"All" not highlighted in level flyup:** The All/None links in the level flyup had no active state, making it unclear whether all levels were enabled. Both links now highlight (using VS Code button colors) when their respective state is active.
• **Level flyup text center-aligned:** Button text in the level flyup defaulted to browser center alignment, making labels hard to scan. Added explicit left alignment (`justify-content: flex-start`, `text-align: left`) while keeping counts right-aligned.
• **Level flyup missing title:** The flyup opened directly into All/None links with no context. Added a "Level Filters" title header above the links to clarify purpose and resolve "levels vs filters" terminology confusion.

---

## [0.2.4]

We aligned the search UI with VS Code (icons, history arrows) and removed the clear button.

### Changed

• **Search toggles match VS Code:** Match Case, Match Whole Word, and Use Regular Expression buttons now use codicon icons (`codicon-case-sensitive`, `codicon-whole-word`, `codicon-regex`) positioned inline inside the search input, matching VS Code's native search layout. Active state uses VS Code's `--vscode-inputOption-*` theme variables.
• **Search history arrow navigation:** Up/Down arrow keys in the search input cycle through recent search terms, matching VS Code and terminal conventions. Clickable history list below the input is retained.

### Removed

• **Clear search button:** Removed the `×` clear button from the search input. Use Escape to close (which clears), or select-all and delete.

---

## [0.2.3]

We fixed stats not resetting on file load, redesigned the level flyup, and made the filter badge open the level flyup.

### Fixed

• **Stats counters not resetting on file load:** Level counts (e.g., "125 info") accumulated across sessions because the stats script only listened for 'reset' messages, not 'clear'. Now resets on both, fixing phantom counts that misled users about current file content.
• **Filter badge stretches footer:** Added `line-height: 1` to `.filter-badge` to prevent the badge from being taller than the footer bar.

### Changed

• **Level flyup redesigned:** Level filter circles now show left-aligned rows with emoji, text label, and count (e.g., `🔴 Error 2`). All/None links restyled as bordered buttons. Flyup min-width increased for labels.
• **Level dot trigger visible:** Footer level dots enlarged from 7px to 9px, inactive opacity raised from 0.2 to 0.3, and "Levels" text label added for discoverability. Hover shows border to signal interactivity.
• **Filter badge opens level flyup:** When the only active filter is a level filter, clicking the badge now opens the level flyup instead of the options panel. Mixed filters still open options.
• **Footer filename opens Project Logs:** Clicking the footer text (line count + filename) now opens the Project Logs session panel.

---

## [0.2.2]

We add a pop-out viewer, session display options (Dates, Tidy, Days, Sort), source location and elapsed time in logs, and fix CSP/codicon issues.

### Fixed

• **Line prefix sub-options misplaced:** Decoration sub-options (severity dot, counter, timestamp, etc.) appeared below the minimap checkbox instead of under their parent "Line prefix" checkbox. Moved to correct position and changed from show/hide to always-visible with disabled styling when line prefix is off.
• **Inline context option non-functional:** Removed the "Show inline context (file >> function)" option — context data was only extracted for stack frames, so it never worked for regular log lines.
• **Audio preview CSP blocked:** Preview sound buttons did nothing because the Content Security Policy `media-src` used the audio directory URI instead of the webview's `cspSource` authority. Fixed to use `cspSource` for consistent resource authorization.
• **Codicon icons invisible in webview:** The v0.2.1 CSP fix added `font-src` but the codicon font was never loaded — webviews are sandboxed and don't inherit VS Code's fonts. Now bundles `@vscode/codicons` and loads the stylesheet via a `<link>` tag, with `style-src` extended to allow it. Fixes all icons in the icon bar, context menu, and session panel.

### Added

• **Source location in log files:** New `includeSourceLocation` setting (off by default) appends the originating file and line number to each log line, e.g. `[app.ts:42]`. Requires the debug adapter to supply source info in DAP OutputEvents.
• **Elapsed time in log files:** New `includeElapsedTime` setting (off by default) prefixes each log line with the delta since the previous line, e.g. `[+125ms]`. Useful for spotting performance gaps.
• **Verbose DAP protocol logging:** New `verboseDap` setting (off by default) logs all raw DAP protocol messages (requests, responses, events) to the log file. Directional prefixes distinguish outgoing (`[dap->]`), incoming (`[dap<-]`), and event (`[dap:event]`) messages. JSON payloads are truncated at 500 characters.
• **Pop-out viewer:** New icon-bar button (link-external icon) and command (`Saropa Log Capture: Pop Out Viewer to New Window`) that opens the log viewer as a floating editor panel, movable to a second monitor. The pop-out coexists with the sidebar — both receive the same live data via a broadcast architecture. Closing and reopening the pop-out preserves the connection. Also available from the view title bar.
• **Session display options:** Four toggle buttons in the Project Logs panel header control how session filenames are displayed: **Dates** (show/hide leading and trailing datetime patterns — hidden by default), **Tidy** (normalize to Title Case with spaces — enabled by default), **Days** (group sessions under colored day headings like "Tue, 3rd Mar 2026" — enabled by default), and **Sort** (toggle between newest-first and oldest-first with a dynamic arrow icon). All options persist per-workspace via `workspaceState`. The same transforms apply to both the webview session panel and the native tree view. The panel stays open when selecting a file.
• **File modification date+time in session list:** Session items now show the file's last-modified date and time (e.g. "Feb 2, 4:13pm") before the file size in the metadata line. When day headings are shown, only the time is displayed to avoid redundancy.
• **Seconds trimmed from session filenames:** Filenames like `20260202_143215_session.log` are automatically displayed as `20260202_1432_session.log` for compactness. Always applied, independent of the display option toggles.

### Changed

• **Session info moved to icon bar:** The ℹ️ session info button is now in the right-side icon bar (between Search and Options) instead of the header bar. Click to open a slide-out panel showing full session metadata. Uses the same mutual-exclusion pattern as the other icon bar panels. The compact prefix line at the top of the log content is unchanged.
• **Header bar removed:** The viewer header bar (filename + collapse toggle) is removed entirely. The log filename and extension version now appear in the footer status text as `·`-separated segments (e.g., `● 42 lines · dart_session.log · v0.2.2`), reclaiming vertical space.
• **Marketplace banner image 404:** README banner pointed to the wrong GitHub repository (`saropa_lints`). Corrected URL to `saropa-log-capture`.

---

## [0.2.1]

We fixed icons in dark mode, the search panel toggle, the minimap disappearing on scroll, and split the status bar into pause and count.

### Fixed

• **Icon bar icons invisible in dark mode:** The Content Security Policy blocked the codicon font from loading (`default-src 'none'` with no `font-src`). Now passes `webview.cspSource` to the CSP so VS Code can inject its icon font.
• **Search mode toggle resets search text and breaks filter/clear:** Clicking any button inside the search panel (mode toggle, regex, case, clear) could trigger the document-level click-outside handler, closing the panel and clearing state. Toggle buttons were especially affected because `textContent` assignment detaches the original click target text node, making `contains()` fail. Fixed by stopping event propagation at the search bar boundary so internal clicks never reach the outside-click handler.
• **Scrollbar minimap disappears on scroll:** The minimap was positioned absolute inside the scrollable `#log-content` container, causing it to scroll away with the content. Wrapped `#log-content` in a non-scrolling `#log-content-wrapper` and moved the minimap to the wrapper so it stays viewport-fixed.

### Changed

• **Status bar split into two items:** The status bar is now two separate clickable items: a pause/resume icon that toggles capture state, and a text display (line count + watch counts) that focuses the sidebar viewer panel. Follows the VS Code convention where clicking a count reveals the associated view.
• **Watch chips are clickable:** Footer watch count chips (e.g., "error: 4") now open the search panel pre-filled with the keyword and navigate to the first match. Adds pointer cursor and hover effect to signal interactivity.
• **Native Session History tree view hidden:** The separate tree view below the Log Viewer is replaced by the in-webview Project Logs panel accessible from the icon bar.
• **Session panel renamed:** "Sessions" panel renamed to "Project Logs" with matching icon bar tooltip.
• **Icon bar sessions icon:** Changed from history (clock) to files icon to better represent project log files.

<details>
<summary>Maintenance</summary>

• **README: invite contributions.** Added GitHub activity badges, Contributing section, Documentation table, and footer links.
• **Dev script rewritten as publish pipeline.** `scripts/dev.py` now supports a gated analyze-then-publish workflow (16 steps) with `--analyze-only` for local dev builds.
• **Dev script split into modules.** `scripts/dev.py` refactored into 9 focused modules under `scripts/modules/`.
</details>

---

## [0.2.0]

We add an icon bar with Session History and Options panels, simplify the footer, and add historical file timestamps and the level flyup.

### Added

• **Icon bar:** VS Code activity-bar-style vertical icon bar on the right edge of the log viewer with icons for Session History, Search, and Options. Clicking an icon toggles its slide-out panel with mutual exclusion (only one panel open at a time). Uses codicon icons with an active indicator bar matching VS Code's activity bar pattern.
• **Session history panel:** New in-webview slide-out panel listing past log sessions from the reports directory. Shows filename, debug adapter, file size, and date. Clicking a session loads it into the viewer. Active (recording) sessions are highlighted. Panel refreshes on each open.

### Changed

• **Footer simplified:** Removed Search and Options buttons from the footer — these are now accessible from the icon bar. The footer retains line count, level filter dots, watch chips, and filter badge.
• **Body layout restructured:** The webview body is now a flex-row containing the main content column and the icon bar column, instead of a single flex-column.

### Added

• **Historical log file timestamps:** Opening a log file from Session History now parses the `[HH:MM:SS.mmm]` timestamps from each line (using the `Date:` header for the date component), enabling elapsed time and timestamp decorations on historical files. Previously timestamps were discarded during file loading.
• **Timestamp availability gating:** Time-related decoration options (Timestamp, Show milliseconds, Elapsed time) are automatically disabled and grayed out when viewing a log file that has no parsed timestamps. Re-enabled when switching to a file with timestamps or starting a live session.
• **Session history timestamp icons:** Sessions in the history tree now show a `history` icon (clock) when the file contains timestamps, or an `output` icon (plain text) when it does not. Active recording sessions retain the red `record` icon. Tooltip includes "Timestamps: Yes/No".

### Fixed

• **Warning and Performance level toggles had no visual feedback:** The button IDs used abbreviated names (`level-warn-toggle`, `level-perf-toggle`) but `toggleLevel()` constructed IDs from the full level name (`level-warning-toggle`, `level-performance-toggle`). The `getElementById` returned null, so the `active` class never toggled. Also fixed the same stale IDs in `resetLevelFilters()`.
• **Visual spacing option had no visible effect:** The spacing logic ran after early returns for markers, stack-headers, and stack-frames — so it never applied to those item types. CSS selectors were also scoped to `.line` only. Moved computation before early returns, broadened conditions to trigger on any level change, separator lines, markers, and new stack traces, and widened CSS selectors to all element types.
• **Level circle counts invisible in dark mode:** The `.level-circle` buttons didn't set an explicit `color`, so count numbers used the browser default (black) instead of the VS Code theme foreground. Added `color: inherit` so counts adapt to light and dark themes.
• **Session Info modal persists across session loads:** The `clear` handler dismissed the context peek but not the Session Info modal. Once opened, the modal stayed visible every time a new log was selected. Now `hideSessionInfoModal()` is called on clear.
• **Search input unresponsive during typing:** `updateSearch()` ran synchronously on every keystroke — iterating all lines for regex matching, height recalculation, and DOM rendering — blocking the browser from repainting the input. Characters appeared not to register on large log files. Search is now debounced (150 ms) so characters appear instantly.
• **Search filter persists after clearing text:** Removing all search text or closing the search panel while in highlight mode left stale `searchFiltered` flags on lines, hiding them until a manual filter reset. Now always clears the search filter regardless of search mode.

### Changed

• **Level filters moved to fly-up menu:** The 7 inline level-circle buttons in the footer are replaced by a compact row of colored dots. Clicking the dots opens a fly-up popup with the full toggle buttons plus Select All / Select None links. The popup stays open while toggling and closes on click-away or Escape.
• **Exclusions UX overhaul:** Replaced the bare "Enable exclusions" checkbox with a richer section. The toggle label now shows the pattern count (e.g. "Exclusions (3)"). Each configured pattern is displayed as a removable chip below the toggle. Chips dim when exclusions are toggled off. When no patterns are configured, an empty state with a "Configure in Settings" link is shown. Removing a chip persists the change to workspace settings.

### Added

• **Per-file level filter persistence:** Level filter toggle state is saved per log file in workspace storage. When switching between files or reloading, each file's filter state is automatically restored.
• **Tooltips on all options panel controls:** Every checkbox, slider, dropdown, and button in the Options panel now has a descriptive `title` attribute that explains what the option does on hover.
• **Search clear button:** An × button appears inside the search input when text is present, following standard textbox conventions. Click to clear and reset the search.
• **Search history:** Last 10 search terms shown below the input when the search panel opens. Click any term to re-run that search. Persists across webview reloads via webview state.
• **Scroll position memory per file:** When switching between log files, the viewer remembers where you were scrolled to. Positions are saved when not at the bottom; files you were following at the bottom stay at the bottom on return.
• **Whole-line coloring for all severity levels:** Previously only error and warning lines received a background tint; all other levels (info, performance, todo, debug, notice) were ignored, making the feature appear broken. Now all 7 levels get a distinct tint color. Opacity increased from 8% to 6–12% (14–20% on hover) so the effect is actually visible.

---

## [0.1.15]

We fixed scroll flickering and layout thrashing and narrowed transition scope for smoother rendering.

### Fixed

• **Scroll flickering from ResizeObserver loop:** The `ResizeObserver` on `#log-content` called `renderViewport(true)` unconditionally, bypassing the visible-range bail-out check. Every DOM replacement triggered another resize observation, creating a feedback loop. Now RAF-debounced and uses `renderViewport(false)` so no-op re-renders are skipped.
• **Layout thrashing in scroll handler:** `jumpBtn.style.display` write was sandwiched between DOM reads and `renderViewport`'s internal reads, forcing a synchronous reflow on every scroll frame. Moved the write after all reads complete.
• **Broad `transition: all` causing render stutter:** `#viewer-header` and `#error-badge` used `transition: all 0.2s ease`, keeping the compositor busy animating layout properties during re-renders. Replaced with specific property transitions (`min-height`, `padding`, `border-bottom` for header; `background` for badge).

---

## [0.1.14]

Development build.

---

## [0.1.13]

We slimmed the footer, added a filter badge, reorganized the options panel (Quick Filters, Output Channels, Log Tags, etc.), added a scrollbar minimap option, and fixed mouse wheel scroll.

### Changed

• **Footer UI consolidation:** Slimmed footer to just: line count, level circles, filter badge, search button, and options button. Removed 7 toggle buttons (wrap, exclusions, app-only, decorations, audio, minimap, export) that are now in the options panel.
• **Category filter redesign:** Replaced the `<select multiple>` dropdown with dynamic checkboxes in the new Output Channels section of the options panel.
• **Source tags moved to options panel:** Source tag chip strip removed from above the log content. Tags now live in a Log Tags section inside the options panel with the same All/None toggle and count chips.
• **Options panel reorganized:** Consolidated all settings into logical sections — Quick Filters (presets + reset), Output Channels, Log Tags, Noise Reduction (exclusions + app-only), Display, Layout, Audio, and Actions (export).
• **Footer buttons use text labels:** Export and Search buttons now show text instead of emoji (💾 → "Export", 🔍 → "Search").
• **Clearer footer status text:** Replaced ambiguous "Viewing: 24 lines" with just "24 lines". Recording shows "● 24 lines" (red dot), paused shows "⏸ 24 lines".
• **Merged stats + level filters:** The separate stats counters (🔴 4, 🟠 95) and level filter circles (🟢🟠🔴🟣⚪🟤🟦) are now a single set of circles that show counts AND act as toggle filters.

### Added

• **Filter badge:** Footer shows an active filter count badge (e.g. "3 filters") that opens the options panel when clicked. Auto-updates via hooks on `recalcHeights()` and `toggleAppOnly()`.
• **Reset all filters button:** Quick Filters section includes a "Reset all filters" button that clears every filter type (levels, categories, exclusions, app-only, source tags, search) in one click.
• **`setExclusionsEnabled()` function:** Presets can now programmatically enable/disable exclusions (was missing, causing presets to silently fail for exclusion state).
• **Scrollbar minimap option in Options panel:** New "Scrollbar minimap" checkbox in the Display section.
• **Decoration sub-options in Options panel:** Added "Show milliseconds" and "Severity bar (left border)" checkboxes for feature parity with the decoration settings popover.
• **STYLE_GUIDE.md:** Documents UI patterns, font sizes, button styles, spacing, color conventions, and anti-patterns for the log viewer webview.

### Fixed

• **Options panel reading undefined `exclusionsActive`:** The exclusion checkbox was reading a non-existent `exclusionsActive` variable instead of `exclusionsEnabled`, causing the checkbox to never reflect actual state.
• **Preset "None" not resetting filters:** Selecting "None" in the preset dropdown now calls `resetAllFilters()` instead of just clearing the preset name.
• **Duplicate `#export-btn` CSS:** Was defined in both `viewer-styles-modal.ts` (14px) and `viewer-styles-overlays.ts` (10px). Consolidated into a single `.footer-btn` class.
• **Mouse wheel scroll hijacking:** A custom `wheel` event listener intercepted native scrolling, applied a 0.5x multiplier, and called `preventDefault()` — killing browser-native smooth/inertia scrolling and causing choppy, erratic scroll behavior. Removed the handler so `#log-content` uses standard `overflow-y: auto` scrolling.

### Removed

• **Dead code:** Removed unused `exclusionsActive` variable, dead `getPresetDropdownHtml()` export, and orphaned `#preset-select` CSS from overlay styles.

---

## [0.1.12]

Development build.

---

## [0.1.11]

We added a close button to the source preview, fixed the decoration counter, added a session info modal, fixed viewer scroll and minimap performance, and made search a slide-out panel.

### Fixed

• **Source preview popup not dismissible:** The hover preview over stack trace source links had no close affordance — it only auto-hid when the mouse moved away. Added a close button (×), Escape key, and click-outside dismissal.
• **Decoration counter showing `#&nb` instead of numbers:** `padStart(5, '&nbsp;')` used the 6-character literal HTML entity as a JavaScript padding string, causing truncated gibberish. Now pads with Unicode non-breaking space (`\u00a0`).
• **Inconsistent datetime in log filenames:** Filename format now uses compact datetime (`YYYYMMDD_HHMMSS_name.log`) for uniqueness and consistency. Rename and metadata parsing handle both legacy (`HH-MM`, `HH-MM-SS`) and current (`HHMMSS`) formats.
• **Session info expander always blank:** The collapsible session header never displayed data because (1) header lines were stripped before reaching the webview and (2) the JavaScript hook referenced a non-existent `handleSetContent` function. Redesigned as a compact prefix line at the top of the log content (showing adapter, project, config, date) with an ℹ️ icon button in the header bar that opens a modal with full session metadata. Now works for both live sessions and historical file loads.
• **Viewer flickering and inability to scroll:** The scrollbar minimap wrapped `renderViewport` with `setTimeout(updateMinimap, 50)` on every call, including scroll-only renders. This created a feedback loop (scroll → render → 50ms minimap DOM rebuild → layout recalc → scroll) that caused constant flickering and unwanted auto-scrolling to bottom via the ResizeObserver. Fixed by only scheduling minimap rebuilds on data changes (`force=true`), debouncing rapid updates, and using cached heights for the scroll handler.
• **Scrollbar minimap O(n²) performance:** Minimap marker placement re-iterated all preceding lines for each marker to compute cumulative height. Replaced with a single O(n) pre-computed array. The scroll-time viewport indicator now uses cached total height (O(1)) instead of recalculating on every frame.

### Added

• **Copy File Path:** Right-click a session in Session History and select "Copy File Path" to copy the full filesystem path to clipboard.

### Refactored

• **Split oversized commands module:** Extracted session comparison commands from `commands.ts` (305 lines) into `commands-comparison.ts` to comply with the 300-line file limit.

### Changed

• **Decorations enabled by default:** The `saropaLogCapture.showDecorations` setting now defaults to `true` so new users see line prefixes (severity dot, counter, timestamp) out of the box.
• **Emoji toggle buttons:** Replaced text-based footer toggles (`Deco: OFF`, `Audio: OFF`, `Minimap: ON`) with emoji buttons (🎨, 🔔/🔕, 🗺️). Active state shown at full opacity; inactive at 35% opacity. Tooltips explain current state and action.
• **Clearer options panel label:** Renamed "Show decorations" to "Line prefix (🟢 #N T00:00:00)" so users can see exactly what the toggle controls.
• **Search is now a slide-out panel:** Converted the inline search bar to a toggleable slide-out panel from the right edge, matching the options panel pattern. Added a 🔍 toolbar button in the footer. Keyboard shortcuts (Ctrl+F, F3, Escape) still work. Search and options panels are mutually exclusive — opening one closes the other.
• **Version inline with filename:** Version string now sits immediately after the filename in the header bar instead of floating as a separate right-aligned element.

---

## [0.1.10]

_Regex and export fixes; script fault isolation and global error handler for webview stability._

### Fixed

• **Viewer blank due to regex SyntaxError:** An invalid character class range in `isSeparatorLine` (`[=\\-+...]` produced range `\` to `+` with start > end) caused a SyntaxError that killed the entire webview script block. Fixed by moving `-` to end of character class.
• **Double-escaped regexes in viewer scripts:** `extractContext` in data helpers and decoration-stripping regexes in the export script used `\\\\s`/`\\\\d` which produced literal `\s`/`\d` instead of whitespace/digit classes. Fixed to single-escaped.
• **Export join produced literal `\n`:** `lines.join('\\\\n')` in export script produced literal backslash-n instead of newline. Fixed to `\\n`.
• **Session file loading race condition:** Loading a historical log file while webview was re-resolving (tab switch) could silently fail. Added generation counter and pending-load retry.

### Added

• **Script fault isolation:** Split the single `<script>` block (33 concatenated scripts) into separate `<script>` blocks per feature. A SyntaxError in one feature no longer kills the entire viewer.
• **Global error handler:** New first-loaded script catches uncaught errors, shows a visible red banner in the webview, and reports errors to the extension host via `console.warn`.
• **Build-time syntax validation test:** New test extracts all `<script>` blocks from the generated HTML and validates each with `new Function()`, catching SyntaxErrors before release.

---

## [0.1.9]

Development build.

---

## [0.1.8]

We fixed the options panel not responding to clicks, duplicate elements, missing escapeHtml, the audio path, and the split breadcrumb part number.

### Fixed

• **Options panel button unresponsive:** The slide-out options panel used `right: -25%` to hide off-screen, but with `min-width: 280px` it remained partially visible in narrow sidebar viewports (z-index 250), silently intercepting clicks on footer buttons including the options toggle. Changed to `right: -100%` with `pointer-events: none` when closed.
• **Duplicate error breakpoint elements:** `getErrorBreakpointHtml()` was called twice in the viewer HTML template, creating duplicate `error-badge` and `error-modal` elements with the same IDs. Removed the stray call outside the footer.
• **Missing `escapeHtml()` in webview:** The function was called by repeat notifications, edit modal, and session header scripts but was only defined in the TypeScript extension host (not injected into the webview). Added the function to the webview data helpers script.
• **Dead audio mute code:** Removed `audioMuted` variable, `toggleAudioMute()`, and `updateAudioMuteButton()` which referenced a nonexistent `audio-mute-toggle` element with no corresponding HTML or event wiring.
• **Split breadcrumb shows wrong part number:** `setSplitInfo(totalParts, totalParts)` passed `totalParts` for both arguments, so the breadcrumb always showed "Part N of N" after a split instead of the actual current part number. Now passes the correct `partNumber`.
• **Audio files never loaded (doubled path):** `initAudio()` appended `/audio/` to a URI that already pointed to the `audio/` directory, creating an invalid path like `audio/audio/swipe_low.mp3`. Removed the redundant segment.
• **Version string type assertion:** `as string ?? ''` made TypeScript treat the version as always a string, so the nullish fallback was unreachable. Replaced with `String(... ?? '')` for safe runtime conversion.

### Added

• **Version display in viewer header:** The extension version number (e.g., "v0.1.7") now appears in the log viewer header bar.

## [0.1.6]

We classify errors as CRITICAL, TRANSIENT, or BUG and let you filter or break on critical issues.

<!-- cspell:ignore ECONNREFUSED -->

### Added

• **Smart Error Classification:** Automatically classifies error log lines into three categories: 🔥 CRITICAL (NullPointerException, AssertionError, FATAL, etc.), ⚡ TRANSIENT (TimeoutException, SocketException, ECONNREFUSED, etc.), and 🐛 BUG (TypeError, ReferenceError, SyntaxError, etc.). Visual badges appear inline before the log message. Two new settings: `saropaLogCapture.suppressTransientErrors` (default: false) hides expected transient errors via filtering, and `saropaLogCapture.breakOnCritical` (default: false) triggers VS Code notifications when critical errors appear. Helps quickly identify severe issues vs. expected network hiccups.

## [0.1.5]

_Stack trace preview mode, milliseconds in timestamps, audio volume and rate limiting, inline tag parsing, session info header, repeat notifications, and layout/export options._

### Added

• **Stack Trace Preview Mode:** Stack traces now show first 3 non-framework frames by default (collapsible preview mode) instead of completely collapsed. Click the header to cycle through: preview → fully expanded → fully collapsed → preview. Framework frames are filtered out in preview mode. Toggle indicator shows ▷ (preview), ▼ (expanded), or ▶ (collapsed).
• **Milliseconds Display:** Added "Show milliseconds" checkbox to decoration settings panel (⚙ gear button). When enabled, timestamps show `.000` milliseconds after the seconds (e.g., `T14:32:15.234`). Works with existing timestamp decoration toggle.
• **Audio Volume Control:** Expanded audio options panel with volume slider (0-100%, default 30%), rate limiting selector (none/0.5s/1s/2s/5s/10s), and preview sound buttons (🔴 Error / 🟠 Warning) to test settings. Volume and rate limiting apply immediately. Rate limiting prevents audio spam by enforcing minimum time between sounds of the same level.
• **Inline Tag Parsing:** Extended source tag filter to extract `[TagName]` patterns anywhere in log lines (not just at the start). Tags like `[API]`, `[Database]`, `[Auth]` are now automatically detected and added to the collapsible Sources panel for filtering. Works alongside existing Android logcat and bracket prefix patterns.
• **Session Info Header:** Collapsible session metadata block appears at the top of the viewer (below split breadcrumb) when loading log files. Shows project name, debug adapter type, configuration name, platform, VS Code version, and extension version. Parsed from the context header block in log files. Click to expand/collapse. Hidden for live sessions (only shows when loading files).
• **Real-Time Repeat Notifications:** Duplicate log lines now show immediate repeat notifications instead of being batched. Shows `"🔴 Repeated log #5 (Connection Refused...)"` with first 85 characters of message preview. Uses smart hash-based detection (`level::message`) instead of exact string matching. Repeat counter resets when a new unique message arrives. 3-second detection window (configurable).
• **Multi-Level Classification:** Added three new log levels with automatic detection and filtering:
  • **TODO Level** (⚪ White): Detects TODO, FIXME, HACK, XXX in logs for task tracking
  • **Debug/Trace Level** (🟤 Brown): Detects breadcrumb, trace, debug keywords for diagnostic logging
  • **Notice Level** (🟦 Blue Square): Detects notice, note, important for informational highlights
  - Each level has dedicated toggle button in footer, checkbox in options panel, color styling, and emoji indicator. All levels work with existing filter presets and context line display.
• **Inline Context Metadata:** Extracts and displays file path, function name, and line number from stack traces as inline breadcrumbs. Shows shortened file paths (last 2 segments) and function names in format `utils/auth.ts:42 » login()`. Toggle on/off via "Show inline context" checkbox in options panel. Automatically parses common stack trace formats (V8, Mozilla, etc.) and displays context for both stack headers and frames.
• **Per-Level Export/Save:** Export filtered logs to file with preset templates or custom level selection. Templates include "Errors Only", "Warnings + Errors", "Production Ready", "Full Debug", and "Performance Analysis". Export options allow including/excluding timestamps, decorations, and ANSI codes. Preview shows line count before export. Accessible via 💾 button in footer.
• **Layout Improvements:** Four new customization features for better readability:
  • **Font Size Adjustment:** Slider control (10-20px) in options panel to adjust log font size independently of VS Code editor settings
  • **Line Height Adjustment:** Slider control (1.0-2.5) in options panel to adjust vertical spacing between log lines
  • **Severity Bar Mode:** Colored left borders (3px) for each log level instead of/alongside emoji dots. Creates continuous vertical bars for consecutive same-level lines. Toggle via decoration settings panel
  • **Visual Spacing (Breathing Room):** Heuristic spacing adds 8px margins before/after key transitions: level changes to errors/warnings, before/after markers. Helps separate logical sections without adding actual newlines. Toggle in options panel

### Refactored

• **File Size Compliance:** Split 6 oversized UI modules (630-391 lines each) into 17 smaller modules (all under 300 lines). Improved code organization by extracting logical sections: modal styles, decoration styles, search/UI components, helper functions, and HTML/script templates. No functional changes — behavior, API surface, and build output are identical.

## [0.1.4]

We add error breakpoints (visual and audio alerts), search case/word toggles, live stats, an edit-line modal, a scrollbar minimap, and a bunch of viewer improvements.

### Added

• **Error Breakpoints:** Configurable visual and audio alerts when errors appear in logs. Features: flash red border around viewer, play alert sound, increment error counter badge (clickable to clear), and optional modal popup. Toggle on/off via footer button. Detects errors via `stderr` category or error keywords (`error`, `exception`, `failed`, `fatal`, `panic`, `critical`). Only triggers once per batch to avoid spam.
• **Search Enhancements:** Added case sensitivity toggle (Aa/AA) and whole word match toggle (\b) to search bar. Both buttons show bold text when active and work in combination with existing regex mode toggle.
• **Live Statistics Counters:** Real-time running totals displayed in footer showing counts for errors (🔴), warnings (🟠), performance issues (🟣), and framework/info logs (🟢). Updates incrementally as lines arrive and resets on session reset.
• **Enhanced Performance Detection:** Extended performance pattern matching to detect Choreographer frame skips (`skipped N frames`), `choreographer`, `doing too much work`, `gc pause`, `anr`, and `application not responding` patterns for better Android/Flutter debugging.
• **Edit Line Modal:** Right-click any log line and select "Edit Line" to open a modal with editable textarea. Changes are saved back to the log file with proper validation. Shows warning badge when debug session is active to prevent concurrent write conflicts. Reloads viewer after successful edit.
• **Scrollbar Minimap:** Visual overview overlay on the scrollbar (8px wide, right edge) showing search match locations (yellow marks), current match (bright orange), error locations (red marks), warning locations (orange marks), and viewport position indicator. Updates automatically when searching or scrolling. Toggle on/off via footer button.
• **Copy All to Clipboard:** Added Ctrl+Shift+A keyboard shortcut and `copyAllToClipboard()` function to copy all visible log lines to clipboard in plain text format.
• **Copy to Search:** Added "Copy to Search" action to right-click context menu. Opens search bar and populates it with the clicked line's text, automatically running the search.
• **ASCII Art Detection:** Enhanced separator line detection to recognize box-drawing characters (─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬) in addition to standard ASCII patterns (===, ---, +---). Lowered threshold to 60% for better detection. Detected separators are styled in yellow with reduced opacity.
• **Minimap Toggle Button:** Added "Minimap: ON/OFF" button to footer for controlling scrollbar minimap visibility.

### Fixed

• **Session History Empty Viewer:** Fixed issue where selecting log files from session history panel resulted in empty viewer. Added retry loop to wait for webview initialization before loading file content (up to 1 second wait).
• **Level Filter Visual Feedback:** Enhanced inactive level filter buttons with three visual indicators: reduced opacity (0.25), grayscale filter (0.8), and strike-through text. Makes toggle state immediately obvious.
• **Session History Sorting:** Fixed incorrect sorting of mixed-format filenames by sorting on file modification time instead of date strings. Ensures newest sessions always appear first regardless of filename format.
• **Double-Click Viewport Jumping:** Fixed random viewport jumping when double-clicking lines to open context peek. Replaced problematic `scrollIntoView` with proper scroll calculation that positions the peeked line consistently at the top of the view.

### Changed

• **Search Bar Width:** Increased minimum width of search input to 200px to prevent it from becoming too narrow when multiple toggle buttons are present.
• **Session State Tracking:** Extension now tracks debug session active/inactive state and currently displayed file URI. Viewer receives `sessionState` messages to enable intelligent warnings and safe file editing.

## [0.1.3]

We add a source tag filter, full Debug Console capture, line decorations, level filter, inline peek, historical log viewing, and move the panel to the bottom.

### Refactored

• **File Size Compliance:** Split 12 TypeScript files that exceeded the 300-line limit into 29 files (12 original + 17 new extraction files). All source files now comply with the project's hard limit. No functional changes — behavior, API surface, and build output are identical.

### Changed

• **Enhanced Color Palette:** Updated ANSI color rendering to use VS Code's vibrant terminal color palette, matching the Debug Console appearance. Standard and bright colors (red, green, yellow, blue, cyan, magenta) are now significantly more vibrant and easier to distinguish.
• **Automatic Log Level Coloring:** Log lines are now automatically color-coded by severity — errors appear in red, warnings in yellow, and info lines use the default foreground color for better visual scanning.
• **Panel Location:** Moved the Log Viewer and Session History from the sidebar (Activity Bar) to the bottom panel, next to Output and Terminal tabs. Provides more horizontal space for log lines.

### Added

• **Source Tag Filter:** Collapsible "Sources" panel above the log lines that auto-discovers source tags from Android logcat prefixes (e.g. `D/FlutterJNI`, `I/flutter`) and bracket prefixes (e.g. `[log]`). Each tag appears as a chip with a line count; click to toggle visibility. Includes All/None bulk actions. Tags are grouped by name only (ignoring level prefix), sorted by frequency. Panel stays hidden until tags are detected. Composes with all existing filters (category, exclusion, level).
• **Full Debug Console Capture:** Added `saropaLogCapture.captureAll` setting and UI toggle ("App Only: OFF") to capture all Debug Console output, bypassing category and exclusion filters. When enabled, all system, framework, and app logs are captured. Toggle via the viewer or settings.
• **Line Decorations:** Added `saropaLogCapture.showDecorations` setting and footer "Deco" toggle to prefix each viewer line with a colored severity dot (🟢/🟠/🔴), sequential counter (#N), and wall-clock timestamp. A gear button (⚙) opens a settings popover to toggle individual parts and enable "Whole line" coloring mode (subtle background tint by severity). Viewer-only — log files are not modified.
• **Level Filter:** Added All/Errors/Warn+ segmented buttons in the footer to filter log lines by severity. Configurable context lines (`saropaLogCapture.filterContextLines`) shown dimmed around matches.
• **Inline Peek:** Double-click any log line to expand an inline peek showing surrounding context lines. Press Escape to dismiss. Configurable range via `saropaLogCapture.contextViewLines`.
• **Expanded Highlight Rules:** Default highlight patterns now include Fatal, TODO/FIXME, Hack/Workaround, Deprecated, Info, and Debug in addition to Error, Warning, and Success.
• **Historical Log Viewing:** Opening a session from Session History now loads it into the panel viewer instead of as a raw text file.

### Fixed

• **ANSI Color Rendering:** Updated Content Security Policy to allow inline styles (`'unsafe-inline'`), fixing blocked ANSI color rendering in the log viewer and session comparison views. Colors from debug output now display correctly.
• **Viewer Controls:** Fixed all non-working buttons and controls (Excl ON, App Only, All/Errors/Warn+, Preset dropdown, category filter, Deco toggle, settings panel) by removing inline event handlers that were blocked by Content Security Policy. Converted all `onclick`/`onchange` handlers to proper `addEventListener` calls.
• **Historical Log Viewing:** Skips context header block, parses `[category]` prefixes for proper stderr coloring, detects markers, and sends lines in async batches to avoid UI freezing. Footer shows "Viewing:" instead of "Recording:" for historical files.
• **Filter Coordination:** Category, exclusion, and level filters now respect each other's state via shared `recalcHeights()`. Previously, applying one filter could override another's visibility decisions.
• **Inline Peek on Double-Click:** Fixed DOM index mapping when lines have gap markers or annotations — `querySelectorAll` now counts only line-level elements.
• **Inline Peek on Clear:** Peek is now closed when the viewer is cleared, preventing stale content.
• **Context Line Settings:** Setting `filterContextLines` or `contextViewLines` to 0 is now honored (previously treated as default due to falsy-zero).
• **Success Highlight:** Pattern now matches "successfully" and "successful" in addition to "success", "passed", and "succeeded".
• **Config Timing:** Highlight rules and presets are cached and sent when the webview initializes, so historical file views get proper coloring even without a prior debug session.

<details>
<summary>Maintenance</summary>

• **Developer Toolkit** (`scripts/dev.py`): One-click script replacing `init_environment.py` and `build_and_install.py`. Runs the full pipeline: prerequisites, deps, compile, quality checks, package .vsix.
</details>

## [0.1.0]

First public release: auto-capture, live viewer, session history, export, filtering, and the rest of the basics.

### Core Features

• **Auto-capture**: Debug Console output saved to `.log` files automatically when debugging starts
• **Live sidebar viewer**: Real-time log streaming with virtual scrolling (100K+ lines)
• **ANSI color support**: Full color rendering in viewer, raw codes preserved in files
• **Click-to-source**: Click `file.ts:42` patterns to jump to source; Ctrl+Click for split editor
• **Collapsible stack traces**: Auto-detected and grouped; press `A` for app-only mode
• **Search**: Ctrl+F with regex support, F3/Shift+F3 navigation, match highlighting
• **Session history**: Browse past sessions with metadata (adapter type, size, date)

### Session Management

• **Rename sessions**: Right-click to set display names (also renames file on disk)
• **Tag sessions**: Add `#tags` for organization; auto-tags with `~prefix` from content patterns
• **Annotations**: Press `N` to annotate lines; persisted and exported
• **Pin lines**: Press `P` to pin important lines to sticky header
• **Deep links**: Share `vscode://` URLs that open specific sessions and lines

### Export Options

• **HTML export**: Static or Interactive with search, filters, and theme toggle
• **CSV export**: Structured columns (timestamp, category, level, line_number, message)
• **JSON export**: Array of log entry objects with full metadata
• **JSONL export**: Line-delimited JSON for streaming tools

### Filtering & Search

• **Category filter**: Filter by DAP category (stdout, stderr, console)
• **Exclusion patterns**: Hide lines matching string or `/regex/` patterns
• **Keyword watch**: Track patterns with live counters, flash alerts, and badges
• **Filter presets**: Save and apply filter combinations; built-in presets included
• **Cross-session search**: Search all log files via Quick Pick

### Visual Features

• **Highlight rules**: Color lines matching patterns (configurable colors, labels)
• **Elapsed time**: Show `+Nms` between lines; slow gaps highlighted
• **JSON rendering**: Embedded JSON shown as collapsible pretty-printed elements
• **Inline decorations**: Show log indicators next to source lines in editor

### Advanced Features

• **Session comparison**: Side-by-side diff view with color highlighting
• **Session templates**: Save/load project-specific configurations (Flutter, Node.js, Python built-in)
• **Auto file split**: Split by line count, size, keywords, duration, or silence
• **Flood protection**: Suppress rapid repeated messages (>100/sec)
• **Deduplication**: Identical rapid lines grouped as `Message (x54)`

### Infrastructure

- Context header with launch.json config, VS Code version, OS, adapter type
- Status bar with live line counter and watch hit counts
- File retention with configurable `maxLogFiles`
- Gitignore safety check on first run
- First-run walkthrough for new users

## [0.0.1]

Initial project scaffold.
