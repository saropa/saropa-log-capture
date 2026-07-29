# Plan 114 (remaining) — Debug Screenshot Capture follow-ups

## Status: Open

Carried over from plan 114 (implemented 2026-07-28; full spec and Finish Report archived at
`plans/history/2026.07/2026.07.28/114_plan-debug-screenshot-capture.md`). The feature is
shipped and unit-tested; these are the verification and hardening items that remain.

## Finish Report (2026-07-29) — hardening, before/after diff, startup-noise guard

Three follow-up commits (559c30be, ae26e5d4, plus a review-fix commit) landed after the
initial implementation:

**Hardening.** `parseScreenshotReply` tolerates one level of result nesting and names the
removed-private-API failure mode explicitly on "Method not found". The VM Service URI now
has a fallback source: the Debug Console banner ("A Dart VM Service … is available at:")
registers the ws URI when the `dart.debuggerUris` event is absent, behind an `includes()`
fast-path; banner-derived entries are dropped on any session terminate so a dead socket is
never reused. The viewer's badge-row mapping prefers `line`-typed rows over stack/continuation
rows sharing a `sourceLineNo`. Footer controls carry `flex-shrink: 0`.

**Before/after diff (signal reports).** `selectDiffPair` (pure, unit-tested) pairs the error
capture nearest the signal anchor with the latest strictly-earlier capture of any trigger.
The Screenshots section renders a three-cell block — before frame, at-error frame, and a
canvas the shell script fills with a magenta change-heat overlay (per-pixel channel delta,
threshold 45, capped at 480px wide, zero-natural-size guarded) — computed client-side in
`signal-report-diff-script.ts` since the extension host has no image decoder; recomputed
after webview state restore.

**Startup-noise guard.** Audit against a real contacts startup log
(`reports/20260728/20260728_230826_contacts.log`) showed `isErrorLine` matches any logcat
`E/` line and any "failed" text, so benign framework errors (`E/Gralloc4` allocation probes,
`E/Badge` init) each fired a useless capture. `classifyTrigger` now consults the device-tier
classifier: the logcat feed never triggers; console/stdout relays suppress `device-other`
but keep `device-critical` (AndroidRuntime fatal exceptions, OOM kills — "real app problems"
per device-tag-tiers.ts) capturable. `onLine` checks the VM URI before the enabled setting so
pre-connect logcat replay bursts bail on a map read. Capturer suite: 22 cases pinning the
guard with the literal Gralloc/Badge lines from the contacts log plus the AndroidRuntime
relay that must still capture.

## 1. F5 verification of live capture (blocking for release confidence)

Unit tests cover triggers/coalescing/parsing, but `_flutter.screenshot` has never been
called against a real Flutter debug session from this extension. Run the original plan's
investigation checklist in the Extension Development Host:

- [ ] Confirm the `dart.debuggerUris` custom event fires and `vmServiceUri` converts to a connectable ws URI (`toVmServiceWsUri`). A console-banner fallback ("A Dart VM Service … is available at:") now also registers the URI when the event is absent — verify whichever path fires.
- [ ] Verify the before/after diff block renders in a signal report when `onNavigation` is enabled and an error follows a screen entry (canvas heat overlay, magenta = changed pixels).
- [ ] Confirm `_flutter.screenshot` returns `result.screenshot` (base64 PNG) with empty params on a `flutter run --debug` session; note whether it captures the Flutter surface only or full device frame.
- [ ] Measure capture latency; if >~200ms consider whether the single-in-flight drop policy loses too many triggers.
- [ ] Verify the full chain: error line → PNG in `<base>.screenshots/` → viewer badge → popover → footer counter → gallery → signal report strip → timeline event.
- [ ] Non-Flutter debug session: capture silently unavailable, no errors or UI noise.

## 2. Retention: delete screenshot sidecars with their log

File retention soft-trashes logs via metadata and hard-delete paths (trash commands,
permanent delete) do not remove `<base>.screenshots/` or `<base>.screenshots.json`.
Wire sidecar-directory removal into whatever path physically deletes a log file, and
add a verification case: deleting a log removes its screenshots.

## 3. Multi-session correlation (deferred until real use case)

`getLatestVmServiceWsUri()` returns the most recently announced URI with no correlation
to the triggering log. With two Flutter sessions live at once a capture can screenshot
the wrong app (documented in `vm-service-uri.ts`). Correlating needs a debug-session-id →
LogSession mapping threaded through LineData.

## 4. Optional: image downscaling (needs go/no-go)

Full-resolution PNGs are saved; the original plan's ≤1280px resize needs an image
dependency (blast-radius decision). All inline data-URI reads are capped at 10 MB, so
this is a disk/size nicety, not a correctness issue. Requires explicit owner approval
before adding any dependency.
