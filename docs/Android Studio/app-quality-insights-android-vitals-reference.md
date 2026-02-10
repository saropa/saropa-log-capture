<!-- cspell:disable -->
# App Quality Insights: Android Vitals Reference

## 1. Executive Summary
The **App Quality Insights** tool window in Android Studio allows developers to investigate, filter, and debug application stability issues (Crashes and ANRs) directly within the IDE. 

This specific documentation analyzes the **Android Vitals** view. Unlike Firebase Crashlytics (which requires an SDK), Android Vitals aggregates anonymous metrics collected by the Google Play Store from millions of Android devices. 

**Snapshot Context:**
The screenshot displays a **Flutter application** (`com.saropamobile.app`) experiencing an **ANR (Application Not Responding)** on the **Main Thread**. The data indicates a future or test-environment timeline (Year 2026) and includes upcoming Android versions (Android 16).

---

## 2. Interface Breakdown: Top Toolbar (Global Filters)
The toolbar acts as the query engine for the data displayed in the list and detail panes.

*   **Service Provider Tabs:**
    *   **Android Vitals (Active):** Displays system-level stability data from Google Play.
    *   **Firebase Crashlytics (Inactive):** Switches to data collected via the Firebase SDK.
*   **App Selector:** `Saropa Contacts [com.saropamobile.app]`
    *   Selects the specific application package and flavor to inspect.
*   **Issue Type Toggles:**
    *   **Crash Icon (Red Circle/X):** Toggles visibility of fatal exceptions (currently active).
    *   **ANR Icon (Orange Clock):** Toggles visibility of "Application Not Responding" events (currently active).
*   **Time Range Filter:** `Last 7 days`
    *   Sets the historical window for data aggregation.
*   **Visibility Filter:** `All visibility`
    *   Filters by issue status: **Open**, **Closed**, or **Ignored**.
*   **Version Filter:** `All versions`
    *   Filters by App Version Code (e.g., only show bugs present in v2025090301).
*   **Device Filter:** `All devices`
    *   Filters by hardware model (e.g., Pixel 8, Samsung S24).
*   **OS Filter:** `All operating systems`
    *   Filters by Android API Level (e.g., Android 14, Android 15).
*   **Refresh Control:** `Last refreshed: 16 minutes ago`
    *   Displays sync timestamp. Clicking the refresh icon manually fetches new data from the Play Console API.

---

## 3. Interface Breakdown: Left Pane (The Issues List)
This pane lists distinct issue groups, sorted by impact.

### Columns
*   **Issue:** The "fingerprint" of the crash/ANR. This is usually the top-most meaningful stack frame or exception type.
*   **Events:** Total number of times this issue occurred in the selected time range.
*   **Users:** Total number of unique devices affected.

### Visible Issues (Analysis)
1.  **[SELECTED]** `PlatformTaskQueue.dispatch` (ANR)
    *   **Events:** 12 | **Users:** 4
    *   **Analysis:** This is the active selection. It indicates the main thread is blocked while trying to dispatch a task in the Flutter embedding engine.
2.  `...n(dart::Function const&, dart::Array const&, dart::Array const&)` (ANR)
    *   **Events:** 5 | **Users:** 3
    *   **Analysis:** A native crash/block within the Dart runtime (C++ layer).
3.  `MessageQueue.nativePollOnce` (ANR)
    *   **Events:** 4 | **Users:** 4
    *   **Analysis:** Indicates the main thread is waiting for a message. Often a sign of a deadlock or heavy processing on a background thread preventing the main thread from waking.
4.  `[libflutter.so] fml::KillProcess()` (Crash)
    *   **Events:** 2 | **Users:** 1
    *   **Analysis:** The Flutter engine deliberately killed the process, likely due to an unrecoverable internal error.
5.  `lang.OutOfMemoryError` (Crash)
    *   **Events:** 1 | **Users:** 1
    *   **Analysis:** Standard Java OOM error (Heap exhaustion).

---

## 4. Interface Breakdown: Center Pane (Issue Details)
This pane displays the specific technical context for the issue selected in the Left Pane.

### Header Area
*   **Issue Title:** `PlatformTaskQueue.dispatch`
*   **Stats:** 12 Events, 4 Users.
*   **Affected Versions:** `2025090301 -> 2026012501`
    *   Indicates this bug has persisted across multiple build updates.
*   **Event ID:** `Event apps/c...WNJZTM`
    *   Unique identifier for this specific crash report.
*   **Deep Link:** `View on Android Vitals`
    *   Opens the Google Play Console in the browser for this specific issue.

