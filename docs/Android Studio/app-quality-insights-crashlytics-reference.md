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
| **DONE** | Improvement idea has been implemented |

---

### 7.1 Issue Feed (AQI Left Panel)

AQI shows a persistent, scrollable, searchable master list of all unique crash issues across the entire project, with severity icon, event count, and user count columns.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Persistent issue list | **HAS** | `CrashlyticsPanelProvider` in `crashlytics-panel.ts` provides a persistent sidebar panel showing top Crashlytics issues. Auto-refreshes and supports manual refresh. |
| Search/filter within issue list | **GAP** | No text search across Crashlytics issues. Token matching is automatic (error tokens from the analyzed line), not user-driven. |
| Severity icons (Fatal vs Non-Fatal) | **HAS** | `renderIssueBadges()` in `analysis-related-render.ts` renders FATAL/NON-FATAL badges with distinct colors. `CrashlyticsIssue.isFatal` parsed from API response. |
| Event count column | **HAS** | `CrashlyticsIssue.eventCount` is displayed on each issue card. |
| User count column | **HAS** | `CrashlyticsIssue.userCount` is displayed on each issue card. |
| AI Insights indicator | **HAS** | `generateCrashSummary()` in `crashlytics-ai-summary.ts` uses `vscode.lm` API. Gated behind `saropaLogCapture.ai.enabled` setting. Summary renders progressively after crash detail loads. |

**Improvement ideas:**

1. **DONE — Dedicated Crashlytics sidebar view** — `CrashlyticsPanelProvider` in `crashlytics-panel.ts` implements a persistent `WebviewViewProvider` with auto-refresh, manual refresh button, and issue cards showing severity, event/user counts, and version range.

2. **DONE — Fatal/Non-Fatal severity badges** — `renderIssueBadges()` in `analysis-related-render.ts` renders colored FATAL/NON-FATAL badges. `CrashlyticsIssue.isFatal` is parsed from `issue.type`/`issue.issueType` in `matchIssues()`.

3. **DONE — AI crash summary via VS Code LM API** — `generateCrashSummary()` in `crashlytics-ai-summary.ts` uses `vscode.lm.selectChatModels()` to find any available language model. Sends stack trace, device info, and custom keys as context. Summary renders progressively after crash detail loads via `crashAiSummary` message. Gated behind `saropaLogCapture.ai.enabled` setting.

---

### 7.2 Issue Details & Triage (AQI Center Panel — Header)

AQI provides variant selection, version range display, regression status, and issue lifecycle controls (Close/Mute).

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Variant selector | **GAP** | Not applicable to Saropa's query (no variant dimension in REST request). Would require expanding the API call with `issueFilters.appBuildVariants`. |
| Version range affected | **HAS** | `renderVersionRange()` in `analysis-related-render.ts` and `formatVersionRange()` in `crashlytics-panel.ts` display `firstVersion → lastVersion` on issue cards. Parsed from `issue.firstSeenVersion`/`issue.lastSeenVersion`. |
| Status tags (Regressed, Closed, Open) | **HAS** | `parseIssueState()` in `firebase-crashlytics.ts` parses OPEN/CLOSED/REGRESSION states. `renderIssueBadges()` renders colored state badges (green=closed, red=regressed, gray=open). |
| Close/Mute issue button | **HAS** | `updateIssueState()` in `firebase-crashlytics.ts` makes PATCH requests to the Firebase API. Close/Mute buttons rendered in `crashlytics-panel.ts` and wired via message handlers. |
| "View on Firebase" link | **HAS** | `consoleUrl` is constructed and shown in the analysis panel. |

**Improvement ideas:**

4. **DONE — Display version range on issue cards** — `CrashlyticsIssue` includes `firstVersion`/`lastVersion`. Rendered by `renderVersionRange()` in `analysis-related-render.ts` and `formatVersionRange()` in `crashlytics-panel.ts`.

5. **DONE — Show issue state badge** — `parseIssueState()` parses OPEN/CLOSED/REGRESSION from the API. `renderIssueBadges()` renders colored badges (`fb-badge-open`, `fb-badge-closed`, `fb-badge-regressed`).

6. **DONE — Close/Mute issue from VS Code** — `updateIssueState()` makes PATCH requests. Sidebar panel renders Close/Mute buttons with `data-action` attributes, wired to `handleMessage()`.

---

### 7.3 Event Navigator (AQI Center Panel — Event Stepping)

