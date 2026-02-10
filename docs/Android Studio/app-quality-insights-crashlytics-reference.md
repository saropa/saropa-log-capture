<!-- cspell:disable -->
# Documentation: Android Studio App Quality Insights (Firebase Crashlytics)

## 1. Interface Overview
The **App Quality Insights (AQI)** tool is a native Android Studio window that bridges the gap between your local development environment (IDE) and production crash reports stored in **Firebase Crashlytics**.

**Primary Purpose:** To allow developers to detect, investigate, and fix stability issues (crashes and non-fatal errors) without opening a web browser. It provides bidirectional linking: clicking a stack trace in AQI opens the corresponding file and line number in your local project code.

---

## 2. Top Toolbar (Global Navigation & Filtering)
This toolbar controls the scope of the data displayed in the entire window.

*   **Service Tabs:**
    *   **App Quality Insights:** The parent container.
    *   **Android Vitals:** (Currently inactive) Displays Google Play Console performance data (ANRs, start-up times).
    *   **Firebase Crashlytics:** (Currently Active) Displays crash and error data synced from Firebase.
*   **Breadcrumb Selector:**
    *   `app > All: [saropa-mobile] com.saropamobile.app`: A dropdown to select the specific App Module and Package Name being analyzed. Useful for projects with multiple build flavors or modules.
*   **Health Indicators:**
    *   **Red (X) Icon:** Count of unique **Fatal** crashes (app process terminated).
    *   **Yellow (!) Icon:** Count of unique **Non-Fatal** errors (caught exceptions or logged errors).
    *   **Blue (i) Icon:** Informational events.
*   **Filters:**
    *   **Time:** "Last 7 days" (Dropdown to select windows like 24h, 30d, 90d).
    *   **Versions:** "All versions" (Dropdown to filter by specific `versionName` or `versionCode`).
    *   **Signal States:** "All signal states" (Dropdown to filter by Open, Closed, or Muted issues).
    *   **Devices:** "All devices" (Dropdown to isolate specific manufacturers like Samsung, Pixel, etc.).
    *   **OS:** "All operating systems" (Dropdown to filter by Android SDK level).
*   **Refresh Controls:**
    *   **Status Text:** "Last refreshed: 3 minutes ago".
    *   **Refresh Icon:** Manually triggers a sync with Firebase APIs to fetch the latest crash reports.
*   **Window Controls:**
    *   **Minimize (-):** Collapses the tool window.
    *   **Settings (Gear):** Opens configuration for Firebase connections and data caching.

---

## 3. Left Panel: Issue Feed (The Master List)
A scrollable, searchable list of all unique issue clusters detected by Crashlytics.

*   **Search Bar:** Allows filtering the list by exception name, file name, or custom text.
*   **Column Headers:**
    *   **Issues:** The unique signature of the crash.
    *   **Events:** Total number of occurrences.
    *   **Users:** Total number of unique devices affected.
*   **List Item Anatomy:**
    *   **Severity Icon:**
        *   **Yellow Exclamation:** Non-fatal error (e.g., `FlutterError` or caught Java exception).
        *   **Red Cross:** Fatal crash.
    *   **Issue Title:** A truncated summary of the exception (e.g., `...actUpdated`, `...Instance of 'TJ'`).
    *   **AI Insights (Green Sparkles):** (Visible on items like `...ueMessage`) Indicates that Android Studio's AI (Gemini) has generated a summary or potential fix for this crash.
    *   **Event Count:** (e.g., `633`) The raw volume of crashes.
    *   **User Count:** (e.g., `149`) The blast radius of the crash.
    *   **Selection State:** The row highlighted in **Blue** is the currently active issue populating the center and right panels.

---

## 4. Center Panel: Issue Details & Triage
This area provides deep analysis for the single issue selected in the left panel.

### A. Header Section
*   **Variant Selector:** `All (93 variants)` - Allows isolation of crashes to specific build variants (e.g., `debug`, `release`, `staging`).
*   **Aggregate Stats:**
    *   **Lightning Icon:** `633` (Total Events for this filter).
    *   **Person Icon:** `1` (Visible in screenshot details) or `149` (Global).
