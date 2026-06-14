# Plan 052 — Semantic Timeline Capture and Signal Expansion

## Status: Proposed

<!-- cspell:disable -->

## Goal

Today the extension captures everything the Debug Console emits — stdout, stderr, framework error reports, Drift queries, stack traces. What it does **not** see is the semantic shape of what the running app was *doing*: which screen was active, which button was tapped, which network call just failed, where in a flow the user got stuck. Bug reports therefore reconstruct the symptom (the error line, the stack, the surrounding context) without reconstructing the **journey**.

This plan adds three connected capabilities:

1. A tiny **app-side SDK** that lets Flutter apps emit structured semantic events (actions, navigation, breadcrumbs, network outcomes) into the existing log stream the extension already reads — no transport changes, no MCP, no socket.
2. **Structured ingestion** in the extension that parses those events back into typed timeline items the viewer and signals panel can reason about.
3. A round of **new signals** and a **Crash Context Summary** in bug reports that exploit the new event types to answer "what was happening just before this broke?"

This is a multi-workstream plan. Each workstream below has its own scope, verification, and can ship independently in the order given.

---

## Quick Wins

Items below qualify as quick wins because they (a) ship on **existing data** — no SDK or wire-format dependency, (b) require no cross-session storage beyond what already exists at `.saropa/index/`, and (c) are scoped to one or two files. Use this as the starting point before the SDK (Workstreams A–C) lands.

### Tier 1 — Signals panel UX (rendering only, no new data)

- [x] **Fu7** — Time-window filter chips (Last 5s / 30s / 5min / All) at top of signals panel. Biggest live-debugging unlock — user just hit the bug, only the last 30s matters.
- [x] **Fu3** — Inline evidence preview: render a 3-line snippet of the supporting log lines directly under each signal title. Removes the click-through to see what the signal is grounded in.
- [x] **Fu2** — Scroll-lock pulse: clicking a signal already jumps to the implicated line; add a brief ±10-line highlight pulse so the eye lands on the right place. Reuses existing pulse styles.
- [x] **Fu4** — Mute-with-reason: right-click a signal → free-text reason (≤80 chars) → persist. Anonymous mute is silent; reasoned mute becomes a labeled training example for the already-shipped noise-learning system at [src/modules/learning/](../src/modules/learning/) (plan [025](history/2026.03/20260323/025_plan-noise-learning.md), implemented 2026-03-23). Wire the reason into the existing `trackInteraction` API.

### Tier 2 — New signals on existing data (no SDK)

- [x] **F10** — Severity escalation chain (warn → warn → error within configurable window, default 5s). Highest signal-to-noise of the lot; the pattern is intrinsically meaningful. Sliding-window scan over existing severity classification, low false-positive risk.
- [x] **F9** — Silence-then-burst (≥10s of silence followed by ≥20 lines in <1s). Catches UI freezes and watchdog events that are otherwise invisible. Two-counter check.
- [x] **F14** — Frame-budget cluster (≥5 PERF lines or Flutter frame-budget warnings in 10s). Direct extension of the already-shipped detector from [plans/048_plan-perf-line-signal-detection.md](history/2026.04/2026.04.16/048_plan-perf-line-signal-detection.md); same source data, one aggregation layer.
- [x] **F7** — New error type signal: error fingerprint not seen in the previous M sessions appears in current. Cross-session set lookup against the project index. Big perceived value — "you just introduced a new crash."
- [x] **F8** — Disappearing error signal (positive): fingerprint present in past M sessions absent in current. Same storage as F7, opposite query. Rewards good fixes; currently the panel surfaces problems only.

### Tier 3 — Bug report variants (no SDK, no redaction blocker)

- [x] **E3** — GitHub-issue preset: variant of the existing formatter targeting GitHub's template conventions (Summary / Steps / Current Route / Recent Actions / Errors / Network / Device / Screenshots). New command `saropaLogCapture.exportGitHubIssue`.
- [x] **E4** — Compact handoff bundle: a 3-section markdown subset (~30 lines max) for "I'm stuck, can you look?" Slack messages. Subset of existing formatter, no new data collection. Command `saropaLogCapture.copyHandoffBundle`.

### Recommended ship order

If shipping a subset rather than the full quick-win pass, in this order:

1. [x] **F10** severity escalation chain — highest signal-to-noise per line of code in the whole plan.
2. [x] **Fu7** time-window filter — instant UX win on every existing signal; compounds the value of everything else.
3. [x] **F7 + F8** new / disappearing error pair — share storage and query, ship together.

### Explicitly deferred — not quick wins

- **E1** Crash Context Summary section in bug reports. Listed elsewhere as the highest-leverage early win, but only **after** the SDK lands. Without semantic events, degrades to "last few warning lines before the error" — useful, but not differentiated from the existing log-context section.
- **H1–H5** sharing destinations (webhook, Slack, Discord, generic, auto-post guardrail). Hard-gated by Workstream I (redaction).
- **F1** crash precursor pattern, **F4** action-to-error fingerprint, **F2** nav thrash, **F3** dead-end navigation, **F11** time-to-first-error, **F12** route latency, **F13** cold-start anomaly. All require event types that don't exist until the SDK lands.
- **F5, F6, F15** network signals — depend on Workstream G (HTTP integration completion).

### Skip — low leverage even at low cost

- [x] **Fu5** Sort toggle (severity ↔ chronological). **Shipped 2026-06-10** — a toggle under the time-window chips flips "Signals in this log" between By severity (default) and By time; see Finish Report below.
- **Fu8** Pin signals to collections. Nice-to-have integration; doesn't move the needle on signal discovery or triage. Save for a cleanup pass.