AQI lets you page through individual crash events for the same issue, showing per-event device metadata (device model, OS version, timestamp).

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Event pagination (prev/next) | **HAS** | `getCrashEvents()` fetches up to 5 events per issue (`pageSize=5`). `CrashlyticsIssueEvents` stores the array with `currentIndex`. `fetchCrashDetail()` renders prev/next navigation buttons. `navigateCrashEvent` message handler in `analysis-panel.ts` steps through events. |
| Per-event device metadata | **HAS** | `renderDeviceMeta()` in `analysis-crash-detail.ts` displays `deviceModel`, `osVersion`, and `eventTime` from `CrashlyticsEventDetail`. |
| Event ID display | **GAP** | The event identifier is not shown. |

**Improvement ideas:**

7. **DONE — Multi-event fetching and pagination** — `getCrashEvents()` fetches up to 5 events per issue. `CrashlyticsIssueEvents` stores them with `currentIndex`. `fetchCrashDetail()` renders prev/next navigation buttons. `navigateCrashEvent` message handler in `analysis-panel.ts` steps through events and re-renders the detail view.

8. **DONE — Device metadata display** — `renderDeviceMeta()` in `analysis-crash-detail.ts` renders device model, OS version, and event timestamp from `CrashlyticsEventDetail`.

---

### 7.4 Stack Trace View (AQI Center Panel — Tabs)

AQI shows the crash stack trace with clickable frames, plus Keys and Logs tabs for custom developer data.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Stack trace with clickable frames | **HAS** | `renderCrashDetail()` in `analysis-crash-detail.ts` renders frames with APP/FW badges. App frames with recognized filenames are clickable (opens source file). |
| Frame classification (app vs framework) | **HAS** | Uses `isFrameworkFrame()` logic, same as the log viewer. |
| Keys tab (custom key-value pairs) | **HAS** | `renderKeysSection()` in `analysis-crash-detail.ts` renders `customKeys` as a collapsible key-value table. Parsed from `CrashlyticsEventDetail.customKeys`. |
| Logs tab (breadcrumb logs) | **HAS** | `renderLogsSection()` in `analysis-crash-detail.ts` renders `logs` as a collapsible breadcrumb list with timestamps. Parsed from `CrashlyticsEventDetail.logs`. |
| Exception type + error message formatting | **PARTIAL** | The issue title and subtitle are shown, but the rich formatted error message (with color-coded brackets, quoted values) seen in AQI is not reproduced. |

**Improvement ideas:**

9. **DONE — Parse and display custom Keys** — `renderKeysSection()` in `analysis-crash-detail.ts` renders a collapsible "Keys" section with a key-value table. `CrashlyticsEventDetail.customKeys` parsed by `crashlytics-event-parser.ts`.

10. **DONE — Parse and display Logs/breadcrumbs** — `renderLogsSection()` in `analysis-crash-detail.ts` renders a collapsible "Logs" section with timestamped breadcrumb entries. `CrashlyticsEventDetail.logs` parsed by `crashlytics-event-parser.ts`.

11. **Rich error message formatting** — Parse the error message for structured content (bracketed values, quoted strings, key-value pairs) and apply syntax-highlighted formatting using `--vscode-*` CSS variables, matching how AQI uses red text for error details.
    - *Priority:* Low. *Complexity:* Low (~25 lines in render logic).

---

### 7.5 Analytics & Trends (AQI Right Panel)

AQI provides device and OS distribution bar charts, insight text, raw device metadata, and team notes.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Device distribution chart | **HAS** | `renderDeviceDistribution()` in `analysis-crash-detail.ts` aggregates device model and OS version from multi-event data. Renders horizontal bar charts with counts and percentages. |
| OS version distribution chart | **HAS** | Same function — renders OS version distribution as a separate bar chart section. |
| Insight text ("Most affected device: ...") | **GAP** | No automated insight generation from crash demographics. |
| Details tab (RAM, disk, orientation) | **GAP** | Per-event device metadata is parsed (see item 8) but detailed hardware specs (RAM, disk, orientation) are not extracted. |
| Notes tab (team collaboration) | **GAP** | No shared notepad. Saropa has per-line annotations in `.meta.json` but these are local-only and per-session, not per-crash-issue. |

**Improvement ideas:**

12. **DONE — Device/OS distribution from multi-event data** — `renderDeviceDistribution()` in `analysis-crash-detail.ts` aggregates `deviceModel` and `osVersion` across all fetched events. Renders horizontal bar charts with counts and percentages via `renderDistributionBar()`. Called from `fetchCrashDetail()` in `analysis-panel.ts`.

13. **PARTIAL — Query Crashlytics issueStats endpoint** — `getIssueStats()` in `crashlytics-stats.ts` implements the API call with proper timeout and error handling. However, it has no callers — the function is defined but not wired into any UI rendering.

14. **DONE — Local cross-session device aggregation** — `buildEnvironmentStats()` in `cross-session-aggregator.ts` aggregates platform and SDK version tags across sessions. Returns `platforms` and `sdkVersions` arrays rendered in the Insights panel. This is a Saropa-unique insight that AQI cannot provide.