*   **Triage Controls:**
    *   **Versions affected:** `2025.1120.01 -> 2026.0125.01`. Shows the version range where the crash persists.
    *   **Status Tag - "Regressed":** Indicates this issue was previously marked "Closed" by a developer but has reappeared in a new app version.
    *   **Close issue Button:** Marks the issue as resolved in Firebase.
*   **External Link:** `View on Firebase` (Opens the Firebase Console in a browser).

### B. Event Navigator
Crashlytics groups thousands of crashes into one "Issue," but you analyze them one "Event" at a time.
*   **Event ID:** `Event 218333...866768` (Unique UUID for this specific crash instance).
*   **Pagination:** `< >` arrows to step through different instances of the crash to compare variables.
*   **Device Metadata (For this specific event):**
    *   **Device:** `vivo V2420`.
    *   **OS:** `Android 14`.
    *   **Timestamp:** `Feb 9, 2026, 10:51:53 AM`.
    *   **Info Icon:** "No data" (indicates no custom logs/keys attached to this specific event).

### C. The Stack Trace View
The core debugging area.
*   **Tabs:**
    *   **Stack trace:** The execution path leading to the crash.
    *   **Keys:** Custom key-value pairs (e.g., `user_id: 12345`) logged by the developer.
    *   **Logs:** Breadcrumb logs (e.g., "User tapped button", "Network request started").
*   **Trace Content (Specific to Screenshot):**
    *   **Exception Type:** `io.flutter.plugins.firebase.crashlytics.FlutterError`. This indicates a crash in the Dart/Flutter layer, not the native Android layer.
    *   **Error Message:** Red text detailing the logic failure:
        *   `Missing [OrganizationModel] for [activity]: [Has metadata]...`
        *   `[activityType]: 'OrganizationAddedTo'`
        *   `[givenName]: 'English'`
    *   **Interactive Frames:**
        *   **Hyperlinks:** Text like `(activity_utils.dart:405)` is clickable.
        *   **Function:** Clicking these links immediately opens the `activity_utils.dart` file in the editor and scrolls to line `405`.
    *   **Frame Analysis:**
        *   `ActivityModelExtensions._getOrganizationMetaName`: The utility method failing.
        *   `_ActivityViewWidgetState._fetchActivityViewData`: The UI widget requesting the data.
        *   `async.dart`: Indicates the crash happened inside an asynchronous operation (Future/Stream).

---

## 5. Right Panel: Analytics & Trends
Visualizations to help determine if a crash is isolated to specific hardware or software.

*   **Devices Chart:** A horizontal bar chart showing manufacturer distribution.
    *   **INFINIX:** 24% (Dominant device for this crash).
    *   **TECNO:** 17%.
    *   **Samsung:** 15%.
    *   **Other:** 44%.
    *   **Insight Text:** "Most affected device: Infinix X6882".
*   **Android Versions Chart:** A horizontal bar chart showing OS distribution.
    *   **Android 14:** 33%.
    *   **Android 15:** 26%.
    *   **Android 16:** 11% (Indicates testing on future/beta OS versions).
    *   **Android 10:** 10%.
    *   **Insight Text:** "Most affected Android version: Android 14".
*   **Sidebar Toggle (Vertical Edge):**
    *   **Insights (Selected):** Shows the charts described above.
    *   **Details:** Displays raw JSON-like metadata about the device (RAM, disk space, orientation, background state).
    *   **Notes:** A shared notepad for team members to leave comments on the issue (synced with Firebase).

---

## 6. IDE Integration Context (Far Left Strip)
These are standard Android Studio tool windows visible alongside AQI, showing how the tool fits into the workflow.

*   **Profiler:** For analyzing CPU, Memory, and Energy usage.
*   **App Quality Insights:** The currently active tool.
*   **Logcat:** For viewing live logs from a connected device.
*   **Problems:** Displays syntax errors and warnings.
*   **Terminal:** Command line interface.
*   **Git:** Version control integration.

---

## 7. Gap Analysis: Saropa Log Capture vs AQI