### Event Instance Context
*   **Event Navigator:** `<` `>` arrows (Top right of center pane). Allows cycling through the 12 individual events.
*   **Device:** `Infinix Infinix HOT 50`
*   **OS:** `Android 14.0 (API 34)`
*   **Timestamp:** `Feb 2, 2026, 07:00:00 AM`
*   **Custom Data:** `No data (i)`
    *   Indicates no custom keys/logs are attached to this Vitals report (common, as Vitals is automatic).

### The Stack Trace
This is the execution path of the thread at the moment of the ANR.
*   **Thread Info:** `"main" tid=1 Runnable`
    *   **"main":** The UI thread.
    *   **tid=1:** The process ID.
    *   **Runnable:** The thread was active (trying to do work) but likely blocked by a long operation or loop.
*   **Trace Frames:**
    *   **Gray Frames:** System/Library code.
        *   `android.os.MessageQueue.enqueueMessage` (The OS trying to process an event).
        *   `android.os.Handler.post`.
    *   **Blue Frames (Clickable):** Project/Library code mapped to local sources.
        *   `io.flutter.embedding.engine.dart.PlatformTaskQueue.dispatch` (Line 20).
        *   `io.flutter.embedding.engine.dart.DartMessenger.dispatchMessageToQueue` (Line 332).
        *   `io.flutter.embedding.engine.FlutterJNI.handlePlatformMessage` (Line 1086).
    *   **Entry Point:** `com.android.internal.os.ZygoteInit.main` (The start of the Android process).
*   **Footer:** `Show all 134 threads`
    *   A button to view parallel threads. Essential for ANRs to see if a background thread holds a lock the Main thread needs.

---

## 5. Interface Breakdown: Right Pane (Insights)
This pane visualizes the distribution of the crash to help identify if the bug is device-specific or OS-specific.

### Tabs
*   **Insights (Active):** Shows charts.
*   **Details:** (Vertical Text) Likely contains RAM/Disk usage statistics.

### Devices Chart
*   **Visual:** Blue horizontal bars representing percentage.
*   **Data:**
    *   Infinix: 25%
    *   OPPO: 25%
    *   Redmi: 25%
    *   Other: 25%
*   **Summary:** "Most affected device: Infinix-X6..." (Model specific).

### Android Versions Chart
*   **Visual:** Blue horizontal bars.
*   **Data:**
    *   **Android 16:** 50% (Indicates testing on future/preview OS).
    *   **Android 14:** 25%
    *   **Android 15:** 25%
*   **Summary:** "Most affected Android version: ..."

---

## 6. Interface Breakdown: Sidebar (Tool Window Bar)
The strip on the far left allows switching between Android Studio's tool windows.
*   **Profiler:** Performance profiling.
*   **App Quality Insights (Selected):** The current window.
*   **Logcat:** Real-time device logs.
*   **Problems:** Compilation errors/warnings.
*   **Terminal:** Command line interface.
*   **Git:** Version control.
*   **android:** Likely a custom or plugin-specific tool window.

---

## 7. Technical Synthesis of the Error
Based on the screen data, the documented issue is:
*   **Type:** ANR (Application Not Responding).
*   **Location:** The bridge between Android Native Java and the Flutter Engine.
*   **Specifics:** The `PlatformTaskQueue` is attempting to dispatch a message (likely a platform channel method call) from native Android to Dart. The main thread is stuck in `enqueueMessage`, suggesting the message queue is flooded or the loop is blocked, causing the app to freeze for >5 seconds.
*   **Severity:** High (ANRs significantly impact Google Play store ranking).

---

## 8. Gap Analysis: Saropa Log Capture vs Android Vitals AQI

This section maps every Android Vitals capability to the current state of Saropa Log Capture, identifies gaps, and proposes actionable improvements. The analysis focuses on Android Vitals-specific features — for Crashlytics-specific gaps, see the companion document `app-quality-insights-crashlytics-reference.md`.

### Notation

| Symbol | Meaning |
|--------|---------|
| **HAS** | Feature exists in Saropa today |
| **PARTIAL** | Partially implemented — core logic exists but UX or scope is limited |
| **GAP** | Not implemented — opportunity for improvement |
| **DONE** | Improvement idea has been implemented |

---

### 8.1 Android Vitals Data Source

