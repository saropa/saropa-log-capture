# Plan 054 — App Quality Insights: setup wizard + Crashlytics & Android vitals dashboard (parity + WOW)

## Status: Draft (awaiting scope sign-off)

<!-- Status: Draft → Approved → In progress (Stage N) → Done. Do not start coding until a stage is approved. -->

Goal: bring the extension's Firebase Crashlytics / Android vitals experience up to Android Studio's
**App Quality Insights** quality, then beyond it using advantages a code editor has that the AS panel
and the Play Console web UI do not. Three pillars:

1. **Setup wizard** — replace the cramped CLI-text panel with an AS-grade, sign-in-first onboarding.
2. **Dashboard** — a full editor-tab, 3-pane "App Quality Insights" view with the three AS source
   tabs (unified / Android vitals / Firebase Crashlytics).
3. **WOW** — editor-native features AS/Play Console can't offer (source-linking, git blame, local-log
   correlation, one-click bug reports, symbol-upload detection).

Related: [bug_008](bug_008_crashlytics-enable-default-and-gcloud-path.md) (gcloud PATH + enable-by-default).
This plan's wizard work supersedes the long-term need for the gcloud CLI; bug_008 is the short-term fix.

---

## Reference: the three Android Studio screens (what we're matching)

### Screen A — App Quality Insights › Firebase Crashlytics

- Three source tabs across the top: **App Quality Insights | Android vitals | Firebase Crashlytics**.
- App/variant selector: `app › All: [saropa-mobile] com.saropamobile.app`, plus fatal/non-fatal
  signal toggle buttons.
- Filter bar: **Last 7 days · All versions · All signal states · All devices · All operating systems**,
  Refresh, "Last refreshed: 5 minutes ago".
- **Left pane — issues table** (Issues / Events / Users), ~40 rows, per-row severity glyphs (fatal ⊗,
  non-fatal ⚠, ANR ⏱) and signal glyphs (regressed ↩, fresh ⚡, AI-insight ✨).
- **Middle pane — issue + event detail**: title, 963 events / 319 users, `Variant: All (94 variants)`,
  a custom-key subtitle (`ActivityType.LocalContactUpdated`), "Versions affected: 2025.1120.01 →
  2026.0125.01", Regressed badge, **Close issue**, an event navigator
  (`Event 222158…329742 · View on Firebase ↗` with prev/next), a device/context line
  (`Xiaomi Redmi Note 8 · Android 11 · May 23, 2026 · No data`), and **Stack trace / Keys / Logs** tabs
  with app-vs-framework styled, clickable frames.
- **Right pane — aggregates for the selected issue**: Devices (samsung 37% … "Most affected device"),
  Android Versions (Android 14 25% … "Most affected Android version"), horizontal bars.

### Screen B — App Quality Insights › Android vitals

- Same shell and filter bar (`All visibility` replaces `All signal states`).
- **Left pane**: native crash / ANR clusters (`[libflutter.so] dart::DartEntry::InvokeFunction(…)`,
  `[libisar.so] isar_key_add_long_list_hash`, `MessageQueue.nativePollOnce`, …).
- **Middle pane**: "Versions affected: 2026012501", event nav (`Event apps/c…jY4MGY · View on Android
  Vitals ↗`), device line (`POCO · Android 15.0 (API 35) · …`), **Stack trace** tab showing a **raw,
  unsymbolicated native backtrace**: `"main" tid=1 Native` then `#00 pc 0x… /data/app/…/libapp.so
  (BuildId: 4f1bdaed…)` for frames #00–#31.
- **Right pane**: Devices (Redmi 100%), Android Versions (Android 13 50% / Android 15 50%).

### Screen C — Setup wizard ("Hi, Craig / Select a Google Cloud Project")