---

## Problem

### What the viewer currently sees vs. what it misses

| Layer | Captured today | Captured after this plan |
|---|---|---|
| App-level errors (Dart-side) | ✓ via DAP stdout + Flutter error widget | ✓ |
| Stack traces | ✓ stack-parser groups frames, classifies framework vs app | ✓ |
| Drift SQL | ✓ Drift Advisor integration adapter | ✓ |
| Print statements | ✓ raw | ✓ |
| Logcat (Android) | ✓ via [plans/042_plan-adb-logcat.md](042_plan-adb-logcat.md) | ✓ |
| **Route push/pop/replace** | ✗ unless app manually prints it | ✓ |
| **UI actions (button taps, gestures)** | ✗ unless app manually prints it | ✓ |
| **Semantic events (`checkout_started`, `payment_failed`)** | ✗ unless app manually prints it | ✓ |
| **Outgoing HTTP requests + statuses** | ▲ partial — planned in [010_integration-spec-http-network.md](010_integration-spec-http-network.md) | ✓ via SDK and/or HAR |
| **Screenshot references at error time** | ✗ no rendering path | ✓ optional, opt-in |

Three observations follow from the gap:

- **Bug reports describe symptoms, not causes.** The error line is captured; the chain of actions leading to it is not.
- **The signals panel is bounded by line-level pattern matching.** It can flag slow ops, error clusters, N+1 queries — all derived from text. It cannot flag "user navigated to checkout, then tapped Pay, then a 402 came back, then we crashed" because the four events don't exist as structured items.
- **Cross-session signal trends collapse.** Without a stable event taxonomy, "this error follows this action 80% of the time" is unreachable.

---

## Scope

### In scope

- **A.** App-side capture SDK (a separate pub.dev package, debug-only by default).
- **B.** Wire-format protocol — single-line prefix marker the existing log capture pipeline carries unchanged.
- **C.** Parser and storage of structured timeline items in the extension.
- **D.** Viewer rendering: type badges, expandable payloads, route ribbon, timeline minimap dots.
- **E.** Bug report formatter: **Crash Context Summary** section, GitHub-issue preset, compact handoff bundle.
- **F.** Signals panel: new signals derived from event types, evidence-preview UX, mute-with-reason.
- **G.** HTTP integration completion (already specced, deferred items now actionable thanks to SDK events).
- **H.** Optional export destinations (webhook via secret storage, Block Kit / embed payloads).
- **I.** Redaction rule engine — required before any "share" workflow ships.

### Out of scope

- On-device overlay / floating launcher / in-app panel. The extension lives on the dev workstation; in-app UI is not its layer.
- Native crash capture (iOS `NSException`, Android `JNI_FatalError`, plugin SIGSEGVs). Out of scope of a Dart-only SDK.
- Replacing or downsizing the existing bug-report formatter at [src/modules/bug-report/bug-report-formatter.ts](../src/modules/bug-report/bug-report-formatter.ts). The new Crash Context section is **additive** — it adds a compact "what happened just before" block at the top of the existing rich report.
- Automatic auto-posting on crash to any external destination. Sharing remains an explicit user action.

---

## Workstreams

### Workstream A — Wire-format protocol

A single prefix-marker contract the SDK and parser both honor. The marker must be cheap to recognize (one regex per line) and survive whatever transformations DAP applies to stdout.

#### A1. Marker format
- Prefix: `[slc:event]` for actions/events/breadcrumbs/navigation, `[slc:net]` for network outcomes, `[slc:img]` for screenshot references.
- Body: compact JSON, no newlines, max 4 KB per event (configurable).
- One event per line. Multi-line payloads are rejected to keep stream parsing line-oriented.
- Example: `[slc:event] {"t":"action","n":"tap_pay","r":"/checkout","ts":"2026-05-13T10:23:11.412Z","d":{"buttonId":"pay_now"}}`

#### A2. Reserved field names
- `t` — type: `action` | `event` | `nav` | `breadcrumb` | `error`
- `n` — name / message
- `r` — current route (denormalized for cheap signal queries)
- `ts` — ISO 8601 timestamp
- `d` — payload object (free-form, redaction applies)

#### A3. Why a prefix protocol and not a separate transport
- Existing capture pipeline (DAP → log file → viewer) is well-tested and integration-adapter-friendly.
- New transport (socket, MCP, etc.) doubles the failure surface and breaks remote development scenarios.
- Prefix marker degrades gracefully: a user viewing the raw log file sees a readable line, not a binary blob.
- The extension's existing `addToData()` pipeline can branch on the prefix and route to a structured handler.

#### A4. Wire-format verification
- Unit test: SDK emits `action('tap_pay')` → parser produces `LineItem` with `type='event-action'`, `name='tap_pay'`, `route='/checkout'`.
- Round-trip test: a synthetic log file with 10 mixed events parses back to the original 10 items in order.

---

### Workstream B — App-side SDK (Flutter package)

A new package, separate repo, separate pub.dev publish. Name TBD (suggestion: `saropa_log_capture_flutter` to mirror the marketplace ID).

#### B1. Public API
```dart
SaropaCapture.event(String name, {Map<String, dynamic> data = const {}});
SaropaCapture.action(String name, {Map<String, dynamic> data = const {}});
SaropaCapture.breadcrumb(String message);
SaropaCapture.error(Object error, StackTrace stack, {Map<String, dynamic> data = const {}});

// Auto-attached via NavigatorObserver subclass
SaropaCaptureRouteObserver();
```

