# Plan 114 — Debug Screenshot Capture

## Status: Implemented 2026-07-28 (pending F5 verification of live capture)

## Implementation notes (deviations from the plan below)

- **A4 resize to ≤1280px: NOT implemented.** The extension host has no image library and no canvas; downscaling would require a new dependency (blast-radius gate). Full-resolution PNGs are saved; all inline data-URI reads are capped at 10 MB. Deferred pending an explicit go/no-go on an image dependency.
- **C2 inline thumbnail below the line → floating popover.** An inline expansion would add a variable height term to `calcItemHeight` and interact with the prefix-sum scroll math and viewport rebuilds; the camera badge instead opens a fixed-position thumbnail popover (click-through opens full size in an editor tab).
- **B6 pending-capture queue (cap 5) → single-in-flight guard.** A capture requested while one is in flight records the same frame the in-flight capture is already fetching; cooldown + fingerprint dedup bound the rate, a queue adds nothing.
- **D2 prev/next arrows → thumbnail strip.** Up to 3 nearest captures render side by side in the signal report; same navigation value, no webview state.
- **F3 timeline thumbnail strip → standard event rows.** Screenshot events render as regular timeline events (camera glyph, trigger, line, excerpt); clicking opens the PNG. Embedding data-URI thumbnails into the dense timeline HTML was not worth the weight.
- **Metadata sidecar is `<base>.screenshots.json` (versioned)**, not a `screenshots` array grown inside `.meta.json`.
- **VM Service URI** comes from the Dart debug adapter's `dart.debuggerUris` custom DAP event (`vscode.debug.onDidReceiveDebugSessionCustomEvent`); one short-lived `ws` connection per capture (dependency `ws` already present via CDP browser capture — no new dependency).
- **Open item — retention:** file retention soft-trashes logs via metadata; hard-delete paths do not yet remove the `.screenshots/` directory or `.screenshots.json` sidecar of a deleted log.
- **Verification note:** unit tests cover the trigger/coalescing/cap logic, VM URI conversion, and the JSON-RPC reply parser. Live `_flutter.screenshot` capture against a real Flutter debug session is unverified until the F5 pass (investigation checklist below still applies).

## Goal

Capture screenshots from the running Flutter app during a debug session — automatically on errors, warnings, or navigation events — and display them inline in the log viewer (next to the error lines that triggered them), on the unified timeline, and in signal reports. This closes the biggest visual evidence gap between Saropa Log Capture and production-analytics tools like Rejourney, FullStory, and Sentry, without requiring an app-side SDK.

The feature is optional: **on by default**, with a master toggle exposed as a Screenshots row in the Integrations panel (same adapter list as adb Logcat, which is the existing on-by-default precedent).

---

## Problem

Today Saropa Log Capture surfaces log text, severity, timing, stack traces, and signal patterns — but never shows **what the user was looking at** when something went wrong. A signal report that says "NullPointerException on line 847" is useful; the same report with a screenshot of the screen that was visible at the moment of the crash is dramatically more useful.

Plan 052 deferred screenshots to an unbuilt app-side SDK, routing capture through a `[slc:img]` wire-format prefix and `RenderRepaintBoundary.toImage()` inside the app. That plan over-engineered the capture path. The Flutter debug tooling already exposes a screenshot API through VM service extensions — the extension can call it directly, with no SDK, no wire format, and no app-side code changes.

### Why this matters now

- Signal reports already have a two-column responsive grid, stat cards, and collapsible sections. Adding inline screenshots to that layout is straightforward.
- The LineListener pipeline (ErrorSnackbarNotifier pattern) already classifies every line in real time. Wiring a screenshot trigger into the same fan-out requires no new infrastructure.
- Competitive tools show the actual rendered UI alongside error data. Without screenshots, Saropa Log Capture's reports will always read as text-only diagnostics regardless of how polished the styling is.

---

## Capture mechanism

### Option A: Flutter VM Service `_flutter.screenshot` (preferred)

The Flutter framework registers a `_flutter.screenshot` service extension on the Dart VM service. The `flutter screenshot` CLI command uses this same endpoint. The extension can reach it by:

1. Obtaining the VM Service URI from the debug session (the Dart debug adapter exposes this via `customRequest` or the `dart.debuggerUris` command).
2. Connecting to the VM Service WebSocket.
3. Calling `_flutter.screenshot` — returns a base64-encoded PNG of the current frame.

**Pros:** No app-side code. Works with any Flutter app. Captures the actual rendered frame.
**Cons:** Requires a VM Service WebSocket connection (new for this extension). The `_flutter.screenshot` extension is private API (`_` prefix) — it could change, though it has been stable for years and is what `flutter screenshot` itself uses.

### Option B: DAP `customRequest` evaluate

Use `debugSession.customRequest('evaluate', { expression: '...' })` to run Dart code that captures a screenshot via `dart:ui` APIs.

**Pros:** Uses the existing DAP session, no new WebSocket.
**Cons:** Evaluating arbitrary Dart code during an error state is unreliable. The app may be in a broken state (which is exactly when you want a screenshot). Expression evaluation is limited in release mode.

### Option C: `flutter screenshot` CLI command

Shell out to `flutter screenshot --type=rasterizer --observatory-uri=<uri>`.

**Pros:** Simplest implementation. Delegates all VM Service connection handling to the Flutter CLI.
**Cons:** Requires the `flutter` binary on PATH. Slower (process spawn overhead). Less control over output path and format.

### Recommendation

**Investigate Option A first**, fall back to Option C if the VM Service connection proves too complex for the initial implementation. Option B is unreliable during error states — skip it.

### Investigation needed before implementation

- [ ] Confirm `_flutter.screenshot` is available in the VM Service during a standard `flutter run --debug` session (connect manually with `curl` or `websocat` to verify the response format).
- [ ] Determine how to obtain the VM Service URI from the Dart debug adapter. Candidates: `dart.debuggerUris` command, `customRequest('getVmServiceUri')`, or parsing the debug console output for the Observatory URL.
- [ ] Measure latency of a screenshot capture — if it exceeds ~200ms, the trigger logic needs a non-blocking queue rather than inline capture.
- [ ] Confirm whether the screenshot captures the Flutter rendering surface only (preferred) or the full device frame (including system chrome).

---

## Trigger points

The extension already classifies every captured line in real time via the LineListener fan-out on SessionManager. Screenshot triggers plug into this same pipeline, following the ErrorSnackbarNotifier pattern (`error-snackbar.ts`):

### Trigger 1: Error detection (highest priority)

When `isErrorLine(text, category)` returns true (same check the error snackbar uses), capture a screenshot. Apply the same fingerprint-based dedup and cooldown logic — one screenshot per unique error signature, minimum 2s gap.

### Trigger 2: Warning detection

When `isWarningLine(text)` returns true. Gated by a setting (`screenshotOnWarning`, default off) — warnings are frequent, and capturing on every one could be noisy.

### Trigger 3: Navigation events

When the flow-map breadcrumb classifier (`classifyBreadcrumb()` in `flow-map-breadcrumbs.ts`) detects a screen entry event. This captures a screenshot of each screen the user visits — the same data Rejourney's session replay provides, but as discrete snapshots rather than continuous recording. Gated by a setting (`screenshotOnNavigation`, default off).

### Trigger 4: Manual capture

A command (`saropaLogCapture.captureScreenshot`) the user can invoke from the command palette or bind to a key. Always available during an active debug session. No dedup or cooldown.

### Coalescing

Rapid triggers (e.g., 10 errors in 500ms during a crash cascade) must not fire 10 screenshots. Use:

- **Fingerprint dedup** (same as error snackbar): same normalized error = same screenshot, skip.
- **Global cooldown**: minimum 2s between any two screenshot captures (configurable via setting).
- **Queue cap**: maximum 5 pending captures. If the queue is full, drop the oldest pending request.

---

## Storage

### File location

Screenshots are saved alongside the log file as sidecar files:

```
reports/
  output.log
  output.meta.json
  output.logcat.log          (existing sidecar pattern)
  output.screenshots/        (new)
    001_error_1719849123.png
    002_nav_1719849145.png
    003_error_1719849201.png
```