This section maps every AQI capability to the current state of Saropa Log Capture, identifies gaps, and proposes actionable improvements. Each item is tagged with its priority and estimated complexity.

### Notation

| Symbol | Meaning |
|--------|---------|
| **HAS** | Feature exists in Saropa today |
| **PARTIAL** | Partially implemented — core logic exists but UX or scope is limited |
| **GAP** | Not implemented — opportunity for improvement |

---

### 7.1 Issue Feed (AQI Left Panel)

AQI shows a persistent, scrollable, searchable master list of all unique crash issues across the entire project, with severity icon, event count, and user count columns.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Persistent issue list | **GAP** | Saropa queries Crashlytics on-demand when a user right-clicks a log line. There is no always-visible crash feed. Issues are only shown as matching cards inside the analysis panel, scoped to one log line at a time. |
| Search/filter within issue list | **GAP** | No text search across Crashlytics issues. Token matching is automatic (error tokens from the analyzed line), not user-driven. |
| Severity icons (Fatal vs Non-Fatal) | **PARTIAL** | `queryTopIssues` requests both `FATAL` and `NON_FATAL` error types, but the response does not distinguish them in the rendered cards — both get the same visual treatment. |
| Event count column | **HAS** | `CrashlyticsIssue.eventCount` is displayed on each issue card. |
| User count column | **HAS** | `CrashlyticsIssue.userCount` is displayed on each issue card. |
| AI Insights indicator | **GAP** | No AI-powered crash summary or fix suggestion. AQI uses Gemini to generate explanations. |

**Improvement ideas:**

1. **Dedicated Crashlytics sidebar view** — Add a new `WebviewViewProvider` (like `log-viewer-provider.ts`) that shows the top Crashlytics issues in a persistent panel. The view would auto-refresh on a configurable interval and support text filtering. This moves crash data from on-demand analysis to always-visible monitoring.
   - *Priority:* Medium. *Complexity:* High (~3 new files, ~400 lines).

2. **Fatal/Non-Fatal severity badges** — The Crashlytics REST API's `topIssues` response includes `issue.issueType` or equivalent. Parse and surface this as a red (fatal) vs yellow (non-fatal) icon on each issue card, matching the AQI visual language.
   - *Priority:* Low. *Complexity:* Low (~15 lines in `firebase-crashlytics.ts` + `analysis-related-render.ts`).

3. **AI crash summary via Copilot Chat API** — VS Code's Copilot Chat extension exposes a `vscode.lm` API for language model access. When a crash event detail is expanded, send the stack trace + error message to the LM and display a one-paragraph summary + suggested fix inline. Gate behind a setting (`saropaLogCapture.ai.enabled`).
   - *Priority:* Low (exploratory). *Complexity:* Medium (~1 new file, ~150 lines).

---

### 7.2 Issue Details & Triage (AQI Center Panel — Header)

AQI provides variant selection, version range display, regression status, and issue lifecycle controls (Close/Mute).

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Variant selector | **GAP** | Not applicable to Saropa's query (no variant dimension in REST request). Would require expanding the API call with `issueFilters.appBuildVariants`. |
| Version range affected | **GAP** | The topIssues API returns version data but Saropa does not parse or display it. |
| Status tags (Regressed, Closed, Open) | **GAP** | `issue.state` from the API is not parsed. All issues render the same way regardless of triage state. |
| Close/Mute issue button | **GAP** | No write-back to Firebase. All interactions are read-only. |
| "View on Firebase" link | **HAS** | `consoleUrl` is constructed and shown in the analysis panel. |

**Improvement ideas:**

4. **Display version range on issue cards** — Parse `issue.firstSeenVersion` and `issue.lastSeenVersion` from the API response and render below the event/user counts. Shows at a glance whether a crash is new or chronic.
   - *Priority:* Medium. *Complexity:* Low (~20 lines).

5. **Show issue state badge** — Parse `issue.state` (OPEN, CLOSED, REGRESSION) and render a colored badge on each card (green=closed, red=regressed, gray=open). Helps prioritize which crashes to investigate.
   - *Priority:* Medium. *Complexity:* Low (~20 lines).

