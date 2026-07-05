# Error Notification Snackbars

Live log capture had no proactive signal when errors arrived: errors were only colored in the Log Viewer or surfaced once (the first error) on file load. A new opt-in setting now pops a notification for each newly detected error during capture, with buttons to open the viewer at that error line or open its bug report.

## Finish Report (2026-07-05)

### Objective

Add a user-facing option that, when a new error is detected in the captured log, shows a VS Code notification containing the error text with two actions: (a) open the Log Viewer focused on the error line, and (b) open the error/bug report for that error. Ship it off by default and coalesce notifications so a burst of errors does not flood the notification corner.

### Change summary

- **New setting `saropaLogCapture.showErrorSnackbars` (boolean, default `false`).** Declared in `package.json` with NLS keys (`config.showErrorSnackbars.title` / `.markdownDescription`) added to `package.nls.json` and all 11 locale files (key parity holds; values English pending the operator-run MT sync). Typed on `SaropaLogCaptureConfig` and read in `getConfig()` via `ensureBoolean(..., false)`.
- **New module `src/modules/features/error-snackbar.ts` (`ErrorSnackbarNotifier`).** Registered as a second `addLineListener` on `SessionManager` in `src/extension-activation.ts` (the fan-out supports N listeners; kept out of `activation-listeners.ts` to isolate the feature and respect its line budget). Per captured line it: skips markers, checks the setting, requires an origin file, strips ANSI, classifies with the existing `isErrorLine`, and — on a fresh error — shows a non-modal `showWarningMessage`.
- **Reuses existing utilities:** `isErrorLine` (`error-rate-alert.ts`), `normalizeLine` + `hashFingerprint` (`error-fingerprint-pure.ts`), and `stripAnsi` (`capture/ansi.ts`). No new classification or hashing code.
- **Two runtime l10n source keys:** `msg.errorSnackbar` (`strings-a.ts`) and `action.errorReport` (`strings-b.ts`); the existing `action.openLog` is reused for the first button.
- **Button wiring:** "Open Log" → `viewerProvider.loadFromFile(Uri.file(path))` then `scrollToLine(lineCount)`; "Error Report" → `showBugReport(text, lineCount - 1, Uri.file(path), context)` (the existing bug-report webview panel).

### Correctness invariants

- **Coalescing.** A line is suppressed if its fingerprint hash (`hashFingerprint(normalizeLine(text))`) was already shown this window, so timestamp/port/id variants of one error collapse to a single notification. A short cooldown (`COOLDOWN_MS = 4000`) additionally caps how fast distinct errors can stack. A cooldown-suppressed error is deliberately NOT recorded, so it can still surface once the cooldown passes.
- **Fingerprint set is bounded.** `seenHashes` is capped at `MAX_SEEN = 500`; on overflow the oldest (first-inserted) hash is evicted (Set preserves insertion order), so a long noisy session cannot grow the set without limit.
- **ANSI handling.** Captured text retains its color escapes (the webview renders ANSI→HTML). Classification, fingerprinting, and display all run on the ANSI-stripped text: an SGR code's trailing letter otherwise fuses with the following word (`…[31mError`), breaking `isErrorLine`'s `\b` word-boundary match and silently missing colored errors.
- **URI source.** `LineData.logFileUri` holds `session.fileUri.fsPath` — a filesystem path, not a URI string — so both buttons convert it with `Uri.file`, never `Uri.parse` (which would read a Windows drive letter as a scheme and open nothing).
- **Line listeners never throw.** The listener body is synchronous and side-effect-free until the fire-and-forget `showSnackbar`; that promise carries a `.catch()` that logs to the extension channel, so a rejecting button action (a failing `loadFromFile`/`showBugReport`) cannot surface as an unhandled rejection.
- **Runtime toggle without reload.** The enabled check reads the single setting key directly (`getConfiguration('saropaLogCapture').get('showErrorSnackbars', false)`) rather than rebuilding the full ~256-setting `getConfig()` object on every captured line — a deliberate hot-path choice for the live firehose, while staying fresh so the toggle takes effect immediately.

### Review fixes applied (post-implementation deep review)

A read-only review found four defects in the first implementation, all corrected before commit:

1. **Both buttons opened nothing (critical).** The wiring parsed the fsPath with `Uri.parse`; changed to `Uri.file` at both call sites. The unit test had masked this by stubbing the deps and never exercising the conversion.
2. **Unhandled-rejection risk.** The fire-and-forget `showSnackbar` had no rejection handler; added `.catch()` with `logExtensionWarn`.
3. **Per-line cost.** `isEnabled` rebuilt the whole config object per line even when off; switched to a single-key read.
4. **ANSI in classification/display.** Colored error lines were both mis-detected and mis-rendered; added `stripAnsi` on the shared path.

### Scope classification

VS Code extension (TypeScript). No Flutter/Dart. No webview message-type change (reuses the existing host→webview `scrollToLine`). Runtime l10n source keys added (English); the machine-translation pipeline was NOT run.

### Tests

- `src/test/modules/features/error-snackbar.test.ts` (new) — 15 passing: fires once per error; suppresses non-error / marker / warning-only / setting-off / no-file lines; coalesces fingerprint variants; suppresses inside cooldown then fires after; routes "Open Log" (1-based) and "Error Report" (0-based); dismissal routes nowhere; strips ANSI and collapses newlines in the shown text; evicts the oldest fingerprint past the cap so it can resurface. A separate `cleanForDisplay` suite pins short/untouched, truncation-with-ellipsis, ANSI strip, and whitespace collapse.
- `src/test/modules/config/integration-settings-manifest.test.ts` — added an assertion pinning `showErrorSnackbars` to `type: boolean`, `default: false`, guarding against a silent manifest/reader drift that would spam every user. File: 8 passing.
- `npm run check-types` clean; `npm run compile` green (verify-nls 511 keys aligned, nls-coverage regenerated, verify:l10n-keys resolves the two new keys, catalogs match, dist-size OK); `npm run lint` 0 errors on the changed files.

### Known limitations / follow-ups (not addressed)

- The focus target uses `LineData.lineCount`, which is read at enqueue time and lags the file by the write-queue depth during heavy bursts (documented at `activation-listeners.ts`). `loadFromFile` reloads the on-disk file so the focus still lands at or near the error; this matches the accuracy of the rest of the live pipeline.
- "Error Report" opens the markdown bug-report webview (which also copies the markdown). There is no separate JSON error-report artifact today; a JSON variant was intentionally left out of scope.
- `isErrorLine` matches broad tokens (`\bfailed\b`, `\bfatal\b`), so the notification can fire on any line containing those words rather than only on structured error levels. This is inherited from the shared classifier and not narrowed here.