The `output.screenshots/` directory is created on first capture. Filenames encode sequence number, trigger type, and timestamp for sort order without metadata parsing.

### Metadata

Each screenshot gets a JSON sidecar entry in the existing `.meta.json` file (or a new `.screenshots.json` if the meta format shouldn't grow):

```json
{
  "screenshots": [
    {
      "file": "001_error_1719849123.png",
      "trigger": "error",
      "timestamp": 1719849123456,
      "logLine": 847,
      "errorText": "NullPointerException: ...",
      "fingerprint": "a1b2c3"
    }
  ]
}
```

### Retention

Screenshots follow the same retention rules as log files — when a log is deleted or aged out, its `screenshots/` directory is deleted with it.

### Size budget

- Individual screenshot: resize to max 1280px wide before saving (the Flutter screenshot API returns full-resolution frames; downscale to keep files under ~200KB).
- Per-log cap: maximum 50 screenshots per log file. After 50, stop capturing and log a warning to the output channel.
- Total disk: screenshots count toward the existing `maxStorageMb` setting.

---

## Display

### In the log viewer — next to errors

When a log line has an associated screenshot, show a small camera icon (codicon `device-camera`) in the decoration gutter. For error-triggered captures, the icon sits on the error line itself — the screenshot is anchored to the exact line that fired the trigger (`logLine` in the metadata sidecar), so visual evidence appears directly beside the error, not in a separate gallery.

Clicking the icon expands an inline thumbnail below the line: 200px height, rounded corners, subtle border. Click again to open full-size in a new editor tab. The thumbnail loads lazily (only when scrolled into view) to avoid rendering hundreds of images for screenshot-heavy logs.

### On the timeline

Screenshots appear as events on the unified timeline panel (`timeline-panel.ts`). The timeline loader (`timeline-loader.ts`) already merges sidecar sources (perf, http, docker, terminal) into one time-sorted stream — the screenshots metadata sidecar joins that merge:

- New `TimelineSource` value `'screenshot'` in `timeline-event.ts`, with its own source label and marker color.
- Each entry from the metadata sidecar becomes a `TimelineEvent`: timestamp from capture time, summary from trigger type + error text, `location` pointing at the PNG so clicking opens the image.
- Timeline rows for screenshot events render a small thumbnail strip (not full images — the timeline is dense), consistent with the minimap/scrubber density.
- Error-triggered screenshots naturally land adjacent to their error events on the time axis, giving the timeline a visual "what the screen showed" track alongside the log stream.

### In the viewer footer — camera icon + counter

The viewer footer (`viewer-toolbar-html.ts` / `viewer-script-footer.ts`) gets a camera icon (codicon `device-camera`) with a live count of screenshots captured this session — following the existing footer-file-count precedent (plan 057's clickable `(n)` counter next to the filename).

The icon doubles as a **quick on/off toggle**: clicking it flips `integrations.screenshots.enabled` (the same boolean the Integrations checkbox binds to) without opening settings. Always visible so the off state is discoverable: full-opacity when on, dimmed when off (tooltip states the current state and the click action). The counter appears next to the icon once captures exist; it increments live as captures land (broadcast via the existing ViewerBroadcaster path).

Clicking the **counter** opens the **screenshot gallery webview** — a dedicated panel (same pattern as `timeline-panel.ts`: `vscode.window.createWebviewPanel`, disposed on close) showing every screenshot for the current session:

- One card per screenshot, newest first: thumbnail, full datetime stamp, and trigger type.
- **Why it was taken:** each card shows the evidence from the metadata sidecar — the trigger (error / warning / navigation / manual), the matched log line text (`errorText`), and a few surrounding log lines for context, rendered in the log monospace style.
- Clicking the log excerpt jumps to that line in the log viewer (`openLogAtLine`, same as the timeline's `openLine` message); clicking the thumbnail opens the full-size PNG in an editor tab.
- Lazy-load images (the gallery can hold up to the 50-per-log cap).

### In signal reports

The signal report's evidence section (`signal-report-details.ts`) shows the screenshot taken closest to the signal's trigger line. Rendered as:

- A thumbnail (300px wide) in the secondary column of the report grid.
- Caption: trigger type, timestamp, and a "View full size" link.
- If multiple screenshots exist near the signal, show the closest one with prev/next arrows.

### In the signal panel

The signal panel (`viewer-signal-panel.ts`) does not show screenshots inline — the panel is a compact list and images would break the density. Instead, signals with associated screenshots show a camera icon badge. Clicking the signal opens the report (which has the screenshot).

---

## Settings

### Master toggle — Integrations panel

Screenshots are an integration adapter, not a bare setting. Add a `screenshots` entry to `INTEGRATION_ADAPTERS` (`integrations-ui.ts`) so it renders as a checkbox row in the Integrations panel (`viewer-integrations-panel-html.ts`) and in the Quick Pick, with a long description, performance note ("captures only fire on trigger events; each capture is one VM Service call"), and when-to-disable text.

**On by default** — follow the `adbLogcat` precedent exactly: a dedicated boolean `saropaLogCapture.integrations.screenshots.enabled` (default `true`) that the Integrations checkbox binds to. adbLogcat is NOT in the default `integrations.adapters` array; its on-by-default behavior comes from its own `integrations.adbLogcat.enabled` boolean (package.json ~line 2584). Reusing that pattern avoids the trap where adding an id to the array default never reaches users who already customized `integrations.adapters`. Unchecking the row disables all screenshot capture; the per-trigger settings below only apply while the adapter is enabled.

### Per-trigger settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `saropaLogCapture.screenshotOnError` | boolean | `true` | Capture a screenshot when an error is detected |
| `saropaLogCapture.screenshotOnWarning` | boolean | `false` | Capture a screenshot when a warning is detected |
| `saropaLogCapture.screenshotOnNavigation` | boolean | `false` | Capture a screenshot on each screen navigation |
| `saropaLogCapture.screenshotCooldownMs` | number | `2000` | Minimum gap between screenshot captures (ms) |
| `saropaLogCapture.screenshotMaxPerLog` | number | `50` | Maximum screenshots per log file |

---

## Scope

### In scope

- Screenshot capture via Flutter VM Service during debug sessions
- Master on/off toggle as a `screenshots` adapter row in the Integrations panel (on by default)
- Trigger on error, warning, navigation, and manual command
- Storage as sidecar files alongside log files
- Inline display in log viewer next to the triggering error line (gutter icon + thumbnail)
- Screenshot events on the unified timeline (new `'screenshot'` source, thumbnail strip)
- Footer camera icon with live counter; opens a gallery webview (all screenshots with datetime + triggering log context)
- Display in signal reports (evidence section)
- Settings for trigger control and limits

### Out of scope

- Continuous screen recording / session replay (different product category)
- Screenshot capture for non-Flutter debug sessions (would need debug-adapter-specific implementations; Flutter first)
- Screenshot diffing between captures
- OCR or text extraction from screenshots
- App-side SDK capture (Plan 052 Workstream B — separate, complementary approach)
- Sharing screenshots via Gist/webhook (Plan 052 Workstream I gates this on redaction)

---

## Workstreams

### A. VM Service connection (foundation)

1. **A1** — Obtain the VM Service URI from the active Flutter debug session.
2. **A2** — Establish a WebSocket connection to the VM Service. Reconnect on drop. Dispose on session end.
3. **A3** — Call `_flutter.screenshot` and decode the base64 PNG response.
4. **A4** — Resize the PNG to max 1280px wide (use a lightweight image library or canvas-based downscale).
5. **A5** — Save to the screenshots sidecar directory.

### B. Trigger pipeline

1. **B0** — `screenshots` adapter entry in `INTEGRATION_ADAPTERS` plus `integrations.screenshots.enabled` boolean (default `true`, the adbLogcat pattern): Integrations panel row, Quick Pick entry, and the enabled-check every trigger consults before capturing.
2. **B1** — `ScreenshotCapturer` class implementing `LineListener`, following the `ErrorSnackbarNotifier` pattern. Registers on `SessionManager.addListener()`.
3. **B2** — Error trigger: calls capture on `isErrorLine()` match, with fingerprint dedup and cooldown.
4. **B3** — Warning trigger: calls capture on `isWarningLine()` match, gated by setting.
5. **B4** — Navigation trigger: calls capture on `classifyBreadcrumb()` screen-entry, gated by setting.
6. **B5** — Manual capture command registration.
7. **B6** — Coalescing queue (cap + cooldown + fingerprint dedup).

### C. Viewer display

1. **C1** — Camera gutter icon on lines with associated screenshots (error captures anchored to the triggering error line).
2. **C2** — Inline thumbnail rendering (lazy load, click-to-expand).
3. **C3** — Screenshot badge on signal panel entries.

### D. Signal report display

1. **D1** — Screenshot thumbnail in the evidence section of signal reports.
2. **D2** — Prev/next navigation when multiple screenshots exist near a signal.
3. **D3** — Full-size image viewer (open in VS Code editor tab).

### E. Footer + gallery webview

1. **E1** — Footer camera icon (always visible, on/off toggle posting `toggleScreenshots` to the host, which flips `integrations.screenshots.enabled`) + live counter (hidden at zero, click posts `openScreenshotGallery`); capture count and enabled state broadcast to webview targets.
2. **E2** — Gallery webview panel (timeline-panel pattern): cards with thumbnail, datetime, trigger type.
3. **E3** — "Why" context per card: trigger + matched line + surrounding log lines read from the log file around `logLine`; click-to-jump into the viewer.
4. **E4** — Lazy image loading; dispose panel state on close/session end.

### F. Timeline display

1. **F1** — `'screenshot'` source in `timeline-event.ts` with source label and marker color (`getSourceLabel` / `getSourceColor` in `timeline-loader.ts`).
2. **F2** — Loader: parse the screenshots metadata sidecar in `loadTimelineEvents()` and merge into the event stream.
3. **F3** — Thumbnail-strip rendering for screenshot events in the timeline row (click opens the PNG).

### Ship order

A (foundation) → B (triggers, incl. the Integrations toggle) → C (viewer) → D (reports) → E (footer + gallery) → F (timeline). Each workstream is independently testable. B can ship with screenshots saved to disk but not yet displayed (useful on its own for bug reports that include the screenshots directory).

---

## Verification

- [ ] Screenshot captured on Flutter error during debug session (F5 test).
- [ ] Screenshots adapter row appears in the Integrations panel, checked by default; unchecking it stops ALL captures (including manual command reports "disabled").
- [ ] Screenshot NOT captured when `screenshotOnError` is `false`.
- [ ] Cooldown respected: rapid errors produce at most 1 screenshot per `screenshotCooldownMs`.
- [ ] Fingerprint dedup: same error text does not produce duplicate screenshots.
- [ ] Queue cap: >50 screenshots per log stops capturing and logs a warning.
- [ ] Screenshots deleted when parent log file is deleted.
- [ ] Gutter icon appears on lines with screenshots in the viewer.
- [ ] Thumbnail renders inline on click (lazy loaded, not on initial render).
- [ ] Signal report shows the nearest screenshot in the evidence section.
- [ ] Manual capture command works from the command palette.
- [ ] Non-Flutter debug sessions: capture is silently unavailable (no errors, no UI noise).
- [ ] VM Service connection disposes cleanly on session end.
- [ ] Screenshots resize to ≤1280px wide before saving.
- [ ] Footer camera icon always visible; clicking it toggles `integrations.screenshots.enabled` and the icon dims when off.
- [ ] Footer counter hidden at zero captures; appears with count 1 on first capture and increments live.
- [ ] Clicking the footer counter opens the gallery webview with one card per screenshot (thumbnail, datetime, trigger).
- [ ] Gallery cards show the triggering log line + surrounding context; clicking the excerpt jumps to that line in the viewer.
- [ ] Gallery thumbnails lazy-load; clicking one opens the full-size PNG in an editor tab.
- [ ] Timeline shows screenshot events at capture time with the `'screenshot'` source label and color; clicking one opens the PNG.
- [ ] Error-triggered screenshot events sit adjacent to their error events on the timeline.
