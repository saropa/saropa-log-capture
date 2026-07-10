# Bug 012 — Unclosed Flutter banner leaks `error` severity onto unrelated lines

## Status: Fixed (pending review)

## Problem

Found while triaging a real capture (`contacts` app, RenderFlex overflow inside
`common_list_tile.dart`): a single `[flowmap] action "Permission" ...` navigation-log line —
unrelated app telemetry — shows as `Severity: Error` in the Trouble Report / Trouble Mode detail
pane. The line itself classifies as `info`; it is being dragged into an error banner it has nothing
to do with. The same leak also explains why an earlier "Copy Error/Warning JSON" export of a nearby
block reported `level: "error"` even though the block also contained a `[perf] [frame-stall] ...`
line — the block was inflated by the same unclosed banner sweeping in unrelated content.

**Investigated and ruled out as a separate defect:** whether Copy Error/Warning JSON should be able
to report `level: "performance"` for a block. It can't reach that case — the action is gated by
`rangeHasCopyableIncident` (`viewer-context-menu-incident-range.ts`), which requires an actual
error/warning line in the merged range; the menu item itself only ever renders as "Copy Error" /
"Copy Warning" (two labels, two icons — see `viewer-context-menu.ts:172-203`). A performance-only
block can never reach this action at all. Widening it to a third severity would be a feature change
(new menu label/icon), not a fix, so it is out of scope here.

```
{
  "level": "error",
  "error": "...RenderFlex overflowed...\n...\n[perf] [frame-stall] total=10605ms..."
}
```

```
# Saropa Trouble Report
**Severity:** Error
## Fault
[18:11:35.521] [console] [log] [flowmap] action "Permission" lib/database/drift_middleware/system_data/user_permission_drift_extensions_io.dart:166
```

## Root Cause

Flutter banner group never closes, forces `error` on everything after it.

`classifyFlutterBannerLine()` (`viewer-data-add-flutter-banner.ts`) opens a banner group on the
`══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞══` line and keeps every subsequent line tagged with
that `bannerGroupId` until it sees a closing rule (20+ `═` characters). In this capture the closing
rule never arrived — the RenderFlex dump cuts off mid-word ("...it indicate"), consistent with the
session's `maxLogLineLength: 2000` DAP setting truncating the stdout write before Flutter printed
its trailing rule.

With no close ever detected, `activeFlutterBanner` stays open for the rest of the file.
`viewer-data-add.ts`:

```js
if (bannerInfo.groupId !== -1) lvl = 'error';
```

forces `error` on every line carrying that `bannerGroupId`, regardless of its own content — sweeping
in the `[flowmap]` permission line, `[perf] [frame-stall]` lines, Crashlytics telemetry, and
MediaPlayer verbose logs that happened to follow the truncated exception.

## Changes Made

### File 1: `src/ui/viewer/viewer-data-add-flutter-banner.ts`

Cap how long a banner can stay open without a close: track the line count since `beginFlutterBanner`
and auto-close (synthesizing no footer role, matching the existing "missing close" behavior for a
new open) once it exceeds a max span, so a truncated dump can't force `error` on the rest of the
session.

## Tests Added

- `src/test/ui/viewer-flutter-banner-group.test.ts` — a banner with no closing rule auto-closes after
  the cap instead of tagging the rest of the file.

## Verification

- `npm run compile-tests` clean.
- `npm run test:file -- out/test/ui/viewer-flutter-banner-group.test.js` — 27 passing (26 existing +
  1 new).

## Commits

<!-- Add commit hashes as fixes land. -->
