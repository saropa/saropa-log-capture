# 045 — Device Log Triage

## Status: Draft

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
| **Device — other**    | Everything else from the Android OS                                       | `SettingsState`, `EGL_emulation`, `MediaCodec`, `Zygote`, boot chatter            | Hidden             |

**Device — critical lines are always shown regardless of the Device checkbox state.** They are the reason you cannot just hide all device logs.

## UI changes

### Log Inputs section (filter drawer + filters panel)

Replace the "app only" checkbox with two checkboxes:

```
[x] Flutter
[ ] Device
```

- **Flutter** — checked by default. Controls all `flutter`-tagged lines.
- **Device** — unchecked by default. Controls device-other lines only. Device-critical lines are always visible (not controlled by this checkbox).

The "app only" toggle, `appOnlyMode` variable, keyboard shortcut "A", and `setCaptureAll` message are all removed.

### Noise Reduction → Exclusions

Rename the section. With app-only moved out, only exclusion patterns remain. New title: **Exclusions**.

### Severity treatment

- **Device — other**: Logcat level prefix (`E/`, `W/`) is ignored for display severity. These lines render as neutral/info regardless of logcat level. No red, no yellow, no error dot.
- **Device — critical**: Keeps its logcat severity for display. An `E/AndroidRuntime` FATAL EXCEPTION should look like an error.
- **Flutter**: No change — classified by `classifyLevel()` as today.

### Signal analysis

- **Device — other**: Excluded from error classification, signal analysis, recurring error tracking, and ANR risk scoring.
- **Device — critical**: Included in analysis (these are real events).

### Capture-level exclusion

New setting: `saropaLogCapture.integrations.adbLogcat.captureDeviceOther` (default: `false`).

- When `false`: device-other lines are dropped at capture time in `adb-logcat-capture.ts` before they reach the viewer or the log file. Zero bloat.
- When `true`: device-other lines are captured and written to the log. The Device checkbox in Log Inputs controls display visibility.

This is distinct from PID filtering (`filterByPid`). PID filtering drops lines from other processes entirely. This setting drops lines classified as device-other, which can include lines from the app's own PID that happen to be system-tagged.

## Curated tag classification

Maintained in a new file: `src/modules/analysis/device-tag-tiers.ts`.

<!-- cspell:disable -->

### Device — critical (allowlist)

Tags where logcat errors/warnings can indicate real problems for the user's app:

- `AndroidRuntime` — fatal exceptions, native crashes
- `ActivityManager` — process killed, ANR, force stop
- `System.err` — stderr output (may include app-relevant errors)
- `art` — ART runtime errors (OOM, GC issues)
- `lowmemorykiller` — process killed for memory
- `InputDispatcher` — ANR-related input timeouts
- `WindowManager` — app window lifecycle issues

This list is small and grows conservatively. If uncertain, a tag stays in device-other (safe default: hidden, not mislabelled).

### Device — other (everything else)

All non-Flutter, non-critical tags. Common examples:

`SettingsState`, `EGL_emulation`, `MediaCodec`, `Zygote`, `SurfaceFlinger`, `gralloc`, `AudioFlinger`, `wifi`, `Bluetooth`, `telephony`, `adservices`, `DevicePersonalizationServices`, `NfcService`...

No need to enumerate — the critical list is the allowlist; everything else is other.

## Data flow

### Extension side (capture time)

1. `adb-logcat-capture.ts` parses each line
2. Extracts logcat tag via `adb-logcat-parser.ts`
3. Looks up tier in `device-tag-tiers.ts`: `getDeviceTier(tag)` → `'flutter' | 'device-critical' | 'device-other'`
4. If `captureDeviceOther` is false and tier is `device-other` → drop line
5. Otherwise, send to viewer with tier info alongside existing `fw` flag

### Webview side (display time)

1. `addToData()` receives tier (replaces binary `fw`)
2. Tier stored on line item (replaces `fw: boolean` with `tier: 'flutter' | 'device-critical' | 'device-other'`)
3. `calcItemHeight()` checks Flutter/Device checkbox state + tier
4. Device-critical lines bypass the Device checkbox — always visible
5. Device-other severity forced to neutral in `classifyLevel()` or at render time

## Migration

- `fw: true` → `tier: 'device-other'` (conservative default for existing lines)
- `fw: false` → `tier: 'flutter'`
- `appOnlyMode` setting in filter presets → mapped to `deviceEnabled: false`
- Keyboard shortcut "A" (toggleAppOnly) → remapped or removed

## Settings changes

| Setting                                                      | Change                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| `saropaLogCapture.integrations.adbLogcat.captureDeviceOther` | **New.** Default `false`.                               |
| `saropaLogCapture.filterPresets[].appOnlyMode`               | **Deprecated.** Map to `deviceEnabled: false` on load.  |
| `saropaLogCapture.deemphasizeFrameworkLevels`                | **Review.** May be replaced by per-tier severity rules. |

## Key files to modify

| File                                                         | Change                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/modules/analysis/device-tag-tiers.ts`                   | **New.** Curated critical/other tag classification.                                               |
| `src/modules/analysis/stack-parser.ts`                       | `isFrameworkLogLine()` returns tier instead of boolean.                                           |
| `src/modules/integrations/adb-logcat-capture.ts`             | Drop device-other at capture when setting is off.                                                 |
| `src/ui/viewer-toolbar/viewer-toolbar-filter-drawer-html.ts` | Replace app-only checkbox with Flutter/Device in Log Inputs. Rename Noise Reduction → Exclusions. |
| `src/ui/viewer-search-filter/viewer-filters-panel-html.ts`   | Same changes for the old panel.                                                                   |
| `src/ui/viewer-stack-tags/viewer-stack-filter.ts`            | Remove `appOnlyMode` / `toggleAppOnly`. Replace with tier-based filter.                           |
| `src/ui/viewer/viewer-data-helpers-core.ts`                  | `calcItemHeight()` — tier-aware logic, device-critical bypass.                                    |
| `src/ui/viewer/viewer-data-add.ts`                           | Store tier on items, apply severity demotion for device-other.                                    |
| `src/ui/viewer-decorations/viewer-error-classification.ts`   | Skip device-other in error classification.                                                        |
| `src/ui/viewer-search-filter/viewer-filters-panel-script.ts` | Bind Flutter/Device checkboxes.                                                                   |
| `src/ui/viewer-search-filter/viewer-filter-badge.ts`         | Update active filter count.                                                                       |
| `src/modules/storage/filter-presets.ts`                      | Replace `appOnlyMode` with `deviceEnabled`.                                                       |
| `src/ui/analysis/*`                                          | Exclude device-other from signal analysis.                                                        |

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
- Keyboard shortcut "A" no longer toggles a nonexistent mode
