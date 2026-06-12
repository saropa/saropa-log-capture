# Plan 054 — App Quality Insights: setup wizard + Crashlytics & Android vitals dashboard (parity + WOW)

## Status: In progress — architecture pivoted (see note)

<!-- Status: Draft → Approved → In progress (Stage N) → Done. Do not start coding until a stage is approved. -->

> **Architecture pivot (2026-05-24).** Pillar 2 below describes a separate **editor-tab 3-pane
> dashboard**. That was built, then **deliberately removed** when the user asked "what is the point of
> the dashboard?" The experience is now **consolidated into the log viewer**: the Crashlytics **sidebar**
> is the issue list, and clicking a row opens the issue **detail as a full overlay inside the log
> viewer's main area** (the way a session opens), not a separate tab. Read Pillar 2 as historical
> design; the *live* target is **Stage 5** below (in-viewer dashboard + log-viewer parity). Treat any
> "editor tab" / "3-pane" wording in Pillars 2–3 as superseded by the in-viewer overlay.

Goal: bring the extension's Firebase Crashlytics / Android vitals experience up to Android Studio's
**App Quality Insights** quality, then beyond it using advantages a code editor has that the AS panel
and the Play Console web UI do not. Three pillars:

1. **Setup wizard** — replace the cramped CLI-text panel with an AS-grade, sign-in-first onboarding.
2. **Dashboard** — a full editor-tab, 3-pane "App Quality Insights" view with the three AS source
   tabs (unified / Android vitals / Firebase Crashlytics).
3. **WOW** — editor-native features AS/Play Console can't offer (source-linking, git blame, local-log
   correlation, one-click bug reports, symbol-upload detection).

**Scope boundary — this plan is UI/design only.** Everything about the *data connection* (gcloud
resolution, authentication, the correct API host, OAuth scopes, surfacing failures instead of silent
empties) lives in **[bug_008](history/2026.06/2026.06.02/bug_008_crashlytics-enable-default-and-gcloud-path.md)**. This plan
consumes whatever bug_008's data layer returns and focuses on layout, UX, and features. Two findings
from bug_008 that this plan depends on:

- **The data source is Google Play Developer Reporting (`vitals.errors`), NOT
  `firebasecrashlytics.googleapis.com`** — the latter's read endpoint returns a frontend HTML 404 and
  is not a public API (verified). So both the "Firebase Crashlytics" and "Android vitals" tabs draw
  from the same Play Reporting host; the dashboard's three-tab framing is a UI grouping, not three
  separate APIs.
- **Auth needs the `playdeveloperreporting` scope** and the dashboard must render error/empty states
  distinctly (no silent "no crashes" when the call actually failed).

Do not start dashboard coding until bug_008's W3 (re-point to Play Reporting) lands — there is no
working issue feed before then.

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
| Device/OS breakdown pane | yes, per issue | renderers exist (built on dead API) | **Feed right pane from Play Reporting error counts** |
| Crashlytics stack/keys/logs | tabbed | single expanded blob | Restructure into tabs |
| Android vitals issues | native crash/ANR clusters | none (rates only) | **New: Play `errors.issues`/`errors.reports`** |
| Native stack traces | raw `pc/BuildId` frames | none | **New: render + (WOW) symbolicate** |
| Signal glyphs | regressed/fresh/AI | state badge only | Add glyphs |
| Setup wizard | sign-in-first, project picker | CLI-text wall + raw errors | **Redesign (pillar 1)** |

---

## Data / API reality check (verify before promising parity)

Production-quality rule: do not claim pixel/number parity with AS until a live response is captured.
AS and Play Console use privileged data paths; the public APIs may not expose everything. **Full
connection findings are in [bug_008](history/2026.06/2026.06.02/bug_008_crashlytics-enable-default-and-gcloud-path.md); the key
ones that shape this design:**

- **The Firebase Crashlytics read endpoint is dead — do NOT design against it.** VERIFIED:
  `firebasecrashlytics.googleapis.com/.../topIssues:query` returns a Google frontend HTML 404; it is
  not a public API. The current `crashlytics-api.ts` / `crashlytics-stats.ts` (incl. `:getStats`) are
  built on it and will never return data. **The dashboard's data source is Google Play Developer
  Reporting `vitals.errors`** (`errorIssues:search`, `errorReports:search`, the error count metric
  set). Both UI tabs ("Crashlytics" and "Android vitals") draw from this one host.
- **Breakdown fidelity — re-scope to the Play Reporting response.** Device/OS percentages and trends
  should come from the Play Reporting error count **metric set** (dimensioned by device/version), not
  the dead `:getStats`. Capture one live response post-scope-fix and pin the shape before building the
  right pane. If a needed dimension isn't returned, aggregate from the sampled `errorReports` and
  **label it an estimate** in the UI — never present a sample as a true aggregate.
- **"Variants" and "fresh/regressed" signals — verify in the Play Reporting response** before
  rendering a glyph. Don't show a signal we can't source.
- **Scope + access gating (VERIFIED).** `vitals.errors` needs the `playdeveloperreporting` OAuth scope
  (the default ADC token returns 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT) and a Play Console-linked
  account; the API may also need enabling on the project. Handled in bug_008 (W4); the dashboard must
  render those failure states distinctly, not as empty.
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
- **Right pane:** Devices + Android Versions breakdown bars (from the Play Reporting error count
  metric set per Stage-0 finding; label estimates if sampled).
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

