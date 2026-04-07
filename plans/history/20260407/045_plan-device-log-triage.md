# 045 — Device Log Triage

<!-- cspell:disable -->

## Status: Done

## Problem

Flutter emulator sessions flood the viewer with device (Android OS) log lines. Six concrete problems:

1. **False severity** — Device logs like `E/SettingsState` display as red errors. The logcat `E` prefix does not mean the user has an error. These false alarms train users to ignore real errors.
2. **Flooding** — Hundreds of device lines bury actual app output. Users cannot find their own logs.
3. **False signals** — Signal analysis and error classification count device errors as real issues, producing misleading dashboards.
4. **All-or-nothing toggle** — The current "app only" checkbox hides every non-Flutter line. Users who enable it risk missing device messages that genuinely affect their app (e.g. `AndroidRuntime` fatal, `ActivityManager` process kill).
5. **Unmanageable tags** — 250+ logcat tags makes per-tag curation unusable.
6. **Log file bloat** — Device-other lines inflate saved logs to 10,000+ lines of irrelevant output. Some users want the complete picture; most do not.

## Classification: three tiers

Every non-Flutter logcat line is classified into one of two device tiers. Classification is a curated editorial decision maintained in code — not a user responsibility.

| Tier                  | What                                                                      | Examples                                                                          | Default visibility |
| --------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------ |
| **Flutter**           | `flutter` logcat tag — the user's app                                     | App prints, Dart exceptions, Drift SQL                                            | Shown              |
| **Device — critical** | Device tags/patterns that can indicate a problem affecting the user's app | `AndroidRuntime`, `ActivityManager` (kill/crash), `FATAL EXCEPTION`, `System.err` | Shown              |
| **Device — other**    | Everything else from the Android OS                                       | `SettingsState`, `EGL_emulation`, `MediaCodec`, boot chatter                      | Hidden             |

**Device — critical lines are always shown regardless of the Device checkbox state.** They are the reason you cannot just hide all device logs.

## Completed

The core tier system is implemented and shipping:

<!-- cspell:disable-next-line -->

- **`device-tag-tiers.ts`** — `DeviceTier` type, `getDeviceTier()`, `isTierAlwaysVisible()`. Critical allowlist: `androidruntime`, `activitymanager`, `system.err`, `art`, `lowmemorykiller`, `inputdispatcher`, `windowmanager`, `dalvikvm`, `zygote`, `choreographer`.
- **`stack-parser.ts`** — `classifyLogLine()` returns `DeviceTier`. Legacy `isFrameworkLogLine()` is a deprecated boolean wrapper that delegates to `classifyLogLine()`.
- **`viewer-stack-filter.ts`** — Tier-based filter with `showFlutter`/`showDevice` variables and `isTierHidden()`. Device-critical bypasses the Device checkbox.
- **`viewer-data-add.ts`** — `addToData()` accepts both `tier` and legacy `fw` parameters. Migration fallback: `fw: true` → `'device-other'`, `fw: false` → `'flutter'`. Both coexist for backward compatibility with cached/loaded sessions.
- **`filter-presets.ts`** — `deviceEnabled` property. Legacy `appOnlyMode` marked `@deprecated` with migration path.
- **`adb-logcat-capture.ts`** — `captureDeviceOther` setting drops device-other lines at capture time when `false` (default).
- **Filter drawer + panel** — Flutter/Device checkboxes in Log Inputs section replace the old app-only toggle.

## Remaining work

### ~~P0 — Legacy cleanup~~ ✓ Done

- ~~Remove `setCaptureAll` message handler~~ — removed from `viewer-message-handler-session-ui.ts`
- ~~Remove `appOnlyMode` setting from `package.json` and nls files~~ — removed definition and all 11 translations. TS migration code in `filter-presets.ts` and `viewer-presets.ts` intentionally retained for old saved presets.
- `toggleAppOnly` — already absent from `package.json`/nls files (removed in earlier work)