6. **Close/Mute issue from VS Code** — The Crashlytics REST API supports PATCH operations to update issue state. Add a context menu action on each issue card: "Close Issue" / "Mute Issue". Requires confirming the OAuth scope includes write access.
   - *Priority:* Low. *Complexity:* Medium (~40 lines + API validation).

---

### 7.3 Event Navigator (AQI Center Panel — Event Stepping)

AQI lets you page through individual crash events for the same issue, showing per-event device metadata (device model, OS version, timestamp).

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Event pagination (prev/next) | **GAP** | `getCrashEventDetail` fetches exactly 1 event (`pageSize=1`). No way to browse other events for the same issue. |
| Per-event device metadata | **GAP** | The event response likely contains device model, OS version, and timestamp, but these fields are not parsed or displayed. Only the stack trace is extracted. |
| Event ID display | **GAP** | The event identifier is not shown. |

**Improvement ideas:**

7. **Multi-event fetching and pagination** — Change `pageSize=1` to `pageSize=5` (or configurable). Store the event list in the cached detail. Render `< 1/5 >` navigation buttons in the crash detail panel, updating device metadata and stack trace as the user pages.
   - *Priority:* Medium. *Complexity:* Medium (~60 lines in `firebase-crashlytics.ts` + `analysis-crash-detail.ts`).

8. **Device metadata display** — Parse `event.deviceModel`, `event.osVersion`, and `event.eventTime` from each crash event. Show as a metadata strip below the issue header: `📱 vivo V2420 · Android 14 · Feb 9, 2026 10:51 AM`.
   - *Priority:* Medium. *Complexity:* Low (~30 lines).

---

### 7.4 Stack Trace View (AQI Center Panel — Tabs)

AQI shows the crash stack trace with clickable frames, plus Keys and Logs tabs for custom developer data.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Stack trace with clickable frames | **HAS** | `renderCrashDetail()` in `analysis-crash-detail.ts` renders frames with APP/FW badges. App frames with recognized filenames are clickable (opens source file). |
| Frame classification (app vs framework) | **HAS** | Uses `isFrameworkFrame()` logic, same as the log viewer. |
| Keys tab (custom key-value pairs) | **GAP** | The events API returns `customKeys` but they are not parsed or displayed. |
| Logs tab (breadcrumb logs) | **GAP** | The events API returns `logs` (breadcrumb entries) but they are not parsed or displayed. |
| Exception type + error message formatting | **PARTIAL** | The issue title and subtitle are shown, but the rich formatted error message (with color-coded brackets, quoted values) seen in AQI is not reproduced. |

**Improvement ideas:**

9. **Parse and display custom Keys** — Add a collapsible "Keys" section below the stack trace in crash detail. Parse `event.customKeys` as a key-value table. These are developer-set context values (user ID, screen name, feature flags) that are critical for debugging.
   - *Priority:* High. *Complexity:* Low (~40 lines).

10. **Parse and display Logs/breadcrumbs** — Add a collapsible "Logs" section showing the breadcrumb trail leading to the crash. Parse `event.logs` entries with timestamps. This recreates the AQI Logs tab and provides the narrative of user actions before the crash.
    - *Priority:* High. *Complexity:* Low (~40 lines).

11. **Rich error message formatting** — Parse the error message for structured content (bracketed values, quoted strings, key-value pairs) and apply syntax-highlighted formatting using `--vscode-*` CSS variables, matching how AQI uses red text for error details.
    - *Priority:* Low. *Complexity:* Low (~25 lines in render logic).

---

### 7.5 Analytics & Trends (AQI Right Panel)

AQI provides device and OS distribution bar charts, insight text, raw device metadata, and team notes.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Device distribution chart | **GAP** | No device/OS breakdown. Would require querying `issueStats` or aggregating from multiple events. |
| OS version distribution chart | **GAP** | Same — not queried or rendered. |
| Insight text ("Most affected device: ...") | **GAP** | No automated insight generation from crash demographics. |
| Details tab (RAM, disk, orientation) | **GAP** | Per-event device metadata not parsed (see item 8). |
| Notes tab (team collaboration) | **GAP** | No shared notepad. Saropa has per-line annotations in `.meta.json` but these are local-only and per-session, not per-crash-issue. |