- **Stage 0 — Re-point to the real API + verify data (bug_008 W3/W4, no UI).** Replace the dead
  `firebasecrashlytics` endpoints with Play Reporting `vitals.errors` (`errorIssues:search`,
  `errorReports:search`, error count metric set); add the `playdeveloperreporting` scope; capture live
  responses and pin shapes with fixtures. Decides what parity is achievable. **Gate for everything
  below — there is no issue feed until this lands.**
- **Stage 1 — Wizard redesign (Pillar 1).** Highest user value, smallest blast radius; fixes the
  bug_008 pain. (Wizard UI shipped; OAuth sign-in + project picker still pending.)
- **Stage 2 — Issues dashboard (Pillar 2).** Editor-tab 3-pane over the Play Reporting feed; issue
  list with paging (remove the 5-issue cap), event navigator, breakdown pane from the count metric
  set; filter bar.
- **Stage 3 — Native vitals + stacks.** `errorReports` native stack rendering (the `pc/BuildId`
  frames) on top of Stage 2.
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

---

## User polish/feature roadmap (added 2026-05-24)

After the consolidation into the viewer, the user listed 10 improvements. Status:

**Functionality / UX**
1. Interactive stack traces (jump to code) — **DONE**: app frames in the detail open the file at the line.
2. Automatic symbolication / de-obfuscation (ProGuard/R8, dSYM, Flutter symbols) — **BIG, still open — NOT
   started in code.** A verifiable implementation is blocked on artifacts the extension does not have:
   the build's symbol files (`flutter build` `--split-debug-info` ELF symbols, Android NDK `.so` debug
   `.sym`, or the R8 `mapping.txt`) plus a symbolizer binary (`flutter symbolize`, `ndk-stack`,
   `llvm-symbolizer`, ProGuard `retrace`). Without those present in the workspace there is literally
   nothing to resolve obfuscated frames against, and any "symbolicated" output would be fabricated.
   Honest next step is a *detection + guidance* layer (flag obfuscated frames, point the user at the
   symbol artifacts / upload step) — that is a separate, smaller piece and must not be sold as
   symbolication. Never claim symbolicated output without the symbols.
3. Advanced search — **regex DONE** (`.*` toggle in the sidebar filter, invalid-pattern outline,
   non-blanking on partial patterns). Type tabs + plain search + single-select version/device/OS also
   present. Open: date-time range, multi-select.
4. Issue-tracker integration ("Create Issue" → GitHub) — **DONE**: detail header "Create issue" opens a
   prefilled GitHub new-issue page (title + crash Markdown body) using the workspace origin remote slug;
   warns when no GitHub remote. Jira/Linear not wired.
5. Smart grouping / dedup — **already provided by the Play API** (issues are pre-clustered). No custom
   clustering needed unless we want cross-issue merging.

**UI / aesthetics**
1. Modernize distribution charts (rounded, gradient, accent) — **DONE** (rounded + gradient bars).
2. Pill badges with soft tints + icons — **DONE** (⊗/⏱/⚠ pills via theme tokens).
3. Native theme-token compliance — **DONE for the new surfaces** (badges/bars/detail use `--vscode-*`).
   Sweep: a few legacy hex values remain in older crashlytics styles.
4. Syntax highlighting + smart noise collapse (collapse framework, keep app frames open) — **DONE.**
   `renderSmartFrameSection` (crashlytics only; the analysis panel keeps flat `renderFrameSection`) keeps
   app frames inline + clickable and folds runs of >2 consecutive framework frames into a quiet dashed
   `<details>` (`.cd-fw-group`) the reader expands on demand.
5. Typography / spacing hierarchy — **DONE** for the sidebar list; detail spacing can be tuned further.

---

## Stage 5 — in-viewer dashboard + log-viewer parity (added 2026-05-24)

This stage replaces the obsolete editor-tab Pillar 2 with the *consolidated* target: turn the in-viewer
issue **detail overlay** into a dashboard-grade surface, and pull the proven log-viewer ergonomics into
it. Six user directives (2026-05-24), grouped by size/risk.

### 5a — Dashboard-grade detail (bounded, low risk) — IN PROGRESS