### ~~P1 — Rename "Noise Reduction" → "Exclusions"~~ ✓ Done

Renamed in:
- `viewer-toolbar-filter-drawer-html.ts` (accordion title)
- `viewer-filters-panel-html.ts` (section title)
- `viewer-filters-panel.ts` (JSDoc comment)
- Tests: `viewer-toolbar.test.ts`, `viewer-filters-panel-clarity.test.ts`

### ~~P2 — Decide on `deemphasizeFrameworkLevels`~~ ✓ Done

Decision: **Deprecated and disconnected.** The setting was either redundant or harmful:
- Device-other: severity already demoted to `info` in `addToData()` — setting was redundant.
- Device-critical: setting muted `E/AndroidRuntime` crashes — actively harmful, defeats the critical tier.

Changes: removed `fwMuted` logic from `renderItem`, removed the variable and message handler from `viewer-error-classification.ts`, removed from config pipeline (`config-types.ts`, `config.ts`, `extension-lifecycle.ts`, `activation-listeners.ts`, `log-viewer-provider-setup.ts`). Setting marked deprecated in `package.json` with explanation. Tests updated.

## UI changes

### Log Inputs section (filter drawer + filters panel)

**Done.** The "app only" checkbox is replaced with two checkboxes:

```
[x] Flutter
[ ] Device
```

- **Flutter** — checked by default. Controls all `flutter`-tagged lines.
- **Device** — unchecked by default. Controls device-other lines only. Device-critical lines are always visible (not controlled by this checkbox).

### Noise Reduction → Exclusions

**Not done.** With app-only moved out, only exclusion patterns remain. Rename the section title to **Exclusions**.

### Severity treatment

- **Device — other**: Logcat level prefix (`E/`, `W/`) is ignored for display severity. These lines render as neutral/info regardless of logcat level. No red, no yellow, no error dot.
- **Device — critical**: Keeps its logcat severity for display. An `E/AndroidRuntime` FATAL EXCEPTION should look like an error.
- **Flutter**: No change — classified by `classifyLevel()` as today.

### Signal analysis

- **Device — other**: Excluded from error classification, signal analysis, recurring error tracking, and ANR risk scoring.
- **Device — critical**: Included in analysis (these are real events).

### Capture-level exclusion

**Done.** Setting: `saropaLogCapture.integrations.adbLogcat.captureDeviceOther` (default: `false`).

- When `false`: device-other lines are dropped at capture time in `adb-logcat-capture.ts` before they reach the viewer or the log file. Zero bloat.
- When `true`: device-other lines are captured and written to the log. The Device checkbox in Log Inputs controls display visibility.

This is distinct from PID filtering (`filterByPid`). PID filtering drops lines from other processes entirely. This setting drops lines classified as device-other, which can include lines from the app's own PID that happen to be system-tagged.

## Curated tag classification

Maintained in `src/modules/analysis/device-tag-tiers.ts`.

<!-- cspell:disable -->

### Device — critical (allowlist)

Tags where logcat errors/warnings can indicate real problems for the user's app:

- `AndroidRuntime` — fatal exceptions, native crashes
- `ActivityManager` — process killed, ANR, force stop
- `System.err` — stderr output (may include app-relevant errors)
- `art` — ART runtime errors (OOM, GC issues)
- `lowmemorykiller` — process killed for memory pressure
- `InputDispatcher` — ANR-related input timeouts
- `WindowManager` — app window lifecycle issues
- `dalvikvm` — older runtime errors (pre-ART devices)
- `zygote` — process fork failures
- `choreographer` — main thread jank (reports app behavior, not device state)

This list is small and grows conservatively. If uncertain, a tag stays in device-other (safe default: hidden, not mislabelled).

### Device — other (everything else)

All non-Flutter, non-critical tags. Common examples:

`SettingsState`, `EGL_emulation`, `MediaCodec`, `SurfaceFlinger`, `gralloc`, `AudioFlinger`, `wifi`, `Bluetooth`, `telephony`, `adservices`, `DevicePersonalizationServices`, `NfcService`...

No need to enumerate — the critical list is the allowlist; everything else is other.

<!-- cspell:enable -->

## Data flow

### Extension side (capture time)

**Done.**

1. `adb-logcat-capture.ts` parses each line
2. Extracts logcat tag via `adb-logcat-parser.ts`
3. Looks up tier in `device-tag-tiers.ts`: `getDeviceTier(tag)` → `'flutter' | 'device-critical' | 'device-other'`
4. If `captureDeviceOther` is false and tier is `device-other` → drop line
5. Otherwise, send to viewer with tier info alongside legacy `fw` flag

### Webview side (display time)

**Done.**

1. `addToData()` receives `tier` (plus legacy `fw` for backward compat)
2. Migration fallback: `fw: true` → `'device-other'`, `fw: false` → `'flutter'`
3. `calcItemHeight()` calls `isTierHidden()` which checks Flutter/Device checkbox state + tier
4. Device-critical lines bypass the Device checkbox — always visible
5. Device-other severity forced to neutral in `classifyLevel()` or at render time

## Migration

**Done.**

- `fw: true` → `tier: 'device-other'` (conservative default for existing lines)
- `fw: false` → `tier: 'flutter'`
- `appOnlyMode` in filter presets → mapped to `deviceEnabled: false` (deprecated property retained for migration)
- Legacy `fw` parameter still accepted in `addToData()` for sessions saved before tier support

## Settings changes

| Setting                                                      | Change                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `saropaLogCapture.integrations.adbLogcat.captureDeviceOther` | **Done.** Default `false`.                                     |
| `saropaLogCapture.filterPresets[].appOnlyMode`               | **Removed from `package.json`.** TS migration retained.        |
| `saropaLogCapture.deemphasizeFrameworkLevels`                | **Deprecated.** Disconnected from pipeline; tier system handles it. |

## Key files

| File                                                         | Status      | Notes                                                                        |
| ------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------- |
| `src/modules/analysis/device-tag-tiers.ts`                   | **Done**    | Curated critical/other tag classification.                                   |
| `src/modules/analysis/stack-parser.ts`                       | **Done**    | `classifyLogLine()` returns tier. `isFrameworkLogLine()` deprecated wrapper. |
| `src/modules/integrations/adb-logcat-capture.ts`             | **Done**    | Drops device-other at capture when setting is off.                           |
| `src/ui/viewer-toolbar/viewer-toolbar-filter-drawer-html.ts` | **Done**    | Flutter/Device checkboxes. Section renamed to "Exclusions".                  |
| `src/ui/viewer-search-filter/viewer-filters-panel-html.ts`   | **Done**    | Flutter/Device checkboxes. Section renamed to "Exclusions".                  |
| `src/ui/viewer-stack-tags/viewer-stack-filter.ts`            | **Done**    | Tier-based `isTierHidden()`. No trace of `appOnlyMode`.                      |
| `src/ui/viewer/viewer-data-helpers-core.ts`                  | **Done**    | `calcItemHeight()` tier-aware via `isTierHidden()`.                          |
| `src/ui/viewer/viewer-data-add.ts`                           | **Done**    | Stores tier on items with `fw` fallback migration.                           |
| `src/ui/viewer-decorations/viewer-error-classification.ts`   | **Done**    | Skips device-other in error classification.                                  |
| `src/ui/viewer-search-filter/viewer-filters-panel-script.ts` | **Done**    | Binds Flutter/Device checkboxes.                                             |
| `src/ui/viewer-search-filter/viewer-filter-badge.ts`         | **Done**    | Active filter count updated.                                                 |
| `src/modules/storage/filter-presets.ts`                      | **Done**    | `deviceEnabled` replaces `appOnlyMode` (deprecated, kept for migration).     |
| `src/ui/provider/viewer-message-handler-session-ui.ts`       | **Done**    | Dead `setCaptureAll` handler removed.                                        |
| `package.json` + `package.nls.*.json`                        | **Done**    | `appOnlyMode` setting definition and translations removed.                   |