**Improvement ideas:**

12. **Device/OS distribution from multi-event data** — If item 7 (multi-event fetching) is implemented, aggregate device model and OS version across fetched events. Render as simple HTML bar charts in the crash detail panel. Even 5 events give a useful signal.
    - *Priority:* Low. *Complexity:* Medium (~80 lines for chart rendering).

13. **Query Crashlytics issue stats endpoint** — The REST API may expose aggregate device/OS stats per issue (beyond individual events). Investigate `reports/issueStats:query` or similar endpoints. If available, render as bar charts without needing multi-event aggregation.
    - *Priority:* Low. *Complexity:* Medium (API research + ~60 lines).

14. **Local cross-session device aggregation** — Saropa already captures environment metadata in session headers (platform, SDK version, etc.). Aggregate these across sessions via `cross-session-aggregator.ts` to show which local environments produce the most errors. This is a Saropa-unique insight that AQI cannot provide.
    - *Priority:* Medium. *Complexity:* Medium (~50 lines in aggregator + render).

---

### 7.6 Global Filtering (AQI Top Toolbar)

AQI provides multi-dimensional filtering: time range, app version, signal state, device, and OS.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Time range filter | **GAP** | The `topIssues` query has no time window parameter. All issues are returned regardless of recency. |
| Version filter | **GAP** | No version dimension in the query. |
| Signal state filter (Open/Closed/Muted) | **GAP** | No state filtering — all states returned. |
| Device filter | **GAP** | No device dimension. |
| OS filter | **GAP** | No OS dimension. |
| Refresh controls with timestamp | **GAP** | No "last refreshed" display. Queries are fire-and-forget on each analysis. |

**Improvement ideas:**

15. **Add time range to topIssues query** — The REST API supports `issueFilters.eventTimePeriod` or similar. Add a setting `saropaLogCapture.firebase.timeRange` with values like `LAST_24H`, `LAST_7D`, `LAST_30D`. Default to 7 days to match AQI.
    - *Priority:* High. *Complexity:* Low (~15 lines in `queryTopIssues`).

16. **Pass version filter to API** — If the workspace has a `pubspec.yaml` or `build.gradle` with a version, auto-detect it and offer to filter Crashlytics results to "current version only". Useful for catching regressions in the version being debugged.
    - *Priority:* Medium. *Complexity:* Medium (~40 lines).

17. **Cache and display refresh timestamp** — Store the last successful query time and show it in the analysis panel header: "Crashlytics data from 3 minutes ago". Add a manual refresh button.
    - *Priority:* Low. *Complexity:* Low (~10 lines).

---

### 7.7 Bidirectional IDE Linking

AQI's core value proposition is that clicking a stack frame opens the corresponding local source file.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Crash frame → local source file | **HAS** | `source-linker.ts` detects `file.ext:line:col` patterns. Crash detail frames with recognized filenames generate clickable links. `analysis-frame-handler.ts` resolves workspace files. |
| Workspace file resolution | **HAS** | `findInWorkspace()` in `workspace-analyzer.ts` searches for filename matches across the workspace. |
| URL linkification | **HAS** | `linkifyUrls()` wraps HTTP/HTTPS URLs as clickable data-url links. |
| GitHub link generation | **HAS** | `buildGitHubFileUrl()` and `buildGitHubCommitUrl()` in `link-helpers.ts`. |

**Improvement ideas:**

18. **Fuzzy file resolution for Crashlytics frames** — AQI benefits from Android Studio's project model to resolve frames like `activity_utils.dart:405` to the exact workspace file. Saropa uses filename-only matching via `findInWorkspace()`. For monorepo or multi-package workspaces, this can produce false matches. Improve by incorporating package name hints from the frame's class path (e.g., `com.saropamobile.app` → filter to `android/` or `lib/` subtree).
    - *Priority:* Medium. *Complexity:* Medium (~40 lines in `workspace-analyzer.ts`).