- **Stats strip (#4).** Render the issue's name, severity, event count, user count, state, and version
  range as a row of dashboard **stat cards** at the top of the detail body. The data already lives on
  the clicked row's `data-*` (and in the copy-Markdown), it was just never *rendered* in the detail —
  only the title showed. `renderStatsStrip(meta)` in `crashlytics-detail-handler.ts`.
- **Online console link (#3).** Surface the Firebase Crashlytics console URL as a "View on Firebase ↗"
  link in the detail header. The base is built in `firebase-crashlytics.ts` and sent to the webview as
  `ctx.consoleUrl`.
  - **Correction (2026-06-12).** Two earlier claims here were wrong:
    1. The base URL used `…/crashlytics/app/{appId}/issues` with the Firebase **mobilesdk_app_id**
       (`1:NNN:android:HEX`). The console rejects that with *"This app does not exist or you do not have
       permission."* The `app/` segment must be the platform-prefixed package name
       (`android:com.example.app`). **Fixed** — `getFirebaseContext` now builds it from
       `detectPackageName()`.
    2. *"Play Reporting issue IDs do not map to Firebase per-issue console URLs"* was **false** (asserted
       without checking). Verified against the live local cache (`.saropa/cache/crashlytics/issues.json`):
       our Play Reporting issue ids are 32-char hex (e.g. `7e7936dad4cdb0a53859be193b898e81`) — the same
       namespace as the Firebase console issue id in `…/issues/{hex}`. So the arrow now **deep-links to
       the exact issue**: `issueConsoleUrl()` in `crashlytics-detail-handler.ts` appends the issue hex
       (`issueShortId`) to the per-app base. (This means the host DOES append the id — the old "we do not
       re-build host-side" note is superseded.)
- **Distinct-panel look (#5, first slice).** Style the stat strip as cards and keep the existing
  `<details class="group">` sections (stack / distribution / keys / logs) as labeled panels, so the
  detail reads as a dashboard rather than one scroll. Full multi-column layout is 5c.

### 5b — Log-viewer parity in the detail (#1) — OPEN

Borrow the log viewer's ergonomics for the stack/detail (each is a separate, independently shippable
slice; none needs the dead API):

- **Line numbers** on stack frames — **DONE** (`#0…#n` gutter via `renderFrame` index, smart variant only).
- **Clipboard copy** per frame — **DONE** (hover `⧉` copy button per frame; whole-issue Copy-as-Markdown
  already existed).
- **Filtering** inside the stack — **DONE** ("App frames only" toggle hides framework frames + folded
  groups via a body class; `.cd-appcode-only`).
- **Context menus** on frames — **DONE** (right-click popover with Copy frame, Copy file path, Open
  file, Create issue from frame; path/open hidden when the frame has no source ref).
- **Groupings** — smart framework-frame fold + **repeated-frame collapse DONE** (2026-06-10; identical
  consecutive frames render as one row with a ↻×N badge) + **"other threads" grouping DONE** (2026-06-10;
  the Other Threads panel collapses non-crash threads with identical stacks into one ×N row — see Finish
  Reports).

### 5c — Clever project integration (#2) — user picked ALL FOUR (2026-05-24 steer)

The editor has what AS / Play Console do not: the working tree, git history, the changelog, and the
live/saved logs. User approved all four candidates, **with an added headline**: surface git history AND
the **CHANGELOG for the affected release and SINCE then** — *"this could have already been fixed."*
That "may already be fixed" signal is the standout. Build order (boundedness × value):

- **5c-1 "May already be fixed" + recent changes (HEADLINE) — DOING NOW.** For the crashing file +
  the issue's affected version range (`firstVersion`→`lastVersion`): (a) `git log` of recent commits
  touching the file; (b) parse the workspace `CHANGELOG*.md` (root; reverse-chron `## [x.y.z]`/`## x.y.z`
  headings) and list versions **at/after** the affected version; (c) if either shows changes after the
  affected version, render a **"⚠ Changed since the affected version — may already be fixed"** banner.
  Honest fallbacks: if the affected version isn't found in the changelog, say so; git/IO best-effort.
  Pure parsing (`parseChangelogVersions`, `changelogSince`) is unit-tested.
- **5c-2 Nearby annotations — DOING NOW (cheap).** Surface `TODO`/`FIXME`/`BUG` near the crash line
  (the workspace analyzer already finds these for the frame mini-analysis).
- **5c-3 Related issues / PRs — DONE.** Reuses `github-context.ts` (`getGitHubContext`) keyed off the
  crashing file + error tokens (from the issue title); PRs touching the file + matching issues render
  as clickable links in the panel. Best-effort (needs `gh`); degrades to nothing if absent.
- **5c-4 Local-log correlation — DONE.** Derives a distinctive token from the crash title
  (`crashSignatureToken`, exception class preferred), searches the user's captured log sessions via the
  existing `searchLogFiles`, and renders a "Seen in your captured logs" panel; each match deep-links to
  that session's log at the line (`openLogLine`). Best-effort; one representative line per session,
  recent-first, capped at 5. Pure token extractor is unit-tested.
- **Open diff / file history** from a frame folds into 5b's context-menu actions.

### 5d — Full dashboard layout (#5, full) — DONE

The detail body (`.cd-body`) is now a responsive CSS grid (`repeat(auto-fit, minmax(300px, 1fr))`).
Small data panels (`.cd-tile`: device/aggregate distribution, keys, logs, other threads, "In your
project", "Seen in your logs") render as cards and tile into columns; the stack, stats strip, device
line, and thread headers span the full width. Collapses to one column on a narrow overlay; streamed-in
panels slot into the grid as they arrive. `.cd-body > .group` gets the card chrome (border, radius,
widget background).

### Sequencing recommendation

5a now (bounded, lands immediately) → then a steer on 5c (which integration ideas) and 5d (layout
direction) → then 5b slices (log-viewer parity) one at a time. 5a is in this pass; 5b–5d await the
steer to avoid building the wrong interpretation of "clever" / "dashboard."

## Finish Report (2026-06-10) — Stage 5b repeated-frame collapse

This work will be reviewed by another AI.

**Scope:** (B) VS Code extension (TypeScript — crash-detail stack renderer + CSS + test). No Dart/Flutter.

**Context.** Stage 5 is largely shipped (5a stats strip / console link, 5c-1..5c-4 project integration, 5d dashboard grid, most of 5b's log-viewer-parity slices). The one explicitly-open 5b grouping item that's bounded and additive was **repeated-frame collapse**; this pass builds it. ("Other threads" grouping and symbolication remain open and larger.)

**What shipped.** `renderSmartFrameSection` (the crashlytics smart stack) now pre-folds runs of identical consecutive frames before the existing framework-run fold:
- New `collapseRepeats(frames)` turns consecutive same-`text` frames into `{frame, count, index}` units. The original first-frame index is preserved for the `#N` gutter.
- The app/framework rendering loop runs over units. A unit with `count > 1` renders the frame once plus a **↻ ×N** badge (`renderFrame`'s new `repeatCount` param). A 4,000-frame self-recursion becomes one row + "↻ ×4000" instead of 4,000 identical lines.
- The framework-run `<details>` summary now reports the **true** frame total (`frameTotal`, summing unit counts), and the section header still shows the original `frames.length` — the collapse never lies about how deep the stack was.
- Purely additive: distinct frames are unaffected (no badge); the framework fold, app-only toggle, per-frame copy, and clickable app frames all behave as before.

**Files changed:**
- `src/ui/analysis/analysis-frame-render.ts` — `collapseRepeats`, `FrameRun`, unit-based loop, `renderFrame` repeat badge, `renderFwRun` true-total summary.
- `src/ui/viewer-styles/viewer-styles-crashlytics.ts` — `.frame-repeat` badge style (theme tokens).
- `src/test/ui/analysis/analysis-smart-frame.test.ts` — 3 new cases (collapse + honest total, no-badge for distinct, fw-run collapse).
- `CHANGELOG.md` — `[Unreleased]` Changed entry.

**Tests:** `analysis-smart-frame.test.js` → 8 passing (+3 new; the 5 pre-existing fold/count tests still pass, confirming no regression to the framework-fold behavior). `npm run check-types` clean; `npm run lint` no warnings on changed files; `npm run compile` passes all verify gates.

**Outstanding (plan stays active):** Stage 5b "other threads" grouping; roadmap #2 symbolication (BIG, blocked on absent symbol artifacts — honest detection/guidance layer is the next step, not symbolication); date-time range + multi-select search; the legacy-hex theme-token sweep in older crashlytics styles. On-device (F5) confirmation of the badge rendering on a real recursive crash is the user's check.

**Finish report appended:** plans/054_plan-app-quality-insights.md

## Stage 6 — Aggregate-dashboard parity from data we already have (added 2026-06-12)

**Why this stage exists.** A side-by-side of our Crashlytics surface vs. the Firebase web console showed
the two solve different halves of the same problem: theirs is an **aggregate health dashboard**
(crash-free %, trends over time, regression signals, sorting); ours is a **deep single-crash inspector**
(913-frame native stack, app/fw split, per-thread grouping, in-editor source-linking). The honest gaps
in ours are the time dimension and the fleet-wide rollup. This stage closes the ones that are reachable
**without any new API surface or auth work** — the data is already fetched-and-discarded or already on
the issue object. Verified by reading the data layer (`google-play-vitals.ts`, `play-reporting-*.ts`,
`crashlytics-io.ts`, `viewer-crashlytics-panel.ts`), not assumed.

This supersedes the vague "Trends & regressions" line in Pillar 3 #6 with code-grounded, separately
shippable slices, and **resolves the open caveat** in the "Data / API reality check" above ("verify
fresh/regressed in the Play Reporting response before rendering a glyph") — by sourcing those signals
**from our own local archive instead of the API**, which the API genuinely does not provide.

### 6a — App-level trend sparkline (cheapest; zero new API calls)

The vitals query already pulls a **daily time series and throws all but the last row away**:
`queryMetricSet` in `google-play-vitals.ts` requests `aggregationPeriod: 'DAILY'` over a 7-day window,
then `extractLatestRate` reads only `rows[rows.length - 1]`. Keep the full `rows[]` on `VitalsSnapshot`
(add `crashRateSeries` / `anrRateSeries: number[]`) and draw an inline SVG/CSS sparkline in
`vitals-panel.ts` (`renderMetric`). No new request, no new scope. This is the highest wow-per-effort item.

### 6b — Crash-free % reframe (display-only)

`VitalsSnapshot` already carries `crashRate`. Firebase's headline "crash-free sessions %" is
`100 − crashRate`. Reframe `renderMetric` to show "Crash-free: 98.8%" with the period delta (derivable
once 6a keeps the series). **Honest limit:** Firebase's *crash-free **users*** uses a distinct-user
denominator, not the session-based crash rate — exact parity needs the user-perceived metric added to
the query (small change). Ship the free "crash-free sessions" framing first; label it as sessions, not
users, so we never present one as the other.

### 6c — Issue-list sorting (pure client-side)

The list arrives pre-sorted server-side (`fetchPlayErrorIssues` hardcodes `orderBy=errorReportCount
desc`). Every row already emits `data-events` and `data-users` (`renderIssue` in
`viewer-crashlytics-panel.ts`), and each `CrashlyticsIssue` carries both counts. Add a sort control
(Events / Users) to the existing `cp-filterbar` next to the version/device/OS selects; sort the rows in
JS. No new fetch, no data gap.

### 6d — Regressed / Repetitive tags from the local archive (the corrected "impossible")

The Play Reporting API has no open/closed/regression state — `mapErrorIssue` is the single site that
hardcodes `state: 'UNKNOWN'`, and `renderIssue` already emits a `state` badge whenever
`state !== 'UNKNOWN'` (the slot is wired and dormant). The first read of this plan called these tags
impossible. That was wrong: **`crashlytics-io.ts` keeps a local archive** of issue snapshots, so the
signals are derivable locally — for two of the three Firebase tags.

- **Repetitive — derivable NOW, no cache change.** A single snapshot already proves it: an issue whose
  `firstVersion ≠ lastVersion` spanning multiple releases is recurring. Set a repetitive flag in the
  local-derivation pass and render the dormant badge.
- **Regressed — derivable WITH a snapshot history.** Today `writeCachedIssues` **overwrites**
  `issues.json` on every refresh (one snapshot on disk, stamped `cachedAt`). Regression detection needs
  ≥2 snapshots to compare: an issue absent/near-zero in an older snapshot but present/spiking now.
  Change the cache from single-overwrite to a **timestamped, retention-bounded history**
  (`issues-{cachedAt}.json` or an append log), then diff by issue `id` and set `state: 'REGRESSION'`.
- **Early crashes — NOT derivable (now VERIFIED against the schema, not assumed).** This is per-event
  *session-lifecycle* position (crash in the first second of the session), which Firebase computes from
  SDK session timing. Verified 2026-06-12 against the official Play Reporting `ErrorReport` discovery
  schema (`vitals.errors.reports#ErrorReport`): the returned fields are `name`, `type`, `reportText`,
  `issue`, `eventTime` (hour-level only), `deviceModel`, `osVersion`, `appVersion`, `vcsInformation` —
  **no time-since-session-start / session-duration field**, and no such filter dimension either. So the
  "Early crashes" badge cannot be sourced. Out of scope; do not fake it. *(This bullet originally
  asserted "not derivable" without reading the schema — the schema read confirms the conclusion but the
  earlier version was an unverified guess; corrected per the no-blocker-without-analysis rule.)*
- **Device states (foreground/background) — derivable, newly found in the same schema read.** The
  `vitals.errors.reports/search` and `errorCountMetricSet` surfaces expose `appProcessState`
  (`FOREGROUND` / `BACKGROUND`) and `isUserPerceived` as filter/dimension fields. That is the "Device
  states · % background" panel in the Firebase issue detail. It is buildable the **same way** as the
  device/OS breakdown (add `appProcessState` as an `errorCountMetricSet` grouping dimension — see
  `play-reporting-metrics.ts` `queryDimension`). Distinct from "Early crashes" (process state ≠ session
  timing); this one we can source, so it is a candidate panel, not a blocked one.

Derivation runs host-side (where the archive lives), setting `state` / a repetitive flag on
`CrashlyticsIssue` before it reaches the webview — `mapErrorIssue` stays the API mapper; a new local
pass (e.g. `crashlytics-issue-signals.ts`) layers the derived signals on top. Never render a signal we
can't source: Repetitive and Regressed yes (sourced locally), Early no.

### 6e — Background new-issue detection + alert (no manual panel open)

**Motivation.** Firebase already emails a "Trending stability issues" digest ("Issues rapidly gaining
momentum") so the developer learns about a spiking crash without opening any dashboard. We can do the
same in-IDE — and better, because we hold the prior scans locally and never need a manual click into the
Crashlytics panel.

**What exists vs. what's missing (verified).** There is already a periodic refresh
(`startCrashlyticsAutoRefresh` in `crashlytics-handlers.ts`, on `saropaLogCapture.firebase.refreshInterval`,
default 300s), but it takes a `PostFn` that posts into the **webview** — it only runs while the panel is
open, and its only output is re-rendering the open list. There is **no host-side, panel-independent scan
and no notification path.** That's the gap.

**Design.**
- A host-side **watcher** registered at activation (not webview-coupled), reusing `fetchPlayErrorIssues`
  on the same interval setting, that runs whenever auth is configured — independent of whether the panel
  is open.
- Diff the fresh result against the **prior local snapshot** (`readCachedIssues()` — the 6d archive):
  *new* = issue `id` present now, absent before; *regressed/spiking* reuses the 6d comparison. This is
  the same diff machinery 6d builds, so 6e should land on top of 6d, not duplicate it.
- On a new/regressed issue, fire a **single gated `vscode.window.showInformationMessage`** (toast) with a
  "View in Crashlytics" action that opens the panel to that issue, plus a **status-bar badge** with the
  new-issue count. Gate per issue `id` so the same crash never re-alerts (per the proactive-next-step UX
  rule — offer once, never nag).
- New setting `saropaLogCapture.firebase.notifyNewIssues` (default off until the signal proves itself,
  per the signals-stay-passive house rule) + reuse `refreshInterval` for cadence. **Honest limits:** the
  watcher needs auth/scope already set up (stays silent otherwise — no nag); cadence is bounded by the
  Play Reporting freshness window (it is not real-time), so "rapidly gaining momentum" means
  "since the last scan," not live.
- **Archived issues (6f) must not re-alert** — the watcher consults the archive set before firing.

### 6f — Local archive / unarchive of issues

**Why local.** The data source (Play Reporting) is **read-only** — this is exactly why the old
Close/Mute buttons were removed (they were upstream no-ops; see the comment in `renderIssue`,
`viewer-crashlytics-panel.ts`). A **local** archive restores a real, useful action without pretending to
write to Firebase: "I've triaged this; hide it and stop alerting me," reversible via unarchive.

**Design (mirrors the existing signal-triage store).** The signals panel already persists per-item
triage state locally (`error-status-store.ts`, `setErrorStatus`/`getErrorStatusBatch`, open/muted). Reuse
that pattern: a persisted set of archived issue `id`s in `.saropa/cache/crashlytics/` (e.g.
`archived.json`), written through `crashlytics-io.ts` alongside the snapshot cache.
- **List behavior:** archived issues are filtered out of the sidebar by default; a **"Show archived"**
  toggle in `cp-filterbar` reveals them (greyed/badged) with an **Unarchive** action per row.
- **Actions:** archive from an issue row / the detail header; unarchive from the archived view. Both emit
  a visible confirmation toast naming the issue (per the UX "name the thing" rule), never a silent state
  flip.
- **Interaction with 6e:** archive = "don't tell me again." The watcher skips archived ids; unarchiving
  re-enables alerting for that id.
- **Honest scope:** this is local-only state — it does not close the issue in Firebase/Play, and a
  fresh-clone/another-machine won't see it (it lives in the workspace cache). Label it as a local view
  filter, not an upstream resolution.

### Feasibility summary (verified against code, 2026-06-12)

| Item | Feasible? | Cost | Evidence |
|---|---|---|---|
| 6a app-level sparkline | Yes | Zero new fetch — daily rows already discarded | `google-play-vitals.ts` `extractLatestRate` reads only the last row |
| 6b crash-free % (sessions) | Yes | Display reframe | `crashRate` already on `VitalsSnapshot` |
| 6c sorting | Yes | Pure client-side JS | `data-events`/`data-users` already on every row |
| 6d Repetitive tag | Yes, now | Single-snapshot derivation | `firstVersion`/`lastVersion` on `CrashlyticsIssue` |
| 6d Regressed tag | Yes | Overwrite→history cache change + diff | `crashlytics-io.ts` `writeCachedIssues` currently overwrites |
| 6b crash-free *users* (exact) | Yes | Small query addition | distinct-user metric not yet queried |
| 6d Early-crashes tag | **No** | — | Session-lifecycle data absent from `errorReports` + archive |
| 6e background new-issue alert | Yes | Host-side watcher + diff vs. archive + toast/badge | Existing refresh is webview-coupled (`startCrashlyticsAutoRefresh`); no host-side scan/notify path yet |
| 6f local archive / unarchive | Yes | Local id set + list filter + toggle | `error-status-store.ts` is the proven local-triage pattern; API is read-only |
| Real per-issue trend column | Yes (later) | One new DAILY `errorCountMetricSet` query | `play-reporting-metrics.ts` already does the grouped-by-issue shape |

### Sequencing

6a → 6b → 6c are independent, additive, and need no API/auth work — ship in any order. 6d Repetitive
ships with them (single-snapshot). 6d Regressed is the one notch up (the cache-history change) and
should land last among the data-derivation slices. **6e (background alert) depends on 6d's snapshot
history** — it reuses the same diff — so it follows 6d Regressed. **6f (local archive) is independent**
and can ship any time, but 6e must respect 6f's archived set, so if both are planned, land 6f first so
the watcher has an archive to consult. The per-issue trend column (last table row) needs a real new
query and belongs after 6a proves the sparkline rendering.

### Stage 6 build log

- **6a app-level sparkline — DONE (2026-06-12).** See "Finish Report (2026-06-12) — Stage 6a" below.
- **6b crash-free % headline — DONE (2026-06-12).** Headline "Crash-free sessions" (100 − crashRate) + period-delta arrow added above the rate cards in `vitals-panel.ts`; rate cards retained. Hardcoded English per the file's existing convention (panel has no `t()`; full l10n retrofit is separate). Display-only arithmetic; the delta-sign invariant (rising crash-free = falling rate = good) is commented at `renderCrashFree`. Crash-free *users* exact parity is deferred to T3.3.
- **6c issue-list sorting — DONE (2026-06-12).** A `#cp-sort` select (Most events / Most users) in the filter bar; `applyCpSort()` reorders the `.cp-item` rows by `data-events`/`data-users` desc (no new fetch — the counts are already on every row). New runtime l10n keys `viewer.crashlytics.sort.{label,events,users}` in `strings-viewer-c.ts`. No unit test: the sort is DOM reordering in the webview template and there is no jsdom harness; the sibling filters (search/version/device/OS) are likewise manual/F5-verified. Compile + all verify gates clean.
- **6d Repetitive tag — DONE (2026-06-12).** New pure module `crashlytics-issue-signals.ts` (`isRepetitive` / `deriveIssueSignals`) layers a `repetitive` flag (firstVersion ≠ lastVersion) onto issues right after `queryTopIssues`, leaving `mapErrorIssue` as the API mapper. `repetitive` added to `CrashlyticsIssue`, the serializer whitelist, and a "Repetitive" list badge (l10n `viewer.crashlytics.badge.repetitive{,Tip}`, `.cp-badge-repetitive` CSS). 4 `node:test` cases pin the version-span logic + no-mutation. T2.2 Regressed will extend this module with snapshot-history diffing. (Note: `kind` is absent from the serializer whitelist — a pre-existing, unrelated gap left untouched.)
- **Snapshot history cache (T2.1) — DONE (2026-06-12).** Replaces the single-overwrite limitation: `recordIssueSnapshot` now appends a compact `{cachedAt, issues:[{id,eventCount}]}` snapshot to `.saropa/cache/crashlytics/issues-history.json` on every fresh fetch (`crashlytics-api.ts` line 78), retaining up to 30 distinct states. Pure shaper `crashlytics-issue-history.ts` (`toSnapshot` / `appendSnapshot`) collapses consecutive identical id-sets (rapid refreshes don't flood) and caps oldest-first; I/O (`readIssueHistory` / `recordIssueSnapshot`) lives in `crashlytics-io.ts`. The existing `issues.json` latest-snapshot offline cache is untouched. 4 `node:test` cases. No user-facing change yet — this is the baseline consumed by Regressed and the background alert.
- **Local archive / unarchive (T2.4) — DONE (2026-06-12).** Persisted archived-id set in `.saropa/cache/crashlytics/archived.json` (`readArchivedIds` / `setIssueArchived` in `crashlytics-io.ts`; pure `toggleArchivedId` in new vscode-free `crashlytics-archive.ts`, 2 `node:test` cases). Each issue row gets an archive/unarchive button; a "Show archived" filter-bar toggle reveals archived rows (hidden by default); `serializeContext` marks each issue `archived` from the set. New message `crashlyticsArchiveIssue` (catalog regenerated) → `handleCrashlyticsArchive` writes the set, shows a toast naming the issue, re-fetches. The T2.3 watcher now skips archived ids. New l10n `viewer.crashlytics.{archive,unarchive,showArchived}` + host `msg.crashlytics{Archived,Unarchived}`; `.cp-archive-btn` / `.cp-item-archived` CSS. Local-only (does not close the issue upstream).
- **Background new-issue / regression alert (T2.3) — DONE (2026-06-12).** New host-side `CrashlyticsWatcher` (`crashlytics-watcher.ts`), registered in `setupWebviewProviders`, polls on `firebase.refreshInterval` only when `firebase.notifyNewIssues` (new setting, default off) is on — independent of the panel being open. Each scan calls `getFirebaseContext` (records a snapshot), reads the history, and uses the pure `selectAlerts(history, alreadyAlerted)` to pick genuinely-new/returned ids, gated per-id via `workspaceState` (a vanished id is pruned so its return re-alerts). Fires a toast (with a **View** action revealing the log viewer) + a status-bar badge. New pure helpers `newSinceLastSnapshot` / `selectAlerts` (4 `node:test` cases, 11 total in the history suite). New host l10n `msg.crashlyticsNewIssues{,Tip}` + `action.view`; new setting NLS keys added to all 11 `package.nls*.json` (parity) + coverage data regenerated. The watcher class itself (timer/toast/status-bar glue) is vscode-coupled and not unit-tested; its decision logic is. **T2.4 will add the archived-id skip.**
- **Regressed tag (T2.2) — DONE (2026-06-12).** `detectRegressedIds(history)` (in `crashlytics-issue-signals.ts`) flags ids present now, absent in the previous snapshot, and present in some earlier one (needs ≥3 distinct states). `deriveIssueSignals` now takes the history and sets a `regressed` flag; `getFirebaseContext` reads the history (`readIssueHistory`) and passes it. New `regressed` field on `CrashlyticsIssue` + serializer; a "Regressed" list badge reusing the pre-existing `.cp-badge-regressed` CSS (l10n `viewer.crashlytics.badge.regressed{,Tip}`). Uses a dedicated flag rather than overloading `state` to `REGRESSION` — honest about it being locally derived, not API-reported (deviates from the original 6d note, which suggested `state='REGRESSION'`). 3 new `node:test` cases (7 total in the signals suite).

## Finish Report (2026-06-12) — Stage 6a app-level trend sparkline

This work will be reviewed by another AI.

**Scope:** (B) VS Code extension (TypeScript — Vitals data layer + panel render + a new pure module + node test). No Dart/Flutter.

**What shipped.** The Google Play Vitals query (`google-play-vitals.ts`) requests a `DAILY` time series but previously kept only the last row (`extractLatestRate`), discarding the rest. It now also keeps the full daily series: a new `rowRate` helper reads one row's percent, `extractLatestRate` reuses it, and a new `extractSeries` maps every row (dropping non-numeric ones). `VitalsSnapshot` gained `crashRateSeries` / `anrRateSeries` (oldest→newest, percent). The Vitals panel renders a trend line beneath each metric's number.

**Reuse decision.** The SVG sparkline math was extracted into a new vscode-free module `src/ui/panels/vitals-sparkline.ts` (`renderSparkline(series, width?, height?)`) rather than inlined in the panel, because the per-issue trend mini-chart (Stage 6 / T3.1) needs the identical renderer. Keeping it vscode-free makes it unit-testable under `node --test`. Convention: oldest→newest, higher value = higher line (y inverted), stretched to the box via `preserveAspectRatio="none"`, color via `currentColor` so the caller's good/bad CSS class colors it.

**Files changed:**
- `src/modules/crashlytics/google-play-vitals-types.ts` — `crashRateSeries` / `anrRateSeries` on `VitalsSnapshot`.
- `src/modules/crashlytics/google-play-vitals.ts` — `rowRate`, `extractSeries`, set series on the snapshot, import `VitalsRow`.
- `src/ui/panels/vitals-sparkline.ts` — NEW pure renderer.
- `src/ui/panels/vitals-panel.ts` — import + render the sparkline; sparkline CSS (`.vt-spark` + good/bad color).
- `src/test/ui/panels/vitals-sparkline.test.ts` — NEW `node:test` (4 cases).
- `CHANGELOG.md` — `[Unreleased]` Added entry.

**Tests:** `node --test out/test/ui/panels/vitals-sparkline.test.js` → 4 passing (empty for <2 points, one point per value, y-inversion, flat-series no divide-by-zero). Test audit: grep of `src/test` for `vitals` / `VitalsSnapshot` / `extractLatestRate` / `renderMetric` / `crashRate` / `anrRate` returned no existing references — nothing to repair. `npm run check-types` clean; `npm run compile-tests` clean.

**Outstanding:** none for 6a. On-device (F5) confirmation of the rendered sparkline against a real multi-day Vitals response is the user's check.

**Finish report appended:** plans/054_plan-app-quality-insights.md

## Finish Report (2026-06-10) — Stage 5b "other threads" grouping

This work will be reviewed by another AI.

**Scope:** (B) VS Code extension (TypeScript — pure grouping module + crash-detail renderer + CSS in both style surfaces + test). No Dart/Flutter app code.

**Context.** This closes the last explicitly-open 5b grouping item. The crash detail already had an "Other Threads" panel, but it (a) listed only threads that contained app frames, hiding the native/waiting threads entirely, and (b) rendered each thread separately, so a real 60-thread dump of identical binder/pool/GC waiters was a wall of duplicates. Symbolication and the wider search/theme items remain open and larger.

**Design decision (the "grouping" fork).** "Other threads grouping" was under-specified, so the concrete choice: collapse **all** non-crash threads by identical stack signature (frame texts joined; thread name ignored so `pool-1-thread-3`/`pool-1-thread-7` on the same stack merge), one representative row per distinct stack with a **×N** badge — the same idiom as the shipped repeated-frame collapse. Broadening to all threads (not just app-frame ones) is safe precisely because grouping collapses the native duplicates that motivated the panel; caps prevent flooding.

**What shipped.**
- New pure module `crashlytics-thread-grouping.ts` — `groupCrashThreads(threads)` returns `ThreadGroup[]` (`rep`, `count`, `names`) in first-seen order (Map insertion order). No vscode dependency → unit-testable.
- `analysis-crash-detail.ts` — `renderCrashDetail` now passes every non-crash thread to the new `renderOtherThreads`, which groups, headers "N threads · M unique", renders one row per group with the ×N badge + collapsed sibling names (capped), caps display at 8 groups with a "+K more unique threads" note, and shows app frames when present else the thread's top native frames. Split into `renderThreadGroup` / `renderThreadFrames` / `renderThreadFrame` to keep every function ≤30 lines.
- CSS for `.cd-thread-count`, `.crash-thread-names`, `.crash-thread-more` added to **both** crash-detail style surfaces (`viewer-styles-crashlytics.ts` cd-body overlay — the live path — and `analysis-panel-styles.ts` editor-tab path), reusing the badge token look.
- `CHANGELOG.md` — `[8.0.4]` Changed entry.

**Note on l10n:** the crash-detail renderer is hardcoded English throughout (every label: "Other Threads", "Keys", "Logs", "Device Distribution", …); the new strings follow that existing file convention for consistency. Retrofitting the whole panel to the NLS pipeline is a separate, larger task, not part of this plan.

**Tests:** `crashlytics-thread-grouping.test.js` → 6 passing (collapse-with-count, distinct stays separate, group-by-stack-ignoring-name, first-seen order preserved, empty-frame threads group, empty input). `npm run check-types` clean; `npm run lint` no warnings on changed files; `analysis-crash-detail.ts` is 166 lines (under the 300 cap).

**Outstanding (plan stays active):** roadmap #2 symbolication (blocked on absent symbol artifacts); date-time range + multi-select search; the legacy-hex theme-token sweep in older crashlytics styles. On-device (F5) confirmation of the grouped panel rendering on a real multi-thread crash is the user's check.

**Finish report appended:** plans/054_plan-app-quality-insights.md
