# 054 — App Quality Insights (remaining)

## Status: Open — 6 remaining items

Stages 1–6 and their finish reports are archived at
`plans/history/2026.06/2026.06.12/054_plan-app-quality-insights_stages-1-6.md`
(666 lines: the Android Studio parity reference, gap analysis, API reality
check, the three pillars, and the Stage 5–6 delivery record). Read it for
background; everything still open is listed below.

## Remaining

### 1. OAuth setup wizard

The current setup path is the one the owner called "horrible" — it depends on
`gcloud` being installed and on PATH. A sign-in + project picker removes that
pain, is the smallest blast radius of any stage, and unblocks everything else.
Directly related to **bug 008** (Crashlytics OAuth scope wrong — silent 403).

Sequence this first. **Effort:** 2d.

### 2. Obfuscated-frame detection + guidance (NOT symbolication)

Real symbolication is blocked on artifacts the extension does not have: the
build's symbol files (`--split-debug-info` ELF symbols, NDK `.so` `.sym`, or R8
`mapping.txt`) plus a symbolizer binary (`flutter symbolize`, `ndk-stack`,
`llvm-symbolizer`, ProGuard `retrace`). Without those in the workspace there is
nothing to resolve against, and any "symbolicated" output would be fabricated.

Build the honest, smaller piece: **flag obfuscated frames and point the user at
the symbol artifacts / upload step.** Never claim symbolicated output without
the symbols, and never sell this item as symbolication. **Effort:** 1d.

### 3. Advanced search — date-range + multi-select

Regex search shipped (`.*` toggle, invalid-pattern outline, non-blanking on
partial patterns), as did type tabs, plain search, and single-select
version/device/OS. Remaining: a date-time range filter and multi-select on the
existing facets. **Effort:** 1d.

### 4. Jira / Linear issue creation

"Create issue" → GitHub shipped (prefilled new-issue page from the workspace
origin remote slug, with a warning when there is no GitHub remote). Jira and
Linear are not wired. **Effort:** 1d.

### 5. Legacy hex sweep in crashlytics styles

New surfaces (badges, bars, detail) use `--vscode-*` theme tokens, but a few
legacy hex values remain in the older crashlytics styles. Raw hex where a token
exists is a defect per the design-system rule. **Effort:** 2h.

### 6. Device/OS breakdown pane — replace the stub

`src/modules/crashlytics/crashlytics-stats.ts` is a **deliberate stub**. The
original code called `firebasecrashlytics…/issues/{id}:getStats`, which is not a
public API and always returns an HTML 404; the old `catch { return undefined; }`
turned that into a silently empty pane — the exact failure bug 008 set out to
kill.

The replacement is Play Developer Reporting's `errorCountMetricSet:query` with
`deviceModel` / `apiLevel` dimensions filtered by `errorIssueId`. The
`IssueStats` / `StatEntry` shape and `renderApiDistribution` are preserved so a
fetcher drops into the existing signature without touching the UI.

**Do not delete this item** — `crashlytics-stats.ts:12` points here by name.
**Effort:** 1d. **Depends on:** item 1 (OAuth).

## Deferred (detail in the archive, §6d–6e)

- **Repetitive / Regressed issue tags.** Repetitive is derivable now from a
  single snapshot (`firstVersion ≠ lastVersion`); Regressed needs the issue
  cache changed from single-overwrite to a timestamped, retention-bounded
  history. The `state` badge slot is already wired and dormant.
- **Device states (foreground/background).** Sourceable via `appProcessState`
  as an `errorCountMetricSet` dimension.
- **Background new-issue detection.** `startCrashlyticsAutoRefresh` currently
  takes a `PostFn` that posts into the webview, so it only runs while the panel
  is open — an out-of-panel alert needs that decoupled.

**Early crashes is not derivable and must not be faked.** Verified 2026-06-12
against the Play Reporting `ErrorReport` discovery schema: there is no
time-since-session-start field and no such filter dimension. Do not re-propose
it.