---

### 7.6 Global Filtering (AQI Top Toolbar)

AQI provides multi-dimensional filtering: time range, app version, signal state, device, and OS.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Time range filter | **HAS** | `getTimeRange()` in `firebase-crashlytics.ts` reads `saropaLogCapture.firebase.timeRange` setting and passes `eventTimePeriod` to the API query. Defaults to `LAST_7_DAYS`. |
| Version filter | **HAS** | `detectAppVersion()` in `firebase-crashlytics.ts` auto-detects version from `pubspec.yaml` or `build.gradle` and passes it as a version filter. Also supports manual `saropaLogCapture.firebase.versionFilter` setting. |
| Signal state filter (Open/Closed/Muted) | **GAP** | No state filtering — all states returned. |
| Device filter | **GAP** | No device dimension. |
| OS filter | **GAP** | No OS dimension. |
| Refresh controls with timestamp | **HAS** | `formatElapsedLabel()` in `ansi.ts` renders "just now" / "42s ago" / "3m ago" labels. Used in the analysis panel (`analysis-related-render.ts`), Crashlytics sidebar (`crashlytics-panel.ts`), and Insights panel (`insights-panel.ts`). Manual refresh button in sidebar clears the 5-minute TTL cache. |

**Improvement ideas:**

15. **DONE — Add time range to topIssues query** — `getTimeRange()` reads `saropaLogCapture.firebase.timeRange` setting and passes `eventTimePeriod` in the API request body. Defaults to `LAST_7_DAYS`.

16. **DONE — Pass version filter to API** — `detectAppVersion()` scans `pubspec.yaml` and `build.gradle` for version strings. Also supports manual override via `saropaLogCapture.firebase.versionFilter`. Version is passed in `issueFilters.versions` to the API.

17. **DONE — Cache and display refresh timestamp** — `queriedAt` timestamp stored in `FirebaseContext` and `CrossSessionInsights`. `formatElapsedLabel()` shared helper in `ansi.ts` renders elapsed time. Issue list responses cached in memory for 5 minutes (`cachedIssueRows` with TTL). `clearIssueListCache()` bypasses cache on manual refresh.

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

18. **DONE — Fuzzy file resolution with package hints** — `extractPackageHint()` in `source-linker.ts` extracts Dart package names (`package:app_name/`) and Java package paths (`com.example.app.ClassName`) from stack frame text. Hints are forwarded through `analyzeSourceFile()`, `runReferencedFiles()` in the analysis panel, and `collectFileAnalyses()` → `resolveSourceUri()` in bug report collection. `findInWorkspace()` already prefers files matching package path segments.

19. **DONE — Reverse linking: CodeLens for crash-affected files** — `CrashlyticsCodeLensProvider` in `crashlytics-codelens.ts` builds an index from cached `.crashlytics/*.json` files, mapping filenames to issue counts and event totals. Registered as a VS Code CodeLens provider in `extension.ts`. Shows "Crashlytics: N issues, M cached events" at the top of affected source files. Index cached for 5 minutes with `invalidate()` hook.

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

20. **DONE — Cross-reference ALL recurring errors with Crashlytics** — `bridgeErrorsToCrashlytics()` in `insights-panel.ts` matches all recurring error patterns (not just ANRs) against cached Crashlytics issues. Matching errors show a "Production: N events, N users" badge via progressive webview update. Uses `getFirebaseContext([])` to access the 5-minute TTL cache without extra API calls.

21. **DONE — Include Crashlytics data in bug reports** — `FirebaseMatch` interface in `bug-report-collector.ts` stores issue title, event/user counts, version range, and console URL. `formatProductionImpact()` in `bug-report-formatter.ts` renders a "## Production Impact" section with event count, affected users, version range, and Firebase Console deep link.

22. **Trend sparkline in session history** — For sessions with severity counts cached in `.meta.json`, render a tiny sparkline (like GitHub contribution graphs) showing error density per session. This brings the timeline visualization to the session list level.
    - *Priority:* Low. *Complexity:* Medium (~60 lines in session tree rendering).

---

### 7.9 Architecture & Performance Gaps