19. **Reverse linking: local error → matching Crashlytics issue** — AQI is one-directional within its panel. Saropa could go further: when a user opens a source file that appears in a cached Crashlytics crash trace, show a CodeLens or diagnostic hint: "This file appears in 3 Crashlytics crashes (633 events)". This creates a passive awareness channel that AQI lacks.
    - *Priority:* Low (high impact, experimental). *Complexity:* High (~1 new file, ~200 lines).

---

### 7.8 Features Where Saropa Already Exceeds AQI

These are capabilities that Saropa has which AQI does not offer. They represent competitive advantages to protect and extend.

| Saropa Feature | AQI Equivalent | Advantage |
|---------------|----------------|-----------|
| **Cross-session error aggregation** — recurring errors across all debug sessions with timeline and session count | None — AQI only shows production crashes, not debug history | Connects debug-time errors to production patterns. A crash seen in 12 debug sessions is more actionable than one seen once. |
| **Automated bug report generation** — 15+ evidence types compiled into markdown (git blame, source preview, imports, symbols, docs matches, cross-session history) | None — AQI provides raw data only, no generated reports | One-click export to GitHub Issues or Slack with full context. |
| **Git blame integration** — shows who last touched the crashing line and when | None — AQI has no VCS integration beyond file linking | Instantly answers "who should fix this?" and "was this recently changed?" |
| **Documentation token matching** — scans `docs/` and `bugs/` for tokens related to the crash | None | Links crashes to known issues, troubleshooting guides, and design docs. |
| **Session timeline visualization** — SVG timeline of errors/warnings over time within a session | None — AQI has no temporal visualization | Shows error clustering patterns (burst at startup, gradual accumulation, etc.). |
| **Correlation tags** — auto-extracted `file:` and `error:` tags for session cross-referencing | None | Makes the session archive searchable by crash signature. |
| **Hot files ranking** — cross-session aggregation of most-referenced source files | None | Identifies the most unstable files across all debugging history. |
| **Log deduplication** — `Error (x54)` instead of 54 identical lines | Logcat has no dedup | Keeps logs readable during error storms. |
| **Per-line annotations** — user notes attached to specific log lines | Notes tab is per-issue, not per-line | More granular annotation for debugging workflows. |
| **Source scope filter** — filter log lines by source file/class reference | No equivalent | Narrow a noisy log to just one component. |

**Improvement ideas for existing advantages:**

20. **Cross-reference debug crashes with Crashlytics** — When `cross-session-aggregator.ts` identifies a recurring error, automatically check if the same fingerprint matches a Crashlytics issue. Show a badge: "Also seen in production: 633 events, 149 users". This bridges the debug→production gap that neither tool currently closes.
    - *Priority:* High. *Complexity:* Medium (~50 lines across aggregator + firebase-crashlytics).

21. **Export bug report with Crashlytics data** — When `formatBugReport()` runs, if a matching Crashlytics issue exists, include a "## Production Impact" section with event count, user count, version range, and console link. Adds production context to debug-originated bug reports.
    - *Priority:* Medium. *Complexity:* Low (~30 lines in `bug-report-formatter.ts`).

22. **Trend sparkline in session history** — For sessions with severity counts cached in `.meta.json`, render a tiny sparkline (like GitHub contribution graphs) showing error density per session. This brings the timeline visualization to the session list level.
    - *Priority:* Low. *Complexity:* Medium (~60 lines in session tree rendering).

---

### 7.9 Architecture & Performance Gaps