#### B2. Transport
- Emits via `dart:developer`'s `log()` (preferred — survives release-mode strip via `kDebugMode` gate) or `print()` fallback.
- One-line JSON-encoded payload with the prefix protocol from A.
- No flushing, no buffering, no batching — fire-and-forget; the OS / IDE handles the rest.

#### B3. Debug-build-only gate
- Hard-coded `if (!kDebugMode) return;` at the top of every public method.
- Release builds are dead-code-eliminated by the Dart compiler. Zero runtime cost in production APK/IPA.

#### B4. NavigatorObserver
- Subclasses `NavigatorObserver`. Hooks `didPush`, `didPop`, `didReplace`, `didRemove`.
- Emits `{t: 'nav', n: '/from -> /to', d: {previous, current, action: 'push|pop|replace|remove'}}`.

#### B5. Redaction hook
- `SaropaCapture.setRedactor((Map<String, dynamic> data) => sanitized)` — app provides redaction. SDK does not ship a default redactor (apps own their secret taxonomy).
- Note in README: "If you don't set a redactor, anything you pass in `data` will be visible to anyone with the log file."

#### B6. Backpressure
- Soft rate-limit: if more than N events/second emitted, append a `[slc:event] {"t":"breadcrumb","n":"event rate limited"}` line and drop until rate falls.
- Default N = 50/sec, configurable.

#### B7. Verification
- Sample Flutter app in the SDK repo. F5 in saropa-log-capture against that app. Viewer shows route ribbon, action badges, expandable payload. Visible bug = visible regression.

---

### Workstream C — Structured ingestion in the extension

The extension already classifies lines via [src/ui/viewer/viewer-data-helpers.ts](../src/ui/viewer/viewer-data-helpers.ts) and routes through `addToData()`. Add a branch for the new prefixes.

#### C1. Parser
- New module `src/modules/timeline/timeline-line-parser.ts` — detects `[slc:event]`, `[slc:net]`, `[slc:img]` prefixes, parses the JSON body, returns `TimelineEvent | null`.
- Bad JSON → log a warning to the output channel, render the line as-is (no silent drops; failures must be visible).
- Per `.claude/rules/global.md`: parser handles **all** prefix variants. Future prefixes (`[slc:metric]`, etc.) added in one place.

#### C2. LineItem extension
- Extend the LineItem shape with optional `event?: TimelineEvent`.
- New `type` values: `'event-action'`, `'event-nav'`, `'event-breadcrumb'`, `'event-net'`, `'event-img'`.
- `calcItemHeight()` and filter logic per `.claude/rules/global.md` "Webview Viewer Filters" — flag classification flows through `addToData → item.eventType → calcItemHeight`.

#### C3. Settings
- `saropaLogCapture.timeline.enabled` (default `true`) — master kill switch.
- `saropaLogCapture.timeline.routeRibbon` (default `true`).
- `saropaLogCapture.timeline.maxEventDataKb` (default `4`).

#### C4. Verification
- Unit test: log file with 20 mixed prefixed lines + 80 regular lines parses to correct mixed type distribution.
- Manual: F5 with sample app, scroll the log, every event has the right badge and the right route in the ribbon.

---

### Workstream D — Viewer rendering

Surface the new event types in the existing viewer without disturbing line-density for users who don't use the SDK.

#### D1. Type badges
- Inline badge before the message: `[ACTION]`, `[EVENT]`, `[NAV]`, `[BREADCRUMB]`.
- Reuse existing badge styles from [src/ui/viewer-styles/](../src/ui/viewer-styles/) — do not introduce new visual primitives.

#### D2. Expandable payload
- Click chevron next to an event line → expand `d` payload as collapsible JSON block (existing JSON rendering already supports this — see [src/ui/viewer/viewer-data-add-context-helpers.ts](../src/ui/viewer/viewer-data-add-context-helpers.ts)).

#### D3. Route ribbon
- Optional horizontal strip above the line viewport showing the last 6 routes as breadcrumb chips.
- Updates as the viewport scrolls — shows routes active at the lines currently visible.
- Click a chip → jump to the corresponding `[NAV]` line.

#### D4. Timeline minimap dots
- Existing minimap at [src/ui/viewer/viewer-scrollbar-minimap-paint.ts](../src/ui/viewer/viewer-scrollbar-minimap-paint.ts) paints search matches, errors, warnings, viewport.
- Add: small dots for `event-action` (cyan), `event-nav` (purple), `event-net` failures (orange) — each independently togglable.

#### D5. Filter toggles
- Add to existing filter toolbar: chips for Events / Actions / Navigation / Breadcrumb / Network.
- Per-file persisted, same pattern as severity-level filter.

#### D6. Screenshot inline render
- When a `[slc:img]` line carries a `path` field that resolves to an existing local file inside the workspace, render a thumbnail inline (200px height).
- Only if path is **inside** the workspace — never auto-load arbitrary file URIs. Path-traversal guard mandatory.

#### D7. Compact session overview card
- New card at the top of the viewer (collapsible): current route, totals (events, errors, network failures, session duration).
- Borrowed pattern: a compact "what's happening in this session" header is much higher signal than scrolling to find it.

#### D8. Verification
- Each visual element has a manual-test entry in the verification checklist at the end of this plan.

---

### Workstream E — Bug report formatter enhancements