## Follow-up: per-tag user curation

**Problem:** The curated critical tag list is maintained in code. Users cannot promote a tag from device-other to device-critical, or demote one they don't care about. With 250+ tags, the extension's editorial judgement will sometimes be wrong for a specific user's context.

**Solution:** Let users override the curated tier for individual tags. When a user right-clicks a tag chip in Message Tags, offer "Always show (treat as critical)" and "Always hide (treat as device-other)". Store overrides in workspace settings (`saropaLogCapture.deviceTagOverrides`). Overrides take precedence over the curated list in `device-tag-tiers.ts`. This is distinct from the existing tag chip show/hide — those hide by source tag, this reclassifies the _logcat_ tag tier.

**Integration:** Feeds into the noise learning plan (025) — accepted suggestions could auto-generate tag overrides.

## Follow-up: content-pattern classification

**Problem:** Tag-based classification alone misses cases where the _message content_ determines whether a line is noise or important. `E/SettingsState: invalid override flag name ...` is always noise regardless of the tag. Conversely, `I/ActivityManager: Force stopping ...` with your app's package name is important despite being level-I.

**Solution:** Add a content pattern layer to `device-tag-tiers.ts` that runs after tag classification. Two pattern lists:

- **Demote patterns:** Lines matching these are forced to device-other regardless of tag tier. Examples: `/invalid override flag name/`, `/Service not found for/`, `/eglCodecConfig/`.
- **Promote patterns:** Lines matching these are promoted to device-critical regardless of tag tier. Examples: `/Force stopping.*<package>/`, `/FATAL EXCEPTION/`, `/has died/`, `/ANR in/`.

Patterns are evaluated in order: promote wins over demote. The pattern lists are curated in code (like the tag lists) and can be extended by user overrides in settings (`saropaLogCapture.deviceContentPromotePatterns`, `saropaLogCapture.deviceContentDemotePatterns`).

**Performance:** Runs only on device lines (not Flutter lines), so the regex cost applies to a subset. Patterns are pre-compiled at startup.

## Follow-up: non-Android platforms (iOS)

**Problem:** iOS device logs (`os_log` via `idevicesyslog` or Xcode console) follow a completely different format from Android logcat. The current tier classification assumes Android logcat tag format. iOS Flutter developers get no tier filtering at all.

**Solution:** Add an iOS log parser alongside `adb-logcat-parser.ts` — detect the platform from the debug session type or log format. iOS `os_log` has subsystem/category fields that serve a similar role to Android tags. Map iOS subsystems to the same three-tier model:

- **Flutter:** subsystem matches the app bundle identifier
- **Device-critical:** subsystems like `com.apple.runningboard` (process lifecycle), `com.apple.CoreSimulator` (crashes)
- **Device-other:** everything else (`com.apple.MediaPlayer`, `com.apple.network`, etc.)

The curated subsystem list follows the same pattern as the Android tag list — small critical allowlist, everything else is device-other.

**Dependency:** Requires an iOS log capture integration (equivalent to the adb logcat integration). This is a larger feature that includes spawning `idevicesyslog` or reading Xcode console output.

## Testing

- Device-other lines hidden by default, no red/yellow severity
- Device-critical lines visible even with Device unchecked
- Signal analysis ignores device-other errors
- `captureDeviceOther: false` → device-other lines absent from log file
- `captureDeviceOther: true` → device-other lines in log file, hidden in viewer by default
- Filter presets with `appOnlyMode` migrate correctly
- Legacy `fw` parameter in loaded sessions maps to correct tier