| Concern | Current State | Proposed Fix |
|---------|--------------|-------------|
| **Single-event caching** | `getCrashEventDetail` caches 1 event per issue. If multi-event pagination is added (item 7), the cache format changes. | Introduce a versioned cache schema (`version: 2`) with an array of events. Migrate existing single-event caches on read. |
| **Cache location** | `reports/.crashlytics/{issueId}.json` pollutes the user-facing log directory. | Migrate to `.saropa/cache/crashlytics/` per `PLAN_PROJECT_INDEXER.md` Stage 1. Already designed, not yet implemented. |
| **Token matching accuracy** | `matchIssues()` does case-insensitive substring matching of error tokens against issue title+subtitle. This can produce false positives (e.g., token "Error" matches every issue). | Weight matches by token specificity: full class names (`NullPointerException`) rank higher than generic words (`Error`). Require at least one specific token match. |
| **No pagination of topIssues** | Only fetches 20 issues (`pageSize: 20`). Projects with hundreds of crash types may miss matches. | Add cursor-based pagination: if no matches found in first page, fetch next page (up to 3 pages / 60 issues). |
| **gcloud CLI dependency** | Auth depends on `gcloud auth application-default print-access-token`. Users without gcloud installed cannot use Firebase features. | Offer an alternative auth flow: VS Code's built-in `vscode.authentication` API supports Google accounts via the "GitHub" and "Microsoft" providers. Investigate adding a Google OAuth provider or using a service account JSON file directly. |
| **No offline/cached issue list** | Every analysis re-queries the API. Opening the same log file twice makes two identical API calls. | Cache the issue list response for the configured time range. Invalidate on manual refresh or after 5 minutes. |

---

### 7.10 Prioritized Roadmap

Items grouped by implementation phase, ordered by impact-to-effort ratio.

#### Phase 1: Quick Wins (Low complexity, high value)

| # | Item | Effort |
|---|------|--------|
| 15 | Add time range filter to Crashlytics query | ~15 lines |
| 4 | Display version range on issue cards | ~20 lines |
| 5 | Show issue state badge (Open/Closed/Regressed) | ~20 lines |
| 2 | Fatal vs Non-Fatal severity icon | ~15 lines |
| 17 | Cache and display refresh timestamp | ~10 lines |
| 8 | Device metadata display per crash event | ~30 lines |

#### Phase 2: High-Impact Features (Medium complexity)

| # | Item | Effort |
|---|------|--------|
| 9 | Parse and display custom Keys tab | ~40 lines |
| 10 | Parse and display Logs/breadcrumbs tab | ~40 lines |
| 20 | Cross-reference debug errors with Crashlytics | ~50 lines |
| 21 | Include Crashlytics data in bug reports | ~30 lines |
| 7 | Multi-event fetching and pagination | ~60 lines |
| 18 | Fuzzy file resolution for Crashlytics frames | ~40 lines |

#### Phase 3: Strategic Features (High complexity, differentiating)

| # | Item | Effort |
|---|------|--------|
| 1 | Dedicated Crashlytics sidebar view | ~400 lines (3 files) |
| 19 | Reverse linking: CodeLens for crash-affected files | ~200 lines |
| 14 | Local cross-session device aggregation | ~50 lines |
| 12 | Device/OS distribution charts from multi-event data | ~80 lines |

#### Phase 4: Exploratory (Low priority, high ambition)

| # | Item | Effort |
|---|------|--------|
| 3 | AI crash summary via VS Code LM API | ~150 lines |
| 6 | Close/Mute issue write-back to Firebase | ~40 lines |
| 13 | Query Crashlytics issueStats endpoint | ~60 lines |
| 16 | Auto-detect app version for filtered queries | ~40 lines |
| 22 | Trend sparkline in session history tree | ~60 lines |

---

### 7.11 Summary

**AQI's core strength** is a persistent, richly-filtered issue feed with event-level drill-down, device analytics, and triage controls — all within the IDE.

**Saropa's core strength** is connecting debug-time errors to production impact through cross-session aggregation, automated bug reports, git blame, and documentation matching — capabilities AQI does not have.

**The highest-value gap to close** is making Crashlytics data richer and more persistent: parsing Keys/Logs tabs (items 9-10), adding time range filtering (item 15), and cross-referencing debug errors with production crashes (item 20). These changes are low-to-medium effort and directly increase the value of the existing Firebase integration.

**The highest-value gap to widen** is the debug-to-production bridge (item 20) and Crashlytics-enhanced bug reports (item 21). No competing tool combines local debug history with production crash data in a single view. This is Saropa's unique positioning opportunity.