The existing formatter at [src/modules/bug-report/bug-report-formatter.ts:26-59](../src/modules/bug-report/bug-report-formatter.ts#L26-L59) is rich. We **add**, we do not replace.

#### E1. Crash Context Summary section
- New section, inserted right after the executive summary, before the error line.
- Format:
  ```markdown
  ## Crash Context
  - **Active route**: /checkout/payment
  - **Previous route**: /checkout
  - **Last 3 actions**:
    - 10:23:09 tap_view_cart
    - 10:23:11 tap_pay_now
    - 10:23:11 submit_payment
  - **Last failed network call**: POST /api/charge → 402 (1240ms)
  - **Severity escalation**: 2 warnings preceded the error within 5s
  ```
- Compact, high-signal-to-noise. The full timeline still appears in later sections; this is the "TL;DR for the on-call".

#### E2. New formatter section `formatCrashContext()`
- New file `src/modules/bug-report/bug-report-crash-context.ts`.
- Inputs: `BugReportData` extended with `timeline?: TimelineEvent[]`.
- Output: markdown string or empty string (renders nothing if no timeline events).

#### E3. GitHub-issue preset
- Existing formatter targets a single rich template. Add a `mode: 'github-issue'` parameter that produces a tighter variant: Summary / Steps / Current Route / Recent Actions / Errors / Network Calls / Device Info / Screenshots — sectioned to match GitHub issue template conventions.
- Triggered via new command: `saropaLogCapture.exportGitHubIssue`.

#### E4. Compact handoff bundle
- A 3-section markdown subset: "What happened" / "Where" / "What to look at next".
- ~30 lines max. For "I'm stuck, can you look at this?" Slack/Discord messages.
- Command: `saropaLogCapture.copyHandoffBundle`.

#### E5. Verification
- Generate report from a fixture session with 12 events + 1 error → assert Crash Context section appears, lists correct 3 actions, correct previous route.
- Generate from a session with **no** timeline events → assert Crash Context section is omitted, no empty headers.

---

### Workstream F — Signals panel: new signals (the focus of this plan)

The existing signals panel at [src/ui/panels/viewer-signal-panel.ts](../src/ui/panels/viewer-signal-panel.ts) supports Collections, All Signals, Frequently Modified Files, Performance. Signal collectors live under [src/modules/root-cause-hints/](../src/modules/root-cause-hints/). Existing signals are pattern-based on raw text.

Adding event types unlocks a class of **structural** signals that don't reduce to text patterns.

#### F1. Crash precursor pattern signal
- **What:** detect recurring action sequences (last N=3 actions) preceding errors of the same fingerprint across sessions.
- **Output:** "Error `RangeError` follows the action sequence `[tap_view_cart, tap_pay_now, submit_payment]` in 4 of 5 sessions."
- **Confidence:** sample-count based — needs ≥3 sessions with same precursor.
- **Storage:** cross-session index. Reuse the existing project index under `.saropa/index/`.
- **Collector:** `src/modules/root-cause-hints/signal-crash-precursor.ts`.

#### F2. Navigation thrash signal
- **What:** user bounced between same two routes ≥5 times within 30s.
- **Why:** often indicates a broken navigation (back-button loop) or confused user.
- **Output:** "Navigation thrash: /home ↔ /settings × 7 in 22s. Possible broken back navigation."

#### F3. Dead-end navigation signal
- **What:** the route active at the moment of error/crash, surfaced across sessions.
- **Output:** "5 of last 8 errors occurred on /checkout/payment. Most common precursor action: tap_pay_now."

#### F4. Action-to-error fingerprint
- **What:** specific user action consistently precedes a specific error fingerprint.
- **Output:** "Action `tap_export_csv` precedes `StateError: setState() called after dispose()` in 3 of 4 occurrences."
- **Difference from F1:** F1 is sequence-based, F4 is single-action correlation.

#### F5. Network failure cluster
- **What:** same endpoint + same status code ≥3 times within 60s.
- **Output:** "POST /api/charge → 402 × 4 in 45s. Endpoint health degraded."
- **Depends on:** Workstream G completion.

#### F6. 4xx / 5xx burst
- **What:** ≥5 4xx or 5xx responses (any endpoint) within 30s.
- **Output:** "Network failure burst: 7 4xx responses in 28s across 3 endpoints. Possible auth expiry or network partition."

#### F7. New error type signal (regression detector)
- **What:** error fingerprint not seen in the previous M sessions appears in current.
- **Output:** "New error type since session #18: `TypeError: Null check operator used on a null value` at order_repository.dart:142."
- **Storage:** cross-session error fingerprint set.

#### F8. Disappearing error signal (positive)
- **What:** error fingerprint present in past M sessions absent in current.
- **Output:** "Error `TimeoutException` (last seen 3 sessions ago) has not reoccurred. Likely fixed."
- **Why:** rewards good fixes. Currently the panel only surfaces problems.

#### F9. Silence-then-burst signal
- **What:** ≥10s of zero log lines followed by ≥20 lines in <1s.
- **Why:** often indicates the app froze and then unwound a queue, or a watchdog fired.
- **Output:** "Log silence (12.4s) followed by burst of 47 lines. Possible UI freeze or watchdog event."

#### F10. Severity escalation chain
- **What:** monotonic warn → warn → error within configurable window (default 5s).
- **Output:** "Severity escalation: 2 warnings preceded the error within 4.2s. Warning text: `database connection slow`."
- **Use case:** the "this didn't come out of nowhere" pattern.

#### F11. Time-to-first-error signal
- **What:** elapsed time from session start to first error, compared against the baseline median across past 10 sessions.
- **Output:** "First error at 2.1s (baseline median: 47s). Startup health degraded by 95%."
- **Use case:** regression catching when something starts crashing on launch.

#### F12. Route latency signal
- **What:** navigation transition takes >800ms (configurable).
- **Output:** "Slow navigation: /home → /feed took 1240ms. Above 800ms threshold."
- **Depends on:** SDK emitting nav events with timestamps; calculated as `nav.ts - previousNav.ts`.

#### F13. Cold-start anomaly
- **What:** first 5 seconds of the session contain a signal type (any error / specific error fingerprint) that doesn't appear in subsequent windows of comparable sessions.
- **Use case:** "first launch after install crashes, second doesn't" pattern.

#### F14. Frame-budget signal
- **What:** if PERF lines or Flutter frame-budget warnings cluster (≥5 in 10s).
- **Output:** "Frame budget exceeded × 7 in 9s. UI jank likely visible to user."
- **Builds on:** existing slow-op signal from [plans/048_plan-perf-line-signal-detection.md](history/2026.04/2026.04.16/048_plan-perf-line-signal-detection.md).

#### F15. Endpoint health card
- **What:** per-endpoint summary card: total calls, status code distribution, p50/p95 latency, last failure.
- **Where:** new accordion section in Performance tab.
- **Why:** the panel currently has "errors" and "database" sub-sections; HTTP is missing.

#### F16. Recurring error fingerprint
- **What:** same error fingerprint (normalized stack hash) ≥3 sessions.
- **Output:** "`RangeError` at orders.dart:88 occurred in 4 of last 5 sessions. Top precursor action: tap_refresh_orders."
- **Note:** the existing "errors recurring across sessions" surface partially covers this. Verify before duplicating; if it exists, this becomes a no-op.

---

### Workstream F-UX — Signals panel: rendering and interaction

#### Fu1. Crash context card pinned at top
- When the current session has a fatal error or unhandled exception, surface a pinned card at the top of the All Signals accordion containing the Crash Context Summary (E1) inline.

#### Fu2. Signal-to-line scroll lock
- Clicking a signal already navigates to the implicated line. Add: highlight a configurable window (±10 lines) around the target and pulse the background briefly to draw the eye. Existing pulse pattern available in viewer styles.

#### Fu3. Signal evidence preview
- Inline 3-line snippet of supporting lines below the signal title. Click to expand to full 10-line context. Today the user has to click through to see what the signal is grounded in — collapsing the click reduces friction.

#### Fu4. Mute-with-reason
- Right-click signal → "Mute this signal" → free-text reason (≤80 chars).
- Reason feeds into the already-shipped noise-learning system at [src/modules/learning/](../src/modules/learning/) (plan [025](history/2026.03/20260323/025_plan-noise-learning.md), implemented 2026-03-23) via its `trackInteraction` API.
- Without reason: mute is anonymous (existing learning path). With reason: mute becomes a labeled training example.

#### Fu5. Severity sort vs chronological sort toggle
- Currently signals are sorted by severity. Add a toggle for chronological — useful when investigating "what happened in order".

#### Fu6. Group signals by hot file
- Existing "Frequently Modified Files" section. Extend with: all signals grouped by the file each signal implicates. Two views, same data.

#### Fu7. Quick filter: "in last 30s"
- Time-window filter at the top of the panel: All / Last 5s / Last 30s / Last 5min.
- Useful during live debugging — the user just did the action that broke it; only the last 30s matters.

#### Fu8. Pin signals to collections
- Right-click signal → "Pin to collection..." → existing collection picker.
- Signals are first-class collection members alongside log files. A "checkout broken" collection can contain three sessions + four signals.

#### Fu9. Cross-session signal delta
- New command: "Compare signals between two sessions". Side-by-side: signals only in A, only in B, in both.
- Reuses existing two-session comparison plumbing.

---

### Workstream G — HTTP integration completion

The existing spec at [plans/010_integration-spec-http-network.md](010_integration-spec-http-network.md) is marked **Partial**. Several items are in its "Deferred" list. Workstream F signals depend on these being completed.

#### G1. Body preview with size cap and redaction
- The deferred item already names size cap + redaction as constraints. Implement both. Default cap: 2 KB per body. Redaction: see Workstream I.

#### G2. Latency histogram in Performance panel
- Per-endpoint p50/p95/p99 from the HAR or request log.

#### G3. Group requests by endpoint pattern
- Normalize `/api/orders/12345` → `/api/orders/:id` via path-segment heuristics.

#### G4. HAR drag-and-drop
- Currently HAR is loaded from a configured path. Add: drag-and-drop a HAR file into the viewer to associate it with the current session.

#### G5. Request inspector inline panel
- Selecting a log line with a correlated request → side panel shows request/response (redacted).

#### G6. SDK-direct network events
- When the SDK is present, network events arrive as `[slc:net]` lines and bypass the HAR/log path entirely.
- HAR path remains supported for apps that don't adopt the SDK.

---

### Workstream H — Export and sharing destinations

Optional. Ship after Workstreams E and I.

#### H1. Webhook destination via VS Code secret storage
- Settings reference a webhook *name*; the URL is stored in `context.secrets`.
- Never store webhook URLs in `settings.json` (sync surface; leak risk).
- Command: `saropaLogCapture.configureWebhook` to add/remove named webhooks.

#### H2. Slack Block Kit payload
- Bug report → posted as Block Kit blocks (header, divider, error fingerprint, three action buttons "Copy markdown", "Open in editor", "Mark resolved").
- Slack signed-secret verification not applicable (this is outbound, not inbound).

#### H3. Discord embed payload
- Same content, Discord embed format. One adapter per destination.

#### H4. Generic webhook adapter
- Raw JSON POST with the full report markdown. For Mattermost, Rocket.Chat, GitHub via API, custom endpoints.

#### H5. Auto-post guardrail
- Auto-post on error is **not** in scope. Sharing requires explicit user action: command palette, right-click, or button. Avoids the failure mode where a CI build firehose-posts to a Slack channel.

---

### Workstream I — Redaction rule engine

Must land before any sharing destination ships. Privacy work is a hard prerequisite, not a polish item.

#### I1. Rule definition
- Settings: `saropaLogCapture.redaction.rules`: array of rules.
- Each rule: `{match: 'header'|'json-field'|'regex', pattern: string, replacement: string}`.
- Default rules ship in package.json: `Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`, `X-Auth-Token`, JSON fields `password`, `token`, `secret`, `apiKey`, `ssn`, `creditCard`.

#### I2. Where redaction applies
- **At export time**, not at ingest time. Ingested data is left as-is in the local log file (devs need to see real values during local debugging).
- Two export profiles: `local` (no redaction — viewer, local HTML export) and `share` (full redaction — Slack, Discord, GitHub issue, handoff bundle).
- The profile is determined by the destination, not user choice. Sharing always redacts.

#### I3. Redaction marker
- Redacted values replaced with `[REDACTED:<rule-name>]` not just `[REDACTED]`. Lets a reviewer audit which rule fired without seeing the original value.

#### I4. End-of-session lint
- At session end, scan the session for known-sensitive patterns (Bearer tokens, JWTs, AWS keys) that **don't** match a redaction rule.
- If found: toast warning "Session contains unredacted potential secrets. Consider adding a redaction rule before sharing." Link to settings.

#### I5. Verification
- Unit test: each default rule applied to a known-bad sample produces the expected `[REDACTED:*]` marker.
- Snapshot test: a sample bug report with auth headers and a password field exports with full redaction in `share` mode, no redaction in `local` mode.

---

### Workstream J — Performance and reliability

#### J1. Breadcrumb buffer backpressure
- Today the SDK has no buffer (fire-and-forget via `developer.log`). On the extension side, the LineItem array grows with the log file. Verify it scales: 10K events should render without lag using the existing virtual scroller. Add a benchmark test.

#### J2. Streaming SDK ingestion
- New `[slc:event]` lines arrive in the same batched messages as regular lines (existing pipeline). No re-render storms — the existing renderViewport pattern already handles incremental.

#### J3. Parser cost
- Prefix detection is one `startsWith()` per line — cheap. Verify with a microbenchmark on a 100K-line log: prefix-detection overhead should be <2% of total parse time.

#### J4. Event payload size cap
- 4 KB per event hard cap (enforced parser-side; oversize events render as a truncated breadcrumb with a marker). Prevents a misbehaving SDK consumer from blowing the line buffer.

---

## Sequencing

Workstreams have a real dependency graph. Ship in this order:

1. **A** (wire-format) — paper exercise; design doc + tests only.
2. **I** (redaction) — independent of SDK; can ship first, gates Workstream H later.
3. **B** (SDK) and **C** (ingestion) — A is a prerequisite; B and C can develop in parallel since the protocol is fixed.
4. **D** (viewer rendering) — depends on C.
5. **E** (bug report Crash Context) — depends on C (needs timeline events).
6. **F** (signals) — depends on C; individual signals can ship one at a time. F1–F4 / F7–F8 need the cross-session index; F5–F6 / F15 need Workstream G.
7. **G** (HTTP integration completion) — independent of SDK but accelerated by it (SDK can supply network events directly).
8. **F-UX** (signals panel UX) — depends on F (need at least one new signal to validate).
9. **H** (sharing destinations) — depends on E + I.

The Crash Context Summary (E1) is the highest-leverage early win once the SDK is published.

---

## Per-item complexity and risk

Complexity scale: **Low** (single file or two), **Medium** (cross-cutting, parser + renderer + settings), **High** (cross-session storage, new signal logic, redaction).

| Item | Complexity | Risk | Notes |
|---|---|---|---|
| A — wire-format | Low | Low | Pure design. |
| B1–B4 SDK core API | Medium | Low | Separate repo; standard Flutter package. |
| B5 redaction hook | Low | Medium | App-owned redactor; SDK does not ship a default — risky if app authors ignore it. |
| B6 backpressure | Low | Low | Token bucket. |
| C1–C4 ingestion | Medium | Low | Branches off existing addToData(). |
| D1–D8 viewer rendering | Medium | Medium | Route ribbon is the visually riskiest — verify it doesn't crowd small viewports. |
| E1–E2 Crash Context | Low | Low | New formatter section, additive. |
| E3 GitHub issue preset | Low | Low | Variant of existing formatter. |
| E4 handoff bundle | Low | Low | Subset of existing formatter. |
| F1 crash precursor | High | Medium | Needs cross-session storage + clustering. |
| F2 nav thrash | Low | Low | Sliding window over nav events. |
| F3 dead-end nav | Medium | Low | Cross-session aggregation. |
| F4 action-to-error fingerprint | Medium | Medium | Co-occurrence model; false-positive risk. |
| F5 network cluster | Low | Low | Sliding window. |
| F6 4xx/5xx burst | Low | Low | Sliding window. |
| F7 new error type | Medium | Low | Cross-session fingerprint set. |
| F8 disappearing error | Medium | Low | Same data structure as F7. |
| F9 silence then burst | Low | Low | Two-counter check. |
| F10 severity escalation | Low | Low | Window scan. |
| F11 time-to-first-error | Medium | Medium | Baseline calculation across sessions — define baseline carefully. |
| F12 route latency | Low | Low | Subtract timestamps. |
| F13 cold-start anomaly | High | High | Anomaly definition is fuzzy; tune carefully. |
| F14 frame budget | Low | Low | Sliding window. |
| F15 endpoint health card | Medium | Low | Aggregation; depends on G. |
| F16 recurring error | Low | Low | Verify before duplicating existing surface. |
| Fu1 crash card pinned | Low | Low | Layout. |
| Fu2 scroll lock pulse | Low | Low | Reuse existing pulse. |
| Fu3 evidence preview | Low | Low | Truncated snippet. |
| Fu4 mute with reason | Low | Low | Storage. |
| Fu5 sort toggle | Low | Low | Two comparators. |
| Fu6 group by hot file | Low | Low | Reuse hot-file aggregation. |
| Fu7 time-window filter | Low | Low | Filter. |
| Fu8 pin to collection | Low | Low | Existing collection plumbing. |
| Fu9 cross-session delta | Medium | Low | Reuse comparison plumbing. |
| G1 body preview | Medium | Medium | Depends on I. |
| G2 latency histogram | Medium | Low | Standard percentile math. |
| G3 endpoint grouping | Medium | Medium | Path normalization heuristics — false-positive risk. |
| G4 HAR drag-drop | Low | Low | File-drop handler. |
| G5 request inspector | Medium | Low | New side panel. |
| G6 SDK-direct network | Low | Low | Branch in parser. |
| H1 webhook secrets | Low | Medium | Don't leak via settings sync. |
| H2 Slack Block Kit | Medium | Low | Format mapping. |
| H3 Discord embed | Low | Low | Format mapping. |
| H4 generic webhook | Low | Low | Raw POST. |
| H5 auto-post guardrail | Low | Low | Don't ship the feature; document the choice. |
| I1–I5 redaction engine | High | High | Privacy-critical. Audit by a second reviewer before shipping. |
| J1–J4 perf | Medium | Low | Benchmarks. |

---

## Verification checklist

A workstream is **not done** until every check below passes. Per project rules, partial implementation keeps the workstream open.

### A — wire-format
- [ ] Protocol doc lives in `docs/timeline-protocol.md`.
- [ ] Round-trip test passes.

### B — SDK
- [ ] Package published to pub.dev (or private registry if not yet public).
- [ ] Release build of sample app produces zero `[slc:*]` lines (dead-code stripped).
- [ ] Debug build with NavigatorObserver emits `[slc:event]` for each navigation.

### C — ingestion
- [ ] 100K-line log file with 5K events parses in <500ms (benchmark).
- [ ] Bad JSON in `[slc:event]` payload logs a warning to the output channel; line renders as raw text.
- [ ] All five `type` values render with correct badge.

### D — viewer
- [ ] Route ribbon shows last 6 routes at viewport.
- [ ] Minimap shows colored dots for the three event types.
- [ ] Filter chips persist per file.
- [ ] Screenshot inline render rejects paths outside the workspace (path-traversal test).

### E — bug report
- [ ] Crash Context section renders for sessions with timeline events.
- [ ] Crash Context section is omitted entirely for sessions without timeline events (no empty headers).
- [ ] GitHub issue preset matches GitHub's template conventions.
- [ ] Handoff bundle is ≤30 lines for a typical session.

### F — signals (each signal verified independently)
- [ ] Each new signal has a fixture-based unit test.
- [ ] Each new signal renders with confidence label.
- [ ] No signal fires on an empty session.
- [ ] No signal fires below its minimum sample size.

### F-UX
- [ ] Crash context card appears only when current session has fatal error.
- [ ] Mute with reason persists across reload.
- [ ] Time-window filter updates within 100ms of selection.

### G — HTTP integration
- [ ] Body preview honors 2 KB cap.
- [ ] Body preview applies redaction in share mode, leaves raw in local mode.
- [ ] Latency histogram renders for sessions with ≥10 requests.

### H — sharing
- [ ] Webhook URL stored in `context.secrets`, not `settings.json`.
- [ ] Slack Block Kit payload validates against Slack's Block Kit Builder.
- [ ] No auto-post on error: search the codebase for any `onError` → `postWebhook` path; must be zero.

### I — redaction
- [ ] Default rules cover the ten patterns listed in I1.
- [ ] Snapshot test passes: bug report with auth headers exports redacted in share mode, raw in local mode.
- [ ] End-of-session lint warns on unredacted JWTs.

### J — performance
- [ ] Prefix-detection benchmark: <2% overhead on 100K-line file.
- [ ] Memory: 10K events does not exceed 50 MB heap.

---

## Open questions

1. **SDK name.** `saropa_log_capture_flutter` is verbose. `slc_flutter`? `saropa_capture`? Name lock-in matters for pub.dev — decide before B ships.
2. **Cross-session storage location.** Already `.saropa/index/` per existing project index pattern. Verify the schema accommodates event fingerprints without bloat.
3. **F11 baseline definition.** Median of last 10 sessions? Same project + same branch? Same hour-of-day? Too tight = no baseline; too loose = noisy comparison.
4. **Screenshot inline render — workspace-only?** Strict workspace check is safe. Looser path policy (allow any local file referenced by the SDK) is convenient but expands attack surface. Default strict.
5. **F4 false-positive control.** Action-to-error fingerprint will over-fire on chatty apps where one action precedes everything. Need a minimum lift threshold (e.g., action must precede the error at ≥2× its base rate).
6. **Native crashes are out of scope.** Document this explicitly so the next person doesn't try to add `NSException` handling to a Dart-only SDK.

---

## Files touched (anticipated)

This list is anticipatory; concrete file changes will be confirmed per workstream.

- **New files** (extension)
  - `src/modules/timeline/timeline-line-parser.ts`
  - `src/modules/timeline/timeline-event-types.ts`
  - `src/modules/bug-report/bug-report-crash-context.ts`
  - `src/modules/redaction/redaction-engine.ts`
  - `src/modules/redaction/redaction-default-rules.ts`
  - `src/modules/root-cause-hints/signal-crash-precursor.ts`
  - `src/modules/root-cause-hints/signal-nav-thrash.ts`
  - `src/modules/root-cause-hints/signal-network-cluster.ts`
  - `src/modules/root-cause-hints/signal-new-error-type.ts`
  - `src/modules/root-cause-hints/signal-severity-escalation.ts`
  - `src/modules/root-cause-hints/signal-silence-burst.ts`
  - `src/modules/sharing/webhook-secret-storage.ts`
  - `src/modules/sharing/slack-block-kit-formatter.ts`
- **Modified files** (extension)
  - `src/ui/viewer/viewer-data-helpers.ts` — add event-type branches
  - `src/ui/viewer/viewer-scrollbar-minimap-paint.ts` — add event dots
  - `src/ui/panels/viewer-signal-panel.ts` — wire new signals into accordion
  - `src/modules/bug-report/bug-report-formatter.ts` — insert Crash Context section
  - `package.json` — new settings, commands
  - `CHANGELOG.md` — workstream landings
  - `ROADMAP.md` — entries per workstream
- **New repo**
  - Flutter SDK package (separate publish)

---

## Why this plan and not a smaller one

A smaller plan would land just the Crash Context Summary (E1) by parsing existing print statements heuristically. That works, sort of, for apps that already emit structured prints — and gives up on the long tail of apps that don't. Worse, it hard-codes the parser to whatever print format we find today, with no extensibility.

A typed wire format + SDK is more upfront work, but it produces a stable contract that downstream signals and reports can rely on. Once the contract is fixed, each new signal in Workstream F is a small isolated addition — not a parser rewrite.

## Finish Report (2026-06-10) — Fu5 sort toggle (severity ↔ chronological)

This work will be reviewed by another AI.

**Scope:** (B) VS Code extension (TypeScript — Signals panel webview HTML/script/CSS + l10n + test). No Dart/Flutter.

**Context.** Audit confirmed every other quick-win in this plan (Tier 1 Fu7/Fu3/Fu2/Fu4, Tier 2 F10/F9/F14/F7/F8, Tier 3 E3/E4) is already shipped and checked off against live code. The only unbuilt low-cost quick-win was **Fu5**, previously parked under "Skip — save for a cleanup pass." This pass builds it.

**What shipped.** A sort toggle for the "Signals in this log" list, sitting just under the Fu7 time-window chips:
- **Default unchanged:** `signalsInLogSortMode` starts `'severity'`, which keeps the producer's existing (severity-ranked) order — the render path is byte-for-byte the same as before in the default mode.
- **Time mode:** sorts a *copy* of the (already window-filtered) signals ascending by `signalRepTs`; signals with no timestamp sink to the end. Sorting a copy means the cached `signalsInThisLog` array is never mutated.
- **Toggle button** reuses the `.signal-tw-chip` style, carries both localized labels (By severity / By time) as data attributes so the webview script can swap them without a round-trip, and flips `aria-pressed` for assistive tech.

**Files changed:**
- `src/ui/panels/viewer-signal-panel.ts` — toggle button markup (both labels as data attrs).
- `src/ui/panels/viewer-signal-panel-script-part-a.ts` — `signalsInLogSortMode` state.
- `src/ui/panels/viewer-signal-panel-script-part-b.ts` — time-mode sort in `renderSignalsInThisLog`.
- `src/ui/panels/viewer-signal-panel-script-part-d.ts` — toggle click handler.
- `src/ui/viewer-styles/viewer-styles-signal-sections.ts` — `.signal-sort-toggle` layout.
- `src/l10n/strings-viewer-b.ts` — 5 new keys (labels + aria/title).
- `src/test/ui/signal-panel-row-click.test.ts` — 2 new Fu5 cases.
- `CHANGELOG.md` — `[Unreleased]` Changed entry.

**Tests:** `signal-panel-row-click.test.js` → 12 passing (+2 new), including the existing "generated part B + part D parse as valid JS" guard, so the added script is syntactically sound. `npm run check-types` clean; `npm run lint` no warnings on changed files; `npm run compile` passes all verify gates.

**Outstanding:** The rest of plan 052 (Workstreams A–D — wire-format protocol, app-side SDK, structured ingestion, full viewer rendering; plus Fu8 pin-to-collections and the SDK-gated signals F1/F2/F3/F4/F11/F12/F13 and network signals) remains. Plan stays active. On-device (F5) confirmation of the toggle is the user's check.

**Finish report appended:** plans/052_plan-semantic-timeline-capture-and-signal-expansion.md