Android Vitals is fundamentally different from Firebase Crashlytics: it is a system-level data feed from the Google Play Store, requiring no SDK integration. It captures ANRs, native crashes, and startup metrics from all devices running the app, including users who have not opted into Firebase.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Google Play Console API integration | **GAP** | Saropa integrates with Firebase Crashlytics REST API (`firebasecrashlytics.googleapis.com`) but has no connection to the Google Play Developer Reporting API (`playdeveloperreporting.googleapis.com`) which powers the Android Vitals view. |
| Crash vs ANR distinction | **HAS** | `isAnrLine()` in `level-classifier.ts` detects ANR keywords. `countSeverities()` counts ANRs separately from general performance lines. Orange ANR badge (`error-badge-anr`) renders in the viewer via `viewer-styles-decoration.ts`. This is text-pattern detection on local debug logs — not production ANR data from the Play Store. |
| System-level anonymous metrics | **GAP** | Saropa only sees what flows through the DAP debug adapter. Android Vitals sees every crash/ANR from every Play Store user, regardless of SDK presence. There is no mechanism to access this data. |
| Dual data source (Vitals + Crashlytics tabs) | **PARTIAL** | Saropa has Crashlytics integration in the analysis panel and a dedicated Crashlytics sidebar (`crashlytics-panel.ts`). Adding a Vitals tab alongside it would create the same dual-source view that AQI provides. |

**Improvement ideas:**

1. **Google Play Developer Reporting API integration** — The Play Developer Reporting API v1beta1 (`playdeveloperreporting.googleapis.com`) exposes crash rate metrics, ANR rate metrics, and error reports. Add a new module (`google-play-vitals.ts`) that queries `apps/{package}/crashRateMetricSet:query` and `apps/{package}/anrRateMetricSet:query`. Auth can reuse the existing `gcloud` token flow since the API accepts Google OAuth tokens with the `androidpublisher` scope.
   - *Priority:* High (unique differentiator — no VS Code extension does this). *Complexity:* High (~200 lines for API client + ~150 lines for UI rendering).

2. **DONE — ANR-specific detection and classification** — `isAnrLine()` in `level-classifier.ts` detects ANR keywords (`anr`, `application not responding`, `input dispatching timed out`). `countSeverities()` in `session-severity-counts.ts` counts ANRs separately from general performance lines. Orange ANR badge (`error-badge-anr`) with hourglass styling renders in the viewer via `viewer-styles-decoration.ts`.

3. **Package name auto-detection for API queries** — AQI uses the package name from the Gradle build. Saropa should detect it from `google-services.json` (`client[0].client_info.android_client_info.package_name`), `AndroidManifest.xml`, or `pubspec.yaml` (`name` field for Flutter). This enables automatic scoping of both Crashlytics and Vitals queries to the correct app.
   - *Priority:* Medium. *Complexity:* Low (~30 lines in `firebase-crashlytics.ts` or a new `app-identity.ts`).

---

### 8.2 Issue Type Toggles (Crash vs ANR)

AQI provides separate toggle buttons for Crashes (fatal) and ANRs (freezes), letting developers focus on one category at a time.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Crash/ANR type toggles | **GAP** | Saropa's level filter has 7 levels (error, warning, info, performance, todo, debug, notice) but no crash-vs-ANR distinction. Both are subsumed under `error` or `performance`. |
| Issue type icons (red X vs orange clock) | **PARTIAL** | ANR lines get an orange `error-badge-anr` badge in the log viewer. Crashlytics issues show FATAL/NON-FATAL badges via `renderIssueBadges()`. No separate toggle button for crash vs ANR categories. |
| Separate event/user counts per type | **GAP** | Cross-session insights aggregate all errors together. There is no breakdown by crash category (fatal, non-fatal, ANR, OOM, native). |

**Improvement ideas:**

4. **Crash category sub-classification** — Extend `error-fingerprint.ts` to tag each fingerprinted error with a category: `fatal` (unhandled exception), `anr` (timeout/freeze patterns), `oom` (OutOfMemoryError, heap exhaustion), `native` (SIGSEGV, SIGABRT, `libflutter.so`), `non-fatal` (caught exceptions). Store in `.meta.json` sidecar alongside existing fingerprints. Surface as colored badges in the Insights panel and bug reports.
   - *Priority:* Medium. *Complexity:* Medium (~50 lines in `error-fingerprint.ts` + ~20 lines in `insights-panel.ts`).

5. **Filterable crash categories in Insights drill-down** — When the Insights panel shows recurring errors, add toggle chips for each crash category so users can isolate ANRs from crashes from OOMs. Reuses the tag-chip pattern from `viewer-session-tags.ts`.
   - *Priority:* Low. *Complexity:* Low (~30 lines in `insights-drill-down.ts`).

---

### 8.3 Multi-Dimensional Filtering (Top Toolbar)