- Personalized greeting, one sentence of purpose, **one primary action** ("Select a Google Cloud
  Project"), shows the selected project (`saropa-mobile`), a short note with a learn-more link, and
  **Cancel / Back / Next**. No CLI commands, no raw error text, no PATH instructions. Auth is implicit
  (you're already signed into Google); selecting a project authorizes the needed APIs.

---

## Current state (honest baseline)

### Crashlytics

- A narrow **slide-out sidebar** (`viewer-crashlytics-panel.ts`), icon-bar pattern — not a 3-pane view.
- Issue list is **hard-capped at 5** (`crashlytics-api.ts` → `matchIssues()` `…slice(0, 5)`), though
  `pageSize: 20` is fetched.
- Each row: fatal/non-fatal badge, state badge, title, subtitle, events, users, version range, plus
  **Close / Mute**. Expand a row → fetch one event → `renderCrashDetail()` shows a device-meta line,
  the crash thread (app/fw classified, clickable Dart frames), other threads, a Keys table, Logs
  breadcrumbs.
- **Built but NOT wired into the panel UI:** multi-event paging
  (`CrashlyticsIssueEvents.currentIndex`, events fetched `pageSize=5`) — `renderCrashDetail` only
  renders the single current event, no prev/next navigator. Aggregate device/OS distribution
  (`renderApiDistribution`, `renderDeviceDistribution`, `:getStats` in `crashlytics-stats.ts`) is
  implemented but never called from the panel.
- Filters: time range is a **setting only** (`saropaLogCapture.firebase.timeRange`), no in-UI dropdown;
  version auto-filtered via `detectAppVersion`. No device / OS / signal-state filter UI.

### Android vitals

- `google-play-vitals.ts` queries **only two aggregate rates** (crashRate, anrRate) from the Play
  Developer Reporting `*MetricSet:query` endpoints. It does **not** query per-issue error clusters or
  reports.
- `vitals-panel.ts` renders **two numbers vs thresholds** + "Open Play Console". No issue list, no
  native stack traces, no device/version breakdown.

### Setup wizard

- `viewer-crashlytics-setup.ts` renders a 3-step wizard ("Step N of 3") inside the narrow sidebar:
  Install gcloud CLI (winget command + Copy + download link + PATH caveat) → Sign in
  (`gcloud auth application-default login`) → Add `google-services.json`. It dumps the raw diagnostic
  (`gcloud check failed: Command failed: gcloud --version …`) inline, plus a 3-column
  Symptom/Cause/Fix troubleshooting table and a billing tip. It is dense, CLI-centric, and leads with
  the failure mode that bug_008 documents.

---

## Gap analysis

| Capability | AS | Extension today | Gap |
|---|---|---|---|
| Layout | Full 3-pane editor surface | Narrow slide-out sidebar | **Build editor-tab 3-pane** |
| Source tabs | Unified / Vitals / Crashlytics | Crashlytics sidebar + separate Vitals sidebar | **Unify into tabbed dashboard** |
| Issues shown | All (scrolling) | 5 (hard cap) | Remove cap; paginate to 20+, then page through |
| Filter bar | time/version/device/OS/signal | time = setting only | **Build in-UI filter bar** |
| Event navigator | prev/next sample events | data exists, no UI | **Wire paging UI** |
| Device/OS breakdown pane | yes, per issue | renderers exist, not wired | **Wire `:getStats` into right pane** |
| Crashlytics stack/keys/logs | tabbed | single expanded blob | Restructure into tabs |
| Android vitals issues | native crash/ANR clusters | none (rates only) | **New: Play `errors.issues`/`errors.reports`** |
| Native stack traces | raw `pc/BuildId` frames | none | **New: render + (WOW) symbolicate** |
| Signal glyphs | regressed/fresh/AI | state badge only | Add glyphs |
| Setup wizard | sign-in-first, project picker | CLI-text wall + raw errors | **Redesign (pillar 1)** |

---

## Data / API reality check (verify before promising parity)

Production-quality rule: do not claim pixel/number parity with AS until a live response is captured.
AS and Play Console use privileged data paths; the public APIs may not expose everything.

- **Crashlytics breakdown fidelity — UNVERIFIED.** The right-pane percentages depend on what
  `issues/{id}:getStats` actually returns. `crashlytics-stats.ts` defensively reads several key shapes
  (`deviceStats`/`devices`, `osStats`/`osVersions`) because the real shape isn't confirmed in-repo.
  **Action (Stage 0):** capture one live `:getStats` JSON for a real issue and pin the shape with a
  fixture test before building the pane. If the endpoint doesn't return distributions, the fallback is
  sampled-event aggregation (`renderDeviceDistribution` over `pageSize` events) — which is an estimate
  from N samples, **not** a true aggregate, and must be labeled as such in the UI.
- **"Variants" and "fresh/regressed/AI" signals — UNVERIFIED** in the public response. Only `state`
  (OPEN/CLOSED/REGRESSION) is parsed today. Don't render a glyph we can't source.
- **Android vitals per-issue errors — NEW API SURFACE, scope-gated.** Native clusters/stacks come from
  Play Developer Reporting `vitals.errors.issues.search` + `vitals.errors.reports.search`, which need
  the API enabled and the right OAuth scope (`playdeveloperreporting`). The extension only calls the
  rate metric-sets today. **Action (Stage 0):** confirm the account/scope returns error reports for
  `com.saropamobile.app` before committing to Screen B.
- **Native symbolication — heavy, conditional.** Raw `pc 0x… libapp.so (BuildId: …)` frames are only
  human-readable with the matching native debug symbols (NDK `.so` symbol files / `symbols.zip`) and a
  symbolizer (`ndk-stack` / `llvm-symbolizer`). Treat as an opt-in WOW feature gated on symbol
  availability; never claim symbolicated output when symbols are absent.

---

## Pillar 1 — Setup wizard redesign

Reframe from "install a CLI" to "sign in and pick a project," matching Screen C.

- **Sign-in-first, gcloud-optional.** Add a built-in Google OAuth flow (loopback/browser or device
  code) so the common path needs **no gcloud install and no PATH fixing** — the exact pain in bug_008.
  Keep gcloud ADC and service-account key as fallbacks, not the headline.
  - Blast radius: an OAuth flow likely needs a dependency (e.g. `google-auth-library`, **already a
    dep**, supports OAuth2 + loopback) and a client ID. Confirm we can ship a client ID for an
    installed app, or use the device-code flow. **Needs sign-off** before adding any new dependency.
- **Project picker.** After sign-in, list the user's Firebase/GCP projects and let them pick
  (`saropa-mobile`), then auto-resolve appId from `google-services.json` or list apps. Writes
  `firebase.projectId` / `.appId` for them instead of making them hunt in the console.
- **Errors behind disclosure.** Raw `gcloud check failed…` text moves into a collapsed "Technical
  details"; the wizard body stays friendly. Lead with the next action, not the failure.
- **Friendly shell.** Greeting, one-line purpose, one primary button per step, clear progress, a
  learn-more link. Reuse second-person product voice per `docs/guides/USER_COPY_AND_TONE.md`
  (no "we"/"I").
- Files: rewrite `viewer-crashlytics-setup.ts` + `viewer-styles-crashlytics-setup.ts`; new OAuth module
  under `src/modules/crashlytics/` (e.g. `crashlytics-oauth.ts`); reuse `getAccessToken()` plumbing.

---

## Pillar 2 — App Quality Insights dashboard

A new **editor-tab webview** (`vscode.window.createWebviewPanel`), not the sidebar, so there's room for
3 panes. Three source tabs reusing one shared layout.

- **Shell:** source tabs (Unified / Android vitals / Firebase Crashlytics) + filter bar (time range,
  version, device, OS, signal state) + refresh + last-refreshed.
- **Left pane:** full issues table (severity + signal glyphs, Issues/Events/Users, sortable). Remove
  the `slice(0, 5)` cap; render the fetched 20, with "load more".
- **Middle pane:** issue header (counts, versions-affected, state badge, Close/Mute, "View on
  Firebase/Vitals"), **event navigator** (wire the existing `currentIndex` paging), device/context
  line, and **Stack trace / Keys / Logs** sub-tabs (Crashlytics) or native backtrace (vitals).
- **Right pane:** Devices + Android Versions breakdown bars (wire `:getStats` per Stage-0 finding;
  label estimates if sampled).
- **Android vitals tab (new):** Play `errors.issues`/`errors.reports` → cluster list + native stacks +
  breakdown. Gated on the Stage-0 scope check.
- The existing sidebar stays as a lightweight triage entry point and **opens the full dashboard** — we
  add alongside, we do not remove it (per "never downsize existing features").

---

## Pillar 3 — WOW features (beyond AS / Play Console)

The editor knows the source tree, git, and the live log — AS's panel and the web console do not.

1. **Deep source-linking.** Jump from any frame to the exact `file:line` in the workspace
   (`extractSourceReference` already does this for Dart). For native frames, map BuildId → symbol →
   source. AS only links some frames; we link aggressively and open them in-editor.
2. **Git blame / suspect commit.** For a source-linked frame, show `git blame` of the crashing line and
   correlate "versions affected" → git tags to name the likely-introducing commit.
3. **Local-log correlation (core competency).** Cross-reference a Crashlytics/vitals issue against
   errors in the current session / saved sessions ("this crash matches an error you saw 3 runs ago").
   Nothing else can do this — it's the extension's whole point.
4. **One-click bug report.** "Create bug report" on an issue → generates a pre-filled
   `bugs/bug_NNN_*.md` (title, stack, device/OS breakdown, versions) using the existing bug template.
5. **AI triage.** Build on `crashlytics-ai-summary.ts`: cluster similar issues, summarize root cause,
   propose a fix, draft the report. Matches AS's ✨ insights, in-editor.
6. **Trends & regressions.** Per-issue events sparkline over time, "new since vX", "spiking" badges;
   diff two versions.
7. **Watch & notify.** Status-bar badge + a single gated toast when a new fatal issue appears or an
   issue regresses (per the proactive-next-step UX rule; gate so it never nags).
8. **Symbol-upload detector.** Detect missing mapping / NDK symbol uploads (the usual cause of
   unreadable native stacks like Screen B) and warn with the fix — a pain neither AS nor the console
   surfaces in-editor.
9. **Export / share an issue** as an `.slc` collection (reuse existing share pipeline).

---

## Staged delivery

- **Stage 0 — Verify data (no UI).** Capture live `:getStats`, `topIssues:query`, and Play
  `errors.reports.search` responses; pin shapes with fixtures; confirm scopes. Decides what parity is
  actually achievable. **Gate for everything below.**
- **Stage 1 — Wizard redesign (Pillar 1).** Highest user value, smallest blast radius; fixes the
  bug_008 pain. OAuth sign-in + project picker + errors-behind-disclosure.
- **Stage 2 — Crashlytics dashboard (Pillar 2, Crashlytics tab only).** Editor-tab 3-pane; wire the
  already-built paging + `:getStats`; remove the 5-cap; filter bar.
- **Stage 3 — Android vitals tab.** New Play error-reports API + native stack rendering.
- **Stage 4 — WOW pass.** Source-linking++/git blame, local-log correlation, one-click bug report,
  AI triage, trends, watch/notify, symbol-upload detector.

Each stage ships independently and must be fully stable before the next (per `.claude/rules/global.md`
feature discipline). After approval, add a row to `ROADMAP.md` and link this plan.

---

## Blast radius / risks (needs sign-off before coding)

- **New editor-tab webview** + message catalog entries (run `generate:webview-catalog` /
  `generate:host-outbound-catalog`).
- **New API surface** (Play `vitals.errors.*`) and **possible new OAuth client ID / dependency** for
  in-editor sign-in — both are blast-radius items requiring explicit approval.
- **Native symbolication tooling** (`ndk-stack`/`llvm-symbolizer` + symbol files) — heavy; opt-in only.
- **File-size discipline:** the dashboard will exceed 300-line files; plan module splits up front
  (mirror the `viewer-styles-*` extraction pattern).
- **NLS:** all new strings via `package.nls*.json` across locales.
- **Honesty in UI:** any sampled (non-aggregate) breakdown must be labeled an estimate.

---

## Open decision (for the user)

This is four-plus stages of work touching new webviews, a new API surface, and likely a new auth
dependency. I'm **not** starting any code until you pick the entry point.

**Recommendation: start with Stage 1 (the setup wizard).** It's the thing you called "horrible," it
directly removes the gcloud/PATH pain from bug_008, it's the smallest blast radius, and a clean
sign-in + project picker unblocks every later stage. Stage 0 (verify the APIs) runs alongside it.

Proceed with Stage 1 + Stage 0 next? (Or name a different stage to start with.)