| Concern | Current State | Proposed Fix |
|---------|--------------|-------------|
| **Single-event caching** | **FIXED.** `CrashlyticsIssueEvents` stores up to 5 events per issue with `currentIndex`. `readCachedEvents()` auto-migrates v1 single-event caches to the multi-event format on read. | ~~Introduce a versioned cache schema with an array of events. Migrate existing single-event caches on read.~~ |
| **Cache location** | `reports/.crashlytics/{issueId}.json` pollutes the user-facing log directory. | Migrate to `.saropa/cache/crashlytics/` per `PLAN_PROJECT_INDEXER.md` Stage 1. Already designed, not yet implemented. |
| **Token matching accuracy** | `matchIssues()` does case-insensitive substring matching of error tokens against issue title+subtitle. This can produce false positives (e.g., token "Error" matches every issue). | Weight matches by token specificity: full class names (`NullPointerException`) rank higher than generic words (`Error`). Require at least one specific token match. |
| **No pagination of topIssues** | Only fetches 20 issues (`pageSize: 20`). Projects with hundreds of crash types may miss matches. | Add cursor-based pagination: if no matches found in first page, fetch next page (up to 3 pages / 60 issues). |
| **gcloud CLI dependency** | Auth depends on `gcloud auth application-default print-access-token`. Users without gcloud installed cannot use Firebase features. | Offer an alternative auth flow: VS Code's built-in `vscode.authentication` API supports Google accounts via the "GitHub" and "Microsoft" providers. Investigate adding a Google OAuth provider or using a service account JSON file directly. |
| **No offline/cached issue list** | **FIXED.** `cachedIssueRows` stores the API response in memory with a 5-minute TTL (`issueListTtl`). `clearIssueListCache()` invalidates on manual refresh. | ~~Cache the issue list response for the configured time range. Invalidate on manual refresh or after 5 minutes.~~ |

---

### 7.10 Prioritized Roadmap

Items grouped by implementation phase, ordered by impact-to-effort ratio.

#### Phase 1: Quick Wins (Low complexity, high value) — ALL DONE

| # | Item | Status |
|---|------|--------|
| 15 | Add time range filter to Crashlytics query | DONE |
| 4 | Display version range on issue cards | DONE |
| 5 | Show issue state badge (Open/Closed/Regressed) | DONE |
| 2 | Fatal vs Non-Fatal severity icon | DONE |
| 17 | Cache and display refresh timestamp | DONE |
| 8 | Device metadata display per crash event | DONE |

#### Phase 2: High-Impact Features (Medium complexity)

| # | Item | Status |
|---|------|--------|
| 9 | Parse and display custom Keys tab | DONE |
| 10 | Parse and display Logs/breadcrumbs tab | DONE |
| 20 | Cross-reference ALL recurring errors with Crashlytics | DONE |
| 21 | Include Crashlytics data in bug reports | DONE |
| 7 | Multi-event fetching and pagination | DONE |
| 18 | Fuzzy file resolution with package hints | DONE |

#### Phase 3: Strategic Features (High complexity, differentiating)

| # | Item | Status |
|---|------|--------|
| 1 | Dedicated Crashlytics sidebar view | DONE |
| 19 | Reverse linking: CodeLens for crash-affected files | DONE |
| 14 | Local cross-session device aggregation | DONE |
| 12 | Device/OS distribution charts from multi-event data | DONE |

#### Phase 4: Exploratory (Low priority, high ambition)

| # | Item | Status |
|---|------|--------|
| 3 | AI crash summary via VS Code LM API | DONE |
| 6 | Close/Mute issue write-back to Firebase | DONE |
| 13 | Query Crashlytics issueStats endpoint | PARTIAL (API function exists, no callers) |
| 16 | Auto-detect app version for filtered queries | DONE |
| 22 | Trend sparkline in session history tree | — |

#### Progress Summary

- **Phase 1:** 6/6 complete
- **Phase 2:** 6/6 complete
- **Phase 3:** 4/4 complete
- **Phase 4:** 3/5 complete, 1 partial
- **Overall:** 19/21 complete, 1 partial, 1 remaining

---

### 7.11 Summary

**AQI's core strength** is a persistent, richly-filtered issue feed with event-level drill-down, device analytics, and triage controls — all within the IDE.

**Saropa's core strength** is connecting debug-time errors to production impact through cross-session aggregation, automated bug reports, git blame, and documentation matching — capabilities AQI does not have.

**Closed gaps since initial analysis:** Phases 1, 2, and 3 are fully complete. Phase 4 is 3/5 with 1 partial. Crashlytics integration now includes: severity badges, state tags, version ranges, device metadata, Keys/Logs/AI summary tabs, multi-event pagination with device/OS distribution charts, CodeLens crash indicators on source files, debug-to-production error bridge, Crashlytics-enhanced bug reports, fuzzy file resolution with package hints, and refresh timestamps with 5-minute TTL caching.

**Remaining:** Wire `getIssueStats()` into the UI (item 13 — code exists, needs caller) and trend sparklines in session history (item 22 — new feature).

**Saropa's unique positioning** — the debug-to-production bridge — is fully realized across multiple surfaces: CodeLens indicators on source files (item 19), production badges on recurring errors (item 20), AI-powered crash summaries (item 3), and production impact sections in bug reports (item 21). No competing tool combines local debug history with production crash data in a single view.
