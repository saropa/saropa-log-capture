# 108 — Release date derived from app versionCode

## Status: Done

## Motivation

Crashlytics issues carry an Android `versionCode` string (`firstVersion` / `lastVersion`,
e.g. `2026012501`). Teams commonly encode the release date into the versionCode
(`yyyymmdd` + a build-of-day counter). When they do, the panel can derive a real release
date and let the user **filter and group issues by release date** instead of by an opaque
integer.

The versionCode is shown raw today ([viewer-crashlytics-panel.ts](../src/ui/panels/viewer-crashlytics-panel.ts)
`formatVersionRange`) and feeds the "Ver" filter ([viewer-crashlytics-interactions-script.ts](../src/ui/panels/viewer-crashlytics-interactions-script.ts)).

## Design

### Parser (pure, host-side, unit-tested)

`src/modules/crashlytics/version-date.ts` → `parseVersionDate(code): VersionDate | null`.

- Strip to digits, branch on length, try candidate layouts in **precedence order**, and
  accept the **first that forms a real calendar date** with year in a plausible window
  (2008–2099). Real-calendar-date + year-window validation is what stops non-date codes
  (`10402`, `4521`, semantic versions) and impossible dates from being misread.
- Precedence (handles the multi-format ask — `yyyymmdd`, `ddmmyyyy`, etc.):
  1. `yyyymmddNN` (10 digits → 8-digit date + 2-digit build seq) — matches `2026012501`.
  2. `yyyymmdd` (8) — 4-digit leading year is the strongest, least-ambiguous anchor.
  3. `ddmmyyyy` (8) — only when `yyyymmdd` is invalid (`25012026` → year 2501 rejected → 2026-01-25).
  4. `mmddyyyy` (8) — only when both above invalid (`01252026`).
  5. `yymmdd` (6) — lowest precedence; most ambiguous.
- Returns `{ ymd: 'YYYY-MM-DD', year, month, day, format, buildSeq? }` or `null`.
  `ymd` is the canonical, locale-neutral grouping/filter key.

### Display + filter + grouping

- `serializeContext` derives `firstReleaseDate` / `lastReleaseDate` (`ymd`) per issue and
  passes them to the webview (keeps the host `CrashlyticsIssue` domain type clean).
- Row meta shows the derived date next to the versionCode, with a tooltip noting it is
  derived from the version. No change when the code is not date-encoded.
- New "Release date" filter dropdown (`cp-reldate`) listing the union of derived dates,
  wired exactly like the existing version / device / OS selects (`data-reldates` attr).
- New sort option "Release date (newest)" so same-date issues cluster visually (grouping).

## Acceptance

- Unit tests cover each format, ambiguity disambiguation, invalid dates, and non-date codes
  (return `null`).
- `2026012501` renders as `2026-01-25` and is filterable/sortable by that date.
- A non-date versionCode (`10402`) shows unchanged, no derived date, not in the date filter.
- `check-types`, `lint`, targeted tests pass.

## Finish Report (2026-06-14)

### Scope

(B) VS Code extension (TypeScript). No Flutter/Dart code touched.

### What changed and why

Crashlytics issues surface an Android `versionCode` string (`firstVersion` / `lastVersion`)
that the Play Reporting API returns verbatim — an opaque integer such as `2026012501`. Teams
routinely encode the build date into that integer (`yyyymmdd` + a build-of-day counter), so the
panel can recover a real release date and let the user filter and sort by it instead of by the raw
number.

- `src/modules/crashlytics/version-date.ts` (new) — `parseVersionDate(code)` returns
  `{ ymd, year, month, day, format, buildSeq? }` or `null`. It strips to digits, branches on length
  (10 / 8 / 6), and tries candidate layouts in a fixed precedence (`yyyymmdd[NN]` → `ddmmyyyy` →
  `mmddyyyy` → `yymmdd`), accepting the first that forms a real calendar date inside a 2008–2099
  window. The real-calendar-date + year-window guard is what keeps plain counters (`4521`) and
  semantic versions (`10402`) from being misread as dates — they return `null` and display unchanged.
- `src/ui/shared/handlers/crashlytics-serializers.ts` — `serializeContext` derives
  `firstReleaseDate` / `lastReleaseDate` (the `ymd`) per issue and passes them to the webview, leaving
  the host `CrashlyticsIssue` domain type untouched.
- `src/ui/panels/viewer-crashlytics-issue-row.ts` (new) — the row-rendering helpers
  (`renderIssue`, `formatVersionRange`, `formatReleaseDate`) were extracted out of
  `viewer-crashlytics-panel.ts`, which had reached the 300-LOC limit. The fragment is concatenated
  into the panel script and runs in the same webview scope, relying on the shared `esc` / `vt`
  globals. `formatReleaseDate` appends a subdued, dotted-underline date label with a tooltip noting it
  is derived from the version code; the row also carries a `data-reldates` attribute.
- `src/ui/panels/viewer-crashlytics-panel.ts` — adds the `cp-reldate` filter dropdown and a
  `reldate` sort option to the filter bar.
- `src/ui/panels/viewer-crashlytics-interactions-script.ts` — adds `cpFRel` filter state, the
  `data-reldates` filter check, dropdown population (newest first), the release-date sort branch
  (ISO `YYYY-MM-DD` strings compare directly; no-date rows sort to the bottom), and the change wiring.
- `src/ui/viewer-styles/viewer-styles-crashlytics.ts` — `.cp-reldate` dotted-underline style.
- l10n: host `t()` keys (`viewer.crashlytics.filter.releaseDate`, `…releaseDateAbbr`,
  `viewer.crashlytics.sort.releaseDate`) in `strings-viewer-c.ts`; webview `vt()` key
  (`viewer.crashlytics.releaseDateTip`) in `strings-webview.ts`, placed there because it renders
  client-side and must enter the `__VT` map.

### Verification

- `npm run check-types` — clean.
- `npm run lint` (touched files) — zero warnings. The parser's `build` helper takes a `DateParts`
  object to stay within the 4-parameter limit; the panel split keeps every file under 300 LOC.
- `npm run compile` — full pipeline passes (webview catalogs, l10n-keys, NLS parity, dist-size).
- Tests: `version-date.test.ts` (new, 11 cases — every format, ambiguity disambiguation, leap years,
  impossible dates, non-date codes → null) passing; regression checks on
  `viewer-webview-l10n` (5), `play-reporting-mappers` (11), and `crashlytics-issue-signals` (7) all
  pass — no existing assertion pinned the version display or serializer shape that changed.

### Notes / defaults chosen

- When more than one layout yields a valid date, `yyyymmdd` wins — the 4-digit leading year is the
  strongest anchor. `ddmmyyyy` / `mmddyyyy` are reached only when the year-first reading is invalid.
- Detection keys on digit count (10 / 8 / 6). A version-code shape outside those lengths (e.g. a
  3-digit build suffix, or 7 digits) is not recognized and would need an added branch.