AQI's toolbar provides 5 simultaneous filter dimensions: time range, visibility/status, version, device, and OS. These are the primary triage interface.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Time range filter | **HAS** | `aggregateInsights(timeRange)` in `cross-session-aggregator.ts` accepts `'24h' | '7d' | '30d' | 'all'` parameter. `filterByTime()` filters sessions by mtime. Insights panel has a dropdown selector. Crashlytics queries also pass `eventTimePeriod` via `getTimeRange()`. |
| Version filter | **GAP** | Saropa captures debug adapter type in session headers but not the app version being debugged. No mechanism to filter sessions or crashes by app version. |
| Visibility/status filter (Open/Closed/Ignored) | **GAP** | No issue lifecycle management. Sessions can be trashed but not marked open/closed/ignored. Error fingerprints have no status field. |
| Device filter | **GAP** | Session headers contain some environment metadata but not device model or manufacturer. Debug sessions are local — there is no device dimension from production. |
| OS version filter | **GAP** | Similar to device — the debug host OS is captured but not the target device's Android/iOS version. |
| Compound filtering (all dimensions simultaneous) | **PARTIAL** | The Filters panel supports multiple simultaneous filters (level, category, tag, exclusion, app-only, source scope) on log lines within a session. Cross-session insights now support time range filtering. Crashlytics supports time range + version filtering. But device and OS dimensions are not available. |

**Improvement ideas:**

6. **DONE — Time-windowed cross-session aggregation** — `aggregateInsights(timeRange: TimeRange)` in `cross-session-aggregator.ts` accepts `'24h' | '7d' | '30d' | 'all'`. `filterByTime()` filters sessions by parsed date against the time window. Insights panel header has a `<select>` dropdown and refresh button.

7. **DONE — App version capture in session metadata** — `app-version.ts` detects version from `pubspec.yaml`, `build.gradle`, or `package.json` with 5-minute cache. Called during session finalization in `session-lifecycle.ts`. Version stored in `.meta.json` via `SessionMetadataStore.setAppVersion()`. Extracted from `firebase-crashlytics.ts` to fix its 300-line limit.

8. **DONE — Error status lifecycle** — `error-status-store.ts` persists open/closed/muted status per error fingerprint hash in `.error-status.json`. Insights panel and Recurring Errors sidebar show Close/Mute/Re-open action buttons. Closed errors are dimmed; muted errors are hidden. Re-opening deletes the entry to keep the file small.

9. **Target device metadata from DAP** — Some debug adapters (Flutter's) include device info in DAP events. Parse `runInTerminal` requests and custom DAP events for device model and OS version. Store in session metadata. Not all adapters provide this, so fail gracefully.
   - *Priority:* Low. *Complexity:* Medium (~40 lines in `tracker.ts` + ~10 lines in `session-metadata.ts`).

---

### 8.4 Issue List (Left Pane)

AQI's left pane is a persistent, sortable, searchable master list of all issue clusters, ranked by impact (events x users).

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Persistent issue list with impact ranking | **PARTIAL** | The Insights panel shows recurring errors ranked by `sessionCount * totalOccurrences`. But this is a one-shot aggregation command, not a persistent always-visible panel. The session panel shows sessions, not issues. |
| Search/filter within issue list | **GAP** | The Insights panel has no text search. Errors are listed in rank order with no way to filter by keyword. |
| Events column (occurrence count) | **HAS** | `RecurringError.totalOccurrences` is displayed in the Insights panel. |
| Users/sessions column | **HAS** | `RecurringError.sessionCount` is displayed (sessions rather than users, since Saropa is debug-local). |
| Impact sort (events × users) | **HAS** | `buildRecurringErrors()` in `cross-session-aggregator.ts` sorts by `(sessionCount * totalOccurrences)` descending. |
| Issue fingerprint as identifier | **HAS** | `error-fingerprint.ts` normalizes error text (strips timestamps, UUIDs, hex, paths) and hashes it. This is conceptually identical to AQI's crash clustering. |

**Improvement ideas:**

10. **DONE — Always-visible error feed in sidebar** — `recurring-errors-panel.ts` implements a `RecurringErrorsPanelProvider` (WebviewViewProvider) registered as `saropaLogCapture.recurringErrorsPanel` in the icon bar. Shows compact error cards with normalized text, session/occurrence counts, and triage actions. Auto-refreshes 3 seconds after session finalization. "Open Full Insights" footer link opens the full Insights panel.

11. **Search in Insights panel** — Add a text input at the top of the Insights panel that filters both hot files and recurring errors by keyword. Match against `normalizedText`, `exampleLine`, and `filename`. Reuses the search input pattern from the Filters panel.
    - *Priority:* Low. *Complexity:* Low (~25 lines in `insights-panel.ts`).

12. **DONE — Impact-weighted sort** — `buildRecurringErrors()` sorts by `(b.sessionCount * b.totalOccurrences) - (a.sessionCount * a.totalOccurrences)` descending, matching AQI's impact-first ranking.

---

### 8.5 Issue Details: Version Range & Event Navigation (Center Pane Header)

AQI shows the version range an issue spans, an event navigator to page through individual events, and per-event device metadata.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Affected version range | **PARTIAL** | `RecurringError.firstSeen` and `lastSeen` timestamps are tracked and shown. These are session dates, not app version codes. Crashlytics integration now parses `firstVersion`/`lastVersion` from the API (see Crashlytics doc). But cross-session recurring errors still use session dates. |
| Event navigator (< 1/12 >) | **HAS** | The Insights drill-down (`insights-drill-down.ts`) groups occurrences by session and lets users click individual matches to navigate. This is functionally similar to AQI's event navigator. |
| Per-event device metadata | **GAP** | No device model, OS version, or hardware info per error occurrence. Debug sessions are all on the developer's machine. |
| Event ID display | **GAP** | Error occurrences have no unique identifier. The fingerprint hash identifies the group, not individual events. |
| Deep link to Play Console | **GAP** | No Google Play Console integration. Crashlytics integration has `consoleUrl` for Firebase Console. "View on Firebase" link available in analysis panel and sidebar. |

**Improvement ideas:**

13. **DONE — Version range on recurring errors** — `RecurringError` in `cross-session-aggregator.ts` now includes `firstSeenVersion` and `lastSeenVersion`. `accumulateFingerprint()` tracks versions from session metadata. Insights panel renders `v1.2.0 → v1.4.1` (or single version) via `formatVersionRange()` in the error meta line.

14. **Google Play Console deep link** — For apps with a known package name (item 3), construct the Play Console URL: `https://play.google.com/console/developers/{devId}/app/{appId}/vitals/crashes`. Even without API integration, a clickable link to the Vitals dashboard in the Insights panel provides quick access to production data.
    - *Priority:* Low. *Complexity:* Low (~10 lines).

---

### 8.6 Stack Trace View: Thread Info & Multi-Thread Display

AQI's stack trace view shows the crashing thread with full metadata (name, tid, state) and offers "Show all 134 threads" to view parallel threads — essential for diagnosing ANRs where a background thread may hold a lock.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Stack trace with frame classification | **HAS** | `stack-parser.ts` parses Java/Dart/C++ stack frames. `isFrameworkLogLine()` classifies frames as app vs framework. The analysis panel renders APP/FW badges on crash frames. The log viewer shows collapsible stack traces with dimmed framework frames. |
| Thread name/tid/state metadata | **GAP** | The stack parser extracts frames but does not parse thread headers like `"main" tid=1 Runnable`. Thread context lines are treated as regular log lines. |
| Multi-thread display ("Show all 134 threads") | **GAP** | The viewer shows a linear log. There is no concept of concurrent threads within a crash report. Each stack trace is one contiguous block. |
| Clickable frames → local source | **HAS** | `source-linker.ts` detects `file.ext:line:col` patterns. `analysis-frame-handler.ts` resolves workspace files. Clicking opens the file in the editor. |
| Gray (system) vs blue (project) frame coloring | **HAS** | Framework frames are dimmed in the log viewer. The analysis panel uses APP (green) and FW (gray) badges. The bug report includes frame classification. |

**Improvement ideas:**

15. **DONE — Parse thread headers in stack traces** — `parseThreadHeader()` in `stack-parser.ts` recognizes quoted thread names with tid/state and dash-delimited format. `tryFormatThreadHeader()` in `viewer-provider-helpers.ts` wraps matches in `<span class="thread-header">` with link-colored, bold italic styling. Applied in both `log-viewer-provider.ts` and `pop-out-panel.ts`.

16. **Thread grouping for ANR-style traces** — When a log file contains multiple consecutive stack traces (common in ANR dumps and `kill -3` thread dumps), group them under a collapsible "Threads (N)" section. Each thread shows its header and frame list. The "main" thread is expanded by default; others are collapsed. This mimics AQI's "Show all 134 threads" functionality for local debug output.
    - *Priority:* Medium. *Complexity:* High (~100 lines across stack parser, viewer script, and styles).

17. **ANR thread analysis heuristic** — When multiple threads are grouped, automatically identify potential ANR patterns: main thread in `Runnable` state while a background thread holds a lock (`MONITOR`, `WAIT`). Highlight the blocking thread with a warning badge: "This thread may be blocking main". Uses thread state keywords from Android thread dumps.
    - *Priority:* Low (high impact, exploratory). *Complexity:* High (~80 lines for heuristic analysis + rendering).

---

### 8.7 Insights Pane: Device & OS Distribution Charts

AQI's right pane shows horizontal bar charts for device manufacturer distribution and Android version distribution, plus insight text identifying the most affected device/OS.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Device distribution chart | **GAP** | No production device data. Saropa sees only the developer's machine. Crashlytics crash events are fetched but device info is not parsed (only stack trace). |
| OS version distribution chart | **GAP** | Same as device — no OS dimension from production. |
| Insight text ("Most affected device: ...") | **GAP** | No automated insight generation from demographics. |
| Details tab (RAM, disk, orientation) | **GAP** | No hardware detail from production crash events. |

**Improvement ideas:**

18. **DONE — Parse device/OS from Crashlytics events** — `crashlytics-event-parser.ts` extracts device model and OS version from event responses. `crashlytics-stats.ts` fetches aggregate device/OS distribution via the stats API endpoint. `analysis-crash-detail.ts` renders both per-event metadata and collapsible bar charts for device model and OS version distribution.
    - *Priority:* Medium (depends on Crashlytics multi-event). *Complexity:* Medium (~30 lines parsing + ~80 lines chart rendering).

19. **Local environment distribution across sessions** — Saropa captures environment metadata in session headers (`environment-collector.ts`). Aggregate across sessions to show which local configurations (VS Code version, debug adapter version, OS) correlate with the most errors. This is a Saropa-unique insight that AQI cannot provide.
    - *Priority:* Low. *Complexity:* Medium (~50 lines in `cross-session-aggregator.ts` + rendering).

20. **Simple HTML bar chart component** — Create a reusable `renderBarChart(items: {label: string, value: number}[]): string` helper in a new `chart-helpers.ts` that renders horizontal bar charts using `div` elements with percentage widths. Reuse across Crashlytics device/OS charts, session timeline, and Insights panel. Avoids SVG complexity.
    - *Priority:* Low (enabler for items 18-19). *Complexity:* Low (~40 lines).

---

### 8.8 Refresh & Sync Controls

AQI shows "Last refreshed: 16 minutes ago" with a manual refresh button, giving developers confidence in data freshness.

| AQI Capability | Saropa Status | Details |
|---------------|---------------|---------|
| Last refreshed timestamp | **HAS** | `formatElapsedLabel(insights.queriedAt)` in the Insights panel shows "just now" / "42s ago" / "3m ago". `FirebaseContext.queriedAt` provides timestamp for Crashlytics queries. Crashlytics sidebar also shows elapsed time. |
| Manual refresh button | **HAS** | Insights panel has a "Refresh" button. Crashlytics sidebar has manual refresh. `clearIssueListCache()` bypasses TTL on manual refresh. |
| Auto-refresh on interval | **PARTIAL** | Crashlytics sidebar (`crashlytics-panel.ts`) has configurable auto-refresh via `saropaLogCapture.firebase.refreshInterval`. Cross-session insights do not auto-refresh. |
| Cache staleness indicator | **HAS** | Issue list cache has 5-minute TTL (`issueListTtl`). Token cache has 30-minute TTL (`tokenTtl`). Elapsed time labels on both Insights and Crashlytics panels indicate data age. |

**Improvement ideas:**

21. **DONE — Refresh timestamp on all remote data panels** — `formatElapsedLabel()` shared helper in `ansi.ts` renders elapsed time. Used in Insights panel (`insights.queriedAt`), analysis panel (`FirebaseContext.queriedAt`), and Crashlytics sidebar. Refresh buttons clear caches and re-fetch.

22. **DONE — TTL on Crashlytics issue list cache** — `cachedIssueRows` in `firebase-crashlytics.ts` stores API responses with `issueListTtl = 5 * 60_000` (5 minutes). `cachedToken` has `tokenTtl = 30 * 60_000` (30 minutes). `clearIssueListCache()` invalidates on manual refresh.

---

### 8.9 Features Where Saropa Already Exceeds Android Vitals AQI

These are capabilities that Saropa has which the Android Vitals view does not offer. They represent competitive advantages specific to the Vitals comparison.

| Saropa Feature | AQI Vitals Equivalent | Advantage |
|---------------|----------------------|-----------|
| **Real-time debug output capture** — live streaming of all DAP debug output with deduplication, filtering, and virtual scrolling | None — Vitals only shows post-mortem crash/ANR data | Saropa catches issues during development before they reach production. |
| **Error fingerprinting across debug sessions** — normalized hashing identifies the same error across sessions, even when timestamps/UUIDs differ | Vitals clusters crashes server-side with no local debug correlation | Saropa can link a production Crashlytics crash to the same error seen 12 times during debugging, answering "did I see this in dev?" |
| **Git blame on error lines** — shows who last touched the crashing code and when | None — AQI has no VCS integration beyond file linking | Immediately answers "who should fix this?" and "was this recently changed?" for ANRs and crashes alike. |
| **Cross-session error timeline** — SVG chart showing error occurrences over time across debug sessions | Vitals shows aggregate counts but no per-session timeline | Reveals trends: is this ANR getting worse? Did it start after a specific commit? |
| **Automated bug report generation** — 15+ evidence types (git blame, source preview, imports, symbols, cross-session history, docs) compiled into markdown | Vitals provides raw stack trace only | One-click export to issue tracker with full context. AQI requires manual copy-paste. |
| **Text-based ANR keyword detection** — `level-classifier.ts` detects ANR-related keywords (`anr`, `application not responding`, `choreographer`, `doing too much work`, `gc pause`) in live debug output and classifies as `performance` level | Vitals only reports ANRs after they reach the 5-second threshold on a user's device | Saropa can flag potential ANR-causing patterns (jank, long GC pauses, choreographer warnings) during development, before they become user-visible ANRs. |
| **Source scope filtering** — narrow log output by workspace folder, package, directory, or file | No equivalent in Vitals | Vitals shows the crash in one trace; Saropa lets you isolate all output from the offending component. |
| **Configurable exclusion patterns** — hide known-noisy log lines | No equivalent | Vitals shows all threads; Saropa lets you focus on the signal. |
| **Documentation token matching** — scans `docs/` and `bugs/` for tokens related to the crash | None | Links ANRs/crashes to known issues, troubleshooting guides, and architecture docs. |

**Improvement ideas for existing advantages:**

23. **DONE — Pre-production ANR risk scoring** — `anr-risk-scorer.ts` scans session body text for 5 weighted signal patterns (choreographer warnings, GC pauses, jank, dropped frames, ANR keywords) and produces a 0-100 risk score with low/medium/high level. Score is computed fire-and-forget during session finalization and stored as `anrRiskLevel` in `.meta.json` sidecar. Sessions with ANR patterns show `ANR: N` badge in the Project Logs tree.

24. **DONE — Bridge debug error patterns to Crashlytics** — `bridgeErrorsToCrashlytics()` in `insights-panel.ts` matches ALL recurring error patterns (not just ANRs) against Crashlytics production issues using word extraction from example lines and normalized text. Matching errors show a "Production: N events, M users" badge via progressive webview update with pulsing loading indicator and 15-second timeout guard.

25. **Thread-aware stack trace export** — When bug reports include stack traces from ANR-like dumps, preserve thread grouping in the markdown output. Format as collapsible sections per thread, with the main thread expanded and blocking threads flagged. This goes beyond AQI's flat thread list.
    - *Priority:* Low (depends on items 15-16). *Complexity:* Low (~25 lines in `bug-report-formatter.ts`).

---

### 8.10 Architecture & Implementation Considerations

| Concern | Current State | Proposed Approach |
|---------|--------------|-------------------|
| **No Play Console API client** | Only Firebase Crashlytics REST API is integrated. Android Vitals data requires the Play Developer Reporting API, a separate Google Cloud API with different endpoints and auth scopes. | Add a new `google-play-vitals.ts` module alongside `firebase-crashlytics.ts`. Reuse `getAccessToken()` for auth (same gcloud ADC flow). The reporting API requires the `androidpublisher` OAuth scope — verify that ADC tokens include it, or prompt the user for additional consent. |
| **Vitals API requires developer account** | Firebase Crashlytics access requires the Firebase Crashlytics Viewer role. Play Console access requires being a member of the Google Play Console developer account. Different user populations. | Clearly separate the two integrations in the UI and documentation. A user may have Crashlytics access but not Play Console access (or vice versa). Each should degrade gracefully and independently. |
| **Package name vs App ID** | Crashlytics uses Firebase App ID (`1:123456:android:abc`). Play Console uses package name (`com.saropamobile.app`). These are different identifiers. | Extend `app-identity.ts` (item 3) to resolve both. Store `packageName` alongside `appId` and `projectId`. Auto-detect from the same sources (`google-services.json` has both). |
| **Rate limits** | The Play Developer Reporting API has quota limits. Excessive polling could exhaust the daily allowance. | Default to on-demand queries (not polling). Cache API responses with configurable TTL. Show rate limit errors with actionable guidance. |
| **Thread dump parsing complexity** | Android thread dumps (from `kill -3`, ANR traces, or `bugreport`) have a complex format: thread headers, monitor info, lock owners, native frames, Dalvik frames. Full parsing is a large surface area. | Start with simple thread header parsing (item 15) and expand incrementally. Phase 1: detect thread boundaries. Phase 2: parse lock/monitor info. Phase 3: cross-thread lock analysis. |
| **ANR vs crash UX separation** | Currently all errors share the same rendering pipeline. ANRs have different investigation needs (multi-thread analysis, lock contention, main thread blocking). | Do not create a separate ANR viewer. Instead, enrich the existing stack trace rendering with thread awareness (items 15-17). ANRs are just crashes with more threads — the same UI should handle both. |

---

### 8.11 Prioritized Roadmap

Items grouped by implementation phase, ordered by impact-to-effort ratio. Items from the Crashlytics gap analysis are referenced but not duplicated.

#### Phase 1: Quick Wins (Low complexity, immediate value) — ALL DONE

| # | Item | Status |
|---|------|--------|
| 2 | ANR-specific detection and classification badge | DONE |
| 6 | Time-windowed cross-session aggregation | DONE |
| 12 | Impact-weighted sort in recurring errors | DONE |
| 21 | Refresh timestamp on remote data panels | DONE |
| 22 | TTL on Crashlytics issue list cache | DONE |

#### Phase 2: High-Impact Features (Medium complexity, strong differentiators) — ALL DONE

| # | Item | Status |
|---|------|--------|
| 23 | Pre-production ANR risk scoring | DONE |
| 24 | Bridge debug error patterns to Crashlytics | DONE |

| # | Item | Status |
|---|------|--------|
| 7 | App version capture in session metadata | DONE |
| 13 | Version range on recurring errors | DONE |
| 15 | Parse thread headers in stack traces | DONE |
| 8 | Error status lifecycle (open/closed/muted) | DONE |
| 10 | Always-visible error feed in sidebar | DONE |

#### Phase 3: Strategic Features (High complexity, competitive differentiation)

| # | Item | Status |
|---|------|--------|
| 18 | Parse device/OS from Crashlytics events + charts | DONE |

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Google Play Developer Reporting API integration | ~350 lines | Access production Vitals data in VS Code |
| 16 | Thread grouping for ANR-style traces | ~100 lines | Multi-thread debugging |
| 4 | Crash category sub-classification | ~70 lines | Fatal/ANR/OOM/native breakdown |
| 3 | Package name auto-detection | ~30 lines | Enables Play API queries |

#### Phase 4: Exploratory (Low priority, high ambition)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 17 | ANR thread analysis heuristic (lock detection) | ~80 lines | Automated blocking-thread identification |
| 19 | Local environment distribution across sessions | ~50 lines | Debug environment analytics |
| 9 | Target device metadata from DAP | ~50 lines | Per-session device info |
| 14 | Google Play Console deep link | ~10 lines | Quick access to Vitals dashboard |
| 25 | Thread-aware stack trace export in bug reports | ~25 lines | Better ANR bug reports |

---

### 8.12 Summary

**Android Vitals AQI's core strength** is access to system-level production data (ANRs, crashes, startup metrics) from the Google Play Store, with multi-dimensional filtering (time, version, device, OS), multi-thread stack traces, and device/OS distribution charts — all without requiring an SDK in the app.

**Saropa's core strength** is proactive debugging intelligence: live capture with ANR-pattern detection during development, cross-session error fingerprinting, git blame integration, automated bug reports, and the ability to link debug-time warnings to production crashes via Crashlytics.

**Closed gaps since initial analysis:** All Phase 1 and Phase 2 items are complete. Phase 3 item #18 (device/OS charts) is also done. Phase 1 delivered quick wins (ANR badge, time-windowed aggregation, impact-weighted sort, refresh timestamps, cache TTL). Phase 2 delivered high-impact features: ANR risk scoring (#23), debug-to-Crashlytics error bridge (#24), app version capture (#7), version range on recurring errors (#13), thread header parsing (#15), error status lifecycle (#8), and always-visible recurring errors sidebar panel (#10). Phase 3 item #18 (device/OS from Crashlytics events + distribution charts) was implemented alongside the Crashlytics integration.

**The highest-value remaining gaps** are Phase 3: Google Play Developer Reporting API integration (item 1), thread grouping for ANR-style traces (item 16), crash category sub-classification (item 4), and package name auto-detection (item 3).

**The proactive warning system is now operational.** ANR risk scoring (item 23) detects choreographer warnings, GC pauses, and thread blocking patterns during debugging and flags "this will become an ANR in production." The Crashlytics error bridge (item 24) connects debug-time errors to production crash data. Together, these shift ANR and error detection left in the development lifecycle, where fixes are cheaper and faster.

**The most ambitious opportunity** is Google Play Developer Reporting API integration (item 1). No VS Code extension currently connects to Android Vitals. This would make Saropa the only tool that surfaces Play Store stability data inside VS Code, completing the trifecta: live debug capture + Crashlytics production crashes + Play Store system metrics.
